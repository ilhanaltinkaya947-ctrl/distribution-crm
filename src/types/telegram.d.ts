interface TelegramWebApp {
  ready(): void;
  expand(): void;
  close(): void;
  BackButton: {
    show(): void;
    hide(): void;
    onClick(cb: () => void): void;
    offClick(cb: () => void): void;
  };
  MainButton: {
    show(): void;
    hide(): void;
    setText(text: string): void;
    onClick(cb: () => void): void;
    offClick(cb: () => void): void;
    showProgress(leaveActive?: boolean): void;
    hideProgress(): void;
    setParams(params: { color?: string; text_color?: string; is_active?: boolean; is_visible?: boolean }): void;
  };
  HapticFeedback: {
    impactOccurred(style: "light" | "medium" | "heavy" | "rigid" | "soft"): void;
    notificationOccurred(type: "error" | "success" | "warning"): void;
    selectionChanged(): void;
  };
  initData: string;
  initDataUnsafe: {
    query_id?: string;
    user?: {
      id: number;
      is_bot?: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
    };
    auth_date?: number;
    hash?: string;
  };
  themeParams: Record<string, string>;
  colorScheme: "light" | "dark";
}

interface Window {
  Telegram?: {
    WebApp: TelegramWebApp;
  };
}
