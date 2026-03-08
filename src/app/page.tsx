"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PageWrapper } from "@/components/ui/page-wrapper";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DataTableSkeleton } from "@/components/ui/data-table-skeleton";
import { motion } from "framer-motion";

const STATUS_LABELS: Record<string, string> = {
  new: "Новый", picking: "Сборка", ready: "Готов", delivering: "Доставка",
  arrived: "На точке", completed: "Выполнен", cancelled: "Отменён",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  new: "outline", picking: "secondary", ready: "secondary", delivering: "secondary",
  arrived: "secondary", completed: "default", cancelled: "destructive",
};

export default function Dashboard() {
  const [clientCount, setClientCount] = useState(0);
  const [productCount, setProductCount] = useState(0);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [debtTotal, setDebtTotal] = useState(0);

  useEffect(() => {
    async function load() {
      const [c, p, o, d] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.from("products").select("*"),
        supabase.from("orders").select("id, status, total_amount, created_at, clients(name)").order("created_at", { ascending: false }).limit(8),
        supabase.from("orders").select("total_amount").eq("payment_status", "unpaid").neq("status", "cancelled"),
      ]);
      setClientCount(c.count ?? 0);
      setProducts(p.data ?? []);
      setProductCount(p.data?.length ?? 0);
      setOrders(o.data ?? []);
      setDebtTotal((d.data ?? []).reduce((s: number, o: any) => s + Number(o.total_amount), 0));
      setLoading(false);
    }
    load();
  }, []);

  const lowStock = products.filter((p: any) => (p.stock_quantity - (p.reserved_quantity ?? 0)) < 50).length;

  return (
    <PageWrapper>
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight">Главная</h2>
        <p className="text-muted-foreground mt-1">Обзор операций и складских остатков</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Клиенты" value={clientCount} loading={loading} />
        <StatCard label="Товары" value={productCount} subtitle={lowStock > 0 ? `${lowStock} с низким остатком` : undefined} loading={loading} />
        <StatCard label="Заказы" value={orders.length} loading={loading} />
        <StatCard label="Задолженность" value={`${debtTotal.toLocaleString()} ₸`} loading={loading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.3 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Последние заказы</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? <DataTableSkeleton columns={3} rows={4} /> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Клиент</TableHead>
                      <TableHead>Сумма</TableHead>
                      <TableHead>Статус</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((o: any) => (
                      <TableRow key={o.id}>
                        <TableCell className="font-medium">{(o.clients as any)?.name ?? "—"}</TableCell>
                        <TableCell className="tabular-nums">{Number(o.total_amount).toLocaleString()} ₸</TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANT[o.status] ?? "outline"}>
                            {STATUS_LABELS[o.status] ?? o.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {orders.length === 0 && (
                      <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground h-24">Нет заказов</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.3 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Остатки на складе</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? <DataTableSkeleton columns={3} rows={4} /> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Товар</TableHead>
                      <TableHead>Артикул</TableHead>
                      <TableHead className="text-right">Доступно</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((p: any) => {
                      const available = p.stock_quantity - (p.reserved_quantity ?? 0);
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell className="text-muted-foreground font-mono text-xs">{p.sku}</TableCell>
                          <TableCell className="text-right">
                            <span className={`font-semibold tabular-nums ${available < 50 ? "text-destructive" : "text-emerald-600"}`}>
                              {available}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </PageWrapper>
  );
}
