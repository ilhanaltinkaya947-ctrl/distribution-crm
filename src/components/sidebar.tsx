"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Главная", icon: "📊" },
  { href: "/orders", label: "Заказы", icon: "📋" },
  { href: "/clients", label: "Клиенты", icon: "👥" },
  { href: "/products", label: "Товары", icon: "📦" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 border-r bg-card flex flex-col">
      <div className="p-6 pb-4">
        <h1 className="text-lg font-bold tracking-tight">ASKOM</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Дистрибуция</p>
      </div>
      <nav className="flex-1 px-3 space-y-1">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t">
        <p className="text-xs text-muted-foreground">v1.0 — CRM Дистрибуция</p>
      </div>
    </aside>
  );
}
