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

      setStats({ orders: orderData.length, products: productData.length, activeOrders, debtTotal });
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
    <div className="tg-app">
      {/* Header */}
      <div className="tg-header">
        <h1 className="tg-header-title">ASKOM CRM</h1>
        <p className="tg-header-sub">Управление заказами и складом</p>
      </div>

      {/* Stats Row */}
      <div className="tg-stats-row">
        {loading ? (
          <>
            {[1, 2, 3].map((i) => (
              <div key={i} className="tg-card tg-skeleton" style={{ height: 72 }} />
            ))}
          </>
        ) : (
          <>
            <motion.div className="tg-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <p className="tg-stat-label">Активных</p>
              <p className="tg-stat-value">{stats.activeOrders}</p>
            </motion.div>
            <motion.div className="tg-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <p className="tg-stat-label">Товаров</p>
              <p className="tg-stat-value">{stats.products}</p>
            </motion.div>
            <motion.div className="tg-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <p className="tg-stat-label">Долги</p>
              <p className="tg-stat-value" style={{ color: stats.debtTotal > 0 ? "#ef4444" : undefined, fontSize: stats.debtTotal > 0 ? 18 : undefined }}>
                {stats.debtTotal > 0 ? `${(stats.debtTotal / 1000).toFixed(0)}K ₸` : "0"}
              </p>
            </motion.div>
          </>
        )}
      </div>

      {/* Tab Switcher */}
      <div className="tg-tab-bar">
        {(["orders", "stock", "debts"] as const).map((t) => (
          <button key={t} onClick={() => switchTab(t)}
            className={`tg-tab ${tab === t ? "tg-tab-active" : ""}`}>
            {t === "orders" ? "Заказы" : t === "stock" ? "Склад" : "Долги"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="tg-content">
        <AnimatePresence mode="wait">
          {tab === "orders" && (
            <motion.div key="orders" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
              {loading ? (
                <div className="tg-list">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="tg-card tg-skeleton" style={{ height: 88 }} />
                  ))}
                </div>
              ) : orders.length === 0 ? (
                <p className="tg-empty">Нет заказов</p>
              ) : (
                <div className="tg-list">
                  {orders.map((o, i) => (
                    <motion.div key={o.id} className="tg-card tg-order-card"
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      style={{ borderLeftColor: STATUS_COLORS[o.status] ?? "#999" }}
                    >
                      <div className="tg-order-top">
                        <div>
                          <p className="tg-order-client">
                            {(o.clients as unknown as { name: string })?.name ?? "—"}
                          </p>
                          <p className="tg-order-meta">
                            {new Date(o.created_at).toLocaleDateString("ru-RU")} · {PAYMENT_LABELS[o.payment_method] ?? "—"}
                          </p>
                        </div>
                        <span className="tg-status-badge" style={{
                          background: `${STATUS_COLORS[o.status] ?? "#999"}20`,
                          color: STATUS_COLORS[o.status] ?? "#999",
                        }}>
                          {STATUS_LABELS[o.status] ?? o.status}
                        </span>
                      </div>
                      <div className="tg-order-bottom">
                        <p className="tg-order-amount">
                          {Number(o.total_amount).toLocaleString()} ₸
                        </p>
                        {o.payment_status === "unpaid" && (
                          <span className="tg-debt-badge">ДОЛГ</span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {tab === "stock" && (
            <motion.div key="stock" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
              {products.length === 0 ? (
                <p className="tg-empty">Нет товаров</p>
              ) : (
                <div className="tg-list">
                  {products.map((p, i) => {
                    const reserved = p.reserved_quantity ?? 0;
                    const available = p.stock_quantity - reserved;
                    return (
                      <motion.div key={p.id} className="tg-card tg-stock-card"
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                      >
                        <div>
                          <p className="tg-stock-name">{p.name}</p>
                          <p className="tg-stock-meta">
                            {Number(p.price).toLocaleString()} ₸
                            {reserved > 0 && (
                              <span className="tg-stock-reserved"> · резерв: {reserved}</span>
                            )}
                          </p>
                        </div>
                        <span className="tg-stock-qty" style={{ color: available < 50 ? "#ef4444" : "#22c55e" }}>
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
            <motion.div key="debts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
              {debtOrders.length === 0 ? (
                <p className="tg-empty">Нет задолженностей</p>
              ) : (
                <div className="tg-list">
                  {debtOrders.map((o, i) => (
                    <motion.div key={o.id} className="tg-card tg-debt-card"
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                    >
                      <div>
                        <p className="tg-order-client">
                          {(o.clients as unknown as { name: string })?.name ?? "—"}
                        </p>
                        <p className="tg-order-meta">
                          {new Date(o.created_at).toLocaleDateString("ru-RU")}
                        </p>
                      </div>
                      <p className="tg-debt-amount">
                        {Number(o.total_amount).toLocaleString()} ₸
                      </p>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom CTA */}
      <div className="tg-bottom-bar">
        <a href="/tg/new-order" onClick={() => haptic("medium")} className="tg-cta-btn">
          + Новый заказ
        </a>
      </div>

      <style>{`
        .tg-app {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          background: var(--tg-theme-bg-color, #f5f5f5);
          color: var(--tg-theme-text-color, #1a1a1a);
          -webkit-font-smoothing: antialiased;
        }

        /* Header */
        .tg-header {
          padding: 20px 16px 16px;
          background: var(--tg-theme-section-bg-color, #ffffff);
          border-bottom: 1px solid rgba(0,0,0,0.06);
        }
        .tg-header-title {
          font-size: 20px;
          font-weight: 700;
          margin: 0;
          color: var(--tg-theme-text-color, #1a1a1a);
        }
        .tg-header-sub {
          font-size: 13px;
          color: var(--tg-theme-hint-color, #8e8e93);
          margin: 4px 0 0;
        }

        /* Stats */
        .tg-stats-row {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 8px;
          padding: 12px 16px;
        }
        .tg-stat-label {
          font-size: 11px;
          color: var(--tg-theme-hint-color, #8e8e93);
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .tg-stat-value {
          font-size: 24px;
          font-weight: 700;
          margin: 4px 0 0;
          color: var(--tg-theme-text-color, #1a1a1a);
        }

        /* Cards (shared) */
        .tg-card {
          background: var(--tg-theme-section-bg-color, #ffffff);
          border-radius: 14px;
          padding: 14px 16px;
          border: 1px solid rgba(0,0,0,0.06);
          box-shadow: 0 1px 2px rgba(0,0,0,0.04);
        }

        /* Skeleton */
        .tg-skeleton {
          animation: tg-pulse 1.5s ease-in-out infinite;
        }
        @keyframes tg-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        /* Tabs */
        .tg-tab-bar {
          display: flex;
          gap: 4px;
          margin: 0 16px;
          padding: 4px;
          background: var(--tg-theme-secondary-bg-color, #ebebed);
          border-radius: 10px;
        }
        .tg-tab {
          flex: 1;
          padding: 10px 0;
          font-size: 13px;
          font-weight: 600;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          background: transparent;
          color: var(--tg-theme-hint-color, #8e8e93);
          transition: all 0.2s;
        }
        .tg-tab-active {
          background: var(--tg-theme-section-bg-color, #ffffff);
          color: var(--tg-theme-text-color, #1a1a1a);
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        }

        /* Content */
        .tg-content {
          flex: 1;
          padding: 12px 16px;
          padding-bottom: 84px;
        }
        .tg-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .tg-empty {
          text-align: center;
          color: var(--tg-theme-hint-color, #8e8e93);
          padding: 48px 0;
          font-size: 14px;
        }

        /* Order card */
        .tg-order-card {
          border-left: 3px solid #999;
        }
        .tg-order-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .tg-order-client {
          font-weight: 600;
          font-size: 15px;
          margin: 0;
          color: var(--tg-theme-text-color, #1a1a1a);
        }
        .tg-order-meta {
          font-size: 12px;
          color: var(--tg-theme-hint-color, #8e8e93);
          margin: 3px 0 0;
        }
        .tg-status-badge {
          font-size: 11px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 6px;
          flex-shrink: 0;
        }
        .tg-order-bottom {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 10px;
        }
        .tg-order-amount {
          font-size: 18px;
          font-weight: 700;
          margin: 0;
          color: var(--tg-theme-text-color, #1a1a1a);
          font-variant-numeric: tabular-nums;
        }
        .tg-debt-badge {
          font-size: 10px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
          background: #fef2f2;
          color: #ef4444;
          letter-spacing: 0.5px;
        }

        /* Stock card */
        .tg-stock-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .tg-stock-name {
          font-weight: 600;
          font-size: 14px;
          margin: 0;
          color: var(--tg-theme-text-color, #1a1a1a);
        }
        .tg-stock-meta {
          font-size: 12px;
          color: var(--tg-theme-hint-color, #8e8e93);
          margin: 3px 0 0;
        }
        .tg-stock-reserved {
          color: #f59e0b;
        }
        .tg-stock-qty {
          font-size: 20px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }

        /* Debt card */
        .tg-debt-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-left: 3px solid #ef4444;
        }
        .tg-debt-amount {
          font-size: 18px;
          font-weight: 700;
          color: #ef4444;
          margin: 0;
          font-variant-numeric: tabular-nums;
        }

        /* Bottom bar */
        .tg-bottom-bar {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 12px 16px 20px;
          background: var(--tg-theme-section-bg-color, #ffffff);
          border-top: 1px solid rgba(0,0,0,0.06);
        }
        .tg-cta-btn {
          display: block;
          width: 100%;
          padding: 14px 0;
          background: var(--tg-theme-button-color, #2481cc);
          color: var(--tg-theme-button-text-color, #ffffff);
          text-align: center;
          border-radius: 12px;
          font-weight: 600;
          font-size: 15px;
          text-decoration: none;
          box-sizing: border-box;
        }
      `}</style>
    </div>
  );
}
