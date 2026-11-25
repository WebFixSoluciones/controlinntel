import test from "node:test";
import assert from "node:assert/strict";
import { createSearchMatcher } from "./search.ts";
import { searchClients } from "./client-search.ts";

test("busca palabras parciales en distinto orden y entre distintos campos", () => {
  const matches = createSearchMatcher("  dieg  muNoz  0001 ");
  assert.equal(matches(undefined, "José Diego Muñoz", "0001012345001"), true);
  assert.equal(matches("José Muñoz", "0001012345001"), false);
  assert.equal(createSearchMatcher(" ")(null, undefined), true);
});

test("busca identificadores y comprobantes con o sin separadores, dentro de un mismo campo", () => {
  assert.equal(createSearchMatcher("001010000000031")("001-010-000000031", "Cliente QA"), true);
  assert.equal(createSearchMatcher("COT20260001")("COT-2026-0001"), true);
  assert.equal(createSearchMatcher("00.0123")("000123"), true);
  assert.equal(createSearchMatcher("001 031")("001", "031"), false);
});

test("el selector encuentra el cliente por nombre comercial o RUC, conservando el ID", () => {
  const clients = [{ id: "qa", businessName: "COMPAÑÍA DEL NORTE", tradeName: "Conexión Rápida", identificationNumber: "001-234-5001" }];
  assert.deepEqual(searchClients(clients, "rapida conexion").map(client => client.id), ["qa"]);
  assert.deepEqual(searchClients(clients, "0012345001").map(client => client.id), ["qa"]);
});
