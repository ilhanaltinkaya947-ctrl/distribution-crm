"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const STATUS_LABELS: Record<string, string> = {
  new: "Новый", picking: "Сборка", ready: "Готов к отгрузке",
  delivering: "Доставка", arrived: "На точке", completed: "Выполнен", cancelled: "Отменён",
};

export default function Dashboard() {
  const [clientCount, setClientCount] = useState(0);
  const [productCount, setProductCount] = useState(0);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [c, p, o] = await Promise.all([
          supabase.from("clients").select("id", { count: "exact", head: true }),
          supabase.from("products").select("*"),
          supabase.from("orders").select("id, status, total_amount, created_at, clients(name)").order("created_at", { ascending: false }).limit(10),
        ]);

        if (c.error) throw c.error;
        if (p.error) throw p.error;
        if (o.error) throw o.error;

        setClientCount(c.count ?? 0);
        setProducts(p.data ?? []);
        setProductCount(p.data?.length ?? 0);
        setOrders(o.data ?? []);
      } catch (err: any) {
        console.error("Dashboard load error:", err);
        setError(err.message || "Ошибка загрузки данных");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="p-8 text-zinc-500">Загрузка...</div>;
  if (error) return <div className="p-8 text-red-600">Ошибка: {error}</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Главная</h2>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <p className="text-sm text-zinc-500">Клиенты</p>
          <p className="text-3xl font-bold">{clientCount}</p>
        </div>
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <p className="text-sm text-zinc-500">Товары</p>
          <p className="text-3xl font-bold">{productCount}</p>
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
              {orders.map((o: any) => (
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
              {products.map((p: any) => (
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
