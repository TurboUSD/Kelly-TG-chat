import { NextRequest, NextResponse } from "next/server";
import { SiweMessage } from "siwe";
import { verifyNonce } from "@/lib/nonce";
import { checkBalance } from "@/lib/token";
import { saveVerifiedUser } from "@/lib/kv-store";
import { sendInviteToUser } from "@/lib/telegram";
import { config, MIN_BALANCE_DISPLAY } from "@/lib/config";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, signature } = body;

    if (!message || !signature) {
      return NextResponse.json(
        { error: "Missing message or signature" },
        { status: 400 }
      );
    }

    // 1. Parse & verify SIWE message
    let siweMessage: SiweMessage;
    try {
      siweMessage = new SiweMessage(message);
    } catch (err: any) {
      console.error("SIWE parse error:", err.message);
      return NextResponse.json(
        { error: "Could not parse sign-in message" },
        { status: 400 }
      );
    }

    let verified;
    try {
      verified = await siweMessage.verify({ signature });
    } catch (err: any) {
      console.error("SIWE verify error:", err.message);
      return NextResponse.json(
        { error: "Invalid signature: " + (err.message || "unknown") },
        { status: 401 }
      );
    }

    if (!verified.success) {
      return NextResponse.json(
        { error: "Signature verification failed" },
        { status: 401 }
      );
    }

    // 2. Verify nonce
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
        { error: `Please connect to Base (chain ${config.chainId}). You're on chain ${siweMessage.chainId}.` },
        { status: 400 }
      );
    }

    const walletAddress = siweMessage.address;
    const { telegramUserId } = nonceData;

    // 4. Check token balance on Base
    let balanceResult;
    try {
      balanceResult = await checkBalance(walletAddress);
    } catch (err: any) {
      console.error("Balance check error:", err.message);
      return NextResponse.json(
        { error: "Could not check token balance. RPC error: " + (err.message || "unknown") },
        { status: 502 }
      );
    }

    const { formatted, sufficient } = balanceResult;

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
    try {
      await saveVerifiedUser(telegramUserId, walletAddress);
    } catch (err: any) {
      console.error("KV store error:", err.message);
      // Don't fail the whole flow if KV has issues — still send invite
    }

    // 6. Send invite link via Telegram
    let inviteSent = false;
    try {
      inviteSent = await sendInviteToUser(telegramUserId);
    } catch (err: any) {
      console.error("Telegram invite error:", err.message);
    }

    return NextResponse.json({
      success: true,
      balance: formatted,
      inviteSent,
      message: inviteSent
        ? "Verified! Check your chat with the bot for the invite link."
        : "Verified! But couldn't send the link. Send /start to the bot to get it.",
    });
  } catch (error: any) {
    console.error("Verify unexpected error:", error.message, error.stack);
    return NextResponse.json(
      { error: "Server error: " + (error.message || "unknown") },
      { status: 500 }
    );
  }
}
