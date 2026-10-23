import test from "node:test";
import assert from "node:assert/strict";
import {
  validateCedulaEcuador,
  validateRucEcuador,
  validateIdentification,
} from "./validation-engine.ts";

test("Validation Engine - Cédula Ecuatoriana", () => {
  // Cédula válida de prueba (Pichincha 17)
  const validCedula = "1710034065";
  const resultValid = validateCedulaEcuador(validCedula);
  assert.equal(resultValid.isValid, true, "Cédula válida debe ser aceptada");

  // Cédula inválida (dígito verificador incorrecto)
  const invalidCedula = "1710034069";
  const resultInvalid = validateCedulaEcuador(invalidCedula);
  assert.equal(resultInvalid.isValid, false, "Cédula con dígito verificador errado debe ser rechazada");

  // Cédula con código de provincia inválido
  const invalidProvince = "3510034065";
  const resultProvince = validateCedulaEcuador(invalidProvince);
  assert.equal(resultProvince.isValid, false, "Código de provincia > 24 debe ser rechazado");
});

test("Validation Engine - RUC Ecuatoriano", () => {
  // RUC Persona Natural (Cédula + 001)
  const validRucNatural = "1710034065001";
  const resultNatural = validateRucEcuador(validRucNatural);
  assert.equal(resultNatural.isValid, true, "RUC Natural válido debe ser aceptado");

  // RUC Sociedad Privada (Tercer dígito 9) - Módulo 11 (ej: 1790010937001)
  const validRucSociedad = "1790010937001";
  const resultSociedad = validateRucEcuador(validRucSociedad);
  assert.equal(resultSociedad.isValid, true, "RUC Privado de Sociedad debe ser aceptado");

  // RUC inválido (no termina en establecimiento o módulo 11 incorrecto)
  const invalidRuc = "1790010937000";
  const resultInvalid = validateRucEcuador(invalidRuc);
  assert.equal(resultInvalid.isValid, false, "RUC que termina en 000 debe ser rechazado");
});

test("Validation Engine - Helper Central validateIdentification", () => {
  assert.equal(validateIdentification("CEDULA", "1710034065").isValid, true);
  assert.equal(validateIdentification("RUC", "1790010937001").isValid, true);
  assert.equal(validateIdentification("PASAPORTE", "A12345678").isValid, true);
  assert.equal(validateIdentification("PASAPORTE", "").isValid, false);
});
