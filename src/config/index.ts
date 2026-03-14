import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";
import { DEFAULT_DB_PATH, DEFAULT_DEFADE_API_URL, DEFAULT_DEXSCREENER_API_URL } from "./constants";
import { buildDefaultStrategy } from "./strategy";
import type { AppConfig, SniperMode } from "../types";

dotenv.config();

const EnvSchema = z.object({
  SOLANA_RPC_URL: z.string().default("https://api.mainnet-beta.solana.com"),
  SOLANA_WS_URL: z.string().default("wss://api.mainnet-beta.solana.com"),
  TELEGRAM_BOT_TOKEN: z.string().default(""),
  ALLOWED_USER_IDS: z.string().default(""),
  ENCRYPTION_KEY: z.string().default(""),
  PRIVATE_KEY: z.string().optional(),
  FEE_WALLET_PUBLIC_KEY: z.string().optional(),
  FEE_WALLET_PRIVATE_KEY: z.string().optional(),
  SNIPER_MODE: z.enum(["AUTO", "ALERT", "PAUSE"]).default("AUTO"),
  DRY_RUN: z.string().default("true"),
  USE_JITO: z.string().default("false"),
  BUY_AMOUNT_SOL: z.string().default("0.05"),
  SLIPPAGE: z.string().default("0.15"),
  PRIORITY_FEE: z.string().default("200000"),
  TAKE_PROFIT_1_PCT: z.string().default("100"),
  TAKE_PROFIT_1_SELL_PCT: z.string().default("50"),
  TAKE_PROFIT_2_PCT: z.string().default("300"),
  TAKE_PROFIT_2_SELL_PCT: z.string().default("100"),
  STOP_LOSS_PCT: z.string().default("30"),
  TIME_LIMIT_MINUTES: z.string().default("10"),
  MAX_POSITIONS: z.string().default("5"),
  MIN_RUGCHECK_SCORE: z.string().default("70"),
  MIN_SOCIAL_SCORE: z.string().default("40"),
  MIN_DEV_TRUST_SCORE: z.string().default("50"),
  MIN_CONCENTRATION_SCORE: z.string().default("60"),
  MIN_TOTAL_SCORE: z.string().default("65"),
  MAX_TOP10_HOLDER_PCT: z.string().default("30"),
  RUGCHECK_API_KEY: z.string().optional(),
  DEFADE_API_URL: z.string().default(DEFAULT_DEFADE_API_URL),
  DEXSCREENER_API_URL: z.string().default(DEFAULT_DEXSCREENER_API_URL),
  TWITTER_USERNAME: z.string().optional(),
  TWITTER_EMAIL: z.string().optional(),
  TWITTER_PASSWORD: z.string().optional(),
  TWITTERAPI_IO_KEY: z.string().optional(),
  REDIS_URL: z.string().optional(),
  FEE_MANUAL_BUY: z.string().default("0.009"),
  FEE_MANUAL_SELL: z.string().default("0.009"),
  FEE_AUTO_SNIPE: z.string().default("0.01"),
  FEE_AUTO_TP_SL: z.string().default("0.009"),
  FEE_RUG_EMERGENCY: z.string().default("0.005"),
  FEE_REFERRAL_DISCOUNT: z.string().default("0.001"),
  FEE_PRO_RATE: z.string().default("0.005"),
  REFERRAL_REWARD_PCT: z.string().default("0.25"),
  REFERRAL_REWARD_PCT_PRO: z.string().default("0.35"),
  PRO_PRICE_SOL: z.string().default("2"),
  PRO_DURATION_DAYS: z.string().default("30"),
  ADMIN_USER_IDS: z.string().default(""),
  ENABLE_TOKEN_LISTENER: z.string().default("false"),
  SIMULATED_MINT_ADDRESS: z.string().optional(),
  DATABASE_PATH: z.string().optional()
});

const parsed = EnvSchema.parse(process.env);

function parseBoolean(value: string): boolean {
  return value.toLowerCase() === "true";
}

function parseList(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function parseNumber(value: string): number {
  const parsedValue = Number(value);
  if (Number.isNaN(parsedValue)) {
    throw new Error(`Invalid numeric environment value: ${value}`);
  }
  return parsedValue;
}

export const config: AppConfig = {
  network: {
    rpcUrl: parsed.SOLANA_RPC_URL,
    wsUrl: parsed.SOLANA_WS_URL,
    enableTokenListener: parseBoolean(parsed.ENABLE_TOKEN_LISTENER)
  },
  bot: {
    token: parsed.TELEGRAM_BOT_TOKEN,
    allowedUserIds: parseList(parsed.ALLOWED_USER_IDS)
  },
  security: {
    encryptionKeyHex: parsed.ENCRYPTION_KEY
  },
  runtime: {
    dryRun: parseBoolean(parsed.DRY_RUN),
    useJito: parseBoolean(parsed.USE_JITO),
    sniperMode: parsed.SNIPER_MODE as SniperMode
  },
  storage: {
    databasePath: path.resolve(parsed.DATABASE_PATH ?? DEFAULT_DB_PATH),
    redisUrl: parsed.REDIS_URL || undefined
  },
  external: {
    rugcheckApiKey: parsed.RUGCHECK_API_KEY || undefined,
    defadeApiUrl: parsed.DEFADE_API_URL,
    dexScreenerApiUrl: parsed.DEXSCREENER_API_URL,
    twitterUsername: parsed.TWITTER_USERNAME || undefined,
    twitterEmail: parsed.TWITTER_EMAIL || undefined,
    twitterPassword: parsed.TWITTER_PASSWORD || undefined,
    twitterApiIoKey: parsed.TWITTERAPI_IO_KEY || undefined
  },
  strategy: buildDefaultStrategy({
    buyAmountSol: parseNumber(parsed.BUY_AMOUNT_SOL),
    stopLossPct: parseNumber(parsed.STOP_LOSS_PCT),
    takeProfit1Pct: parseNumber(parsed.TAKE_PROFIT_1_PCT),
    takeProfit1SellPct: parseNumber(parsed.TAKE_PROFIT_1_SELL_PCT),
    takeProfit2Pct: parseNumber(parsed.TAKE_PROFIT_2_PCT),
    takeProfit2SellPct: parseNumber(parsed.TAKE_PROFIT_2_SELL_PCT),
    timeLimitMinutes: parseNumber(parsed.TIME_LIMIT_MINUTES),
    slippage: parseNumber(parsed.SLIPPAGE),
    priorityFeeMicrolamports: parseNumber(parsed.PRIORITY_FEE),
    mevEnabled: parseBoolean(parsed.USE_JITO),
    minScore: parseNumber(parsed.MIN_TOTAL_SCORE),
    maxPositions: parseNumber(parsed.MAX_POSITIONS),
    mode: parsed.SNIPER_MODE as SniperMode
  }),
  filters: {
    minRugcheckScore: parseNumber(parsed.MIN_RUGCHECK_SCORE),
    minSocialScore: parseNumber(parsed.MIN_SOCIAL_SCORE),
    minDevTrustScore: parseNumber(parsed.MIN_DEV_TRUST_SCORE),
    minConcentrationScore: parseNumber(parsed.MIN_CONCENTRATION_SCORE),
    minTotalScore: parseNumber(parsed.MIN_TOTAL_SCORE),
    maxTop10HolderPct: parseNumber(parsed.MAX_TOP10_HOLDER_PCT)
  },
  fees: {
    feeWalletPublicKey: parsed.FEE_WALLET_PUBLIC_KEY || undefined,
    feeWalletPrivateKey: parsed.FEE_WALLET_PRIVATE_KEY || undefined,
    manualBuyRate: parseNumber(parsed.FEE_MANUAL_BUY),
    manualSellRate: parseNumber(parsed.FEE_MANUAL_SELL),
    autoSnipeRate: parseNumber(parsed.FEE_AUTO_SNIPE),
    autoTpSlRate: parseNumber(parsed.FEE_AUTO_TP_SL),
    rugEmergencyRate: parseNumber(parsed.FEE_RUG_EMERGENCY),
    referralDiscount: parseNumber(parsed.FEE_REFERRAL_DISCOUNT),
    proRate: parseNumber(parsed.FEE_PRO_RATE),
    referralRewardPct: parseNumber(parsed.REFERRAL_REWARD_PCT),
    referralRewardPctPro: parseNumber(parsed.REFERRAL_REWARD_PCT_PRO),
    proPriceSol: parseNumber(parsed.PRO_PRICE_SOL),
    proDurationDays: parseNumber(parsed.PRO_DURATION_DAYS),
    adminUserIds: parseList(parsed.ADMIN_USER_IDS)
  },
  listener: {
    simulatedMintAddress: parsed.SIMULATED_MINT_ADDRESS || undefined
  }
};

export function assertRuntimeConfig(): void {
  if (!config.bot.token) {
    throw new Error("TELEGRAM_BOT_TOKEN is required to start the bot.");
  }

  if (!config.security.encryptionKeyHex || config.security.encryptionKeyHex.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be a 32-byte hex string.");
  }
}
