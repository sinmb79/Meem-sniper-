import type { ProStatus } from "../types";
import { AppConfig } from "../types";
import { DatabaseService } from "../data/database";

export class PremiumManager {
  constructor(
    private readonly database: DatabaseService,
    private readonly config: AppConfig
  ) {}

  isPro(userId: string): boolean {
    return this.database.getProStatus(userId).active;
  }

  getStatus(userId: string): ProStatus {
    return this.database.getProStatus(userId);
  }

  activate(userId: string, txHash?: string): ProStatus {
    const endDate = new Date(Date.now() + this.config.fees.proDurationDays * 86_400_000).toISOString();
    this.database.activatePro(userId, endDate, txHash);
    return this.database.getProStatus(userId);
  }

  getUpgradeInstructions(): { feeWallet?: string; priceSol: number; durationDays: number } {
    return {
      feeWallet: this.config.fees.feeWalletPublicKey,
      priceSol: this.config.fees.proPriceSol,
      durationDays: this.config.fees.proDurationDays
    };
  }
}
