import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type {
  PipelineResult,
  PositionRecord,
  ProStatus,
  ReferralStats,
  SniperDailyStats,
  TokenCandidate,
  TokenMarketSnapshot,
  TradeRecord,
  UserSettings,
  WalletRecord
} from "../types";
import { buildDefaultStrategy } from "../config/strategy";

type JsonValue = unknown;

function nowIso(): string {
  return new Date().toISOString();
}

function dayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function stringifyJson(value?: JsonValue): string | null {
  return value ? JSON.stringify(value) : null;
}

function parseJson<T>(value: string | null): T | undefined {
  return value ? (JSON.parse(value) as T) : undefined;
}

export class DatabaseService {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.initialize();
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS wallets (
        user_id TEXT PRIMARY KEY,
        public_key TEXT NOT NULL,
        encrypted_secret_key TEXT NOT NULL,
        iv TEXT NOT NULL,
        auth_tag TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS settings (
        user_id TEXT PRIMARY KEY,
        buy_amount_sol REAL NOT NULL,
        stop_loss_pct REAL NOT NULL,
        take_profit_1_pct REAL NOT NULL,
        take_profit_1_sell_pct REAL NOT NULL,
        take_profit_2_pct REAL NOT NULL,
        take_profit_2_sell_pct REAL NOT NULL,
        time_limit_minutes REAL NOT NULL,
        slippage REAL NOT NULL,
        priority_fee_microlamports INTEGER NOT NULL,
        mev_enabled INTEGER NOT NULL,
        min_score REAL NOT NULL,
        max_positions INTEGER NOT NULL,
        mode TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tokens (
        mint_address TEXT PRIMARY KEY,
        symbol TEXT,
        name TEXT,
        creator TEXT,
        platform TEXT NOT NULL,
        tx_signature TEXT,
        detected_at TEXT NOT NULL,
        total_score REAL,
        approved INTEGER NOT NULL DEFAULT 0,
        analysis_json TEXT,
        market_json TEXT,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS positions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        mint_address TEXT NOT NULL,
        symbol TEXT,
        name TEXT,
        quantity REAL NOT NULL,
        invested_sol REAL NOT NULL,
        entry_price_usd REAL,
        current_price_usd REAL,
        buy_tx TEXT,
        sell_tx TEXT,
        opened_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        closed_at TEXT,
        realized_pnl_sol REAL,
        realized_pnl_pct REAL,
        status TEXT NOT NULL,
        metadata_json TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_positions_user_status ON positions(user_id, status);

      CREATE TABLE IF NOT EXISTS trades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        mint_address TEXT NOT NULL,
        symbol TEXT,
        side TEXT NOT NULL,
        trade_type TEXT NOT NULL,
        amount_sol REAL NOT NULL,
        fee_sol REAL NOT NULL,
        fee_rate REAL NOT NULL,
        net_amount_sol REAL NOT NULL,
        price_usd REAL,
        tx_hash TEXT,
        total_score REAL,
        pnl_sol REAL,
        pnl_pct REAL,
        created_at TEXT NOT NULL,
        metadata_json TEXT
      );

      CREATE TABLE IF NOT EXISTS referrals (
        user_id TEXT PRIMARY KEY,
        referrer_id TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS pending_rewards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        referrer_id TEXT NOT NULL,
        referred_user_id TEXT NOT NULL,
        amount_sol REAL NOT NULL,
        created_at TEXT NOT NULL,
        paid_at TEXT
      );

      CREATE TABLE IF NOT EXISTS premium_subscriptions (
        user_id TEXT PRIMARY KEY,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        tx_hash TEXT
      );

      CREATE TABLE IF NOT EXISTS fee_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        mint_address TEXT,
        trade_type TEXT NOT NULL,
        fee_rate REAL NOT NULL,
        fee_sol REAL NOT NULL,
        referrer_id TEXT,
        reward_sol REAL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sniper_daily_stats (
        user_id TEXT NOT NULL,
        date TEXT NOT NULL,
        detected_count INTEGER NOT NULL DEFAULT 0,
        approved_count INTEGER NOT NULL DEFAULT 0,
        bought_count INTEGER NOT NULL DEFAULT 0,
        rejected_count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, date)
      );
    `);
  }

  ensureUser(userId: string): void {
    const timestamp = nowIso();
    this.db
      .prepare(`
        INSERT INTO users (user_id, created_at, last_seen_at)
        VALUES (@userId, @createdAt, @lastSeenAt)
        ON CONFLICT(user_id) DO UPDATE SET last_seen_at = excluded.last_seen_at
      `)
      .run({
        userId,
        createdAt: timestamp,
        lastSeenAt: timestamp
      });
  }

  listUserIds(): string[] {
    const rows = this.db.prepare("SELECT user_id FROM users ORDER BY created_at ASC").all() as Array<{
      user_id: string;
    }>;
    return rows.map((row) => row.user_id);
  }

  getUserSettings(userId: string): UserSettings {
    this.ensureUser(userId);
    const row = this.db.prepare("SELECT * FROM settings WHERE user_id = ?").get(userId) as
      | Record<string, unknown>
      | undefined;

    if (!row) {
      const defaults = buildDefaultStrategy();
      this.updateUserSettings(userId, defaults);
      return defaults;
    }

    return this.mapSettingsRow(row);
  }

  updateUserSettings(userId: string, updates: Partial<UserSettings>): UserSettings {
    this.ensureUser(userId);
    const merged = {
      ...buildDefaultStrategy(),
      ...this.getExistingSettings(userId),
      ...updates
    };

    this.db
      .prepare(`
        INSERT INTO settings (
          user_id, buy_amount_sol, stop_loss_pct, take_profit_1_pct, take_profit_1_sell_pct,
          take_profit_2_pct, take_profit_2_sell_pct, time_limit_minutes, slippage,
          priority_fee_microlamports, mev_enabled, min_score, max_positions, mode
        ) VALUES (
          @userId, @buyAmountSol, @stopLossPct, @takeProfit1Pct, @takeProfit1SellPct,
          @takeProfit2Pct, @takeProfit2SellPct, @timeLimitMinutes, @slippage,
          @priorityFeeMicrolamports, @mevEnabled, @minScore, @maxPositions, @mode
        )
        ON CONFLICT(user_id) DO UPDATE SET
          buy_amount_sol = excluded.buy_amount_sol,
          stop_loss_pct = excluded.stop_loss_pct,
          take_profit_1_pct = excluded.take_profit_1_pct,
          take_profit_1_sell_pct = excluded.take_profit_1_sell_pct,
          take_profit_2_pct = excluded.take_profit_2_pct,
          take_profit_2_sell_pct = excluded.take_profit_2_sell_pct,
          time_limit_minutes = excluded.time_limit_minutes,
          slippage = excluded.slippage,
          priority_fee_microlamports = excluded.priority_fee_microlamports,
          mev_enabled = excluded.mev_enabled,
          min_score = excluded.min_score,
          max_positions = excluded.max_positions,
          mode = excluded.mode
      `)
      .run({
        userId,
        ...merged,
        mevEnabled: merged.mevEnabled ? 1 : 0
      });

    return merged;
  }

  private getExistingSettings(userId: string): Partial<UserSettings> | undefined {
    const row = this.db.prepare("SELECT * FROM settings WHERE user_id = ?").get(userId) as
      | Record<string, unknown>
      | undefined;
    return row ? this.mapSettingsRow(row) : undefined;
  }

  private mapSettingsRow(row: Record<string, unknown>): UserSettings {
    return {
      buyAmountSol: Number(row.buy_amount_sol),
      stopLossPct: Number(row.stop_loss_pct),
      takeProfit1Pct: Number(row.take_profit_1_pct),
      takeProfit1SellPct: Number(row.take_profit_1_sell_pct),
      takeProfit2Pct: Number(row.take_profit_2_pct),
      takeProfit2SellPct: Number(row.take_profit_2_sell_pct),
      timeLimitMinutes: Number(row.time_limit_minutes),
      slippage: Number(row.slippage),
      priorityFeeMicrolamports: Number(row.priority_fee_microlamports),
      mevEnabled: Boolean(row.mev_enabled),
      minScore: Number(row.min_score),
      maxPositions: Number(row.max_positions),
      mode: String(row.mode) as UserSettings["mode"]
    };
  }

  saveWallet(wallet: WalletRecord): void {
    this.ensureUser(wallet.userId);
    this.db
      .prepare(`
        INSERT INTO wallets (user_id, public_key, encrypted_secret_key, iv, auth_tag, created_at)
        VALUES (@userId, @publicKey, @encryptedSecretKey, @iv, @authTag, @createdAt)
        ON CONFLICT(user_id) DO UPDATE SET
          public_key = excluded.public_key,
          encrypted_secret_key = excluded.encrypted_secret_key,
          iv = excluded.iv,
          auth_tag = excluded.auth_tag
      `)
      .run(wallet);
  }

  getWallet(userId: string): WalletRecord | undefined {
    const row = this.db.prepare("SELECT * FROM wallets WHERE user_id = ?").get(userId) as
      | Record<string, unknown>
      | undefined;
    if (!row) {
      return undefined;
    }

    return {
      userId: String(row.user_id),
      publicKey: String(row.public_key),
      encryptedSecretKey: String(row.encrypted_secret_key),
      iv: String(row.iv),
      authTag: String(row.auth_tag),
      createdAt: String(row.created_at)
    };
  }

  saveTokenAnalysis(token: TokenCandidate, pipelineResult: PipelineResult, market?: TokenMarketSnapshot): void {
    this.db
      .prepare(`
        INSERT INTO tokens (
          mint_address, symbol, name, creator, platform, tx_signature, detected_at,
          total_score, approved, analysis_json, market_json, updated_at
        ) VALUES (
          @mintAddress, @symbol, @name, @creator, @platform, @txSignature, @detectedAt,
          @totalScore, @approved, @analysisJson, @marketJson, @updatedAt
        )
        ON CONFLICT(mint_address) DO UPDATE SET
          symbol = excluded.symbol,
          name = excluded.name,
          creator = excluded.creator,
          tx_signature = excluded.tx_signature,
          total_score = excluded.total_score,
          approved = excluded.approved,
          analysis_json = excluded.analysis_json,
          market_json = excluded.market_json,
          updated_at = excluded.updated_at
      `)
      .run({
        mintAddress: token.mintAddress,
        symbol: token.symbol,
        name: token.name,
        creator: token.creator,
        platform: token.platform,
        txSignature: token.txSignature,
        detectedAt: token.detectedAt,
        totalScore: pipelineResult.totalScore,
        approved: pipelineResult.approved ? 1 : 0,
        analysisJson: JSON.stringify(pipelineResult),
        marketJson: stringifyJson(market),
        updatedAt: nowIso()
      });
  }

  openPosition(position: PositionRecord): PositionRecord {
    const result = this.db
      .prepare(`
        INSERT INTO positions (
          user_id, mint_address, symbol, name, quantity, invested_sol, entry_price_usd,
          current_price_usd, buy_tx, sell_tx, opened_at, updated_at, closed_at,
          realized_pnl_sol, realized_pnl_pct, status, metadata_json
        ) VALUES (
          @userId, @mintAddress, @symbol, @name, @quantity, @investedSol, @entryPriceUsd,
          @currentPriceUsd, @buyTx, @sellTx, @openedAt, @updatedAt, @closedAt,
          @realizedPnlSol, @realizedPnlPct, @status, @metadataJson
        )
      `)
      .run({
        ...position,
        metadataJson: stringifyJson(position.metadata)
      });

    return {
      ...position,
      id: Number(result.lastInsertRowid)
    };
  }

  updatePosition(position: PositionRecord): void {
    this.db
      .prepare(`
        UPDATE positions
        SET symbol = @symbol,
            name = @name,
            quantity = @quantity,
            invested_sol = @investedSol,
            entry_price_usd = @entryPriceUsd,
            current_price_usd = @currentPriceUsd,
            buy_tx = @buyTx,
            sell_tx = @sellTx,
            opened_at = @openedAt,
            updated_at = @updatedAt,
            closed_at = @closedAt,
            realized_pnl_sol = @realizedPnlSol,
            realized_pnl_pct = @realizedPnlPct,
            status = @status,
            metadata_json = @metadataJson
        WHERE id = @id
      `)
      .run({
        ...position,
        metadataJson: stringifyJson(position.metadata)
      });
  }

  getActivePositions(userId: string): PositionRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM positions WHERE user_id = ? AND status = 'active' ORDER BY opened_at DESC")
      .all(userId) as Array<Record<string, unknown>>;
    return rows.map((row) => this.mapPosition(row));
  }

  getActivePosition(userId: string, mintAddress: string): PositionRecord | undefined {
    const row = this.db
      .prepare("SELECT * FROM positions WHERE user_id = ? AND mint_address = ? AND status = 'active'")
      .get(userId, mintAddress) as Record<string, unknown> | undefined;
    return row ? this.mapPosition(row) : undefined;
  }

  recordTrade(trade: TradeRecord): TradeRecord {
    const result = this.db
      .prepare(`
        INSERT INTO trades (
          user_id, mint_address, symbol, side, trade_type, amount_sol, fee_sol, fee_rate,
          net_amount_sol, price_usd, tx_hash, total_score, pnl_sol, pnl_pct, created_at,
          metadata_json
        ) VALUES (
          @userId, @mintAddress, @symbol, @side, @tradeType, @amountSol, @feeSol, @feeRate,
          @netAmountSol, @priceUsd, @txHash, @totalScore, @pnlSol, @pnlPct, @createdAt,
          @metadataJson
        )
      `)
      .run({
        ...trade,
        metadataJson: stringifyJson(trade.metadata)
      });

    return {
      ...trade,
      id: Number(result.lastInsertRowid)
    };
  }

  getUserTradeStats(userId: string): { totalPnlSol: number; totalPnlPct: number; trades: number; wins: number } {
    const row = this.db
      .prepare(`
        SELECT
          COUNT(*) AS trades,
          SUM(CASE WHEN pnl_sol > 0 THEN 1 ELSE 0 END) AS wins,
          COALESCE(SUM(pnl_sol), 0) AS total_pnl_sol,
          COALESCE(AVG(pnl_pct), 0) AS total_pnl_pct
        FROM trades
        WHERE user_id = ? AND side = 'sell'
      `)
      .get(userId) as Record<string, unknown>;

    return {
      totalPnlSol: Number(row.total_pnl_sol),
      totalPnlPct: Number(row.total_pnl_pct),
      trades: Number(row.trades),
      wins: Number(row.wins)
    };
  }

  getTodayPnl(userId: string): { pnlSol: number; pnlPct: number } {
    const dateStart = `${dayKey()}T00:00:00.000Z`;
    const row = this.db
      .prepare(`
        SELECT
          COALESCE(SUM(pnl_sol), 0) AS pnl_sol,
          COALESCE(AVG(pnl_pct), 0) AS pnl_pct
        FROM trades
        WHERE user_id = ? AND side = 'sell' AND created_at >= ?
      `)
      .get(userId, dateStart) as Record<string, unknown>;

    return {
      pnlSol: Number(row.pnl_sol),
      pnlPct: Number(row.pnl_pct)
    };
  }

  upsertSniperDailyStats(userId: string, updates: Partial<Omit<SniperDailyStats, "date">>): SniperDailyStats {
    this.ensureUser(userId);
    const date = dayKey();
    this.db
      .prepare(`
        INSERT INTO sniper_daily_stats (user_id, date, detected_count, approved_count, bought_count, rejected_count)
        VALUES (@userId, @date, @detectedCount, @approvedCount, @boughtCount, @rejectedCount)
        ON CONFLICT(user_id, date) DO UPDATE SET
          detected_count = detected_count + @detectedCount,
          approved_count = approved_count + @approvedCount,
          bought_count = bought_count + @boughtCount,
          rejected_count = rejected_count + @rejectedCount
      `)
      .run({
        userId,
        date,
        detectedCount: updates.detectedCount ?? 0,
        approvedCount: updates.approvedCount ?? 0,
        boughtCount: updates.boughtCount ?? 0,
        rejectedCount: updates.rejectedCount ?? 0
      });

    return this.getSniperDailyStats(userId);
  }

  getSniperDailyStats(userId: string): SniperDailyStats {
    const row = this.db
      .prepare("SELECT * FROM sniper_daily_stats WHERE user_id = ? AND date = ?")
      .get(userId, dayKey()) as Record<string, unknown> | undefined;

    if (!row) {
      return {
        date: dayKey(),
        detectedCount: 0,
        approvedCount: 0,
        boughtCount: 0,
        rejectedCount: 0
      };
    }

    return {
      date: String(row.date),
      detectedCount: Number(row.detected_count),
      approvedCount: Number(row.approved_count),
      boughtCount: Number(row.bought_count),
      rejectedCount: Number(row.rejected_count)
    };
  }

  registerReferral(userId: string, referrerId: string): void {
    if (userId === referrerId) {
      return;
    }
    this.db
      .prepare(`
        INSERT OR IGNORE INTO referrals (user_id, referrer_id, created_at)
        VALUES (?, ?, ?)
      `)
      .run(userId, referrerId, nowIso());
  }

  getReferrerId(userId: string): string | undefined {
    const row = this.db
      .prepare("SELECT referrer_id FROM referrals WHERE user_id = ?")
      .get(userId) as { referrer_id: string } | undefined;
    return row?.referrer_id;
  }

  hasReferrer(userId: string): boolean {
    return Boolean(this.getReferrerId(userId));
  }

  addPendingReward(referrerId: string, referredUserId: string, amountSol: number): void {
    this.db
      .prepare(`
        INSERT INTO pending_rewards (referrer_id, referred_user_id, amount_sol, created_at)
        VALUES (?, ?, ?, ?)
      `)
      .run(referrerId, referredUserId, amountSol, nowIso());
  }

  getReferralStats(userId: string): ReferralStats {
    const referralCount = this.db
      .prepare("SELECT COUNT(*) AS total FROM referrals WHERE referrer_id = ?")
      .get(userId) as { total: number };

    const rewardRow = this.db
      .prepare(`
        SELECT
          COALESCE(SUM(CASE WHEN paid_at IS NULL THEN amount_sol ELSE 0 END), 0) AS pending,
          COALESCE(SUM(CASE WHEN paid_at IS NOT NULL THEN amount_sol ELSE 0 END), 0) AS paid
        FROM pending_rewards
        WHERE referrer_id = ?
      `)
      .get(userId) as { pending: number; paid: number };

    return {
      userId,
      referrerId: this.getReferrerId(userId),
      referralCount: Number(referralCount.total),
      totalEarnedSol: Number(rewardRow.paid),
      pendingRewardsSol: Number(rewardRow.pending)
    };
  }

  markRewardsPaid(referrerId: string): number {
    const amountRow = this.db
      .prepare(`
        SELECT COALESCE(SUM(amount_sol), 0) AS total
        FROM pending_rewards
        WHERE referrer_id = ? AND paid_at IS NULL
      `)
      .get(referrerId) as { total: number };

    this.db
      .prepare("UPDATE pending_rewards SET paid_at = ? WHERE referrer_id = ? AND paid_at IS NULL")
      .run(nowIso(), referrerId);

    return Number(amountRow.total);
  }

  activatePro(userId: string, endDate: string, txHash?: string): void {
    const startDate = nowIso();
    this.db
      .prepare(`
        INSERT INTO premium_subscriptions (user_id, start_date, end_date, tx_hash)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          start_date = excluded.start_date,
          end_date = excluded.end_date,
          tx_hash = excluded.tx_hash
      `)
      .run(userId, startDate, endDate, txHash ?? null);
  }

  getProStatus(userId: string): ProStatus {
    const row = this.db
      .prepare("SELECT * FROM premium_subscriptions WHERE user_id = ?")
      .get(userId) as Record<string, unknown> | undefined;

    if (!row) {
      return { active: false };
    }

    const endDate = String(row.end_date);
    return {
      active: new Date(endDate).getTime() > Date.now(),
      startDate: String(row.start_date),
      endDate,
      txHash: row.tx_hash ? String(row.tx_hash) : undefined
    };
  }

  recordFeeLog(entry: {
    userId: string;
    mintAddress?: string;
    tradeType: string;
    feeRate: number;
    feeSol: number;
    referrerId?: string;
    rewardSol?: number;
  }): void {
    this.db
      .prepare(`
        INSERT INTO fee_logs (user_id, mint_address, trade_type, fee_rate, fee_sol, referrer_id, reward_sol, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        entry.userId,
        entry.mintAddress ?? null,
        entry.tradeType,
        entry.feeRate,
        entry.feeSol,
        entry.referrerId ?? null,
        entry.rewardSol ?? null,
        nowIso()
      );
  }

  getFeeStats(period: "today" | "month" | "all"): { feeSol: number; trades: number; activeUsers: number } {
    let whereClause = "";
    let args: Array<string | number> = [];

    if (period === "today") {
      whereClause = "WHERE created_at >= ?";
      args = [`${dayKey()}T00:00:00.000Z`];
    } else if (period === "month") {
      const monthStart = `${new Date().toISOString().slice(0, 7)}-01T00:00:00.000Z`;
      whereClause = "WHERE created_at >= ?";
      args = [monthStart];
    }

    const row = this.db
      .prepare(`
        SELECT
          COALESCE(SUM(fee_sol), 0) AS fee_sol,
          COUNT(*) AS trades,
          COUNT(DISTINCT user_id) AS active_users
        FROM fee_logs
        ${whereClause}
      `)
      .get(...args) as Record<string, unknown>;

    return {
      feeSol: Number(row.fee_sol),
      trades: Number(row.trades),
      activeUsers: Number(row.active_users)
    };
  }

  private mapPosition(row: Record<string, unknown>): PositionRecord {
    return {
      id: Number(row.id),
      userId: String(row.user_id),
      mintAddress: String(row.mint_address),
      symbol: row.symbol ? String(row.symbol) : undefined,
      name: row.name ? String(row.name) : undefined,
      quantity: Number(row.quantity),
      investedSol: Number(row.invested_sol),
      entryPriceUsd: row.entry_price_usd !== null ? Number(row.entry_price_usd) : undefined,
      currentPriceUsd: row.current_price_usd !== null ? Number(row.current_price_usd) : undefined,
      buyTx: row.buy_tx ? String(row.buy_tx) : undefined,
      sellTx: row.sell_tx ? String(row.sell_tx) : undefined,
      openedAt: String(row.opened_at),
      updatedAt: String(row.updated_at),
      closedAt: row.closed_at ? String(row.closed_at) : undefined,
      realizedPnlSol: row.realized_pnl_sol !== null ? Number(row.realized_pnl_sol) : undefined,
      realizedPnlPct: row.realized_pnl_pct !== null ? Number(row.realized_pnl_pct) : undefined,
      status: String(row.status) as PositionRecord["status"],
      metadata: parseJson<Record<string, unknown>>(
        typeof row.metadata_json === "string" ? row.metadata_json : null
      )
    };
  }
}
