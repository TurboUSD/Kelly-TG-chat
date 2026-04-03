import { kv } from "@vercel/kv";

const VERIFIED_USERS_KEY = "verified-users";

export interface VerifiedUser {
  wallet: string;
  verifiedAt: number;
}

/**
 * Save a verified user mapping: telegramId → wallet
 */
export async function saveVerifiedUser(
  telegramId: string,
  wallet: string
): Promise<void> {
  const user: VerifiedUser = {
    wallet: wallet.toLowerCase(),
    verifiedAt: Date.now(),
  };
  await kv.hset(VERIFIED_USERS_KEY, { [telegramId]: JSON.stringify(user) });
}

/**
 * Get a single verified user by Telegram ID
 */
export async function getVerifiedUser(
  telegramId: string
): Promise<VerifiedUser | null> {
  const raw = await kv.hget<string>(VERIFIED_USERS_KEY, telegramId);
  if (!raw) return null;
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

/**
 * Get all verified users
 */
export async function getAllVerifiedUsers(): Promise<
  Record<string, VerifiedUser>
> {
  const raw = await kv.hgetall<Record<string, string>>(VERIFIED_USERS_KEY);
  if (!raw) return {};

  const users: Record<string, VerifiedUser> = {};
  for (const [tgId, value] of Object.entries(raw)) {
    try {
      users[tgId] = typeof value === "string" ? JSON.parse(value) : value;
    } catch {
      // Skip malformed entries
    }
  }
  return users;
}

/**
 * Remove a verified user (after they sold tokens)
 */
export async function removeVerifiedUser(telegramId: string): Promise<void> {
  await kv.hdel(VERIFIED_USERS_KEY, telegramId);
}

/**
 * Check if a Telegram user is verified
 */
export async function isVerified(telegramId: string): Promise<boolean> {
  const user = await getVerifiedUser(telegramId);
  return user !== null;
}
