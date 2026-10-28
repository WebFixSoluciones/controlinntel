/**
 * Inspección de solo lectura: credenciales de nodos almacenadas en texto plano.
 * No imprime secretos, solo conteos y nombres de campo.
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

const looksPlain = (value) => typeof value === "string" && value.length > 0 && !value.startsWith("v1.");

const snapshot = await db.collection("nodes").get();
let nodesWithSecrets = 0;
let servicesWithPassword = 0;
let servicesWithCredentials = 0;
let alreadySealed = 0;

for (const doc of snapshot.docs) {
  const data = doc.data();
  const services = Array.isArray(data.services) ? data.services : [];
  let touched = false;
  for (const service of services) {
    if (looksPlain(service?.password)) { servicesWithPassword++; touched = true; }
    if (typeof service?.passwordSealed === "string" && service.passwordSealed.startsWith("v1.")) alreadySealed++;
    if (typeof service?.credentials === "string" && service.credentials.includes(" / ")) {
      servicesWithCredentials++; touched = true;
    }
  }
  if (touched) nodesWithSecrets++;
}

console.log(`Proyecto: ${projectId}`);
console.log(`Nodos: ${snapshot.size}`);
console.log(`Nodos con credenciales en texto plano: ${nodesWithSecrets}`);
console.log(`  servicios con campo password: ${servicesWithPassword}`);
console.log(`  servicios con campo credentials: ${servicesWithCredentials}`);
console.log(`  servicios ya sellados: ${alreadySealed}`);
process.exit(0);
