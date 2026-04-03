#!/usr/bin/env node

/**
 * Setup Telegram Bot Webhook
 * Run this ONCE after deploying to Vercel:
 *   node scripts/setup-webhook.mjs
 *
 * Or with env vars:
 *   TELEGRAM_BOT_TOKEN=xxx CRON_SECRET=yyy NEXT_PUBLIC_WEB_URL=https://your.vercel.app node scripts/setup-webhook.mjs
 */

import "dotenv/config";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL;
const SECRET = process.env.CRON_SECRET;

if (!BOT_TOKEN || !WEB_URL || !SECRET) {
  console.error("Missing required env vars: TELEGRAM_BOT_TOKEN, NEXT_PUBLIC_WEB_URL, CRON_SECRET");
  process.exit(1);
}

const webhookUrl = `${WEB_URL}/api/bot`;
const apiUrl = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function main() {
  // 1. Set webhook
  console.log(`\nSetting webhook to: ${webhookUrl}`);
  const setRes = await fetch(`${apiUrl}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: SECRET,
      allowed_updates: ["message", "chat_member"],
    }),
  });
  const setData = await setRes.json();
  console.log("setWebhook response:", JSON.stringify(setData, null, 2));

  // 2. Verify webhook
  console.log("\nVerifying webhook...");
  const infoRes = await fetch(`${apiUrl}/getWebhookInfo`);
  const infoData = await infoRes.json();
  console.log("getWebhookInfo:", JSON.stringify(infoData.result, null, 2));

  // 3. Get bot info
  const meRes = await fetch(`${apiUrl}/getMe`);
  const meData = await meRes.json();
  console.log(`\nBot: @${meData.result.username} (${meData.result.first_name})`);

  if (setData.ok) {
    console.log("\n✅ Webhook configurado correctamente!");
    console.log(`\nIMPORTANTE: Asegúrate de que el bot es admin del grupo con permisos para:`);
    console.log("  - Invitar usuarios via enlace");
    console.log("  - Banear usuarios");
    console.log("  - Ver miembros del grupo");
  } else {
    console.error("\n❌ Error configurando el webhook:", setData.description);
  }
}

main().catch(console.error);
