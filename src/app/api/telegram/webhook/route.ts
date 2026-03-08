import { NextRequest, NextResponse } from "next/server";
import { editTelegramMessage, answerCallbackQuery, sendTelegramMessage } from "@/lib/telegram";
import { getSupabase } from "@/lib/supabase-server";

// In-memory map: tg_user_id -> order_id awaiting photo proof
const pendingPhotoProof = new Map<number, string>();
// In-memory map: tg_user_id -> step in new order flow
const orderFlows = new Map<number, { step: string; client_id?: string; items?: { product_id: string; name: string; price: number; quantity: number }[] }>();

// ═══════════════════════════════════════════
// MAIN MENU
// ═══════════════════════════════════════════
async function sendMainMenu(chatId: number) {
  const text =
    `📊 <b>CRM Дистрибуция</b>\n\n` +
    `Выберите действие:`;

  await sendTelegramMessage(chatId, text, [
    [{ text: "📋 Заказы", callback_data: "menu=orders" }, { text: "➕ Новый заказ", callback_data: "menu=neworder" }],
    [{ text: "👥 Клиенты", callback_data: "menu=clients" }, { text: "📦 Склад", callback_data: "menu=stock" }],
    [{ text: "💸 Долги", callback_data: "menu=debts" }],
  ]);
}

// ═══════════════════════════════════════════
// ORDERS LIST
// ═══════════════════════════════════════════
async function sendOrdersList(chatId: number) {
  const supabase = getSupabase();
  const { data: orders } = await supabase
    .from("orders")
    .select("id, status, total_amount, payment_method, payment_status, created_at, clients(name)")
    .order("created_at", { ascending: false })
    .limit(10);

  if (!orders || orders.length === 0) {
    await sendTelegramMessage(chatId, "📋 Нет заказов", [
      [{ text: "◀️ Главное меню", callback_data: "menu=main" }],
    ]);
    return;
  }

  const STATUS: Record<string, string> = {
    new: "🟡 Новый", picking: "🔵 Сборка", ready: "🟢 Готов",
    delivering: "🚚 Доставка", arrived: "📍 На точке", completed: "✅ Выполнен", cancelled: "❌ Отменён",
  };
  const PAY: Record<string, string> = { cash: "нал", transfer: "перевод", credit: "долг" };

  let text = `📋 <b>Последние заказы:</b>\n\n`;
  orders.forEach((o: any, i: number) => {
    const client = (o.clients as any)?.name ?? "—";
    const date = new Date(o.created_at).toLocaleDateString("ru-RU");
    const debt = o.payment_status === "unpaid" ? " ⚠️ДОЛГ" : "";
    text += `${i + 1}. ${STATUS[o.status] ?? o.status}\n`;
    text += `   🏢 ${client} | ${Number(o.total_amount).toLocaleString()} ₸\n`;
    text += `   💳 ${PAY[o.payment_method] ?? "—"}${debt} | 📅 ${date}\n\n`;
  });

  await sendTelegramMessage(chatId, text, [
    [{ text: "➕ Новый заказ", callback_data: "menu=neworder" }],
    [{ text: "◀️ Главное меню", callback_data: "menu=main" }],
  ]);
}

// ═══════════════════════════════════════════
// CLIENTS LIST
// ═══════════════════════════════════════════
async function sendClientsList(chatId: number) {
  const supabase = getSupabase();
  const { data: clients } = await supabase.from("clients").select("*").order("name");

  if (!clients || clients.length === 0) {
    await sendTelegramMessage(chatId, "👥 Нет клиентов", [
      [{ text: "◀️ Главное меню", callback_data: "menu=main" }],
    ]);
    return;
  }

  let text = `👥 <b>Клиенты:</b>\n\n`;
  clients.forEach((c: any, i: number) => {
    text += `${i + 1}. <b>${c.name}</b>\n`;
    text += `   📍 ${c.address ?? "—"}\n`;
    text += `   📞 ${c.phone ?? "—"}\n\n`;
  });

  await sendTelegramMessage(chatId, text, [
    [{ text: "◀️ Главное меню", callback_data: "menu=main" }],
  ]);
}

// ═══════════════════════════════════════════
// STOCK
// ═══════════════════════════════════════════
async function sendStock(chatId: number) {
  const supabase = getSupabase();
  const { data: products } = await supabase.from("products").select("*").order("name");

  if (!products || products.length === 0) {
    await sendTelegramMessage(chatId, "📦 Нет товаров", [
      [{ text: "◀️ Главное меню", callback_data: "menu=main" }],
    ]);
    return;
  }

  let text = `📦 <b>Склад:</b>\n\n`;
  products.forEach((p: any) => {
    const available = p.stock_quantity - (p.reserved_quantity ?? 0);
    const warn = available < 50 ? " ⚠️" : "";
    const reserved = (p.reserved_quantity ?? 0) > 0 ? ` (резерв: ${p.reserved_quantity})` : "";
    text += `• <b>${p.name}</b>\n`;
    text += `  ${Number(p.price).toLocaleString()} ₸ | Доступно: ${available}${reserved}${warn}\n\n`;
  });

  await sendTelegramMessage(chatId, text, [
    [{ text: "◀️ Главное меню", callback_data: "menu=main" }],
  ]);
}

// ═══════════════════════════════════════════
// DEBTS
// ═══════════════════════════════════════════
async function sendDebts(chatId: number) {
  const supabase = getSupabase();
  const { data: orders } = await supabase
    .from("orders")
    .select("total_amount, created_at, clients(name)")
    .eq("payment_status", "unpaid")
    .neq("status", "cancelled")
    .order("created_at", { ascending: false });

  if (!orders || orders.length === 0) {
    await sendTelegramMessage(chatId, "✅ Нет задолженностей!", [
      [{ text: "◀️ Главное меню", callback_data: "menu=main" }],
    ]);
    return;
  }

  const totalDebt = orders.reduce((s: number, o: any) => s + Number(o.total_amount), 0);
  let text = `💸 <b>Задолженности:</b>\n\n`;

  // Group by client
  const byClient: Record<string, { total: number; count: number }> = {};
  orders.forEach((o: any) => {
    const name = (o.clients as any)?.name ?? "—";
    if (!byClient[name]) byClient[name] = { total: 0, count: 0 };
    byClient[name].total += Number(o.total_amount);
    byClient[name].count += 1;
  });

  Object.entries(byClient)
    .sort((a, b) => b[1].total - a[1].total)
    .forEach(([name, info]) => {
      text += `🏢 <b>${name}</b>\n`;
      text += `   ${info.total.toLocaleString()} ₸ (${info.count} заказ.)\n\n`;
    });

  text += `\n💰 <b>Итого долг: ${totalDebt.toLocaleString()} ₸</b>`;

  await sendTelegramMessage(chatId, text, [
    [{ text: "◀️ Главное меню", callback_data: "menu=main" }],
  ]);
}

// ═══════════════════════════════════════════
// NEW ORDER FLOW
// ═══════════════════════════════════════════
async function startNewOrder(chatId: number, userId: number) {
  const supabase = getSupabase();
  const { data: clients } = await supabase.from("clients").select("id, name").order("name");

  if (!clients || clients.length === 0) {
    await sendTelegramMessage(chatId, "Нет клиентов для заказа");
    return;
  }

  orderFlows.set(userId, { step: "select_client" });

  const buttons = clients.map((c: any) => [{ text: c.name, callback_data: `neworder=client&id=${c.id}` }]);
  buttons.push([{ text: "❌ Отмена", callback_data: "menu=main" }]);

  await sendTelegramMessage(chatId, "➕ <b>Новый заказ</b>\n\nВыберите клиента:", buttons);
}

async function selectClientForOrder(chatId: number, userId: number, clientId: string) {
  const supabase = getSupabase();
  const { data: products } = await supabase.from("products").select("id, name, price, stock_quantity, reserved_quantity").order("name");

  if (!products || products.length === 0) {
    await sendTelegramMessage(chatId, "Нет товаров на складе");
    orderFlows.delete(userId);
    return;
  }

  orderFlows.set(userId, { step: "select_product", client_id: clientId, items: [] });

  const buttons = products
    .filter((p: any) => p.stock_quantity - (p.reserved_quantity ?? 0) > 0)
    .map((p: any) => {
      const avail = p.stock_quantity - (p.reserved_quantity ?? 0);
      return [{ text: `${p.name} (${avail} шт) — ${Number(p.price).toLocaleString()} ₸`, callback_data: `neworder=product&id=${p.id}` }];
    });
  buttons.push([{ text: "❌ Отмена", callback_data: "menu=main" }]);

  await sendTelegramMessage(chatId, "📦 Выберите товар:", buttons);
}

async function selectProductForOrder(chatId: number, userId: number, productId: string) {
  const supabase = getSupabase();
  const flow = orderFlows.get(userId);
  if (!flow) return;

  const { data: product } = await supabase.from("products").select("id, name, price, stock_quantity, reserved_quantity").eq("id", productId).single();
  if (!product) return;

  const avail = product.stock_quantity - (product.reserved_quantity ?? 0);

  // Add item with quantity 1
  flow.items = flow.items ?? [];
  flow.items.push({ product_id: product.id, name: product.name, price: Number(product.price), quantity: 1 });
  flow.step = "confirm_or_add";
  orderFlows.set(userId, flow);

  const total = flow.items.reduce((s, i) => s + i.price * i.quantity, 0);
  let text = `🛒 <b>Корзина:</b>\n\n`;
  flow.items.forEach((item) => {
    text += `• ${item.name} x ${item.quantity} = ${(item.price * item.quantity).toLocaleString()} ₸\n`;
  });
  text += `\n💰 <b>Итого: ${total.toLocaleString()} ₸</b>`;
  text += `\n\n<i>Последний товар: ${product.name} (доступно: ${avail})</i>`;

  await sendTelegramMessage(chatId, text, [
    [{ text: "2 шт", callback_data: `neworder=qty&v=2` }, { text: "3 шт", callback_data: `neworder=qty&v=3` }, { text: "5 шт", callback_data: `neworder=qty&v=5` }, { text: "10 шт", callback_data: `neworder=qty&v=10` }],
    [{ text: "➕ Добавить ещё товар", callback_data: `neworder=more` }],
    [{ text: "💳 Наличные", callback_data: `neworder=pay&m=cash` }, { text: "💳 Перевод", callback_data: `neworder=pay&m=transfer` }],
    [{ text: "📝 В долг", callback_data: `neworder=pay&m=credit` }],
    [{ text: "❌ Отмена", callback_data: "menu=main" }],
  ]);
}

async function changeQuantity(chatId: number, userId: number, qty: number) {
  const flow = orderFlows.get(userId);
  if (!flow || !flow.items || flow.items.length === 0) return;

  flow.items[flow.items.length - 1].quantity = qty;
  orderFlows.set(userId, flow);

  const total = flow.items.reduce((s, i) => s + i.price * i.quantity, 0);
  let text = `🛒 <b>Корзина:</b>\n\n`;
  flow.items.forEach((item) => {
    text += `• ${item.name} x ${item.quantity} = ${(item.price * item.quantity).toLocaleString()} ₸\n`;
  });
  text += `\n💰 <b>Итого: ${total.toLocaleString()} ₸</b>`;

  await sendTelegramMessage(chatId, text, [
    [{ text: "2 шт", callback_data: `neworder=qty&v=2` }, { text: "3 шт", callback_data: `neworder=qty&v=3` }, { text: "5 шт", callback_data: `neworder=qty&v=5` }, { text: "10 шт", callback_data: `neworder=qty&v=10` }],
    [{ text: "➕ Добавить ещё товар", callback_data: `neworder=more` }],
    [{ text: "💳 Наличные", callback_data: `neworder=pay&m=cash` }, { text: "💳 Перевод", callback_data: `neworder=pay&m=transfer` }],
    [{ text: "📝 В долг", callback_data: `neworder=pay&m=credit` }],
    [{ text: "❌ Отмена", callback_data: "menu=main" }],
  ]);
}

async function submitOrder(chatId: number, userId: number, paymentMethod: string) {
  const supabase = getSupabase();
  const flow = orderFlows.get(userId);
  if (!flow || !flow.client_id || !flow.items || flow.items.length === 0) return;

  const total = flow.items.reduce((s, i) => s + i.price * i.quantity, 0);

  // Reserve stock
  for (const item of flow.items) {
    const { error } = await supabase.rpc("reserve_stock", {
      p_product_id: item.product_id, p_quantity: item.quantity,
    });
    if (error) {
      await sendTelegramMessage(chatId, `❌ Недостаточно на складе: ${item.name}`);
      orderFlows.delete(userId);
      return;
    }
  }

  // Create order
  const { data: order } = await supabase
    .from("orders")
    .insert({
      client_id: flow.client_id, status: "new", total_amount: total,
      payment_method: paymentMethod,
      payment_status: paymentMethod === "credit" ? "unpaid" : "paid",
    })
    .select("id")
    .single();

  if (!order) {
    await sendTelegramMessage(chatId, "❌ Ошибка создания заказа");
    orderFlows.delete(userId);
    return;
  }

  // Insert items
  const orderItems = flow.items.map((i) => ({
    order_id: order.id, product_id: i.product_id, quantity: i.quantity, price_at_time: i.price,
  }));
  await supabase.from("order_items").insert(orderItems);

  // Get client name
  const { data: client } = await supabase.from("clients").select("name").eq("id", flow.client_id).single();
  const clientName = client?.name ?? "—";

  const PAY: Record<string, string> = { cash: "Наличные", transfer: "Перевод", credit: "В долг" };
  const itemLines = flow.items.map((i) => `  • ${i.name} x ${i.quantity} шт`).join("\n");

  // Send order notification with inline buttons
  const message =
    `🚨 <b>НОВЫЙ ЗАКАЗ</b>\n\n` +
    `🏢 <b>Клиент:</b> ${clientName}\n` +
    `📦 <b>Товары:</b>\n${itemLines}\n` +
    `💰 <b>Сумма:</b> ${total.toLocaleString()} ₸\n` +
    `💳 <b>Оплата:</b> ${PAY[paymentMethod] ?? paymentMethod}\n\n` +
    `⏳ <i>Статус: Новый — ожидает сборки</i>`;

  const buttons = [
    [{ text: "📦 Взять в сборку", callback_data: `action=pick&order_id=${order.id}` }],
  ];

  const result = await sendTelegramMessage(chatId, message, buttons);

  if (result) {
    await supabase.from("orders").update({ tg_chat_id: result.chat.id, tg_message_id: result.message_id }).eq("id", order.id);
  }

  orderFlows.delete(userId);
}

// ═══════════════════════════════════════════
// ORDER STATE MACHINE (pick → ready → deliver → arrived → photo)
// ═══════════════════════════════════════════
async function getOrderHeader(orderId: string) {
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

  const PAY: Record<string, string> = { cash: "Наличные", transfer: "Перевод", credit: "В долг" };
  const clientName = (order.clients as unknown as { name: string } | null)?.name ?? "—";
  const itemLines = (items ?? []).map((i: any) => {
    const name = (i.products as unknown as { name: string } | null)?.name ?? "—";
    return `  • ${name} x ${i.quantity} шт`;
  }).join("\n");

  const header =
    `🏢 <b>Клиент:</b> ${clientName}\n` +
    `📦 <b>Товары:</b>\n${itemLines}\n` +
    `💰 <b>Сумма:</b> ${Number(order.total_amount).toLocaleString()} ₸\n` +
    `💳 <b>Оплата:</b> ${PAY[order.payment_method ?? ""] ?? "—"}`;

  return { order, header };
}

async function handleOrderAction(callbackQuery: any) {
  const supabase = getSupabase();
  const params = new URLSearchParams(callbackQuery.data);
  const action = params.get("action");
  const orderId = params.get("order_id");
  if (!action || !orderId) return;

  const result = await getOrderHeader(orderId);
  if (!result) { await answerCallbackQuery(callbackQuery.id, "Заказ не найден"); return; }

  const { order, header } = result;
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const userName = callbackQuery.from.first_name;

  if (action === "pick" && order.status === "new") {
    await supabase.from("orders").update({ status: "picking" }).eq("id", orderId);
    await editTelegramMessage(chatId, messageId,
      `${header}\n\n🟡 <b>Статус: Сборка</b>\n👷 Взял в работу: ${userName}`,
      [[{ text: "✅ Готово к отгрузке", callback_data: `action=ready&order_id=${orderId}` }]]);
    await answerCallbackQuery(callbackQuery.id, "Взято в сборку");
  }
  else if (action === "ready" && order.status === "picking") {
    await supabase.from("orders").update({ status: "ready" }).eq("id", orderId);
    await editTelegramMessage(chatId, messageId,
      `${header}\n\n🟢 <b>Статус: Готово к отгрузке</b>\n📦 Собрал: ${userName}`,
      [[{ text: "🚚 Взять доставку", callback_data: `action=deliver&order_id=${orderId}` }]]);
    await answerCallbackQuery(callbackQuery.id, "Готово к отгрузке");
  }
  else if (action === "deliver" && order.status === "ready") {
    await supabase.from("orders").update({ status: "delivering" }).eq("id", orderId);
    await editTelegramMessage(chatId, messageId,
      `${header}\n\n🔵 <b>Статус: Доставка</b>\n🚚 Водитель: ${userName}`,
      [[{ text: "📍 Прибыл на точку", callback_data: `action=arrived&order_id=${orderId}` }]]);
    await answerCallbackQuery(callbackQuery.id, "Взято на доставку");
  }
  else if (action === "arrived" && order.status === "delivering") {
    await supabase.from("orders").update({ status: "arrived" }).eq("id", orderId);
    pendingPhotoProof.set(callbackQuery.from.id, orderId);
    await editTelegramMessage(chatId, messageId,
      `${header}\n\n🟠 <b>Статус: На точке</b>\n📍 Водитель прибыл: ${userName}\n\n⏳ <i>Ожидается фото подписанной накладной...</i>`, null);
    await sendTelegramMessage(chatId, `📸 <b>${userName}</b>, отправьте фото подписанной накладной для закрытия заказа.`);
    await answerCallbackQuery(callbackQuery.id, "Отправьте фото накладной");
  }
  else {
    await answerCallbackQuery(callbackQuery.id, "Действие недоступно");
  }
}

// ═══════════════════════════════════════════
// PHOTO HANDLER
// ═══════════════════════════════════════════
async function handlePhoto(message: any) {
  const supabase = getSupabase();
  const userId = message.from.id;
  const orderId = pendingPhotoProof.get(userId);
  if (!orderId) return;

  const fileId = message.photo[message.photo.length - 1].file_id;

  await supabase.from("delivery_proofs").insert({
    order_id: orderId, tg_file_id: fileId, uploaded_by_name: message.from.first_name,
  });

  const { data: items } = await supabase.from("order_items").select("product_id, quantity").eq("order_id", orderId);
  if (items) {
    for (const item of items) {
      await supabase.rpc("complete_order_item", { p_product_id: item.product_id, p_quantity: item.quantity });
    }
  }

  await supabase.from("orders").update({ status: "completed" }).eq("id", orderId);
  pendingPhotoProof.delete(userId);

  const result = await getOrderHeader(orderId);
  if (result?.order.tg_chat_id && result?.order.tg_message_id) {
    await editTelegramMessage(
      Number(result.order.tg_chat_id), Number(result.order.tg_message_id),
      `${result.header}\n\n✅ <b>Статус: Доставлено</b>\n🚚 Доставил: ${message.from.first_name}\n📸 Фото накладной получено`, null);
  }

  await sendTelegramMessage(message.chat.id, `✅ Заказ закрыт! Фото накладной сохранено. Спасибо, ${message.from.first_name}!`, [
    [{ text: "◀️ Главное меню", callback_data: "menu=main" }],
  ]);
}

// ═══════════════════════════════════════════
// CALLBACK ROUTER
// ═══════════════════════════════════════════
async function handleCallback(cq: any) {
  const chatId = cq.message.chat.id;
  const userId = cq.from.id;
  const data = cq.data as string;

  // Menu navigation
  if (data === "menu=main") { await sendMainMenu(chatId); await answerCallbackQuery(cq.id); return; }
  if (data === "menu=orders") { await sendOrdersList(chatId); await answerCallbackQuery(cq.id); return; }
  if (data === "menu=clients") { await sendClientsList(chatId); await answerCallbackQuery(cq.id); return; }
  if (data === "menu=stock") { await sendStock(chatId); await answerCallbackQuery(cq.id); return; }
  if (data === "menu=debts") { await sendDebts(chatId); await answerCallbackQuery(cq.id); return; }
  if (data === "menu=neworder") { await startNewOrder(chatId, userId); await answerCallbackQuery(cq.id); return; }

  // New order flow
  if (data.startsWith("neworder=")) {
    const params = new URLSearchParams(data);
    const action = params.get("neworder");

    if (action === "client") {
      await selectClientForOrder(chatId, userId, params.get("id")!);
    } else if (action === "product") {
      await selectProductForOrder(chatId, userId, params.get("id")!);
    } else if (action === "qty") {
      await changeQuantity(chatId, userId, parseInt(params.get("v")!) || 1);
    } else if (action === "more") {
      await selectClientForOrder(chatId, userId, orderFlows.get(userId)?.client_id ?? "");
    } else if (action === "pay") {
      await submitOrder(chatId, userId, params.get("m")!);
    }
    await answerCallbackQuery(cq.id);
    return;
  }

  // Order state machine
  if (data.startsWith("action=")) {
    await handleOrderAction(cq);
    return;
  }

  await answerCallbackQuery(cq.id);
}

// ═══════════════════════════════════════════
// TEXT COMMANDS
// ═══════════════════════════════════════════
async function handleTextMessage(message: any) {
  const chatId = message.chat.id;
  const text = (message.text ?? "").trim();

  if (text === "/start" || text === "/menu") {
    await sendMainMenu(chatId);
  } else if (text === "/orders") {
    await sendOrdersList(chatId);
  } else if (text === "/clients") {
    await sendClientsList(chatId);
  } else if (text === "/stock") {
    await sendStock(chatId);
  } else if (text === "/debts") {
    await sendDebts(chatId);
  } else if (text === "/neworder") {
    await startNewOrder(chatId, message.from.id);
  } else {
    await sendMainMenu(chatId);
  }
}

// ═══════════════════════════════════════════
// WEBHOOK ENTRY POINT
// ═══════════════════════════════════════════
export async function POST(req: NextRequest) {
  const update = await req.json();

  try {
    if (update.callback_query) {
      await handleCallback(update.callback_query);
    } else if (update.message?.photo) {
      await handlePhoto(update.message);
    } else if (update.message?.text) {
      await handleTextMessage(update.message);
    }
  } catch (err) {
    console.error("Webhook error:", err);
  }

  return NextResponse.json({ ok: true });
}
