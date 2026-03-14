import { Telegraf } from "telegraf";
import type { PipelineResult, TokenCandidate } from "../../types";
import { buildAnalysisKeyboard } from "../keyboards";
import { formatAnalysis, formatFullReport, formatTradeResult } from "../formatter";
import { getUserId, isSolanaAddress, replyOrEdit } from "../helpers";
import type { BotDependencies, CachedAnalysis, SafeSniperContext } from "../types";

function analysisCacheKey(userId: string, mintAddress: string): string {
  return `analysis:${userId}:${mintAddress}`;
}

async function getCachedAnalysis(
  deps: BotDependencies,
  userId: string,
  mintAddress: string
): Promise<PipelineResult | undefined> {
  const cached = await deps.cache.getJson<CachedAnalysis>(analysisCacheKey(userId, mintAddress));
  return cached?.pipelineResult;
}

async function storeAnalysis(
  deps: BotDependencies,
  userId: string,
  pipelineResult: PipelineResult
): Promise<void> {
  await deps.cache.setJson(
    analysisCacheKey(userId, pipelineResult.token.mintAddress),
    {
      userId,
      pipelineResult
    } satisfies CachedAnalysis,
    3600
  );
}

async function analyzeMint(ctx: SafeSniperContext, deps: BotDependencies, mintAddress: string): Promise<void> {
  const userId = getUserId(ctx);
  if (!userId) {
    return;
  }

  const token: TokenCandidate = {
    mintAddress,
    platform: "manual",
    detectedAt: new Date().toISOString()
  };

  deps.database.upsertSniperDailyStats(userId, { detectedCount: 1 });
  const pipelineResult = await deps.filterPipeline.run(token);
  await storeAnalysis(deps, userId, pipelineResult);

  if (pipelineResult.approved) {
    deps.database.upsertSniperDailyStats(userId, { approvedCount: 1 });
  } else {
    deps.database.upsertSniperDailyStats(userId, { rejectedCount: 1 });
  }

  const settings = deps.database.getUserSettings(userId);
  const feeQuote = deps.feeCalculator.calculate(userId, "manual_buy", settings.buyAmountSol);
  await replyOrEdit(
    ctx,
    formatAnalysis(pipelineResult, feeQuote, settings.buyAmountSol),
    buildAnalysisKeyboard(mintAddress)
  );
}

export async function handlePendingCustomBuy(
  ctx: SafeSniperContext,
  deps: BotDependencies
): Promise<boolean> {
  const mintAddress = ctx.session.pendingCustomBuyMint;
  const userId = getUserId(ctx);

  if (!mintAddress || !userId || !ctx.message || !("text" in ctx.message)) {
    return false;
  }

  const amount = Number((ctx.message?.text ?? "").trim());
  ctx.session.pendingCustomBuyMint = undefined;

  if (!Number.isFinite(amount) || amount <= 0) {
    await ctx.reply("Enter a valid SOL amount.");
    return true;
  }

  const analysis =
    (await getCachedAnalysis(deps, userId, mintAddress)) ??
    (await deps.filterPipeline.run({
      mintAddress,
      platform: "manual",
      detectedAt: new Date().toISOString()
    }));

  const result = await deps.sniperEngine.buy({
    userId,
    token: analysis.token,
    amountSol: amount,
    tradeType: "manual_buy",
    pipelineResult: analysis
  });

  await ctx.reply(formatTradeResult(result));
  return true;
}

export async function handleMintInput(
  ctx: SafeSniperContext,
  deps: BotDependencies
): Promise<boolean> {
  if (!ctx.message || !("text" in ctx.message)) {
    return false;
  }

  const text = ctx.message.text.trim();
  if (!isSolanaAddress(text)) {
    return false;
  }

  await analyzeMint(ctx, deps, text);
  return true;
}

export function registerBuyHandler(bot: Telegraf<SafeSniperContext>, deps: BotDependencies): void {
  bot.command("buy", async (ctx) => {
    const parts = (ctx.message?.text ?? "").split(/\s+/);
    const mintAddress = parts[1];
    if (!mintAddress || !isSolanaAddress(mintAddress)) {
      await ctx.reply("Usage: /buy <mint-address>");
      return;
    }

    await analyzeMint(ctx, deps, mintAddress);
  });

  bot.action("menu_buy", async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply("Paste a Solana token mint address or use /buy <mint>.");
  });

  bot.action(/^report\|(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const userId = getUserId(ctx);
    const mintAddress = ctx.match[1];
    if (!userId || !mintAddress) {
      return;
    }

    const analysis =
      (await getCachedAnalysis(deps, userId, mintAddress)) ??
      (await deps.filterPipeline.run({
        mintAddress,
        platform: "manual",
        detectedAt: new Date().toISOString()
      }));

    await replyOrEdit(ctx, formatFullReport(analysis), buildAnalysisKeyboard(mintAddress));
  });

  bot.action(/^buycustom\|(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const mintAddress = ctx.match[1];
    if (!mintAddress) {
      return;
    }

    ctx.session.pendingCustomBuyMint = mintAddress;
    await ctx.reply("Enter the SOL amount to use for this buy.");
  });

  bot.action(/^buy\|([^|]+)\|(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const amountSol = Number(ctx.match[1]);
    const mintAddress = ctx.match[2];
    const userId = getUserId(ctx);
    if (!userId || !mintAddress) {
      return;
    }

    const analysis =
      (await getCachedAnalysis(deps, userId, mintAddress)) ??
      (await deps.filterPipeline.run({
        mintAddress,
        platform: "manual",
        detectedAt: new Date().toISOString()
      }));

    const result = await deps.sniperEngine.buy({
      userId,
      token: analysis.token,
      amountSol,
      tradeType: "manual_buy",
      pipelineResult: analysis
    });

    await ctx.reply(formatTradeResult(result));
  });
}
