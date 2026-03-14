import type { StageResult } from "../types";
import type { FilterDependencies } from "./types";

export async function runStage5Concentration(
  deps: FilterDependencies,
  rugDetails?: Record<string, unknown>
): Promise<StageResult> {
  const reasons: string[] = [];
  const details: Record<string, unknown> = {};
  let score = 100;

  const topHolders = Array.isArray((rugDetails?.rugcheck as { topHolders?: unknown[] } | undefined)?.topHolders)
    ? (((rugDetails?.rugcheck as { topHolders?: Array<{ pct?: number }> }).topHolders ?? []) as Array<{
        pct?: number;
      }>)
    : [];
  const top10HolderPct = topHolders.slice(0, 10).reduce((sum, holder) => sum + (holder.pct ?? 0), 0);
  details.top10HolderPct = top10HolderPct;

  if (top10HolderPct > deps.config.filters.maxTop10HolderPct) {
    score -= 35;
    reasons.push(`Top 10 holders exceed limit (${top10HolderPct.toFixed(2)}%).`);
  }

  const defade = (rugDetails?.defade as { bundle_detected?: boolean; whale_detected?: boolean } | undefined) ?? {};
  if (defade.bundle_detected) {
    score -= 25;
    reasons.push("Bundle activity detected.");
  }
  if (defade.whale_detected) {
    score -= 20;
    reasons.push("Whale concentration detected.");
  }

  const passed = score >= deps.config.filters.minConcentrationScore;
  if (passed && reasons.length === 0) {
    reasons.push("Holder distribution looks acceptable.");
  }

  return {
    stage: "stage5_concentration",
    passed,
    score: Math.max(0, Math.min(100, score)),
    reasons,
    details
  };
}
