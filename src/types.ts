export type SniperMode = "AUTO" | "ALERT" | "PAUSE";

export type TradeType =
  | "manual_buy"
  | "manual_sell"
  | "auto_snipe"
  | "auto_tp_sl"
  | "rug_emergency";

export type TradeSide = "buy" | "sell";

export type PositionStatus = "active" | "closed";

export interface AppConfig {
  network: {
    rpcUrl: string;
    wsUrl: string;
    enableTokenListener: boolean;
  };
  bot: {
    token: string;
    allowedUserIds: string[];
  };
  security: {
    encryptionKeyHex: string;
  };
  runtime: {
    dryRun: boolean;
    useJito: boolean;
    sniperMode: SniperMode;
  };
  storage: {
    databasePath: string;
    redisUrl?: string;
  };
  external: {
    rugcheckApiKey?: string;
    defadeApiUrl: string;
    dexScreenerApiUrl: string;
    twitterUsername?: string;
    twitterEmail?: string;
    twitterPassword?: string;
    twitterApiIoKey?: string;
  };
  strategy: UserSettings;
  filters: {
    minRugcheckScore: number;
    minSocialScore: number;
    minDevTrustScore: number;
    minConcentrationScore: number;
    minTotalScore: number;
    maxTop10HolderPct: number;
  };
  fees: {
    feeWalletPublicKey?: string;
    feeWalletPrivateKey?: string;
    manualBuyRate: number;
    manualSellRate: number;
    autoSnipeRate: number;
    autoTpSlRate: number;
    rugEmergencyRate: number;
    referralDiscount: number;
    proRate: number;
    referralRewardPct: number;
    referralRewardPctPro: number;
    proPriceSol: number;
    proDurationDays: number;
    adminUserIds: string[];
  };
  listener: {
    simulatedMintAddress?: string;
  };
}

export interface UserSettings {
  buyAmountSol: number;
  stopLossPct: number;
  takeProfit1Pct: number;
  takeProfit1SellPct: number;
  takeProfit2Pct: number;
  takeProfit2SellPct: number;
  timeLimitMinutes: number;
  slippage: number;
  priorityFeeMicrolamports: number;
  mevEnabled: boolean;
  minScore: number;
  maxPositions: number;
  mode: SniperMode;
}

export interface TokenCandidate {
  mintAddress: string;
  creator?: string;
  txSignature?: string;
  symbol?: string;
  name?: string;
  platform: "pumpfun" | "bonkfun" | "pumpswap" | "manual";
  detectedAt: string;
}

export interface TokenMarketSnapshot {
  pairAddress?: string;
  dexUrl?: string;
  symbol?: string;
  name?: string;
  priceUsd?: number;
  marketCapUsd?: number;
  liquidityUsd?: number;
  volume24hUsd?: number;
  fdvUsd?: number;
  ageMinutes?: number;
  holders?: number;
  socials: Array<{ platform: string; value: string }>;
  websites: string[];
}

export interface StageResult {
  stage: string;
  passed: boolean;
  score?: number;
  reasons: string[];
  details: Record<string, unknown>;
}

export interface PipelineResult {
  approved: boolean;
  totalScore: number;
  token: TokenCandidate;
  market?: TokenMarketSnapshot;
  summary: string;
  stageResults: StageResult[];
}

export interface PositionRecord {
  id?: number;
  userId: string;
  mintAddress: string;
  symbol?: string;
  name?: string;
  quantity: number;
  investedSol: number;
  entryPriceUsd?: number;
  currentPriceUsd?: number;
  buyTx?: string;
  sellTx?: string;
  openedAt: string;
  updatedAt: string;
  closedAt?: string;
  realizedPnlSol?: number;
  realizedPnlPct?: number;
  status: PositionStatus;
  metadata?: Record<string, unknown>;
}

export interface TradeRecord {
  id?: number;
  userId: string;
  mintAddress: string;
  symbol?: string;
  side: TradeSide;
  tradeType: TradeType;
  amountSol: number;
  feeSol: number;
  feeRate: number;
  netAmountSol: number;
  priceUsd?: number;
  txHash?: string;
  totalScore?: number;
  pnlSol?: number;
  pnlPct?: number;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface WalletRecord {
  userId: string;
  publicKey: string;
  encryptedSecretKey: string;
  iv: string;
  authTag: string;
  createdAt: string;
}

export interface FeeQuote {
  feeSol: number;
  netAmountSol: number;
  feeRate: number;
  isPro: boolean;
  hasReferral: boolean;
}

export interface ReferralStats {
  userId: string;
  referrerId?: string;
  referralCount: number;
  totalEarnedSol: number;
  pendingRewardsSol: number;
}

export interface ProStatus {
  active: boolean;
  startDate?: string;
  endDate?: string;
  txHash?: string;
}

export interface UserTradingSnapshot {
  walletAddress?: string;
  balanceSol: number;
  activePositions: number;
  todayPnlSol: number;
  todayPnlPct: number;
  mode: SniperMode;
  feeTier: "FREE" | "PRO";
  effectiveFeeRate: number;
}

export interface SniperDailyStats {
  date: string;
  detectedCount: number;
  approvedCount: number;
  boughtCount: number;
  rejectedCount: number;
}

export interface BuyRequest {
  userId: string;
  token: TokenCandidate;
  amountSol: number;
  tradeType: Extract<TradeType, "manual_buy" | "auto_snipe">;
  pipelineResult?: PipelineResult;
}

export interface SellRequest {
  userId: string;
  mintAddress: string;
  percentage: number;
  tradeType: Extract<TradeType, "manual_sell" | "auto_tp_sl" | "rug_emergency">;
  reason: string;
}

export interface TradeExecutionResult {
  success: boolean;
  txHash?: string;
  message: string;
  trade?: TradeRecord;
  position?: PositionRecord;
}
