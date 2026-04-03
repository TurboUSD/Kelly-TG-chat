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
      `👋 Hola! Soy el bot de verificación de $KELLY.\n\n` +
        `Comandos:\n` +
        `/start — Verificar tu wallet\n` +
        `/status — Comprobar tu estado`
    );
  }
}

async function handleStart(chatId: number, userId: string) {
  const verifyUrl = `${config.webUrl}/verify?tg=${userId}&chat=${config.chatId}`;

  await sendMessage(
    chatId,
    `🔐 <b>Verificación Token Gate — $KELLY</b>\n\n` +
      `Para unirte al grupo necesitas tener mínimo <b>${MIN_BALANCE_DISPLAY} $KELLY</b> en Base.\n\n` +
      `Haz click en el botón para conectar tu wallet y verificar tu saldo:`,
    {
      replyMarkup: {
        inline_keyboard: [
          [{ text: "🔗 Verificar mi wallet", url: verifyUrl }],
        ],
      },
    }
  );
}

async function handleStatus(chatId: number, userId: string) {
  const user = await getVerifiedUser(userId);

  if (!user) {
    await sendMessage(
      chatId,
      `❌ No estás verificado aún.\n\nUsa /start para comenzar la verificación.`
    );
    return;
  }

  try {
    const { formatted, sufficient } = await checkBalance(user.wallet);
    const shortWallet = `${user.wallet.slice(0, 6)}...${user.wallet.slice(-4)}`;

    if (sufficient) {
      await sendMessage(
        chatId,
        `✅ <b>Estado: Verificado</b>\n\n` +
          `Wallet: <code>${shortWallet}</code>\n` +
          `Saldo: <b>${Number(formatted).toLocaleString()} $KELLY</b>\n` +
          `Mínimo: ${MIN_BALANCE_DISPLAY} $KELLY\n\n` +
          `Todo en orden! 🎉`
      );
    } else {
      await sendMessage(
        chatId,
        `⚠️ <b>Atención: Saldo insuficiente</b>\n\n` +
          `Wallet: <code>${shortWallet}</code>\n` +
          `Saldo: <b>${Number(formatted).toLocaleString()} $KELLY</b>\n` +
          `Mínimo: ${MIN_BALANCE_DISPLAY} $KELLY\n\n` +
          `Tu saldo ha bajado del mínimo. Podrías ser removido en la próxima revisión.`
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
      `🚫 No estás verificado para este grupo.\n\n` +
        `Necesitas tener mínimo ${MIN_BALANCE_DISPLAY} $KELLY.\n` +
        `Usa /start para verificar tu wallet.`
    );
  }
}
