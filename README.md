# 🔐 $KELLY Token Gate

Token-gated Telegram group for **$KELLY (KellyClaude)** holders on Base.

Users must hold **50,000,000+ $KELLY** to join and stay in the group. The system periodically re-checks balances and removes members who sell below the threshold.

## How It Works

1. User sends `/start` to the Telegram bot
2. Bot sends a verification link to a web page
3. User connects their wallet (RainbowKit) and signs a message (SIWE)
4. Server verifies the signature and checks $KELLY balance on Base
5. If balance ≥ 50M KELLY → user gets a one-time invite link
6. Every 4 hours, a cron job re-checks all members and kicks anyone below threshold

## Architecture

Everything runs on **Vercel** (serverless):

- **Next.js** web app for the verification UI
- **API routes** for nonce, signature verification, and balance checking
- **Webhook handler** for the Telegram bot (no long-polling)
- **Vercel Cron** for periodic balance re-checks
- **Vercel KV** (Upstash Redis) for storing verified users

## Token Details

| Field | Value |
|-------|-------|
| Name | KellyClaude |
| Symbol | KELLY |
| Chain | Base (8453) |
| Contract | `0x50D2280441372486BeecdD328c1854743EBaCb07` |
| Decimals | 18 |
| Min Balance | 50,000,000 KELLY |

## Setup

### Prerequisites

- Node.js 18+
- Vercel account (free tier works)
- Telegram bot (from @BotFather)
- WalletConnect project ID (free at [cloud.walletconnect.com](https://cloud.walletconnect.com))

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USER/kelly-token-gate.git
cd kelly-token-gate
npm install
```

### 2. Create Telegram Bot

If you haven't already:
1. Open @BotFather on Telegram
2. `/newbot` → follow prompts
3. Save the bot token

### 3. Get Chat ID

Add the bot to your group, then:
```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates"
```
Look for `"chat":{"id":-100XXXXXXXXXX}` — that negative number is your chat ID.

### 4. Configure Vercel KV

1. Go to your Vercel project → Storage → Create → KV (Upstash)
2. The `KV_REST_API_URL` and `KV_REST_API_TOKEN` env vars are set automatically

### 5. Set Environment Variables

In Vercel dashboard → Settings → Environment Variables, add:

| Variable | Value |
|----------|-------|
| `TELEGRAM_BOT_TOKEN` | Your bot token from BotFather |
| `TELEGRAM_CHAT_ID` | Your group's numeric ID (negative) |
| `KELLY_TOKEN_ADDRESS` | `0x50D2280441372486BeecdD328c1854743EBaCb07` |
| `KELLY_MIN_BALANCE` | `50000000000000000000000000` |
| `BASE_RPC_URL` | Your Ankr/Alchemy Base RPC URL |
| `NONCE_SECRET` | Random 32+ char string |
| `CRON_SECRET` | Random 32+ char string |
| `NEXT_PUBLIC_WEB_URL` | `https://your-project.vercel.app` |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | From WalletConnect Cloud |

Generate secrets:
```bash
openssl rand -hex 32
```

### 6. Deploy to Vercel

```bash
npm i -g vercel
vercel
# Follow prompts, link to your GitHub repo
```

### 7. Setup Bot Webhook

After deploying, run:
```bash
npm run setup-webhook
```

Or manually:
```bash
TELEGRAM_BOT_TOKEN=xxx CRON_SECRET=yyy NEXT_PUBLIC_WEB_URL=https://your.vercel.app node scripts/setup-webhook.mjs
```

### 8. Configure Bot Permissions

In your Telegram group:
1. Add the bot as **admin**
2. Give it permissions:
   - ✅ Invite users via link
   - ✅ Ban users
   - ✅ See messages (optional, for commands in group)

## Changing the Minimum Balance

Update the `KELLY_MIN_BALANCE` environment variable in Vercel. The value is in wei (18 decimals):

| Human Amount | Wei Value |
|-------------|-----------|
| 10,000,000 | `10000000000000000000000000` |
| 25,000,000 | `25000000000000000000000000` |
| 50,000,000 | `50000000000000000000000000` |
| 100,000,000 | `100000000000000000000000000` |

Also update `MIN_BALANCE_DISPLAY` in `lib/config.ts` for the UI text.

## Security

- Wallet verification uses **SIWE (Sign-In with Ethereum)** — no private keys ever touch the server
- Nonces are HMAC-signed with a 10-minute expiry to prevent replay attacks
- The cron endpoint and bot webhook are protected by secret tokens
- All code is open source for community audit

## License

MIT
