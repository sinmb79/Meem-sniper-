import type {
  FeeQuote,
  PipelineResult,
  PositionRecord,
  ProStatus,
  ReferralStats,
  SniperDailyStats,
  TradeExecutionResult,
  UserSettings,
  UserTradingSnapshot
} from "../types";
import type { PositionView } from "../trading/positionManager";
import { formatPercent, formatSol, formatUsd, shortenAddress } from "../utils/format";

export function formatStartMenu(snapshot: UserTradingSnapshot): string {
  return [
    "SafeSniper Bot",
    "",
    `Wallet: ${shortenAddress(snapshot.walletAddress)}`,
    `Balance: ${formatSol(snapshot.balanceSol)}`,
    `Positions: ${snapshot.activePositions} active`,
    `Today PnL: ${formatSol(snapshot.todayPnlSol)} (${formatPercent(snapshot.todayPnlPct)})`,
    "",
    `Sniper: ${snapshot.mode === "PAUSE" ? "PAUSED" : "ON"} | Mode: ${snapshot.mode}`,
    `Fee: ${(snapshot.effectiveFeeRate * 100).toFixed(1)}% | Tier: ${snapshot.feeTier}`
  ].join("\n");
}

export function formatAnalysis(result: PipelineResult, feeQuote: FeeQuote, requestedAmountSol: number): string {
  const stageLines = result.stageResults
    .map((stage) => {
      const icon = stage.passed ? "✅" : "❌";
      const score = stage.score !== undefined ? ` (${stage.score})` : "";
      return `${icon} ${stage.stage}${score}`;
    })
    .join("\n");

  return [
    `Token: ${result.token.symbol ?? "-"} (${result.token.name ?? "Unknown"})`,
    `Mint: ${shortenAddress(result.token.mintAddress, 6, 6)}`,
    "",
    `Price: ${formatUsd(result.market?.priceUsd)} | MC: ${formatUsd(result.market?.marketCapUsd)}`,
    `Liquidity: ${formatUsd(result.market?.liquidityUsd)} | Age: ${result.market?.ageMinutes ?? "-"} min`,
    "",
    `Safety Score: ${result.totalScore}/100 ${result.approved ? "✅" : "❌"}`,
    stageLines,
    "",
    `Fee: ${(feeQuote.feeRate * 100).toFixed(1)}%`,
    `${requestedAmountSol.toFixed(3)} SOL -> Fee ${feeQuote.feeSol.toFixed(5)} SOL`,
    `Net Buy: ${feeQuote.netAmountSol.toFixed(5)} SOL`,
    "",
    result.summary
  ].join("\n");
}

export function formatFullReport(result: PipelineResult): string {
  return [
    `Full Report: ${result.token.symbol ?? shortenAddress(result.token.mintAddress)}`,
    `Approved: ${result.approved ? "YES" : "NO"} | Total: ${result.totalScore}`,
    "",
    ...result.stageResults.flatMap((stage) => [
      `${stage.stage}: ${stage.passed ? "PASS" : "FAIL"}${stage.score !== undefined ? ` (${stage.score})` : ""}`,
      ...stage.reasons.map((reason) => `- ${reason}`)
    ])
  ].join("\n");
}

export function formatPositions(positions: PositionView[], maxPositions: number): string {
  if (positions.length === 0) {
    return `Active Positions (0/${maxPositions})\n\nNo open positions.`;
  }

  return [
    `Active Positions (${positions.length}/${maxPositions})`,
    "",
    ...positions.flatMap((position, index) => [
      `${index + 1}. ${position.symbol ?? shortenAddress(position.mintAddress)} | ${formatPercent(position.pnlPct)} | ${formatSol(position.investedSol)}`,
      `   Buy: ${formatUsd(position.entryPriceUsd)} -> Now: ${formatUsd(position.currentPriceUsd)}`,
      `   PnL: ${formatSol(position.pnlSol)}`
    ])
  ].join("\n");
}

export function formatSettings(settings: UserSettings): string {
  return [
    "Settings",
    "",
    `Buy Amount: ${settings.buyAmountSol} SOL`,
    `Stop Loss: -${settings.stopLossPct}%`,
    `Take Profit 1: +${settings.takeProfit1Pct}% / ${settings.takeProfit1SellPct}% sell`,
    `Take Profit 2: +${settings.takeProfit2Pct}% / ${settings.takeProfit2SellPct}% sell`,
    `Time Limit: ${settings.timeLimitMinutes} min`,
    `Slippage: ${(settings.slippage * 100).toFixed(1)}%`,
    `Priority Fee: ${settings.priorityFeeMicrolamports}`,
    `MEV(Jito): ${settings.mevEnabled ? "ON" : "OFF"}`,
    `Min Score: ${settings.minScore}`,
    `Max Positions: ${settings.maxPositions}`,
    `Mode: ${settings.mode}`
  ].join("\n");
}

export function formatWallet(address: string, balanceSol: number, positions: PositionRecord[]): string {
  const tokenLines =
    positions.length === 0
      ? ["No tracked token positions."]
      : positions.map((position) => `- ${position.symbol ?? shortenAddress(position.mintAddress)}: ${position.quantity.toFixed(4)}`);

  return [
    "Wallet",
    "",
    `Address: ${address}`,
    `Balance: ${formatSol(balanceSol)}`,
    "",
    "Tracked Tokens:",
    ...tokenLines
  ].join("\n");
}

export function formatSniper(stats: SniperDailyStats, mode: UserSettings["mode"]): string {
  return [
    "Sniper Control",
    "",
    `Status: ${mode === "PAUSE" ? "PAUSED" : "ACTIVE"}`,
    `Mode: ${mode}`,
    "",
    "Today:",
    `- Detected: ${stats.detectedCount}`,
    `- Passed Filter: ${stats.approvedCount}`,
    `- Bought: ${stats.boughtCount}`,
    `- Rejected: ${stats.rejectedCount}`
  ].join("\n");
}

export function formatStats(stats: { totalPnlSol: number; totalPnlPct: number; trades: number; wins: number }): string {
  const winRate = stats.trades > 0 ? (stats.wins / stats.trades) * 100 : 0;
  return [
    "Trading Stats",
    "",
    `Closed Trades: ${stats.trades}`,
    `Win Rate: ${formatPercent(winRate)}`,
    `Total PnL: ${formatSol(stats.totalPnlSol)}`,
    `Average PnL: ${formatPercent(stats.totalPnlPct)}`
  ].join("\n");
}

export function formatReferral(stats: ReferralStats, botUsername = "SafeSniperBot"): string {
  return [
    "Referral Program",
    "",
    `Your Link: t.me/${botUsername}?start=ref_${stats.userId}`,
    `Referrals: ${stats.referralCount}`,
    `Total Earned: ${formatSol(stats.totalEarnedSol)}`,
    `Pending Rewards: ${formatSol(stats.pendingRewardsSol)}`
  ].join("\n");
}

export function formatUpgrade(proStatus: ProStatus, priceSol: number, durationDays: number, feeWallet?: string): string {
  return [
    "SafeSniper PRO",
    "",
    `Status: ${proStatus.active ? `ACTIVE until ${proStatus.endDate}` : "FREE tier"}`,
    `Price: ${priceSol} SOL / ${durationDays} days`,
    `Benefits: lower fees, more positions, TURBO mode, detailed reports`,
    "",
    feeWallet ? `Send payment to: ${feeWallet}` : "Fee wallet is not configured yet."
  ].join("\n");
}

export function formatAdminStats(today: { feeSol: number; trades: number; activeUsers: number }, month: { feeSol: number; trades: number; activeUsers: number }, total: { feeSol: number; trades: number; activeUsers: number }): string {
  return [
    "Admin Dashboard",
    "",
    `Today Fees: ${formatSol(today.feeSol)} | Trades: ${today.trades} | Users: ${today.activeUsers}`,
    `Month Fees: ${formatSol(month.feeSol)} | Trades: ${month.trades} | Users: ${month.activeUsers}`,
    `Total Fees: ${formatSol(total.feeSol)} | Trades: ${total.trades} | Users: ${total.activeUsers}`
  ].join("\n");
}

export function formatTradeResult(result: TradeExecutionResult): string {
  if (!result.success) {
    return `Action failed: ${result.message}`;
  }

  return [
    result.message,
    result.txHash ? `TX: ${result.txHash}` : undefined,
    result.trade ? `Amount: ${formatSol(result.trade.netAmountSol)}` : undefined
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatHelp(): string {
  return [
    "/start - main menu",
    "/buy <mint> - analyze and buy",
    "/positions - list active positions",
    "/sell <mint> <pct> - sell part or all of a position",
    "/wallet - wallet summary",
    "/withdraw <amount> <address> - withdraw SOL",
    "/settings - strategy settings",
    "/sniper - sniper mode and counters",
    "/stats - trade stats",
    "/referral - referral stats",
    "/upgrade - PRO upgrade instructions",
    "/pro_status - current PRO status",
    "/admin_stats - fee stats for admins",
    "/export - export private key"
  ].join("\n");
}
