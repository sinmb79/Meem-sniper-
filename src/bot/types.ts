import { Connection } from "@solana/web3.js";
import { Context } from "telegraf";
import type { AppConfig, PipelineResult, UserSettings } from "../types";
import { CacheService } from "../data/cache";
import { DatabaseService } from "../data/database";
import { FeeCalculator } from "../fees/feeCalculator";
import { FeeStatsService } from "../fees/feeStats";
import { PremiumManager } from "../fees/premiumManager";
import { ReferralManager } from "../fees/referralManager";
import { FilterPipeline } from "../filters/filterPipeline";
import { DexScreenerService } from "../services/dexScreener";
import { PositionManager } from "../trading/positionManager";
import { SellEngine } from "../trading/sellEngine";
import { SniperEngine } from "../trading/sniperEngine";
import { WalletManager } from "./walletManager";

export interface BotSession {
  pendingSettingKey?: keyof UserSettings;
  pendingCustomBuyMint?: string;
}

export type SafeSniperContext = Context & { session: BotSession };

export interface BotDependencies {
  config: AppConfig;
  connection: Connection;
  cache: CacheService;
  database: DatabaseService;
  dexScreener: DexScreenerService;
  filterPipeline: FilterPipeline;
  feeCalculator: FeeCalculator;
  referralManager: ReferralManager;
  premiumManager: PremiumManager;
  feeStats: FeeStatsService;
  sniperEngine: SniperEngine;
  sellEngine: SellEngine;
  positionManager: PositionManager;
  walletManager: WalletManager;
}

export interface CachedAnalysis {
  userId: string;
  pipelineResult: PipelineResult;
}
