import crypto from "node:crypto";
import type { AppConfig } from "../types";

export class TxBuilder {
  constructor(private readonly config: AppConfig) {}

  async executeBuy(): Promise<{ txHash: string; message: string }> {
    if (!this.config.runtime.dryRun) {
      throw new Error("Live Pump.fun buy execution is not implemented in this scaffold.");
    }

    return {
      txHash: crypto.randomUUID().replace(/-/g, ""),
      message: "DRY_RUN buy simulated."
    };
  }

  async executeSell(): Promise<{ txHash: string; message: string }> {
    if (!this.config.runtime.dryRun) {
      throw new Error("Live Pump.fun sell execution is not implemented in this scaffold.");
    }

    return {
      txHash: crypto.randomUUID().replace(/-/g, ""),
      message: "DRY_RUN sell simulated."
    };
  }
}
