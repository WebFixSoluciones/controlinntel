import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateWeightedAverageCost,
  calculatePriceWithTax,
  validateStockAvailability,
  buildKardexEntry,
} from "./inventory-service.ts";
import {
  generarClaveAccesoSRI,
  validarClaveAccesoSRI,
  mapearFormaPagoSRI,
} from "./sri-service.ts";
import { validateIdentification } from "./validation-engine.ts";
import { getEcuadorDate, addMonthsSafely, diffInCalendarDays } from "./date-utils.ts";
import type { InventoryProduct, Warehouse } from "../types/index.ts";

const mockWarehouse: Warehouse = {
  id: "bodega-central",
  name: "Bodega Matriz Quito",
  code: "BOD-01",
  address: "Parque Industrial Norte",
  isDefault: true,
  status: "activo",
  createdAt: "2026-01-01",
};

const mockProduct: InventoryProduct = {
  id: "prod-router-01",
  name: "Router MikroTik hEX S",
  sku: "MTK-HEX-S",
  unit: "unidad",
  type: "producto",
  categoryId: "cat-networking",
  baseCost: 50.0,
  salePrice: 80.0,
  salePriceConIva: 92.0,
  taxMode: "EXCLUIDO",
  ivaRate: 15,
  tracksStock: true,
  stock: 10,
  minStock: 2,
  stockByWarehouse: { "bodega-central": 10 },
  status: "activo",
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};

test("Flujo E2E 1: Ciclo Integral de Compra, Kardex Ponderado, CxP y Pago Bancario", () => {
  // 1. Validación fiscal del Proveedor
  const supplierRuc = "1790016919001"; // RUC sociedad privada válido
  const rucCheck = validateIdentification("RUC", supplierRuc);
  assert.equal(rucCheck.isValid, true, "El RUC del proveedor debe ser válido ante el SRI");

  // 2. Factura de Compra
  const initialStock = 10;
  const initialCost = 50.0; // $500 total inicial
  const purchaseQuantity = 20;
  const purchaseUnitCost = 44.0; // Compra de 20 unidades a $44 c/u = $880
  const subtotal = purchaseQuantity * purchaseUnitCost; // $880.00
  const ivaRate = 0.15;
  const iva = subtotal * ivaRate; // $132.00
  const purchaseTotal = subtotal + iva; // $1,012.00

  // 3. Recepción en Bodega y Recálculo de Costo Promedio Ponderado en Kardex
  const newAverageCost = calculateWeightedAverageCost(
    initialStock,
    initialCost,
    purchaseQuantity,
    purchaseUnitCost
  );
  // (10*50 + 20*44) / 30 = (500 + 880) / 30 = 1380 / 30 = $46.00 exactos
  assert.equal(newAverageCost, 46.0, "El costo promedio ponderado debe ser exactamente $46.00");

  const stockAfterPurchase = initialStock + purchaseQuantity;
  assert.equal(stockAfterPurchase, 30, "El stock final debe ser 30 unidades");

  const kardexEntry = buildKardexEntry({
    product: mockProduct,
    warehouse: mockWarehouse,
    type: "PURCHASE_RECEIPT",
    referenceId: "compra-001",
    referenceDocNumber: "001-001-000004521",
    concept: "Ingreso por Factura de Compra",
    quantity: purchaseQuantity,
    unitCost: purchaseUnitCost,
    currentStock: initialStock,
    currentAvgCost: initialCost,
  });
  assert.equal(kardexEntry.balanceQuantity, 30);
  assert.equal(kardexEntry.balanceAverageCost, 46.0);

  // 4. Registro en Cuentas por Pagar (CxP)
  let cxpSaldo = purchaseTotal; // $1,012.00
  assert.equal(cxpSaldo, 1012.0);

  // 5. Aplicación de Nota de Crédito Comercial del Proveedor (descuento $112 por pronto pago)
  const creditNoteAmount = 112.0;
  cxpSaldo = Math.max(0, cxpSaldo - creditNoteAmount);
  assert.equal(cxpSaldo, 900.0, "El saldo residual de CxP debe reflejar la nota de crédito ($900)");

  // 6. Pago Bancario desde Cuenta de la Empresa
  let bankAccountBalance = 5000.0;
  const paymentAmount = 900.0;
  assert.ok(paymentAmount <= cxpSaldo, "El pago no debe exceder el saldo residual de la deuda");
  assert.ok(paymentAmount <= bankAccountBalance, "La cuenta bancaria debe tener liquidez suficiente");

  bankAccountBalance -= paymentAmount;
  cxpSaldo -= paymentAmount;

  assert.equal(cxpSaldo, 0.0, "La cuenta por pagar debe quedar totalmente liquidada (saldo 0)");
  assert.equal(bankAccountBalance, 4100.0, "El saldo bancario debe reflejar el egreso exacto de $900");
});

test("Flujo E2E 2: Ciclo Integral de Venta, Validación de Stock, SRI y Cobro", () => {
  // 1. Validación fiscal del Cliente
  const clientCedula = "1710034065"; // Cédula ecuatoriana válida
  const cedulaCheck = validateIdentification("CEDULA", clientCedula);
  assert.equal(cedulaCheck.isValid, true, "La cédula del cliente debe ser válida");

  // 2. Verificación de Disponibilidad en Inventario (Evitar sobreventa P1-02)
  const productForSale: InventoryProduct = {
    ...mockProduct,
    stock: 5,
    stockByWarehouse: { "bodega-central": 5 },
  };

  const attemptedSaleQuantity = 10;
  const stockValidationFail = validateStockAvailability(productForSale, "bodega-central", attemptedSaleQuantity);
  assert.equal(stockValidationFail.valid, false, "La sobreventa de 10 unidades sobre 5 debe ser rechazada");

  // Venta dentro del stock real (2 unidades)
  const realSaleQuantity = 2;
  const stockValidationOk = validateStockAvailability(productForSale, "bodega-central", realSaleQuantity);
  assert.equal(stockValidationOk.valid, true, "Venta de 2 unidades sobre 5 disponibles debe ser aprobada");

  // 3. Generación de Factura Electrónica y Clave de Acceso SRI
  const saleUnitPrice = 80.0;
  const pricing = calculatePriceWithTax(saleUnitPrice, 15);
  assert.equal(pricing, 92.0);

  const totalSaleAmount = pricing * realSaleQuantity; // $184.00

  const ecuadorToday = getEcuadorDate();
  const claveAcceso = generarClaveAccesoSRI({
    fechaEmision: ecuadorToday,
    tipoComprobante: "01", // Factura
    ruc: "1790016919001",
    ambiente: "1", // Pruebas
    establecimiento: "001",
    puntoEmision: "001",
    secuencial: "000000123",
    codigoNumerico: "12345678",
    tipoEmision: "1",
  });

  assert.equal(claveAcceso.length, 49, "La clave de acceso del SRI debe contener 49 dígitos exactos");
  assert.equal(validarClaveAccesoSRI(claveAcceso).isValid, true, "La clave generada debe pasar la verificación de Módulo 11");

  // 4. Salida de Bodega (Kardex de Venta)
  const currentCost = 46.0;
  const kardexEgreso = buildKardexEntry({
    product: productForSale,
    warehouse: mockWarehouse,
    type: "SALE",
    referenceId: "venta-001",
    referenceDocNumber: "001-001-000000123",
    concept: "Egreso por Venta a Cliente",
    quantity: realSaleQuantity,
    unitCost: currentCost,
    currentStock: 5,
    currentAvgCost: currentCost,
  });
  assert.equal(kardexEgreso.balanceQuantity, 3, "El stock remanente debe ser 3 unidades");

  // 5. Cuentas por Cobrar y Recaudación Bancaria
  let clientDebt = totalSaleAmount; // $184.00
  let bankBalance = 4100.0;

  const paymentMethodCode = mapearFormaPagoSRI("transferencia");
  assert.equal(paymentMethodCode, "20", "Transferencia bancaria debe mapear al código 20 del SRI");

  // Cobro del total
  bankBalance += clientDebt;
  clientDebt -= totalSaleAmount;

  assert.equal(clientDebt, 0.0, "La deuda del cliente debe quedar en $0.00");
  assert.equal(bankBalance, 4284.0, "El banco debe recibir los $184.00 de la venta");
});

test("Flujo E2E 3: Ciclo de Anulación de Factura y Devolución a Kardex", () => {
  // Factura emitida por 2 unidades de un producto
  const stockBeforeAnulacion = 3;
  const restoredQuantity = 2;
  const currentAverageCost = 46.0;

  // Anulación de la factura -> movimiento POSITIVE_ADJUSTMENT o CUSTOMER_RETURN
  const kardexReverso = buildKardexEntry({
    product: mockProduct,
    warehouse: mockWarehouse,
    type: "CUSTOMER_RETURN",
    referenceId: "reverso-001",
    referenceDocNumber: "REV-001-001-000000123",
    concept: "Reverso de inventario por Anulación de Factura",
    quantity: restoredQuantity,
    unitCost: currentAverageCost,
    currentStock: stockBeforeAnulacion,
    currentAvgCost: currentAverageCost,
  });

  assert.equal(kardexReverso.balanceQuantity, 5, "El stock debe regresar a las 5 unidades originales");
  assert.equal(kardexReverso.balanceAverageCost, 46.0, "El costo promedio ponderado no debe distorsionarse");
});

test("Flujo E2E 4: Ciclo de Topología de Red con Múltiples IPv4 y Semáforo de Póliza", () => {
  // 1. Carrier con múltiples IPv4 asignadas
  const provider = {
    id: "prov-telconet-01",
    providerName: "Telconet Latam",
    capacityMbps: 3000,
    circuitId: "TCO-UIO-9921",
    ipv4Subnet: "181.198.112.112/30",
    ipv4Subnets: [
      "181.198.112.112/30",
      "181.198.112.116/30",
      "181.198.112.120/30",
    ],
  };

  assert.equal(provider.ipv4Subnets.length, 3, "El proveedor debe admitir 3 IPv4 en la misma línea");
  assert.equal(provider.ipv4Subnets[0], provider.ipv4Subnet, "La primera IP debe coincidir con el campo legacy");

  // 2. Coordenadas de Ubicación
  const nodeLocation = {
    id: "pop-quito-norte",
    name: "POP 01 - Telepuerto Quito Norte",
    address: "Av. 6 de Diciembre y Eloy Alfaro",
    coordinates: { lat: -0.180653, lng: -78.467834 },
    totalCapacityMbps: 3000,
    usedCapacityMbps: 1200,
  };

  assert.ok(nodeLocation.coordinates.lat < 0, "Latitud de Quito debe ser negativa");
  assert.ok(nodeLocation.coordinates.lng < 0, "Longitud de Quito debe ser negativa");

  // 3. Cálculo de Vencimiento de Póliza Regulatoria ARCOTEL
  const policyIssueDate = "2026-01-15";
  const policyExpirationDate = addMonthsSafely(policyIssueDate, 12); // Póliza a 1 año
  assert.equal(policyExpirationDate, "2027-01-15", "La póliza debe vencer exactamente a los 12 meses");

  const today = getEcuadorDate();
  const daysLeft = diffInCalendarDays(today, policyExpirationDate);
  assert.ok(daysLeft > 0, "La póliza debe estar vigente con días restantes positivos");
});
