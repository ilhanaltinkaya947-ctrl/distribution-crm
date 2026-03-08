import { NextRequest, NextResponse } from "next/server";
import { sendTelegramMessage } from "@/lib/telegram";
import { getSupabase } from "@/lib/supabase-server";

interface OrderItem {
  name: string;
  quantity: number;
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  const { orderId, clientName, items, total, paymentMethod } = (await req.json()) as {
    orderId: string;
    clientName: string;
    items: OrderItem[];
    total: number;
    paymentMethod: string;
  };

  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) {
    return NextResponse.json({ ok: false, error: "No chat ID" }, { status: 500 });
  }

  const PAYMENT_LABELS: Record<string, string> = {
    cash: "Наличные",
    transfer: "Перевод",
    credit: "В долг",
  };

  const itemLines = items.map((i) => `  • ${i.name} x ${i.quantity} шт`).join("\n");

  const message =
    `🚨 <b>НОВЫЙ ЗАКАЗ</b>\n\n` +
    `🏢 <b>Клиент:</b> ${clientName}\n` +
    `📦 <b>Товары:</b>\n${itemLines}\n` +
    `💰 <b>Сумма:</b> ${total.toLocaleString()} ₸\n` +
    `💳 <b>Оплата:</b> ${PAYMENT_LABELS[paymentMethod] ?? paymentMethod}\n\n` +
    `⏳ <i>Статус: Новый — ожидает сборки</i>`;

  const buttons = [
    [{ text: "📦 Взять в сборку", callback_data: `action=pick&order_id=${orderId}` }],
  ];

  const result = await sendTelegramMessage(chatId, message, buttons);

  // Save telegram message reference for later editing
  if (result) {
    await supabase
      .from("orders")
      .update({ tg_chat_id: result.chat.id, tg_message_id: result.message_id })
      .eq("id", orderId);
  }

  return NextResponse.json({ ok: true });
}
