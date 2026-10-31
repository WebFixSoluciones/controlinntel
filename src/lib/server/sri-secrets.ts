import { adminServices } from "./admin";
import { DEFAULT_INNTEL_SRI_CONFIG } from "../sri-service";
import type { SriCompanyConfig } from "@/types";

/**
 * Secretos del emisor electrónico.
 *
 * El certificado PKCS#12 (.p12/.pfx) y su contraseña viven únicamente en
 * Firestore, en `sriSecrets/emisor`, y nunca se incluyen en
 * `sriCompanyConfig` (que sí llega al navegador). Este módulo es la única
 * puerta de acceso a esos documentos.
 */

export const SRI_SECRET_COLLECTION = "sriSecrets";
export const SRI_EMISOR_DOC = "emisor";

const CONFIG_COLLECTION = "sriCompanyConfig";
const CONFIG_DOC = "sri-config-inntel";

export interface SriEmitterSecret {
  pkcs12Base64: string;
  password: string;
  fileName?: string;
  updatedAt?: string;
}

/** Configuración del emisor tal como la ve el servidor (con valores por defecto). */
export async function readSriCompanyConfig(): Promise<SriCompanyConfig> {
  const { db } = adminServices();
  const snap = await db.collection(CONFIG_COLLECTION).doc(CONFIG_DOC).get();
  const stored = (snap.exists ? snap.data() : {}) || {};
  return { ...DEFAULT_INNTEL_SRI_CONFIG, ...stored } as SriCompanyConfig;
}

/** Lee el certificado y la contraseña almacenados. Devuelve `null` si no existen. */
export async function readEmitterSecret(): Promise<SriEmitterSecret | null> {
  const { db } = adminServices();
  const snap = await db.collection(SRI_SECRET_COLLECTION).doc(SRI_EMISOR_DOC).get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  const pkcs12Base64 = String(data.pkcs12Base64 || "").trim();
  const password = String(data.password || "");
  if (!pkcs12Base64 || !password) return null;
  return {
    pkcs12Base64,
    password,
    fileName: data.fileName ? String(data.fileName) : undefined,
    updatedAt: data.updatedAt ? String(data.updatedAt) : undefined,
  };
}

/** Guarda (o reemplaza) el certificado y su contraseña. */
export async function writeEmitterSecret(secret: SriEmitterSecret): Promise<void> {
  const { db } = adminServices();
  await db
    .collection(SRI_SECRET_COLLECTION)
    .doc(SRI_EMISOR_DOC)
    .set(
      {
        pkcs12Base64: secret.pkcs12Base64,
        password: secret.password,
        fileName: secret.fileName || "",
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
}

/** Elimina el certificado y la contraseña del servidor. */
export async function clearEmitterSecret(): Promise<void> {
  const { db } = adminServices();
  await db.collection(SRI_SECRET_COLLECTION).doc(SRI_EMISOR_DOC).delete();
}

/** Indica si hay un certificado utilizable guardado en el servidor. */
export async function hasEmitterSecret(): Promise<boolean> {
  return (await readEmitterSecret()) !== null;
}
