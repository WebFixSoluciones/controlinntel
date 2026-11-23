import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import type { UserProfile } from "@/types";
import { executeCommercial, type CommercialCommand } from "./commercial.ts";
import { Database } from "./testing/commercial-database.ts";
import { completePermissions, setPermission } from "../permission-catalog.ts";
import { resolveAssignedRole } from "../role-access.ts";
import { save } from "./operations.ts";
import { companyPeriodReport } from "../company-reporting.ts";
import { reconcileCommercial } from "../reconciliation.ts";

const owner: UserProfile = { uid: "qa", email: "qa@example.test", displayName: "QA", role: "superadmin", status: "activo", permissions: ["all"] };
const fixture = () => new Database({ suppliers: [{ id: "s", razonSocial: "Proveedor", ruc: "1191796900001", status: "activo" }], bankAccounts: [{ id: "bank", bankName: "QA", currentBalance: 2000, status: "activa" }], inventoryProducts: [{ id: "p", name: "Equipo", type: "producto", tracksStock: true, stock: 10, baseCost: 10, stockByWarehouse: { wh: 10 } }], inventoryWarehouses: [{ id: "wh", name: "Central" }] });
const command = (db: Database, action: string, data: any, operationId = randomUUID(), user = owner) => executeCommercial(user, { action, data, operationId } as CommercialCommand, db as unknown as Firestore);
const create = (db: Database, extra = {}) => command(db, "purchase", { supplierId: "s", documentNumber: "001-001-000000161", date: "2026-08-28", paymentCondition: "credito", items: [{ id: "line", name: "Servicio", quantity: 1, unitCost: 960, discount: 0, ivaRate: 15 }], ...extra });
const correction = (invoice: any, extra = {}) => ({ id: invoice.id, expectedVersion: invoice.version, ...extra });

test("compra: edita una factura manual sin movimientos y recalcula deuda e impuestos", async () => {
  const db = fixture(), invoice = await create(db);
  const result = await command(db, "editPurchase", correction(invoice, { updates: { documentNumber: "001-001-000000162", items: [{ id: "line", name: "Servicio corregido", quantity: 2, unitCost: 100, discount: 10, ivaRate: 15 }], notes: "Corregida" } }));
  assert.equal(result.total, 218.5); assert.equal(result.ivaAmount, 28.5); assert.equal(result.balanceRemaining, 218.5);
  assert.equal(result.items[0].unitCost, 100); assert.equal(result.notes, "Corregida");
  assert.equal(db.list("financialMovements").length, 0); assert.equal(db.row("bankAccounts", "bank").currentBalance, 2000);
  await assert.rejects(create(db, { documentNumber: "001-001-000000162" }), { status: 409 });
});

test("compra: elimina una prueba pagada una sola vez y conserva auditoría", async () => {
  const db = fixture(), invoice = await create(db, { paymentCondition: "contado", bankAccountId: "bank" });
  const op = randomUUID(), payload = correction(invoice, { reason: "Factura de pruebas" });
  await command(db, "deletePurchase", payload, op);
  await command(db, "deletePurchase", payload, op);
  assert.equal(db.row("bankAccounts", "bank").currentBalance, 2000);
  assert.equal(db.row("purchaseInvoices", invoice.id).status, "anulada");
  assert.equal(db.row("purchaseInvoices", invoice.id).balanceRemaining, 0);
  assert.equal(db.list("supplierPayments")[0].status, "anulado");
  assert.equal(db.list("financialMovements")[0].status, "anulado");
  assert.equal(db.row("purchaseInvoices", invoice.id).cancellationReason, "Factura de pruebas");
  assert.equal(db.list("operationLog").filter(row => row.type === "deletePurchase").length, 1);
  const report = companyPeriodReport({ purchaseInvoices: db.list("purchaseInvoices"), financialMovements: db.list("financialMovements"), bankAccounts: db.list("bankAccounts") });
  assert.equal(report.purchaseTotal, 0); assert.equal(report.outgoing, 0); assert.equal(report.payables, 0);
  await assert.rejects(command(db, "paySupplier", { purchaseInvoiceId: invoice.id, amount: 1, bankAccountId: "bank" }), { status: 409 });
  await assert.rejects(command(db, "supplierCredit", { purchaseInvoiceId: invoice.id, supplierId: "s", total: 1 }), { status: 409 });
});

test("compra: anula aplicaciones de saldo a favor y libera el crédito del proveedor", async () => {
  const db = fixture(), invoice = await create(db);
  db.rows.set("supplierCredits/credit", { id: "credit", supplierId: "s", amount: 100, remaining: 100, status: "available" });
  await command(db, "paySupplier", { purchaseInvoiceId: invoice.id, amount: 100, supplierCreditId: "credit" });
  await command(db, "deletePurchase", correction(db.row("purchaseInvoices", invoice.id), { reason: "Pruebas" }));
  assert.equal(db.row("supplierCredits", "credit").remaining, 100);
  assert.equal(db.row("bankAccounts", "bank").currentBalance, 2000);
});

test("compra: revierte recepción sin movimientos posteriores y restaura valoración", async () => {
  const db = fixture(), invoice = await create(db, { items: [{ id: "line", productId: "p", warehouseId: "wh", name: "Equipo", quantity: 2, unitCost: 20, ivaRate: 15 }] });
  await command(db, "deletePurchase", correction(invoice, { reason: "Pruebas" }));
  assert.equal(db.row("inventoryProducts", "p").stock, 10);
  assert.ok(Math.abs(db.row("inventoryProducts", "p").baseCost - 10) < 0.000001);
  assert.equal(db.list("inventoryKardex").filter(row => row.type === "PURCHASE_CANCELLATION").length, 1);
});

test("compra: bloquea anulación con movimientos posteriores de inventario sin tocar datos", async () => {
  const db = fixture(), invoice = await create(db, { items: [{ id: "line", productId: "p", warehouseId: "wh", name: "Equipo", quantity: 2, unitCost: 20, ivaRate: 15 }] });
  db.rows.set("inventoryKardex/later", { id: "later", productId: "p", date: "2026-11-23", createdAt: "2099-01-01T00:00:00Z", type: "SALE", referenceId: "other" });
  const before = structuredClone([...db.rows]);
  await assert.rejects(command(db, "deletePurchase", correction(invoice, { reason: "Pruebas" })), { status: 409 });
  assert.deepEqual([...db.rows], before);
});

test("compra: rechaza pago histórico sin movimiento verificable", async () => {
  const db = fixture(), invoice = await create(db, { paymentCondition: "contado", bankAccountId: "bank" });
  db.rows.delete("financialMovements/" + db.list("supplierPayments")[0].movementId);
  const before = structuredClone([...db.rows]);
  await assert.rejects(command(db, "deletePurchase", correction(invoice, { reason: "Pruebas" })), { status: 409 });
  assert.deepEqual([...db.rows], before);
});

test("compra: retenciones y notas vinculadas bloquean eliminación", async () => {
  for (const collection of ["purchaseWithholdings", "billingWithholdings", "supplierCreditNotes", "supplierDebitNotes"]) {
    const db = fixture(), invoice = await create(db);
    db.rows.set(collection + "/linked", { id: "linked", purchaseInvoiceId: invoice.id });
    await assert.rejects(command(db, "deletePurchase", correction(invoice, { reason: "Pruebas" })), { status: 409 });
    assert.notEqual(db.row("purchaseInvoices", invoice.id).status, "anulada");
  }
});

test("compra: una edición administrativa de factura pagada no duplica pagos", async () => {
  const db = fixture(), invoice = await create(db, { paymentCondition: "contado", bankAccountId: "bank", claveAcceso: "1".repeat(49) });
  const result = await command(db, "editPurchase", correction(invoice, { updates: { notes: "Revisada", dueDate: "2026-11-30" } }));
  assert.equal(result.notes, "Revisada"); assert.equal(result.total, 1104);
  assert.equal(db.list("supplierPayments").length, 1);
  await assert.rejects(command(db, "editPurchase", correction(result, { updates: { items: [{ name: "Otro", quantity: 1, unitCost: 1 }] } })), { status: 409 });
  await assert.rejects(command(db, "editPurchase", correction(result, { updates: { paidAmount: 0 } })), { status: 400 });
});

test("compra: versión obsoleta y fallo de transacción no aplican efectos parciales", async () => {
  const db = fixture(), invoice = await create(db);
  await assert.rejects(command(db, "deletePurchase", { id: invoice.id, expectedVersion: 999, reason: "Pruebas" }), { status: 409 });
  const before = structuredClone([...db.rows]); db.failCommit = true;
  await assert.rejects(command(db, "deletePurchase", correction(invoice, { reason: "Pruebas" })), /Injected commit failure/);
  assert.deepEqual([...db.rows], before);
});

test("compra: permisos de registro no conceden edición o eliminación", async () => {
  const db = fixture(), invoice = await create(db);
  let matrix = completePermissions();
  for (const path of ["compras.enabled", "compras.submodules.historial_compras", "compras.actions.canRegisterPurchase", "visibility.canViewFinancialAmounts"]) matrix = setPermission(matrix, path, true);
  const role = { id: "qa-role", name: "QA", baseRole: "admin" as const, status: "activo" as const, version: 1, permissionModelVersion: 2 as const, modulePermissions: matrix };
  const user = resolveAssignedRole({ ...owner, uid: "limited", role: "admin", accessRoleId: role.id, permissionOverrides: {} }, role);
  await assert.rejects(command(db, "editPurchase", correction(invoice, { updates: { notes: "x" } }), randomUUID(), user), { status: 403 });
  await assert.rejects(command(db, "deletePurchase", correction(invoice, { reason: "Pruebas" }), randomUUID(), user), { status: 403 });
});

test("compra: el guardado genérico no evita la validación de edición", async () => {
  const db = fixture(), invoice = await create(db);
  await assert.rejects(save(owner, "purchaseInvoices", { notes: "Cambio sin comando" }, invoice.id, invoice.version, db as unknown as Firestore), { status: 400 });
});

test("compra: dos eliminaciones concurrentes no duplican restitución bancaria", async () => {
  const db = fixture(), invoice = await create(db, { paymentCondition: "contado", bankAccountId: "bank" });
  const results = await Promise.allSettled([command(db, "deletePurchase", correction(invoice, { reason: "Prueba A" })), command(db, "deletePurchase", correction(invoice, { reason: "Prueba B" }))]);
  assert.equal(results.filter(row => row.status === "fulfilled").length, 1);
  assert.equal(db.row("bankAccounts", "bank").currentBalance, 2000);
});

test("compra: una referencia bancaria huérfana bloquea reversión completa", async () => {
  const db = fixture(), invoice = await create(db, { paymentCondition: "contado", bankAccountId: "bank" });
  db.rows.set("financialMovements/orphan", { id: "orphan", purchaseInvoiceId: invoice.id, type: "egreso", amount: 5 });
  const before = structuredClone([...db.rows]);
  await assert.rejects(command(db, "deletePurchase", correction(invoice, { reason: "Prueba" })), { status: 409 });
  assert.deepEqual([...db.rows], before);
});

test("compra: editar no incorpora stock ni acepta un comprobante duplicado histórico", async () => {
  const db = fixture(), invoice = await create(db);
  db.rows.set("purchaseInvoices/legacy", { id: "legacy", supplierId: "s", documentNumber: "001-001-000000162" });
  await assert.rejects(command(db, "editPurchase", correction(invoice, { updates: { documentNumber: "001-001-000000162" } })), { status: 409 });
  await assert.rejects(command(db, "editPurchase", correction(invoice, { updates: { items: [{ productId: "p", name: "Equipo", quantity: 1, unitCost: 20, ivaRate: 15 }] } })), { status: 409 });
});

test("compra: corregir un número libera la reserva anterior para otra factura", async () => {
  const db = fixture(), invoice = await create(db);
  await command(db, "editPurchase", correction(invoice, { updates: { documentNumber: "001-001-000000162" } }));
  const another = await create(db);
  assert.notEqual(another.id, invoice.id);
  assert.equal(another.documentNumber, "001-001-000000161");
});

test("compra: la reversión bancaria concilia con apertura y movimientos activos", async () => {
  const db = fixture(); db.row("bankAccounts", "bank").initialBalance = 2000;
  const invoice = await create(db, { paymentCondition: "contado", bankAccountId: "bank" });
  await command(db, "deletePurchase", correction(invoice, { reason: "Prueba" }));
  assert.deepEqual(reconcileCommercial({ bankAccounts: db.list("bankAccounts"), financialMovements: db.list("financialMovements") }), []);
});
