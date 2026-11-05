import test from "node:test";
import assert from "node:assert/strict";
import { emptyConcession, normalizeConcession } from "./arcotel-concession.ts";

test("new concessions and missing server records are blank", () => {
  assert.deepEqual(normalizeConcession(undefined), emptyConcession());
  assert.deepEqual(normalizeConcession(null), emptyConcession());
  assert.equal(emptyConcession().reminderDays, 0);
});

test("exact cached demo concession is omitted without changing the source or real custom fields", () => {
  const demo = { titleName: "Permiso Único para Prestación de Servicios del Régimen General de Telecomunicaciones",
    titleDate: "2020-08-15", concessionaireCode: "CON-SVA-2024-089", lastPolicyDate: "2026-06-15",
    websiteUrl: "https://www.inntelcorp.com", reminderDays: 30,
    additionalFields: [{ id: "f-1", label: "Número de Trámite Quipux", value: "ARCOTEL-CZT4-2026-0422-M" },
      { id: "real", label: "Expediente propio", value: "2026-01" }] };
  const source = structuredClone(demo);
  assert.deepEqual(normalizeConcession(demo), { ...emptyConcession(), additionalFields: [demo.additionalFields[1]] });
  assert.deepEqual(demo, source);
  const real = { ...demo, concessionaireCode: "CONCESION-REAL-18" };
  assert.deepEqual(normalizeConcession(real), real);
});
