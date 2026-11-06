import { adminServices } from "./admin.ts";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { DEFAULT_INNTEL_SRI_CONFIG } from "../sri-service.ts";
import { initializeVaultKey, seal, unseal } from "./vault.ts";
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

export const SRI_CONFIG_PATH = "sriCompanyConfig/sri-config-inntel";
const secretContext = "sriSecrets/emisor";

export interface SriEmitterSecret {
  pkcs12Base64: string;
  password: string;
  fileName?: string;
  updatedAt?: string;
}

/** Configuración del emisor tal como la ve el servidor (con valores por defecto). */
export async function readSriCompanyConfig(db: Firestore = adminServices().db): Promise<SriCompanyConfig> {
  const snap = await db.doc(SRI_CONFIG_PATH).get();
  const stored = (snap.exists ? snap.data() : {}) || {};
  const { certificadoBase64, certificadoClave, ...config } = stored;
  return { ...DEFAULT_INNTEL_SRI_CONFIG, ...config } as SriCompanyConfig;
}

/** Lee el certificado y la contraseña almacenados. Devuelve `null` si no existen. */
export async function readEmitterSecret(db: Firestore = adminServices().db): Promise<SriEmitterSecret | null> {
  const snap = await db.collection(SRI_SECRET_COLLECTION).doc(SRI_EMISOR_DOC).get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  if (typeof data.sealed === "string") {
    await initializeVaultKey();
    return JSON.parse(unseal(data.sealed, secretContext)) as SriEmitterSecret;
  }
  const pkcs12Base64 = String(data.pkcs12Base64 || "").trim();
  const password = String(data.password || "");
  if (!pkcs12Base64 || !password) return null;
  const legacy = {
    pkcs12Base64,
    password,
    fileName: data.fileName ? String(data.fileName) : undefined,
    updatedAt: data.updatedAt ? String(data.updatedAt) : undefined,
  };
  // Migrate an existing private record once, without overwriting a concurrent rotation.
  await initializeVaultKey();
  const encrypted = seal(JSON.stringify(legacy), secretContext);
  if (Buffer.byteLength(encrypted) <= 990_000) {
    await db.runTransaction(async tx => {
      const current = await tx.get(snap.ref);
      if (current.updateTime?.isEqual(snap.updateTime!)) tx.set(snap.ref, { sealed: encrypted });
    });
  } else {
    throw new Error("Vuelve a cargar la firma en un archivo PKCS#12 de hasta 512 KiB.");
  }
  return legacy;
}

/** Guarda (o reemplaza) el certificado y su contraseña. */
export async function writeEmitterSecret(secret: SriEmitterSecret, metadata: Partial<SriCompanyConfig>): Promise<void> {
  const { db } = adminServices();
  await initializeVaultKey();
  const batch = db.batch();
  batch.set(db.doc(secretContext), { sealed: seal(JSON.stringify(secret), secretContext) });
  batch.set(db.doc(SRI_CONFIG_PATH), { ...metadata, id: "sri-config-inntel",
    certificadoBase64: FieldValue.delete(), certificadoClave: FieldValue.delete() }, { merge: true });
  await batch.commit();
}

/** Elimina el certificado y la contraseña del servidor. */
export async function clearEmitterSecret(): Promise<void> {
  const { db } = adminServices();
  const batch = db.batch();
  batch.delete(db.doc(secretContext));
  batch.set(db.doc(SRI_CONFIG_PATH), { certificadoCargado: false, certificadoNombre: FieldValue.delete(),
    certificadoVencimiento: FieldValue.delete(), certificadoEmisor: FieldValue.delete(), certificadoTamano: FieldValue.delete(),
    certificadoFechaCarga: FieldValue.delete(), certificadoBase64: FieldValue.delete(), certificadoClave: FieldValue.delete() }, { merge: true });
  await batch.commit();
}

/** Indica si hay un certificado utilizable guardado en el servidor. */
export async function hasEmitterSecret(): Promise<boolean> {
  return (await adminServices().db.doc(secretContext).get()).exists;
}
