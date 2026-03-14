import { AppConfig } from "../types";
import { DatabaseService } from "../data/database";

export class FeeStatsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly config: AppConfig
  ) {}

  isAdmin(userId: string): boolean {
    return this.config.fees.adminUserIds.includes(userId);
  }

  getTodayFees(): { feeSol: number; trades: number; activeUsers: number } {
    return this.database.getFeeStats("today");
  }

  getMonthlyFees(): { feeSol: number; trades: number; activeUsers: number } {
    return this.database.getFeeStats("month");
  }

  getTotalFees(): { feeSol: number; trades: number; activeUsers: number } {
    return this.database.getFeeStats("all");
  }
}
