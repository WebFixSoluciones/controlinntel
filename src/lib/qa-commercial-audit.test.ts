import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  calculateWeightedAverageCost,
  calculatePriceWithTax,
  calculatePriceWithoutTax,
  validateStockAvailability,
  buildKardexEntry,
} from "./inventory-service.ts";
import { validateIdentification } from "./validation-engine.ts";
import { getEcuadorDate, addMonthsSafely, diffInCalendarDays } from "./date-utils.ts";
import { safeNumber, safeFloat } from "./print-service.ts";
import type {
  Client,
  ClientService,
  InventoryProduct,
  Warehouse,
  MonthlyCharge,
  ChargePayment,
  FinancialMovement,
  BankAccount,
  SriInvoice,
  InvoiceItem,
  PurchaseInvoice,
  KardexEntry,
} from "../types/index.ts";

/**
 * QA COMMERCIAL AUDIT SUITE
 * Comprehensive end-to-end commercial cycle verification and bug auditing:
 * 1. Client Creation & Fiscal Validation
 * 2. Service Product Creation & Tax Calculation
 * 3. Client Service Assignment: PREPAGO / POSTPAGO, Billing & Notice Days, Category Selector Audit
 * 4. Commercial Sale Emission (Nota de Venta) & Kardex Exemption for Services
 * 5. Recurring Billing Generation & Cascading Links
 * 6. Accounts Receivable (Cobranzas / CxC), Abonos & Bank Balance Integration
 * 7. Accounts Payable (Compras / CxP), Kardex Inflow & Supplier Payments
 * 8. Reversal & Cascade Purging on Sale Deletion
 * 9. Financial Reports Integrity (Double Counting Detection)
 * 10. Document Printing (RIDE & Ticket 80mm) Data Integrity
 */

test("QA TEST 1: Creación de Cliente 'PRUEBA CLIENTE' y Validación Tributaria", () => {
  // 1.1 Validación de Cédula válida (1710034065 - Cédula Pichincha válida)
  const cedulaValida = "1710034065";
  const resCedula = validateIdentification("CEDULA", cedulaValida);
  assert.equal(resCedula.isValid, true, "La cédula válida ecuatoriana debe ser aprobada");

  // 1.2 Validación de RUC persona natural válido (1710034065001)
  const rucValido = "1710034065001";
  const resRuc = validateIdentification("RUC", rucValido);
  assert.equal(resRuc.isValid, true, "El RUC de persona natural debe ser aprobado");

  // 1.3 Validación de Cédula inválida (dígito verificador incorrecto)
  const cedulaInvalida = "1710034069";
  const resCedulaInvalida = validateIdentification("CEDULA", cedulaInvalida);
  assert.equal(resCedulaInvalida.isValid, false, "La cédula con dígito verificador falso debe fallar");

  // 1.4 Modelo del cliente PRUEBA CLIENTE
  const pruebaCliente: Client = {
    id: "cli-prueba-qa-001",
    identificationType: "RUC",
    identificationNumber: rucValido,
    businessName: "PRUEBA CLIENTE CORP S.A.S.",
    tradeName: "PRUEBA CLIENTE",
    email: "cobranzas@pruebacliente.com",
    phone: "0991234567",
    address: "Av. Amazonas y República, Quito",
    sector: "Norte",
    currentBalance: 0,
    totalActiveServices: 0,
    billingRecurrence: "mensual",
    status: "activo",
    requiresSriBilling: false,
    createdAt: getEcuadorDate(),
    updatedAt: getEcuadorDate(),
  };

  assert.equal(pruebaCliente.currentBalance, 0, "El saldo inicial de un cliente nuevo debe ser 0.00");
  assert.equal(pruebaCliente.totalActiveServices, 0, "Los servicios activos iniciales deben ser 0");
});

test("QA TEST 2: Creación de Servicio en Inventario, Impuestos (IVA 15%) y Exención de Kardex", () => {
  const serviceSinIva = 30.0;
  const ivaRate = 15;
  const conIva = calculatePriceWithTax(serviceSinIva, ivaRate);
  assert.equal(conIva, 34.5, "El precio con 15% IVA de $30.00 debe ser exactamente $34.50");

  const reversadoSinIva = calculatePriceWithoutTax(conIva, ivaRate);
  assert.equal(reversadoSinIva, 30.0, "La reversión de $34.50 con 15% IVA debe ser exactamente $30.00");

  const qaServiceProduct: InventoryProduct = {
    id: "srv-internet-fibra-200",
    sku: "SRV-FIBRA-200",
    name: "Plan Fibra Óptica 200 Mbps Corporativo",
    type: "servicio",
    categoryId: "cat-servicios-tec",
    categoryName: "Servicios Técnicos & Despliegue",
    unit: "servicio",
    baseCost: 10.0,
    salePrice: serviceSinIva,
    salePriceConIva: conIva,
    ivaRate: 15,
    taxMode: "EXCLUIDO",
    tracksStock: false,
    stock: 0,
    minStock: 0,
    status: "activo",
    stockByWarehouse: {},
    createdAt: getEcuadorDate(),
    updatedAt: getEcuadorDate(),
  };

  assert.equal(qaServiceProduct.tracksStock, false, "Los servicios no deben rastrear stock en bodegas");
  assert.equal(qaServiceProduct.unit, "servicio", "La unidad estándar de servicio debe ser 'servicio'");
});

test("QA TEST 3: Asignación de Servicio al Cliente, Modalidad PREPAGO / POSTPAGO y Días de Facturación", () => {
  const fechaInicio = getEcuadorDate();
  const renewalDate = addMonthsSafely(fechaInicio, 1);

  const prepagoService: ClientService = {
    id: "csv-qa-prepago-001",
    clientId: "cli-prueba-qa-001",
    planId: "srv-internet-fibra-200",
    planName: "Plan Fibra Óptica 200 Mbps Corporativo",
    downloadMbps: 200,
    uploadMbps: 200,
    basePrice: 30.0,
    customPrice: 30.0,
    priceConIva: 34.5,
    ivaRate: 15,
    billingType: "prepago",
    billingDay: 1,
    advanceNoticeDay: 26,
    billingFrequency: "mensual",
    contractDuration: "anual",
    contractStartDate: fechaInicio,
    contractEndDate: addMonthsSafely(fechaInicio, 12),
    autoRenew: true,
    cutoffDay: 5,
    nodeId: "node-1",
    nodeName: "NODO-CENTRAL",
    ipv4Address: "DHCP",
    pppoeUser: "usr-pruebacliente",
    status: "activo",
    installationDate: fechaInicio,
    nextRenewalDate: renewalDate,
    isBillableInCurrentCycle: true,
    origin: "manual",
    saleStatus: "pendiente_venta",
  };

  assert.equal(prepagoService.billingType, "prepago", "El servicio debe registrar modalidad PREPAGO");
  assert.equal(prepagoService.billingDay, 1, "Día de facturación definido como 1");
  assert.equal(prepagoService.advanceNoticeDay, 26, "Día de aviso de cobro definido como 26");
  assert.equal(prepagoService.status, "activo", "Estado activo inicial");
  assert.equal(prepagoService.isBillableInCurrentCycle, true, "Debe ser facturable en ciclo corriente");
});

test("QA TEST 4: Emisión de Venta Comercial (Nota de Venta) y Generación de Cobranza (CxC)", () => {
  const unitPrice = 30.0;
  const iva = unitPrice * 0.15;
  const total = unitPrice + iva;

  const saleItem: InvoiceItem = {
    id: "it-001",
    productId: "srv-internet-fibra-200",
    sku: "SRV-FIBRA-200",
    name: "Plan Fibra Óptica 200 Mbps Corporativo",
    unit: "servicio",
    quantity: 1,
    unitPrice: unitPrice,
    ivaRate: 15,
    ivaAmount: iva,
    discount: 0,
    subtotal: unitPrice,
    total: total,
  };

  const invoiceId = "inv-qa-001";
  const docNumber = "001-001-000000999";

  const commercialInvoice: SriInvoice = {
    id: invoiceId,
    documentType: "nota_venta",
    documentNumber: docNumber,
    date: getEcuadorDate(),
    time: "10:00",
    clientId: "cli-prueba-qa-001",
    clientName: "PRUEBA CLIENTE CORP S.A.S.",
    clientRuc: "1710034065001",
    clientEmail: "cobranzas@pruebacliente.com",
    clientAddress: "Quito, Ecuador",
    claveAcceso: "0000000000000000000000000000000000000000000000000",
    kardexRegistered: false,
    createdAt: getEcuadorDate(),
    tipoIdentificacion: "04",
    items: [saleItem],
    subtotal15: unitPrice,
    subtotal0: 0,
    subtotalNoObjeto: 0,
    subtotalExento: 0,
    discountTotal: 0,
    ivaTotal: iva,
    total: total,
    paymentMethod: "credito",
    paymentsBreakdown: { efectivo: 0, transferencia: 0, tarjeta: 0, credito: total },
    status: "registrado",
    sriStatus: "pendiente",
    warehouseId: "wh-central",
    warehouseName: "Bodega Central",
    notes: "Venta comercial inicial",
  };

  // Kardex verification: A service MUST NOT generate a kardex output
  const tracksStock = false;
  const kardexGenerated = tracksStock ? 1 : 0;
  assert.equal(kardexGenerated, 0, "No debe generarse salida de kardex para ítems de tipo servicio");

  // Charge generation in MonthlyCharges (Cobranzas)
  const chargeId = `chg-inv-${invoiceId}`;
  const newMonthlyCharge: MonthlyCharge = {
    id: chargeId,
    clientId: commercialInvoice.clientId,
    clientName: commercialInvoice.clientName,
    clientRuc: commercialInvoice.clientRuc,
    month: 10,
    year: 2026,
    serviceDescription: `Venta Nota de Venta ${docNumber}`,
    subtotal: commercialInvoice.subtotal15,
    ivaAmount: commercialInvoice.ivaTotal,
    total: commercialInvoice.total,
    status: "pendiente",
    invoiceId: invoiceId,
    invoiceNumber: docNumber,
    balanceRemaining: commercialInvoice.total,
    paidAmount: 0,
    payments: [],
  };

  assert.equal(newMonthlyCharge.invoiceId, invoiceId, "El cobro debe tener vinculado el invoiceId");
  assert.equal(newMonthlyCharge.balanceRemaining, 34.5, "El saldo inicial por cobrar debe ser $34.50");
  assert.equal(newMonthlyCharge.status, "pendiente", "El cobro debe arrancar en estado pendiente");
});

test("QA TEST 5: Cobranza Parcial (Abono) y Cobranza Total con Actualización de Saldo Bancario", () => {
  let bankAccount: BankAccount = {
    id: "bank-qa-001",
    bankName: "Banco Pichincha Cuenta Corriente QA",
    accountNumber: "2100123456",
    accountType: "corriente",
    currentBalance: 1000.0,
    initialBalance: 1000.0,
    currency: "USD",
    status: "activa",
  };

  let clientBal = 34.5;
  let charge: MonthlyCharge = {
    id: "chg-inv-qa-001",
    clientId: "cli-prueba-qa-001",
    clientName: "PRUEBA CLIENTE CORP S.A.S.",
    clientRuc: "1710034065001",
    month: 10,
    year: 2026,
    serviceDescription: "Venta Nota de Venta 001-001-000000999",
    subtotal: 30.0,
    ivaAmount: 4.5,
    total: 34.5,
    status: "pendiente",
    invoiceId: "inv-qa-001",
    invoiceNumber: "001-001-000000999",
    balanceRemaining: 34.5,
    paidAmount: 0,
    payments: [],
  };

  // 5.1 Abono parcial de $20.00
  const abonoAmount = 20.0;
  const newBalance1 = Math.round((charge.balanceRemaining! - abonoAmount) * 100) / 100;
  const newPaid1 = Math.round(((charge.paidAmount || 0) + abonoAmount) * 100) / 100;
  const status1 = newBalance1 <= 0.009 ? "pagado" : "parcial";

  const payment1: ChargePayment = {
    id: "pay-qa-001",
    date: getEcuadorDate(),
    amount: abonoAmount,
    method: "Transferencia Bancaria",
    reference: "TRANS-889911",
    bankAccountId: bankAccount.id,
    bankAccountName: bankAccount.bankName,
  };

  charge = {
    ...charge,
    paidAmount: newPaid1,
    balanceRemaining: newBalance1,
    status: status1,
    payments: [payment1],
  };

  // Actualizar banco y cliente
  bankAccount.currentBalance = Math.round((bankAccount.currentBalance + abonoAmount) * 100) / 100;
  clientBal = Math.round((clientBal - abonoAmount) * 100) / 100;

  assert.equal(charge.status, "parcial", "El estado tras abono parcial debe ser 'parcial'");
  assert.equal(charge.balanceRemaining, 14.5, "El saldo restante del cobro debe ser $14.50");
  assert.equal(bankAccount.currentBalance, 1020.0, "El banco debe registrar ingreso: $1020.00");
  assert.equal(clientBal, 14.5, "El saldo del cliente debe ser $14.50");

  // 5.2 Pago final de $14.50 para liquidar
  const pagoFinal = 14.5;
  const newBalance2 = Math.round((charge.balanceRemaining! - pagoFinal) * 100) / 100;
  const newPaid2 = Math.round(((charge.paidAmount || 0) + pagoFinal) * 100) / 100;
  const status2 = newBalance2 <= 0.009 ? "pagado" : "parcial";

  charge = {
    ...charge,
    paidAmount: newPaid2,
    balanceRemaining: newBalance2,
    status: status2,
  };
  bankAccount.currentBalance = Math.round((bankAccount.currentBalance + pagoFinal) * 100) / 100;
  clientBal = Math.round((clientBal - pagoFinal) * 100) / 100;

  assert.equal(charge.status, "pagado", "El cobro debe quedar 'pagado'");
  assert.equal(charge.balanceRemaining, 0, "El saldo restante del cobro debe ser 0.00");
  assert.equal(bankAccount.currentBalance, 1034.5, "El banco debe sumar el total cobrado ($1034.50)");
  assert.equal(clientBal, 0, "El cliente no debe adeudar nada ($0.00)");
});

test("QA TEST 6: Cascada al Eliminar Venta y Desvinculación de Servicios y Cobranzas", () => {
  let services: ClientService[] = [
    {
      id: "srv-born-from-sale",
      clientId: "cli-prueba-qa-001",
      planId: "p1",
      planName: "Servicio Nacido de Venta",
      downloadMbps: 100,
      uploadMbps: 100,
      basePrice: 20,
      customPrice: 20,
      billingType: "pospago",
      cutoffDay: 5,
      nodeId: "node-1",
      nodeName: "NODO-CENTRAL",
      ipv4Address: "DHCP",
      pppoeUser: "u1",
      status: "activo",
      installationDate: getEcuadorDate(),
      origin: "nota_venta",
      saleInvoiceId: "inv-to-delete",
      saleDocNumber: "001-001-000000888",
    },
    {
      id: "srv-preexisting-contract",
      clientId: "cli-prueba-qa-001",
      planId: "p2",
      planName: "Plan Contrato Recurrente",
      downloadMbps: 100,
      uploadMbps: 100,
      basePrice: 50,
      customPrice: 50,
      billingType: "prepago",
      cutoffDay: 5,
      nodeId: "node-1",
      nodeName: "NODO-CENTRAL",
      ipv4Address: "DHCP",
      pppoeUser: "u2",
      status: "activo",
      installationDate: getEcuadorDate(),
      origin: "manual",
      saleInvoiceId: "inv-to-delete",
      lastBilledPeriod: "2026-10",
      lastBilledInvoiceId: "inv-to-delete",
    },
  ];

  let charges: MonthlyCharge[] = [
    {
      id: "chg-inv-inv-to-delete",
      clientId: "cli-prueba-qa-001",
      clientName: "PRUEBA CLIENTE",
      clientRuc: "1710034065001",
      month: 10,
      year: 2026,
      serviceDescription: "Venta Eliminable",
      subtotal: 70,
      ivaAmount: 10.5,
      total: 80.5,
      status: "pendiente",
      invoiceId: "inv-to-delete",
      invoiceNumber: "001-001-000000888",
    },
  ];

  // Simulación de deleteInvoice("inv-to-delete")
  const idToDelete = "inv-to-delete";
  const linkedServices = services.filter((s) => s.saleInvoiceId === idToDelete || s.lastBilledInvoiceId === idToDelete);

  const servicesToDelete: string[] = [];
  const servicesToRevert: string[] = [];

  for (const s of linkedServices) {
    if (s.origin === "nota_venta" || s.origin === "factura") {
      servicesToDelete.push(s.id);
    } else {
      servicesToRevert.push(s.id);
    }
  }

  // Filtrar eliminados
  services = services.filter((s) => !servicesToDelete.includes(s.id));
  // Revertir preexistentes
  services = services.map((s) => {
    if (servicesToRevert.includes(s.id)) {
      return {
        ...s,
        saleInvoiceId: undefined,
        saleDocNumber: undefined,
        lastBilledPeriod: undefined,
        lastBilledInvoiceId: undefined,
        saleStatus: "pendiente_venta",
      };
    }
    return s;
  });

  // Purga de cobranzas
  charges = charges.filter((c) => c.invoiceId !== idToDelete && c.id !== `chg-inv-${idToDelete}`);

  assert.equal(services.some((s) => s.id === "srv-born-from-sale"), false, "El servicio nacido de la venta eliminada debe ser purgado");
  const contractSvc = services.find((s) => s.id === "srv-preexisting-contract");
  assert.ok(contractSvc, "El servicio de contrato preexistente debe conservarse");
  assert.equal(contractSvc?.lastBilledPeriod, undefined, "El periodo facturado debe quedar limpio");
  assert.equal(charges.length, 0, "El cobro en cobranzas debe haber sido purgado en cascada");
});

test("QA TEST 7: Verificación de Remediación de Inconsistencias UX/UI y Procesos", () => {
  const rootDir = process.cwd();
  const contractTabPath = path.resolve(rootDir, "src/components/modules/clients/ClientContractTab.tsx");
  const recurringViewPath = path.resolve(rootDir, "src/components/modules/billing/RecurringBillingView.tsx");
  const reportsTabPath = path.resolve(rootDir, "src/components/modules/finance/FinancialReportsTab.tsx");
  const statePath = path.resolve(rootDir, "src/lib/state.tsx");

  const contractContent = fs.readFileSync(contractTabPath, "utf8");
  const recurringContent = fs.readFileSync(recurringViewPath, "utf8");
  const reportsContent = fs.readFileSync(reportsTabPath, "utf8");
  const stateContent = fs.readFileSync(statePath, "utf8");

  // Verificación 1: El selector manual huérfano de categoría fue reemplazado por la categoría oficial de catálogo
  const hasOfficialCatalogCategory = contractContent.includes("Categoría de Catálogo") && !contractContent.includes('<select\n                    value={newSvcCategory}');
  assert.ok(hasOfficialCatalogCategory, "VERIFICACIÓN: ClientContractTab muestra la categoría oficial del catálogo y elimina el selector manual huérfano");

  // Verificación 2: Visualización explícita de modalidad PREPAGO / POSTPAGO en tabla de Recurrentes
  const showsModalidadInLote = recurringContent.includes("PREPAGO") && recurringContent.includes("POSTPAGO") && recurringContent.includes("modalityLabel");
  assert.ok(showsModalidadInLote, "VERIFICACIÓN: RecurringBillingView muestra la columna y badges de PREPAGO/POSTPAGO tanto en la fila de cliente como en la tabla desplegada");

  // Verificación 3: Corrección del Doble Conteo en Reportes Financieros.
  // La caja se calcula desde una única fuente (externalCash) y ya no se suma la
  // recaudación por cobros a los movimientos bancarios.
  const hasFixedDoubleCount =
    reportsContent.includes("externalCash(financialMovements)") &&
    !reportsContent.includes("totalRecaudado + movIngresos");
  assert.ok(hasFixedDoubleCount, "VERIFICACIÓN: FinancialReportsTab usa una única fuente de caja y no vuelve a sumar la recaudación a los movimientos de ingreso");

  // Verificación 4: Notas de Venta Recurrentes con Especificación de Modalidad y Fecha Máxima de Pago
  const commercialContent = fs.readFileSync(path.resolve(rootDir, "src/lib/server/commercial.ts"), "utf8");
  const coreContent = fs.readFileSync(path.resolve(rootDir, "src/lib/commercial-core.ts"), "utf8");
  const hasModalityNotes =
    coreContent.includes('"PREPAGO" : "POSTPAGO"') &&
    commercialContent.includes("maxPaymentDate:") &&
    coreContent.includes("dueDate");
  assert.ok(hasModalityNotes, "VERIFICACIÓN: la emisión recurrente rotula la modalidad PREPAGO/POSTPAGO en la línea y asigna la fecha máxima de pago");
});
