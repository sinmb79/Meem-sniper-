import { Telegraf } from "telegraf";
import { buildDefaultStrategy } from "../../config/strategy";
import type { UserSettings } from "../../types";
import { buildSettingsKeyboard } from "../keyboards";
import { formatSettings } from "../formatter";
import { getUserId, replyOrEdit } from "../helpers";
import type { BotDependencies, SafeSniperContext } from "../types";

const numericKeys: Array<keyof UserSettings> = [
  "buyAmountSol",
  "stopLossPct",
  "takeProfit1Pct",
  "takeProfit1SellPct",
  "takeProfit2Pct",
  "takeProfit2SellPct",
  "timeLimitMinutes",
  "slippage",
  "priorityFeeMicrolamports",
  "minScore",
  "maxPositions"
];

export async function showSettings(ctx: SafeSniperContext, deps: BotDependencies): Promise<void> {
  const userId = getUserId(ctx);
  if (!userId) {
    return;
  }

  const settings = deps.database.getUserSettings(userId);
  await replyOrEdit(ctx, formatSettings(settings), buildSettingsKeyboard(settings));
}

export async function handlePendingSettingInput(
  ctx: SafeSniperContext,
  deps: BotDependencies
): Promise<boolean> {
  const key = ctx.session.pendingSettingKey;
  const userId = getUserId(ctx);
  if (!key || !userId || !ctx.message || !("text" in ctx.message)) {
    return false;
  }

  ctx.session.pendingSettingKey = undefined;
  const raw = (ctx.message?.text ?? "").trim();
  if (!numericKeys.includes(key)) {
    await ctx.reply("Unsupported setting.");
    return true;
  }

  const value = Number(raw);
  if (!Number.isFinite(value)) {
    await ctx.reply("Enter a numeric value.");
    return true;
  }

  deps.database.updateUserSettings(userId, { [key]: value } as Partial<UserSettings>);
  await ctx.reply(`Updated ${key} to ${value}.`);
  return true;
}

export function registerSettingsHandler(bot: Telegraf<SafeSniperContext>, deps: BotDependencies): void {
  bot.command("settings", async (ctx) => {
    await showSettings(ctx, deps);
  });

  bot.action("menu_settings", async (ctx) => {
    await ctx.answerCbQuery();
    await showSettings(ctx, deps);
  });

  bot.action("settings_reset", async (ctx) => {
    await ctx.answerCbQuery();
    const userId = getUserId(ctx);
    if (!userId) {
      return;
    }

    deps.database.updateUserSettings(userId, buildDefaultStrategy());
    await showSettings(ctx, deps);
  });

  bot.action(/^setting\|(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const userId = getUserId(ctx);
    const key = ctx.match[1] as keyof UserSettings;
    if (!userId) {
      return;
    }

    if (key === "mevEnabled") {
      const current = deps.database.getUserSettings(userId);
      deps.database.updateUserSettings(userId, { mevEnabled: !current.mevEnabled });
      await showSettings(ctx, deps);
      return;
    }

    ctx.session.pendingSettingKey = key;
    await ctx.reply(`Enter a new value for ${key}.`);
  });
}
