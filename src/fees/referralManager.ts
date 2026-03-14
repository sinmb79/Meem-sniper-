import type { ReferralStats } from "../types";
import { DatabaseService } from "../data/database";

export class ReferralManager {
  constructor(private readonly database: DatabaseService) {}

  registerReferral(userId: string, referrerId: string): void {
    this.database.registerReferral(userId, referrerId);
  }

  hasReferrer(userId: string): boolean {
    return this.database.hasReferrer(userId);
  }

  getReferrerId(userId: string): string | undefined {
    return this.database.getReferrerId(userId);
  }

  getReferralCount(userId: string): number {
    return this.database.getReferralStats(userId).referralCount;
  }

  calculateReward(feeSol: number, isPro: boolean, rewardPct: number, rewardPctPro: number): number {
    const rate = isPro ? rewardPctPro : rewardPct;
    return feeSol * rate;
  }

  addPendingReward(referrerId: string, referredUserId: string, amountSol: number): void {
    this.database.addPendingReward(referrerId, referredUserId, amountSol);
  }

  getReferralStats(userId: string): ReferralStats {
    return this.database.getReferralStats(userId);
  }
}
