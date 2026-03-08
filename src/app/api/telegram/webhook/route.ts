import { NextRequest, NextResponse } from "next/server";
import { editTelegramMessage, answerCallbackQuery, sendTelegramMessage } from "@/lib/telegram";
import { getSupabase } from "@/lib/supabase-server";

// In-memory map: tg_user_id -> order_id awaiting photo proof
// In production, use Redis or a DB table
const pendingPhotoProof = new Map<number, string>();

async function getOrderMessage(orderId: string) {
  const supabase = getSupabase();
  const { data: order } = await supabase
    .from("orders")
    .select("id, status, total_amount, payment_method, tg_chat_id, tg_message_id, clients(name)")
    .eq("id", orderId)
    .single();

  if (!order) return null;

  const { data: items } = await supabase
    .from("order_items")
    .select("quantity, products(name)")
    .eq("order_id", orderId);

  const PAYMENT_LABELS: Record<string, string> = {
    cash: "Наличные",
    transfer: "Перевод",
    credit: "В долг",
  };

  const clientName = (order.clients as unknown as { name: string } | null)?.name ?? "—";
  const itemLines = (items ?? [])
    .map((i) => {
      const productName = (i.products as unknown as { name: string } | null)?.name ?? "—";
      return `  • ${productName} x ${i.quantity} шт`;
    })
    .join("\n");

  const header =
    `🏢 <b>Клиент:</b> ${clientName}\n` +
    `📦 <b>Товары:</b>\n${itemLines}\n` +
    `💰 <b>Сумма:</b> ${Number(order.total_amount).toLocaleString()} ₸\n` +
    `💳 <b>Оплата:</b> ${PAYMENT_LABELS[order.payment_method ?? ""] ?? "—"}`;

  return { order, header };
}

async function handleCallback(callbackQuery: {
  id: string;
  from: { id: number; first_name: string };
  message: { chat: { id: number }; message_id: number };
  data: string;
}) {
  const supabase = getSupabase();
  const params = new URLSearchParams(callbackQuery.data);
  const action = params.get("action");
  const orderId = params.get("order_id");

  if (!action || !orderId) {
    await answerCallbackQuery(callbackQuery.id, "Ошибка: неизвестная команда");
    return;
  }

  const result = await getOrderMessage(orderId);
  if (!result) {
    await answerCallbackQuery(callbackQuery.id, "Заказ не найден");
    return;
  }

  const { order, header } = result;
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const userName = callbackQuery.from.first_name;

  // ── STATE: new → picking ──
  if (action === "pick") {
    if (order.status !== "new") {
      await answerCallbackQuery(callbackQuery.id, "Заказ уже взят в работу");
      return;
    }

    await supabase.from("orders").update({ status: "picking" }).eq("id", orderId);

    const text =
      `${header}\n\n` +
      `🟡 <b>Статус: Сборка</b>\n` +
      `👷 Взял в работу: ${userName}`;

    await editTelegramMessage(chatId, messageId, text, [
      [{ text: "✅ Готово к отгрузке", callback_data: `action=ready&order_id=${orderId}` }],
    ]);

    await answerCallbackQuery(callbackQuery.id, "Вы взяли заказ в сборку");
  }

  // ── STATE: picking → ready ──
  else if (action === "ready") {
    if (order.status !== "picking") {
      await answerCallbackQuery(callbackQuery.id, "Заказ не на сборке");
      return;
    }

    await supabase.from("orders").update({ status: "ready" }).eq("id", orderId);

    const text =
      `${header}\n\n` +
      `🟢 <b>Статус: Готово к отгрузке</b>\n` +
      `📦 Собрал: ${userName}`;

    await editTelegramMessage(chatId, messageId, text, [
      [{ text: "🚚 Взять доставку", callback_data: `action=deliver&order_id=${orderId}` }],
    ]);

    await answerCallbackQuery(callbackQuery.id, "Заказ готов к отгрузке");
  }

  // ── STATE: ready → delivering ──
  else if (action === "deliver") {
    if (order.status !== "ready") {
      await answerCallbackQuery(callbackQuery.id, "Заказ не готов к отгрузке");
      return;
    }

    await supabase.from("orders").update({ status: "delivering" }).eq("id", orderId);

    const text =
      `${header}\n\n` +
      `🔵 <b>Статус: Доставка</b>\n` +
      `🚚 Водитель: ${userName}`;

    await editTelegramMessage(chatId, messageId, text, [
      [{ text: "📍 Прибыл на точку", callback_data: `action=arrived&order_id=${orderId}` }],
    ]);

    await answerCallbackQuery(callbackQuery.id, "Вы взяли заказ на доставку");
  }

  // ── STATE: delivering → arrived (requires photo) ──
  else if (action === "arrived") {
    if (order.status !== "delivering") {
      await answerCallbackQuery(callbackQuery.id, "Заказ не на доставке");
      return;
    }

    await supabase.from("orders").update({ status: "arrived" }).eq("id", orderId);

    // Register that this user must send a photo
    pendingPhotoProof.set(callbackQuery.from.id, orderId);

    const text =
      `${header}\n\n` +
      `🟠 <b>Статус: На точке</b>\n` +
      `📍 Водитель прибыл: ${userName}\n\n` +
      `⏳ <i>Ожидается фото подписанной накладной...</i>`;

    await editTelegramMessage(chatId, messageId, text, null);

    await sendTelegramMessage(
      chatId,
      `📸 <b>${userName}</b>, пожалуйста, отправьте фото подписанной накладной для закрытия заказа.`
    );

    await answerCallbackQuery(callbackQuery.id, "Отправьте фото накладной");
  }
}

async function handlePhoto(message: {
  from: { id: number; first_name: string };
  chat: { id: number };
  photo: { file_id: string }[];
}) {
  const supabase = getSupabase();
  const userId = message.from.id;
  const orderId = pendingPhotoProof.get(userId);

  if (!orderId) return; // No pending proof for this user

  // Get the highest resolution photo
  const fileId = message.photo[message.photo.length - 1].file_id;

  // Save proof
  await supabase.from("delivery_proofs").insert({
    order_id: orderId,
    tg_file_id: fileId,
    uploaded_by_name: message.from.first_name,
  });

  // Complete the order: deduct stock, clear reservations
  const { data: items } = await supabase
    .from("order_items")
    .select("product_id, quantity")
    .eq("order_id", orderId);

  if (items) {
    for (const item of items) {
      await supabase.rpc("complete_order_item", {
        p_product_id: item.product_id,
        p_quantity: item.quantity,
      });
    }
  }

  await supabase
    .from("orders")
    .update({ status: "completed" })
    .eq("id", orderId);

  // Clear pending
  pendingPhotoProof.delete(userId);

  // Update the original telegram message
  const result = await getOrderMessage(orderId);
  if (result) {
    const { order, header } = result;
    if (order.tg_chat_id && order.tg_message_id) {
      const text =
        `${header}\n\n` +
        `✅ <b>Статус: Доставлено</b>\n` +
        `🚚 Доставил: ${message.from.first_name}\n` +
        `📸 Фото накладной получено`;

      await editTelegramMessage(
        Number(order.tg_chat_id),
        Number(order.tg_message_id),
        text,
        null
      );
    }
  }

  await sendTelegramMessage(
    message.chat.id,
    `✅ Заказ закрыт! Фото накладной сохранено. Спасибо, ${message.from.first_name}!`
  );
}

export async function POST(req: NextRequest) {
  const update = await req.json();

  // Handle inline button clicks
  if (update.callback_query) {
    handleCallback(update.callback_query); // fire-and-forget
  }

  // Handle photo messages (delivery proof)
  if (update.message?.photo) {
    handlePhoto(update.message); // fire-and-forget
  }

  // Always return 200 immediately so Telegram doesn't retry
  return NextResponse.json({ ok: true });
}
