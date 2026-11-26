import test from "node:test";
import assert from "node:assert/strict";
import { clientSalesHistory } from "./client-sales-history.ts";
import { activeClientServices } from "./client-status.ts";
import { canViewClientSalesHistory } from "./permissions.ts";
import { completePermissions, setPermission } from "./permission-catalog.ts";

test("Historial: nota, factura y cobro forman una operación; anulados y pruebas no inflan los totales", () => {
  const notes = [{ id: "sale", documentType: "nota_venta", status: "registrado", documentNumber: "010-001-000000013", date: "2026-11-16", total: 200, items: [] },
    { id: "void", documentType: "nota_venta", status: "anulada", documentNumber: "010-001-000000006", total: 100 },
    { id: "test", documentType: "factura", ambiente: "1", status: "autorizada", estadoSRI: "AUTORIZADO", relatedSaleId: "sale", documentNumber: "001-010-000000424", total: 200 }];
  const charges = [{ id: "c", invoiceId: "sale", total: 200, paidAmount: 50, status: "parcial" }, { id: "old", invoiceId: "void", total: 100, status: "anulado" }];
  const result = clientSalesHistory(notes, charges);
  assert.equal(result.rows.length, 1); assert.equal(result.total, 200); assert.equal(result.count, 1); assert.equal(result.pending, 150);
  assert.equal(result.rows[0].kind, "Nota de venta"); assert.deepEqual(result.rows[0].testDocuments, ["001-010-000000424"]);
  const live = clientSalesHistory([...notes, { ...notes[2], id: "live", ambiente: "2", documentNumber: "001-010-000000001", date: "2026-11-18" }], charges);
  assert.equal(live.count, 1); assert.equal(live.total, 200); assert.equal(live.rows[0].kind, "Factura SRI");
  assert.equal(live.rows[0].issuedDate, "2026-11-18");
  assert.equal(live.rows[0].date, "2026-11-16");
  assert.equal(live.rows[0].sourceNumber, "010-001-000000013"); assert.equal(live.pending, 150);
});

test("Historial: pruebas aisladas, cargos manuales y permisos independientes", () => {
  const result = clientSalesHistory([{ id: "test", documentType: "factura", ambiente: "1", status: "emitida", total: 999 }], [{ id: "manual", total: 25, paidAmount: 0, status: "pendiente" }]);
  assert.equal(result.total, 25); assert.equal(result.pending, 25); assert.equal(result.count, 1);
  let matrix = completePermissions();
  for (const key of ["abonados.enabled", "abonados.submodules.historial_ventas", "visibility.canViewFinancialAmounts"]) matrix = setPermission(matrix, key, true);
  const user = { uid: "qa", email: "qa@example.test", displayName: "QA", role: "admin" as const, status: "activo" as const, permissionModelVersion: 2 as const, permissions: [], modulePermissions: matrix };
  assert.equal(canViewClientSalesHistory(user), true);
  assert.equal(canViewClientSalesHistory({ ...user, modulePermissions: setPermission(matrix, "abonados.submodules.historial_ventas", false) }), false);
  assert.equal(canViewClientSalesHistory({ ...user, modulePermissions: setPermission(matrix, "visibility.canViewFinancialAmounts", false) }), false);
});

test("Historial: cartera ausente o duplicada se muestra por conciliar, sin fingir saldo cero ni duplicar deuda", () => {
  const note = { id: "sale", documentType: "nota_venta", status: "registrado", total: 200, paymentMethod: "credito", documentNumber: "010-001-000000001" };
  const missing = clientSalesHistory([note], []);
  assert.equal(missing.rows[0].pending, null); assert.equal(missing.reconciliationCount, 1);
  const charge = { id: "a", invoiceId: "sale", total: 200, paidAmount: 0, status: "pendiente" };
  const duplicated = clientSalesHistory([note], [charge, { ...charge, id: "b" }]);
  assert.equal(duplicated.rows[0].pending, null); assert.equal(duplicated.count, 1); assert.equal(duplicated.total, 200);
  assert.equal(duplicated.pending, 0, "Solo suma saldos registrados sin ambigüedad; la interfaz indica conciliación pendiente");
  assert.equal(duplicated.reconciliationCount, 1);
});

test("El resumen de servicios muestra solo los activos del cliente y conserva las asignaciones históricas", () => {
  const services = [
    { id: "actual", clientId: "cliente", status: "activo" },
    { id: "anterior", clientId: "cliente", status: "retirado" },
    { id: "pausado", clientId: "cliente", status: "suspendido" },
    { id: "otro", clientId: "otro-cliente", status: "activo" },
  ];
  assert.deepEqual(activeClientServices(services, "cliente").map(service => service.id), ["actual"]);
  assert.equal(services.length, 4);
});
