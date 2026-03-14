import type { AppConfig, SellRequest, TradeExecutionResult } from "../types";
import { DatabaseService } from "../data/database";
import { FeeCalculator } from "../fees/feeCalculator";
import { TxBuilder } from "./txBuilder";
import { PositionManager } from "./positionManager";

export class SellEngine {
  constructor(
    private readonly config: AppConfig,
    private readonly database: DatabaseService,
    private readonly feeCalculator: FeeCalculator,
    private readonly positionManager: PositionManager,
    private readonly txBuilder: TxBuilder
  ) {}

  async sell(request: SellRequest): Promise<TradeExecutionResult> {
    const position = this.database.getActivePosition(request.userId, request.mintAddress);
    if (!position) {
      return {
        success: false,
        message: "No active position found for that mint."
      };
    }

    const marketPosition = (await this.positionManager.getActiveWithMarket(request.userId)).find(
      (item) => item.mintAddress === request.mintAddress
    );
    const sellFraction = Math.max(0.01, Math.min(1, request.percentage / 100));
    const grossAmountSol = (marketPosition?.currentValueSol ?? position.investedSol) * sellFraction;
    const feeQuote = this.feeCalculator.calculate(request.userId, request.tradeType, grossAmountSol);
    const execution = await this.txBuilder.executeSell();
    const createdAt = new Date().toISOString();

    const pnlSol = (marketPosition?.pnlSol ?? 0) * sellFraction - feeQuote.feeSol;
    const pnlPct = marketPosition?.pnlPct ?? 0;

    const trade = this.database.recordTrade({
      userId: request.userId,
      mintAddress: position.mintAddress,
      symbol: position.symbol,
      side: "sell",
      tradeType: request.tradeType,
      amountSol: grossAmountSol,
      feeSol: feeQuote.feeSol,
      feeRate: feeQuote.feeRate,
      netAmountSol: feeQuote.netAmountSol,
      priceUsd: position.currentPriceUsd,
      txHash: execution.txHash,
      pnlSol,
      pnlPct,
      createdAt,
      metadata: {
        reason: request.reason,
        percentage: request.percentage
      }
    });

    const remainingFraction = 1 - sellFraction;
    if (remainingFraction <= 0.0001) {
      this.database.updatePosition({
        ...position,
        quantity: 0,
        investedSol: 0,
        sellTx: execution.txHash,
        updatedAt: createdAt,
        closedAt: createdAt,
        realizedPnlSol: pnlSol,
        realizedPnlPct: pnlPct,
        status: "closed"
      });
    } else {
      this.database.updatePosition({
        ...position,
        quantity: position.quantity * remainingFraction,
        investedSol: position.investedSol * remainingFraction,
        updatedAt: createdAt,
        realizedPnlSol: (position.realizedPnlSol ?? 0) + pnlSol,
        realizedPnlPct: pnlPct
      });
    }

    this.database.recordFeeLog({
      userId: request.userId,
      mintAddress: request.mintAddress,
      tradeType: request.tradeType,
      feeRate: feeQuote.feeRate,
      feeSol: feeQuote.feeSol
    });

    return {
      success: true,
      txHash: execution.txHash,
      message: execution.message,
      trade
    };
  }
}
