import test from "node:test";
import assert from "node:assert/strict";
import { inReportPeriod, companyPeriodReport, clientCommercialRows, reportSales, type ReportSource } from "./company-reporting.ts";

const fiscal = { estadoSRI: "AUTORIZADO", authorizationVerified: true, ambiente: "2" };
const fixture = (): ReportSource => ({
  clients: [{ id: "a", businessName: "CLIENTE A", identificationNumber: "QA-1", status: "activo" }, { id: "b", businessName: "CLIENTE B", status: "retirado" }],
  billingInvoices: [
    { id: "sale", clientId: "a", documentType: "nota_venta", status: "registrado", date: "2026-11-05", total: 115, ivaTotal: 15, items: [{ id: "line", productId: "product", quantity: 1, unitPrice: 100, subtotal: 100, costTotalSnapshot: 30 }] },
    { id: "fiscal", ...fiscal, clientId: "a", documentType: "factura", relatedSaleId: "sale", date: "2026-11-05", total: 115, ivaTotal: 15 },
    { id: "direct", ...fiscal, clientId: "a", documentType: "factura", date: "2026-11-06", total: 230, ivaTotal: 30, items: [{ quantity: 1, unitPrice: 200, subtotal: 200, costTotalSnapshot: 80, costKindSnapshot: "inventario" }] },
    { id: "cancelled", clientId: "a", documentType: "nota_venta", status: "anulada", date: "2026-11-05", total: 575, ivaTotal: 75 },
    { id: "draft", documentType: "nota_venta", status: "borrador", date: "2026-11-05", total: 1000 },
    { id: "test", ...fiscal, ambiente: "1", documentType: "factura", date: "2026-11-06", total: 1000 },
  ],
  billingCreditNotes: [{ ...fiscal, date: "2026-11-10", total: 23, ivaTotal: 3 }],
  billingDebitNotes: [{ ...fiscal, date: "2026-11-11", total: 11.5, ivaTotal: 1.5 }],
  expenses: [{ id: "expense", amount: 20, expenseDate: "2026-11-09", category: "viajes" }, { amount: 900, expenseDate: "2026-11-09", status: "anulado" }, { amount: 10, expenseDate: "2026-10-31" }],
  purchaseInvoices: [
    { id: "stock", inventoryStatus: "ingresado", date: "2026-11-01", total: 575, subtotal: 500, paidAmount: 565, balanceRemaining: 10 },
    { id: "service", inventoryStatus: "no_aplica", date: "2026-11-02", total: 57.5, subtotal: 50, balanceRemaining: 20 },
    { id: "mixed", inventoryStatus: "ingresado", date: "2026-11-02", total: 115, subtotal: 100, balanceRemaining: 30, items: [{ productId: "stock-item", subtotal: 70 }, { productId: "service-item", subtotal: 30 }] },
  ],
  supplierCreditNotes: [{ purchaseInvoiceId: "service", date: "2026-11-10", amount: 11.5 }],
  inventoryKardex: [{ type: "SALE", referenceId: "sale", productId: "product", exitTotalCost: 40 }, { type: "PURCHASE_RECEIPT", referenceId: "stock", productId: "stock-item", entryTotalCost: 500 }, { type: "PURCHASE_RECEIPT", referenceId: "mixed", productId: "stock-item", entryTotalCost: 70 }],
  monthlyCharges: [{ id: "charge", invoiceId: "sale", clientId: "a", total: 115, paidAmount: 40, balanceRemaining: 75, saleDate: "2026-11-05", status: "parcial", payments: [{ id: "p", amount: 40, date: "2026-11-09" }] }, { invoiceId: "cancelled", total: 575, status: "pendiente" }],
  clientAdvances: [{ id: "advance", clientId: "a", date: "2026-11-01", remaining: 100, status: "vigente" }, { clientId: "a", remaining: 999, status: "anulado" }],
  financialMovements: [
    { bankAccountId: "bank", date: "2026-11-01", type: "ingreso", category: "anticipo_cliente", amount: 100 },
    { bankAccountId: "bank", date: "2026-11-09", type: "ingreso", category: "cobro_cliente", amount: 40 },
    { bankAccountId: "bank", date: "2026-11-09", type: "egreso", category: "viajes", amount: 20 },
    { bankAccountId: "bank", date: "2026-11-09", type: "egreso", category: "pago_proveedor", amount: 50 },
    { bankAccountId: "bank", date: "2026-11-09", type: "egreso", category: "transferencia_interna", transferId: "transfer", amount: 10 },
    { bankAccountId: "bank2", date: "2026-11-09", type: "ingreso", category: "transferencia_interna", transferId: "transfer", amount: 10 },
    { bankAccountId: "bank", date: "2026-12-01", type: "ingreso", category: "cobro_cliente", amount: 30 },
    { bankAccountId: "bank", date: "2026-11-09", type: "ingreso", category: "anticipo_cliente", amount: 999, status: "anulado" },
  ],
  bankAccounts: [{ id: "bank", bankName: "BANCO QA", initialBalance: 100, currentBalance: 190, createdAt: "2025-01-01" }, { id: "bank2", initialBalance: 0, currentBalance: 10, createdAt: "2025-01-01" }],
});

test("Los reportes distinguen venta, costo, inventario y caja y cuentan una sola vez nota/factura", () => {
  const report = companyPeriodReport(fixture(), "2026-11-01", "2026-11-30");
  assert.equal(reportSales(fixture()).length, 2);
  assert.equal(report.netSales, 290);
  assert.equal(report.cost, 120); // Historical Kardex cost takes precedence over a stale snapshot.
  assert.equal(report.opex, 20);
  assert.equal(report.directPurchaseCost, 70); // Services + mixed non-stock lines - supplier credit, net of VAT.
  assert.equal(report.operatingResult, 80);
  assert.equal(report.purchaseTotal, 747.5);
  assert.equal(report.advancesReceived, 100);
  assert.equal(report.incoming, 140);
  assert.equal(report.outgoing, 70);
  assert.equal(report.cashFlow, 70);
  assert.equal(report.receivables, 75);
  assert.equal(report.payables, 60);
  assert.equal(report.availableCredit, 100);
  assert.equal(report.liquidity, 200);
  assert.equal(report.banks[0].opening, 100);
  assert.equal(report.banks[0].closing, 160);
  assert.equal(report.banks[1].closing, 10);
  assert.equal(report.missingCosts, 0);
});

test("Los filtros incluyen los extremos y no confunden saldos actuales con movimientos históricos", () => {
  assert.equal(inReportPeriod("2026-11-09", "2026-11-09", "2026-11-09"), true);
  assert.equal(inReportPeriod("2026-11-10", "2026-11-09", "2026-11-09"), false);
  assert.equal(inReportPeriod("", "2026-11-09", ""), false);
  const report = companyPeriodReport(fixture(), "2026-12-01", "2026-12-01");
  assert.equal(report.netSales, 0);
  assert.equal(report.incoming, 30);
  assert.equal(report.opex, 0);
  assert.equal(report.receivables, 75);
  assert.equal(report.availableCredit, 100);
});

test("El reporte de clientes muestra servicios y mensual equivalente, cobros por fecha y deuda separada del anticipo", () => {
  const source = fixture();
  source.clientServices = [
    { clientId: "a", planName: "Trimestral", status: "activo", customPrice: 300, ivaRate: 15, billingFrequency: "trimestral" },
    { clientId: "a", planName: "Anual", status: "activo", customPrice: 1200, ivaRate: 0, billingFrequency: "anual" },
    { clientId: "a", planName: "Suspendido", status: "suspendido", customPrice: 900, billingFrequency: "mensual" },
    { clientId: "a", planName: "Retirado", status: "retirado", customPrice: 1000 },
  ];
  const november = clientCommercialRows(source, "2026-11-01", "2026-11-30")[0];
  assert.equal(november.monthlyFee, 215);
  assert.equal(november.services.length, 3);
  assert.equal(november.charged, 345);
  assert.equal(november.paid, 40);
  assert.equal(november.pending, 75);
  assert.equal(november.credit, 100);
  const december = clientCommercialRows(source, "2026-12-01", "2026-12-31")[0];
  assert.equal(december.paid, 0);
  assert.equal(december.charged, 0);
  assert.equal(december.periodPending, 0);
  assert.equal(december.pending, 75);
});

test("Una ganancia incompleta identifica costos faltantes y posibles gastos duplicados", () => {
  const source = fixture();
  source.billingInvoices![0].items.push({ productId: "missing-cost", quantity: 1, subtotal: 10 });
  source.expenses![0].invoiceNumber = "REF"; source.expenses![0].supplierId = "supplier";
  source.purchaseInvoices![0].documentNumber = "REF"; source.purchaseInvoices![0].supplierId = "supplier";
  source.purchaseInvoices!.push({ id: "unknown", date: "2026-11-09", total: 50, items: [{ productId: "unknown-product", subtotal: 50 }] });
  const report = companyPeriodReport(source, "2026-11-01", "2026-11-30");
  assert.equal(report.missingCosts, 1);
  assert.equal(report.unknownPurchases, 1);
  assert.equal(report.duplicateExpenses, 1);
});

test("Los cobros históricos sin detalle no desaparecen y solo se atribuyen a un período con fecha registrada", () => {
  const source: ReportSource = { clients: [{ id: "a", businessName: "Histórico" }], monthlyCharges: [
    { clientId: "a", year: 2026, month: 11, total: 100, paidAmount: 60, balanceRemaining: 40, status: "parcial" },
    { clientId: "a", year: 2026, month: 10, total: 20, paidAmount: 20, balanceRemaining: 0, status: "pagado", paymentDate: "2026-11-09" },
  ] };
  assert.equal(clientCommercialRows(source)[0].paid, 80);
  const november = clientCommercialRows(source, "2026-11-01", "2026-11-30")[0];
  assert.equal(november.paid, 20);
  assert.equal(november.undatedPaid, 60);
  assert.equal(november.charged, 100);
});

test("El costo referencial de servicios no se suma otra vez a las compras y gastos efectivos", () => {
  const source: ReportSource = { billingInvoices: [{ id: "service-sale", documentType: "nota_venta", status: "registrado", date: "2026-11-09", total: 100, subtotal: 100,
    items: [{ quantity: 1, subtotal: 100, costTotalSnapshot: 80, costKindSnapshot: "referencia" }] }],
    purchaseInvoices: [{ id: "purchase", inventoryStatus: "no_aplica", date: "2026-11-09", subtotal: 50, total: 50 }],
    expenses: [{ date: "2026-11-09", expenseDate: "2026-11-09", amount: 10 }] };
  const report = companyPeriodReport(source, "2026-11-01", "2026-11-30");
  assert.equal(report.referenceCost, 80);
  assert.equal(report.cost, 0);
  assert.equal(report.operatingResult, 40);
  assert.equal(report.needsExpenseReview, false);
  assert.equal(companyPeriodReport({ billingInvoices: source.billingInvoices }).needsExpenseReview, true);
});
