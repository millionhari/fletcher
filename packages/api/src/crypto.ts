import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM for provider refresh tokens. The key lives only in
 * CONNECTIONS_ENCRYPTION_KEY (32 bytes, base64 or hex); ciphertext is
 * `v1:<iv>:<tag>:<data>` so a future key can be introduced as `v2:`.
 */
function key(): Buffer {
  const raw = process.env.CONNECTIONS_ENCRYPTION_KEY;
  if (!raw) throw new Error("CONNECTIONS_ENCRYPTION_KEY is not set");
  const buf = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("CONNECTIONS_ENCRYPTION_KEY must be 32 bytes (64 hex chars or 44 base64 chars)");
  return buf;
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${data.toString("base64")}`;
}

export function decryptSecret(enc: string): string {
  const [v, iv, tag, data] = enc.split(":");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Unrecognised secret format");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}
