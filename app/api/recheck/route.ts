import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { getAllVerifiedUsers, removeVerifiedUser } from "@/lib/kv-store";
import { hasMinBalance } from "@/lib/token";
import { kickMember, notifyKicked } from "@/lib/telegram";

/**
 * Periodic balance re-check (Vercel Cron every 4 hours)
 * Kicks users who no longer hold enough $KELLY
 */
export async function GET(req: NextRequest) {
  // Verify cron secret (Vercel sends this automatically)
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${config.cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await getAllVerifiedUsers();
  const results = {
    checked: 0,
    kicked: [] as string[],
    ok: [] as string[],
    skipped: [] as string[],
    errors: [] as string[],
  };

  for (const [telegramId, user] of Object.entries(users)) {
    results.checked++;

    // Skip users whitelisted via invite link (no real wallet to check)
    if (user.wallet === "invited-via-link") {
      results.skipped.push(telegramId);
      continue;
    }

    try {
      const sufficient = await hasMinBalance(user.wallet);

      if (!sufficient) {
        // Kick from group
        await kickMember(telegramId);
        // Remove from KV store
        await removeVerifiedUser(telegramId);
        // Notify user
        await notifyKicked(telegramId);
        results.kicked.push(telegramId);
      } else {
        results.ok.push(telegramId);
      }
    } catch (err: any) {
      results.errors.push(`${telegramId}: ${err.message}`);
    }

    // Rate limit: 100ms between RPC calls
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(
    `Recheck complete: ${results.checked} checked, ${results.kicked.length} kicked, ${results.skipped.length} skipped (invite-link), ${results.errors.length} errors`
  );

  return NextResponse.json(results);
}
