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
 * Create a SIWE-compatible nonce (alphanumeric only, >8 chars).
 * Format: hex(json_payload) + hex(hmac_8_bytes)
 * All hex = all alphanumeric — passes SIWE validation.
 */
export function createNonce(telegramUserId: string, chatId: string): string {
  const payload: NoncePayload = {
    tg: telegramUserId,
    chat: chatId,
    ts: Date.now(),
    r: crypto.randomBytes(8).toString("hex"),
  };

  const data = Buffer.from(JSON.stringify(payload)).toString("hex");
  const hmac = crypto
    .createHmac("sha256", config.nonceSecret)
    .update(data)
    .digest("hex")
    .slice(0, 16); // 16 hex chars = 8 bytes

  // Pure hex string — no dots, no base64, fully alphanumeric
  return `${data}${hmac}`;
}

/**
 * Verify a nonce and extract the Telegram payload.
 * Returns null if invalid or expired.
 */
export function verifyNonce(
  nonce: string
): { telegramUserId: string; chatId: string } | null {
  try {
    if (!nonce || nonce.length < 32) return null;

    // Last 16 chars are the HMAC, everything before is the hex payload
    const hmac = nonce.slice(-16);
    const data = nonce.slice(0, -16);

    // Verify HMAC
    const expectedHmac = crypto
      .createHmac("sha256", config.nonceSecret)
      .update(data)
      .digest("hex")
      .slice(0, 16);

    if (hmac !== expectedHmac) return null;

    // Decode payload
    const payload: NoncePayload = JSON.parse(
      Buffer.from(data, "hex").toString("utf-8")
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
