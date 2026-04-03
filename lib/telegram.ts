import { config } from "./config";

const API_BASE = `https://api.telegram.org/bot${config.botToken}`;

interface TelegramResponse {
  ok: boolean;
  result?: any;
  description?: string;
}

async function callTelegram(
  method: string,
  body: Record<string, any>
): Promise<TelegramResponse> {
  const res = await fetch(`${API_BASE}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

/**
 * Send a text message to a user or chat
 */
export async function sendMessage(
  chatId: string | number,
  text: string,
  options: { parseMode?: "HTML" | "Markdown"; replyMarkup?: any } = {}
): Promise<TelegramResponse> {
  return callTelegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: options.parseMode || "HTML",
    ...(options.replyMarkup && { reply_markup: options.replyMarkup }),
  });
}

/**
 * Create a one-time invite link for the gated group
 */
export async function createInviteLink(): Promise<string | null> {
  const res = await callTelegram("createChatInviteLink", {
    chat_id: config.chatId,
    member_limit: 1, // One-time use
    name: `kelly-gate-${Date.now()}`,
  });

  if (res.ok && res.result?.invite_link) {
    return res.result.invite_link;
  }
  return null;
}

/**
 * Kick (ban then unban) a user from the gated group
 */
export async function kickMember(userId: string | number): Promise<boolean> {
  // Ban for 60 seconds (effectively a kick)
  const banRes = await callTelegram("banChatMember", {
    chat_id: config.chatId,
    user_id: userId,
    until_date: Math.floor(Date.now() / 1000) + 60,
  });

  return banRes.ok;
}

/**
 * Send invite link to a verified user
 */
export async function sendInviteToUser(telegramId: string): Promise<boolean> {
  const inviteLink = await createInviteLink();
  if (!inviteLink) return false;

  const res = await sendMessage(
    telegramId,
    `✅ <b>Verificación exitosa!</b>\n\n` +
      `Tu wallet tiene suficiente $KELLY.\n\n` +
      `Usa este enlace para unirte al grupo (un solo uso):`,
    {
      replyMarkup: {
        inline_keyboard: [
          [{ text: "🚀 Unirse al grupo", url: inviteLink }],
        ],
      },
    }
  );

  return res.ok;
}

/**
 * Notify a user they've been removed for insufficient balance
 */
export async function notifyKicked(telegramId: string): Promise<void> {
  await sendMessage(
    telegramId,
    `⚠️ <b>Has sido removido del grupo</b>\n\n` +
      `Tu saldo de $KELLY ha bajado del mínimo requerido (50M tokens).\n\n` +
      `Compra más $KELLY y vuelve a verificar cuando quieras con /start`
  );
}

/**
 * Get info about the bot itself
 */
export async function getMe(): Promise<any> {
  const res = await callTelegram("getMe", {});
  return res.result;
}

/**
 * Set the webhook URL for the bot
 */
export async function setWebhook(url: string, secret: string): Promise<TelegramResponse> {
  return callTelegram("setWebhook", {
    url,
    secret_token: secret,
    allowed_updates: ["message", "chat_member"],
  });
}

/**
 * Get current webhook info
 */
export async function getWebhookInfo(): Promise<TelegramResponse> {
  const res = await fetch(`${API_BASE}/getWebhookInfo`);
  return res.json();
}
