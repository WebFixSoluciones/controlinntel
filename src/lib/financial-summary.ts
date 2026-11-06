import { cents, money, chargeBalance, externalCash, type RecordData } from "./commercial-core.ts";

export function activeReceivables<T extends RecordData>(charges: T[]): T[] {
  return charges.filter(charge => charge.status !== "anulado");
}

/** Sale collections and physical cash are separate: cancellation releases credit, not cash. */
export function summarizeReceivables(charges: RecordData[]) {
  const active = activeReceivables(charges);
  const total = active.reduce((sum, charge) => sum + cents(charge.total), 0);
  const paid = active.reduce((sum, charge) => sum + cents(charge.paidAmount ?? (charge.status === "pagado" ? charge.total : 0)), 0);
  const pending = active.reduce((sum, charge) => sum + chargeBalance(charge), 0);
  return {
    totalFacturado: money(total),
    totalRecaudado: money(paid),
    totalPendiente: money(pending),
    tasaEfectividad: total > 0 ? paid / total * 100 : 0,
    pagadosCount: active.filter((charge) => charge.status === "pagado").length,
    pendientesCount: active.filter((charge) => chargeBalance(charge) > 0).length,
    anuladosCount: charges.length - active.length,
  };
}

export function summarizeOperatingExpenses(expenses: RecordData[]) {
  const byCategory: Record<string, number> = Object.create(null);
  let total = 0;
  for (const expense of expenses) {
    const category = expense.category || "otro";
    const amount = cents(expense.amount);
    byCategory[category] = (byCategory[category] || 0) + amount;
    total += amount;
  }
  return { total: money(total), byCategory: Object.fromEntries(Object.entries(byCategory).map(([category, amount]) => [category, money(amount)])) };
}

export function summarizeCash(movements: RecordData[]) {
  const external = externalCash(movements);
  const incoming = external.filter((row) => row.type === "ingreso").reduce((sum, row) => sum + cents(row.amount), 0);
  const outgoing = external.filter((row) => row.type === "egreso").reduce((sum, row) => sum + cents(row.amount), 0);
  const refunds = external.filter((row) => row.type === "egreso" && row.category === "devolucion_anticipo").reduce((sum, row) => sum + cents(row.amount), 0);
  return { totalIngresos: money(incoming), totalEgresos: money(outgoing), devoluciones: money(refunds), saldoNeto: money(incoming - outgoing) };
}
