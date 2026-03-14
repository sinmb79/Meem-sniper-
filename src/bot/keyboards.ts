import { Markup } from "telegraf";
import type { UserSettings } from "../types";
import type { PositionView } from "../trading/positionManager";

export function buildMainMenuKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("Buy", "menu_buy"),
      Markup.button.callback("Positions", "menu_positions"),
      Markup.button.callback("Settings", "menu_settings")
    ],
    [
      Markup.button.callback("Wallet", "menu_wallet"),
      Markup.button.callback("Referral", "menu_referral"),
      Markup.button.callback("Sniper", "menu_sniper")
    ],
    [
      Markup.button.callback("Upgrade PRO", "menu_upgrade"),
      Markup.button.callback("Stats", "menu_stats")
    ]
  ]);
}

export function buildAnalysisKeyboard(mintAddress: string) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("0.01 SOL", `buy|0.01|${mintAddress}`),
      Markup.button.callback("0.05 SOL", `buy|0.05|${mintAddress}`),
      Markup.button.callback("0.1 SOL", `buy|0.1|${mintAddress}`)
    ],
    [
      Markup.button.callback("X SOL", `buycustom|${mintAddress}`),
      Markup.button.callback("Full Report", `report|${mintAddress}`)
    ],
    [Markup.button.callback("Back", "menu_home")]
  ]);
}

export function buildPositionsKeyboard(positions: PositionView[]) {
  const rows = positions.flatMap((position) => [
    [Markup.button.callback(`${position.symbol ?? position.mintAddress.slice(0, 4)} 25%`, `sell|${position.mintAddress}|25`)],
    [
      Markup.button.callback("Sell 50%", `sell|${position.mintAddress}|50`),
      Markup.button.callback("Sell 100%", `sell|${position.mintAddress}|100`)
    ]
  ]);

  rows.push([
    Markup.button.callback("Refresh", "refresh_positions"),
    Markup.button.callback("Back", "menu_home")
  ]);

  return Markup.inlineKeyboard(rows);
}

export function buildSettingsKeyboard(_settings: UserSettings) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("Buy Amount", "setting|buyAmountSol"),
      Markup.button.callback("Stop Loss", "setting|stopLossPct")
    ],
    [
      Markup.button.callback("TP1", "setting|takeProfit1Pct"),
      Markup.button.callback("TP1 Sell %", "setting|takeProfit1SellPct")
    ],
    [
      Markup.button.callback("TP2", "setting|takeProfit2Pct"),
      Markup.button.callback("TP2 Sell %", "setting|takeProfit2SellPct")
    ],
    [
      Markup.button.callback("Time Limit", "setting|timeLimitMinutes"),
      Markup.button.callback("Slippage", "setting|slippage")
    ],
    [
      Markup.button.callback("Priority Fee", "setting|priorityFeeMicrolamports"),
      Markup.button.callback("Max Positions", "setting|maxPositions")
    ],
    [
      Markup.button.callback("Min Score", "setting|minScore"),
      Markup.button.callback("Toggle MEV", "setting|mevEnabled")
    ],
    [
      Markup.button.callback("Reset Default", "settings_reset"),
      Markup.button.callback("Back", "menu_home")
    ]
  ]);
}

export function buildWalletKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("Export Key", "wallet_export"),
      Markup.button.callback("Refresh", "menu_wallet")
    ],
    [Markup.button.callback("Back", "menu_home")]
  ]);
}

export function buildSniperKeyboard(mode: UserSettings["mode"]) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(mode === "PAUSE" ? "Resume" : "Pause", mode === "PAUSE" ? "sniper_resume" : "sniper_pause"),
      Markup.button.callback(mode === "AUTO" ? "AUTO -> ALERT" : "ALERT -> AUTO", "sniper_toggle")
    ],
    [Markup.button.callback("Back", "menu_home")]
  ]);
}

export function buildReferralKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Back", "menu_home")]
  ]);
}

export function buildUpgradeKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Back", "menu_home")]
  ]);
}
