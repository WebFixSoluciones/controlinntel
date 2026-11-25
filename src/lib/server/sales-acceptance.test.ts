import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import type { UserProfile, UserRoleTemplate } from "@/types";
import { executeCommercial, type CommercialCommand } from "./commercial.ts";
import { Database } from "./testing/commercial-database.ts";
import { completePermissions, setPermission } from "../permission-catalog.ts";
import { resolveAssignedRole } from "../role-access.ts";
import { calculateSale } from "../sale-calculation.ts";
import { calculatePriceWithoutTax } from "../pricing.ts";
import { cents } from "../commercial-core.ts";
import { activeReceivables } from "../financial-summary.ts";
import { fiscalContent } from "./sri-documents.ts";
import { DEFAULT_INNTEL_SRI_CONFIG, generarClaveAccesoSRI } from "../sri-service.ts";

const owner: UserProfile = { uid: "qa-owner", email: "owner@example.test", displayName: "QA", role: "superadmin", status: "activo", permissions: ["all"] };
function seller() {
  let matrix = completePermissions();
  for (const key of ["ventas.enabled", "ventas.submodules.nueva_venta", "ventas.submodules.notas_venta", "ventas.actions.canCreateInvoice", "ventas.actions.canCreateClient", "ventas.actions.canApplyDiscounts", "visibility.canViewFinancialAmounts", "visibility.canViewProductPrices", "visibility.canViewServicePrices"]) matrix = setPermission(matrix, key, true);
  const role: UserRoleTemplate = { id: "qa-sales", name: "Ventas QA", baseRole: "admin", status: "activo", version: 1, permissionModelVersion: 2, modulePermissions: matrix };
  return resolveAssignedRole({ ...owner, uid: "qa-seller", role: "admin", accessRoleId: role.id, permissionOverrides: {} }, role);
}
const fixture = () => new Database({
  inventoryProducts: [
    { id: "product", name: "Equipo QA", sku: "P-QA", type: "producto", salePrice: calculatePriceWithoutTax(150, 15), salePriceConIva: 150, ivaRate: 15, baseCost: 20, tracksStock: true, stock: 100, stockByWarehouse: { wh: 100 }, status: "activo" },
    { id: "service", name: "Servicio QA", sku: "S-QA", type: "servicio", salePrice: calculatePriceWithoutTax(5, 15), salePriceConIva: 5, ivaRate: 15, tracksStock: false, stock: 0, baseCost: 0, status: "activo" },
  ], inventoryWarehouses: [{ id: "wh", name: "Bodega QA" }],
  bankAccounts: [{ id: "bank", bankName: "Banco QA", accountType: "corriente", status: "activa", currentBalance: 1000, initialBalance: 1000 }, { id: "cash", bankName: "Caja QA", accountType: "caja_efectivo", status: "activa", currentBalance: 0, initialBalance: 0 }],
});
const command = (db: Database, user: UserProfile, action: CommercialCommand["action"], data: Record<string, any>, operationId = randomUUID()) => executeCommercial(user, { action, data, operationId }, db as unknown as Firestore);
const clientData = (number = "1790010938001") => ({ businessName: "PRUEBA CLIENTE QA VENTAS", identificationType: "RUC", identificationNumber: number, email: "client@example.test", phone: "0990000000", address: "DIRECCIÓN QA", status: "activo" });
const note = (clientId: string, items: any[], extra = {}) => ({ clientId, documentType: "nota_venta", status: "registrado", date: "2026-10-01", administrativePeriod: "2026-10", warehouseId: "wh", items, paymentMethod: "credito", ...extra });
const line = (db: Database, productId = "product", quantity = 1, pct = 0) => {
  const product = db.row("inventoryProducts", productId);
  return calculateSale([{ id: "item", productId, name: product.name, sku: product.sku, quantity, unitPrice: product.salePrice, unitPriceWithTax: product.salePriceConIva, ivaRate: product.ivaRate, discountType: "percentage", discountInput: pct }]).items;
};

test("QA completo: vendedor con solo Ventas crea cliente, emite octubre, cobra, asigna cliente correcto y conserva stock/cartera", async () => {
  const db = fixture(), user = seller();
  const a = await command(db, user, "createClient", { client: clientData() });
  const b = await command(db, user, "createClient", { client: { ...clientData("QA-B"), identificationType: "PASAPORTE", businessName: "OTRO CLIENTE QA" } });
  assert.equal(db.list("billingInvoices").length, 0, "Crear cliente no genera una venta automática");
  const payload = note(a.id, line(db, "product", 2, 10), { clientName: b.businessName, clientRuc: b.identificationNumber, clientEmail: "wrong@example.test" });
  const invoice = await command(db, user, "issueSale", payload);
  assert.equal(invoice.total, 270); assert.equal(invoice.clientId, a.id); assert.equal(invoice.clientName, a.businessName); assert.equal(invoice.clientRuc, a.identificationNumber); assert.equal(invoice.clientEmail, a.email);
  const charge = db.list("monthlyCharges")[0];
  assert.equal(charge.month, 10); assert.equal(charge.clientId, a.id); assert.equal(charge.balanceRemaining, 270);
  assert.equal(db.row("clients", b.id).currentBalance, 0); assert.equal(db.row("clients", a.id).currentBalance, 270);
  assert.equal(db.row("inventoryProducts", "product").stock, 98);
  assert.equal(db.list("inventoryKardex")[0].exitQuantity, 2);
  await command(db, owner, "payCharge", { chargeId: charge.id, amount: 70, method: "transferencia", bankAccountId: "bank", date: "2026-10-02", reference: " 000070 " });
  await command(db, owner, "payCharge", { chargeId: charge.id, amount: 200, method: "transferencia", bankAccountId: "bank", date: "2026-10-03" });
  assert.equal(db.row("monthlyCharges", charge.id).balanceRemaining, 0); assert.equal(db.row("monthlyCharges", charge.id).status, "pagado"); assert.equal(db.row("clients", a.id).currentBalance, 0); assert.equal(db.row("bankAccounts", "bank").currentBalance, 1270);
  const firstPayment = db.row("monthlyCharges", charge.id).payments[0];
  assert.equal(firstPayment.reference, "000070");
  assert.equal(db.row("financialMovements", firstPayment.movementId).referenceNumber, "000070");
  await assert.rejects(command(db, user, "editSale", { id: invoice.id, updates: { clientId: b.id } }), { status: 403 });
});

test("QA: cliente con contrato asignado admite venta administrativa y cantidades fraccionarias con descuento", async () => {
  const db = fixture(), user = seller(), client = await command(db, user, "createClient", { client: clientData() });
  db.rows.set("clientServices/contract", { id: "contract", clientId: client.id, planId: "service", inventoryProductId: "service", status: "activo" });
  const invoice = await command(db, user, "issueSale", note(client.id, line(db, "service", 0.5, 10)));
  assert.equal(invoice.total, 2.25); assert.equal(invoice.discountTotal, 0.21);
  assert.equal(db.list("clientServices").length, 1); assert.equal(db.list("billingPeriods").length, 0);
  assert.equal(db.list("inventoryKardex").length, 0);
  await assert.rejects(command(db, user, "issueSale", note(client.id, [{ ...line(db, "service")[0], serviceId: "contract", unitPrice: 1, unitPriceWithTax: undefined }], { status: "borrador" })), { status: 403 });
});

test("QA: pago combinado conserva efectivo, banco, tarjeta, referencias y deuda a crédito", async () => {
  const db = fixture(), user = seller(), client = await command(db, user, "createClient", { client: clientData() });
  const invoice = await command(db, user, "issueSale", note(client.id, line(db), { paymentMethod: "transferencia", bankAccountId: "bank", transferenciaRef: "TR-QA", tarjetaRef: "CARD-QA", paymentsBreakdown: { efectivo: 20, transferencia: 50, tarjeta: 30, credito: 50 } }));
  assert.equal(invoice.total, 150); assert.equal(db.row("bankAccounts", "cash").currentBalance, 20); assert.equal(db.row("bankAccounts", "bank").currentBalance, 1080);
  const charge = db.list("monthlyCharges")[0]; assert.equal(charge.paidAmount, 100); assert.equal(charge.balanceRemaining, 50);
  assert.deepEqual(charge.payments.map((p: any) => [p.method, p.amount, p.reference]), [["efectivo", 20, ""], ["transferencia", 50, "TR-QA"], ["tarjeta", 30, "CARD-QA"]]);
  assert.equal(db.list("payments").length, 3); assert.equal(db.row("clients", client.id).currentBalance, 50);
});

test("QA: editar notas y borradores exige el permiso de edición de documentos y precios", async () => {
  const db = fixture(), user = seller(), client = await command(db, user, "createClient", { client: clientData() });
  const editor = user;
  for (const status of ["registrado", "borrador"]) {
    const invoice = await command(db, user, "issueSale", note(client.id, line(db), { status }));
    const before = JSON.stringify([...db.rows]);
    for (const changes of [{ unitPrice: 1, unitPriceWithTax: undefined }, { ivaRate: 0, unitPriceWithTax: undefined }]) {
      await assert.rejects(command(db, editor, "editSale", { id: invoice.id, updates: { items: [{ ...invoice.items[0], ...changes }] } }), { status: 403 });
      assert.equal(JSON.stringify([...db.rows]), before, "La denegación no altera inventario ni cartera");
    }
    await assert.rejects(command(db, editor, "editSale", { id: invoice.id, updates: { items: [{ ...invoice.items[0], quantity: 2 }] } }), { status: 403 });
    const priceEditor = { ...editor, modulePermissions: setPermission(editor.modulePermissions!, "ventas.actions.canEditPrices", true) };
    const updated = await command(db, priceEditor, "editSale", { id: invoice.id, updates: { items: [{ ...invoice.items[0], quantity: 2 }] } });
    assert.equal(updated.total, 300);
    const changed = await command(db, priceEditor, "editSale", { id: invoice.id, updates: { items: [{ ...updated.items[0], unitPrice: 100, unitPriceWithTax: undefined }] } });
    assert.equal(changed.total, 230);
  }
});

test("QA: reintentos/concurrencia no duplican nota, stock ni cobros; error de stock revierte todo", async () => {
  const db = fixture(), user = seller(), client = await command(db, user, "createClient", { client: clientData() });
  const payload = note(client.id, line(db), { paymentMethod: "efectivo", bankAccountId: "cash" }), id = randomUUID();
  const [one, retry] = await Promise.all([command(db, user, "issueSale", payload, id), command(db, user, "issueSale", payload, id)]);
  assert.equal(one.id, retry.id); assert.equal(db.list("billingInvoices").length, 1); assert.equal(db.list("payments").length, 1); assert.equal(db.row("inventoryProducts", "product").stock, 99);
  const before = JSON.stringify([...db.rows]);
  await assert.rejects(command(db, user, "issueSale", note(client.id, line(db, "product", 1000))), /Stock insuficiente/);
  assert.equal(JSON.stringify([...db.rows]), before);
  await assert.rejects(command(db, user, "issueSale", note(client.id, line(db), { paymentsBreakdown: { efectivo: -1, transferencia: 151, credito: 0 } })), /positivos/);
  assert.equal(JSON.stringify([...db.rows]), before);
});

test("QA: descuentos, precios, alta, cobros y módulos se autorizan por función, no solo por nombre del rol", async () => {
  const db = fixture(), user = seller(), client = await command(db, user, "createClient", { client: clientData() });
  const without = (path: string) => ({ ...user, modulePermissions: setPermission(user.modulePermissions!, path, false) });
  await assert.rejects(command(db, without("ventas.actions.canCreateClient"), "createClient", { client: { ...clientData("QA-C"), identificationType: "PASAPORTE" } }), { status: 403 });
  await assert.rejects(command(db, user, "createClient", { client: clientData(), service: { planId: "service" } }), { status: 403 });
  await assert.rejects(command(db, without("ventas.actions.canApplyDiscounts"), "issueSale", note(client.id, line(db, "service", 1, 10))), { status: 403 });
  await assert.rejects(command(db, user, "issueSale", note(client.id, [{ ...line(db)[0], unitPrice: 1, unitPriceWithTax: undefined }])), { status: 403 });
  await assert.rejects(command(db, without("ventas.actions.canCreateInvoice"), "issueSale", note(client.id, line(db))), { status: 403 });
  await assert.rejects(command(db, without("ventas.enabled"), "issueSale", note(client.id, line(db))), { status: 403 });
  await assert.rejects(command(db, { ...user, status: "inactivo" }, "issueSale", note(client.id, line(db))), { status: 403 });
  const invoice = await command(db, user, "issueSale", note(client.id, line(db)));
  await assert.rejects(command(db, user, "payCharge", { chargeId: db.list("monthlyCharges")[0].id, amount: 1, bankAccountId: "bank" }), { status: 403 });
  assert.equal(invoice.total, 150);
});

test("QA: IVA 5%, 15% y 0% conservan total al editar; anular elimina cartera y restaura stock", async () => {
  const db = fixture(), client = await command(db, owner, "createClient", { client: clientData() });
  const items = [0, 5, 15].map((ivaRate, id) => ({ id: String(id), productId: "service", name: "QA", unitPrice: 10, quantity: 1, ivaRate }));
  const sale = await command(db, owner, "issueSale", note(client.id, items)); assert.equal(sale.total, 32);
  const edited = await command(db, owner, "editSale", { id: sale.id, updates: { items: items.map(item => ({ ...item, quantity: 2 })) } }); assert.equal(edited.total, 64);
  assert.deepEqual(edited.basesByRate, { "0": 20, "5": 20, "15": 20 });
  assert.equal(cents(db.list("monthlyCharges")[0].total), cents(edited.total));
  await command(db, owner, "cancelSale", { id: sale.id }); assert.equal(activeReceivables(db.list("monthlyCharges")).length, 0); assert.equal(db.row("clients", client.id).currentBalance, 0);
});

test("QA: altas con cédula, RUC natural/societario/público y pasaporte; cliente retirado no admite ventas", async () => {
  const db = fixture(), user = seller();
  for (const [type, number] of [["CEDULA", "1710034065"], ["RUC", "1710034065001"], ["RUC", "1790010938001"], ["RUC", "1760001550001"], ["PASAPORTE", "QA-PASS"]]) {
    const client = await command(db, user, "createClient", { client: { ...clientData(number), identificationType: type } });
    assert.equal(client.identificationNumber, number);
    await assert.rejects(command(db, user, "createClient", { client: { ...clientData(number), identificationType: type } }), /Ya existe/);
  }
  assert.equal(db.list("billingInvoices").length, 0);
  const retired = db.list("clients")[0]; db.rows.set("clients/" + retired.id, { ...retired, status: "retirado" });
  await assert.rejects(command(db, user, "issueSale", note(retired.id, line(db))), /retirado/);
});

test("QA: descuento total genera saldo cero y un faltante de un centavo no se acepta como pago completo", async () => {
  const db = fixture(), user = seller(), client = await command(db, user, "createClient", { client: clientData() });
  const free = await command(db, user, "issueSale", note(client.id, line(db, "service", 1, 100)));
  assert.equal(free.total, 0); assert.equal(db.list("monthlyCharges")[0].status, "pagado");
  await assert.rejects(command(db, user, "issueSale", note(client.id, line(db), { bankAccountId: "bank", paymentsBreakdown: { transferencia: 149.99, credito: 0 } })), /distribución/);
});

test("QA: administrador general emite y la preparación fiscal conserva cliente, descuentos y total de la nota", async () => {
  const db = fixture(), admin: UserProfile = { ...owner, role: "admin", permissions: ["manage_clients", "manage_finance"] };
  const client = await command(db, admin, "createClient", { client: clientData() });
  const item = { id: "item", productId: "product", name: "QA", quantity: 2, unitPrice: calculatePriceWithoutTax(150, 15), unitPriceWithTax: 150, ivaRate: 15, discountType: "percentage", discountInput: 10 };
  const totals = calculateSale([item], "percentage", 10);
  const invoice = await command(db, admin, "issueSale", note(client.id, totals.items));
  const before = db.list("inventoryKardex").length;
  const fiscal = await db.runTransaction(tx => fiscalContent(db as unknown as Firestore, tx, { kind: "factura", saleId: invoice.id }, DEFAULT_INNTEL_SRI_CONFIG));
  assert.equal(fiscal.data.total, 243); assert.equal(fiscal.data.clientId, client.id); assert.equal(fiscal.data.relatedSaleId, invoice.id);
  assert.equal(db.list("inventoryKardex").length, before, "Preparar la factura no repite la salida de inventario");
  const config = DEFAULT_INNTEL_SRI_CONFIG;
  db.rows.set("billingInvoices/fiscal-qa", { ...fiscal.data, id: "fiscal-qa", documentType: "factura", status: "autorizada", estadoSRI: "AUTORIZADO", xmlAutorizado: "<autorizado/>", claveAcceso: generarClaveAccesoSRI({ fechaEmision: "2026-10-01", ruc: config.ruc, ambiente: config.ambiente, secuencial: 1 }) });
  const credit = await db.runTransaction(tx => fiscalContent(db as unknown as Firestore, tx, { kind: "nota_credito", invoiceId: "fiscal-qa", reason: "Devolución parcial QA", items: [{ id: "item", quantity: 1 }] }, config));
  assert.equal(credit.data.total, 121.5);

});
