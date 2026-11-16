// Explicitly isolated HTTP acceptance: never point this script at a published app.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { completePermissions, setPermission } from "../src/lib/permission-catalog.ts";
import { calculateSale } from "../src/lib/sale-calculation.ts";
import { calculatePriceWithoutTax } from "../src/lib/pricing.ts";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const projectId = "demo-controlinntel-qa", base = process.env.QA_BASE_URL || "http://127.0.0.1:3041";
if (process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080" || process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099" || !["localhost", "127.0.0.1"].includes(new URL(base).hostname)) throw Error("Only local Firebase emulators and localhost are allowed.");
const app = initializeApp({ projectId }, "sales-qa-http"), db = getFirestore(app), auth = getAuth(app);
const results = [], check = name => { results.push({ name, status: "passed" }); console.log("PASS", name); };
const password = "Synthetic-local-QA-Only#42";
async function account(email, profile) {
  let user; try { user = await auth.getUserByEmail(email); } catch { user = await auth.createUser({ email, password }); }
  await db.collection("users").doc(user.uid).set({ ...profile, email, displayName: "QA VENTAS", status: "activo" });
  const response = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, returnSecureToken: true }) });
  const body = await response.json(); assert.equal(response.status, 200); return { uid: user.uid, token: body.idToken };
}
async function request(token, path, body, status = 200) {
  const response = await fetch(base + path, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json(); assert.equal(response.status, status, `${path}: ${JSON.stringify(data)}`); return data;
}
const issue = (token, action, data, status = 200, operationId = randomUUID()) => request(token, "/api/commercial", { action, data, operationId }, status).then(body => body.result);
try {
  // These fixed URLs only clear the dedicated demo emulator project.
  assert.equal((await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: "DELETE" })).ok, true);
  assert.equal((await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${projectId}/accounts`, { method: "DELETE" })).ok, true);
  const owner = await account("qa.sales.owner@example.test", { role: "superadmin", permissions: ["all"] });
  await request(null, "/api/session", undefined, 401);
  let matrix = completePermissions();
  for (const path of ["ventas.enabled", "ventas.submodules.nueva_venta", "ventas.submodules.notas_venta", "ventas.actions.canCreateInvoice", "ventas.actions.canCreateClient", "ventas.actions.canApplyDiscounts", "visibility.canViewFinancialAmounts", "visibility.canViewServicePrices", "visibility.canViewProductPrices"]) matrix = setPermission(matrix, path, true);
  const role = (await request(owner.token, "/api/roles", { action: "create", data: { name: "Ventas QA " + randomUUID().slice(0, 8), status: "activo", modulePermissions: matrix } })).result;
  const sales = await account("qa.sales.user@example.test", { role: "admin", accessRoleId: role.id, permissionOverrides: {} });
  const session = await request(sales.token, "/api/session"); assert.equal(session.accessRoleId, role.id); assert.equal(session.modulePermissions.abonados.enabled, false);
  check("Autenticación real del emulador y rol Ventas sin otros módulos");
  const client = await issue(sales.token, "createClient", { client: { businessName: "PRUEBA CLIENTE VENTA HTTP", identificationType: "RUC", identificationNumber: "1790010938001", email: "client@example.test", phone: "0990000000", address: "QA LOCAL", status: "activo" } });
  await issue(sales.token, "createClient", { client: { ...client, id: undefined } }, 409);
  const wh = (await request(owner.token, "/api/data", { action: "save", entity: "inventoryWarehouses", id: "sales-qa-wh", data: { name: "Bodega QA", isDefault: true } })).result;
  const bank = await issue(owner.token, "createBank", { bankName: "Banco QA", accountNumber: "QA-BANK", accountType: "corriente", status: "activa", initialBalance: 1000 });
  const cash = await issue(owner.token, "createBank", { bankName: "Caja QA", accountNumber: "QA-CASH", accountType: "caja_efectivo", status: "activa", initialBalance: 0 });
  const product = await issue(owner.token, "createProduct", { name: "EQUIPO QA HTTP", sku: "HTTP-" + randomUUID().slice(0, 8), type: "producto", unit: "unidad", salePrice: calculatePriceWithoutTax(150, 15), salePriceConIva: 150, ivaRate: 15, baseCost: 20, tracksStock: true, stockByWarehouse: { [wh.id]: 100 }, minStock: 0, status: "activo" });
  const data = await request(sales.token, "/api/data");
  assert.ok(data.clients.some(row => row.id === client.id)); assert.ok(data.inventoryProducts.some(row => row.id === product.id)); assert.ok(data.bankAccounts.some(row => row.id === bank.id));
  assert.ok(!("baseCost" in data.inventoryProducts.find(row => row.id === product.id))); assert.ok(!("currentBalance" in data.bankAccounts.find(row => row.id === bank.id)));
  assert.deepEqual(data.financialMovements, []); check("Snapshot HTTP: cliente, catálogo, bodegas y cuentas sin costos ni acceso a Finanzas");
  const totals = calculateSale([{ id: "item", productId: product.id, sku: product.sku, name: product.name, quantity: 2, unitPrice: product.salePrice, unitPriceWithTax: 150, ivaRate: 15, discountType: "percentage", discountInput: 10 }], "percentage", 10);
  assert.equal(totals.total, 243);
  const payload = { documentType: "nota_venta", status: "registrado", clientId: client.id, clientName: "NO USAR", clientEmail: "wrong@example.test", date: "2026-10-01", administrativePeriod: "2026-10", warehouseId: wh.id, items: totals.items, paymentMethod: "transferencia", bankAccountId: bank.id, paymentsBreakdown: { efectivo: 20, transferencia: 50, tarjeta: 30, credito: 143 }, transferenciaRef: "TR-HTTP", tarjetaRef: "CARD-HTTP" };
  const id = randomUUID(), invoice = await issue(sales.token, "issueSale", payload, 200, id);
  assert.equal(invoice.total, 243); assert.equal(invoice.clientName, client.businessName); assert.equal(invoice.clientEmail, client.email);
  assert.equal((await issue(sales.token, "issueSale", payload, 200, id)).id, invoice.id);
  const charge = (await db.collection("monthlyCharges").where("invoiceId", "==", invoice.id).get()).docs[0];
  assert.equal(charge.data().balanceRemaining, 143); assert.equal(charge.data().payments.length, 3);
  assert.equal((await db.collection("bankAccounts").doc(cash.id).get()).data().currentBalance, 20);
  assert.equal((await db.collection("bankAccounts").doc(bank.id).get()).data().currentBalance, 1080);
  assert.equal((await db.collection("inventoryProducts").doc(product.id).get()).data().stock, 98);
  check("Venta HTTP de octubre: cantidad 2, doble descuento 10%, total 243 y pagos separados");
  await issue(sales.token, "payCharge", { chargeId: charge.id, amount: 1, bankAccountId: bank.id }, 403);
  await issue(sales.token, "issueSale", { ...payload, paymentMethod: "credito", paymentsBreakdown: undefined, items: [{ ...totals.items[0], unitPrice: 130, unitPriceWithTax: undefined, discount: 0, discountExact: 0 }] }, 403);
  await issue(owner.token, "payCharge", { chargeId: charge.id, amount: 143, bankAccountId: bank.id, method: "transferencia", date: "2026-10-02" });
  assert.equal((await charge.ref.get()).data().balanceRemaining, 0);
  check("Cartera liquidada y denegación real de precios/cobros fuera del permiso");
  await request(owner.token, "/api/roles", { action: "update", id: role.id, expectedVersion: role.version, data: { ...role, modulePermissions: setPermission(matrix, "ventas.actions.canCreateInvoice", false) } });
  await issue(sales.token, "issueSale", payload, 403);
  await request(owner.token, "/api/roles", { action: "update", id: role.id, expectedVersion: role.version + 1, data: { ...role, modulePermissions: matrix } });
  check("Revocar/restaurar permiso del rol cambia la autorización sin renovar el token");
  const direct = await fetch(`http://127.0.0.1:8080/v1/projects/${projectId}/databases/(default)/documents/clients/${client.id}`, { method: "PATCH", headers: { Authorization: "Bearer " + sales.token, "Content-Type": "application/json" }, body: JSON.stringify({ fields: { businessName: { stringValue: "NO AUTORIZADO" } } }) });
  assert.equal(direct.status, 403); assert.equal((await db.collection("clients").doc(client.id).get()).data().businessName, client.businessName);
  await db.collection("users").doc(sales.uid).update({ status: "inactivo" });
  await request(sales.token, "/api/session", undefined, 403);
  await db.collection("users").doc(sales.uid).update({ status: "activo" });
  check("Firestore rechaza escritura directa y una cuenta inactiva pierde acceso");
  console.log("QA_LOCAL_READY", JSON.stringify({ base, clientId: client.id, productId: product.id, roleId: role.id }));
} catch (error) { console.error(error); process.exitCode = 1; }
finally { writeFileSync(join(tmpdir(), "inntel-sales-http-results.json"), JSON.stringify({ environment: "Firebase emulators + real Next HTTP endpoints", cases: results }, null, 2)); await app.delete(); }
