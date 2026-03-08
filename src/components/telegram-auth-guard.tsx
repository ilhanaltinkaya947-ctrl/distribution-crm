"use client";

import { useEffect, useState, createContext, useContext } from "react";

interface Employee {
  id: string;
  telegram_id: number;
  full_name: string;
  role: "admin" | "sales_rep" | "picker" | "driver";
}

interface AuthContextValue {
  employee: Employee | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ employee: null, loading: true });

export function useEmployee() {
  return useContext(AuthContext);
}

export function TelegramAuthGuard({ children }: { children: React.ReactNode }) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<"not_found" | "deactivated" | "no_telegram" | null>(null);
  const [telegramId, setTelegramId] = useState<number | null>(null);

  useEffect(() => {
    // Wait for Telegram WebApp SDK to be ready
    const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : null;
    if (!tg) {
      // Not inside Telegram — show error
      setError("no_telegram");
      setLoading(false);
      return;
    }

    tg.ready();
    tg.expand();

    const userId = tg.initDataUnsafe?.user?.id;
    if (!userId) {
      setError("no_telegram");
      setLoading(false);
      return;
    }

    setTelegramId(userId);

    // Verify against database
    fetch("/api/tg/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telegram_id: userId }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.ok && res.employee) {
          setEmployee(res.employee);
        } else if (res.error === "deactivated") {
          setError("deactivated");
        } else {
          setError("not_found");
        }
      })
      .catch(() => {
        setError("not_found");
      })
      .finally(() => setLoading(false));
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="tg-auth-screen">
        <div className="tg-auth-spinner" />
        <p className="tg-auth-text">Проверка доступа...</p>
        <style>{authStyles}</style>
      </div>
    );
  }

  // Access denied
  if (error) {
    return (
      <div className="tg-auth-screen">
        <div className="tg-auth-icon">⛔</div>
        <h2 className="tg-auth-title">
          {error === "deactivated" ? "Аккаунт деактивирован" : "Доступ закрыт"}
        </h2>
        <p className="tg-auth-text">
          {error === "no_telegram"
            ? "Откройте это приложение через Telegram."
            : error === "deactivated"
              ? "Ваш аккаунт был деактивирован. Обратитесь к руководителю."
              : "Вы не зарегистрированы в системе."}
        </p>
        {telegramId && error === "not_found" && (
          <div className="tg-auth-id-box">
            <p className="tg-auth-id-label">Ваш Telegram ID:</p>
            <p className="tg-auth-id-value">{telegramId}</p>
            <p className="tg-auth-id-hint">Передайте этот ID руководителю для получения доступа</p>
          </div>
        )}
        <style>{authStyles}</style>
      </div>
    );
  }

  // Authorized
  return (
    <AuthContext.Provider value={{ employee, loading: false }}>
      {children}
    </AuthContext.Provider>
  );
}

const authStyles = `
  .tg-auth-screen {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; min-height: 100vh; padding: 32px;
    text-align: center;
    background: var(--tg-theme-bg-color, #f5f5f5);
    color: var(--tg-theme-text-color, #1a1a1a);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  .tg-auth-spinner {
    width: 40px; height: 40px; border-radius: 50%;
    border: 3px solid var(--tg-theme-hint-color, #ccc);
    border-top-color: var(--tg-theme-button-color, #2481cc);
    animation: tg-spin 0.8s linear infinite;
    margin-bottom: 16px;
  }
  @keyframes tg-spin {
    to { transform: rotate(360deg); }
  }
  .tg-auth-icon {
    font-size: 64px; margin-bottom: 16px;
  }
  .tg-auth-title {
    font-size: 22px; font-weight: 700; margin: 0 0 8px;
    color: var(--tg-theme-text-color, #1a1a1a);
  }
  .tg-auth-text {
    font-size: 14px; color: var(--tg-theme-hint-color, #8e8e93);
    margin: 0; line-height: 1.5;
  }
  .tg-auth-id-box {
    margin-top: 24px; padding: 16px 24px;
    background: var(--tg-theme-section-bg-color, #ffffff);
    border-radius: 14px;
    border: 1px solid rgba(0,0,0,0.06);
    box-shadow: 0 1px 2px rgba(0,0,0,0.04);
  }
  .tg-auth-id-label {
    font-size: 12px; color: var(--tg-theme-hint-color, #8e8e93);
    margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.3px;
  }
  .tg-auth-id-value {
    font-size: 28px; font-weight: 700; margin: 0 0 8px;
    color: var(--tg-theme-text-color, #1a1a1a);
    font-variant-numeric: tabular-nums;
    user-select: all; -webkit-user-select: all;
  }
  .tg-auth-id-hint {
    font-size: 12px; color: var(--tg-theme-hint-color, #8e8e93); margin: 0;
  }
`;
