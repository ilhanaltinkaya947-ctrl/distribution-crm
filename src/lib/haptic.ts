export function haptic(type: "light" | "medium" | "heavy" | "success" | "error" | "warning" = "light") {
  if (typeof window === "undefined" || !window.Telegram?.WebApp?.HapticFeedback) return;

  const hf = window.Telegram.WebApp.HapticFeedback;

  if (type === "success" || type === "error" || type === "warning") {
    hf.notificationOccurred(type);
  } else {
    hf.impactOccurred(type);
  }
}
