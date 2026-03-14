import { Connection, Logs, PublicKey } from "@solana/web3.js";
import { PUMP_FUN_PROGRAM_ID, TOKEN_LISTENER_RECONNECT_MS } from "../config/constants";
import type { AppConfig, TokenCandidate } from "../types";
import { logger } from "../utils/logger";
import { parsePumpfunCreateTransaction } from "./pumpfunParser";

export class TokenListener {
  private subscriptionId?: number;
  private simulationTimer?: NodeJS.Timeout;

  constructor(
    private readonly connection: Connection,
    private readonly config: AppConfig
  ) {}

  async start(onTokenDetected: (token: TokenCandidate) => Promise<void>): Promise<void> {
    if (this.config.listener.simulatedMintAddress) {
      this.simulationTimer = setTimeout(() => {
        void onTokenDetected({
          mintAddress: this.config.listener.simulatedMintAddress!,
          platform: "pumpfun",
          detectedAt: new Date().toISOString()
        });
      }, 3_000);
    }

    if (!this.config.network.enableTokenListener) {
      logger.info("Token listener disabled.");
      return;
    }

    this.subscriptionId = this.connection.onLogs(
      new PublicKey(PUMP_FUN_PROGRAM_ID),
      async (logs: Logs) => {
        try {
          if (!logs.logs.some((line) => line.includes("Instruction: Create"))) {
            return;
          }

          const token = await parsePumpfunCreateTransaction(this.connection, logs.signature);
          if (token) {
            await onTokenDetected(token);
          }
        } catch (error) {
          logger.error("Failed to process token listener log.", { error: String(error) });
          setTimeout(() => {
            void this.restart(onTokenDetected);
          }, TOKEN_LISTENER_RECONNECT_MS).unref();
        }
      },
      "confirmed"
    );

    logger.info("Token listener started.", { subscriptionId: this.subscriptionId });
  }

  async stop(): Promise<void> {
    if (this.subscriptionId !== undefined) {
      await this.connection.removeOnLogsListener(this.subscriptionId);
      this.subscriptionId = undefined;
    }

    if (this.simulationTimer) {
      clearTimeout(this.simulationTimer);
      this.simulationTimer = undefined;
    }
  }

  private async restart(onTokenDetected: (token: TokenCandidate) => Promise<void>): Promise<void> {
    await this.stop();
    await this.start(onTokenDetected);
  }
}
