import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "ASKOM CRM",
  description: "Telegram Mini App — CRM",
};

export default function TgLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      <style>{`
        :root {
          --tg-bg: var(--tg-theme-bg-color, #ffffff);
          --tg-text: var(--tg-theme-text-color, #000000);
          --tg-hint: var(--tg-theme-hint-color, #999999);
          --tg-link: var(--tg-theme-link-color, #2481cc);
          --tg-btn: var(--tg-theme-button-color, #2481cc);
          --tg-btn-text: var(--tg-theme-button-text-color, #ffffff);
          --tg-secondary: var(--tg-theme-secondary-bg-color, #f0f0f0);
          --tg-section: var(--tg-theme-section-bg-color, #ffffff);
        }
      `}</style>
      <div style={{
        background: "var(--tg-bg)",
        color: "var(--tg-text)",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        minHeight: "100vh",
        margin: 0,
      }}>
        {children}
      </div>
    </>
  );
}
