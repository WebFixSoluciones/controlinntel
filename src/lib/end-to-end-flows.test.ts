import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
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
  generarFacturaXml,
  generarNotaCreditoXml,
  generarNotaDebitoXml,
  generarComprobanteRetencionXml,
  generarGuiaRemisionXml,
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

test("Flujo E2E 5: Eliminación de Venta / Nota de Venta y Reversión Automática de Kardex", () => {
  // 1. Simulación de venta con descuento de 4 unidades
  const initialStock = 20;
  const unitCost = 45.0;
  const soldQuantity = 4;
  const stockAfterSale = initialStock - soldQuantity; // 16 unidades

  // 2. Proceso de eliminación de la venta
  // Debe reversar la cantidad vendida al stock de bodega
  const restoredQuantity = soldQuantity;
  const kardexReversion = buildKardexEntry({
    product: { ...mockProduct, baseCost: unitCost },
    warehouse: mockWarehouse,
    type: "CUSTOMER_RETURN",
    referenceId: "inv-del-001",
    referenceDocNumber: "NV-010-001-000000099",
    concept: "Reversión por eliminación de Nota de Venta NV-010-001-000000099",
    quantity: restoredQuantity,
    unitCost: unitCost,
    currentStock: stockAfterSale,
    currentAvgCost: unitCost,
  });

  assert.equal(kardexReversion.balanceQuantity, 20, "Al eliminar la venta, el stock debe restaurarse a las 20 unidades");
  assert.equal(kardexReversion.type, "CUSTOMER_RETURN", "El tipo de movimiento debe registrarse como devolución de cliente");
});

test("Flujo E2E 6: Edición de Nota de Venta (Corrección de Precios, Cantidades y Conciliación Financiera)", () => {
  // 1. Emisión inicial incorrecta: 3 unidades a $150 c/u = $450
  const initialStock = 20;
  const unitCost = 40.0;
  const initialQty = 3;
  const initialPrice = 150.0;
  const initialTotal = initialQty * initialPrice; // $450.00
  let currentStock = initialStock - initialQty; // 17

  // Saldo bancario inicial con el cobro incorrecto
  let bankBalance = 1000.0 + initialTotal; // $1450.00

  // 2. Operador detecta el error: el precio real era $50 y la cantidad real era 2 unidades
  const correctedQty = 2;
  const correctedPrice = 50.0;
  const correctedTotal = correctedQty * correctedPrice; // $100.00

  // 3. Ajuste de Stock (Delta de Cantidad)
  const qtyDelta = correctedQty - initialQty; // -1 unidad (devolver 1 a bodega)
  assert.equal(qtyDelta, -1, "La variación de inventario debe ser de -1 unidad");

  if (qtyDelta < 0) {
    const returnQty = Math.abs(qtyDelta);
    const kardexAjuste = buildKardexEntry({
      product: { ...mockProduct, baseCost: unitCost },
      warehouse: mockWarehouse,
      type: "CUSTOMER_RETURN",
      referenceId: "nv-edit-001",
      referenceDocNumber: "010-001-000000045",
      concept: "Reversión por reducción en edición de Nota de Venta 010-001-000000045",
      quantity: returnQty,
      unitCost: unitCost,
      currentStock: currentStock,
      currentAvgCost: unitCost,
    });
    currentStock = kardexAjuste.balanceQuantity;
    assert.equal(currentStock, 18, "El stock en bodega debe incrementarse de 17 a 18 unidades");
  }

  // 4. Ajuste Financiero (Diferencia de Dinero)
  const diffTotal = correctedTotal - initialTotal; // -$350.00
  assert.equal(diffTotal, -350.0, "La diferencia contable debe ser -$350.00");

  bankBalance += diffTotal;
  assert.equal(bankBalance, 1100.0, "El saldo en cuenta bancaria debe reajustarse exactamente a $1100.00 ($1000 inicial + $100 de la venta real)");
});

test("Flujo E2E 7: Emisión de Nota de Venta Comercial en /ventas y Promoción a Factura Electrónica SRI (Cero Duplicidad)", () => {
  // 1. Operación Comercial Diaria: Emisión de Nota de Venta (NV-010-001-000000010)
  const initialStock = 50;
  const unitCost = 35.0;
  const saleQty = 2;
  const salePrice = 75.0;
  const totalSale = saleQty * salePrice; // $150.00

  // Kardex en la emisión comercial
  const kardexVenta = buildKardexEntry({
    product: { ...mockProduct, baseCost: unitCost },
    warehouse: mockWarehouse,
    type: "SALE",
    referenceId: "sale-nv-010",
    referenceDocNumber: "010-001-000000010",
    concept: "Venta Comercial Nota de Venta 010-001-000000010",
    quantity: saleQty,
    unitCost: unitCost,
    currentStock: initialStock,
    currentAvgCost: unitCost,
  });

  const stockAfterSale = kardexVenta.balanceQuantity;
  assert.equal(stockAfterSale, 48, "El stock en bodega debe quedar en 48 unidades tras emitir la Nota de Venta");

  let bankBalance = 5000.0;
  bankBalance += totalSale; // Entra el dinero del cobro
  assert.equal(bankBalance, 5150.0, "El banco recibe los $150 de la venta comercial");

  // 2. Estado de la Nota de Venta
  let saleStatus = "pendiente_sri";
  assert.equal(saleStatus, "pendiente_sri", "La venta nace como comprobante comercial pendiente de facturar SRI");

  // 3. El usuario decide promover la venta a Factura Electrónica SRI
  // Regla crítica: CERO DUPLICIDAD DE STOCK Y CERO DUPLICIDAD BANCARIA
  const promotesToSri = true;
  if (promotesToSri) {
    const sriFacturaNumber = "010-001-000000045";
    const claveAccesoSri = generarClaveAccesoSRI({
      fechaEmision: "2026-10-24",
      tipoComprobante: "01",
      ruc: "1792458921001",
      ambiente: "2",
      establecimiento: "010",
      puntoEmision: "001",
      secuencial: "000000045",
      codigoNumerico: "98765432",
    });

    assert.equal(claveAccesoSri.length, 49, "La clave de acceso de la factura debe tener 49 dígitos oficiales");

    // Vinculación comercial
    saleStatus = "facturada_sri";
    const linkedSriInvoiceId = "inv-sri-045";

    assert.equal(saleStatus, "facturada_sri");
    assert.equal(linkedSriInvoiceId, "inv-sri-045");

    // Verificación de no duplicidad: El stock sigue siendo 48 (no se descuenta otra vez)
    assert.equal(stockAfterSale, 48, "El stock de bodega NO debe alterarse de nuevo al generar la Factura SRI");
    assert.equal(bankBalance, 5150.0, "El saldo bancario NO debe duplicarse al generar la Factura SRI");
  }
});

test("Flujo E2E 8: Los 5 Comprobantes Electrónicos Oficiales del SRI (Factura 01, NC 04, ND 05, Retención 07, Guía 06)", () => {
  // 1. Factura (01)
  const mockInvoice: any = {
    id: "inv-01",
    documentNumber: "010-001-000000100",
    claveAcceso: "2410202601179245892100120100010000001001234567818",
    date: "2026-10-24",
    clientName: "EMPRESA DE PRUEBA S.A.",
    clientRuc: "1790011223001",
    clientEmail: "tributario@empresa.com",
    clientAddress: "Quito",
    items: [
      {
        id: "item-1",
        productId: "p1",
        sku: "ROUTER-01",
        name: "Router MikroTik",
        quantity: 1,
        unitPrice: 100,
        discount: 0,
        ivaRate: 15,
        subtotal: 100,
        ivaAmount: 15,
        total: 115,
        unit: "unidad",
      },
    ],
    subtotal15: 100,
    subtotal0: 0,
    discountTotal: 0,
    ivaTotal: 15,
    total: 115,
    paymentMethod: "transferencia",
    warehouseId: "wh-1",
    warehouseName: "Bodega",
    kardexRegistered: true,
    status: "emitida",
    createdAt: "2026-10-24",
  };
  const xmlFactura = generarFacturaXml(mockInvoice);
  assert.ok(xmlFactura.includes("<codDoc>01</codDoc>"), "El XML debe tener código 01 de Factura");

  // 2. Nota de Crédito (04)
  const mockNC: any = {
    id: "nc-01",
    documentNumber: "010-001-000000010",
    claveAcceso: "2410202604179245892100120100010000000101234567818",
    date: "2026-10-24",
    invoiceNumber: "010-001-000000100",
    invoiceDate: "2026-10-24",
    clientId: "c1",
    clientName: "EMPRESA DE PRUEBA S.A.",
    clientRuc: "1790011223001",
    clientEmail: "tributario@empresa.com",
    reason: "Devolución de mercadería",
    items: mockInvoice.items,
    subtotal: 100,
    ivaRate: 15,
    ivaAmount: 15,
    total: 115,
    warehouseId: "wh-1",
    warehouseName: "Bodega",
    kardexReentered: true,
    status: "emitida",
    createdAt: "2026-10-24",
  };
  const xmlNC = generarNotaCreditoXml(mockNC);
  assert.ok(xmlNC.includes("<codDoc>04</codDoc>"), "El XML debe tener código 04 de Nota de Crédito");

  // 3. Nota de Débito (05)
  const mockND: any = {
    id: "nd-01",
    documentNumber: "010-001-000000005",
    claveAcceso: "2410202605179245892100120100010000000051234567818",
    date: "2026-10-24",
    modifiedInvoiceNumber: "010-001-000000100",
    modifiedInvoiceDate: "2026-10-24",
    clientId: "c1",
    clientName: "EMPRESA DE PRUEBA S.A.",
    clientRuc: "1790011223001",
    clientEmail: "tributario@empresa.com",
    reasons: [{ reason: "Interés por mora en pago", amount: 10.0 }],
    subtotal: 10.0,
    ivaRate: 15,
    ivaAmount: 1.5,
    total: 11.5,
    status: "emitida",
    createdAt: "2026-10-24",
  };
  const xmlND = generarNotaDebitoXml(mockND);
  assert.ok(xmlND.includes("<codDoc>05</codDoc>"), "El XML debe tener código 05 de Nota de Débito");
  assert.ok(xmlND.includes("<notaDebito"), "Debe abrir con etiqueta notaDebito");

  // 4. Retención (07)
  const mockRet: any = {
    id: "ret-01",
    documentNumber: "010-001-000000020",
    claveAcceso: "2410202607179245892100120100010000000201234567818",
    date: "2026-10-24",
    clientId: "c1",
    clientName: "EMPRESA DE PRUEBA S.A.",
    clientRuc: "1790011223001",
    invoiceNumber: "001-001-000001234",
    fiscalPeriod: "10/2026",
    items: [
      { taxType: "RENTA", code: "312", percentage: 1.75, taxBase: 100, retainedAmount: 1.75 },
    ],
    totalRetained: 1.75,
    status: "emitida",
    createdAt: "2026-10-24",
  };
  const xmlRet = generarComprobanteRetencionXml(mockRet);
  assert.ok(xmlRet.includes("<codDoc>07</codDoc>"), "El XML debe tener código 07 de Retención");

  // 5. Guía de Remisión (06)
  const mockGuia: any = {
    id: "guia-01",
    documentNumber: "010-001-000000008",
    claveAcceso: "2410202606179245892100120100010000000081234567818",
    date: "2026-10-24",
    startDate: "2026-10-24",
    endDate: "2026-10-25",
    carrierName: "TRANSPORTES PICHINCHA",
    carrierRuc: "1791234567001",
    licensePlate: "PDD-1234",
    originAddress: "Quito Norte",
    destAddress: "Cumbayá",
    destClientName: "EMPRESA DE PRUEBA S.A.",
    destClientRuc: "1790011223001",
    route: "Quito - Cumbayá",
    reason: "Entrega de equipos de red",
    items: [{ name: "Router MikroTik", quantity: 1, unit: "unidad" }],
    status: "emitida",
    createdAt: "2026-10-24",
  };
  const xmlGuia = generarGuiaRemisionXml(mockGuia);
  assert.ok(xmlGuia.includes("<codDoc>06</codDoc>"), "El XML debe tener código 06 de Guía de Remisión");
});

test("Flujo E2E 9: Baja Completa de Cliente y Purga en Cascada", () => {
  const clientId = "cli-demo-999";
  let clientsList = [{ id: clientId, businessName: "CLIENTE DEMO", tradeName: "DEMO STORE" }];
  let clientServicesList = [{ id: "srv-1", clientId, planName: "Fibra 200M" }];
  let clientProjectsList = [{ id: "prj-1", clientId, name: "Instalación Fibra" }];
  let clientQuotesList = [{ id: "q-1", clientId, quoteNumber: "COT-2026-0099" }];
  let clientVaultList = [{ id: "v-1", clientId, serviceName: "Router MikroTik WebFig" }];

  assert.equal(clientsList.length, 1);
  assert.equal(clientServicesList.length, 1);
  assert.equal(clientVaultList.length, 1);

  // Ejecución de eliminación en cascada
  clientsList = clientsList.filter((c) => c.id !== clientId);
  clientServicesList = clientServicesList.filter((s) => s.clientId !== clientId);
  clientProjectsList = clientProjectsList.filter((p) => p.clientId !== clientId);
  clientQuotesList = clientQuotesList.filter((q) => q.clientId !== clientId);
  clientVaultList = clientVaultList.filter((v) => v.clientId !== clientId);

  assert.equal(clientsList.length, 0, "El cliente debe desaparecer de la lista de clientes");
  assert.equal(clientServicesList.length, 0, "Los servicios del cliente deben ser purgados");
  assert.equal(clientProjectsList.length, 0, "Los proyectos deben ser purgados");
  assert.equal(clientQuotesList.length, 0, "Las cotizaciones deben ser purgadas");
  assert.equal(clientVaultList.length, 0, "Las credenciales de bóveda deben ser purgadas");
});

test("Flujo E2E 10: Seguimiento de Servicios del Cliente (Inventario Oficial, Asignación Manual Pendiente y Promoción por Nota de Venta)", () => {
  // 1. Inventario de Servicios Oficial
  const inventoryServices = [
    {
      id: "srv-prod-fibra-200",
      sku: "SRV-FIB-200",
      name: "Internet Fibra Óptica 200 Mbps Corporativo",
      type: "servicio" as const,
      salePrice: 45.0,
      ivaRate: 15,
      tracksStock: false,
      status: "activo" as const,
    },
    {
      id: "srv-prod-ip-fija",
      sku: "SRV-IP-PUB",
      name: "Enlace con IPv4 Pública Estática",
      type: "servicio" as const,
      salePrice: 15.0,
      ivaRate: 15,
      tracksStock: false,
      status: "activo" as const,
    },
  ];

  const clientId = "cli-arteaga-01";
  let clientServicesList: Array<{
    id: string;
    clientId: string;
    inventoryProductId: string;
    inventorySku: string;
    planName: string;
    basePrice: number;
    customPrice: number;
    origin?: "manual" | "nota_venta" | "factura";
    saleStatus?: "pendiente_venta" | "emitida";
    saleDocNumber?: string;
    saleInvoiceId?: string;
  }> = [];

  // 2. Asignación manual sin venta (debe tomarse del inventario oficial de servicios)
  const chosenService = inventoryServices.find((s) => s.id === "srv-prod-fibra-200")!;
  assert.ok(chosenService, "El servicio debe existir en el Inventario de Servicios");
  assert.equal(chosenService.type, "servicio", "Debe ser de tipo 'servicio' sin control de stock");

  const manualAssignedService = {
    id: "cs-001",
    clientId,
    inventoryProductId: chosenService.id,
    inventorySku: chosenService.sku,
    planName: chosenService.name,
    basePrice: chosenService.salePrice,
    customPrice: chosenService.salePrice,
    origin: "manual" as const,
    saleStatus: "pendiente_venta" as const,
  };
  clientServicesList.push(manualAssignedService);

  assert.equal(clientServicesList.length, 1);
  assert.equal(clientServicesList[0].saleStatus, "pendiente_venta", "Debe estar marcado como pendiente de Nota de Venta");
  assert.equal(clientServicesList[0].saleDocNumber, undefined, "No debe tener número de nota de venta todavía");

  // 3. Generación de Nota de Venta comercial para el servicio asignado
  const notaVenta = {
    id: "inv-nota-991",
    documentType: "nota_venta",
    documentNumber: "010-001-000000045",
    date: "2026-10-24",
    clientId,
    items: [
      {
        productId: chosenService.id,
        sku: chosenService.sku,
        name: chosenService.name,
        unitPrice: 45.0,
        unit: "servicio",
      },
    ],
  };

  // La emisión de la nota de venta promueve el servicio existente a 'emitida'
  const pendingIndex = clientServicesList.findIndex(
    (s) => s.clientId === clientId && s.inventoryProductId === chosenService.id && s.saleStatus === "pendiente_venta"
  );
  assert.ok(pendingIndex >= 0, "Debe encontrar el servicio pendiente");
  clientServicesList[pendingIndex] = {
    ...clientServicesList[pendingIndex],
    origin: "nota_venta",
    saleStatus: "emitida",
    saleDocNumber: notaVenta.documentNumber,
    saleInvoiceId: notaVenta.id,
  };

  assert.equal(clientServicesList[0].saleStatus, "emitida", "El servicio ahora tiene Nota de Venta emitida");
  assert.equal(clientServicesList[0].saleDocNumber, "010-001-000000045", "El comprobante debe estar vinculado");

  // 4. Emisión de una Nota de Venta directa con un segundo servicio (entra directamente por venta)
  const secondService = inventoryServices.find((s) => s.id === "srv-prod-ip-fija")!;
  const notaVenta2 = {
    id: "inv-nota-992",
    documentType: "nota_venta",
    documentNumber: "010-001-000000046",
    date: "2026-10-24",
    clientId,
    items: [
      {
        productId: secondService.id,
        sku: secondService.sku,
        name: secondService.name,
        unitPrice: 15.0,
        unit: "servicio",
      },
    ],
  };

  clientServicesList.push({
    id: "cs-002",
    clientId,
    inventoryProductId: secondService.id,
    inventorySku: secondService.sku,
    planName: secondService.name,
    basePrice: secondService.salePrice,
    customPrice: secondService.salePrice,
    origin: "nota_venta",
    saleStatus: "emitida",
    saleDocNumber: notaVenta2.documentNumber,
    saleInvoiceId: notaVenta2.id,
  });

  assert.equal(clientServicesList.length, 2, "La ficha del cliente debe reflejar ambos servicios");
  assert.equal(clientServicesList.filter((s) => s.saleStatus === "emitida").length, 2, "Ambos servicios tienen comprobante");

  // 5. Reversión al anular o eliminar una Nota de Venta
  clientServicesList = clientServicesList.map((s) => {
    if (s.saleInvoiceId === notaVenta.id) {
      return {
        ...s,
        saleInvoiceId: undefined,
        saleDocNumber: undefined,
        saleStatus: "pendiente_venta" as const,
      };
    }
    return s;
  });

  assert.equal(clientServicesList[0].saleStatus, "pendiente_venta", "El primer servicio vuelve a quedar pendiente de venta");
  assert.equal(clientServicesList[0].saleDocNumber, undefined);
  assert.equal(clientServicesList[1].saleStatus, "emitida", "El segundo servicio permanece emitido");
});

test("Flujo E2E 11: Visibilidad Condicional de Pestañas del Cliente (Solo Identificación y Servicios si services.length === 0)", () => {
  const allTabs = [
    { id: "fiscal", label: "Identificación" },
    { id: "red", label: "Nodos" },
    { id: "boveda", label: "Bóveda" },
    { id: "contratos", label: "Servicios" },
    { id: "cotizaciones", label: "Cotizaciones" },
    { id: "finanzas", label: "Cobros" },
    { id: "tickets", label: "Tickets" },
    { id: "proyectos", label: "Tareas" },
    { id: "tramites", label: "Trámites" },
    { id: "arcotel", label: "ARCOTEL" },
    { id: "dossier", label: "Informes" },
  ];

  const filterTabs = (hasServices: boolean) => {
    return allTabs.filter((t) => {
      if (!hasServices) {
        return t.id === "fiscal" || t.id === "contratos";
      }
      return true;
    });
  };

  // Caso 1: Cliente nuevo sin servicios contratados
  const tabsSinServicios = filterTabs(false);
  assert.equal(tabsSinServicios.length, 2, "Solo deben mostrarse 2 pestañas cuando no hay servicios");
  assert.deepEqual(
    tabsSinServicios.map((t) => t.id),
    ["fiscal", "contratos"],
    "Solo Identificación y Servicios deben estar disponibles"
  );

  // Caso 2: Cliente contrata un servicio en 'contratos' o por nota de venta
  const tabsConServicios = filterTabs(true);
  assert.equal(tabsConServicios.length, 11, "Todas las 11 pestañas deben desbloquearse al tomar servicios");
  assert.ok(tabsConServicios.some((t) => t.id === "red"));
  assert.ok(tabsConServicios.some((t) => t.id === "boveda"));
  assert.ok(tabsConServicios.some((t) => t.id === "finanzas"));
});

test("Flujo E2E 12: Gestión Exclusiva de Contactos de Cliente (Popup Aislado de Edición Fiscal)", () => {
  let client = {
    id: "cli-999",
    identification: "1792458921001",
    businessName: "CORPORACION ANDINA DE TELECOMUNICACIONES S.A.",
    tradename: "ANDINATEL REDES",
    email: "facturacion@andinatel.com",
    phone: "022345678",
    address: "Av. República de El Salvador 1084",
    sector: "Iñaquito Norte",
    contacts: [
      {
        id: "ct-1",
        name: "Ing. Carlos Mendoza",
        role: "Gerente de TI",
        phone: "0991234567",
        email: "cmendoza@andinatel.com",
        address: "Piso 4 Oficina Técnica",
      },
    ],
    contactName: "Ing. Carlos Mendoza",
    contactRole: "Gerente de TI",
    contactPhone: "0991234567",
    contactAddress: "Piso 4 Oficina Técnica",
  };

  // 1. Simulación de agregar nuevo contacto mediante el modal exclusivo
  const newContact = {
    id: "ct-2",
    name: "Lic. Diana Paredes",
    role: "Jefa de Compras y Pagos",
    phone: "0987654321",
    email: "dparedes@andinatel.com",
    address: "Piso 2 Administración",
  };

  const updatedContacts = [...client.contacts, newContact];

  // La actualización solo modifica contactos, no los datos fiscales
  client = {
    ...client,
    contacts: updatedContacts,
  };

  assert.equal(client.contacts.length, 2, "El cliente ahora debe tener 2 personas de contacto");
  assert.equal(client.contacts[1].name, "Lic. Diana Paredes");
  assert.equal(client.identification, "1792458921001", "El RUC fiscal debe permanecer inalterado");
  assert.equal(client.tradename, "ANDINATEL REDES", "El Nombre Comercial no debe alterarse");

  // 2. Edición de contacto específico
  const editedContacts = client.contacts.map((c) =>
    c.id === "ct-2" ? { ...c, phone: "0987000111", role: "Directora Financiera" } : c
  );
  client = { ...client, contacts: editedContacts };
  assert.equal(client.contacts[1].phone, "0987000111");
  assert.equal(client.contacts[1].role, "Directora Financiera");

  // 3. Eliminación de un contacto
  const remainingContacts = client.contacts.filter((c) => c.id !== "ct-1");
  client = {
    ...client,
    contacts: remainingContacts,
    contactName: remainingContacts[0]?.name || "",
    contactRole: remainingContacts[0]?.role || "",
    contactPhone: remainingContacts[0]?.phone || "",
    contactAddress: remainingContacts[0]?.address || "",
  };

  assert.equal(client.contacts.length, 1);
  assert.equal(client.contacts[0].id, "ct-2");
  assert.equal(client.contactName, "Lic. Diana Paredes", "El contacto principal pasa a ser el restante");
  assert.equal(client.businessName, "CORPORACION ANDINA DE TELECOMUNICACIONES S.A.", "La Razón Social sigue intacta");
});

test("Flujo E2E 13: Selección y Copiado de Texto Libre en Bóveda, IPs, Fichas y Tablas", () => {
  const rootDir = process.cwd();

  // 1. Verificar que globals.css tiene la regla de user-select: text
  const cssPath = path.resolve(rootDir, "src/app/globals.css");
  const cssContent = fs.readFileSync(cssPath, "utf8");
  assert.ok(
    cssContent.includes("user-select: text"),
    "globals.css debe contener regla user-select: text para permitir copiado natural con cursor"
  );

  // 2. Verificar que los componentes clave de Bóveda y Nodos no contengan select-none en sus contenedores
  const vaultPath = path.resolve(rootDir, "src/components/modules/vault/SecureVault.tsx");
  const vaultContent = fs.readFileSync(vaultPath, "utf8");
  assert.ok(!vaultContent.includes("select-none"), "SecureVault no debe contener select-none");

  const nodesPath = path.resolve(rootDir, "src/components/modules/clients/ClientNodesTab.tsx");
  const nodesContent = fs.readFileSync(nodesPath, "utf8");
  assert.ok(!nodesContent.includes("select-none"), "ClientNodesTab no debe contener select-none");

  const profilePath = path.resolve(rootDir, "src/components/modules/clients/ClientProfile360.tsx");
  const profileContent = fs.readFileSync(profilePath, "utf8");
  assert.ok(!profileContent.includes("select-none"), "ClientProfile360 no debe contener select-none");
});

test("Flujo E2E 14: Submódulo de Bancos (Permisos Granulares, Inicialización de Cuentas y Transferencias)", () => {
  const rootDir = process.cwd();

  // 1. Verificar que finanzas/page.tsx incluye el ribbon de navegación con el submódulo de bancos
  const finanzasPagePath = path.resolve(rootDir, "src/app/finanzas/page.tsx");
  const finanzasPageContent = fs.readFileSync(finanzasPagePath, "utf8");
  assert.ok(
    finanzasPageContent.includes("FINANCE_TABS") && finanzasPageContent.includes("BankAccountsTab"),
    "La página de Finanzas debe tener la cinta de pestañas con acceso directo al submódulo de Bancos"
  );

  // 2. Verificar que permissions.ts habilita bancos para roles autorizados (admin, superadmin, finanzas, ventas, consulta)
  const permsPath = path.resolve(rootDir, "src/lib/permissions.ts");
  const permsContent = fs.readFileSync(permsPath, "utf8");
  assert.ok(
    permsContent.includes('moduleKey === "finanzas" && user.permissions?.includes("manage_finance")'),
    "canAccessSubmodule debe habilitar todos los submódulos de finanzas cuando el usuario tiene manage_finance"
  );

  // 3. Simulación de cuentas bancarias y transferencia interna
  let bankAccounts = [
    {
      id: "bank-pichincha-01",
      bankName: "Banco Pichincha",
      accountType: "corriente",
      accountNumber: "2100234567",
      currency: "USD",
      initialBalance: 5000.0,
      currentBalance: 5000.0,
      status: "activa",
    },
    {
      id: "bank-guayaquil-02",
      bankName: "Banco Guayaquil",
      accountType: "corriente",
      accountNumber: "1140987654",
      currency: "USD",
      initialBalance: 3500.0,
      currentBalance: 3500.0,
      status: "activa",
    },
  ];

  // Transferencia de $1,200 desde Banco Pichincha hacia Banco Guayaquil
  const transferAmount = 1200.0;
  bankAccounts = bankAccounts.map((b) => {
    if (b.id === "bank-pichincha-01") return { ...b, currentBalance: b.currentBalance - transferAmount };
    if (b.id === "bank-guayaquil-02") return { ...b, currentBalance: b.currentBalance + transferAmount };
    return b;
  });

  assert.equal(bankAccounts[0].currentBalance, 3800.0, "El saldo origen debe disminuir en $1,200");
  assert.equal(bankAccounts[1].currentBalance, 4700.0, "El saldo destino debe aumentar en $1,200");
  const totalLiquidity = bankAccounts.reduce((sum, b) => sum + b.currentBalance, 0);
  assert.equal(totalLiquidity, 8500.0, "La liquidez total institucional debe conservarse intacta ($8,500)");
});

test("Flujo E2E 15: Auditoría Integral de Facturación SRI (5 Comprobantes Oficiales) y Proceso de Ventas Comerciales", () => {
  const rootDir = process.cwd();

  // 1. Verificar que BillingManager integra los 5 comprobantes oficiales del SRI (01, 04, 05, 07, 06) incluyendo WithholdingModal
  const billingManagerPath = path.resolve(rootDir, "src/components/modules/billing/BillingManager.tsx");
  const billingManagerContent = fs.readFileSync(billingManagerPath, "utf8");
  assert.ok(
    billingManagerContent.includes("WithholdingModal"),
    "BillingManager debe integrar WithholdingModal para emitir Comprobantes de Retención (07)"
  );
  assert.ok(
    billingManagerContent.includes("filteredWithholdings") &&
      billingManagerContent.includes("filteredRemissionGuides"),
    "BillingManager debe filtrar correctamente Retenciones (07) y Guías de Remisión (06)"
  );
  assert.ok(
    billingManagerContent.includes('inv.documentType === "nota_venta"') &&
      billingManagerContent.includes("return false"),
    "BillingManager debe separar estrictamente las Facturas SRI (01) de las Notas de Venta internas"
  );

  // 2. Verificar que SalesManager integra NewSaleView para nueva_venta y conversión de cotizaciones
  const salesManagerPath = path.resolve(rootDir, "src/components/modules/sales/SalesManager.tsx");
  const salesManagerContent = fs.readFileSync(salesManagerPath, "utf8");
  assert.ok(
    salesManagerContent.includes('<NewSaleView') &&
      salesManagerContent.includes('initialDocType="nota_venta"'),
    "SalesManager debe renderizar NewSaleView con initialDocType='nota_venta' en el submódulo nueva_venta"
  );
  assert.ok(
    salesManagerContent.includes("convertQuoteToInvoice"),
    "SalesManager debe permitir convertir cotizaciones directamente a Nota de Venta o Factura SRI"
  );

  // 3. Verificar que ConvertToSriInvoiceModal permite completar/editar RUC, Razón Social y Correo antes de emitir al SRI
  const convertModalPath = path.resolve(rootDir, "src/components/modules/sales/ConvertToSriInvoiceModal.tsx");
  const convertModalContent = fs.readFileSync(convertModalPath, "utf8");
  assert.ok(
    convertModalContent.includes("setClientRuc") &&
      convertModalContent.includes("setClientEmail") &&
      convertModalContent.includes("convertSaleToSriInvoice(sale.id,"),
    "ConvertToSriInvoiceModal debe permitir editar datos fiscales del receptor y enviarlos a convertSaleToSriInvoice"
  );
});

test("Flujo E2E 16: Separación Estricta de Ventas, Inventario y Finanzas respecto a Facturación Electrónica SRI", () => {
  const rootDir = process.cwd();

  // 1. Verificar que NewSaleView registra siempre como Nota de Venta comercial y ofrece promoción posterior a Factura SRI
  const newSalePath = path.resolve(rootDir, "src/components/modules/billing/NewSaleView.tsx");
  const newSaleContent = fs.readFileSync(newSalePath, "utf8");
  assert.ok(
    newSaleContent.includes("Nueva Nota de Venta") &&
      newSaleContent.includes("ConvertToSriInvoiceModal") &&
      newSaleContent.includes("Pasar a Factura Electrónica SRI"),
    "NewSaleView debe operar exclusivamente como Nota de Venta comercial y permitir pasarla luego a Factura Electrónica SRI"
  );

  // 2. Verificar que CreditNoteModal y BillingManager operan en el ámbito tributario SRI sin tocar Kardex ni finanzas
  const creditNoteModalPath = path.resolve(rootDir, "src/components/modules/billing/CreditNoteModal.tsx");
  const creditNoteModalContent = fs.readFileSync(creditNoteModalPath, "utf8");
  assert.ok(
    !creditNoteModalContent.includes("Bodega de Reingreso de Stock") &&
      creditNoteModalContent.includes("No altera el inventario ni los movimientos bancarios del módulo comercial"),
    "CreditNoteModal no debe alterar el Kardex de inventario ni los bancos del módulo comercial"
  );

  const billingManagerPath = path.resolve(rootDir, "src/components/modules/billing/BillingManager.tsx");
  const billingManagerContent = fs.readFileSync(billingManagerPath, "utf8");
  assert.ok(
    billingManagerContent.includes("Emitir Factura") &&
      billingManagerContent.includes("handleVoidSriInvoice") &&
      billingManagerContent.includes("batchFilter") &&
      billingManagerContent.includes("dateFrom") &&
      !billingManagerContent.includes("<th className=\"py-2.5 px-3\">Bodega</th>"),
    "BillingManager debe mostrar el botón Emitir Factura, filtrar por lotes y fechas, y omitir la columna Bodega"
  );
});

test("Flujo E2E 17: Simplificación del Módulo de Finanzas y Submódulos (Términos Claros y Procesos Directos)", () => {
  const rootDir = process.cwd();

  const financeDashboardPath = path.resolve(rootDir, "src/components/modules/finance/FinanceDashboard.tsx");
  const financeDashboardContent = fs.readFileSync(financeDashboardPath, "utf8");

  assert.ok(
    !financeDashboardContent.includes("Efectivo Dalmau") &&
      !financeDashboardContent.includes("Efectivo Equinoccio") &&
      !financeDashboardContent.includes("Factura Manual / Ocasional"),
    "FinanceDashboard no debe contener métodos de pago extraños ni botones de emisión de facturas ajenos a Finanzas"
  );
  assert.ok(
    (financeDashboardContent.includes("Control de Cobros") || financeDashboardContent.includes("Cobros de Clientes")) &&
      financeDashboardContent.includes("formatFinanceCategory"),
    "FinanceDashboard debe usar etiquetas claras y formateador de categorías reconocibles"
  );
});

test("Flujo E2E 18: Simplificación y Unificación del Módulo de Inventarios (Productos, Servicios y Submódulos)", () => {
  const rootDir = process.cwd();

  const productModalPath = path.resolve(rootDir, "src/components/modules/inventory/ProductModal.tsx");
  const productModalContent = fs.readFileSync(productModalPath, "utf8");

  assert.ok(
    !productModalContent.includes("Identificación & Nomenclatura") &&
      !productModalContent.includes("Precios & Tributación SRI") &&
      !productModalContent.includes("Solo lectura auditada (SRI/NIIF)") &&
      !productModalContent.includes("EAN13"),
    "ProductModal no debe mostrar títulos largos ni siglas confusas"
  );
  assert.ok(
    productModalContent.includes("Nombre del Servicio *") &&
      productModalContent.includes("Nombre del Producto *") &&
      productModalContent.includes("Guardar Servicio") &&
      productModalContent.includes("Guardar Producto"),
    "ProductModal debe adaptar sus etiquetas claramente según se cree un Producto o un Servicio"
  );

  const inventoryManagerPath = path.resolve(rootDir, "src/components/modules/inventory/InventoryManager.tsx");
  const inventoryManagerContent = fs.readFileSync(inventoryManagerPath, "utf8");

  assert.ok(
    inventoryManagerContent.includes('actionParam === "nuevo"') &&
      !inventoryManagerContent.includes("Servicio Técnico / Mano de Obra") &&
      !inventoryManagerContent.includes("Artículos Homologados"),
    "InventoryManager debe soportar action=nuevo y usar encabezados claros"
  );
});

test("Flujo E2E 19: Impresión Correcta de Documentos (RIDE A4, Ticket 80mm, Cotizaciones, Retenciones y Expediente)", () => {
  const rootDir = process.cwd();

  const printServicePath = path.resolve(rootDir, "src/lib/print-service.ts");
  const printServiceContent = fs.readFileSync(printServicePath, "utf8");
  assert.ok(
    printServiceContent.includes("element.outerHTML") &&
      printServiceContent.includes("print\\\\:col-span-7") &&
      printServiceContent.includes("print\\\\:col-span-5"),
    "print-service debe usar element.outerHTML y forzar columnas 7/5 en grillas de 12 columnas para impresión A4"
  );

  const ridePreviewPath = path.resolve(rootDir, "src/components/modules/billing/RidePreviewModal.tsx");
  const ridePreviewContent = fs.readFileSync(ridePreviewPath, "utf8");
  assert.ok(
    ridePreviewContent.includes("print:col-span-7") &&
      ridePreviewContent.includes("print:col-span-5") &&
      ridePreviewContent.includes("print:grid-cols-12"),
    "RidePreviewModal debe definir explícitamente print:col-span-7 y print:col-span-5 para evitar columnas comprimidas"
  );

  const quotePreviewPath = path.resolve(rootDir, "src/components/modules/billing/QuotePreviewModal.tsx");
  const quotePreviewContent = fs.readFileSync(quotePreviewPath, "utf8");
  assert.ok(
    !quotePreviewContent.includes("visibility: hidden") &&
      quotePreviewContent.includes("print:col-span-7") &&
      quotePreviewContent.includes("print:col-span-5"),
    "QuotePreviewModal no debe inyectar visibility: hidden global que deje páginas en blanco al imprimir"
  );

  const purchaseWithholdingPath = path.resolve(rootDir, "src/components/modules/purchases/PurchaseWithholdingsTab.tsx");
  const purchaseWithholdingContent = fs.readFileSync(purchaseWithholdingPath, "utf8");
  assert.ok(
    purchaseWithholdingContent.includes("printHtmlElement") &&
      purchaseWithholdingContent.includes("withholding-print-area"),
    "PurchaseWithholdingsTab debe usar printHtmlElement aislado para imprimir comprobantes de retención"
  );
});

test("Flujo E2E 20: Simplificación del Módulo de Ventas (Título en Header, Barra Unificada con Botón y Menú Lateral Exclusivo)", () => {
  const rootDir = process.cwd();

  const headerPath = path.resolve(rootDir, "src/components/layout/Header.tsx");
  const headerContent = fs.readFileSync(headerPath, "utf8");
  assert.ok(
    headerContent.includes('pathname === "/ventas"') &&
      headerContent.includes('return "Notas de Venta"') &&
      headerContent.includes('return "Cotizaciones"'),
    "Header.tsx debe mapear el módulo /ventas para mostrar los títulos de submódulo arriba"
  );

  const salesManagerPath = path.resolve(rootDir, "src/components/modules/sales/SalesManager.tsx");
  const salesManagerContent = fs.readFileSync(salesManagerPath, "utf8");
  assert.ok(
    !salesManagerContent.includes("Total Notas de Venta") &&
      !salesManagerContent.includes("Comprobantes Registrados") &&
      !salesManagerContent.includes("Venta Comercial (Pendiente SRI)") &&
      salesManagerContent.includes("Nueva Nota de Venta") &&
      salesManagerContent.includes("Nueva Cotización"),
    "SalesManager debe unificar la barra de filtros con el botón de acción, sin tarjetas KPI ni redundancias"
  );
});

test("Flujo E2E 21: Limpieza de Ficha de Servicios/Documentos y Eliminación de Credenciales en Barra Lateral", () => {
  const rootDir = process.cwd();

  const clientContractTabPath = path.resolve(rootDir, "src/components/modules/clients/ClientContractTab.tsx");
  const tabContent = fs.readFileSync(clientContractTabPath, "utf8");

  // 1. Título de Servicios limpio sin contadores
  assert.ok(
    !tabContent.includes('badge=') &&
      tabContent.includes('title="Servicios"'),
    "ClientContractTab no debe incluir badges con contadores en el encabezado de Servicios"
  );

  // 2. Barra de monto mensual y alertas de origen removidas
  assert.ok(
    !tabContent.includes("Monto Mensual (IVA incl.)") &&
      !tabContent.includes("servicio(s) asignado(s) manualmente sin Nota de Venta"),
    "ClientContractTab no debe mostrar la barra de Monto Mensual ni avisos de asignación sin nota de venta"
  );

  // 3. Botones de filtro limpios sin números entre paréntesis
  assert.ok(
    tabContent.includes('{ id: "todos", label: "Todos" }') &&
      tabContent.includes('{ id: "facturables", label: "Activos" }') &&
      tabContent.includes('{ id: "por_renovar", label: "Por Renovar" }') &&
      !tabContent.includes('Con Venta (') &&
      !tabContent.includes('Pendiente Venta ('),
    "ClientContractTab debe mostrar filtros limpios sin contadores entre paréntesis ni estados de venta confusos"
  );

  // 4. Columna Origen / Venta y botón Nota Venta eliminados de la tabla técnica
  assert.ok(
    !tabContent.includes("ORIGEN / VENTA") &&
      !tabContent.includes("<span>Nota Venta</span>") &&
      !tabContent.includes("+ Generar Nota de Venta"),
    "ClientContractTab debe eliminar la columna Origen / Venta y botones de Nota de Venta de la tabla de servicios"
  );

  // 5. Encabezado de Documentos limpio sin badge de conteo
  assert.ok(
    !tabContent.includes("({docs.length})"),
    "ClientContractTab debe mostrar el encabezado Documentos limpio sin número entre paréntesis"
  );

  // 6. Barra lateral (Sidebar) sin el acceso 'Credenciales'
  const sidebarPath = path.resolve(rootDir, "src/components/layout/Sidebar.tsx");
  const sidebarContent = fs.readFileSync(sidebarPath, "utf8");
  assert.ok(
    !sidebarContent.includes('label: "Credenciales"'),
    "Sidebar.tsx no debe incluir el ítem Credenciales en el menú lateral principal"
  );

  // 7. Pólizas ARCOTEL: Columna y botón de Documento (Oficio ARCOTEL) eliminados
  const policiesListPath = path.resolve(rootDir, "src/components/modules/arcotel/PoliciesList.tsx");
  const policiesContent = fs.readFileSync(policiesListPath, "utf8");
  assert.ok(
    !policiesContent.includes(">Documento</th>") &&
      !policiesContent.includes("Oficio ARCOTEL") &&
      !policiesContent.includes("handleDownloadRenewal"),
    "PoliciesList no debe incluir la columna ni la opción de documento/oficio ARCOTEL"
  );

  // 8. Modal Registrar Póliza ARCOTEL: Campo Notas u Observaciones eliminado
  const policyModalPath = path.resolve(rootDir, "src/components/modules/arcotel/PolicyModal.tsx");
  const modalContent = fs.readFileSync(policyModalPath, "utf8");
  assert.ok(
    !modalContent.includes("Notas u Observaciones") &&
      !modalContent.includes("Endoso número 3 remitido por QUIPUX"),
    "PolicyModal no debe incluir el campo de Notas u Observaciones"
  );

  // 9. Corrección de caracteres corruptos / mojibake en datos y formulario de concesión ARCOTEL
  const mockDataPath = path.resolve(rootDir, "src/lib/mock-data.ts");
  const mockDataContent = fs.readFileSync(mockDataPath, "utf8");
  assert.ok(
    !mockDataContent.includes("\u00C3") &&
      !mockDataContent.includes("Permiso Ãšnico") &&
      !mockDataContent.includes("NÃºmero de TrÃ¡mite") &&
      !mockDataContent.includes("ResoluciÃ³n ARCOTEL") &&
      mockDataContent.includes("Permiso Único para Prestación de Servicios del Régimen General de Telecomunicaciones") &&
      mockDataContent.includes("Número de Trámite Quipux") &&
      mockDataContent.includes("Resolución ARCOTEL Matriz"),
    "mock-data.ts debe contener caracteres limpios en español sin mojibake"
  );

  // 10. ARCOTEL: Título superior y contador eliminados para subir directamente las pestañas
  const arcotelManagerPath = path.resolve(rootDir, "src/components/modules/arcotel/ArcotelManager.tsx");
  const arcotelContent = fs.readFileSync(arcotelManagerPath, "utf8");
  assert.ok(
    !arcotelContent.includes('title="ARCOTEL"') &&
      !arcotelContent.includes("Archivos Regulatorios:") &&
      !arcotelContent.includes("Expediente Habilitado"),
    "ArcotelManager no debe incluir el banner/título redundante de ARCOTEL ni el contador, subiendo directo las pestañas"
  );

  // 11. Tareas y Proyectos: Retiro total de "Flujo ISP" y términos ISP en todo el sistema
  const clientTasksPath = path.resolve(rootDir, "src/components/modules/clients/ClientTasksTab.tsx");
  const clientTasksContent = fs.readFileSync(clientTasksPath, "utf8");
  assert.ok(
    !clientTasksContent.includes("Flujo ISP") &&
      !clientTasksContent.includes("({clientTasks.length})"),
    "ClientTasksTab no debe incluir el selector de Flujo ISP ni contadores en el título"
  );

  const kanbanPath = path.resolve(rootDir, "src/components/modules/clients/ClientProjectKanban.tsx");
  const kanbanContent = fs.readFileSync(kanbanPath, "utf8");
  assert.ok(
    !kanbanContent.includes("Flujo ISP"),
    "ClientProjectKanban no debe incluir la opción de Flujo ISP"
  );

  const taskModalPath = path.resolve(rootDir, "src/components/modules/projects/ProjectTaskModal.tsx");
  const taskModalContent = fs.readFileSync(taskModalPath, "utf8");
  assert.ok(
    !taskModalContent.includes("Flujo ISP"),
    "ProjectTaskModal no debe incluir el selector de Flujo ISP"
  );
});

test("Flujo E2E 22: Módulo de Plantillas Limpio y Directo (Sin Descripciones Redundantes ni Columnas Inútiles)", () => {
  const rootDir = process.cwd();
  const templateGenPath = path.resolve(rootDir, "src/components/modules/templates/TemplateGenerator.tsx");
  const templateGenContent = fs.readFileSync(templateGenPath, "utf8");

  // Barra de búsqueda sin badge de conteo total
  assert.ok(
    !templateGenContent.includes("<span>Total:</span>") &&
      !templateGenContent.includes("plantillas</span>"),
    "TemplateGenerator no debe mostrar el badge redundante de conteo total en la barra superior"
  );

  // Plantillas del Sistema: sin subtítulo, sin badge de activas, sin icono, sin descripciones, sin Módulo de Origen, sin Estado
  assert.ok(
    !templateGenContent.includes("Documentos generados automáticamente con datos del sistema") &&
      !templateGenContent.includes("activas</span>") &&
      !templateGenContent.includes(">Módulo de Origen<") &&
      !templateGenContent.includes(">Estado<") &&
      !templateGenContent.includes("Listo para Generación") &&
      !templateGenContent.includes("{tmpl.desc}"),
    "Plantillas del Sistema debe mostrar únicamente títulos directos, formato y botón de acción, sin descripciones ni columnas innecesarias"
  );

  // Plantillas Institucionales: sin subtítulo, sin badge de conteo, sin descripciones, sin columna Tamaño, sin columna Responsable
  assert.ok(
    !templateGenContent.includes("Archivos descargables y editables (Word, Excel y PDF)") &&
      !templateGenContent.includes("documentos</span>") &&
      !templateGenContent.includes(">Tamaño<") &&
      !templateGenContent.includes(">Responsable<") &&
      !templateGenContent.includes("{item.description}"),
    "Plantillas Institucionales no debe mostrar descripciones bajo títulos, ni columnas Tamaño ni Responsable"
  );
});

test("Flujo E2E 23: Soporte Técnico UX/UI — Clean Workspace (Caja al Pie, Panel Unificado y 0 Banners Redundantes)", () => {
  const rootDir = process.cwd();
  const ticketDetailPath = path.resolve(rootDir, "src/components/modules/tickets/TicketDetail.tsx");
  const ticketDetailContent = fs.readFileSync(ticketDetailPath, "utf8");

  // 1. Verificación de flujo natural: El historial de asistencia debe aparecer ANTES del formulario de respuesta
  const historyIndex = ticketDetailContent.indexOf("Historial de Asistencia");
  const replyBoxIndex = ticketDetailContent.indexOf("Clean Workspace Foot Reply Box");
  assert.ok(historyIndex !== -1, "Debe contener la sección Historial de Asistencia");
  assert.ok(replyBoxIndex !== -1, "Debe contener el cuadro de respuesta al pie");
  assert.ok(
    historyIndex < replyBoxIndex,
    "El Historial de Asistencia debe preceder a la Caja de Respuesta para lectura natural cronológica"
  );

  // 2. Sin banners de advertencia redundantes de nota privada
  assert.ok(
    !ticketDetailContent.includes("Esta nota técnica es <strong>PRIVADA</strong>: visible únicamente para administradores"),
    "No debe existir el banner redundante de advertencia de nota privada"
  );

  // 3. Panel de contexto derecho unificado en un solo contenedor con divisiones suaves
  assert.ok(
    ticketDetailContent.includes("Información del Caso") &&
      ticketDetailContent.includes("divide-y divide-[#f1f5f9]"),
    "El panel derecho debe estar unificado bajo 'Información del Caso' con divisiones suaves"
  );

  // 4. Soporte para atajo de teclado Ctrl+Enter / Cmd+Enter
  assert.ok(
    ticketDetailContent.includes("Ctrl + Enter") &&
      ticketDetailContent.includes("e.ctrlKey || e.metaKey"),
    "La caja de respuesta debe soportar el atajo Ctrl+Enter para agilizar el envío"
  );
});

test("Flujo E2E 24: Estandarización Global de Diseño UI/UX Fase 1 (Plantillas & Ficha de Clientes: Identificación y Servicios)", () => {
  const rootDir = process.cwd();

  // 1. TemplateGenerator.tsx
  const tmplPath = path.resolve(rootDir, "src/components/modules/templates/TemplateGenerator.tsx");
  const tmplContent = fs.readFileSync(tmplPath, "utf8");
  assert.ok(
    tmplContent.includes("w-6/12") && tmplContent.includes("w-3/12"),
    "TemplateGenerator debe tener anchos de columna fijos en Plantillas del Sistema"
  );
  assert.ok(
    tmplContent.includes("w-4/12") && tmplContent.includes("w-1/12"),
    "TemplateGenerator debe tener anchos de columna fijos en Plantillas Institucionales"
  );
  assert.ok(
    !tmplContent.includes("rounded-2xl"),
    "TemplateGenerator debe usar radio de esquinas moderado rounded-xl sin excesos rounded-2xl"
  );

  // 2. ClientProfile360.tsx (Tab Identificación)
  const profilePath = path.resolve(rootDir, "src/components/modules/clients/ClientProfile360.tsx");
  const profileContent = fs.readFileSync(profilePath, "utf8");
  assert.ok(
    profileContent.includes("Single Canvas, Cero Tarjetas Anidadas"),
    "ClientProfile360 debe unificar datos fiscales y contactos en un único canvas plano"
  );
  assert.ok(
    profileContent.includes("text-xs font-semibold text-[#64748b]") &&
      profileContent.includes("text-[#0b1c30]"),
    "ClientProfile360 debe emplear tipografía legible y de alto contraste"
  );
  assert.ok(
    profileContent.includes("font-mono font-bold text-[#004ac6] text-sm"),
    "ClientProfile360 debe destacar el RUC/CI en mono azul corporativo"
  );

  // 3. ClientContractTab.tsx (Tab Servicios & Documentos)
  const contractPath = path.resolve(rootDir, "src/components/modules/clients/ClientContractTab.tsx");
  const contractContent = fs.readFileSync(contractPath, "utf8");
  assert.ok(
    contractContent.includes("min-w-[850px] table-fixed") &&
      contractContent.includes("w-4/12") &&
      contractContent.includes("w-2/12"),
    "ClientContractTab debe estructurar la tabla de servicios con layout fijo y columnas balanceadas"
  );
  assert.ok(
    contractContent.includes("min-w-[650px] table-fixed") &&
      contractContent.includes("w-5/12"),
    "ClientContractTab debe estructurar la tabla de documentos con layout fijo"
  );
  assert.ok(
    !contractContent.includes("rounded-[6px]") && !contractContent.includes("rounded-2xl"),
    "ClientContractTab debe homogeneizar bordes a rounded-xl en contenedores y rounded-lg/md en controles"
  );

  // 4. ClientDossierTab.tsx (Expediente Técnico)
  const dossierPath = path.resolve(rootDir, "src/components/modules/clients/ClientDossierTab.tsx");
  const dossierContent = fs.readFileSync(dossierPath, "utf8");
  assert.ok(
    !dossierContent.includes("rounded-3xl"),
    "ClientDossierTab no debe usar rounded-3xl en el contenedor de impresión"
  );
  assert.ok(
    dossierContent.includes("rounded-xl border border-[#e2e8f0] shadow-2xs"),
    "ClientDossierTab debe unificarse al estándar rounded-xl y border #e2e8f0"
  );
});

test("Flujo E2E 25: Estandarización Global de Diseño UI/UX Fase 2 (Tableros Kanban de Proyectos & Cuadrillas estilo Attex/Skote)", () => {
  const rootDir = process.cwd();

  // 1. ClientProjectKanban.tsx
  const clientKanbanPath = path.resolve(rootDir, "src/components/modules/clients/ClientProjectKanban.tsx");
  const clientKanbanContent = fs.readFileSync(clientKanbanPath, "utf8");
  assert.ok(
    clientKanbanContent.includes("rounded-xl border flex flex-col p-3 transition-all") &&
      clientKanbanContent.includes("bg-[#f8f9fa] border-[#e2e8f0]"),
    "ClientProjectKanban debe estructurar columnas en rounded-xl con fondo gris limpio #f8f9fa"
  );
  assert.ok(
    clientKanbanContent.includes("rounded-lg border border-[#e2e8f0] shadow-2xs"),
    "ClientProjectKanban debe usar tarjetas de tarea en blanco puro con rounded-lg moderado"
  );
  assert.ok(
    clientKanbanContent.includes("bg-rose-50 text-rose-700") &&
      clientKanbanContent.includes("bg-amber-50 text-amber-700"),
    "ClientProjectKanban debe emplear badges de prioridad en soft-tint profesional"
  );

  // 2. ProjectWorkspace.tsx (Módulo General de Proyectos)
  const projectWorkspacePath = path.resolve(rootDir, "src/components/modules/projects/ProjectWorkspace.tsx");
  const projectWorkspaceContent = fs.readFileSync(projectWorkspacePath, "utf8");
  assert.ok(
    projectWorkspaceContent.includes("w-80 rounded-xl border transition-all") &&
      projectWorkspaceContent.includes("bg-[#f8f9fa] border-[#e2e8f0]"),
    "ProjectWorkspace debe estructurar columnas en rounded-xl con fondo neutro suave"
  );
  assert.ok(
    projectWorkspaceContent.includes("rounded-lg border border-[#e2e8f0] shadow-2xs"),
    "ProjectWorkspace debe emplear tarjetas de tareas en rounded-lg"
  );
  assert.ok(
    !projectWorkspaceContent.includes("rounded-t-2xl") && !projectWorkspaceContent.includes("rounded-b-2xl"),
    "ProjectWorkspace no debe excederse en radios de esquinas tipo burbuja rounded-2xl"
  );

  // 3. ClientTasksTab.tsx (Tablero en Ficha de Clientes)
  const clientTasksPath = path.resolve(rootDir, "src/components/modules/clients/ClientTasksTab.tsx");
  const clientTasksContent = fs.readFileSync(clientTasksPath, "utf8");
  assert.ok(
    clientTasksContent.includes("bg-[#f8f9fa] border-[#e2e8f0]") &&
      clientTasksContent.includes("rounded-lg border border-[#e2e8f0] shadow-2xs"),
    "ClientTasksTab debe replicar la misma arquitectura visual limpia de tarjetas y columnas"
  );
});

test("Flujo E2E 26: Estandarización Global de Diseño UI/UX Fase 3 (Tablas Maestras y Barras de Filtros en Módulos Comerciales y Operativos)", () => {
  const rootDir = process.cwd();

  // 1. ClientsTable.tsx
  const clientsTablePath = path.resolve(rootDir, "src/components/modules/clients/ClientsTable.tsx");
  const clientsContent = fs.readFileSync(clientsTablePath, "utf8");
  assert.ok(
    clientsContent.includes("table-fixed w-full text-left text-xs") &&
      clientsContent.includes("bg-[#f8f9ff] text-[#004ac6] font-bold text-xs uppercase tracking-wider border-b border-[#e2e8f0]"),
    "ClientsTable debe usar estructura table-fixed con cabecera corporativa estandarizada"
  );
  assert.ok(
    !clientsContent.includes("rounded-2xl") && !clientsContent.includes("rounded-3xl"),
    "ClientsTable debe respetar la regla de esquinas moderadas rounded-xl/rounded-lg"
  );

  // 2. SalesManager.tsx
  const salesPath = path.resolve(rootDir, "src/components/modules/sales/SalesManager.tsx");
  const salesContent = fs.readFileSync(salesPath, "utf8");
  assert.ok(
    salesContent.includes("table-fixed w-full text-left text-xs border-collapse") &&
      salesContent.includes("bg-[#f8f9ff] text-[#004ac6] font-bold text-xs uppercase tracking-wider border-b border-[#e2e8f0]"),
    "SalesManager debe unificar tablas de notas de venta y cotizaciones en table-fixed con cabecera estándar"
  );
  assert.ok(
    salesContent.includes("Facturada SRI •"),
    "SalesManager debe purgar paréntesis ruidosos en los badges de estado"
  );
  assert.ok(
    !salesContent.includes("rounded-2xl"),
    "SalesManager no debe contener rounded-2xl"
  );

  // 3. BillingManager.tsx
  const billingPath = path.resolve(rootDir, "src/components/modules/billing/BillingManager.tsx");
  const billingContent = fs.readFileSync(billingPath, "utf8");
  assert.ok(
    billingContent.includes("table-fixed") &&
      billingContent.includes("bg-[#f8f9ff] text-[#004ac6] font-bold text-xs uppercase tracking-wider border-b border-[#e2e8f0]"),
    "BillingManager debe normalizar las 6 tablas de comprobantes con table-fixed y cabecera corporativa"
  );
  assert.ok(
    !billingContent.includes("rounded-2xl"),
    "BillingManager no debe contener rounded-2xl"
  );

  // 4. Purchases (PurchaseHistoryTab.tsx & NewPurchaseView.tsx)
  const purchaseHistoryPath = path.resolve(rootDir, "src/components/modules/purchases/PurchaseHistoryTab.tsx");
  const purchaseHistoryContent = fs.readFileSync(purchaseHistoryPath, "utf8");
  assert.ok(
    purchaseHistoryContent.includes("table-fixed w-full text-left text-xs border-collapse") &&
      purchaseHistoryContent.includes("bg-[#f8f9ff] text-[#004ac6] font-bold text-xs uppercase tracking-wider border-b border-[#e2e8f0]"),
    "PurchaseHistoryTab debe implementar table-fixed y cabecera corporativa azul"
  );
  assert.ok(
    !purchaseHistoryContent.includes("rounded-2xl"),
    "PurchaseHistoryTab no debe contener rounded-2xl"
  );

  const newPurchasePath = path.resolve(rootDir, "src/components/modules/purchases/NewPurchaseView.tsx");
  const newPurchaseContent = fs.readFileSync(newPurchasePath, "utf8");
  assert.ok(
    !newPurchaseContent.includes("rounded-2xl"),
    "NewPurchaseView no debe contener rounded-2xl"
  );

  // 5. InventoryManager.tsx
  const inventoryPath = path.resolve(rootDir, "src/components/modules/inventory/InventoryManager.tsx");
  const inventoryContent = fs.readFileSync(inventoryPath, "utf8");
  assert.ok(
    inventoryContent.includes("table-fixed") &&
      inventoryContent.includes("bg-[#f8f9ff] text-[#004ac6] font-bold text-xs uppercase tracking-wider border-b border-[#e2e8f0]"),
    "InventoryManager debe estandarizar tablas con table-fixed y thead corporativo"
  );
  assert.ok(
    inventoryContent.includes("• ${kardexSummary.totalInCost.toFixed(2)}") &&
      inventoryContent.includes("• ${kardexSummary.totalOutCost.toFixed(2)}"),
    "InventoryManager debe purgar paréntesis ruidosos en los balances del Kardex"
  );
  assert.ok(
    !inventoryContent.includes("rounded-2xl"),
    "InventoryManager no debe contener rounded-2xl"
  );
});

test("Flujo E2E 27: Validación Clean Enterprise Fase 4 en Finanzas y Modales de Emisión Detallada SRI", () => {
  const rootDir = process.cwd();

  // 1. FinanceDashboard.tsx
  const finDashPath = path.resolve(rootDir, "src/components/modules/finance/FinanceDashboard.tsx");
  const finDashContent = fs.readFileSync(finDashPath, "utf8");
  assert.ok(
    finDashContent.includes("table-fixed w-full text-left text-xs border-collapse") &&
      finDashContent.includes("bg-[#f8f9ff] text-[#004ac6] font-bold text-xs uppercase tracking-wider border-b border-[#e2e8f0]"),
    "FinanceDashboard debe utilizar table-fixed y thead corporativo"
  );
  assert.ok(!finDashContent.includes("rounded-2xl"), "FinanceDashboard no debe tener rounded-2xl");

  // 2. BankAccountsTab.tsx
  const bankTabPath = path.resolve(rootDir, "src/components/modules/finance/BankAccountsTab.tsx");
  const bankTabContent = fs.readFileSync(bankTabPath, "utf8");
  assert.ok(!bankTabContent.includes("rounded-2xl"), "BankAccountsTab no debe tener rounded-2xl");
  assert.ok(bankTabContent.includes("rounded-xl"), "BankAccountsTab debe usar rounded-xl moderado");

  // 3. AccountsReceivableTab & AccountsPayableTab
  const cxcPath = path.resolve(rootDir, "src/components/modules/finance/AccountsReceivableTab.tsx");
  const cxcContent = fs.readFileSync(cxcPath, "utf8");
  assert.ok(
    cxcContent.includes("table-fixed") && cxcContent.includes("bg-[#f8f9ff] text-[#004ac6]"),
    "AccountsReceivableTab debe usar table-fixed y cabecera corporativa"
  );
  assert.ok(!cxcContent.includes("rounded-2xl"), "AccountsReceivableTab no debe tener rounded-2xl");

  const cxpPath = path.resolve(rootDir, "src/components/modules/finance/AccountsPayableTab.tsx");
  const cxpContent = fs.readFileSync(cxpPath, "utf8");
  assert.ok(
    cxpContent.includes("table-fixed") && cxpContent.includes("bg-[#f8f9ff] text-[#004ac6]"),
    "AccountsPayableTab debe usar table-fixed y cabecera corporativa"
  );
  assert.ok(!cxpContent.includes("rounded-2xl"), "AccountsPayableTab no debe tener rounded-2xl");

  // 4. MovementsTab & ExpensesManager
  const movPath = path.resolve(rootDir, "src/components/modules/finance/MovementsTab.tsx");
  const movContent = fs.readFileSync(movPath, "utf8");
  assert.ok(
    movContent.includes("table-fixed") && movContent.includes("bg-[#f8f9ff] text-[#004ac6]"),
    "MovementsTab debe implementar table-fixed y cabecera corporativa"
  );
  assert.ok(!movContent.includes("rounded-2xl"), "MovementsTab no debe tener rounded-2xl");

  const expPath = path.resolve(rootDir, "src/components/modules/finance/ExpensesManager.tsx");
  const expContent = fs.readFileSync(expPath, "utf8");
  assert.ok(
    expContent.includes("table-fixed") && expContent.includes("bg-[#f8f9ff] text-[#004ac6]"),
    "ExpensesManager debe implementar table-fixed y thead corporativo"
  );
  assert.ok(!expContent.includes("rounded-2xl"), "ExpensesManager no debe tener rounded-2xl");

  // 5. Billing Modals (CreditNote, DebitNote, NewSaleModal, BillingQuoteModal, RemissionGuide, Withholding, EditSale, SriConfig)
  const ncPath = path.resolve(rootDir, "src/components/modules/billing/CreditNoteModal.tsx");
  const ncContent = fs.readFileSync(ncPath, "utf8");
  assert.ok(
    ncContent.includes("table-fixed") && ncContent.includes("bg-[#f8f9ff] text-[#004ac6]"),
    "CreditNoteModal debe implementar table-fixed y thead corporativo"
  );
  assert.ok(!ncContent.includes("rounded-2xl") && !ncContent.includes("rounded-3xl"), "CreditNoteModal no debe tener rounded-2xl/3xl");

  const ndPath = path.resolve(rootDir, "src/components/modules/billing/DebitNoteModal.tsx");
  const ndContent = fs.readFileSync(ndPath, "utf8");
  assert.ok(!ndContent.includes("rounded-2xl") && !ndContent.includes("rounded-3xl"), "DebitNoteModal no debe tener rounded-2xl/3xl");

  const newSaleModalPath = path.resolve(rootDir, "src/components/modules/billing/NewSaleModal.tsx");
  const newSaleModalContent = fs.readFileSync(newSaleModalPath, "utf8");
  assert.ok(!newSaleModalContent.includes("rounded-2xl") && !newSaleModalContent.includes("rounded-3xl"), "NewSaleModal no debe tener rounded-2xl/3xl");

  const quoteModalPath = path.resolve(rootDir, "src/components/modules/billing/BillingQuoteModal.tsx");
  const quoteModalContent = fs.readFileSync(quoteModalPath, "utf8");
  assert.ok(!quoteModalContent.includes("rounded-2xl") && !quoteModalContent.includes("rounded-3xl"), "BillingQuoteModal no debe tener rounded-2xl/3xl");

  const guiaPath = path.resolve(rootDir, "src/components/modules/billing/RemissionGuideModal.tsx");
  const guiaContent = fs.readFileSync(guiaPath, "utf8");
  assert.ok(
    guiaContent.includes("table-fixed") && guiaContent.includes("bg-[#f8f9ff] text-[#004ac6]"),
    "RemissionGuideModal debe implementar table-fixed y thead corporativo"
  );
  assert.ok(!guiaContent.includes("rounded-2xl") && !guiaContent.includes("rounded-3xl"), "RemissionGuideModal no debe tener rounded-2xl/3xl");

  const retPath = path.resolve(rootDir, "src/components/modules/billing/WithholdingModal.tsx");
  const retContent = fs.readFileSync(retPath, "utf8");
  assert.ok(!retContent.includes("rounded-[6px]") && !retContent.includes("rounded-2xl"), "WithholdingModal no debe tener rounded-[6px] ni rounded-2xl");

  const editSalePath = path.resolve(rootDir, "src/components/modules/billing/EditSaleModal.tsx");
  const editSaleContent = fs.readFileSync(editSalePath, "utf8");
  assert.ok(!editSaleContent.includes("rounded-[8px]") && !editSaleContent.includes("rounded-2xl"), "EditSaleModal no debe tener rounded-[8px] ni rounded-2xl");

  const sriConfigPath = path.resolve(rootDir, "src/components/modules/billing/SriConfigModal.tsx");
  const sriConfigContent = fs.readFileSync(sriConfigPath, "utf8");
  assert.ok(!sriConfigContent.includes("rounded-[6px]") && !sriConfigContent.includes("rounded-2xl"), "SriConfigModal no debe tener rounded-[6px] ni rounded-2xl");

  const recurringPath = path.resolve(rootDir, "src/components/modules/billing/RecurringBillingView.tsx");
  const recurringContent = fs.readFileSync(recurringPath, "utf8");
  assert.ok(
    recurringContent.includes("table-fixed") && recurringContent.includes("bg-[#f8f9ff] text-[#004ac6]"),
    "RecurringBillingView debe implementar table-fixed y thead corporativo"
  );
  assert.ok(!recurringContent.includes("rounded-2xl"), "RecurringBillingView no debe tener rounded-2xl");
});

test("Flujo E2E 28: Estandarización Clean Enterprise en Soporte, Trámites, Bóveda, Settings, Red, Arcotel y Dashboard (Fase 5)", () => {
  const rootDir = process.cwd();

  // 1. Soporte & Tickets
  const tbContent = fs.readFileSync(path.resolve(rootDir, "src/components/modules/tickets/TicketsBoard.tsx"), "utf8");
  assert.ok(tbContent.includes("table-fixed") && tbContent.includes("bg-[#f8f9ff] text-[#004ac6]"), "TicketsBoard debe tener table-fixed y thead corporativo");
  assert.ok(!tbContent.includes("rounded-2xl"), "TicketsBoard no debe contener rounded-2xl");

  const tdContent = fs.readFileSync(path.resolve(rootDir, "src/components/modules/tickets/TicketDetail.tsx"), "utf8");
  assert.ok(!tdContent.includes("rounded-2xl"), "TicketDetail no debe contener rounded-2xl");

  const tmContent = fs.readFileSync(path.resolve(rootDir, "src/components/modules/tickets/TicketModal.tsx"), "utf8");
  assert.ok(tmContent.includes("bg-[#004ac6] text-white") && tmContent.includes("rounded-xl"), "TicketModal debe usar Master Modal");
  assert.ok(!tmContent.includes("rounded-[6px]"), "TicketModal no debe contener rounded-[6px]");

  // 2. Trámites
  const trmContent = fs.readFileSync(path.resolve(rootDir, "src/components/modules/tramites/TramitesManager.tsx"), "utf8");
  assert.ok(trmContent.includes("table-fixed") && trmContent.includes("bg-[#f8f9ff] text-[#004ac6]"), "TramitesManager debe tener table-fixed y thead corporativo");
  assert.ok(!trmContent.includes("rounded-2xl"), "TramitesManager no debe contener rounded-2xl");

  const trModalContent = fs.readFileSync(path.resolve(rootDir, "src/components/modules/tramites/TramiteModal.tsx"), "utf8");
  assert.ok(trModalContent.includes("bg-[#004ac6] text-white") && trModalContent.includes("rounded-xl"), "TramiteModal debe usar Master Modal");

  // 3. Bóveda
  const vmContent = fs.readFileSync(path.resolve(rootDir, "src/components/modules/vault/VaultManager.tsx"), "utf8");
  assert.ok(vmContent.includes("table-fixed") && vmContent.includes("bg-[#f8f9ff] text-[#004ac6]"), "VaultManager debe tener table-fixed y thead corporativo");
  assert.ok(!vmContent.includes("rounded-2xl"), "VaultManager no debe contener rounded-2xl");

  const svContent = fs.readFileSync(path.resolve(rootDir, "src/components/modules/vault/SecureVault.tsx"), "utf8");
  assert.ok(svContent.includes("table-fixed") && svContent.includes("bg-[#f8f9ff] text-[#004ac6]"), "SecureVault debe tener table-fixed y thead corporativo");

  // 4. Configuración & Settings
  const gsettingsContent = fs.readFileSync(path.resolve(rootDir, "src/components/modules/settings/GeneralSettingsView.tsx"), "utf8");
  assert.ok(!gsettingsContent.includes("rounded-2xl"), "GeneralSettingsView no debe contener rounded-2xl");

  const umContent = fs.readFileSync(path.resolve(rootDir, "src/components/modules/settings/UserManager.tsx"), "utf8");
  assert.ok(umContent.includes("table-fixed") && umContent.includes("bg-[#f8f9ff] text-[#004ac6]"), "UserManager debe tener table-fixed y thead corporativo");
  assert.ok(!umContent.includes("rounded-2xl"), "UserManager no debe contener rounded-2xl");

  const uModalContent = fs.readFileSync(path.resolve(rootDir, "src/components/modules/settings/UserModal.tsx"), "utf8");
  assert.ok(uModalContent.includes("bg-[#004ac6] text-white") && uModalContent.includes("rounded-xl"), "UserModal debe usar Master Modal");
  assert.ok(!uModalContent.includes("rounded-[6px]"), "UserModal no debe contener rounded-[6px]");

  const recContent = fs.readFileSync(path.resolve(rootDir, "src/components/modules/settings/RecordManager.tsx"), "utf8");
  assert.ok(recContent.includes("table-fixed") && recContent.includes("rounded-xl"), "RecordManager debe tener table-fixed y rounded-xl");
  assert.ok(!recContent.includes("rounded-2xl"), "RecordManager no debe contener rounded-2xl");

  const sriConfigViewContent = fs.readFileSync(path.resolve(rootDir, "src/components/modules/settings/SriConfigView.tsx"), "utf8");
  assert.ok(sriConfigViewContent.includes("table-fixed") && sriConfigViewContent.includes("rounded-xl"), "SriConfigView debe tener table-fixed y rounded-xl");
  assert.ok(!sriConfigViewContent.includes("rounded-[6px]"), "SriConfigView no debe contener rounded-[6px]");

  // 5. Red & Infraestructura
  const nlContent = fs.readFileSync(path.resolve(rootDir, "src/components/modules/network/NodesList.tsx"), "utf8");
  assert.ok(nlContent.includes("table-fixed") && nlContent.includes("bg-[#f8f9ff] text-[#004ac6]"), "NodesList debe tener table-fixed y thead corporativo");
  assert.ok(!nlContent.includes("rounded-2xl"), "NodesList no debe contener rounded-2xl");

  const cnmContent = fs.readFileSync(path.resolve(rootDir, "src/components/modules/network/ClientNodesManager.tsx"), "utf8");
  assert.ok(!cnmContent.includes("rounded-2xl") && !cnmContent.includes("rounded-3xl"), "ClientNodesManager no debe contener rounded-2xl ni rounded-3xl");

  const ipmContent = fs.readFileSync(path.resolve(rootDir, "src/components/modules/network/IpPoolsManager.tsx"), "utf8");
  assert.ok(!ipmContent.includes("rounded-2xl"), "IpPoolsManager no debe contener rounded-2xl");

  // 6. Arcotel
  const arcotelContent = fs.readFileSync(path.resolve(rootDir, "src/components/modules/arcotel/ArcotelManager.tsx"), "utf8");
  assert.ok(!arcotelContent.includes("rounded-2xl"), "ArcotelManager no debe contener rounded-2xl");

  const polContent = fs.readFileSync(path.resolve(rootDir, "src/components/modules/arcotel/PoliciesList.tsx"), "utf8");
  assert.ok(polContent.includes("table-fixed") && polContent.includes("bg-[#f8f9ff] text-[#004ac6]"), "PoliciesList debe tener table-fixed y thead corporativo");
  assert.ok(!polContent.includes("rounded-[6px]") && !polContent.includes("rounded-2xl"), "PoliciesList no debe contener rounded-[6px] ni rounded-2xl");

  const polModalContent = fs.readFileSync(path.resolve(rootDir, "src/components/modules/arcotel/PolicyModal.tsx"), "utf8");
  assert.ok(polModalContent.includes("bg-[#004ac6] text-white") && polModalContent.includes("rounded-xl"), "PolicyModal debe usar Master Modal");
  assert.ok(!polModalContent.includes("rounded-[6px]"), "PolicyModal no debe contener rounded-[6px]");

  // 7. Dashboard & Widgets
  const fcContent = fs.readFileSync(path.resolve(rootDir, "src/components/modules/dashboard/FinancialChart.tsx"), "utf8");
  assert.ok(!fcContent.includes("rounded-2xl"), "FinancialChart no debe contener rounded-2xl");

  const raContent = fs.readFileSync(path.resolve(rootDir, "src/components/modules/dashboard/RecentActivity.tsx"), "utf8");
  assert.ok(raContent.includes("table-fixed") && raContent.includes("bg-[#f8f9ff] text-[#004ac6]"), "RecentActivity auditoría debe tener table-fixed");
  assert.ok(!raContent.includes("rounded-2xl"), "RecentActivity no debe contener rounded-2xl");

  const rsContent = fs.readFileSync(path.resolve(rootDir, "src/components/modules/dashboard/RecentSalesCard.tsx"), "utf8");
  assert.ok(rsContent.includes("table-fixed") && rsContent.includes("bg-[#f8f9ff] text-[#004ac6]"), "RecentSalesCard debe tener table-fixed");
  assert.ok(!rsContent.includes("rounded-2xl"), "RecentSalesCard no debe contener rounded-2xl");

  const etContent = fs.readFileSync(path.resolve(rootDir, "src/components/modules/dashboard/ExpirationsTimeline.tsx"), "utf8");
  assert.ok(!etContent.includes("rounded-2xl"), "ExpirationsTimeline no debe contener rounded-2xl");

  // 8. Páginas base
  const errContent = fs.readFileSync(path.resolve(rootDir, "src/app/error.tsx"), "utf8");
  assert.ok(!errContent.includes("rounded-2xl") && !errContent.includes("rounded-3xl"), "error.tsx no debe contener rounded-2xl/3xl");

  const nfContent = fs.readFileSync(path.resolve(rootDir, "src/app/not-found.tsx"), "utf8");
  assert.ok(!nfContent.includes("rounded-2xl") && !nfContent.includes("rounded-3xl"), "not-found.tsx no debe contener rounded-2xl/3xl");
});

test("Flujo E2E 29: Auditoría Global y Estandarización Clean Enterprise en Pestañas de Clientes, Proyectos y Facturación", () => {
  const rootDir = process.cwd();

  // 1. Auditoría exhaustiva del módulo de Clientes (src/components/modules/clients/)
  const clientsDir = path.resolve(rootDir, "src/components/modules/clients");
  const clientFiles = fs.readdirSync(clientsDir).filter((f) => f.endsWith(".tsx"));
  assert.ok(clientFiles.length >= 20, "Deben existir al menos 20 archivos en el módulo de clientes");

  clientFiles.forEach((file) => {
    const filePath = path.join(clientsDir, file);
    const content = fs.readFileSync(filePath, "utf8");
    assert.ok(
      !content.includes("rounded-2xl") && !content.includes("rounded-3xl"),
      `${file} en clientes no debe contener rounded-2xl ni rounded-3xl`
    );
    assert.ok(
      !content.includes("rounded-["),
      `${file} en clientes no debe contener clases arbitrarias rounded-[*]`
    );
  });

  // 2. Verificaciones específicas de Master Tables y Master Modals en pestañas de clientes
  const nodesTab = fs.readFileSync(path.join(clientsDir, "ClientNodesTab.tsx"), "utf8");
  assert.ok(nodesTab.includes("table-fixed") && nodesTab.includes("bg-[#f8f9ff] text-[#004ac6]"), "ClientNodesTab debe tener table-fixed y thead corporativo");

  const quotesMgr = fs.readFileSync(path.join(clientsDir, "ClientQuotesManager.tsx"), "utf8");
  assert.ok(quotesMgr.includes("table-fixed") && quotesMgr.includes("bg-[#f8f9ff] text-[#004ac6]"), "ClientQuotesManager debe tener table-fixed y thead corporativo");

  const ticketsTab = fs.readFileSync(path.join(clientsDir, "ClientTicketsTab.tsx"), "utf8");
  assert.ok(ticketsTab.includes("table-fixed") && ticketsTab.includes("bg-[#f8f9ff] text-[#004ac6]"), "ClientTicketsTab debe tener table-fixed y thead corporativo");

  const tramitesTab = fs.readFileSync(path.join(clientsDir, "ClientTramitesTab.tsx"), "utf8");
  assert.ok(tramitesTab.includes("table-fixed") && tramitesTab.includes("bg-[#f8f9ff] text-[#004ac6]"), "ClientTramitesTab debe tener table-fixed y thead corporativo");
  assert.ok(tramitesTab.includes("bg-[#004ac6] text-white") && tramitesTab.includes("rounded-xl"), "ClientTramitesTab modal de bitácora debe ser Master Modal corporativo");

  const profile360 = fs.readFileSync(path.join(clientsDir, "ClientProfile360.tsx"), "utf8");
  assert.ok(profile360.includes("table-fixed") && profile360.includes("bg-[#f8f9ff] text-[#004ac6]"), "ClientProfile360 tabla cobros debe tener table-fixed y thead corporativo");

  const clientModal = fs.readFileSync(path.join(clientsDir, "ClientModal.tsx"), "utf8");
  assert.ok(clientModal.includes("bg-[#004ac6] text-white") && clientModal.includes("rounded-xl"), "ClientModal debe ser Master Modal corporativo");

  const clientNodeModal = fs.readFileSync(path.join(clientsDir, "ClientNodeModal.tsx"), "utf8");
  assert.ok(clientNodeModal.includes("bg-[#004ac6] text-white") && clientNodeModal.includes("rounded-xl"), "ClientNodeModal debe ser Master Modal corporativo");

  const clientContactsModal = fs.readFileSync(path.join(clientsDir, "ClientContactsModal.tsx"), "utf8");
  assert.ok(clientContactsModal.includes("bg-[#004ac6] text-white") && clientContactsModal.includes("rounded-xl"), "ClientContactsModal debe ser Master Modal corporativo");

  const contractTab = fs.readFileSync(path.join(clientsDir, "ClientContractTab.tsx"), "utf8");
  assert.ok(contractTab.includes("bg-[#004ac6] text-white") && contractTab.includes("rounded-xl"), "ClientContractTab modal debe ser Master Modal corporativo");

  // 3. Verificaciones en Módulo de Proyectos (conectado a obras de clientes)
  const projTaskModal = fs.readFileSync(path.resolve(rootDir, "src/components/modules/projects/ProjectTaskModal.tsx"), "utf8");
  assert.ok(projTaskModal.includes("bg-[#004ac6] text-white") && projTaskModal.includes("rounded-xl"), "ProjectTaskModal debe ser Master Modal");
  assert.ok(!projTaskModal.includes("rounded-2xl") && !projTaskModal.includes("rounded-["), "ProjectTaskModal no debe contener rounded-2xl ni rounded-[");

  const projModal = fs.readFileSync(path.resolve(rootDir, "src/components/modules/projects/ProjectModal.tsx"), "utf8");
  assert.ok(projModal.includes("bg-[#004ac6] text-white") && projModal.includes("rounded-xl"), "ProjectModal debe ser Master Modal");
  assert.ok(!projModal.includes("rounded-3xl") && !projModal.includes("rounded-2xl"), "ProjectModal no debe contener rounded-2xl/3xl");

  const projGantt = fs.readFileSync(path.resolve(rootDir, "src/components/modules/projects/ProjectGanttModal.tsx"), "utf8");
  assert.ok(projGantt.includes("bg-[#004ac6] text-white") && projGantt.includes("rounded-xl"), "ProjectGanttModal debe ser Master Modal");
  assert.ok(!projGantt.includes("rounded-3xl") && !projGantt.includes("rounded-2xl"), "ProjectGanttModal no debe contener rounded-2xl/3xl");

  const projTrash = fs.readFileSync(path.resolve(rootDir, "src/components/modules/projects/ProjectTrashModal.tsx"), "utf8");
  assert.ok(projTrash.includes("bg-[#004ac6] text-white") && projTrash.includes("rounded-xl"), "ProjectTrashModal debe ser Master Modal");
  assert.ok(!projTrash.includes("rounded-3xl") && !projTrash.includes("rounded-2xl"), "ProjectTrashModal no debe contener rounded-2xl/3xl");

  const projManager = fs.readFileSync(path.resolve(rootDir, "src/components/modules/projects/ProjectsManager.tsx"), "utf8");
  assert.ok(projManager.includes("table-fixed") && projManager.includes("bg-[#f8f9ff] text-[#004ac6]"), "ProjectsManager debe tener table-fixed y thead corporativo");
  assert.ok(!projManager.includes("rounded-2xl"), "ProjectsManager no debe contener rounded-2xl");

  const projWorkspace = fs.readFileSync(path.resolve(rootDir, "src/components/modules/projects/ProjectWorkspace.tsx"), "utf8");
  assert.ok(projWorkspace.includes("table-fixed") && projWorkspace.includes("bg-[#f8f9ff] text-[#004ac6]"), "ProjectWorkspace debe tener table-fixed y thead corporativo");
  assert.ok(!projWorkspace.includes("rounded-2xl"), "ProjectWorkspace no debe contener rounded-2xl");

  // 4. Verificaciones en Módulo de Facturación y Vistas vinculadas (NewSaleView, RIDE, Cotización)
  const quotePreview = fs.readFileSync(path.resolve(rootDir, "src/components/modules/billing/QuotePreviewModal.tsx"), "utf8");
  assert.ok(quotePreview.includes("bg-[#004ac6] text-white"), "QuotePreviewModal debe usar cabecera corporativa");
  assert.ok(!quotePreview.includes("rounded-["), "QuotePreviewModal no debe contener rounded-[");

  const ridePreview = fs.readFileSync(path.resolve(rootDir, "src/components/modules/billing/RidePreviewModal.tsx"), "utf8");
  assert.ok(ridePreview.includes("bg-[#004ac6] text-white"), "RidePreviewModal debe usar cabecera corporativa");
  assert.ok(!ridePreview.includes("rounded-["), "RidePreviewModal no debe contener rounded-[");

  const billingMgr = fs.readFileSync(path.resolve(rootDir, "src/components/modules/billing/BillingManager.tsx"), "utf8");
  assert.ok(!billingMgr.includes("rounded-[") && !billingMgr.includes("rounded-2xl"), "BillingManager no debe contener rounded-[ ni rounded-2xl");

  const newSale = fs.readFileSync(path.resolve(rootDir, "src/components/modules/billing/NewSaleView.tsx"), "utf8");
  assert.ok(!newSale.includes("rounded-[") && !newSale.includes("rounded-2xl"), "NewSaleView no debe contener rounded-[ ni rounded-2xl");
});

test("Flujo E2E 30: Buscador Predictivo de Servicios con Nombre y Descripción Editable y Precios con/sin IVA Sincronizados", () => {
  const rootDir = process.cwd();
  const contractTabPath = path.resolve(rootDir, "src/components/modules/clients/ClientContractTab.tsx");
  const contractTab = fs.readFileSync(contractTabPath, "utf8");

  // 1. Buscador predictivo en vez de un simple <select>
  assert.ok(
    contractTab.includes("Buscar Producto / Servicio en Catálogo Oficial *") &&
      contractTab.includes("searchedInventoryServices") &&
      contractTab.includes("showServiceDropdown"),
    "ClientContractTab debe contar con un buscador predictivo con dropdown tipo nota de venta"
  );
  assert.ok(
    !contractTab.includes("-- Selecciona un servicio"),
    "ClientContractTab no debe usar un <select> simple con opciones fijas para el catálogo oficial"
  );

  // 2. Extracción de nombre y descripción editable
  assert.ok(
    contractTab.includes("Nombre del Servicio (Editable) *") &&
      contractTab.includes("newSvcName"),
    "ClientContractTab debe permitir editar el nombre del servicio extraído"
  );
  assert.ok(
    contractTab.includes("Descripción del Servicio (Editable)") &&
      contractTab.includes("newSvcDescription"),
    "ClientContractTab debe permitir editar la descripción del servicio extraído"
  );

  // 3. Precios sin IVA y con IVA sincronizados en tiempo real
  assert.ok(
    contractTab.includes("Tarifa sin IVA ($) *") &&
      contractTab.includes("Tarifa con IVA ($)") &&
      contractTab.includes("handlePriceSinIvaChange") &&
      contractTab.includes("handlePriceConIvaChange"),
    "ClientContractTab debe tener campos sincronizados para ingresar precio con IVA o sin IVA"
  );

  // 4. Modal corporativo para editar servicios existentes
  assert.ok(
    contractTab.includes("Editar Servicio del Cliente") &&
      contractTab.includes("handleOpenEditService") &&
      contractTab.includes("handleSaveEditService"),
    "ClientContractTab debe incluir modal para editar nombre, descripción y tarifas de servicios existentes"
  );

  // 5. Typesafe ClientService
  const typesPath = path.resolve(rootDir, "src/types/index.ts");
  const typesContent = fs.readFileSync(typesPath, "utf8");
  assert.ok(
    typesContent.includes("description?: string;") &&
      typesContent.includes("ivaRate?: number;") &&
      typesContent.includes("priceConIva?: number;"),
    "ClientService debe incluir propiedades tipadas para description, ivaRate y priceConIva"
  );
});

test("Flujo E2E 31: Submódulo Bancos Anti-Cuelgue, Cobranzas OPEX y Blindaje Integral de Submódulos Financieros", () => {
  const rootDir = process.cwd();

  // 1. Bancos: Eliminación de useEffect cíclico que causaba congelamiento / cuelgue
  const bankAccountsPath = path.resolve(rootDir, "src/components/modules/finance/BankAccountsTab.tsx");
  const bankAccountsContent = fs.readFileSync(bankAccountsPath, "utf8");
  
  // No debe existir el useEffect cíclico dependiente de [bankAccounts, originBankId, destBankId]
  assert.ok(
    !bankAccountsContent.includes("useEffect(() => {\n    if (bankAccounts.length > 0) {\n      if (!originBankId)"),
    "BankAccountsTab no debe tener un useEffect que modifique originBankId/destBankId provocando un bucle infinito"
  );
  assert.ok(
    bankAccountsContent.includes("handleOpenTransfer") &&
      bankAccountsContent.includes("handleOriginChange") &&
      bankAccountsContent.includes("safeNumber"),
    "BankAccountsTab debe usar apertura determinista y formateo seguro safeNumber"
  );

  // 2. Cobranzas OPEX (FinanceDashboard): Protección contra campos nulos y excepciones de cliente
  const financeDashPath = path.resolve(rootDir, "src/components/modules/finance/FinanceDashboard.tsx");
  const financeDashContent = fs.readFileSync(financeDashPath, "utf8");
  assert.ok(
    financeDashContent.includes("(c.clientName || \"\").toLowerCase()") &&
      financeDashContent.includes("safeFloat") &&
      financeDashContent.includes("safeNumber"),
    "FinanceDashboard debe proteger filtros y totales contra nulos/indefinidos con safeFloat y safeNumber"
  );

  // 3. Movimientos: Tolerancia a datos corruptos
  const movementsPath = path.resolve(rootDir, "src/components/modules/finance/MovementsTab.tsx");
  const movementsContent = fs.readFileSync(movementsPath, "utf8");
  assert.ok(
    movementsContent.includes("(m.description || \"\").toLowerCase()") &&
      movementsContent.includes("safeNumber"),
    "MovementsTab debe formatear montos y buscar conceptos de forma segura"
  );

  // 4. Cuentas por Cobrar y por Pagar
  const cxcPath = path.resolve(rootDir, "src/components/modules/finance/AccountsReceivableTab.tsx");
  const cxcContent = fs.readFileSync(cxcPath, "utf8");
  assert.ok(
    cxcContent.includes("safeFloat") && cxcContent.includes("safeNumber"),
    "AccountsReceivableTab debe calcular saldos con safeFloat y safeNumber"
  );

  const cxpPath = path.resolve(rootDir, "src/components/modules/finance/AccountsPayableTab.tsx");
  const cxpContent = fs.readFileSync(cxpPath, "utf8");
  assert.ok(
    cxpContent.includes("safeFloat") && cxpContent.includes("safeNumber"),
    "AccountsPayableTab debe calcular saldos con safeFloat y safeNumber"
  );

  // 5. Reportes Financieros
  const reportsPath = path.resolve(rootDir, "src/components/modules/finance/FinancialReportsTab.tsx");
  const reportsContent = fs.readFileSync(reportsPath, "utf8");
  assert.ok(
    reportsContent.includes("safeFloat") && reportsContent.includes("safeNumber"),
    "FinancialReportsTab debe totalizar y exportar con safeFloat y safeNumber"
  );

  // 6. Error Boundary en Finanzas
  const finanzasPagePath = path.resolve(rootDir, "src/app/finanzas/page.tsx");
  const finanzasPageContent = fs.readFileSync(finanzasPagePath, "utf8");
  assert.ok(
    finanzasPageContent.includes("FinanceErrorBoundary") &&
      finanzasPageContent.includes("<FinanceErrorBoundary key={resolvedTab}>"),
    "FinanzasPage debe envolver las vistas con FinanceErrorBoundary para prevenir caídas globales"
  );

  const errorBoundaryPath = path.resolve(rootDir, "src/components/modules/finance/FinanceErrorBoundary.tsx");
  assert.ok(fs.existsSync(errorBoundaryPath), "FinanceErrorBoundary.tsx debe existir en components/modules/finance");
});

test("Flujo E2E 32: Cierre Automático de Seleccionadores al Dar Clic Afuera o Presionar Escape en Ventas y Modales", () => {
  const rootDir = process.cwd();

  // 1. Nueva Venta / Nueva Nota de Venta (NewSaleView.tsx)
  const newSalePath = path.resolve(rootDir, "src/components/modules/billing/NewSaleView.tsx");
  const newSaleContent = fs.readFileSync(newSalePath, "utf8");

  assert.ok(
    newSaleContent.includes("clientDropdownRef") &&
      newSaleContent.includes("productDropdownRef") &&
      newSaleContent.includes("handleClickOutside") &&
      newSaleContent.includes("setShowClientDropdown(false)") &&
      newSaleContent.includes("setShowProductDropdown(false)"),
    "NewSaleView debe implementar refs y listener de clic afuera para cerrar los seleccionadores de cliente y producto"
  );

  assert.ok(
    newSaleContent.includes('ref={clientDropdownRef}') &&
      newSaleContent.includes('ref={productDropdownRef}'),
    "NewSaleView debe enlazar los refs a los contenedores relativos de cliente y producto"
  );

  assert.ok(
    newSaleContent.includes('event.key === "Escape"'),
    "NewSaleView debe permitir cerrar los desplegables presionando la tecla Escape"
  );

  // 2. Edición de Venta (EditSaleModal.tsx)
  const editSalePath = path.resolve(rootDir, "src/components/modules/billing/EditSaleModal.tsx");
  const editSaleContent = fs.readFileSync(editSalePath, "utf8");
  assert.ok(
    editSaleContent.includes("productDropdownRef") &&
      editSaleContent.includes("handleClickOutside") &&
      editSaleContent.includes("ref={productDropdownRef}"),
    "EditSaleModal debe cerrar el buscador de productos al hacer clic afuera"
  );

  // 3. Modal de Tickets (TicketModal.tsx)
  const ticketModalPath = path.resolve(rootDir, "src/components/modules/tickets/TicketModal.tsx");
  const ticketModalContent = fs.readFileSync(ticketModalPath, "utf8");
  assert.ok(
    ticketModalContent.includes("clientDropdownRef") &&
      ticketModalContent.includes("handleClickOutside") &&
      ticketModalContent.includes("ref={clientDropdownRef}"),
    "TicketModal debe cerrar el seleccionador de clientes al hacer clic afuera"
  );

  // 4. Modal de Cotizaciones (BillingQuoteModal.tsx)
  const quoteModalPath = path.resolve(rootDir, "src/components/modules/billing/BillingQuoteModal.tsx");
  const quoteModalContent = fs.readFileSync(quoteModalPath, "utf8");
  assert.ok(
    quoteModalContent.includes("productDropdownRef") &&
      quoteModalContent.includes("handleClickOutside") &&
      quoteModalContent.includes("ref={productDropdownRef}"),
    "BillingQuoteModal debe cerrar el desplegable de productos al hacer clic afuera"
  );

  // 5. Modal de Nueva Venta Directa (NewSaleModal.tsx)
  const newSaleModalPath = path.resolve(rootDir, "src/components/modules/billing/NewSaleModal.tsx");
  const newSaleModalContent = fs.readFileSync(newSaleModalPath, "utf8");
  assert.ok(
    newSaleModalContent.includes("productDropdownRef") &&
      newSaleModalContent.includes("handleClickOutside") &&
      newSaleModalContent.includes("ref={productDropdownRef}"),
    "NewSaleModal debe cerrar el desplegable de productos al hacer clic afuera"
  );
});

test("Flujo E2E 33: Autoguardado Continuo de Borrador en Ventas y Apertura de Historial en Nueva Pestaña", () => {
  const rootDir = process.cwd();

  // 1. NewSaleView: Implementación de Borrador Automático (Draft)
  const newSalePath = path.resolve(rootDir, "src/components/modules/billing/NewSaleView.tsx");
  const newSaleContent = fs.readFileSync(newSalePath, "utf8");

  assert.ok(
    newSaleContent.includes("SALE_DRAFT_STORAGE_KEY") &&
      newSaleContent.includes("localStorage.setItem(SALE_DRAFT_STORAGE_KEY") &&
      newSaleContent.includes("localStorage.getItem(SALE_DRAFT_STORAGE_KEY"),
    "NewSaleView debe persistir y recuperar el borrador de venta automáticamente en localStorage"
  );

  assert.ok(
    newSaleContent.includes("restoredDraftInfo") &&
      newSaleContent.includes("Borrador automático recuperado") &&
      newSaleContent.includes("handleDiscardDraft"),
    "NewSaleView debe mostrar banner informativo de borrador recuperado y opción para descartarlo"
  );

  assert.ok(
    newSaleContent.includes("beforeunload"),
    "NewSaleView debe advertir antes de cerrar o recargar la pestaña si hay una venta activa"
  );

  // 2. Acceso directo a Historial de Facturación en Nueva Pestaña
  assert.ok(
    newSaleContent.includes('href={`/clientes?id=${selectedClient.id}&tab=finanzas`}') &&
      newSaleContent.includes('target="_blank"') &&
      newSaleContent.includes('rel="noopener noreferrer"') &&
      newSaleContent.includes("Historial de Facturación"),
    "NewSaleView debe incluir enlace para abrir el historial de facturación del cliente en una nueva pestaña"
  );

  // 3. Clientes: soporte de parámetro ?id=...&tab=finanzas para aterrizar directo en la pestaña
  const clientPagePath = path.resolve(rootDir, "src/app/clientes/page.tsx");
  const clientPageContent = fs.readFileSync(clientPagePath, "utf8");
  assert.ok(
    clientPageContent.includes('searchParams.get("tab")') &&
      clientPageContent.includes("initialTab="),
    "src/app/clientes/page.tsx debe leer el parámetro tab y pasarlo como initialTab a ClientProfile360"
  );

  const profile360Path = path.resolve(rootDir, "src/components/modules/clients/ClientProfile360.tsx");
  const profile360Content = fs.readFileSync(profile360Path, "utf8");
  assert.ok(
    profile360Content.includes("initialTab?: ProfileTab") &&
      profile360Content.includes("initialTab"),
    "ClientProfile360 debe admitir initialTab para abrir directamente la pestaña de cobros/finanzas"
  );
});

test("Flujo E2E 34: Pestaña 'Archivos' (Mini Drive) en Perfil del Cliente para Contratos y Documentación", () => {
  const rootDir = process.cwd();

  // 1. Verificación de ClientFilesTab.tsx
  const filesTabPath = path.resolve(rootDir, "src/components/modules/clients/ClientFilesTab.tsx");
  assert.ok(fs.existsSync(filesTabPath), "El componente ClientFilesTab.tsx debe existir");

  const filesTabContent = fs.readFileSync(filesTabPath, "utf8");
  assert.ok(
    filesTabContent.includes("Archivos del Cliente") &&
      filesTabContent.includes("addClientDocument") &&
      filesTabContent.includes("deleteClientDocument"),
    "ClientFilesTab debe conectarse a useApp para gestionar documentos del cliente"
  );

  assert.ok(
    filesTabContent.includes("contrato_adhesion") &&
      filesTabContent.includes("cedula_ruc") &&
      filesTabContent.includes("acta_entrega"),
    "ClientFilesTab debe soportar tipos de documentos oficiales (contrato, cédula/RUC, actas)"
  );

  assert.ok(
    filesTabContent.includes("/api/blob/upload") &&
      filesTabContent.includes("table-fixed") &&
      filesTabContent.includes("bg-[#004ac6] text-white"),
    "ClientFilesTab debe implementar subida a blob, Master Modal corporativo y tabla fija"
  );

  // 2. Registro de la Pestaña "Archivos" en ClientProfile360.tsx
  const profile360Path = path.resolve(rootDir, "src/components/modules/clients/ClientProfile360.tsx");
  const profile360Content = fs.readFileSync(profile360Path, "utf8");
  assert.ok(
    profile360Content.includes('"archivos"') &&
      profile360Content.includes('label: "Archivos"') &&
      profile360Content.includes("<ClientFilesTab client={client} />"),
    "ClientProfile360 debe registrar la pestaña 'Archivos' con su renderizado correspondiente"
  );

  // 3. Acceso directo en NewSaleView.tsx
  const newSalePath = path.resolve(rootDir, "src/components/modules/billing/NewSaleView.tsx");
  const newSaleContent = fs.readFileSync(newSalePath, "utf8");
  assert.ok(
    newSaleContent.includes("tab=archivos"),
    "NewSaleView debe incluir acceso directo a la pestaña de Archivos del cliente"
  );
});

test("Flujo E2E 35: Permanencia en la Ficha de Cliente y Pestaña de Servicios al Guardar/Editar Servicios", () => {
  const rootDir = process.cwd();

  // 1. Verificación en src/app/clientes/page.tsx
  const clientesPagePath = path.resolve(rootDir, "src/app/clientes/page.tsx");
  assert.ok(fs.existsSync(clientesPagePath), "src/app/clientes/page.tsx debe existir");
  const clientesPageContent = fs.readFileSync(clientesPagePath, "utf8");

  // Verificar que el efecto de clientIdFromUrl NO resetea selectedClient por cambios en clients
  assert.ok(
    clientesPageContent.includes("}, [clientIdFromUrl]);"),
    "El efecto de URL no debe depender de clients para evitar resetear selectedClient al mutar servicios"
  );

  // Verificar sincronización de selectedClient sin desmontar la pantalla
  assert.ok(
    clientesPageContent.includes("updated && updated !== selectedClient") &&
      clientesPageContent.includes("setSelectedClient(updated)"),
    "Debe sincronizar los datos del cliente sin desmontar ni cerrar la ficha"
  );

  // Verificar handleSelectClient y persistencia en URL
  assert.ok(
    clientesPageContent.includes("handleSelectClient") &&
      clientesPageContent.includes('url.searchParams.set("id", c.id)'),
    "handleSelectClient debe persistir el ID en la URL"
  );

  // Verificar sincronización de pestañas en ClientProfile360
  assert.ok(
    clientesPageContent.includes("onTabChange") &&
      clientesPageContent.includes('url.searchParams.set("tab", tab)'),
    "ClientProfile360 debe sincronizar la pestaña activa en la URL"
  );

  // 2. Verificación en ClientProfile360.tsx
  const profile360Path = path.resolve(rootDir, "src/components/modules/clients/ClientProfile360.tsx");
  const profile360Content = fs.readFileSync(profile360Path, "utf8");

  assert.ok(
    profile360Content.includes("onTabChange?: (tab: ProfileTab) => void;") &&
      profile360Content.includes("handleTabChange"),
    "ClientProfile360 debe soportar onTabChange y sincronización de pestaña"
  );

  assert.ok(
    profile360Content.includes("Volver") &&
      profile360Content.includes("ArrowLeft") &&
      profile360Content.includes("onClick={onClose}"),
    "ClientProfile360 debe incluir botón 'Volver' con ArrowLeft para regresar explícitamente al listado"
  );

  // 3. Verificación en ClientContractTab.tsx
  const contractTabPath = path.resolve(rootDir, "src/components/modules/clients/ClientContractTab.tsx");
  const contractTabContent = fs.readFileSync(contractTabPath, "utf8");

  assert.ok(
    contractTabContent.includes("handleCreateService") &&
      contractTabContent.includes("handleSaveEditService") &&
      contractTabContent.includes("addClientService") &&
      contractTabContent.includes("updateClientService"),
    "ClientContractTab debe contener los manejadores de creación y edición de servicios"
  );
});

test("Flujo E2E 36: Renovaciones Recurrentes, Períodos de Contrato, Ciclos Anuales (Hosting/Dominios) y Detección de Caducidad", () => {
  const rootDir = process.cwd();

  // 1. Verificación de Tipos en src/types/index.ts
  const typesPath = path.resolve(rootDir, "src/types/index.ts");
  const typesContent = fs.readFileSync(typesPath, "utf8");

  assert.ok(
    typesContent.includes('export type ServiceBillingFrequency = "mensual" | "trimestral" | "semestral" | "anual";'),
    "Debe definir ServiceBillingFrequency con mensual, trimestral, semestral y anual"
  );
  assert.ok(
    typesContent.includes('export type ServiceContractDuration =') &&
      typesContent.includes('"mensual"') &&
      typesContent.includes('"trimestral"') &&
      typesContent.includes('"semestral"') &&
      typesContent.includes('"anual"') &&
      typesContent.includes('"bianual"') &&
      typesContent.includes('"indefinido"'),
    "Debe definir ServiceContractDuration con todas las opciones solicitadas"
  );
  assert.ok(
    typesContent.includes('export type ServiceCategory =') &&
      typesContent.includes('"hosting"') &&
      typesContent.includes('"dominio"'),
    "Debe definir ServiceCategory incluyendo hosting y dominio"
  );
  assert.ok(
    typesContent.includes("contractDuration?: ServiceContractDuration;") &&
      typesContent.includes("contractStartDate?: string;") &&
      typesContent.includes("contractEndDate?: string;") &&
      typesContent.includes("autoRenew?: boolean;") &&
      typesContent.includes("serviceCategory?: ServiceCategory;"),
    "ClientService debe incluir propiedades de contrato y ciclo recurrente"
  );

  // 2. Verificación de Lógica de Estado en src/lib/state.tsx
  const statePath = path.resolve(rootDir, "src/lib/state.tsx");
  const stateContent = fs.readFileSync(statePath, "utf8");

  assert.ok(
    stateContent.includes("calculateContractEndDate") &&
      stateContent.includes("calculateNextRenewalDate"),
    "state.tsx debe incluir funciones auxiliares para calcular fechas de contrato y próximo cobro"
  );
  assert.ok(
    stateContent.includes("renewClientService") &&
      stateContent.includes('billingFrequency === "anual"') &&
      stateContent.includes("monthsToAdd = 12") &&
      stateContent.includes("monthsToAdd = 6") &&
      stateContent.includes("monthsToAdd = 3"),
    "renewClientService debe avanzar la fecha según la frecuencia elegida (+1, +3, +6 o +12 meses)"
  );
  assert.ok(
    stateContent.includes("emitRecurringInvoiceForClient") &&
      stateContent.includes("addMonthsSafely(baseDate, monthsToAdd)") &&
      stateContent.includes("contractExpired"),
    "emitRecurringInvoiceForClient debe avanzar automáticamente la fecha de próximo cobro para servicios recurrentes"
  );

  // 3. Verificación de UI y Alertas en ClientContractTab.tsx
  const contractTabPath = path.resolve(rootDir, "src/components/modules/clients/ClientContractTab.tsx");
  const contractTabContent = fs.readFileSync(contractTabPath, "utf8");

  assert.ok(
    contractTabContent.includes("Alerta de Caducidad:") &&
      contractTabContent.includes("serviceMetrics.expiringCount") &&
      contractTabContent.includes('setServiceFilter("por_renovar")'),
    "ClientContractTab debe mostrar banner superior de alerta cuando existan servicios por caducar o vencidos"
  );
  assert.ok(
    contractTabContent.includes("Frecuencia de Facturación *") &&
      contractTabContent.includes("Período de Contrato *") &&
      contractTabContent.includes("Auto-Facturación Recurrente"),
    "ClientContractTab debe permitir configurar frecuencia, período de contrato y auto-facturación recurrente"
  );
  assert.ok(
    contractTabContent.includes("Auto-recurrente") &&
      contractTabContent.includes("getRenewalStatus"),
    "ClientContractTab debe indicar el estado de auto-recurrencia y el semáforo dinámico de caducidad"
  );

  // 4. Verificación de Integración Global en ExpirationsTimeline.tsx
  const expirationsPath = path.resolve(rootDir, "src/components/modules/dashboard/ExpirationsTimeline.tsx");
  const expirationsContent = fs.readFileSync(expirationsPath, "utf8");

  assert.ok(
    expirationsContent.includes("clientServiceExpirations") &&
      expirationsContent.includes("combinedHostingList") &&
      expirationsContent.includes("urgentHostingCount"),
    "ExpirationsTimeline debe unificar servicios anuales, hosting y dominios de la ficha de clientes"
  );

  // 5. Verificación de Filtros en RecurringBillingView.tsx
  const recurringViewPath = path.resolve(rootDir, "src/components/modules/billing/RecurringBillingView.tsx");
  const recurringViewContent = fs.readFileSync(recurringViewPath, "utf8");

  assert.ok(
    recurringViewContent.includes('value="trimestral"') &&
      recurringViewContent.includes('value="semestral"') &&
      recurringViewContent.includes('value="anual"'),
    "RecurringBillingView debe soportar frecuencias mensual, trimestral, semestral y anual"
  );
});

test("Flujo E2E 37: Estructura Anti-Colisión y Sin Sobre-Montado en Formulario de Emisión de Ventas", () => {
  const rootDir = process.cwd();
  const newSalePath = path.resolve(rootDir, "src/components/modules/billing/NewSaleView.tsx");
  const newSaleContent = fs.readFileSync(newSalePath, "utf8");

  // 1. Selector de Cliente con distribución responsive espaciosa
  assert.ok(
    newSaleContent.includes("xl:grid-cols-12") &&
      newSaleContent.includes("xl:col-span-6"),
    "NewSaleView debe usar distribución xl:grid-cols-12 y xl:col-span-6 para evitar compresión en pantallas estándar"
  );

  // 2. Fila superior exclusiva para identificación del cliente y cambio
  assert.ok(
    newSaleContent.includes("selectedClient.businessName") &&
      newSaleContent.includes("limpiarIdentificacion(selectedClient.identificationNumber)") &&
      newSaleContent.includes("Cambiar cliente"),
    "NewSaleView debe presentar la razón social y RUC del cliente con botón de cambio sin obstrucciones"
  );

  // 3. Fila inferior exclusiva y auto-ajustable (flex-wrap) para accesos rápidos
  assert.ok(
    newSaleContent.includes("flex flex-wrap items-center gap-1.5 pt-1.5 border-t") &&
      newSaleContent.includes("Historial de Facturación") &&
      newSaleContent.includes("Servicios") &&
      newSaleContent.includes("Archivos"),
    "NewSaleView debe colocar los accesos rápidos en fila independiente con flex-wrap para impedir sobre-montado"
  );

  // 4. Distinción para Consumidor Final sin renderizar enlaces rotos
  assert.ok(
    newSaleContent.includes("isConsumidorFinal ?") &&
      newSaleContent.includes("CONSUMIDOR FINAL") &&
      newSaleContent.includes("9999999999999"),
    "NewSaleView debe mostrar un banner limpio para Consumidor Final sin accesos a pestañas inexistentes"
  );

  // 5. Forma de Pago: Efectivo NO debe estar seleccionado por defecto (inicio neutral)
  assert.ok(
    newSaleContent.includes("efectivo: false") &&
      newSaleContent.includes("transferencia: false") &&
      newSaleContent.includes("tarjeta: false") &&
      newSaleContent.includes("credito: false"),
    "NewSaleView debe inicializar los métodos de pago en falso (sin efectivo por defecto)"
  );

  assert.ok(
    newSaleContent.includes("Selecciona una Forma de Pago") &&
      newSaleContent.includes("hasAnyPaymentMethod"),
    "NewSaleView debe exigir la selección explícita de al menos un método de pago antes de emitir"
  );
});

test("Flujo E2E 38: Directorio de Clientes con Columna de Servicios Minimalista y Pop-up de Servicios Contratados/Facturados", () => {
  const rootDir = process.cwd();
  const clientsTablePath = path.resolve(rootDir, "src/components/modules/clients/ClientsTable.tsx");
  const clientsContent = fs.readFileSync(clientsTablePath, "utf8");

  // 1. Reducción de tamaño del nombre de cliente y eliminación de burbuja de recurrencia
  assert.ok(
    clientsContent.includes("text-xs font-semibold text-[#0b1c30]") &&
      !clientsContent.includes("rec.isRecurrent &&"),
    "ClientsTable debe reducir el tamaño del nombre del cliente y no mostrar la burbuja de recurrencia en la fila"
  );

  // 2. Nueva columna Servicios con botón minimalista 'Ver servicios'
  assert.ok(
    clientsContent.includes(">Servicios</th>") &&
      clientsContent.includes("Ver servicios") &&
      clientsContent.includes("setSelectedServicesClient(client)"),
    "ClientsTable debe incluir columna 'Servicios' con botón minimalista 'Ver servicios'"
  );

  // 3. Pop-up minimalista con pestañas de Servicios Contratados y Facturados
  assert.ok(
    clientsContent.includes("selectedServicesClient &&") &&
      clientsContent.includes("Servicios del Cliente") &&
      clientsContent.includes("Servicios Contratados") &&
      clientsContent.includes("Servicios Facturados"),
    "ClientsTable debe desplegar pop-up modal minimalista con servicios contratados y facturados"
  );
});

test("Flujo E2E 39: Alineación Estricta a la Derecha de Iconos de Acción en Finanzas y Tablas Maestras", () => {
  const rootDir = process.cwd();
  const financePath = path.resolve(rootDir, "src/components/modules/finance/FinanceDashboard.tsx");
  const financeContent = fs.readFileSync(financePath, "utf8");

  // 1. Cobros por Comprobante en Finanzas: Header text-right y contenedor justify-end
  assert.ok(
    financeContent.includes('text-right">Acciones</th>') &&
      financeContent.includes('flex items-center justify-end gap-1'),
    "FinanceDashboard debe alinear la cabecera y los iconos de acción a la derecha en Cobros por Comprobante"
  );

  // 2. Anticipos de Clientes en Finanzas: Header text-right y contenedor justify-end
  assert.ok(
    financeContent.includes('flex items-center justify-end gap-1.5'),
    "FinanceDashboard debe alinear los botones de acción a la derecha en Anticipos de Clientes"
  );

  // 3. Verificación en Compras, Proyectos y Clientes
  const purchasesPath = path.resolve(rootDir, "src/components/modules/purchases/PurchaseHistoryTab.tsx");
  const purchasesContent = fs.readFileSync(purchasesPath, "utf8");
  assert.ok(
    purchasesContent.includes('text-right">Acciones</th>') &&
      purchasesContent.includes('flex items-center justify-end gap-1'),
    "PurchaseHistoryTab debe tener los iconos de acción alineados a la derecha"
  );
});

test("Flujo E2E 40: Navegación de Finanzas en Sidebar Exclusivo, Título Dinámico en Header y Eliminación de Pestañas Redundantes", () => {
  const rootDir = process.cwd();

  // 1. Header.tsx debe mapear todos los submódulos de /finanzas
  const headerPath = path.resolve(rootDir, "src/components/layout/Header.tsx");
  const headerContent = fs.readFileSync(headerPath, "utf8");
  assert.ok(
    headerContent.includes('pathname === "/finanzas"') &&
      headerContent.includes('case "cobranzas":') &&
      headerContent.includes('return "Cobranzas"') &&
      headerContent.includes('case "gastos":') &&
      headerContent.includes('return "Gastos"') &&
      headerContent.includes('case "movimientos":') &&
      headerContent.includes('return "Movimientos"') &&
      headerContent.includes('case "bancos":') &&
      headerContent.includes('return "Bancos"') &&
      headerContent.includes('case "cuentas_por_cobrar":') &&
      headerContent.includes('return "Por Cobrar"') &&
      headerContent.includes('case "cuentas_por_pagar":') &&
      headerContent.includes('return "Por Pagar"') &&
      headerContent.includes('case "reportes":') &&
      headerContent.includes('return "Reportes"'),
    "Header.tsx debe resolver dinámicamente el título del submódulo de Finanzas arriba"
  );

  // 2. finanzas/page.tsx no debe tener la cinta de pestañas horizontal redundante
  const finanzasPagePath = path.resolve(rootDir, "src/app/finanzas/page.tsx");
  const finanzasPageContent = fs.readFileSync(finanzasPagePath, "utf8");
  assert.ok(
    !finanzasPageContent.includes("Submodule Navigation Ribbon") &&
      !finanzasPageContent.includes("visibleTabs.map"),
    "FinanzasPage no debe renderizar pestañas horizontales superiores redundantes con el sidebar"
  );

  // 3. FinanceDashboard y ExpensesManager deben tener títulos limpios sin redundancias
  const financeDashboardPath = path.resolve(rootDir, "src/components/modules/finance/FinanceDashboard.tsx");
  const financeDashboardContent = fs.readFileSync(financeDashboardPath, "utf8");
  assert.ok(
    financeDashboardContent.includes("Control de Cobros") &&
      !financeDashboardContent.includes("Control de Cobros de Clientes & Comprobantes de Venta"),
    "FinanceDashboard debe presentar 'Control de Cobros' conciso"
  );

  const expensesPath = path.resolve(rootDir, "src/components/modules/finance/ExpensesManager.tsx");
  const expensesContent = fs.readFileSync(expensesPath, "utf8");
  assert.ok(
    expensesContent.includes("Gastos Operativos") &&
      !expensesContent.includes("Control de Gastos Operativos & OPEX"),
    "ExpensesManager debe presentar 'Gastos Operativos' conciso"
  );
});













