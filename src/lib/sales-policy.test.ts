import test from "node:test";
import assert from "node:assert/strict";
import { activeCommercialDocuments, canTradeWithClient } from "./sales-policy.ts";

test("deleted sales stay out of the listing; sequence 10 precedes 4 regardless of dates or input order", () => {
  const records = [
    { documentNumber: "010-001-000000002", status: "registrado", date: "2026-11-04" },
    { documentNumber: "010-001-000000010", status: "registrado", date: "2026-10-01" },
    { documentNumber: "010-001-000000004", status: "registrado", date: "2026-10-29" },
    { documentNumber: "010-001-000000099", status: "anulada", date: "2026-11-04" },
  ];
  const original = structuredClone(records);
  assert.deepEqual(activeCommercialDocuments(records).map(row => row.documentNumber), ["010-001-000000010", "010-001-000000004", "010-001-000000002"]);
  assert.deepEqual(records, original);
});

test("receivables use the same descending order and exclude cancelled debts", () => {
  const charges = [
    { invoiceNumber: "010-001-000000001", status: "parcial" },
    { invoiceNumber: "010-001-000000004", status: "pendiente" },
    { invoiceNumber: "010-001-000000003", status: "anulado" },
  ];
  assert.deepEqual(activeCommercialDocuments(charges).map(row => row.invoiceNumber), ["010-001-000000004", "010-001-000000001"]);
});

test("customer selectors exclude retired accounts without hiding suspended customers or allowing a missing selection", () => {
  const clients = [{ id: "active", status: "activo" }, { id: "retired", status: "retirado" }, { id: "suspended", status: "suspendido" }];
  assert.deepEqual(clients.filter(canTradeWithClient).map(client => client.id), ["active", "suspended"]);
  assert.equal(canTradeWithClient(null), false);
  assert.equal(canTradeWithClient(undefined), false);
});
