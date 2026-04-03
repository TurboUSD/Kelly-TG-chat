import { NextRequest, NextResponse } from "next/server";
import { config, MIN_BALANCE_DISPLAY } from "@/lib/config";
import { isVerified, getVerifiedUser } from "@/lib/kv-store";
import { sendMessage, sendInviteToUser, kickMember } from "@/lib/telegram";
import { checkBalance } from "@/lib/token";

/**
 * Telegram Bot Webhook Handler
 * Receives all bot updates via webhook (no long-polling needed)
 */
export async function POST(req: NextRequest) {
  // Verify webhook secret from Telegram
  const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");
  if (secretHeader !== config.cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const update = await req.json();

    // Handle commands (private messages to the bot)
    if (update.message) {
      await handleMessage(update.message);
    }

    // Handle chat member updates (someone joins the group)
    if (update.chat_member) {
      await handleChatMember(update.chat_member);
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Bot webhook error:", error);
    return NextResponse.json({ ok: true }); // Always return 200 to Telegram
  }
}

async function handleMessage(message: any) {
  const text = message.text || "";
  const chatId = message.chat.id;
  const userId = message.from.id.toString();
  const chatType = message.chat.type;

  // Only handle private messages (DMs)
  if (chatType !== "private") return;

  if (text.startsWith("/start")) {
    await handleStart(chatId, userId);
  } else if (text.startsWith("/status")) {
    await handleStatus(chatId, userId);
  } else {
    // Default response
    await sendMessage(
      chatId,
      `👋 Hey! I'm the $KELLY Token Gate bot.\n\n` +
        `Commands:\n` +
        `/start — Verify your wallet\n` +
        `/status — Check your verification status`
    );
  }
}

async function handleStart(chatId: number, userId: string) {
  const verifyUrl = `${config.webUrl}/verify?tg=${userId}&chat=${config.chatId}`;

  await sendMessage(
    chatId,
    `🅺 Welcome to the <b>$KELLY Token Gate!</b>\n\n` +
      `To join the holders-only chat, verify you hold $KELLY tokens:\n\n` +
      `👉 ${verifyUrl}\n\n` +
      `Connect your wallet, sign a message, and if you hold $KELLY on Base, you'll get an invite link!`
  );
}

async function handleStatus(chatId: number, userId: string) {
  const user = await getVerifiedUser(userId);

  if (!user) {
    await sendMessage(
      chatId,
      `❌ You're not verified yet.\n\nUse /start to begin verification.`
    );
    return;
  }

  try {
    const { formatted, sufficient } = await checkBalance(user.wallet);
    const shortWallet = `${user.wallet.slice(0, 6)}...${user.wallet.slice(-4)}`;

    if (sufficient) {
      await sendMessage(
        chatId,
        `✅ <b>Status: Verified</b>\n\n` +
          `Wallet: <code>${shortWallet}</code>\n` +
          `Balance: <b>${Number(formatted).toLocaleString()} $KELLY</b>\n` +
          `Minimum: ${MIN_BALANCE_DISPLAY} $KELLY\n\n` +
          `You're all good! 🎉`
      );
    } else {
      await sendMessage(
        chatId,
        `⚠️ <b>Warning: Insufficient balance</b>\n\n` +
          `Wallet: <code>${shortWallet}</code>\n` +
          `Balance: <b>${Number(formatted).toLocaleString()} $KELLY</b>\n` +
          `Minimum: ${MIN_BALANCE_DISPLAY} $KELLY\n\n` +
          `Your balance is below the minimum. You may be removed in the next recheck.`
      );
    }
  } catch (error) {
    await sendMessage(chatId, `Error al consultar tu saldo. Intenta de nuevo.`);
  }
}

async function handleChatMember(chatMember: any) {
  const newStatus = chatMember.new_chat_member?.status;
  const userId = chatMember.new_chat_member?.user?.id?.toString();

  // Only care about users joining the group
  if (!userId || newStatus !== "member") return;

  // Check if this user is verified
  const verified = await isVerified(userId);

  if (!verified) {
    // Kick unverified users immediately
    await kickMember(userId);
    await sendMessage(
      userId,
      `🚫 You're not verified for this group.\n\n` +
        `You need at least ${MIN_BALANCE_DISPLAY} $KELLY on Base.\n` +
        `Use /start to verify your wallet.`
    );
  }
}
