import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const DEV_FALLBACK_KEY_BASE64 = "aW5udGVsY29ycDIwMjZzZWN2YXVsdGtleTMyYnl0ZXM="; // 32-byte key for local development

function getKey(): Buffer {
  const envKey = process.env.VAULT_KEY_BASE64;
  if (!envKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("FATAL DE SEGURIDAD: La variable VAULT_KEY_BASE64 es obligatoria en producción para el cifrado AES-256-GCM.");
    }
    return Buffer.from(DEV_FALLBACK_KEY_BASE64, "base64");
  }

  const bytes = Buffer.from(envKey, "base64");
  if (bytes.length !== 32) {
    throw new Error("Configuración inválida: VAULT_KEY_BASE64 debe ser una cadena base64 de exactamente 32 bytes (256 bits).");
  }
  return bytes;
}

export function seal(value: string, context: string): string {
  const iv = randomBytes(12); // Standard 96-bit nonce for AES-GCM
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  cipher.setAAD(Buffer.from(context, "utf8"));
  const payload = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), payload.toString("base64")].join(".");
}

export function unseal(value: string, context: string): string {
  const parts = value.split(".");
  if (parts.length !== 4) {
    throw new Error("Formato de secreto inválido.");
  }
  const [version, iv, tag, payload] = parts;
  if (version !== "v1") {
    throw new Error("Versión de cifrado desconocida: " + version);
  }
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(iv, "base64"));
  decipher.setAAD(Buffer.from(context, "utf8"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(payload, "base64")), decipher.final()]).toString("utf8");
}
