const BOT_URL = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

interface InlineButton {
  text: string;
  callback_data: string;
}

export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  buttons?: InlineButton[][]
) {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
  };

  if (buttons) {
    body.reply_markup = { inline_keyboard: buttons };
  }

  const res = await fetch(`${BOT_URL}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error("Telegram sendMessage error:", await res.text());
    return null;
  }

  const data = await res.json();
  return data.result;
}

export async function editTelegramMessage(
  chatId: string | number,
  messageId: number,
  text: string,
  buttons?: InlineButton[][] | null
) {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
  };

  if (buttons) {
    body.reply_markup = { inline_keyboard: buttons };
  } else if (buttons === null) {
    body.reply_markup = { inline_keyboard: [] };
  }

  const res = await fetch(`${BOT_URL}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error("Telegram editMessageText error:", await res.text());
  }
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  await fetch(`${BOT_URL}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
    }),
  });
}
