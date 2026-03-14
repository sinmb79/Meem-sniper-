import { Telegraf } from "telegraf";
import { buildPositionsKeyboard } from "../keyboards";
import { formatPositions, formatTradeResult } from "../formatter";
import { getUserId, replyOrEdit } from "../helpers";
import type { BotDependencies, SafeSniperContext } from "../types";

async function showPositions(ctx: SafeSniperContext, deps: BotDependencies): Promise<void> {
  const userId = getUserId(ctx);
  if (!userId) {
    return;
  }

  const settings = deps.database.getUserSettings(userId);
  const positions = await deps.positionManager.getActiveWithMarket(userId);
  await replyOrEdit(ctx, formatPositions(positions, settings.maxPositions), buildPositionsKeyboard(positions));
}

export function registerSellHandler(bot: Telegraf<SafeSniperContext>, deps: BotDependencies): void {
  bot.command("positions", async (ctx) => {
    await showPositions(ctx, deps);
  });

  bot.command("sell", async (ctx) => {
    const [, mintAddress, pct] = ctx.message.text.trim().split(/\s+/);
    const userId = getUserId(ctx);
    if (!userId || !mintAddress || !pct) {
      await ctx.reply("Usage: /sell <mint-address> <percentage>");
      return;
    }

    const result = await deps.sellEngine.sell({
      userId,
      mintAddress,
      percentage: Number(pct),
      tradeType: "manual_sell",
      reason: "manual command"
    });
    await ctx.reply(formatTradeResult(result));
  });

  bot.action("menu_positions", async (ctx) => {
    await ctx.answerCbQuery();
    await showPositions(ctx, deps);
  });

  bot.action("refresh_positions", async (ctx) => {
    await ctx.answerCbQuery();
    await showPositions(ctx, deps);
  });

  bot.action(/^sell\|([^|]+)\|(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const userId = getUserId(ctx);
    const mintAddress = ctx.match[1];
    if (!userId || !mintAddress) {
      return;
    }

    const percentage = Number(ctx.match[2]);
    const result = await deps.sellEngine.sell({
      userId,
      mintAddress,
      percentage,
      tradeType: "manual_sell",
      reason: "inline sell"
    });
    await ctx.reply(formatTradeResult(result));
  });
}
