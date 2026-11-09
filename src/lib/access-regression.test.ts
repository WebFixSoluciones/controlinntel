import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { UserProfile } from "@/types";
import { canAccessModule, canAccessRoute, canAccessSubmodule, canUser, editableModulePermissions } from "./permissions.ts";
import { canReadCollection, canReadBillingDocument } from "./persistence-contracts.ts";
import { visibleServiceData } from "./service-visibility.ts";
import { executeCommercial, type CommercialCommand } from "./server/commercial.ts";
import { save, remove } from "./server/operations.ts";
import { searchClients } from "./client-search.ts";
import { compareDocumentsDescending } from "./sales-policy.ts";

const admin: UserProfile = { uid: "qa", email: "qa@example.com", displayName: "QA", status: "activo", role: "admin", permissions: ["all"] };

test("Personas bloquea módulo, submódulos y acceso directo incluso con permiso global antiguo", () => {
  const denied = { ...admin, modulePermissions: { personas: { enabled: false, submodules: { proveedores: true, usuarios_equipo: true } } } };
  assert.equal(canAccessRoute(denied, "/personas"), false);
  assert.equal(canAccessSubmodule(denied, "personas", "proveedores"), false);
  assert.equal(canReadCollection(denied, "systemUsers"), false);
  const suppliersOnly = { ...admin, modulePermissions: { personas: { enabled: true, submodules: { proveedores: true, usuarios_equipo: false } }, compras: { enabled: false, submodules: {} as any } } };
  assert.equal(canReadCollection(suppliersOnly, "suppliers"), true);
  assert.equal(canReadCollection(suppliersOnly, "systemUsers"), false);
  assert.equal(canAccessSubmodule(suppliersOnly, "personas", "usuarios_equipo"), false);
});

test("Desactivar Ventas conserva SRI independiente sin entregar notas de venta", () => {
  const denied = { ...admin, modulePermissions: { ventas: { enabled: false, submodules: {} as any } } };
  assert.equal(canAccessRoute(denied, "/ventas"), false);
  assert.equal(canUser(denied, "ventas", "canCreateInvoice"), false);
  assert.equal(canReadBillingDocument(denied, { documentType: "nota_venta" }), false);
  assert.equal(canReadBillingDocument(denied, { documentType: "factura" }), true);
  assert.equal(canReadCollection(denied, "clientQuotes"), false);
  const salesOnly = { ...admin, modulePermissions: { facturacion: { enabled: false, submodules: {} as any } } };
  assert.equal(canUser(salesOnly, "ventas", "canCreateInvoice"), true);
  assert.equal(canReadBillingDocument(salesOnly, { documentType: "factura" }), false);
  assert.equal(canReadBillingDocument(salesOnly, { documentType: "nota_venta" }), true);
  const readOnly = { ...admin, modulePermissions: { ventas: { enabled: true, submodules: { notas_venta: true, nueva_venta: false, cotizaciones: false, recurrentes: false }, actions: { canCreateInvoice: false, canEditPrices: false, canCancelInvoices: false } } } };
  assert.equal(canAccessSubmodule(readOnly, "ventas", "notas_venta"), true);
  assert.equal(canUser(readOnly, "ventas", "canEditPrices"), false);
  assert.equal(canReadCollection(readOnly, "clientQuotes"), false);
});

test("El editor conserva denegaciones y completa permisos antiguos o plantillas parciales sin mutarlos", () => {
  const user = { ...admin, modulePermissions: { personas: { enabled: false, submodules: { proveedores: false } as any }, ventas: { enabled: false, submodules: { notas_venta: false } as any } } };
  const before = JSON.stringify(user);
  const permissions = editableModulePermissions(user);
  assert.equal(permissions.personas?.enabled, false);
  assert.equal(permissions.personas?.submodules.proveedores, false);
  assert.equal(typeof permissions.personas?.submodules.usuarios_equipo, "boolean");
  assert.equal(permissions.ventas?.enabled, false);
  assert.equal(permissions.ventas?.submodules.notas_venta, false);
  assert.equal(permissions.ventas?.submodules.nueva_venta, true);
  assert.equal(permissions.ventas?.actions?.canCreateInvoice, true);
  permissions.personas!.submodules.proveedores = true;
  assert.equal(JSON.stringify(user), before);
});

test("Ocultar importes bloquea pantallas y datos financieros, conserva la operación técnica", () => {
  const user = { ...admin, modulePermissions: { visibility: { canViewFinancialAmounts: false, canViewServicePrices: false, canViewProductPrices: false }, inventarios: { enabled: true, submodules: {} as any, actions: { canViewCosts: false } as any } } };
  for (const moduleKey of ["ventas", "compras", "finanzas", "facturacion"] as const) assert.equal(canAccessModule(user, moduleKey), false);
  for (const collection of ["billingInvoices", "billingQuotes", "monthlyCharges", "purchaseInvoices", "bankAccounts", "financialMovements", "expenses", "clientAdvances"] as const) assert.equal(canReadCollection(user, collection), false);
  assert.equal(canAccessModule(user, "proyectos"), true);
  assert.deepEqual(visibleServiceData(user, "clients", { id: "a", businessName: "Cliente", currentBalance: 250 }), { id: "a", businessName: "Cliente" });
  assert.deepEqual(visibleServiceData(user, "projects", { id: "p", title: "Visita", estimatedBudget: 20, executedCost: 10 }), { id: "p", title: "Visita" });
  assert.deepEqual(visibleServiceData(user, "inventoryProducts", { id: "p", type: "producto", stock: 2, baseCost: 10, salePrice: 20, salePriceConIva: 23, ivaRate: 15 }), { id: "p", type: "producto", stock: 2 });
  assert.equal(canAccessModule({ ...user, role: "superadmin" }, "ventas"), true);
});

test("Servidor rechaza ventas, recurrencias, compras y proveedores bloqueados antes de escribir", async () => {
  for (const action of ["issueSale", "editSale", "cancelSale", "recur", "startRun", "processRun"] as CommercialCommand["action"][]) {
    const user = { ...admin, modulePermissions: { ventas: { enabled: false, submodules: {} as any } } };
    await assert.rejects(executeCommercial(user, { action, operationId: randomUUID(), data: {} }), { status: 403 });
  }
  const user = { ...admin, modulePermissions: { compras: { enabled: true, submodules: { registrar_compra: false } as any }, personas: { enabled: false, submodules: { proveedores: true, usuarios_equipo: true } } } };
  await assert.rejects(executeCommercial(user, { action: "purchase", operationId: randomUUID(), data: {} }), { status: 403 });
  await assert.rejects(save(user, "suppliers", {}, "provider"), { status: 403 });
  await assert.rejects(remove(user, "suppliers", "provider"), { status: 403 });
});

test("Buscar cliente por indicios, acentos, nombres comerciales o identificación conserva ID y no altera la lista", () => {
  const clients = [{ id: "2", businessName: "MUÑOZ DANNY", tradeName: "Velocired", identificationNumber: "0922365861001" }, { id: "1", businessName: "ANABEL VALLE", identificationNumber: "1750599340001" }];
  assert.deepEqual(searchClients(clients, "munoz dann"), [clients[0]]);
  assert.deepEqual(searchClients(clients, "velo"), [clients[0]]);
  assert.deepEqual(searchClients(clients, "175059"), [clients[1]]);
  assert.deepEqual(searchClients(clients, "inexistente"), []);
  assert.deepEqual(searchClients(clients, "").map(client => client.id), ["1", "2"]);
  assert.equal(clients[0].id, "2");
});

test("Cuentas por cobrar se ordenan de mayor a menor por serie y secuencial, sin depender de la fecha", () => {
  const charges = [{ invoiceNumber: "010-001-000000002" }, { invoiceNumber: "010-001-000000008" }, { invoiceNumber: "010-001-000000004" }, { invoiceNumber: "010-001-000000007" }];
  assert.deepEqual(charges.sort(compareDocumentsDescending).map(charge => charge.invoiceNumber?.slice(-1)), ["8", "7", "4", "2"]);
});
