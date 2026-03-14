import type { StageResult } from "../types";
import type { FilterDependencies } from "./types";
import { fetchJson, retry } from "../utils/http";

interface RugCheckReport {
  score?: number | string;
  risks?: Array<{ level?: string; name?: string; description?: string }>;
  topHolders?: Array<{ address?: string; pct?: number }>;
  creator?: string;
  liquidityStatus?: string;
}

interface DeFadeReport {
  bundle_detected?: boolean;
  whale_detected?: boolean;
  risk_score?: number;
}

function normalizeScore(rawScore: number | string | undefined): number {
  if (typeof rawScore === "number") {
    return rawScore;
  }

  const normalized = rawScore?.toLowerCase();
  switch (normalized) {
    case "good":
      return 85;
    case "warning":
      return 55;
    case "danger":
      return 20;
    default:
      return 50;
  }
}

export async function runStage2Rugcheck(
  mintAddress: string,
  deps: FilterDependencies
): Promise<StageResult> {
  const rugcheckUrl = `https://api.rugcheck.xyz/v1/tokens/${mintAddress}/report`;
  const defadeUrl = `${deps.config.external.defadeApiUrl}/${mintAddress}`;

  const [rugcheckResult, defadeResult] = await Promise.allSettled([
    retry(() =>
      fetchJson<RugCheckReport>(
        rugcheckUrl,
        deps.config.external.rugcheckApiKey
          ? {
              headers: {
                Authorization: `Bearer ${deps.config.external.rugcheckApiKey}`
              }
            }
          : undefined
      )
    ),
    retry(() => fetchJson<DeFadeReport>(defadeUrl), 2, 700)
  ]);

  const reasons: string[] = [];
  const details: Record<string, unknown> = {};
  let score = 50;

  if (rugcheckResult.status === "fulfilled") {
    const report = rugcheckResult.value;
    details.rugcheck = report;
    score = normalizeScore(report.score);

    const top10HolderPct = (report.topHolders ?? [])
      .slice(0, 10)
      .reduce((sum, holder) => sum + (holder.pct ?? 0), 0);
    details.top10HolderPct = top10HolderPct;

    if (top10HolderPct < deps.config.filters.maxTop10HolderPct) {
      score += 15;
    } else {
      score -= 20;
      reasons.push(`Top 10 holders own ${top10HolderPct.toFixed(2)}%.`);
    }

    const dangerRisks = (report.risks ?? []).filter((risk) =>
      (risk.level ?? "").toLowerCase().includes("danger")
    );
    if (dangerRisks.length > 0) {
      score -= 30;
      reasons.push(`RugCheck reported ${dangerRisks.length} danger-level risks.`);
    }
  } else {
    reasons.push("RugCheck request failed.");
    details.rugcheckError = String(rugcheckResult.reason);
    score -= 20;
  }

  if (defadeResult.status === "fulfilled") {
    const report = defadeResult.value;
    details.defade = report;
    if (report.bundle_detected) {
      reasons.push("DeFade flagged bundle activity.");
      score -= 15;
    }
    if (report.whale_detected) {
      reasons.push("DeFade flagged whale concentration.");
      score -= 10;
    }
  } else {
    details.defadeError = String(defadeResult.reason);
  }

  const passed = score >= deps.config.filters.minRugcheckScore;
  if (passed && reasons.length === 0) {
    reasons.push("Rug and holder checks passed.");
  }

  return {
    stage: "stage2_rugcheck",
    passed,
    score: Math.max(0, Math.min(100, score)),
    reasons,
    details
  };
}
