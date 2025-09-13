import fs from "node:fs/promises";
import path from "node:path";
import { createSecretKey } from "node:crypto";
import { CompactEncrypt, compactDecrypt } from "jose";

export interface SecureTokenStorageOptions {
  baseDirectoryPath: string;
  encryptionKeyBase64: string;
}

export class SecureTokenStorage {
  private readonly dir: string;
  private readonly keyBytes: Uint8Array;

  constructor(options: SecureTokenStorageOptions) {
    this.dir = options.baseDirectoryPath;
    this.keyBytes = options.encryptionKeyBase64
      ? Buffer.from(options.encryptionKeyBase64, "base64")
      : new Uint8Array();
  }

  private async ensureDir() {
    await fs.mkdir(this.dir, { recursive: true });
  }

  async saveRefreshToken(params: { userId: string; refreshToken: string }): Promise<void> {
    await this.ensureDir();
    const filePath = path.join(this.dir, `${sanitize(params.userId)}.token`);
    const jwe = await encryptText(params.refreshToken, this.keyBytes);
    await fs.writeFile(filePath, jwe, { encoding: "utf8" });
  }

  async getRefreshToken(params: { userId: string }): Promise<string | null> {
    try {
      const filePath = path.join(this.dir, `${sanitize(params.userId)}.token`);
      const jwe = await fs.readFile(filePath, { encoding: "utf8" });
      const token = await decryptText(jwe, this.keyBytes);
      return token;
    } catch {
      return null;
    }
  }
}

function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, "_");
}

async function encryptText(plaintext: string, keyBytes: Uint8Array): Promise<string> {
  if (keyBytes.length !== 32) {
    throw new Error("ENCRYPTION_KEY_BASE64 must be 32 bytes when decoded");
  }
  const key = createSecretKey(keyBytes);
  const encoder = new TextEncoder();
  const jwe = await new CompactEncrypt(encoder.encode(plaintext))
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .encrypt(key);
  return jwe;
}

async function decryptText(jwe: string, keyBytes: Uint8Array): Promise<string> {
  if (keyBytes.length !== 32) {
    throw new Error("ENCRYPTION_KEY_BASE64 must be 32 bytes when decoded");
  }
  const key = createSecretKey(keyBytes);
  const { plaintext } = await compactDecrypt(jwe, key);
  const decoder = new TextDecoder();
  return decoder.decode(plaintext);
}


