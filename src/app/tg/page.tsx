"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { haptic } from "@/lib/haptic";
import { motion, AnimatePresence } from "framer-motion";

interface Order {
  id: string;
  status: string;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  created_at: string;
  clients: { name: string } | null;
}

interface Product {
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
  reserved_quantity: number;
}

const STATUS_LABELS: Record<string, string> = {
  new: "Новый", picking: "Сборка", ready: "Готов", delivering: "Доставка",
  arrived: "На точке", completed: "Выполнен", cancelled: "Отменён",
};

const STATUS_COLORS: Record<string, string> = {
  new: "#f59e0b",
  picking: "#3b82f6",
  ready: "#8b5cf6",
  delivering: "#6366f1",
  arrived: "#0ea5e9",
  completed: "#22c55e",
  cancelled: "#ef4444",
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Наличные", transfer: "Перевод", credit: "В долг",
};

export default function TgHome() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tab, setTab] = useState<"orders" | "stock" | "debts">("orders");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ orders: 0, products: 0, activeOrders: 0, debtTotal: 0 });

  useEffect(() => {
    if (typeof window !== "undefined" && window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }

    async function load() {
      const [o, p] = await Promise.all([
        supabase
          .from("orders")
          .select("id, status, total_amount, payment_method, payment_status, created_at, clients(name)")
          .order("created_at", { ascending: false })
          .limit(30),
        supabase.from("products").select("id, name, price, stock_quantity, reserved_quantity").order("name"),
      ]);
      const orderData = (o.data ?? []) as unknown as Order[];
      const productData = p.data ?? [];
      setOrders(orderData);
      setProducts(productData as unknown as Product[]);

      const activeOrders = orderData.filter((o) => !["completed", "cancelled"].includes(o.status)).length;
      const debtTotal = orderData
        .filter((o) => o.payment_status === "unpaid")
        .reduce((sum, o) => sum + Number(o.total_amount), 0);

      setStats({
        orders: orderData.length,
        products: productData.length,
        activeOrders,
        debtTotal,
      });
      setLoading(false);
    }
    load();
  }, []);

  function switchTab(t: typeof tab) {
    haptic("light");
    setTab(t);
  }

  const debtOrders = orders.filter((o) => o.payment_status === "unpaid");

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{
        padding: "20px 16px 16px",
        background: "var(--tg-section)",
        borderBottom: "0.5px solid var(--tg-hint, #ccc)",
      }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "var(--tg-text)" }}>
          ASKOM CRM
        </h1>
        <p style={{ fontSize: 13, color: "var(--tg-hint)", margin: "4px 0 0" }}>
          Управление заказами и складом
        </p>
      </div>

      {/* Stats Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, padding: "12px 16px" }}>
        {loading ? (
          <>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{
                background: "var(--tg-section)", borderRadius: 12, padding: "14px 12px",
                animation: "pulse 1.5s ease-in-out infinite",
              }}>
                <div style={{ width: 40, height: 12, background: "var(--tg-hint)", borderRadius: 4, opacity: 0.3, marginBottom: 8 }} />
                <div style={{ width: 30, height: 22, background: "var(--tg-hint)", borderRadius: 4, opacity: 0.3 }} />
              </div>
            ))}
          </>
        ) : (
          <>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}
              style={{ background: "var(--tg-section)", borderRadius: 12, padding: "14px 12px" }}>
              <p style={{ fontSize: 11, color: "var(--tg-hint)", margin: 0 }}>Активных</p>
              <p style={{ fontSize: 24, fontWeight: 700, margin: "4px 0 0", color: "var(--tg-text)" }}>
                {stats.activeOrders}
              </p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              style={{ background: "var(--tg-section)", borderRadius: 12, padding: "14px 12px" }}>
              <p style={{ fontSize: 11, color: "var(--tg-hint)", margin: 0 }}>Товаров</p>
              <p style={{ fontSize: 24, fontWeight: 700, margin: "4px 0 0", color: "var(--tg-text)" }}>
                {stats.products}
              </p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              style={{ background: "var(--tg-section)", borderRadius: 12, padding: "14px 12px" }}>
              <p style={{ fontSize: 11, color: "var(--tg-hint)", margin: 0 }}>Долги</p>
              <p style={{
                fontSize: stats.debtTotal > 0 ? 18 : 24,
                fontWeight: 700, margin: "4px 0 0",
                color: stats.debtTotal > 0 ? "#ef4444" : "var(--tg-text)",
              }}>
                {stats.debtTotal > 0 ? `${(stats.debtTotal / 1000).toFixed(0)}K ₸` : "0"}
              </p>
            </motion.div>
          </>
        )}
      </div>

      {/* Tab Switcher */}
      <div style={{
        display: "flex", gap: 4, margin: "0 16px", padding: 4,
        background: "var(--tg-secondary)", borderRadius: 10,
      }}>
        {(["orders", "stock", "debts"] as const).map((t) => (
          <button key={t} onClick={() => switchTab(t)} style={{
            flex: 1, padding: "10px 0", fontSize: 13, fontWeight: 600,
            borderRadius: 8, border: "none", cursor: "pointer",
            transition: "all 0.2s",
            background: tab === t ? "var(--tg-section)" : "transparent",
            color: tab === t ? "var(--tg-text)" : "var(--tg-hint)",
            boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
          }}>
            {t === "orders" ? "Заказы" : t === "stock" ? "Склад" : "Долги"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: "12px 16px", paddingBottom: 80 }}>
        <AnimatePresence mode="wait">
          {tab === "orders" && (
            <motion.div key="orders" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.15 }}>
              {loading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} style={{
                      background: "var(--tg-section)", borderRadius: 14, padding: 16, height: 80,
                      animation: "pulse 1.5s ease-in-out infinite",
                    }} />
                  ))}
                </div>
              ) : orders.length === 0 ? (
                <p style={{ textAlign: "center", color: "var(--tg-hint)", padding: "48px 0", fontSize: 14 }}>
                  Нет заказов
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {orders.map((o, i) => (
                    <motion.div key={o.id}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      style={{
                        background: "var(--tg-section)", borderRadius: 14, padding: "14px 16px",
                        borderLeft: `3px solid ${STATUS_COLORS[o.status] ?? "#999"}`,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <p style={{ fontWeight: 600, fontSize: 15, margin: 0, color: "var(--tg-text)" }}>
                            {(o.clients as unknown as { name: string })?.name ?? "—"}
                          </p>
                          <p style={{ fontSize: 12, color: "var(--tg-hint)", margin: "3px 0 0" }}>
                            {new Date(o.created_at).toLocaleDateString("ru-RU")} · {PAYMENT_LABELS[o.payment_method] ?? "—"}
                          </p>
                        </div>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6,
                          background: `${STATUS_COLORS[o.status] ?? "#999"}18`,
                          color: STATUS_COLORS[o.status] ?? "#999",
                        }}>
                          {STATUS_LABELS[o.status] ?? o.status}
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                        <p style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--tg-text)", fontVariantNumeric: "tabular-nums" }}>
                          {Number(o.total_amount).toLocaleString()} ₸
                        </p>
                        {o.payment_status === "unpaid" && (
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 4,
                            background: "#ef444418", color: "#ef4444",
                          }}>
                            ДОЛГ
                          </span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {tab === "stock" && (
            <motion.div key="stock" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.15 }}>
              {products.length === 0 ? (
                <p style={{ textAlign: "center", color: "var(--tg-hint)", padding: "48px 0", fontSize: 14 }}>
                  Нет товаров
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {products.map((p, i) => {
                    const reserved = p.reserved_quantity ?? 0;
                    const available = p.stock_quantity - reserved;
                    return (
                      <motion.div key={p.id}
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        style={{
                          background: "var(--tg-section)", borderRadius: 14, padding: "14px 16px",
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                        }}
                      >
                        <div>
                          <p style={{ fontWeight: 600, fontSize: 14, margin: 0, color: "var(--tg-text)" }}>{p.name}</p>
                          <p style={{ fontSize: 12, color: "var(--tg-hint)", margin: "3px 0 0" }}>
                            {Number(p.price).toLocaleString()} ₸
                            {reserved > 0 && (
                              <span style={{ marginLeft: 8, color: "#f59e0b" }}>резерв: {reserved}</span>
                            )}
                          </p>
                        </div>
                        <span style={{
                          fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums",
                          color: available < 50 ? "#ef4444" : "#22c55e",
                        }}>
                          {available}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {tab === "debts" && (
            <motion.div key="debts" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.15 }}>
              {debtOrders.length === 0 ? (
                <p style={{ textAlign: "center", color: "var(--tg-hint)", padding: "48px 0", fontSize: 14 }}>
                  Нет задолженностей
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {debtOrders.map((o, i) => (
                    <motion.div key={o.id}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      style={{
                        background: "var(--tg-section)", borderRadius: 14, padding: "14px 16px",
                        borderLeft: "3px solid #ef4444",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <p style={{ fontWeight: 600, fontSize: 15, margin: 0, color: "var(--tg-text)" }}>
                            {(o.clients as unknown as { name: string })?.name ?? "—"}
                          </p>
                          <p style={{ fontSize: 12, color: "var(--tg-hint)", margin: "3px 0 0" }}>
                            {new Date(o.created_at).toLocaleDateString("ru-RU")}
                          </p>
                        </div>
                        <p style={{ fontSize: 18, fontWeight: 700, color: "#ef4444", margin: 0, fontVariantNumeric: "tabular-nums" }}>
                          {Number(o.total_amount).toLocaleString()} ₸
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom CTA */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        padding: "12px 16px", paddingBottom: 20,
        background: "var(--tg-bg)",
        borderTop: "0.5px solid var(--tg-hint, #ccc)",
      }}>
        <a href="/tg/new-order"
          onClick={() => haptic("medium")}
          style={{
            display: "block", width: "100%", padding: "14px 0",
            background: "var(--tg-btn)", color: "var(--tg-btn-text)",
            textAlign: "center", borderRadius: 12, fontWeight: 600, fontSize: 15,
            textDecoration: "none", boxSizing: "border-box",
          }}
        >
          + Новый заказ
        </a>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
