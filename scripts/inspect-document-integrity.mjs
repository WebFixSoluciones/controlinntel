// Read-only incident audit. Never writes to Firestore or document storage.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.loadEnvFile(".env.local");
if (process.env.FIRESTORE_EMULATOR_HOST) throw Error("Live read audit cannot use an emulator");
if (process.env.GOOGLE_APPLICATION_CREDENTIALS && !fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)
  && !process.env.FIREBASE_SERVICE_ACCOUNT_JSON && !process.env.GOOGLE_CREDENTIALS_JSON) {
  throw Error("La credencial configurada no existe en este computador. Auditoría detenida sin modificar datos.");
}
const { adminServices } = await import("../src/lib/server/admin.ts");
const { getStorage } = await import("firebase-admin/storage");
const { db, app } = adminServices();
console.log("Starting read-only audit", db.projectId);
const output = path.join(os.tmpdir(), `inntel-document-audit-${Date.now()}`);
fs.mkdirSync(output);
const report = { project: db.projectId, capturedAt: new Date().toISOString(), collections: {}, storage: {} };
for (const name of ["arcotelFiles", "clientDocuments"]) {
  const snap = await db.collection(name).get();
  const rows = snap.docs.map(d => ({ ...d.data(), id: d.id }));
  fs.writeFileSync(path.join(output, `${name}.json`), JSON.stringify(rows, null, 2));
  const days = {}, clients = new Set();
  for (const row of rows) {
    const day = String(row.uploadedAt || row.createdAt || "sin-fecha").slice(0, 10);
    days[day] = (days[day] || 0) + 1;
    if (row.clientId) clients.add(row.clientId);
  }
  report.collections[name] = { count: rows.length, clients: clients.size, byDay: days,
    exampleClientFiles: rows.filter(r => r.clientId === "02a3692f-29f6-43ee-87ba-ca931a9344f8").map(r => ({ id: r.id, fileName: r.fileName, subsystem: r.subsystem, uploadedAt: r.uploadedAt })) };
  console.log(name, JSON.stringify(report.collections[name]));
}
try {
  const bucket = getStorage(app).bucket(process.env.DOCUMENTS_BUCKET || `${db.projectId}-documents`);
  for (const prefix of ["arcotel/", "clients/"]) {
    const [files] = await bucket.getFiles({ prefix });
    const objects = files.map(f => ({ name: f.name, size: f.metadata.size, generation: f.metadata.generation, created: f.metadata.timeCreated, sha256: f.metadata.metadata?.sha256 }));
    fs.writeFileSync(path.join(output, prefix.replace("/", "") + "-objects.json"), JSON.stringify(objects, null, 2));
    report.storage[prefix] = { count: objects.length };
    console.log("Storage", prefix, objects.length);
  }
} catch (e) { report.storage.error = String(e.message); console.log("Storage audit unavailable", e.code); }
// A date bound avoids scanning years of unrelated commercial records.
const logs = await db.collection("operationLog").where("timestamp", ">=", "2026-11-17").get();
const relevant = logs.docs.map(d => ({ ...d.data(), id: d.id })).filter(l => l.effects?.some(e => ["arcotelFiles", "clientDocuments"].includes(e.collection)));
fs.writeFileSync(path.join(output, "document-operations.json"), JSON.stringify(relevant, null, 2));
report.operations = { count: relevant.length, deletions: relevant.flatMap(l => l.effects.filter(e => ["arcotelFiles", "clientDocuments"].includes(e.collection) && e.after === null).map(e => ({ collection: e.collection, id: e.id, timestamp: l.timestamp, actorId: l.actorId }))) };
fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
console.log("Report", JSON.stringify(report));
console.log("Private local evidence:", output);
