interface TelegramWebApp {
  ready(): void;
  expand(): void;
  close(): void;
  BackButton: {
    show(): void;
    hide(): void;
    onClick(cb: () => void): void;
  };
  MainButton: {
    show(): void;
    hide(): void;
    setText(text: string): void;
    onClick(cb: () => void): void;
  };
  themeParams: Record<string, string>;
}

interface Window {
  Telegram?: {
    WebApp: TelegramWebApp;
  };
}
