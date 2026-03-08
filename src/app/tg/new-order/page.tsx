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
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", minHeight: "100vh", padding: 24, textAlign: "center",
        }}
      >
        <motion.div
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          transition={{ type: "spring", damping: 10, stiffness: 200, delay: 0.1 }}
          style={{ fontSize: 64, marginBottom: 16 }}
        >
          ✅
        </motion.div>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: "var(--tg-text)" }}>
          Заказ создан!
        </h2>
        <p style={{ fontSize: 14, color: "var(--tg-hint)", margin: "0 0 32px", lineHeight: 1.5 }}>
          Товар зарезервирован.<br />Уведомление отправлено на склад.
        </p>
        <a href="/tg"
          onClick={() => haptic("light")}
          style={{
            padding: "14px 32px", borderRadius: 12, fontWeight: 600, fontSize: 15,
            background: "var(--tg-btn)", color: "var(--tg-btn-text)",
            textDecoration: "none",
          }}
        >
          Вернуться
        </a>
      </motion.div>
    );
  }

  const sectionStyle = {
    background: "var(--tg-section)", borderRadius: 14, padding: "16px",
    marginBottom: 12,
  };

  const labelStyle = {
    fontSize: 13, fontWeight: 600 as const, color: "var(--tg-hint)",
    margin: "0 0 10px", display: "block" as const,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{
        padding: "20px 16px 16px",
        background: "var(--tg-section)",
        borderBottom: "0.5px solid var(--tg-hint, #ccc)",
      }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "var(--tg-text)" }}>
          Новый заказ
        </h1>
        <p style={{ fontSize: 13, color: "var(--tg-hint)", margin: "4px 0 0" }}>
          Заполните данные заказа
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ flex: 1, display: "flex", flexDirection: "column", padding: "12px 16px", paddingBottom: 140 }}>
        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              style={{
                background: "#ef444415", color: "#ef4444", fontSize: 13, fontWeight: 500,
                padding: "12px 14px", borderRadius: 12, marginBottom: 12,
                borderLeft: "3px solid #ef4444",
              }}
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading skeleton */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{
                ...sectionStyle, height: 80,
                animation: "pulse 1.5s ease-in-out infinite",
              }} />
            ))}
          </div>
        ) : (
          <>
            {/* Client */}
            <div style={sectionStyle}>
              <label style={labelStyle}>Клиент</label>
              <select
                required
                value={selectedClient}
                onChange={(e) => { haptic("light"); setSelectedClient(e.target.value); }}
                style={{
                  width: "100%", padding: "12px 14px", fontSize: 15,
                  borderRadius: 10, border: "1px solid var(--tg-hint, #ddd)",
                  background: "var(--tg-bg)", color: "var(--tg-text)",
                  appearance: "none", WebkitAppearance: "none",
                }}
              >
                <option value="">Выберите клиента...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Payment */}
            <div style={sectionStyle}>
              <label style={labelStyle}>Способ оплаты</label>
              <div style={{ display: "flex", gap: 8 }}>
                {PAYMENT_OPTIONS.map((opt) => (
                  <button key={opt.value} type="button"
                    onClick={() => { haptic("light"); setPaymentMethod(opt.value); }}
                    style={{
                      flex: 1, padding: "10px 0", fontSize: 13, fontWeight: 600,
                      borderRadius: 10, border: "none", cursor: "pointer",
                      transition: "all 0.2s",
                      background: paymentMethod === opt.value ? "var(--tg-btn)" : "var(--tg-bg)",
                      color: paymentMethod === opt.value ? "var(--tg-btn-text)" : "var(--tg-text)",
                      boxShadow: paymentMethod === opt.value ? "0 2px 8px rgba(0,0,0,0.12)" : "none",
                    }}
                  >
                    <span style={{ display: "block", fontSize: 18, marginBottom: 2 }}>{opt.icon}</span>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Items */}
            <div style={sectionStyle}>
              <label style={labelStyle}>Товары</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <AnimatePresence>
                  {items.map((item, idx) => {
                    const product = products.find((p) => p.id === item.product_id);
                    const lineTotal = product ? Number(product.price) * item.quantity : 0;
                    return (
                      <motion.div key={idx}
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                        style={{
                          background: "var(--tg-bg)", borderRadius: 12, padding: 14,
                          border: "1px solid var(--tg-hint, #eee)",
                        }}
                      >
                        <select
                          required
                          value={item.product_id}
                          onChange={(e) => {
                            haptic("light");
                            const updated = [...items];
                            updated[idx].product_id = e.target.value;
                            updated[idx].quantity = 1;
                            setItems(updated);
                          }}
                          style={{
                            width: "100%", padding: "10px 12px", fontSize: 14,
                            borderRadius: 8, border: "1px solid var(--tg-hint, #ddd)",
                            background: "var(--tg-section)", color: "var(--tg-text)",
                            appearance: "none", WebkitAppearance: "none", marginBottom: 10,
                          }}
                        >
                          <option value="">Выберите товар...</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id} disabled={availableStock(p) <= 0}>
                              {p.name} — {Number(p.price).toLocaleString()} ₸ (ост: {availableStock(p)})
                            </option>
                          ))}
                        </select>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                            <button type="button"
                              onClick={() => updateItemQuantity(idx, -1)}
                              style={{
                                width: 36, height: 36, borderRadius: "50%",
                                border: "none", cursor: "pointer", fontSize: 18, fontWeight: 700,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                background: "var(--tg-secondary)", color: "var(--tg-text)",
                              }}
                            >
                              −
                            </button>
                            <span style={{ fontSize: 20, fontWeight: 700, width: 32, textAlign: "center", color: "var(--tg-text)", fontVariantNumeric: "tabular-nums" }}>
                              {item.quantity}
                            </span>
                            <button type="button"
                              onClick={() => updateItemQuantity(idx, 1)}
                              style={{
                                width: 36, height: 36, borderRadius: "50%",
                                border: "none", cursor: "pointer", fontSize: 18, fontWeight: 700,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                background: "var(--tg-secondary)", color: "var(--tg-text)",
                              }}
                            >
                              +
                            </button>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            {lineTotal > 0 && (
                              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--tg-text)", fontVariantNumeric: "tabular-nums" }}>
                                {lineTotal.toLocaleString()} ₸
                              </span>
                            )}
                            {items.length > 1 && (
                              <button type="button"
                                onClick={() => { haptic("light"); setItems(items.filter((_, i) => i !== idx)); }}
                                style={{
                                  border: "none", background: "#ef444418", color: "#ef4444",
                                  fontSize: 12, fontWeight: 600, padding: "4px 10px",
                                  borderRadius: 6, cursor: "pointer",
                                }}
                              >
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
                style={{
                  marginTop: 10, padding: "10px 0", width: "100%",
                  background: "transparent", border: "1px dashed var(--tg-hint, #ccc)",
                  borderRadius: 10, color: "var(--tg-link)", fontSize: 14, fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                + Добавить товар
              </button>
            </div>
          </>
        )}
      </form>

      {/* Bottom checkout bar */}
      {!loading && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          padding: "16px", paddingBottom: 24,
          background: "var(--tg-section)",
          borderTop: "0.5px solid var(--tg-hint, #ccc)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 14, color: "var(--tg-hint)" }}>Итого</span>
            <span style={{
              fontSize: 24, fontWeight: 700, color: "var(--tg-text)",
              fontVariantNumeric: "tabular-nums",
            }}>
              {calcTotal().toLocaleString()} ₸
            </span>
          </div>
          <button type="submit" form=""
            disabled={submitting}
            onClick={(e) => {
              e.preventDefault();
              const form = document.querySelector("form");
              if (form) form.requestSubmit();
            }}
            style={{
              width: "100%", padding: "14px 0", borderRadius: 12,
              border: "none", cursor: submitting ? "not-allowed" : "pointer",
              fontSize: 16, fontWeight: 700,
              background: submitting ? "var(--tg-hint)" : "var(--tg-btn)",
              color: "var(--tg-btn-text)",
              opacity: submitting ? 0.6 : 1,
              transition: "all 0.2s",
            }}
          >
            {submitting ? "Резервирование..." : "Создать заказ"}
          </button>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
