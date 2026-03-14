import { PublicKey } from "@solana/web3.js";
import type { StageResult } from "../types";
import type { FilterDependencies } from "./types";

export async function runStage4Developer(
  creatorAddress: string | undefined,
  deps: FilterDependencies
): Promise<StageResult> {
  const reasons: string[] = [];
  const details: Record<string, unknown> = {};

  if (!creatorAddress) {
    return {
      stage: "stage4_developer",
      passed: false,
      score: 0,
      reasons: ["Creator address is unavailable."],
      details
    };
  }

  const publicKey = new PublicKey(creatorAddress);
  const signatures = await deps.connection.getSignaturesForAddress(publicKey, { limit: 100 });
  const balanceLamports = await deps.connection.getBalance(publicKey);

  const oldest = signatures[signatures.length - 1]?.blockTime;
  const ageDays = oldest ? Math.max(0, Math.floor((Date.now() / 1_000 - oldest) / 86_400)) : 0;

  details.transactionCount = signatures.length;
  details.walletAgeDays = ageDays;
  details.balanceSol = balanceLamports / 1_000_000_000;

  let score = 0;

  if (signatures.length >= 50) {
    score += 35;
  } else if (signatures.length >= 10) {
    score += 20;
  } else {
    reasons.push("Creator wallet has a thin transaction history.");
  }

  if (ageDays >= 90) {
    score += 40;
  } else if (ageDays >= 30) {
    score += 25;
  } else {
    reasons.push("Creator wallet is very new.");
  }

  if (balanceLamports / 1_000_000_000 >= 0.5) {
    score += 15;
  }

  const passed = score >= deps.config.filters.minDevTrustScore;
  if (passed && reasons.length === 0) {
    reasons.push("Developer wallet looks established.");
  }

  return {
    stage: "stage4_developer",
    passed,
    score: Math.max(0, Math.min(100, score)),
    reasons,
    details
  };
}
