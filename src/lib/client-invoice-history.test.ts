import test from "node:test";
import assert from "node:assert/strict";
import type { SriInvoice } from "@/types";
import { clientIssuedInvoices } from "./client-invoice-history.ts";

const invoice = (id: string, overrides: Partial<SriInvoice> = {}) => ({ id, clientId: "a", documentType: "nota_venta", documentNumber: "010-001-000000001", date: "2026-11-04", status: "registrado", ...overrides } as SriInvoice);

test("client invoice history contains only that customer's issued documents, excluding drafts and cancelled sales", () => {
  const documents = [invoice("note"), invoice("invoice", { documentType: "factura", status: "autorizada" }),
    invoice("other-client", { clientId: "b" }), invoice("draft", { status: "borrador" }), invoice("cancelled", { status: "anulada" })];
  assert.deepEqual(clientIssuedInvoices(documents, "a").map(document => document.id).sort(), ["invoice", "note"]);
  assert.deepEqual(clientIssuedInvoices(documents, "unknown"), []);
});

test("client invoice history sorts by document number descending without depending on issue date or changing the source", () => {
  const documents = [invoice("nine", { documentNumber: "010-001-000000009", date: "2026-11-04" }),
    invoice("ten", { documentNumber: "010-001-000000010", date: "2026-01-01" })];
  assert.deepEqual(clientIssuedInvoices(documents, "a").map(document => document.id), ["ten", "nine"]);
  assert.deepEqual(documents.map(document => document.id), ["nine", "ten"]);
});
