import { PublicKey } from "@solana/web3.js";
import { getMint } from "@solana/spl-token";
import type { StageResult, TokenMarketSnapshot } from "../types";
import type { FilterDependencies } from "./types";

export async function runStage1Onchain(
  mintAddress: string,
  deps: FilterDependencies,
  market?: TokenMarketSnapshot
): Promise<StageResult> {
  const reasons: string[] = [];
  const details: Record<string, unknown> = {};

  try {
    const mint = await getMint(deps.connection, new PublicKey(mintAddress));
    details.supply = mint.supply.toString();
    details.decimals = mint.decimals;
    details.mintAuthority = mint.mintAuthority?.toBase58() ?? null;
    details.freezeAuthority = mint.freezeAuthority?.toBase58() ?? null;

    if (mint.mintAuthority !== null) {
      reasons.push("Mint authority is still active.");
    }

    if (mint.freezeAuthority !== null) {
      reasons.push("Freeze authority is still active.");
    }
  } catch (error) {
    reasons.push("Failed to fetch mint info.");
    details.error = String(error);
  }

  if (!market?.symbol && !market?.name) {
    reasons.push("Token metadata is limited; symbol/name unavailable from market source.");
  }

  return {
    stage: "stage1_onchain",
    passed: reasons.filter((reason) => reason.includes("active") || reason.includes("Failed")).length === 0,
    score: reasons.length === 0 ? 100 : 0,
    reasons: reasons.length === 0 ? ["On-chain gate passed."] : reasons,
    details
  };
}
