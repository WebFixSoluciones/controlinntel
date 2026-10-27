/**
 * Resella los secretos heredados de la bóveda.
 *
 * Los valores antiguos usaban `ENC_` + base64 invertido (sin clave). El esquema actual
 * es AES-256-GCM con AAD ligado a `coleccion/id`. Este script descifra el formato
 * heredado, vuelve a cifrar con `seal()` y verifica el ida y vuelta antes de escribir.
 *
 * Uso (requiere TypeScript stripping):
 *   node --experimental-strip-types scripts/reseal-vault.mjs
 *   node --experimental-strip-types scripts/reseal-vault.mjs --apply
 */
import fs from "node:fs";
import path from "node:path";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { seal, unseal } from "../src/lib/server/vault.ts";

const apply = process.argv.includes("--apply");

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

/** Descifra el formato heredado: "ENC_" + base64 invertido del UTF-8 original. */
function decodeLegacy(value) {
  const text = String(value || "");
  if (!text.startsWith("ENC_")) return null;
  const reversed = text.slice(4).split("").reverse().join("");
  const decoded = Buffer.from(reversed, "base64").toString("utf8");
  if (!decoded || decoded.includes("\uFFFD")) return null;
  return decoded;
}

const projectId = process.env.FIREBASE_PROJECT_ID || "inntelcorp-45c89";
const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
if (credentialPath) {
  const resolved = path.isAbsolute(credentialPath) ? credentialPath : path.resolve(process.cwd(), credentialPath);
  if (fs.existsSync(resolved)) process.env.GOOGLE_APPLICATION_CREDENTIALS = resolved;
}
if (!process.env.VAULT_KEY_BASE64) {
  console.error("Falta VAULT_KEY_BASE64: no se puede resellar sin la clave de la bóveda.");
  process.exit(2);
}
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const pending = [];
const skipped = [];

for (const collection of ["vault", "clientVaultItems"]) {
  const snapshot = await db.collection(collection).get();
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const current = data.secret ?? data.encryptedPassword;
    if (typeof current !== "string" || !current) continue;
    if (current.startsWith("v1.")) continue;

    const plain = decodeLegacy(current);
    if (!plain) {
      skipped.push({ collection, id: doc.id, reason: "no se pudo descifrar el formato heredado" });
      continue;
    }

    const context = `${collection}/${doc.id}`;
    const sealed = seal(plain, context);
    // Verificación obligatoria: el nuevo valor debe devolver exactamente el texto original.
    if (unseal(sealed, context) !== plain) {
      skipped.push({ collection, id: doc.id, reason: "la verificación de ida y vuelta falló" });
      continue;
    }
    pending.push({ ref: doc.ref, collection, id: doc.id, sealed });
  }
}

console.log(`Proyecto: ${projectId}`);
console.log(`Secretos heredados a resellar: ${pending.length}`);
for (const item of pending) console.log(`  - ${item.collection}/${item.id}`);
if (skipped.length) {
  console.log(`\nOmitidos: ${skipped.length}`);
  for (const item of skipped) console.log(`  - ${item.collection}/${item.id}: ${item.reason}`);
}

if (!apply) {
  console.log("\nSimulación: no se escribió nada. Ejecuta con --apply para resellar.");
  process.exit(pending.length || skipped.length ? 0 : 0);
}

for (const item of pending) {
  await item.ref.update({ secret: item.sealed, encryptedPassword: FieldValue.delete() });
}

console.log(`\nAplicado. Secretos resellados: ${pending.length}.`);
if (skipped.length) {
  console.log(`Revisar manualmente: ${skipped.length} secreto(s) no migrados.`);
  process.exit(1);
}
process.exit(0);
