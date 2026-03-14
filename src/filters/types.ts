import { Connection } from "@solana/web3.js";
import type { AppConfig, TokenCandidate } from "../types";
import { CacheService } from "../data/cache";
import { DatabaseService } from "../data/database";
import { DexScreenerService } from "../services/dexScreener";

export interface FilterDependencies {
  config: AppConfig;
  connection: Connection;
  database: DatabaseService;
  cache: CacheService;
  dexScreener: DexScreenerService;
}

export interface FilterRunInput {
  token: TokenCandidate;
}
