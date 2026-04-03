import crypto from "crypto";
import { config } from "./config";

const NONCE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

interface NoncePayload {
  tg: string;
  chat: string;
  ts: number;
  r: string;
}

/**
 * Create an HMAC-signed nonce that embeds the Telegram user ID and chat ID.
 * Format: base64url(json) + "." + hmac_signature
 */
export function createNonce(telegramUserId: string, chatId: string): string {
  const payload: NoncePayload = {
    tg: telegramUserId,
    chat: chatId,
    ts: Date.now(),
    r: crypto.randomBytes(16).toString("hex"),
  };

  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const hmac = crypto
    .createHmac("sha256", config.nonceSecret)
    .update(data)
    .digest("hex")
    .slice(0, 16);

  return `${data}.${hmac}`;
}

/**
 * Verify a nonce and extract the payload.
 * Returns null if invalid or expired.
 */
export function verifyNonce(
  nonce: string
): { telegramUserId: string; chatId: string } | null {
  try {
    const [data, hmac] = nonce.split(".");
    if (!data || !hmac) return null;

    // Verify HMAC
    const expectedHmac = crypto
      .createHmac("sha256", config.nonceSecret)
      .update(data)
      .digest("hex")
      .slice(0, 16);

    if (hmac !== expectedHmac) return null;

    // Decode payload
    const payload: NoncePayload = JSON.parse(
      Buffer.from(data, "base64url").toString("utf-8")
    );

    // Check expiry
    if (Date.now() - payload.ts > NONCE_EXPIRY_MS) return null;

    return {
      telegramUserId: payload.tg,
      chatId: payload.chat,
    };
  } catch {
    return null;
  }
}
