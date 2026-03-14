import { BUY_RATE_LIMIT_PER_MINUTE } from "../config/constants";
import type { AppConfig, BuyRequest, TradeExecutionResult, TradeRecord } from "../types";
import { DatabaseService } from "../data/database";
import { FeeCalculator } from "../fees/feeCalculator";
import { ReferralManager } from "../fees/referralManager";
import { PositionManager } from "./positionManager";
import { TxBuilder } from "./txBuilder";

export class SniperEngine {
  private readonly buyWindow = new Map<string, number[]>();

  constructor(
    private readonly config: AppConfig,
    private readonly database: DatabaseService,
    private readonly feeCalculator: FeeCalculator,
    private readonly referralManager: ReferralManager,
    private readonly positionManager: PositionManager,
    private readonly txBuilder: TxBuilder
  ) {}

  async buy(request: BuyRequest): Promise<TradeExecutionResult> {
    this.database.ensureUser(request.userId);

    if (!this.positionManager.canOpenNewPosition(request.userId)) {
      return {
        success: false,
        message: "Maximum active positions reached."
      };
    }

    if (request.pipelineResult && !request.pipelineResult.approved) {
      return {
        success: false,
        message: "Token was rejected by the safety pipeline."
      };
    }

    if (!this.allowBuy(request.userId)) {
      return {
        success: false,
        message: "Buy rate limit exceeded. Try again in a minute."
      };
    }

    const feeQuote = this.feeCalculator.calculate(request.userId, request.tradeType, request.amountSol);
    const execution = await this.txBuilder.executeBuy();
    const priceUsd = request.pipelineResult?.market?.priceUsd;
    const quantity = priceUsd && priceUsd > 0 ? feeQuote.netAmountSol / priceUsd : feeQuote.netAmountSol;
    const createdAt = new Date().toISOString();

    const trade: TradeRecord = this.database.recordTrade({
      userId: request.userId,
      mintAddress: request.token.mintAddress,
      symbol: request.token.symbol ?? request.pipelineResult?.market?.symbol,
      side: "buy",
      tradeType: request.tradeType,
      amountSol: request.amountSol,
      feeSol: feeQuote.feeSol,
      feeRate: feeQuote.feeRate,
      netAmountSol: feeQuote.netAmountSol,
      priceUsd,
      txHash: execution.txHash,
      totalScore: request.pipelineResult?.totalScore,
      createdAt,
      metadata: {
        mode: this.config.runtime.sniperMode,
        stageResults: request.pipelineResult?.stageResults
      }
    });

    const position = this.database.openPosition({
      userId: request.userId,
      mintAddress: request.token.mintAddress,
      symbol: request.token.symbol ?? request.pipelineResult?.market?.symbol,
      name: request.token.name ?? request.pipelineResult?.market?.name,
      quantity,
      investedSol: feeQuote.netAmountSol,
      entryPriceUsd: priceUsd,
      currentPriceUsd: priceUsd,
      buyTx: execution.txHash,
      openedAt: createdAt,
      updatedAt: createdAt,
      status: "active",
      metadata: {
        source: request.tradeType,
        totalScore: request.pipelineResult?.totalScore
      }
    });

    const referrerId = this.referralManager.getReferrerId(request.userId);
    if (referrerId) {
      const rewardSol =
        feeQuote.feeSol *
        (feeQuote.isPro ? this.config.fees.referralRewardPctPro : this.config.fees.referralRewardPct);
      this.referralManager.addPendingReward(referrerId, request.userId, rewardSol);
      this.database.recordFeeLog({
        userId: request.userId,
        mintAddress: request.token.mintAddress,
        tradeType: request.tradeType,
        feeRate: feeQuote.feeRate,
        feeSol: feeQuote.feeSol,
        referrerId,
        rewardSol
      });
    } else {
      this.database.recordFeeLog({
        userId: request.userId,
        mintAddress: request.token.mintAddress,
        tradeType: request.tradeType,
        feeRate: feeQuote.feeRate,
        feeSol: feeQuote.feeSol
      });
    }

    this.database.upsertSniperDailyStats(request.userId, { boughtCount: 1 });

    return {
      success: true,
      txHash: execution.txHash,
      message: execution.message,
      trade,
      position
    };
  }

  private allowBuy(userId: string): boolean {
    const now = Date.now();
    const windowStart = now - 60_000;
    const existing = (this.buyWindow.get(userId) ?? []).filter((timestamp) => timestamp >= windowStart);
    if (existing.length >= BUY_RATE_LIMIT_PER_MINUTE) {
      this.buyWindow.set(userId, existing);
      return false;
    }

    existing.push(now);
    this.buyWindow.set(userId, existing);
    return true;
  }
}
