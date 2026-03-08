"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Order {
  id: string;
  status: string;
  total_amount: number;
  created_at: string;
  clients: { name: string } | null;
}

interface Product {
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
}

const STATUS_LABELS: Record<string, string> = {
  new: "Новый",
  picking: "Сборка",
  delivering: "Доставка",
  completed: "Выполнен",
  cancelled: "Отменён",
};

const STATUS_COLORS: Record<string, string> = {
  new: "bg-yellow-100 text-yellow-800",
  picking: "bg-blue-100 text-blue-800",
  delivering: "bg-purple-100 text-purple-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export default function TgHome() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tab, setTab] = useState<"orders" | "stock">("orders");

  useEffect(() => {
    if (typeof window !== "undefined" && window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }

    async function load() {
      const [o, p] = await Promise.all([
        supabase
          .from("orders")
          .select("id, status, total_amount, created_at, clients(name)")
          .order("created_at", { ascending: false })
          .limit(20),
        supabase.from("products").select("id, name, price, stock_quantity").order("name"),
      ]);
      if (o.data) setOrders(o.data as unknown as Order[]);
      if (p.data) setProducts(p.data);
    }
    load();
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="bg-white px-4 pt-4 pb-3 shadow-sm">
        <h1 className="text-lg font-bold">CRM Дистрибуция</h1>
        <p className="text-xs text-zinc-500 mt-0.5">Управление заказами и складом</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 p-4">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-zinc-500">Заказов</p>
          <p className="text-2xl font-bold">{orders.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-zinc-500">Товаров</p>
          <p className="text-2xl font-bold">{products.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mx-4 bg-zinc-200 rounded-lg p-1">
        <button
          onClick={() => setTab("orders")}
          className={`flex-1 py-2 text-sm rounded-md font-medium transition ${
            tab === "orders" ? "bg-white shadow-sm" : "text-zinc-500"
          }`}
        >
          Заказы
        </button>
        <button
          onClick={() => setTab("stock")}
          className={`flex-1 py-2 text-sm rounded-md font-medium transition ${
            tab === "stock" ? "bg-white shadow-sm" : "text-zinc-500"
          }`}
        >
          Склад
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 space-y-3">
        {tab === "orders" &&
          orders.map((o) => (
            <div key={o.id} className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold">{o.clients?.name ?? "—"}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {new Date(o.created_at).toLocaleDateString("ru-RU")}
                  </p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[o.status] ?? ""}`}>
                  {STATUS_LABELS[o.status] ?? o.status}
                </span>
              </div>
              <p className="text-lg font-bold mt-2">{Number(o.total_amount).toLocaleString()} ₸</p>
            </div>
          ))}

        {tab === "stock" &&
          products.map((p) => (
            <div key={p.id} className="bg-white rounded-xl p-4 shadow-sm flex justify-between items-center">
              <div>
                <p className="font-medium text-sm">{p.name}</p>
                <p className="text-xs text-zinc-500">{Number(p.price).toLocaleString()} ₸</p>
              </div>
              <span className={`text-lg font-bold ${p.stock_quantity < 50 ? "text-red-600" : "text-green-600"}`}>
                {p.stock_quantity}
              </span>
            </div>
          ))}

        {tab === "orders" && orders.length === 0 && (
          <p className="text-center text-zinc-400 py-8">Нет заказов</p>
        )}
      </div>

      {/* Bottom nav */}
      <div className="sticky bottom-0 bg-white border-t px-4 py-3">
        <a
          href="/tg/new-order"
          className="block w-full bg-blue-600 text-white text-center py-3 rounded-xl font-medium text-sm"
        >
          + Новый заказ
        </a>
      </div>
    </div>
  );
}
