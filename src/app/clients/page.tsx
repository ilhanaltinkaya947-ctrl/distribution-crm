"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PageWrapper } from "@/components/ui/page-wrapper";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DataTableSkeleton } from "@/components/ui/data-table-skeleton";
import { motion, AnimatePresence } from "framer-motion";

export default function ClientsPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", phone: "" });
  const [loading, setLoading] = useState(true);

  async function loadClients() {
    const { data } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
    setClients(data ?? []);
    setLoading(false);
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
    <PageWrapper>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Клиенты</h2>
          <p className="text-muted-foreground mt-1">{clients.length} клиентов в базе</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>{showForm ? "Отмена" : "+ Добавить"}</Button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
            <Card className="mb-6">
              <CardContent className="pt-6">
                <form onSubmit={handleSubmit} className="flex gap-4 items-end">
                  <div className="flex-1">
                    <label className="block text-sm font-medium mb-1.5">Название</label>
                    <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Burger Bar" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium mb-1.5">Адрес</label>
                    <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium mb-1.5">Телефон</label>
                    <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <Button type="submit">Сохранить</Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <Card>
        <CardContent className="pt-6">
          {loading ? <DataTableSkeleton columns={3} /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>Адрес</TableHead>
                  <TableHead>Телефон</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.address ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{c.phone ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageWrapper>
  );
}
