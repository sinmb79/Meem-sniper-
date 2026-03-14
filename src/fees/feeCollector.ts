import { LAMPORTS_PER_SOL, PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import { AppConfig } from "../types";

export class FeeCollector {
  constructor(private readonly config: AppConfig) {}

  buildFeeInstruction(userWallet: PublicKey, feeSol: number): TransactionInstruction | undefined {
    if (!this.config.fees.feeWalletPublicKey || feeSol <= 0) {
      return undefined;
    }

    return SystemProgram.transfer({
      fromPubkey: userWallet,
      toPubkey: new PublicKey(this.config.fees.feeWalletPublicKey),
      lamports: Math.round(feeSol * LAMPORTS_PER_SOL)
    });
  }
}
