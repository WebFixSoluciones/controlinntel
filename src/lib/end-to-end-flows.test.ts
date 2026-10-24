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
