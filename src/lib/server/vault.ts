import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const DEFAULT_VAULT_KEY_BASE64 = "aW5udGVsY29ycDIwMjZzZWN2YXVsdGtleTMyYnl0ZXM="; // 32 bytes fallback

function key(): Buffer {
  const envKey = process.env.VAULT_KEY_BASE64 || DEFAULT_VAULT_KEY_BASE64;
  let bytes = Buffer.from(envKey, "base64");
  if (bytes.length !== 32) {
    bytes = Buffer.from(DEFAULT_VAULT_KEY_BASE64, "base64");
  }
  return bytes;
}

export function seal(value: string, context: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(context));
  const payload = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), payload.toString("base64")].join(".");
}

export function unseal(value: string, context: string) {
  const [version, iv, tag, payload] = value.split(".");
  if (version !== "v1") throw new Error("Versión de cifrado desconocida.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(payload, "base64")), decipher.final()]).toString("utf8");
}
