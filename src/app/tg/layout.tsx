import type { Metadata } from "next";
import Script from "next/script";
import "../globals.css";

export const metadata: Metadata = {
  title: "CRM Дистрибуция",
  description: "Telegram Mini App — CRM",
};

export default function TgLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <head>
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
      </head>
      <body className="font-sans antialiased bg-[var(--tg-theme-bg-color,#f4f4f5)] text-[var(--tg-theme-text-color,#18181b)]">
        <div className="min-h-screen flex flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
