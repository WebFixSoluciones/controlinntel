/**
 * Inspección de solo lectura de la bóveda: cuántos secretos están en el formato
 * actual (v1.iv.tag.payload) y cuántos quedaron en el formato heredado.
 * No imprime valores: solo prefijo, longitud y diagnóstico.
 */
import fs from "node:fs";
import path from "node:path";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function loadLocalEnv() {
  for (const file of [".env.local", ".env"]) {
    const full = path.resolve(process.cwd(), file);
    if (!fs.existsSync(full)) continue;
    for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      const value = rawValue.replace(/^["']|["']$/g, "").trim();
      if (value && !process.env[key]) process.env[key] = value;
    }
  }
}
loadLocalEnv();

const projectId = process.env.FIREBASE_PROJECT_ID || "inntelcorp-45c89";
const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
if (credentialPath) {
  const resolved = path.isAbsolute(credentialPath) ? credentialPath : path.resolve(process.cwd(), credentialPath);
  if (fs.existsSync(resolved)) process.env.GOOGLE_APPLICATION_CREDENTIALS = resolved;
}
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const describe = (value) => {
  const text = String(value || "");
  if (!text) return "vacío";
  if (/^v1\./.test(text)) return "v1 (correcto)";
  if (/^ENC_/.test(text)) return "ENC_ (base64 invertido heredado)";
  if (/^U2FsdGVkX1\+/.test(text)) return "CryptoJS heredado";
  return "texto plano u otro";
};

for (const collection of ["vault", "clientVaultItems"]) {
  const snapshot = await db.collection(collection).get();
  const buckets = new Map();
  for (const doc of snapshot.docs) {
    const label = describe(doc.data().secret ?? doc.data().encryptedPassword);
    buckets.set(label, (buckets.get(label) || 0) + 1);
  }
  console.log(`\n${collection}: ${snapshot.size} documento(s)`);
  for (const [label, count] of buckets) console.log(`  ${label}: ${count}`);
}

console.log(`\nVAULT_KEY_BASE64 configurado: ${process.env.VAULT_KEY_BASE64 ? "sí" : "no"}`);
process.exit(0);
