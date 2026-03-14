import type { SniperMode, UserSettings } from "../types";

export function buildDefaultStrategy(overrides?: Partial<UserSettings>): UserSettings {
  return {
    buyAmountSol: overrides?.buyAmountSol ?? 0.05,
    stopLossPct: overrides?.stopLossPct ?? 30,
    takeProfit1Pct: overrides?.takeProfit1Pct ?? 100,
    takeProfit1SellPct: overrides?.takeProfit1SellPct ?? 50,
    takeProfit2Pct: overrides?.takeProfit2Pct ?? 300,
    takeProfit2SellPct: overrides?.takeProfit2SellPct ?? 100,
    timeLimitMinutes: overrides?.timeLimitMinutes ?? 10,
    slippage: overrides?.slippage ?? 0.15,
    priorityFeeMicrolamports: overrides?.priorityFeeMicrolamports ?? 200_000,
    mevEnabled: overrides?.mevEnabled ?? false,
    minScore: overrides?.minScore ?? 65,
    maxPositions: overrides?.maxPositions ?? 5,
    mode: overrides?.mode ?? ("AUTO" satisfies SniperMode)
  };
}
