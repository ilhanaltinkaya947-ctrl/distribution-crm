"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ sku: "", name: "", price: "", stock_quantity: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadProducts() {
    const { data, error: err } = await supabase.from("products").select("*").order("name");
    if (err) { console.error(err); setError(err.message); return; }
    setProducts(data ?? []);
    setLoading(false);
  }

  useEffect(() => { loadProducts(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { error: err } = await supabase.from("products").insert({
      sku: form.sku, name: form.name,
      price: parseFloat(form.price), stock_quantity: parseInt(form.stock_quantity),
    });
    if (err) { alert("Ошибка: " + err.message); return; }
    setForm({ sku: "", name: "", price: "", stock_quantity: "" });
    setShowForm(false);
    loadProducts();
  }

  if (loading) return <div className="p-8 text-zinc-500">Загрузка...</div>;
  if (error) return <div className="p-8 text-red-600">Ошибка: {error}</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Товары</h2>
        <button onClick={() => setShowForm(!showForm)} className="bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-zinc-700">
          + Добавить товар
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-6 mb-6 flex gap-4 items-end">
          <div>
            <label className="block text-sm text-zinc-500 mb-1">Артикул</label>
            <input required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="FRY-XXX" />
          </div>
          <div className="flex-1">
            <label className="block text-sm text-zinc-500 mb-1">Название</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-zinc-500 mb-1">Цена (₸)</label>
            <input required type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-zinc-500 mb-1">Остаток</label>
            <input required type="number" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-500">Сохранить</button>
        </form>
      )}

      <div className="bg-white rounded-lg shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-500 border-b">
              <th className="p-4">Артикул</th>
              <th className="p-4">Название</th>
              <th className="p-4">Цена</th>
              <th className="p-4">На складе</th>
              <th className="p-4">Резерв</th>
              <th className="p-4">Доступно</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p: any) => {
              const available = p.stock_quantity - (p.reserved_quantity ?? 0);
              return (
                <tr key={p.id} className="border-b last:border-0 hover:bg-zinc-50">
                  <td className="p-4 font-mono text-zinc-500">{p.sku}</td>
                  <td className="p-4 font-medium">{p.name}</td>
                  <td className="p-4">{Number(p.price).toLocaleString()} ₸</td>
                  <td className="p-4">{p.stock_quantity}</td>
                  <td className="p-4 text-orange-600">{(p.reserved_quantity ?? 0) > 0 ? p.reserved_quantity : "—"}</td>
                  <td className="p-4">
                    <span className={`font-bold ${available < 50 ? "text-red-600" : "text-green-600"}`}>{available}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
