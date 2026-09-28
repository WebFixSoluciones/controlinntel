// Test suite for Purchases, SRI XML parser, Kardex cost, Withholdings & Granular Permissions
import assert from "node:assert";
import { parseSupplierSriXml, calculateWeightedAverageCost, calculateWithholdingAmounts } from "../src/lib/purchases-service";
import { canAccessModule, canAccessSubmodule } from "../src/lib/permissions";
import type { UserProfile } from "../src/types";

// Sample Ecuadorian SRI electronic invoice XML from supplier
const SAMPLE_SUPPLIER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<factura id="comprobante" version="1.1.0">
  <infoTributaria>
    <ambiente>2</ambiente>
    <tipoEmision>1</tipoEmision>
    <razonSocial>FIBERLUX ECUADOR S.A.</razonSocial>
    <nombreComercial>FIBERLUX</nombreComercial>
    <ruc>1792189421001</ruc>
    <claveAcceso>2809202601179218942100120010020000456121234567814</claveAcceso>
    <codDoc>01</codDoc>
    <estab>001</estab>
    <ptoEmi>002</ptoEmi>
    <secuencial>000045612</secuencial>
    <dirMatriz>Av. de las Americas y San Gabriel, Guayaquil</dirMatriz>
  </infoTributaria>
  <infoFactura>
    <fechaEmision>28/09/2026</fechaEmision>
    <dirEstablecimiento>Av. de las Americas y San Gabriel, Guayaquil</dirEstablecimiento>
    <obligadoContabilidad>SI</obligadoContabilidad>
    <tipoIdentificacionComprador>04</tipoIdentificacionComprador>
    <razonSocialComprador>INNTEL CORP S.A.</razonSocialComprador>
    <identificacionComprador>1792458921001</identificacionComprador>
    <totalSinImpuestos>1200.00</totalSinImpuestos>
    <totalDescuento>50.00</totalDescuento>
    <totalConImpuestos>
      <totalImpuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>4</codigoPorcentaje>
        <baseImponible>1200.00</baseImponible>
        <valor>180.00</valor>
      </totalImpuesto>
    </totalConImpuestos>
    <propina>0.00</propina>
    <importeTotal>1380.00</importeTotal>
    <moneda>DOLAR</moneda>
  </infoFactura>
  <detalles>
    <detalle>
      <codigoPrincipal>FIB-ADSS-24H</codigoPrincipal>
      <descripcion>Bobina Fibra Optica ADSS 24 Hilos 1000m</descripcion>
      <cantidad>2.00</cantidad>
      <precioUnitario>500.00</precioUnitario>
      <descuento>50.00</descuento>
      <precioTotalSinImpuesto>950.00</precioTotalSinImpuesto>
      <impuestos>
        <impuesto>
          <codigo>2</codigo>
          <codigoPorcentaje>4</codigoPorcentaje>
          <tarifa>15.00</tarifa>
          <baseImponible>950.00</baseImponible>
          <valor>142.50</valor>
        </impuesto>
      </impuestos>
    </detalle>
    <detalle>
      <codigoPrincipal>SPL-1X8-PLC</codigoPrincipal>
      <descripcion>Splitter PLC 1x8 Balanceado</descripcion>
      <cantidad>50.00</cantidad>
      <precioUnitario>5.00</precioUnitario>
      <descuento>0.00</descuento>
      <precioTotalSinImpuesto>250.00</precioTotalSinImpuesto>
      <impuestos>
        <impuesto>
          <codigo>2</codigo>
          <codigoPorcentaje>4</codigoPorcentaje>
          <tarifa>15.00</tarifa>
          <baseImponible>250.00</baseImponible>
          <valor>37.50</valor>
        </impuesto>
      </impuestos>
    </detalle>
  </detalles>
</factura>`;

console.log("🚀 Starting Purchases & Finance Test Suite...");

// 1. XML SRI Parser Test
const parsed = parseSupplierSriXml(SAMPLE_SUPPLIER_XML);
assert.strictEqual(parsed.isValid, true, "XML should be parsed successfully");
assert.strictEqual(parsed.supplierRuc, "1792189421001");
assert.strictEqual(parsed.supplierRazonSocial, "FIBERLUX ECUADOR S.A.");
assert.strictEqual(parsed.documentNumber, "001-002-000045612");
assert.strictEqual(parsed.claveAcceso, "2809202601179218942100120010020000456121234567814");
assert.strictEqual(parsed.items.length, 2, "Should extract 2 items");
assert.strictEqual(parsed.total, 1380.00, "Total must match XML");
console.log("✅ 1. Supplier XML SRI Parser passed.");

// 2. Weighted Average Cost Recalculation Test
// Initial stock: 10 units at $50.00 ($500.00)
// Incoming purchase: 10 units at $70.00 ($700.00)
// Total new stock: 20 units. Total value: $1,200.00. Expected Avg: $60.00
const initialStock = 10;
const initialAvgCost = 50.00;
const newQty = 10;
const newUnitCost = 70.00;
const calculatedAvg = calculateWeightedAverageCost(initialStock, initialAvgCost, newQty, newUnitCost);
assert.strictEqual(calculatedAvg, 60.00, "Weighted average cost should be exactly 60.00");
console.log("✅ 2. Weighted Average Cost calculation passed.");

// 3. Withholding Amounts Test (Ecuador SRI)
// Base Imponible $1,000.00, IVA 15% = $150.00
// Retención Renta 1.75% (Bienes) = $17.50
// Retención IVA 30% (Bienes) = $45.00
// Total Retención = $62.50
const withholding = calculateWithholdingAmounts({
  baseImponible15: 1000.00,
  baseImponible0: 0,
  ivaAmount: 150.00,
  rentaPercentage: 1.75,
  ivaPercentage: 30,
});
assert.strictEqual(withholding.rentaAmount, 17.50);
assert.strictEqual(withholding.ivaRetainedAmount, 45.00);
assert.strictEqual(withholding.totalWithheld, 62.50);
console.log("✅ 3. Tax Withholdings calculation passed.");

// 4. Granular Permissions Logic Test
const testUserAdmin: UserProfile = {
  uid: "usr-admin",
  displayName: "Admin General",
  email: "admin@inntelcorp.com",
  role: "admin",
  status: "activo",
};

const testUserRestricted: UserProfile = {
  uid: "usr-tecnico",
  displayName: "Juan Técnico",
  email: "juan@inntelcorp.com",
  role: "tecnico",
  status: "activo",
  modulePermissions: {
    compras: {
      enabled: true,
      submodules: {
        historial_compras: true,
        registrar_compra: true,
        notas_credito: false,
        notas_debito: false,
        retenciones: false,
      },
    },
    finanzas: {
      enabled: false,
      submodules: {
        movimientos: false,
        bancos: false,
        cuentas_por_cobrar: false,
        cuentas_por_pagar: false,
        reportes: false,
      },
    },
    personas: {
      enabled: true,
      submodules: {
        proveedores: true,
        usuarios_equipo: false,
      },
    },
    abonados: {
      enabled: true,
    },
  },
};

assert.strictEqual(canAccessModule(testUserAdmin, "compras"), true, "Admin should access compras");
assert.strictEqual(canAccessModule(testUserRestricted, "compras"), true, "Restricted user has compras enabled");
assert.strictEqual(canAccessModule(testUserRestricted, "finanzas"), false, "Restricted user has finanzas disabled");
assert.strictEqual(canAccessModule(testUserRestricted, "abonados"), true, "Restricted user has abonados enabled");

assert.strictEqual(canAccessSubmodule(testUserRestricted, "compras", "historial_compras"), true);
assert.strictEqual(canAccessSubmodule(testUserRestricted, "compras", "retenciones"), false);
assert.strictEqual(canAccessSubmodule(testUserRestricted, "personas", "usuarios_equipo"), false);
assert.strictEqual(canAccessSubmodule(testUserRestricted, "personas", "proveedores"), true);
console.log("✅ 4. Granular Module & Submodule Permissions passed.");

console.log("🎉 All Purchases & Finance tests passed successfully!");
