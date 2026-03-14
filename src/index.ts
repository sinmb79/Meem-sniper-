import { Connection } from "@solana/web3.js";
import { createBot } from "./bot";
import { formatAnalysis, formatTradeResult } from "./bot/formatter";
import { buildAnalysisKeyboard } from "./bot/keyboards";
import { config, assertRuntimeConfig } from "./config";
import { CacheService } from "./data/cache";
import { DatabaseService } from "./data/database";
import { FeeCalculator } from "./fees/feeCalculator";
import { FeeStatsService } from "./fees/feeStats";
import { PremiumManager } from "./fees/premiumManager";
import { ReferralManager } from "./fees/referralManager";
import { FilterPipeline } from "./filters/filterPipeline";
import { TokenListener } from "./listener/tokenListener";
import { DexScreenerService } from "./services/dexScreener";
import { PositionManager } from "./trading/positionManager";
import { SellEngine } from "./trading/sellEngine";
import { SniperEngine } from "./trading/sniperEngine";
import { TxBuilder } from "./trading/txBuilder";
import { logger } from "./utils/logger";
import { WalletManager } from "./bot/walletManager";

async function main(): Promise<void> {
  assertRuntimeConfig();

  const connection = new Connection(config.network.rpcUrl, {
    wsEndpoint: config.network.wsUrl,
    commitment: "confirmed"
  });
  const cache = new CacheService(config.storage.redisUrl);
  const database = new DatabaseService(config.storage.databasePath);
  const dexScreener = new DexScreenerService(config.external.dexScreenerApiUrl);
  const referralManager = new ReferralManager(database);
  const premiumManager = new PremiumManager(database, config);
  const feeCalculator = new FeeCalculator(config, premiumManager, referralManager);
  const feeStats = new FeeStatsService(database, config);
  const filterPipeline = new FilterPipeline({
    config,
    connection,
    database,
    cache,
    dexScreener
  });
  const txBuilder = new TxBuilder(config);
  const positionManager = new PositionManager(database, dexScreener, config);
  const sniperEngine = new SniperEngine(
    config,
    database,
    feeCalculator,
    referralManager,
    positionManager,
    txBuilder
  );
  const sellEngine = new SellEngine(config, database, feeCalculator, positionManager, txBuilder);
  const walletManager = new WalletManager(connection, database, config);

  const deps = {
    config,
    connection,
    cache,
    database,
    dexScreener,
    filterPipeline,
    feeCalculator,
    referralManager,
    premiumManager,
    feeStats,
    sniperEngine,
    sellEngine,
    positionManager,
    walletManager
  };

  const bot = createBot(deps);
  const botInfo = await bot.telegram.getMe();
  logger.info("Telegram bot initialized.", { username: botInfo.username });

  const tokenListener = new TokenListener(connection, config);
  await tokenListener.start(async (token) => {
    logger.info("Token detected.", token);
    const userIds = database.listUserIds();

    for (const userId of userIds) {
      const settings = database.getUserSettings(userId);
      if (settings.mode === "PAUSE") {
        continue;
      }

      const analysis = await filterPipeline.run(token);
      database.upsertSniperDailyStats(userId, {
        detectedCount: 1,
        approvedCount: analysis.approved ? 1 : 0,
        rejectedCount: analysis.approved ? 0 : 1
      });

      const feeQuote = feeCalculator.calculate(userId, "auto_snipe", settings.buyAmountSol);

      if (analysis.approved && settings.mode === "AUTO") {
        const tradeResult = await sniperEngine.buy({
          userId,
          token: analysis.token,
          amountSol: settings.buyAmountSol,
          tradeType: "auto_snipe",
          pipelineResult: analysis
        });
        await bot.telegram.sendMessage(
          userId,
          `${formatAnalysis(analysis, feeQuote, settings.buyAmountSol)}\n\n${formatTradeResult(tradeResult)}`,
          buildAnalysisKeyboard(token.mintAddress)
        );
      } else if (analysis.approved && settings.mode === "ALERT") {
        await bot.telegram.sendMessage(
          userId,
          formatAnalysis(analysis, feeQuote, settings.buyAmountSol),
          buildAnalysisKeyboard(token.mintAddress)
        );
      }
    }
  });

  await bot.launch();
  logger.info("SafeSniper bot is running.");

  const shutdown = async () => {
    logger.info("Shutting down...");
    await tokenListener.stop();
    bot.stop("shutdown");
    process.exit(0);
  };

  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}

void main().catch((error) => {
  logger.error("Fatal startup error.", { error: String(error) });
  process.exit(1);
});
