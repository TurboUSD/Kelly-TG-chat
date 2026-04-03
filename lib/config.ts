// Kelly Token Gate Configuration
// All values from environment variables

export const config = {
  // Token
  tokenAddress: process.env.KELLY_TOKEN_ADDRESS || "0x50D2280441372486BeecdD328c1854743EBaCb07",
  // 50M KELLY with 18 decimals
  minBalance: BigInt(process.env.KELLY_MIN_BALANCE || "50000000000000000000000000"),
  tokenSymbol: "KELLY",
  tokenName: "KellyClaude",
  tokenDecimals: 18,

  // Chain
  chainId: 8453, // Base
  rpcUrl: process.env.BASE_RPC_URL || "https://mainnet.base.org",

  // Telegram
  botToken: process.env.TELEGRAM_BOT_TOKEN || "",
  chatId: process.env.TELEGRAM_CHAT_ID || "",

  // Security
  nonceSecret: process.env.NONCE_SECRET || "",
  cronSecret: process.env.CRON_SECRET || "",

  // Web
  webUrl: process.env.NEXT_PUBLIC_WEB_URL || "",

  // Vercel KV
  kvRestApiUrl: process.env.KV_REST_API_URL || "",
  kvRestApiToken: process.env.KV_REST_API_TOKEN || "",
};

// Human-readable minimum balance (50,000,000)
export const MIN_BALANCE_DISPLAY = "50,000,000";
