import type { AppConfig, PositionRecord } from "../types";
import { DatabaseService } from "../data/database";
import { DexScreenerService } from "../services/dexScreener";

export interface PositionView extends PositionRecord {
  pnlSol: number;
  pnlPct: number;
  currentValueSol: number;
}

export class PositionManager {
  constructor(
    private readonly database: DatabaseService,
    private readonly dexScreener: DexScreenerService,
    private readonly config: AppConfig
  ) {}

  getActive(userId: string): PositionRecord[] {
    return this.database.getActivePositions(userId);
  }

  async getActiveWithMarket(userId: string): Promise<PositionView[]> {
    const positions = this.database.getActivePositions(userId);
    const views: PositionView[] = [];

    for (const position of positions) {
      const market = await this.dexScreener.getTokenMarket(position.mintAddress).catch(() => undefined);
      const currentPriceUsd = market?.priceUsd ?? position.currentPriceUsd ?? position.entryPriceUsd ?? 0;
      const entryPriceUsd = position.entryPriceUsd ?? currentPriceUsd;
      const currentValueSol =
        entryPriceUsd > 0 ? position.investedSol * (currentPriceUsd / entryPriceUsd) : position.investedSol;
      const pnlSol = currentValueSol - position.investedSol;
      const pnlPct = position.investedSol > 0 ? (pnlSol / position.investedSol) * 100 : 0;

      const updated: PositionRecord = {
        ...position,
        currentPriceUsd,
        updatedAt: new Date().toISOString()
      };
      this.database.updatePosition(updated);

      views.push({
        ...updated,
        pnlSol,
        pnlPct,
        currentValueSol
      });
    }

    return views;
  }

  canOpenNewPosition(userId: string): boolean {
    const settings = this.database.getUserSettings(userId);
    const maxPositions = this.config.runtime.dryRun ? settings.maxPositions : settings.maxPositions;
    return this.database.getActivePositions(userId).length < maxPositions;
  }
}
