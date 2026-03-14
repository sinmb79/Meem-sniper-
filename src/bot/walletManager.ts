import bs58 from "bs58";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction
} from "@solana/web3.js";
import type { AppConfig } from "../types";
import { DatabaseService } from "../data/database";
import { decryptSecret, encryptSecret } from "../utils/crypto";

export class WalletManager {
  constructor(
    private readonly connection: Connection,
    private readonly database: DatabaseService,
    private readonly config: AppConfig
  ) {}

  getOrCreateWallet(userId: string): { publicKey: string } {
    const existing = this.database.getWallet(userId);
    if (existing) {
      return { publicKey: existing.publicKey };
    }

    const keypair = Keypair.generate();
    const secretKeyBase58 = bs58.encode(Buffer.from(keypair.secretKey));
    const encrypted = encryptSecret(secretKeyBase58, this.config.security.encryptionKeyHex);

    this.database.saveWallet({
      userId,
      publicKey: keypair.publicKey.toBase58(),
      encryptedSecretKey: encrypted.cipherText,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      createdAt: new Date().toISOString()
    });

    return { publicKey: keypair.publicKey.toBase58() };
  }

  getPublicKey(userId: string): string {
    return this.getOrCreateWallet(userId).publicKey;
  }

  getKeypair(userId: string): Keypair {
    const wallet = this.database.getWallet(userId);
    if (!wallet) {
      throw new Error("Wallet not found for user.");
    }

    const secretKey = decryptSecret(
      wallet.encryptedSecretKey,
      this.config.security.encryptionKeyHex,
      wallet.iv,
      wallet.authTag
    );

    return Keypair.fromSecretKey(bs58.decode(secretKey));
  }

  async getBalance(userId: string): Promise<number> {
    const publicKey = new PublicKey(this.getPublicKey(userId));
    const lamports = await this.connection.getBalance(publicKey);
    return lamports / LAMPORTS_PER_SOL;
  }

  exportPrivateKey(userId: string): string {
    const wallet = this.database.getWallet(userId);
    if (!wallet) {
      throw new Error("Wallet not found for user.");
    }

    return decryptSecret(
      wallet.encryptedSecretKey,
      this.config.security.encryptionKeyHex,
      wallet.iv,
      wallet.authTag
    );
  }

  async withdraw(userId: string, amountSol: number, toAddress: string): Promise<{ txHash: string; dryRun: boolean }> {
    if (this.config.runtime.dryRun) {
      return {
        txHash: `dryrun-${Date.now()}`,
        dryRun: true
      };
    }

    const wallet = this.getKeypair(userId);
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: new PublicKey(toAddress),
        lamports: Math.round(amountSol * LAMPORTS_PER_SOL)
      })
    );

    const txHash = await sendAndConfirmTransaction(this.connection, transaction, [wallet]);
    return {
      txHash,
      dryRun: false
    };
  }
}
