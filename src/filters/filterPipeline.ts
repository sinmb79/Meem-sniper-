import type { PipelineResult, StageResult, TokenCandidate } from "../types";
import { calculateTotalScore } from "./scorer";
import { runStage1Onchain } from "./stage1_onchain";
import { runStage2Rugcheck } from "./stage2_rugcheck";
import { runStage3Social } from "./stage3_social";
import { runStage4Developer } from "./stage4_developer";
import { runStage5Concentration } from "./stage5_concentration";
import type { FilterDependencies } from "./types";

export class FilterPipeline {
  constructor(private readonly deps: FilterDependencies) {}

  async run(token: TokenCandidate): Promise<PipelineResult> {
    const stageResults: StageResult[] = [];
    const market = await this.deps.dexScreener.getTokenMarket(token.mintAddress).catch(() => undefined);

    const stage1 = await runStage1Onchain(token.mintAddress, this.deps, market);
    stageResults.push(stage1);
    if (!stage1.passed) {
      return this.finalize(token, market, stageResults, false);
    }

    const stage2 = await runStage2Rugcheck(token.mintAddress, this.deps);
    stageResults.push(stage2);
    if (!stage2.passed) {
      return this.finalize(token, market, stageResults, false);
    }

    const stage3 = await runStage3Social(this.deps, market);
    stageResults.push(stage3);
    if (!stage3.passed) {
      return this.finalize(token, market, stageResults, false);
    }

    const creator =
      token.creator ??
      ((stage2.details.rugcheck as { creator?: string } | undefined)?.creator ?? undefined);
    const stage4 = await runStage4Developer(creator, this.deps);
    stageResults.push(stage4);
    if (!stage4.passed) {
      return this.finalize(token, market, stageResults, false);
    }

    const stage5 = await runStage5Concentration(this.deps, stage2.details);
    stageResults.push(stage5);

    const totalScore = calculateTotalScore(stageResults);
    const approved = stage5.passed && totalScore >= this.deps.config.filters.minTotalScore;

    return this.finalize(token, market, stageResults, approved, totalScore);
  }

  private finalize(
    token: TokenCandidate,
    market: PipelineResult["market"],
    stageResults: StageResult[],
    approved: boolean,
    totalScore = calculateTotalScore(stageResults)
  ): PipelineResult {
    const lastStage = stageResults[stageResults.length - 1];
    const summary = approved
      ? `Approved with total score ${totalScore}.`
      : `Rejected after ${lastStage?.stage ?? "pipeline"} with total score ${totalScore}.`;

    const result: PipelineResult = {
      approved,
      totalScore,
      token: {
        ...token,
        symbol: token.symbol ?? market?.symbol,
        name: token.name ?? market?.name
      },
      market,
      summary,
      stageResults
    };

    this.deps.database.saveTokenAnalysis(result.token, result, market);
    return result;
  }
}
