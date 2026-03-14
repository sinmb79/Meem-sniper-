import type { Connection, PublicKey } from "@solana/web3.js";
import type { TokenCandidate } from "../types";

function extractKeys(message: unknown): string[] {
  if (message && typeof message === "object") {
    const staticKeys = (message as { staticAccountKeys?: PublicKey[] }).staticAccountKeys;
    if (Array.isArray(staticKeys) && staticKeys.length > 0) {
      return staticKeys.map((key) => key.toBase58());
    }

    const accountKeys = (message as { accountKeys?: Array<PublicKey | { pubkey: PublicKey }> }).accountKeys;
    if (Array.isArray(accountKeys)) {
      return accountKeys.map((key) =>
        "pubkey" in key ? key.pubkey.toBase58() : key.toBase58()
      );
    }
  }

  return [];
}

export async function parsePumpfunCreateTransaction(
  connection: Connection,
  signature: string
): Promise<TokenCandidate | undefined> {
  const transaction = await connection.getTransaction(signature, {
    maxSupportedTransactionVersion: 0
  });
  if (!transaction) {
    return undefined;
  }

  const keys = extractKeys(transaction.transaction.message);
  const mintAddress = keys[0];
  if (!mintAddress) {
    return undefined;
  }

  return {
    mintAddress,
    creator: keys[7],
    txSignature: signature,
    platform: "pumpfun",
    detectedAt: new Date().toISOString()
  };
}
