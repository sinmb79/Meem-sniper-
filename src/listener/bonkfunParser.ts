import type { Connection } from "@solana/web3.js";
import type { TokenCandidate } from "../types";

export async function parseBonkfunCreateTransaction(
  _connection: Connection,
  _signature: string
): Promise<TokenCandidate | undefined> {
  return undefined;
}
