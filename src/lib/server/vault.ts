import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { adminServices } from "./admin.ts";
import { VaultConfigurationError, VaultKeyProvider } from "./vault-key.ts";

async function loadManagedKey(): Promise<string> {
  const { app } = adminServices();
  const project = app.options.projectId;
  if (!project || process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new VaultConfigurationError("VAULT_KEY_NOT_CONFIGURED");
  }
  // Pin the version: publishing a new secret version must never silently rotate the key.
  const resource = process.env.VAULT_KEY_SECRET_VERSION || `projects/${project}/secrets/inntel-vault-key/versions/1`;
  if (!/^projects\/[a-zA-Z0-9-]+\/secrets\/[a-zA-Z0-9_-]+\/versions\/[1-9]\d*$/.test(resource)) {
    throw new VaultConfigurationError("VAULT_KEY_RESOURCE_INVALID");
  }
  const token = await app.options.credential?.getAccessToken();
  if (!token) throw new VaultConfigurationError("VAULT_KEY_ACCESS_UNAVAILABLE");
  const response = await fetch(`https://secretmanager.googleapis.com/v1/${resource}:access`, {
    headers: { Authorization: `Bearer ${token.access_token}` },
    cache: "no-store", signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new VaultConfigurationError("VAULT_KEY_ACCESS_DENIED");
  const result = await response.json();
  if (typeof result.payload?.data !== "string") throw new VaultConfigurationError("VAULT_KEY_INVALID");
  return Buffer.from(result.payload.data, "base64").toString("utf8");
}

const provider = new VaultKeyProvider(() => process.env.VAULT_KEY_BASE64, loadManagedKey);
export const initializeVaultKey = () => provider.ready();
const getKey = () => provider.get();

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
