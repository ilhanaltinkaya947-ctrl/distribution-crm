"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PageWrapper } from "@/components/ui/page-wrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTableSkeleton } from "@/components/ui/data-table-skeleton";
import { Separator } from "@/components/ui/separator";
import { motion, AnimatePresence } from "framer-motion";

const STATUS_LABELS: Record<string, string> = {
  new: "Новый", picking: "Сборка", ready: "Готов", delivering: "Доставка",
  arrived: "На точке", completed: "Выполнен", cancelled: "Отменён",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  new: "outline", picking: "secondary", ready: "secondary", delivering: "secondary",
  arrived: "secondary", completed: "default", cancelled: "destructive",
};
const PAYMENT_LABELS: Record<string, string> = { cash: "Наличные", transfer: "Перевод", credit: "В долг" };

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedClient, setSelectedClient] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [items, setItems] = useState([{ product_id: "", quantity: 1 }]);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadOrders() {
    const { data } = await supabase.from("orders")
      .select("id, status, total_amount, payment_method, payment_status, created_at, clients(name)")
      .order("created_at", { ascending: false });
    setOrders(data ?? []);
  }

  async function loadFormData() {
    const [c, p] = await Promise.all([
      supabase.from("clients").select("id, name").order("name"),
      supabase.from("products").select("id, name, price, stock_quantity, reserved_quantity").order("name"),
    ]);
    setClients(c.data ?? []);
    setProducts(p.data ?? []);
  }

  useEffect(() => { Promise.all([loadOrders(), loadFormData()]).finally(() => setLoading(false)); }, []);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 4000); }

  function calcTotal() {
    return items.reduce((sum, item) => {
      const p = products.find((p: any) => p.id === item.product_id);
      return sum + (p ? Number(p.price) * item.quantity : 0);
    }, 0);
  }

  function availableStock(p: any) { return p.stock_quantity - (p.reserved_quantity ?? 0); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const total = calcTotal();
    const client = clients.find((c: any) => c.id === selectedClient);

    for (const item of items.filter((i) => i.product_id)) {
      const { error } = await supabase.rpc("reserve_stock", { p_product_id: item.product_id, p_quantity: item.quantity });
      if (error) {
        const prod = products.find((p: any) => p.id === item.product_id);
        showToast(`Недостаточно: ${prod?.name ?? "товар"}`);
        return;
      }
    }

    const { data: order } = await supabase.from("orders")
      .insert({ client_id: selectedClient, status: "new", total_amount: total, payment_method: paymentMethod, payment_status: paymentMethod === "credit" ? "unpaid" : "paid" })
      .select("id").single();

    if (order) {
      const orderItems = items.filter((i) => i.product_id).map((i) => {
        const p = products.find((p: any) => p.id === i.product_id);
        return { order_id: order.id, product_id: i.product_id, quantity: i.quantity, price_at_time: p?.price ?? 0 };
      });
      await supabase.from("order_items").insert(orderItems);

      fetch("/api/notify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id, clientName: client?.name ?? "—",
          items: items.filter((i) => i.product_id).map((i) => ({ name: products.find((p: any) => p.id === i.product_id)?.name ?? "", quantity: i.quantity })),
          total, paymentMethod,
        }),
      });
      showToast("Заказ создан и отправлен в Telegram!");
    }

    setShowForm(false);
    setSelectedClient("");
    setPaymentMethod("cash");
    setItems([{ product_id: "", quantity: 1 }]);
    loadOrders();
    loadFormData();
  }

  return (
    <PageWrapper>
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 right-4 z-50 bg-primary text-primary-foreground px-5 py-3 rounded-lg shadow-lg text-sm font-medium">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Заказы</h2>
          <p className="text-muted-foreground mt-1">{orders.length} заказов</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>{showForm ? "Отмена" : "+ Новый заказ"}</Button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }}>
            <Card className="mb-6">
              <CardHeader><CardTitle className="text-base">Новый заказ</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit}>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Клиент</label>
                      <select required value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)}
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                        <option value="">Выберите клиента...</option>
                        {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Оплата</label>
                      <div className="flex gap-2">
                        {[{ v: "cash", l: "Наличные" }, { v: "transfer", l: "Перевод" }, { v: "credit", l: "В долг" }].map((opt) => (
                          <Button key={opt.v} type="button" size="sm"
                            variant={paymentMethod === opt.v ? "default" : "outline"}
                            onClick={() => setPaymentMethod(opt.v)} className="flex-1">
                            {opt.l}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <label className="block text-sm font-medium mb-2">Товары</label>
                  {items.map((item, idx) => (
                    <div key={idx} className="flex gap-3 mb-2 items-center">
                      <select required value={item.product_id}
                        onChange={(e) => { const u = [...items]; u[idx].product_id = e.target.value; setItems(u); }}
                        className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                        <option value="">Выберите товар...</option>
                        {products.map((p: any) => (
                          <option key={p.id} value={p.id} disabled={availableStock(p) <= 0}>
                            {p.name} — {Number(p.price).toLocaleString()} ₸ (ост: {availableStock(p)})
                          </option>
                        ))}
                      </select>
                      <input type="number" min={1} value={item.quantity}
                        onChange={(e) => { const u = [...items]; u[idx].quantity = parseInt(e.target.value) || 1; setItems(u); }}
                        className="w-20 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                      {items.length > 1 && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-destructive">Удалить</Button>
                      )}
                    </div>
                  ))}
                  <Button type="button" variant="ghost" size="sm" onClick={() => setItems([...items, { product_id: "", quantity: 1 }])} className="mt-1">+ Добавить товар</Button>

                  <Separator className="my-4" />

                  <div className="flex justify-between items-center">
                    <p className="text-lg font-semibold tabular-nums">Итого: {calcTotal().toLocaleString()} ₸</p>
                    <Button type="submit">Создать заказ</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <Card>
        <CardContent className="pt-6">
          {loading ? <DataTableSkeleton columns={5} /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Клиент</TableHead>
                  <TableHead className="text-right">Сумма</TableHead>
                  <TableHead>Оплата</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Дата</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o: any) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{(o.clients as any)?.name ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{Number(o.total_amount).toLocaleString()} ₸</TableCell>
                    <TableCell>
                      <span className="text-sm">{PAYMENT_LABELS[o.payment_method ?? ""] ?? "—"}</span>
                      {o.payment_status === "unpaid" && <Badge variant="destructive" className="ml-2 text-[10px]">долг</Badge>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[o.status] ?? "outline"}>{STATUS_LABELS[o.status] ?? o.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{new Date(o.created_at).toLocaleDateString("ru-RU")}</TableCell>
                  </TableRow>
                ))}
                {orders.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground h-24">Нет заказов</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageWrapper>
  );
}
