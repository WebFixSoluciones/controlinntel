import assert from "node:assert/strict";
import { test } from "node:test";
import { badgeTone } from "./badge-tone.ts";

test("usa el mismo tono para estados positivos y sus variantes de presentación", () => {
  for (const label of ["Activos", "Enviada", "Aprobados", "Emitida", "Aceptado por proveedor", "Pagado", "AUTORIZADO SRI", "Autorizada en pruebas"]) {
    assert.equal(badgeTone(label), "positive", label);
  }
});

test("distingue estados caducados, cerrados o fallidos de los positivos", () => {
  for (const label of ["Eliminada", "Caducado", "Cancelados", "Terminado", "Fallido", "No autorizado", "INACTIVA", "Vencido (10d)", "Fuera_de_línea", "Contrato caducado (4d)"]) {
    assert.equal(badgeTone(label), "negative", label);
  }
});

test("usa el tono general para métodos, tipos, estados pendientes y textos descriptivos", () => {
  for (const label of ["Transferencia", "Contado", "Crédito", "Facturable", "Pendiente SRI", "Por vencer", "Cliente activo ABC", "Transferencia no confirmada", 12, undefined]) {
    assert.equal(badgeTone(label), "neutral", String(label));
  }
});
