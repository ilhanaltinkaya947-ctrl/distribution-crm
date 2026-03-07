"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Client {
  id: string;
  name: string;
  address: string;
  phone: string;
  created_at: string;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", phone: "" });

  async function loadClients() {
    const { data } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
    if (data) setClients(data);
  }

  useEffect(() => { loadClients(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from("clients").insert(form);
    setForm({ name: "", address: "", phone: "" });
    setShowForm(false);
    loadClients();
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Клиенты</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-zinc-700"
        >
          + Добавить клиента
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-6 mb-6 flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm text-zinc-500 mb-1">Название</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Burger Bar Abay"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm text-zinc-500 mb-1">Адрес</label>
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm text-zinc-500 mb-1">Телефон</label>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-500">
            Сохранить
          </button>
        </form>
      )}

      <div className="bg-white rounded-lg shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-500 border-b">
              <th className="p-4">Название</th>
              <th className="p-4">Адрес</th>
              <th className="p-4">Телефон</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id} className="border-b last:border-0 hover:bg-zinc-50">
                <td className="p-4 font-medium">{c.name}</td>
                <td className="p-4 text-zinc-600">{c.address}</td>
                <td className="p-4 text-zinc-600">{c.phone}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
