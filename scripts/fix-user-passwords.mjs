/**
 * Elimina el campo heredado `passwordHash` de los documentos de `users`.
 *
 * Contexto: la contraseña ya no se valida en el cliente. El inicio de sesión usa
 * Firebase Auth y el perfil se resuelve en servidor. `passwordHash` solo conservaba
 * la contraseña antigua en texto plano dentro de Firestore.
 *
 * Uso:
 *   node scripts/fix-user-passwords.mjs            # simulación, no escribe
 *   node scripts/fix-user-passwords.mjs --apply    # elimina el campo
 */
import fs from "node:fs";
import path from "node:path";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

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

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "inntelcorp-45c89";
const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
if (credentialPath) {
  const resolved = path.isAbsolute(credentialPath) ? credentialPath : path.resolve(process.cwd(), credentialPath);
  if (fs.existsSync(resolved)) process.env.GOOGLE_APPLICATION_CREDENTIALS = resolved;
}

if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const requiredFields = ["email", "displayName", "role", "status"];

const snapshot = await db.collection("users").get();
const affected = [];
const incomplete = [];

snapshot.forEach((doc) => {
  const data = doc.data();
  const missing = requiredFields.filter((field) => typeof data[field] === "undefined");
  if (missing.length) incomplete.push({ id: doc.id, email: data.email || "(sin email)", missing });
  if (Object.prototype.hasOwnProperty.call(data, "passwordHash")) {
    affected.push({ ref: doc.ref, id: doc.id, email: data.email || "(sin email)", role: data.role || "-" });
  }
});

console.log(`Proyecto: ${projectId}`);
console.log(`Usuarios revisados: ${snapshot.size}`);
console.log(`Documentos con passwordHash: ${affected.length}`);
for (const item of affected) console.log(`  - ${item.email} (uid ${item.id}, rol ${item.role})`);

if (incomplete.length) {
  console.log(`\nAdvertencia: ${incomplete.length} documento(s) sin campos obligatorios:`);
  for (const item of incomplete) console.log(`  - ${item.email} (uid ${item.id}) falta: ${item.missing.join(", ")}`);
}

if (!affected.length) {
  console.log("\nNada que eliminar. Todos los documentos están limpios.");
  process.exit(0);
}

if (!apply) {
  console.log("\nSimulación: no se escribió nada. Ejecuta con --apply para eliminar el campo.");
  process.exit(0);
}

const batch = db.batch();
for (const item of affected) batch.update(item.ref, { passwordHash: FieldValue.delete() });
await batch.commit();

const verification = await db.collection("users").get();
let remaining = 0;
verification.forEach((doc) => {
  if (Object.prototype.hasOwnProperty.call(doc.data(), "passwordHash")) remaining++;
});
console.log(`\nAplicado. Documentos actualizados: ${affected.length}. Restantes con passwordHash: ${remaining}`);
process.exit(remaining === 0 ? 0 : 1);
