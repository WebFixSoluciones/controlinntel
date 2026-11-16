import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { completePermissions, setPermission } from "../src/lib/permission-catalog.ts";
const base = "http://127.0.0.1:3042";
if (process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080" || process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099") throw Error("Only local emulators are allowed");
const app = initializeApp({ projectId: "demo-controlinntel-qa" }, "sri-http-qa"), db = getFirestore(app), auth = getAuth(app);
const password = "Synthetic-local-QA-Only#42";
async function account(email, profile) {
  let user; try { user = await auth.getUserByEmail(email); } catch { user = await auth.createUser({ email, password }); }
  await db.collection("users").doc(user.uid).set({ ...profile, email, status: "activo", displayName: "QA SRI AISLADO" });
  const login = await (await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, returnSecureToken: true }) })).json();
  assert.ok(login.idToken); return { uid: user.uid, token: login.idToken };
}
async function request(token, path, method = "GET", body, status = 200) {
  const response = await fetch(base + path, { method, headers: { ...(token ? { Authorization: "Bearer " + token } : {}), "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const result = await response.json(); assert.equal(response.status, status, JSON.stringify(result)); return result;
}
const owner = await account("qa.sri.owner@example.test", { role: "superadmin", permissions: ["all"] });
let matrix = completePermissions();
for (const key of ["abonados.enabled", "abonados.submodules.historial_ventas", "visibility.canViewFinancialAmounts"]) matrix = setPermission(matrix, key, true);
const restricted = await account("qa.history@example.test", { role: "admin", permissions: [], modulePermissions: matrix, permissionModelVersion: 2 });
const invoices = await db.collection("billingInvoices").where("documentType", "==", "factura").get();
const invoice = invoices.docs.find(doc => doc.data().estadoSRI === "AUTORIZADO"); assert.ok(invoice);
const row = invoice.data();
const data = await request(owner.token, "/api/data");
assert.ok(data.billingInvoices.some(item => item.id === invoice.id && item.authorizationVerified));
assert.ok(!JSON.stringify(data).includes('"xmlFirmado"')); assert.ok(!JSON.stringify(data).includes('"pkcs12Base64"'));
const xml = await request(owner.token, `/api/sri/emitir?kind=factura&id=${invoice.id}`); assert.match(xml.xml, /<estado>AUTORIZADO<\/estado>/);
const before = (await db.collection("sequences").get()).docs.map(doc => doc.data());
const repeat = await request(owner.token, "/api/sri/emitir", "POST", { kind: "factura", saleId: row.relatedSaleId });
assert.equal(repeat.document.id, invoice.id); assert.equal(repeat.newlyAuthorized, false);
assert.deepEqual((await db.collection("sequences").get()).docs.map(doc => doc.data()), before);
await request(owner.token, `/api/sri/emitir?id=${invoice.id}`, "DELETE", undefined, 409);
await request(owner.token, "/api/sri/emitir", "POST", { action: "reenviar_correo", id: invoice.id }, 409);
await request(restricted.token, `/api/sri/emitir?kind=factura&id=${invoice.id}`, "GET", undefined, 403);
await request(undefined, `/api/sri/emitir?kind=factura&id=${invoice.id}`, "GET", undefined, 401);
const history = await request(restricted.token, `/api/clients/history?clientId=${row.clientId}`);
assert.equal(history.count, 1); assert.equal(history.total, 2); assert.equal(history.pending, 2);
assert.equal(history.rows.length, 1); assert.equal(history.rows[0].kind, "Nota de venta");
await db.collection("users").doc(restricted.uid).update({ modulePermissions: setPermission(matrix, "abonados.submodules.historial_ventas", false) });
await request(restricted.token, `/api/clients/history?clientId=${row.clientId}`, "GET", undefined, 403);
console.log(JSON.stringify({ passed: true, checks: ["real Auth/Firestore emulator HTTP", "verified XML download", "idempotent repeat without new sequence", "dependent test deletion blocked", "test email blocked", "fiscal permissions and unauthenticated rejection", "history-only profile without Sales or SRI", "one operation instead of note + invoice + receivable", "history permission revocation on same token"] }));
await db.terminate();
