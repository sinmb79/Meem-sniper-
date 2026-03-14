import crypto from "node:crypto";

export interface EncryptedPayload {
  cipherText: string;
  iv: string;
  authTag: string;
}

function getKeyBuffer(hexKey: string): Buffer {
  if (!/^[0-9a-fA-F]{64}$/.test(hexKey)) {
    throw new Error("ENCRYPTION_KEY must be a 64-character hex string.");
  }
  return Buffer.from(hexKey, "hex");
}

export function encryptSecret(plainText: string, hexKey: string): EncryptedPayload {
  const key = getKeyBuffer(hexKey);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const cipherText = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    cipherText: cipherText.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64")
  };
}

export function decryptSecret(cipherText: string, hexKey: string, iv: string, authTag: string): string {
  const key = getKeyBuffer(hexKey);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(authTag, "base64"));

  const plainText = Buffer.concat([
    decipher.update(Buffer.from(cipherText, "base64")),
    decipher.final()
  ]);

  return plainText.toString("utf8");
}
