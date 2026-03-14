import { Telegraf } from "telegraf";
import { buildMainMenuKeyboard } from "../keyboards";
import { formatHelp, formatStartMenu } from "../formatter";
import { getUserId, replyOrEdit } from "../helpers";
import type { BotDependencies, SafeSniperContext } from "../types";

async function buildSnapshot(ctx: SafeSniperContext, deps: BotDependencies, userId: string) {
  const settings = deps.database.getUserSettings(userId);
  const walletAddress = deps.walletManager.getPublicKey(userId);
  const balanceSol = await deps.walletManager.getBalance(userId).catch(() => 0);
  const activePositions = deps.database.getActivePositions(userId).length;
  const todayPnl = deps.database.getTodayPnl(userId);
  const feeQuote = deps.feeCalculator.calculate(userId, "manual_buy", settings.buyAmountSol);
  const feeTier = deps.premiumManager.isPro(userId) ? "PRO" : "FREE";

  return {
    walletAddress,
    balanceSol,
    activePositions,
    todayPnlSol: todayPnl.pnlSol,
    todayPnlPct: todayPnl.pnlPct,
    mode: settings.mode,
    feeTier,
    effectiveFeeRate: feeQuote.feeRate
  } as const;
}

export async function showHomeMenu(ctx: SafeSniperContext, deps: BotDependencies): Promise<void> {
  const userId = getUserId(ctx);
  if (!userId) {
    return;
  }

  const snapshot = await buildSnapshot(ctx, deps, userId);
  await replyOrEdit(ctx, formatStartMenu(snapshot), buildMainMenuKeyboard());
}

export function registerStartHandler(bot: Telegraf<SafeSniperContext>, deps: BotDependencies): void {
  bot.start(async (ctx) => {
    const userId = getUserId(ctx);
    if (!userId) {
      return;
    }

    const payload = ctx.message.text.split(" ").slice(1).join(" ").trim();
    if (payload.startsWith("ref_")) {
      deps.referralManager.registerReferral(userId, payload.replace(/^ref_/, ""));
    }

    await showHomeMenu(ctx, deps);
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(formatHelp());
  });

  bot.action("menu_home", async (ctx) => {
    await ctx.answerCbQuery();
    await showHomeMenu(ctx, deps);
  });
}
