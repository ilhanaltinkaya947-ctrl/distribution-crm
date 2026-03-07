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

export default function TgNewOrder() {
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [items, setItems] = useState<{ product_id: string; quantity: number }[]>([
    { product_id: "", quantity: 1 },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
      window.Telegram.WebApp.BackButton.show();
      window.Telegram.WebApp.BackButton.onClick(() => {
        window.location.href = "/tg";
      });
    }

    async function load() {
      const [c, p] = await Promise.all([
        supabase.from("clients").select("id, name").order("name"),
        supabase.from("products").select("id, name, price, stock_quantity, reserved_quantity").order("name"),
      ]);
      if (c.data) setClients(c.data);
      if (p.data) setProducts(p.data);
    }
    load();
  }, []);

  function availableStock(p: Product) {
    return p.stock_quantity - p.reserved_quantity;
  }

  function calcTotal() {
    return items.reduce((sum, item) => {
      const product = products.find((p) => p.id === item.product_id);
      return sum + (product ? Number(product.price) * item.quantity : 0);
    }, 0);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const total = calcTotal();
    const client = clients.find((c) => c.id === selectedClient);

    // Reserve stock
    for (const item of items.filter((i) => i.product_id)) {
      const { error: rpcError } = await supabase.rpc("reserve_stock", {
        p_product_id: item.product_id,
        p_quantity: item.quantity,
      });
      if (rpcError) {
        const product = products.find((p) => p.id === item.product_id);
        setError(`Недостаточно на складе: ${product?.name ?? "товар"}`);
        setSubmitting(false);
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

      await fetch("/api/notify", {
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
    }

    setSubmitting(false);
    setDone(true);
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-xl font-bold mb-2">Заказ создан!</h2>
        <p className="text-zinc-500 text-sm mb-6">Товар зарезервирован. Уведомление отправлено на склад.</p>
        <a
          href="/tg"
          className="bg-blue-600 text-white px-6 py-3 rounded-xl font-medium text-sm"
        >
          Вернуться
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <div className="bg-white px-4 pt-4 pb-3 shadow-sm">
        <h1 className="text-lg font-bold">Новый заказ</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col p-4">
        {error && (
          <div className="bg-red-50 text-red-700 text-sm p-3 rounded-xl mb-4">{error}</div>
        )}

        {/* Client */}
        <div className="mb-4">
          <label className="block text-sm text-zinc-500 mb-1">Клиент</label>
          <select
            required
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            className="w-full border rounded-xl px-3 py-3 text-sm bg-white"
          >
            <option value="">Выберите клиента...</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Payment */}
        <div className="mb-4">
          <label className="block text-sm text-zinc-500 mb-1">Оплата</label>
          <div className="flex gap-2">
            {[
              { value: "cash", label: "Наличные" },
              { value: "transfer", label: "Перевод" },
              { value: "credit", label: "В долг" },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPaymentMethod(opt.value)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
                  paymentMethod === opt.value
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-zinc-700 border-zinc-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Items */}
        <div className="mb-4 flex-1">
          <label className="block text-sm text-zinc-500 mb-2">Товары</label>
          <div className="space-y-3">
            {items.map((item, idx) => {
              const product = products.find((p) => p.id === item.product_id);
              const avail = product ? availableStock(product) : 0;
              return (
                <div key={idx} className="bg-white rounded-xl p-3 shadow-sm">
                  <select
                    required
                    value={item.product_id}
                    onChange={(e) => {
                      const updated = [...items];
                      updated[idx].product_id = e.target.value;
                      setItems(updated);
                    }}
                    className="w-full border rounded-lg px-3 py-2.5 text-sm mb-2"
                  >
                    <option value="">Выберите товар...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id} disabled={availableStock(p) <= 0}>
                        {p.name} — {Number(p.price).toLocaleString()} ₸ (ост: {availableStock(p)})
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...items];
                          updated[idx].quantity = Math.max(1, updated[idx].quantity - 1);
                          setItems(updated);
                        }}
                        className="w-8 h-8 rounded-full bg-zinc-100 text-lg font-bold flex items-center justify-center"
                      >
                        −
                      </button>
                      <span className="text-lg font-semibold w-8 text-center">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...items];
                          updated[idx].quantity = Math.min(avail || 999, updated[idx].quantity + 1);
                          setItems(updated);
                        }}
                        className="w-8 h-8 rounded-full bg-zinc-100 text-lg font-bold flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setItems(items.filter((_, i) => i !== idx))}
                        className="text-red-500 text-xs"
                      >
                        Удалить
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setItems([...items, { product_id: "", quantity: 1 }])}
            className="text-blue-600 text-sm mt-3"
          >
            + Добавить товар
          </button>
        </div>

        {/* Submit */}
        <div className="sticky bottom-0 bg-[var(--tg-theme-bg-color,#f4f4f5)] pt-2 pb-4">
          <div className="flex justify-between items-center mb-3">
            <span className="text-zinc-500 text-sm">Итого</span>
            <span className="text-xl font-bold">{calcTotal().toLocaleString()} ₸</span>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium text-sm disabled:opacity-50"
          >
            {submitting ? "Резервирование..." : "Создать заказ"}
          </button>
        </div>
      </form>
    </div>
  );
}
