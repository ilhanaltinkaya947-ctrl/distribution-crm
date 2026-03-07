"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Client {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
  reserved_quantity: number;
}

interface Order {
  id: string;
  status: string;
  total_amount: number;
  payment_method: string | null;
  payment_status: string;
  created_at: string;
  clients: { name: string } | null;
}

const STATUS_LABELS: Record<string, string> = {
  new: "Новый",
  picking: "Сборка",
  ready: "Готов к отгрузке",
  delivering: "Доставка",
  arrived: "На точке",
  completed: "Выполнен",
  cancelled: "Отменён",
};

const STATUS_COLORS: Record<string, string> = {
  new: "bg-yellow-100 text-yellow-800",
  picking: "bg-blue-100 text-blue-800",
  ready: "bg-indigo-100 text-indigo-800",
  delivering: "bg-purple-100 text-purple-800",
  arrived: "bg-orange-100 text-orange-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Наличные",
  transfer: "Перевод",
  credit: "В долг",
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedClient, setSelectedClient] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [items, setItems] = useState<{ product_id: string; quantity: number }[]>([
    { product_id: "", quantity: 1 },
  ]);
  const [toast, setToast] = useState<string | null>(null);

  async function loadOrders() {
    const { data } = await supabase
      .from("orders")
      .select("id, status, total_amount, payment_method, payment_status, created_at, clients(name)")
      .order("created_at", { ascending: false });
    if (data) setOrders(data as Order[]);
  }

  async function loadFormData() {
    const [c, p] = await Promise.all([
      supabase.from("clients").select("id, name"),
      supabase.from("products").select("id, name, price, stock_quantity, reserved_quantity"),
    ]);
    if (c.data) setClients(c.data);
    if (p.data) setProducts(p.data);
  }

  useEffect(() => {
    loadOrders();
    loadFormData();
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  function addItem() {
    setItems([...items, { product_id: "", quantity: 1 }]);
  }

  function removeItem(idx: number) {
    setItems(items.filter((_, i) => i !== idx));
  }

  function calcTotal() {
    return items.reduce((sum, item) => {
      const product = products.find((p) => p.id === item.product_id);
      return sum + (product ? Number(product.price) * item.quantity : 0);
    }, 0);
  }

  function availableStock(product: Product) {
    return product.stock_quantity - product.reserved_quantity;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const total = calcTotal();
    const client = clients.find((c) => c.id === selectedClient);

    // Reserve stock first
    for (const item of items.filter((i) => i.product_id)) {
      const { error } = await supabase.rpc("reserve_stock", {
        p_product_id: item.product_id,
        p_quantity: item.quantity,
      });
      if (error) {
        const product = products.find((p) => p.id === item.product_id);
        showToast(`Недостаточно на складе: ${product?.name ?? "товар"}`);
        return;
      }
    }

    const { data: order } = await supabase
      .from("orders")
      .insert({
        client_id: selectedClient,
        status: "new",
        total_amount: total,
        payment_method: paymentMethod,
        payment_status: paymentMethod === "credit" ? "unpaid" : "paid",
      })
      .select("id")
      .single();

    if (order) {
      const orderItems = items
        .filter((i) => i.product_id)
        .map((i) => {
          const product = products.find((p) => p.id === i.product_id);
          return {
            order_id: order.id,
            product_id: i.product_id,
            quantity: i.quantity,
            price_at_time: product?.price ?? 0,
          };
        });

      await supabase.from("order_items").insert(orderItems);

      const notifyItems = items
        .filter((i) => i.product_id)
        .map((i) => ({
          name: products.find((p) => p.id === i.product_id)?.name ?? "",
          quantity: i.quantity,
        }));

      fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          clientName: client?.name ?? "—",
          items: notifyItems,
          total,
          paymentMethod,
        }),
      });

      showToast("Заказ создан и отправлен на склад в Telegram!");
    }

    setShowForm(false);
    setSelectedClient("");
    setPaymentMethod("cash");
    setItems([{ product_id: "", quantity: 1 }]);
    loadOrders();
    loadFormData();
  }

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg text-sm animate-fade-in">
          {toast}
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Заказы</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-zinc-700"
        >
          + Новый заказ
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <label className="block text-sm text-zinc-500 mb-1">Клиент</label>
              <select
                required
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Выберите клиента...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-500 mb-1">Способ оплаты</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm"
              >
                <option value="cash">Наличные</option>
                <option value="transfer">Перевод</option>
                <option value="credit">В долг</option>
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm text-zinc-500 mb-2">Товары</label>
            {items.map((item, idx) => {
              const product = products.find((p) => p.id === item.product_id);
              const avail = product ? availableStock(product) : 0;
              return (
                <div key={idx} className="flex gap-3 mb-2 items-center">
                  <select
                    required
                    value={item.product_id}
                    onChange={(e) => {
                      const updated = [...items];
                      updated[idx].product_id = e.target.value;
                      setItems(updated);
                    }}
                    className="border rounded-lg px-3 py-2 text-sm flex-1"
                  >
                    <option value="">Выберите товар...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id} disabled={availableStock(p) <= 0}>
                        {p.name} — {Number(p.price).toLocaleString()} ₸ (ост: {availableStock(p)})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    max={avail || undefined}
                    value={item.quantity}
                    onChange={(e) => {
                      const updated = [...items];
                      updated[idx].quantity = parseInt(e.target.value) || 1;
                      setItems(updated);
                    }}
                    className="border rounded-lg px-3 py-2 text-sm w-20"
                  />
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(idx)} className="text-red-500 text-sm">
                      Удалить
                    </button>
                  )}
                </div>
              );
            })}
            <button type="button" onClick={addItem} className="text-blue-600 text-sm mt-1">
              + Добавить товар
            </button>
          </div>

          <div className="flex justify-between items-center">
            <p className="font-semibold">Итого: {calcTotal().toLocaleString()} ₸</p>
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-500">
              Создать заказ
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-lg shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-500 border-b">
              <th className="p-4">Клиент</th>
              <th className="p-4">Сумма</th>
              <th className="p-4">Оплата</th>
              <th className="p-4">Статус</th>
              <th className="p-4">Дата</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b last:border-0 hover:bg-zinc-50">
                <td className="p-4 font-medium">{o.clients?.name ?? "—"}</td>
                <td className="p-4">{Number(o.total_amount).toLocaleString()} ₸</td>
                <td className="p-4">
                  <span className="text-xs">{PAYMENT_LABELS[o.payment_method ?? ""] ?? "—"}</span>
                  {o.payment_status === "unpaid" && (
                    <span className="ml-1 px-1.5 py-0.5 rounded text-xs bg-red-100 text-red-700">долг</span>
                  )}
                </td>
                <td className="p-4">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[o.status] ?? ""}`}>
                    {STATUS_LABELS[o.status] ?? o.status}
                  </span>
                </td>
                <td className="p-4 text-zinc-500">{new Date(o.created_at).toLocaleDateString("ru-RU")}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan={5} className="p-4 text-center text-zinc-400">Нет заказов</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
