import { Telegraf } from "telegraf";
import { buildWalletKeyboard } from "../keyboards";
import { formatWallet } from "../formatter";
import { getUserId, replyOrEdit } from "../helpers";
import type { BotDependencies, SafeSniperContext } from "../types";

async function showWallet(ctx: SafeSniperContext, deps: BotDependencies): Promise<void> {
  const userId = getUserId(ctx);
  if (!userId) {
    return;
  }

  const address = deps.walletManager.getPublicKey(userId);
  const balanceSol = await deps.walletManager.getBalance(userId).catch(() => 0);
  const positions = deps.database.getActivePositions(userId);

  await replyOrEdit(ctx, formatWallet(address, balanceSol, positions), buildWalletKeyboard());
}

export function registerWalletHandler(bot: Telegraf<SafeSniperContext>, deps: BotDependencies): void {
  bot.command("wallet", async (ctx) => {
    await showWallet(ctx, deps);
  });

  bot.command("export", async (ctx) => {
    const userId = getUserId(ctx);
    if (!userId || !ctx.chat) {
      return;
    }

    const exportedKey = deps.walletManager.exportPrivateKey(userId);
    const sent = await ctx.reply(
      `Warning: this private key message will be deleted after 30 seconds.\n\n${exportedKey}`
    );
    setTimeout(() => {
      void ctx.telegram.deleteMessage(ctx.chat!.id, sent.message_id).catch(() => undefined);
    }, 30_000).unref();
  });

  bot.command("withdraw", async (ctx) => {
    const [, amountRaw, toAddress] = ctx.message.text.trim().split(/\s+/);
    const userId = getUserId(ctx);
    if (!userId || !amountRaw || !toAddress) {
      await ctx.reply("Usage: /withdraw <amount-sol> <to-address>");
      return;
    }

    const amountSol = Number(amountRaw);
    if (!Number.isFinite(amountSol) || amountSol <= 0) {
      await ctx.reply("Enter a valid SOL amount.");
      return;
    }

    const result = await deps.walletManager.withdraw(userId, amountSol, toAddress);
    await ctx.reply(
      result.dryRun
        ? `DRY_RUN withdraw simulated.\nTX: ${result.txHash}`
        : `Withdraw sent.\nTX: ${result.txHash}`
    );
  });

  bot.action("menu_wallet", async (ctx) => {
    await ctx.answerCbQuery();
    await showWallet(ctx, deps);
  });

  bot.action("wallet_export", async (ctx) => {
    await ctx.answerCbQuery();
    const userId = getUserId(ctx);
    if (!userId || !ctx.chat) {
      return;
    }

    const exportedKey = deps.walletManager.exportPrivateKey(userId);
    const sent = await ctx.reply(
      `Warning: this private key message will be deleted after 30 seconds.\n\n${exportedKey}`
    );
    setTimeout(() => {
      void ctx.telegram.deleteMessage(ctx.chat!.id, sent.message_id).catch(() => undefined);
    }, 30_000).unref();
  });
}
