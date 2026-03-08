"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { haptic } from "@/lib/haptic";
import { motion, AnimatePresence } from "framer-motion";

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

const PAYMENT_OPTIONS = [
  { value: "cash", label: "Наличные", icon: "💵" },
  { value: "transfer", label: "Перевод", icon: "💳" },
  { value: "credit", label: "В долг", icon: "📋" },
];

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined" && window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
      window.Telegram.WebApp.BackButton.show();
      window.Telegram.WebApp.BackButton.onClick(() => {
        haptic("light");
        window.location.href = "/tg";
      });
    }

    async function load() {
      const [c, p] = await Promise.all([
        supabase.from("clients").select("id, name").order("name"),
        supabase.from("products").select("id, name, price, stock_quantity, reserved_quantity").order("name"),
      ]);
      if (c.data) setClients(c.data);
      if (p.data) setProducts(p.data as unknown as Product[]);
      setLoading(false);
    }
    load();
  }, []);

  function availableStock(p: Product) {
    return p.stock_quantity - (p.reserved_quantity ?? 0);
  }

  function calcTotal() {
    return items.reduce((sum, item) => {
      const product = products.find((p) => p.id === item.product_id);
      return sum + (product ? Number(product.price) * item.quantity : 0);
    }, 0);
  }

  function updateItemQuantity(idx: number, delta: number) {
    haptic("light");
    const updated = [...items];
    const product = products.find((p) => p.id === updated[idx].product_id);
    const maxQty = product ? availableStock(product) : 999;
    updated[idx].quantity = Math.max(1, Math.min(maxQty, updated[idx].quantity + delta));
    setItems(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    haptic("medium");
    setSubmitting(true);
    setError(null);

    const total = calcTotal();
    const client = clients.find((c) => c.id === selectedClient);

    for (const item of items.filter((i) => i.product_id)) {
      const { error: rpcError } = await supabase.rpc("reserve_stock", {
        p_product_id: item.product_id,
        p_quantity: item.quantity,
      });
      if (rpcError) {
        const product = products.find((p) => p.id === item.product_id);
        setError(`Недостаточно на складе: ${product?.name ?? "товар"}`);
        haptic("error");
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

      await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          clientName: client?.name ?? "—",
          items: items.filter((i) => i.product_id).map((i) => ({
            name: products.find((p) => p.id === i.product_id)?.name ?? "",
            quantity: i.quantity,
          })),
          total,
          paymentMethod,
        }),
      });
    }

    haptic("success");
    setSubmitting(false);
    setDone(true);
  }

  if (done) {
    return (
      <motion.div className="tg-done"
        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
      >
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
          transition={{ type: "spring", damping: 10, stiffness: 200, delay: 0.1 }}
          style={{ fontSize: 64, marginBottom: 16 }}>
          ✅
        </motion.div>
        <h2 className="tg-done-title">Заказ создан!</h2>
        <p className="tg-done-sub">Товар зарезервирован.<br />Уведомление отправлено на склад.</p>
        <a href="/tg" onClick={() => haptic("light")} className="tg-done-btn">
          Вернуться
        </a>

        <style>{`
          .tg-done {
            display: flex; flex-direction: column; align-items: center;
            justify-content: center; min-height: 100vh; padding: 24px; text-align: center;
            background: var(--tg-theme-bg-color, #f5f5f5);
          }
          .tg-done-title {
            font-size: 22px; font-weight: 700; margin: 0 0 8px;
            color: var(--tg-theme-text-color, #1a1a1a);
          }
          .tg-done-sub {
            font-size: 14px; color: var(--tg-theme-hint-color, #8e8e93);
            margin: 0 0 32px; line-height: 1.5;
          }
          .tg-done-btn {
            padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 15px;
            background: var(--tg-theme-button-color, #2481cc);
            color: var(--tg-theme-button-text-color, #ffffff);
            text-decoration: none;
          }
        `}</style>
      </motion.div>
    );
  }

  return (
    <div className="tg-new-order">
      {/* Header */}
      <div className="tg-no-header">
        <h1 className="tg-no-header-title">Новый заказ</h1>
        <p className="tg-no-header-sub">Заполните данные заказа</p>
      </div>

      <form onSubmit={handleSubmit} className="tg-no-form">
        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div className="tg-no-error"
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="tg-no-sections">
            {[1, 2, 3].map((i) => (
              <div key={i} className="tg-no-section tg-no-skeleton" style={{ height: 80 }} />
            ))}
          </div>
        ) : (
          <>
            {/* Client */}
            <div className="tg-no-section">
              <label className="tg-no-label">Клиент</label>
              <select required value={selectedClient}
                onChange={(e) => { haptic("light"); setSelectedClient(e.target.value); }}
                className="tg-no-select">
                <option value="">Выберите клиента...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Payment */}
            <div className="tg-no-section">
              <label className="tg-no-label">Способ оплаты</label>
              <div className="tg-no-payment-row">
                {PAYMENT_OPTIONS.map((opt) => (
                  <button key={opt.value} type="button"
                    onClick={() => { haptic("light"); setPaymentMethod(opt.value); }}
                    className={`tg-no-payment-btn ${paymentMethod === opt.value ? "tg-no-payment-active" : ""}`}>
                    <span style={{ fontSize: 18, display: "block", marginBottom: 2 }}>{opt.icon}</span>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Items */}
            <div className="tg-no-section">
              <label className="tg-no-label">Товары</label>
              <div className="tg-no-items">
                <AnimatePresence>
                  {items.map((item, idx) => {
                    const product = products.find((p) => p.id === item.product_id);
                    const lineTotal = product ? Number(product.price) * item.quantity : 0;
                    return (
                      <motion.div key={idx} className="tg-no-item"
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                        <select required value={item.product_id}
                          onChange={(e) => {
                            haptic("light");
                            const updated = [...items];
                            updated[idx].product_id = e.target.value;
                            updated[idx].quantity = 1;
                            setItems(updated);
                          }}
                          className="tg-no-select-inner">
                          <option value="">Выберите товар...</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id} disabled={availableStock(p) <= 0}>
                              {p.name} — {Number(p.price).toLocaleString()} ₸ (ост: {availableStock(p)})
                            </option>
                          ))}
                        </select>

                        <div className="tg-no-item-controls">
                          <div className="tg-no-qty-row">
                            <button type="button" onClick={() => updateItemQuantity(idx, -1)}
                              className="tg-no-qty-btn">−</button>
                            <span className="tg-no-qty-value">{item.quantity}</span>
                            <button type="button" onClick={() => updateItemQuantity(idx, 1)}
                              className="tg-no-qty-btn">+</button>
                          </div>
                          <div className="tg-no-item-right">
                            {lineTotal > 0 && (
                              <span className="tg-no-line-total">{lineTotal.toLocaleString()} ₸</span>
                            )}
                            {items.length > 1 && (
                              <button type="button"
                                onClick={() => { haptic("light"); setItems(items.filter((_, i) => i !== idx)); }}
                                className="tg-no-remove-btn">
                                Убрать
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

              <button type="button"
                onClick={() => { haptic("light"); setItems([...items, { product_id: "", quantity: 1 }]); }}
                className="tg-no-add-btn">
                + Добавить товар
              </button>
            </div>
          </>
        )}
      </form>

      {/* Bottom checkout bar */}
      {!loading && (
        <div className="tg-no-checkout">
          <div className="tg-no-checkout-row">
            <span className="tg-no-checkout-label">Итого</span>
            <span className="tg-no-checkout-total">{calcTotal().toLocaleString()} ₸</span>
          </div>
          <button type="button" disabled={submitting}
            onClick={(e) => {
              e.preventDefault();
              const form = document.querySelector("form");
              if (form) form.requestSubmit();
            }}
            className={`tg-no-submit-btn ${submitting ? "tg-no-submit-disabled" : ""}`}>
            {submitting ? "Резервирование..." : "Создать заказ"}
          </button>
        </div>
      )}

      <style>{`
        .tg-new-order {
          display: flex; flex-direction: column; min-height: 100vh;
          background: var(--tg-theme-bg-color, #f5f5f5);
          color: var(--tg-theme-text-color, #1a1a1a);
          -webkit-font-smoothing: antialiased;
        }

        .tg-no-header {
          padding: 20px 16px 16px;
          background: var(--tg-theme-section-bg-color, #ffffff);
          border-bottom: 1px solid rgba(0,0,0,0.06);
        }
        .tg-no-header-title {
          font-size: 20px; font-weight: 700; margin: 0;
          color: var(--tg-theme-text-color, #1a1a1a);
        }
        .tg-no-header-sub {
          font-size: 13px; color: var(--tg-theme-hint-color, #8e8e93); margin: 4px 0 0;
        }

        .tg-no-form {
          flex: 1; display: flex; flex-direction: column;
          padding: 12px 16px; padding-bottom: 140px;
        }

        .tg-no-error {
          background: #fef2f2; color: #dc2626; font-size: 13px; font-weight: 500;
          padding: 12px 14px; border-radius: 12px; margin-bottom: 12px;
          border-left: 3px solid #ef4444;
        }

        .tg-no-sections { display: flex; flex-direction: column; gap: 12px; }

        .tg-no-section {
          background: var(--tg-theme-section-bg-color, #ffffff);
          border-radius: 14px; padding: 16px;
          border: 1px solid rgba(0,0,0,0.06);
          box-shadow: 0 1px 2px rgba(0,0,0,0.04);
          margin-bottom: 12px;
        }

        .tg-no-skeleton { animation: tg-no-pulse 1.5s ease-in-out infinite; }
        @keyframes tg-no-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

        .tg-no-label {
          font-size: 13px; font-weight: 600;
          color: var(--tg-theme-hint-color, #8e8e93);
          margin: 0 0 10px; display: block;
          text-transform: uppercase; letter-spacing: 0.3px;
        }

        .tg-no-select {
          width: 100%; padding: 12px 14px; font-size: 15px;
          border-radius: 10px; border: 1px solid rgba(0,0,0,0.1);
          background: var(--tg-theme-bg-color, #f5f5f5);
          color: var(--tg-theme-text-color, #1a1a1a);
          -webkit-appearance: none; appearance: none;
        }

        .tg-no-payment-row { display: flex; gap: 8px; }

        .tg-no-payment-btn {
          flex: 1; padding: 10px 0; font-size: 12px; font-weight: 600;
          border-radius: 10px; border: 1px solid rgba(0,0,0,0.08); cursor: pointer;
          background: var(--tg-theme-bg-color, #f5f5f5);
          color: var(--tg-theme-text-color, #1a1a1a);
          transition: all 0.2s;
        }
        .tg-no-payment-active {
          background: var(--tg-theme-button-color, #2481cc) !important;
          color: var(--tg-theme-button-text-color, #ffffff) !important;
          border-color: transparent !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.12);
        }

        .tg-no-items { display: flex; flex-direction: column; gap: 10px; }

        .tg-no-item {
          background: var(--tg-theme-bg-color, #f5f5f5);
          border-radius: 12px; padding: 14px;
          border: 1px solid rgba(0,0,0,0.08);
        }

        .tg-no-select-inner {
          width: 100%; padding: 10px 12px; font-size: 14px;
          border-radius: 8px; border: 1px solid rgba(0,0,0,0.1);
          background: var(--tg-theme-section-bg-color, #ffffff);
          color: var(--tg-theme-text-color, #1a1a1a);
          -webkit-appearance: none; appearance: none;
          margin-bottom: 10px;
        }

        .tg-no-item-controls {
          display: flex; justify-content: space-between; align-items: center;
        }
        .tg-no-qty-row { display: flex; align-items: center; gap: 16px; }
        .tg-no-qty-btn {
          width: 36px; height: 36px; border-radius: 50%;
          border: none; cursor: pointer; font-size: 18px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          background: var(--tg-theme-secondary-bg-color, #ebebed);
          color: var(--tg-theme-text-color, #1a1a1a);
        }
        .tg-no-qty-value {
          font-size: 20px; font-weight: 700; width: 32px; text-align: center;
          color: var(--tg-theme-text-color, #1a1a1a);
          font-variant-numeric: tabular-nums;
        }
        .tg-no-item-right { display: flex; align-items: center; gap: 12px; }
        .tg-no-line-total {
          font-size: 14px; font-weight: 600;
          color: var(--tg-theme-text-color, #1a1a1a);
          font-variant-numeric: tabular-nums;
        }
        .tg-no-remove-btn {
          border: none; background: #fef2f2; color: #ef4444;
          font-size: 12px; font-weight: 600; padding: 4px 10px;
          border-radius: 6px; cursor: pointer;
        }

        .tg-no-add-btn {
          margin-top: 10px; padding: 10px 0; width: 100%;
          background: transparent; border: 1px dashed rgba(0,0,0,0.15);
          border-radius: 10px;
          color: var(--tg-theme-link-color, #2481cc);
          font-size: 14px; font-weight: 600; cursor: pointer;
        }

        .tg-no-checkout {
          position: fixed; bottom: 0; left: 0; right: 0;
          padding: 16px; padding-bottom: 24px;
          background: var(--tg-theme-section-bg-color, #ffffff);
          border-top: 1px solid rgba(0,0,0,0.06);
        }
        .tg-no-checkout-row {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 12px;
        }
        .tg-no-checkout-label {
          font-size: 14px; color: var(--tg-theme-hint-color, #8e8e93);
        }
        .tg-no-checkout-total {
          font-size: 24px; font-weight: 700;
          color: var(--tg-theme-text-color, #1a1a1a);
          font-variant-numeric: tabular-nums;
        }
        .tg-no-submit-btn {
          width: 100%; padding: 14px 0; border-radius: 12px;
          border: none; cursor: pointer; font-size: 16px; font-weight: 700;
          background: var(--tg-theme-button-color, #2481cc);
          color: var(--tg-theme-button-text-color, #ffffff);
          transition: all 0.2s;
        }
        .tg-no-submit-disabled {
          opacity: 0.5; cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
