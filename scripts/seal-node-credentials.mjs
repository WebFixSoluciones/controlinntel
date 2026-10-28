/**
 * Sella las credenciales de equipo que quedaron en texto plano dentro de `nodes`.
 *
 * El AAD debe coincidir exactamente con el que usa `operations.ts` al guardar:
 *   nodes/<nodeId>/<service.id ?? índice>
 *
 * Uso (requiere TypeScript stripping):
 *   node --experimental-strip-types scripts/seal-node-credentials.mjs
 *   node --experimental-strip-types scripts/seal-node-credentials.mjs --apply
 */
import fs from "node:fs";
import path from "node:path";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
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

const projectId = process.env.FIREBASE_PROJECT_ID || "inntelcorp-45c89";
const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
if (credentialPath) {
  const resolved = path.isAbsolute(credentialPath) ? credentialPath : path.resolve(process.cwd(), credentialPath);
  if (fs.existsSync(resolved)) process.env.GOOGLE_APPLICATION_CREDENTIALS = resolved;
}
if (!process.env.VAULT_KEY_BASE64) {
  console.error("Falta VAULT_KEY_BASE64: no se pueden sellar credenciales.");
  process.exit(2);
}
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const plainFrom = (service) => {
  if (typeof service.password === "string" && service.password.trim()) return service.password.trim();
  if (typeof service.credentials === "string" && service.credentials.includes("/")) {
    return service.credentials.split("/").slice(1).join("/").trim();
  }
  return "";
};

const pending = [];
const skipped = [];

const snapshot = await db.collection("nodes").get();
for (const doc of snapshot.docs) {
  const data = doc.data();
  if (!Array.isArray(data.services) || !data.services.length) continue;

  let changed = false;
  const services = data.services.map((service, index) => {
    const { password, credentials, passwordSealed, ...rest } = service;
    if (typeof passwordSealed === "string" && passwordSealed) return { ...rest, passwordSealed };
    const plain = plainFrom(service);
    if (!plain) return rest;
    const context = `nodes/${doc.id}/${rest.id ?? index}`;
    const sealed = seal(plain, context);
    if (unseal(sealed, context) !== plain) {
      skipped.push({ node: doc.id, index, reason: "la verificación de ida y vuelta falló" });
      return rest;
    }
    changed = true;
    return { ...rest, passwordSealed: sealed };
  });

  if (changed) pending.push({ ref: doc.ref, id: doc.id, services, total: services.length });
}

console.log(`Proyecto: ${projectId}`);
console.log(`Nodos con credenciales a sellar: ${pending.length}`);
for (const item of pending) console.log(`  - ${item.id} (${item.total} servicio/s)`);
if (skipped.length) {
  console.log(`\nOmitidos: ${skipped.length}`);
  for (const item of skipped) console.log(`  - ${item.node}[${item.index}]: ${item.reason}`);
}

if (!apply) {
  console.log("\nSimulación: no se escribió nada. Ejecuta con --apply para sellar.");
  process.exit(0);
}

for (const item of pending) await item.ref.update({ services: item.services });
console.log(`\nAplicado. Nodos actualizados: ${pending.length}.`);
process.exit(skipped.length ? 1 : 0);
