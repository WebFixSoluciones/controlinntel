import { cents, money, chargeBalance, validDate, type RecordData as Row } from "./commercial-core.ts";
import { availableClientCredit } from "./client-credit.ts";
import { getEcuadorDate, addMonthsSafely } from "./date-utils.ts";

export type ReportSource = Partial<Record<"clients" | "clientServices" | "billingInvoices" | "monthlyCharges" | "financialMovements" | "expenses" | "purchaseInvoices" | "bankAccounts" | "clientAdvances" | "inventoryKardex" | "billingCreditNotes" | "billingDebitNotes" | "supplierCreditNotes" | "supplierDebitNotes", Row[]>>;
export const chargeReportDate = (row: Row) => row.saleDate || (row.year && row.month ? `${row.year}-${String(row.month).padStart(2, "0")}-01` : "");
export function inReportPeriod(value: unknown, from = "", to = "") {
  if (!from && !to) return true;
  const date = String(value || "").slice(0, 10);
  return validDate(date) && (!from || date >= from) && (!to || date <= to);
}
export const reportSearchText = (value: unknown) => String(value ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("es").trim();
export function purchaseBalance(row: Row) {
  if (["anulado", "anulada"].includes(row.status)) return 0;
  return row.balanceRemaining != null ? Math.max(0, cents(row.balanceRemaining)) / 100
    : row.paymentStatus === "pagado" ? 0 : money(Math.max(0, cents(row.total ?? 0) - cents(row.paidAmount ?? 0)));
}

export function reportCashSeries(movements: Row[], from = "", to = "", today = getEcuadorDate()) {
  const dated = movements.filter(row => validDate(String(row.date || "").slice(0, 10)) && inReportPeriod(row.date, from, to));
  const months = dated.map(row => String(row.date).slice(0, 7)).sort();
  const end = (to || (months.at(-1) && months.at(-1)! > today.slice(0, 7) ? months.at(-1)! + "-01" : today)).slice(0, 7) + "-01";
  const start = from ? from.slice(0, 7) + "-01" : months[0] ? months[0] + "-01" : addMonthsSafely(end, -5);
  const count = (Number(end.slice(0, 4)) - Number(start.slice(0, 4))) * 12 + Number(end.slice(5, 7)) - Number(start.slice(5, 7)) + 1;
  if (count <= 0) return [];
  const yearly = count > 120;
  const periods = yearly
    ? Array.from({ length: Number(end.slice(0, 4)) - Number(start.slice(0, 4)) + 1 }, (_, index) => String(Number(start.slice(0, 4)) + index))
    : Array.from({ length: count }, (_, index) => addMonthsSafely(start, index).slice(0, 7));
  const totals = new Map(periods.map(period => [period, { incoming: 0, outgoing: 0 }]));
  for (const movement of dated) {
    const period = String(movement.date).slice(0, yearly ? 4 : 7), sum = totals.get(period);
    if (sum) sum[movement.type === "ingreso" ? "incoming" : "outgoing"] += cents(movement.amount);
  }
  return [...totals].map(([mes, values]) => ({ mes, ingresos: money(values.incoming), egresos: money(values.outgoing), neto: money(values.incoming - values.outgoing) }));
}
const active = (row: Row) => !["anulada", "anulado", "borrador"].includes(row.status) && !row.deletedAt;
const authorizedProduction = (row: Row) => row.estadoSRI === "AUTORIZADO" && (row.authorizationVerified || row.xmlAutorizado) && (row.ambiente === "2" || row.claveAcceso?.[23] === "2");
export const reportNet = (row: Row) => row.subtotal !== undefined ? cents(row.subtotal)
  : row.items?.length ? row.items.reduce((sum: number, item: Row) => sum + cents(item.subtotal ?? Number(item.quantity || 0) * Number(item.unitPrice ?? item.unitCost ?? 0) - Number(item.discount || 0)), 0)
  : cents(row.total || 0) - cents(row.ivaTotal ?? row.ivaAmount ?? 0);

export function reportSales(source: ReportSource) {
  const all = source.billingInvoices || [];
  const notes = new Set(all.filter(row => row.documentType === "nota_venta").map(row => row.id));
  return all.filter(row => active(row) && (row.documentType === "nota_venta" || row.documentType === "factura" && authorizedProduction(row) && !notes.has(row.relatedSaleId)));
}

export function reportCharges(source: ReportSource) {
  const invoices = new Map((source.billingInvoices || []).map(row => [row.id, row]));
  return (source.monthlyCharges || []).filter(row => active(row) && (!row.invoiceId || !invoices.has(row.invoiceId) || active(invoices.get(row.invoiceId)!)));
}

export function clientCommercialRows(source: ReportSource, from = "", to = "") {
  const charges = reportCharges(source), services = source.clientServices || [];
  const sales = reportSales(source);
  return (source.clients || []).map(client => {
    const ownServices = services.filter(service => service.clientId === client.id && service.status !== "retirado");
    const ownCharges = charges.filter(charge => charge.clientId === client.id);
    const periodCharges = ownCharges.filter(charge => inReportPeriod(chargeReportDate(charge), from, to));
    let undatedPaid = 0;
    const paid = ownCharges.reduce((sum, charge) => {
      const history = (charge.payments || []).filter((payment: Row) => payment.status !== "reversed");
      const totalHistory = history.reduce((total: number, payment: Row) => total + cents(payment.amount), 0);
      const gap = Math.max(0, cents(charge.paidAmount ?? (charge.status === "pagado" ? charge.total : 0)) - totalHistory);
      const fallbackDate = !history.length && /^\d{4}-\d{2}-\d{2}/.test(charge.paymentDate || "") ? charge.paymentDate : "";
      if (gap && !fallbackDate) undatedPaid += gap;
      return sum + history.filter((payment: Row) => inReportPeriod(payment.date, from, to)).reduce((total: number, payment: Row) => total + cents(payment.amount), 0)
        + ((!from && !to || fallbackDate && inReportPeriod(fallbackDate, from, to)) ? gap : 0);
    }, 0);
    const monthlyFee = ownServices.filter(service => client.status === "activo" && service.status === "activo" && service.isBillableInCurrentCycle !== false).reduce((sum, service) => {
      const months: Record<string, number> = { mensual: 1, trimestral: 3, semestral: 6, anual: 12 };
      const total = service.priceConIva ?? Number(service.customPrice ?? service.basePrice ?? 0) * (1 + Number(service.ivaRate ?? 0) / 100);
      return sum + Math.round(cents(total) / (months[service.billingFrequency || "mensual"] || 1));
    }, 0);
    return { id: client.id, name: client.businessName, tradeName: client.tradeName || "", ruc: client.identificationNumber, status: client.status, services: ownServices,
      monthlyFee: money(monthlyFee), charged: money(periodCharges.reduce((sum, charge) => sum + cents(charge.total), 0) + sales.filter(sale => sale.clientId === client.id && inReportPeriod(sale.date, from, to) && !ownCharges.some(charge => charge.invoiceId === sale.id || !charge.invoiceId && charge.invoiceNumber && charge.invoiceNumber === sale.documentNumber)).reduce((sum, sale) => sum + cents(sale.total), 0)),
      paid: money(paid), undatedPaid: money(undatedPaid), pending: money(ownCharges.reduce((sum, charge) => sum + chargeBalance(charge), 0)),
      periodPending: money(periodCharges.reduce((sum, charge) => sum + chargeBalance(charge), 0)),
      credit: availableClientCredit(source.clientAdvances || [], client.id).total,
      overdue: money(ownCharges.filter(charge => charge.maxPaymentDate && charge.maxPaymentDate < getEcuadorDate()).reduce((sum, charge) => sum + chargeBalance(charge), 0)) };
  });
}

export function companyPeriodReport(source: ReportSource, from = "", to = "") {
  const sales = reportSales(source).filter(row => inReportPeriod(row.date, from, to));
  const purchases = (source.purchaseInvoices || []).filter(row => active(row) && inReportPeriod(row.date, from, to));
  const expenses = (source.expenses || []).filter(row => active(row) && inReportPeriod(row.expenseDate, from, to));
  const movements = (source.financialMovements || []).filter(active);
  const periodMovements = movements.filter(row => inReportPeriod(row.date, from, to));
  const cash = periodMovements.filter(row => !row.transferId && !String(row.category).startsWith("transferencia") && !["apertura", "ajuste_conciliacion"].includes(row.category));
  const incoming = cash.filter(row => row.type === "ingreso").reduce((sum, row) => sum + cents(row.amount), 0);
  const outgoing = cash.filter(row => row.type === "egreso").reduce((sum, row) => sum + cents(row.amount), 0);
  const saleIds = new Set(sales.map(row => row.id));
  const saleCosts = new Map<string, number>();
  for (const movement of source.inventoryKardex || []) {
    if (!saleIds.has(movement.referenceId)) continue;
    const key = `${movement.referenceId}/${movement.productId}`;
    if (movement.type === "SALE" && Number.isFinite(movement.exitTotalCost)) saleCosts.set(key, (saleCosts.get(key) || 0) + cents(movement.exitTotalCost));
    if (movement.type === "CUSTOMER_RETURN") saleCosts.set(key, (saleCosts.get(key) || 0) - cents(movement.entryTotalCost || 0));
  }
  let cost = 0, referenceCost = 0, missingCosts = 0;
  const usedCosts = new Set<string>();
  missingCosts += sales.filter(sale => !sale.items?.length && reportNet(sale) !== 0).length;
  for (const sale of sales) for (const item of sale.items || []) {
    const key = `${sale.id}/${item.productId}`;
    if (saleCosts.has(key)) { if (!usedCosts.has(key)) cost += saleCosts.get(key)!; usedCosts.add(key); }
    else if (Number.isFinite(item.costTotalSnapshot) && item.costKindSnapshot === "inventario") cost += cents(item.costTotalSnapshot);
    else if (Number.isFinite(item.costTotalSnapshot) && item.costKindSnapshot === "referencia") referenceCost += cents(item.costTotalSnapshot);
    else missingCosts++;
  }
  const creditNotes = (source.billingCreditNotes || []).filter(row => authorizedProduction(row) && inReportPeriod(row.date, from, to));
  const debitNotes = (source.billingDebitNotes || []).filter(row => authorizedProduction(row) && inReportPeriod(row.date, from, to));
  const netSales = sales.reduce((sum, row) => sum + reportNet(row), 0) - creditNotes.reduce((sum, row) => sum + reportNet(row), 0) + debitNotes.reduce((sum, row) => sum + reportNet(row), 0);
  const opex = expenses.reduce((sum, row) => sum + cents(row.amount), 0);
  // Purchases of inventory are assets; only non-stock purchases enter this estimate directly.
  const receipts = (source.inventoryKardex || []).filter(row => row.type === "PURCHASE_RECEIPT");
  const stockPurchases = new Set(receipts.map(row => row.referenceId));
  const stockLines = new Set(receipts.map(row => `${row.referenceId}/${row.productId}`));
  const nonStock = purchases.filter(row => row.inventoryStatus === "no_aplica");
  const unknownPurchases = purchases.filter(row => !stockPurchases.has(row.id) && row.inventoryStatus !== "no_aplica").length;
  let directPurchaseCost = nonStock.reduce((sum, row) => sum + reportNet(row), 0);
  for (const purchase of purchases.filter(row => stockPurchases.has(row.id))) {
    directPurchaseCost += (purchase.items || []).filter((item: Row) => !stockLines.has(`${purchase.id}/${item.productId}`)).reduce((sum: number, item: Row) => sum + reportNet({ items: [item] }), 0);
  }
  const directPurchaseIds = new Set((source.purchaseInvoices || []).filter(row => row.inventoryStatus === "no_aplica").map(row => row.id));
  for (const [notes, sign] of [[source.supplierCreditNotes || [], -1], [source.supplierDebitNotes || [], 1]] as const) {
    directPurchaseCost += notes.filter(row => active(row) && directPurchaseIds.has(row.purchaseInvoiceId) && inReportPeriod(row.date || row.createdAt, from, to)).reduce((sum, row) => {
      const purchase = (source.purchaseInvoices || []).find(item => item.id === row.purchaseInvoiceId)!;
      const net = row.subtotal !== undefined || row.items?.length ? reportNet(row) : Math.round(cents(row.amount ?? row.total ?? 0) * (Number(purchase.total) ? reportNet(purchase) / cents(purchase.total) : 1));
      return sum + sign * net;
    }, 0);
  }
  const duplicateExpenses = expenses.filter(expense => expense.invoiceNumber && purchases.some(purchase => purchase.documentNumber === expense.invoiceNumber &&
    (purchase.supplierId === expense.supplierId || expense.supplierRuc && purchase.supplierRuc === expense.supplierRuc))).length;
  const currentReceivables = reportCharges(source).reduce((sum, row) => sum + chargeBalance(row), 0);
  const currentPayables = (source.purchaseInvoices || []).filter(active).reduce((sum, row) => sum + cents(purchaseBalance(row)), 0);
  const banks = (source.bankAccounts || []).map<Row & { current: number; opening: number; closing: number }>(bank => {
    const after = (date: string, inclusive: boolean) => movements.filter(row => {
      const day = String(row.date || "").slice(0, 10);
      return row.bankAccountId === bank.id && validDate(day) && (inclusive ? day >= date : day > date);
    })
      .reduce((sum, row) => sum + (row.type === "ingreso" ? cents(row.amount) : -cents(row.amount)), 0);
    const createdAt = String(bank.createdAt || "");
    const created = createdAt.includes("T") ? Number.isFinite(Date.parse(createdAt)) ? getEcuadorDate(createdAt) : "" : validDate(createdAt) ? createdAt : "";
    const notOpenAtStart = Boolean(to && created && created > to || from && created && created >= from);
    return { ...bank, current: Number(bank.currentBalance || 0), opening: notOpenAtStart ? 0 : from ? money(cents(bank.currentBalance || 0) - after(from, true)) : Number(bank.initialBalance || 0),
      closing: to && created && created > to ? 0 : to ? money(cents(bank.currentBalance || 0) - after(to, false)) : Number(bank.currentBalance || 0) };
  });
  const undatedBankMovements = movements.filter(row => row.bankAccountId && !validDate(String(row.date || "").slice(0, 10))).length;
  return { sales, purchases, expenses, movements: cash, banks, creditNotes, debitNotes, missingCosts, unknownPurchases, duplicateExpenses, undatedBankMovements, needsExpenseReview: referenceCost > 0 && opex + directPurchaseCost === 0,
    netSales: money(netSales), saleTotal: money(sales.reduce((sum, row) => sum + cents(row.total), 0)), cost: money(cost), referenceCost: money(referenceCost), opex: money(opex), directPurchaseCost: money(directPurchaseCost),
    purchaseTotal: money(purchases.reduce((sum, row) => sum + cents(row.total), 0)), operatingResult: money(netSales - cost - opex - directPurchaseCost),
    incoming: money(incoming), outgoing: money(outgoing), cashFlow: money(incoming - outgoing),
    advancesReceived: money(cash.filter(row => row.category === "anticipo_cliente" && row.type === "ingreso").reduce((sum, row) => sum + cents(row.amount), 0)),
    receivables: money(currentReceivables), payables: money(currentPayables), availableCredit: money((source.clientAdvances || []).filter(row => active(row)).reduce((sum, row) => sum + cents(row.remaining || 0), 0)),
    liquidity: money(banks.reduce((sum, bank) => sum + cents(bank.current), 0)) };
}
