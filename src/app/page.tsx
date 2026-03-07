"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Client {
  id: string;
  name: string;
  phone: string;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  price: number;
  stock_quantity: number;
}

interface Order {
  id: string;
  status: string;
  total_amount: number;
  created_at: string;
  clients: { name: string } | null;
}

const STATUS_LABELS: Record<string, string> = {
  new: "Новый",
  picking: "Сборка",
  delivering: "Доставка",
  completed: "Выполнен",
  cancelled: "Отменён",
};

export default function Dashboard() {
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    async function load() {
      const [c, p, o] = await Promise.all([
        supabase.from("clients").select("id, name, phone"),
        supabase.from("products").select("*"),
        supabase.from("orders").select("id, status, total_amount, created_at, clients(name)").order("created_at", { ascending: false }),
      ]);
      if (c.data) setClients(c.data);
      if (p.data) setProducts(p.data);
      if (o.data) setOrders(o.data as Order[]);
    }
    load();
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Главная</h2>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <p className="text-sm text-zinc-500">Клиенты</p>
          <p className="text-3xl font-bold">{clients.length}</p>
        </div>
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <p className="text-sm text-zinc-500">Товары</p>
          <p className="text-3xl font-bold">{products.length}</p>
        </div>
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <p className="text-sm text-zinc-500">Заказы</p>
          <p className="text-3xl font-bold">{orders.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="font-semibold mb-4">Последние заказы</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 border-b">
                <th className="pb-2">Клиент</th>
                <th className="pb-2">Сумма</th>
                <th className="pb-2">Статус</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b last:border-0">
                  <td className="py-2">{o.clients?.name ?? "—"}</td>
                  <td className="py-2">{Number(o.total_amount).toLocaleString()} ₸</td>
                  <td className="py-2">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-800">
                      {STATUS_LABELS[o.status] ?? o.status}
                    </span>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr><td colSpan={3} className="py-4 text-center text-zinc-400">Нет заказов</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="font-semibold mb-4">Остатки на складе</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 border-b">
                <th className="pb-2">Товар</th>
                <th className="pb-2">Артикул</th>
                <th className="pb-2">Остаток</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="py-2">{p.name}</td>
                  <td className="py-2 text-zinc-500">{p.sku}</td>
                  <td className="py-2 font-medium">{p.stock_quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
