import type { StageResult } from "../types";

export function calculateTotalScore(stageResults: StageResult[]): number {
  const stageMap = new Map(stageResults.map((stage) => [stage.stage, stage]));
  const stage2 = stageMap.get("stage2_rugcheck")?.score ?? 0;
  const stage3 = stageMap.get("stage3_social")?.score ?? 0;
  const stage4 = stageMap.get("stage4_developer")?.score ?? 0;
  const stage5 = stageMap.get("stage5_concentration")?.score ?? 0;

  return Math.round(stage2 * 0.3 + stage3 * 0.2 + stage4 * 0.25 + stage5 * 0.25);
}
