import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "CRM Дистрибуция",
  description: "B2B CRM для дистрибуции замороженных продуктов",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={`${geistSans.variable} font-sans antialiased`}>
        <div className="flex min-h-screen">
          <aside className="w-56 bg-zinc-900 text-white p-4 flex flex-col gap-2 shrink-0">
            <h1 className="text-lg font-bold mb-6">CRM Дистрибуция</h1>
            <a href="/" className="px-3 py-2 rounded hover:bg-zinc-700">Главная</a>
            <a href="/clients" className="px-3 py-2 rounded hover:bg-zinc-700">Клиенты</a>
            <a href="/products" className="px-3 py-2 rounded hover:bg-zinc-700">Товары</a>
            <a href="/orders" className="px-3 py-2 rounded hover:bg-zinc-700">Заказы</a>
          </aside>
          <main className="flex-1 bg-zinc-50 p-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
