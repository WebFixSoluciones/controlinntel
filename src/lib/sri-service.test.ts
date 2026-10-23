import test from "node:test";
import assert from "node:assert/strict";
import {
  formatearSecuencialSRI,
  calcularModulo11,
  generarClaveAccesoSRI,
  validarClaveAccesoSRI,
  escaparXml,
  mapearFormaPagoSRI,
} from "./sri-service.ts";

test("SRI Service - formatearSecuencialSRI", () => {
  assert.equal(formatearSecuencialSRI(1), "001-001-000000001");
  assert.equal(formatearSecuencialSRI(45), "001-001-000000045");
  assert.equal(formatearSecuencialSRI("123"), "001-001-000000123");
  assert.equal(formatearSecuencialSRI(1, "002", "005"), "002-005-000000001");
});

test("SRI Service - calcularModulo11", () => {
  // 48 dígitos conocidos
  const base48 = "231020260117924589210011010001000000001123456781";
  const digito = calcularModulo11(base48.slice(0, 48));
  assert.equal(typeof digito, "number");
  assert.ok(digito >= 0 && digito <= 9, "Dígito verificador debe ser 0-9");
});

test("SRI Service - generarClaveAccesoSRI produce 49 dígitos válidos", () => {
  const clave = generarClaveAccesoSRI({
    fechaEmision: "2026-10-23",
    tipoComprobante: "01", // Factura
    ruc: "1792458921001",
    ambiente: "1",
    establecimiento: "001",
    puntoEmision: "001",
    secuencial: 1,
    codigoNumerico: "12345678",
  });

  assert.equal(clave.length, 49, "La clave de acceso SRI debe tener exactamente 49 dígitos");
  assert.match(clave, /^\d{49}$/, "La clave de acceso debe contener solo dígitos numéricos");

  const validacion = validarClaveAccesoSRI(clave);
  assert.equal(validacion.isValid, true, "La clave de acceso generada debe ser válida según el validador oficial");
  assert.equal(validacion.detalles?.ruc, "1792458921001");
  assert.equal(validacion.detalles?.tipoComprobante, "01");
});

test("SRI Service - escaparXml sanitiza caracteres reservados", () => {
  assert.equal(escaparXml("INNTEL & CORP <TEST> 'PRUEBA' \"1\""), "INNTEL &amp; CORP &lt;TEST&gt; &apos;PRUEBA&apos; &quot;1&quot;");
});

test("SRI Service - mapearFormaPagoSRI asigna códigos del catálogo SRI", () => {
  assert.equal(mapearFormaPagoSRI("transferencia"), "20"); // Otros con utilización del sistema financiero
  assert.equal(mapearFormaPagoSRI("efectivo"), "01"); // Sin utilización del sistema financiero
  assert.equal(mapearFormaPagoSRI("tarjeta_credito"), "19"); // Tarjeta de crédito
});
