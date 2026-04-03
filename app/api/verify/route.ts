import { NextRequest, NextResponse } from "next/server";
import { SiweMessage } from "siwe";
import { verifyNonce } from "@/lib/nonce";
import { checkBalance } from "@/lib/token";
import { saveVerifiedUser, getVerifiedUser } from "@/lib/kv-store";
import { sendInviteToUser } from "@/lib/telegram";
import { config, MIN_BALANCE_DISPLAY } from "@/lib/config";

export async function POST(req: NextRequest) {
  try {
    const { message, signature } = await req.json();

    if (!message || !signature) {
      return NextResponse.json(
        { error: "Missing message or signature" },
        { status: 400 }
      );
    }

    // 1. Parse & verify SIWE message
    const siweMessage = new SiweMessage(message);
    let verified;
    try {
      verified = await siweMessage.verify({ signature });
    } catch (err) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    if (!verified.success) {
      return NextResponse.json(
        { error: "Signature verification failed" },
        { status: 401 }
      );
    }

    // 2. Verify nonce (extracts telegramUserId and chatId)
    const nonceData = verifyNonce(siweMessage.nonce);
    if (!nonceData) {
      return NextResponse.json(
        { error: "Invalid or expired nonce. Please try again." },
        { status: 401 }
      );
    }

    // 3. Verify chain ID matches Base
    if (siweMessage.chainId !== config.chainId) {
      return NextResponse.json(
        { error: `Please connect to Base (chain ${config.chainId})` },
        { status: 400 }
      );
    }

    const walletAddress = siweMessage.address;
    const { telegramUserId, chatId } = nonceData;

    // 4. Check token balance on Base
    const { formatted, sufficient } = await checkBalance(walletAddress);

    if (!sufficient) {
      return NextResponse.json(
        {
          error: `Insufficient balance. You have ${Number(formatted).toLocaleString()} $KELLY, you need at least ${MIN_BALANCE_DISPLAY}.`,
          balance: formatted,
          required: MIN_BALANCE_DISPLAY,
        },
        { status: 403 }
      );
    }

    // 5. Save to KV store
    await saveVerifiedUser(telegramUserId, walletAddress);

    // 6. Send invite link via Telegram
    const inviteSent = await sendInviteToUser(telegramUserId);

    return NextResponse.json({
      success: true,
      balance: formatted,
      inviteSent,
      message: inviteSent
        ? "Verified! Check your chat with the bot for the invite link."
        : "Verified! But couldn't send the link. Send /start to the bot to get it.",
    });
  } catch (error: any) {
    console.error("Verify error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
