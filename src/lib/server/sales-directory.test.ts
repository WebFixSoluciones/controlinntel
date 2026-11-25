import test from "node:test";
import assert from "node:assert/strict";
import type { Firestore } from "firebase-admin/firestore";
import type { UserProfile } from "@/types";
import { snapshot } from "./operations.ts";
import { canAccessRoute } from "../permissions.ts";
import { completePermissions, setPermission } from "../permission-catalog.ts";

class ReadDatabase {
  rows: Record<string, any[]>;
  constructor(rows: Record<string, any[]>) { this.rows = rows; }
  collection(name: string) {
    const query = (fields?: string[]): any => ({
      select: (...keys: string[]) => query(keys), orderBy: () => query(fields), limit: () => query(fields),
      get: async () => { const docs = (this.rows[name] || []).map(row => ({ id: row.id, data: () => fields ? Object.fromEntries(fields.filter(key => key in row).map(key => [key, row[key]])) : structuredClone(row) })); return { docs, size: docs.length, empty: !docs.length }; },
    });
    return query();
  }
}
const profile = () => {
  let matrix = completePermissions();
  for (const path of ["ventas.enabled", "ventas.submodules.nueva_venta", "ventas.actions.canCreateInvoice", "visibility.canViewFinancialAmounts", "visibility.canViewServicePrices", "visibility.canViewProductPrices"]) matrix = setPermission(matrix, path, true);
  return { uid: "qa", email: "qa@example.test", displayName: "QA", role: "admin", status: "activo", permissionModelVersion: 2, modulePermissions: matrix } as UserProfile;
};

test("El snapshot del vendedor incluye directorios comerciales sin conceder los módulos ni exponer secretos, costos o saldos bancarios", async () => {
  const user = profile(), db = new ReadDatabase({
    clients: [{ id: "a", businessName: "CLIENTE QA", identificationNumber: "QA", status: "activo", currentBalance: 42, privateNotes: "PRIVATE" }, { id: "b", status: "retirado" }],
    inventoryProducts: [{ id: "p", name: "QA", type: "producto", status: "activo", salePrice: 100, ivaRate: 15, baseCost: 22, secret: "PRIVATE" }, { id: "s", name: "Servicio QA", type: "servicio", status: "activo", salePrice: 100, ivaRate: 15, baseCost: 22 }, { id: "off", status: "inactivo" }],
    bankAccounts: [{ id: "bank", bankName: "QA", accountNumber: "QA", status: "activa", currentBalance: 1000, initialBalance: 500 }, { id: "off", status: "inactiva" }],
    sriCompanyConfig: [{ id: "config", razonSocial: "QA", establecimiento: "011", puntoEmision: "002", secuencialNotaVenta: 8, certificadoClave: "PRIVATE", smtpPassword: "PRIVATE" }],
    inventoryCategories: [{ id: "cat", name: "QA", itemType: "ambos" }], inventoryWarehouses: [{ id: "wh", name: "QA" }],
    clientServices: [{ id: "s", clientId: "a", planId: "s", status: "activo", customPrice: 999, pppoePassword: "PRIVATE" }],
  });
  const data = await snapshot(user, db as unknown as Firestore);
  assert.equal((data.clients as any[]).length, 1); assert.equal((data.inventoryProducts as any[]).length, 2);
  assert.equal((data.clients as any[])[0].currentBalance, 42);
  assert.equal((data.bankAccounts as any[])[0].currentBalance, undefined);
  assert.equal((data.inventoryProducts as any[])[0].baseCost, undefined);
  assert.equal((data.clientServices as any[])[0].customPrice, undefined);
  assert.equal((data.sriCompanyConfig as any[])[0].establecimiento, "011");
  assert.equal(JSON.stringify(data).includes("PRIVATE"), false);
  for (const route of ["/clientes", "/inventarios", "/finanzas", "/configuracion"]) assert.equal(canAccessRoute(user, route), false, route);
  assert.deepEqual(data.financialMovements, []); assert.deepEqual(data.monthlyCharges, []);
});

test("Revocar el permiso de emisión retira los directorios adicionales; la privacidad de precios se conserva", async () => {
  const user = profile(), db = new ReadDatabase({ inventoryProducts: [{ id: "s", type: "servicio", status: "activo", name: "QA", salePrice: 100, ivaRate: 15 }] });
  const hidden = { ...user, modulePermissions: setPermission(user.modulePermissions!, "visibility.canViewServicePrices", false) };
  const data = await snapshot(hidden, db as unknown as Firestore);
  assert.equal((data.inventoryProducts as any[])[0].salePrice, undefined);
  const revoked = { ...user, modulePermissions: setPermission(user.modulePermissions!, "ventas.actions.canCreateInvoice", false) };
  assert.deepEqual((await snapshot(revoked, db as unknown as Firestore)).inventoryProducts, []);
});

test("Facturación puede buscar clientes para cotizar sin acceso al directorio completo ni a la banca", async () => {
  const modulePermissions = completePermissions({}, {
    "facturacion.enabled": true, "facturacion.submodules.cotizaciones": true, "facturacion.actions.canCreateQuotes": true,
    "visibility.canViewFinancialAmounts": true, "visibility.canViewProductPrices": true,
  });
  const user = { ...profile(), modulePermissions };
  const db = new ReadDatabase({
    clients: [{ id: "qa", businessName: "CLIENTE QA", tradeName: "Comercial QA", identificationNumber: "000101", status: "activo", currentBalance: 99, privateNotes: "PRIVATE" }, { id: "retirado", status: "retirado" }],
    inventoryProducts: [{ id: "p", name: "Prueba", type: "producto", status: "activo", salePrice: 15, baseCost: 10, stock: 22 }],
    bankAccounts: [{ id: "bank", bankName: "QA", status: "activa", currentBalance: 500 }],
  });
  const data = await snapshot(user, db as unknown as Firestore);
  assert.equal(canAccessRoute(user, "/clientes"), false);
  assert.deepEqual(data.clients, [{ id: "qa", businessName: "CLIENTE QA", tradeName: "Comercial QA", identificationNumber: "000101", status: "activo" }]);
  assert.equal((data.inventoryProducts as any[])[0].salePrice, 15);
  assert.equal((data.inventoryProducts as any[])[0].stock, undefined);
  assert.deepEqual(data.bankAccounts, []);
  const revoked = { ...user, modulePermissions: setPermission(modulePermissions, "facturacion.actions.canCreateQuotes", false) };
  assert.deepEqual((await snapshot(revoked, db as unknown as Firestore)).clients, []);
});

test("El historial comercial recibe el resumen de su deuda, sin pagos internos ni deudas ajenas a las notas permitidas", async () => {
  const user = profile(), db = new ReadDatabase({
    billingInvoices: [{ id: "note", documentType: "nota_venta", items: [] }, { id: "sri", documentType: "factura" }],
    monthlyCharges: [{ id: "charge", invoiceId: "note", clientId: "a", total: 150, paidAmount: 100, balanceRemaining: 50, status: "parcial", payments: [{ bankAccountId: "PRIVATE" }] }, { id: "fiscal", invoiceId: "sri", total: 100 }, { id: "manual", total: 20 }],
  });
  const data = await snapshot(user, db as unknown as Firestore);
  assert.equal((data.monthlyCharges as any[]).length, 1);
  assert.equal((data.monthlyCharges as any[])[0].paidAmount, 100);
  assert.equal((data.monthlyCharges as any[])[0].payments, undefined);
  assert.equal(JSON.stringify(data).includes("PRIVATE"), false);
});
