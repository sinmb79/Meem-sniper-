import { message } from "telegraf/filters";
import { session, Telegraf } from "telegraf";
import { logger } from "../utils/logger";
import { isAllowedUser, getUserId } from "./helpers";
import type { BotDependencies, SafeSniperContext } from "./types";
import { registerBuyHandler, handleMintInput, handlePendingCustomBuy } from "./handlers/buyHandler";
import { registerSellHandler } from "./handlers/sellHandler";
import { registerSettingsHandler, handlePendingSettingInput } from "./handlers/settingsHandler";
import { registerSniperHandler } from "./handlers/sniperHandler";
import { registerStartHandler } from "./handlers/startHandler";
import { registerStatsHandler } from "./handlers/statsHandler";
import { registerWalletHandler } from "./handlers/walletHandler";

export function createBot(deps: BotDependencies): Telegraf<SafeSniperContext> {
  const bot = new Telegraf<SafeSniperContext>(deps.config.bot.token);

  bot.use(session({ defaultSession: () => ({}) }));

  bot.use(async (ctx, next) => {
    const userId = getUserId(ctx);
    if (!userId) {
      return;
    }

    if (!isAllowedUser(ctx, deps.config.bot.allowedUserIds)) {
      await ctx.reply("This bot is restricted.");
      return;
    }

    deps.database.ensureUser(userId);
    deps.walletManager.getOrCreateWallet(userId);
    await next();
  });

  registerStartHandler(bot, deps);
  registerBuyHandler(bot, deps);
  registerSellHandler(bot, deps);
  registerSettingsHandler(bot, deps);
  registerWalletHandler(bot, deps);
  registerSniperHandler(bot, deps);
  registerStatsHandler(bot, deps);

  bot.on(message("text"), async (ctx) => {
    if (ctx.message.text.startsWith("/")) {
      return;
    }

    if (await handlePendingSettingInput(ctx, deps)) {
      return;
    }

    if (await handlePendingCustomBuy(ctx, deps)) {
      return;
    }

    await handleMintInput(ctx, deps);
  });

  bot.catch((error) => {
    logger.error("Bot runtime error.", { error: String(error) });
  });

  return bot;
}
