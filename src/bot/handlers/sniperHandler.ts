import { Telegraf } from "telegraf";
import { buildSniperKeyboard } from "../keyboards";
import { formatSniper } from "../formatter";
import { getUserId, replyOrEdit } from "../helpers";
import type { BotDependencies, SafeSniperContext } from "../types";

async function showSniper(ctx: SafeSniperContext, deps: BotDependencies): Promise<void> {
  const userId = getUserId(ctx);
  if (!userId) {
    return;
  }

  const settings = deps.database.getUserSettings(userId);
  const stats = deps.database.getSniperDailyStats(userId);
  await replyOrEdit(ctx, formatSniper(stats, settings.mode), buildSniperKeyboard(settings.mode));
}

export function registerSniperHandler(bot: Telegraf<SafeSniperContext>, deps: BotDependencies): void {
  bot.command("sniper", async (ctx) => {
    await showSniper(ctx, deps);
  });

  bot.action("menu_sniper", async (ctx) => {
    await ctx.answerCbQuery();
    await showSniper(ctx, deps);
  });

  bot.action("sniper_pause", async (ctx) => {
    await ctx.answerCbQuery();
    const userId = getUserId(ctx);
    if (!userId) {
      return;
    }
    deps.database.updateUserSettings(userId, { mode: "PAUSE" });
    await showSniper(ctx, deps);
  });

  bot.action("sniper_resume", async (ctx) => {
    await ctx.answerCbQuery();
    const userId = getUserId(ctx);
    if (!userId) {
      return;
    }
    deps.database.updateUserSettings(userId, { mode: "AUTO" });
    await showSniper(ctx, deps);
  });

  bot.action("sniper_toggle", async (ctx) => {
    await ctx.answerCbQuery();
    const userId = getUserId(ctx);
    if (!userId) {
      return;
    }

    const current = deps.database.getUserSettings(userId);
    const nextMode = current.mode === "AUTO" ? "ALERT" : "AUTO";
    deps.database.updateUserSettings(userId, { mode: nextMode });
    await showSniper(ctx, deps);
  });
}
