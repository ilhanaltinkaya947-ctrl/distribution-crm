"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PageWrapper } from "@/components/ui/page-wrapper";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTableSkeleton } from "@/components/ui/data-table-skeleton";
import { motion, AnimatePresence } from "framer-motion";

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ sku: "", name: "", price: "", stock_quantity: "" });
  const [loading, setLoading] = useState(true);

  async function loadProducts() {
    const { data } = await supabase.from("products").select("*").order("name");
    setProducts(data ?? []);
    setLoading(false);
  }

  useEffect(() => { loadProducts(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from("products").insert({
      sku: form.sku, name: form.name,
      price: parseFloat(form.price), stock_quantity: parseInt(form.stock_quantity),
    });
    setForm({ sku: "", name: "", price: "", stock_quantity: "" });
    setShowForm(false);
    loadProducts();
  }

  return (
    <PageWrapper>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Товары</h2>
          <p className="text-muted-foreground mt-1">Каталог и складские остатки</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>{showForm ? "Отмена" : "+ Добавить"}</Button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
            <Card className="mb-6">
              <CardContent className="pt-6">
                <form onSubmit={handleSubmit} className="flex gap-4 items-end">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Артикул</label>
                    <input required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })}
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="FRY-XXX" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium mb-1.5">Название</label>
                    <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Цена (₸)</label>
                    <input required type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Остаток</label>
                    <input required type="number" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
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
          {loading ? <DataTableSkeleton columns={6} /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Артикул</TableHead>
                  <TableHead>Название</TableHead>
                  <TableHead className="text-right">Цена</TableHead>
                  <TableHead className="text-right">На складе</TableHead>
                  <TableHead className="text-right">Резерв</TableHead>
                  <TableHead className="text-right">Доступно</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p: any) => {
                  const reserved = p.reserved_quantity ?? 0;
                  const available = p.stock_quantity - reserved;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{p.sku}</TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{Number(p.price).toLocaleString()} ₸</TableCell>
                      <TableCell className="text-right tabular-nums">{p.stock_quantity}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {reserved > 0 ? <Badge variant="outline" className="text-orange-600 border-orange-200">{reserved}</Badge> : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`font-bold tabular-nums ${available < 50 ? "text-destructive" : "text-emerald-600"}`}>{available}</span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageWrapper>
  );
}
