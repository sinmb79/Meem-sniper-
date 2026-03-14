import { Telegraf } from "telegraf";
import { buildReferralKeyboard, buildUpgradeKeyboard } from "../keyboards";
import { formatAdminStats, formatReferral, formatStats, formatUpgrade } from "../formatter";
import { getUserId, replyOrEdit } from "../helpers";
import type { BotDependencies, SafeSniperContext } from "../types";

async function showStats(ctx: SafeSniperContext, deps: BotDependencies): Promise<void> {
  const userId = getUserId(ctx);
  if (!userId) {
    return;
  }

  const stats = deps.database.getUserTradeStats(userId);
  await replyOrEdit(ctx, formatStats(stats));
}

async function showReferral(ctx: SafeSniperContext, deps: BotDependencies): Promise<void> {
  const userId = getUserId(ctx);
  if (!userId) {
    return;
  }

  const stats = deps.referralManager.getReferralStats(userId);
  const botUsername = ctx.botInfo?.username ?? "SafeSniperBot";
  await replyOrEdit(ctx, formatReferral(stats, botUsername), buildReferralKeyboard());
}

async function showUpgrade(ctx: SafeSniperContext, deps: BotDependencies): Promise<void> {
  const userId = getUserId(ctx);
  if (!userId) {
    return;
  }

  const proStatus = deps.premiumManager.getStatus(userId);
  const instructions = deps.premiumManager.getUpgradeInstructions();
  await replyOrEdit(
    ctx,
    formatUpgrade(proStatus, instructions.priceSol, instructions.durationDays, instructions.feeWallet),
    buildUpgradeKeyboard()
  );
}

export function registerStatsHandler(bot: Telegraf<SafeSniperContext>, deps: BotDependencies): void {
  bot.command("stats", async (ctx) => {
    await showStats(ctx, deps);
  });

  bot.command("referral", async (ctx) => {
    await showReferral(ctx, deps);
  });

  bot.command("upgrade", async (ctx) => {
    await showUpgrade(ctx, deps);
  });

  bot.command("pro_status", async (ctx) => {
    await showUpgrade(ctx, deps);
  });

  bot.command("admin_stats", async (ctx) => {
    const userId = getUserId(ctx);
    if (!userId || !deps.feeStats.isAdmin(userId)) {
      await ctx.reply("Admin only.");
      return;
    }

    await ctx.reply(
      formatAdminStats(
        deps.feeStats.getTodayFees(),
        deps.feeStats.getMonthlyFees(),
        deps.feeStats.getTotalFees()
      )
    );
  });

  bot.action("menu_stats", async (ctx) => {
    await ctx.answerCbQuery();
    await showStats(ctx, deps);
  });

  bot.action("menu_referral", async (ctx) => {
    await ctx.answerCbQuery();
    await showReferral(ctx, deps);
  });

  bot.action("menu_upgrade", async (ctx) => {
    await ctx.answerCbQuery();
    await showUpgrade(ctx, deps);
  });
}
