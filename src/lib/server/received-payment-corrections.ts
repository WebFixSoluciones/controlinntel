import { cents, chargeBalance, money, validDate, type RecordData as Row } from "../commercial-core.ts";
import { canUser } from "../permissions.ts";
import type { Context } from "./commercial.ts";
import { HttpError } from "./security.ts";

export function assertReceiptVersion(row: Row, expected: unknown) {
  if (!Number.isInteger(expected)) throw new HttpError(400, "Falta la versión del cobro. Actualiza el reporte.");
  if (expected !== Number(row.version || 0)) throw new HttpError(409, "El cobro o sus aplicaciones cambiaron. Actualiza el reporte antes de continuar.");
}

export function receiptChange(c: Context, movement: Row, data: Row) {
  const { date, bankAccountId } = data;
  const amount = cents(data.amount);
  const method = typeof data.method === "string" ? data.method.trim().slice(0, 100) : "";
  if (!validDate(date) || date > c.today) throw new HttpError(400, "Ingresa una fecha válida que no sea futura.");
  if (amount <= 0) throw new HttpError(400, "El importe debe ser mayor que cero.");
  if (typeof bankAccountId !== "string" || !bankAccountId || !method) throw new HttpError(400, "Selecciona la cuenta y la forma de pago.");
  if ((bankAccountId !== movement.bankAccountId || amount < cents(movement.amount)) && !canUser(c.user, "finanzas", "canCancelPayments")) {
    throw new HttpError(403, "No tienes permiso para revertir importes recibidos.");
  }
  const reference = typeof data.reference === "string" ? data.reference.trim().slice(0, 200) : "";
  return { date, bankAccountId, amount: money(amount), method, reference };
}

export async function verifyReceiptAccount(c: Context, movement: Row, change: ReturnType<typeof receiptChange>) {
  if (change.method === movement.paymentMethod && change.bankAccountId === movement.bankAccountId) return;
  const account = await c.get("bankAccounts", change.bankAccountId);
  if (account.status !== "activa") throw new HttpError(400, "Selecciona una cuenta activa.");
  if ((account.accountType === "caja_efectivo") !== /^efectivo$/i.test(change.method)) {
    throw new HttpError(400, "Selecciona una caja para efectivo o una cuenta bancaria para los otros métodos.");
  }
}

export async function correctDirectReceipt(c: Context, movement: Row, data: Row, voiding: boolean, audit: Row) {
  if (typeof movement.chargeId !== "string" || typeof movement.relatedEntityId !== "string") {
    throw new HttpError(409, "El cobro no tiene un vínculo verificable con la cartera.");
  }
  const charge = await c.get("monthlyCharges", movement.chargeId);
  assertReceiptVersion(charge, data.expectedOriginVersion);

  const paymentId = movement.relatedEntityId;
  const matches = (charge.payments || []).filter((row: Row) => row.id === paymentId && row.movementId === movement.id);
  const embedded = matches[0];
  const payment = await c.get("payments", paymentId, false);
  const application = await c.get("paymentApplications", paymentId, false);
  const oldAmount = cents(movement.amount);
  const released = embedded?.status === "reversed";
  if (matches.length !== 1 || embedded.advanceId || embedded.bankAccountId !== movement.bankAccountId || cents(embedded.amount) !== oldAmount ||
    payment.status !== "confirmed" || payment.movementId !== movement.id || payment.bankAccountId !== movement.bankAccountId ||
    payment.clientId !== charge.clientId || cents(payment.amount) !== oldAmount || application.paymentId !== paymentId ||
    application.chargeId !== charge.id || application.clientId !== charge.clientId || cents(application.amount) !== oldAmount ||
    application.status !== (released ? "reversed" : "applied") || !released && charge.status === "anulado") {
    throw new HttpError(409, "El vínculo entre el movimiento, el abono y la cartera requiere conciliación.");
  }

  const change = voiding ? null : receiptChange(c, movement, data);
  const newAmount = change ? cents(change.amount) : 0;
  const accountId = change?.bankAccountId ?? movement.bankAccountId;
  const changesAccount = accountId !== movement.bankAccountId;
  const changesAmount = newAmount !== oldAmount;

  if (released) {
    const credit = await c.get("clientAdvances", `released-${paymentId}`, false);
    if (voiding || changesAmount || changesAccount || change?.method !== movement.paymentMethod ||
      credit.sourcePaymentId !== paymentId || credit.sourceChargeId !== charge.id || credit.clientId !== charge.clientId) {
      throw new HttpError(409, "Este cobro ya se desaplicó. Solo puedes corregir su fecha o referencia con el crédito de origen vinculado.");
    }
    if (change && change.date !== movement.date && credit.date && change.date > credit.date) {
      throw new HttpError(400, "La fecha del ingreso no puede ser posterior a la liberación del saldo a favor.");
    }
  }

  const totals: Row = {};
  if (changesAmount) {
    const total = cents(charge.total);
    const paid = cents(charge.paidAmount ?? (charge.status === "pagado" ? charge.total : 0));
    const recorded = charge.payments.filter((row: Row) => row.status !== "reversed").reduce((sum: number, row: Row) => sum + cents(row.amount), 0);
    if (recorded !== paid || paid < oldAmount || total - paid !== chargeBalance(charge)) {
      throw new HttpError(409, "El historial y el saldo de la cartera requieren conciliación.");
    }
    const adjustedPaid = paid - oldAmount + newAmount;
    if (adjustedPaid > total) throw new HttpError(409, "El importe supera el saldo disponible en este comprobante.");
    totals.paidAmount = money(adjustedPaid);
    totals.balanceRemaining = money(total - adjustedPaid);
    totals.status = adjustedPaid === total ? "pagado" : adjustedPaid > 0 ? "parcial" : "pendiente";
  }

  if (change) await verifyReceiptAccount(c, movement, change);
  let accountName = movement.bankAccountName;
  if (changesAccount || changesAmount) {
    const source = await c.get("bankAccounts", movement.bankAccountId);
    const target = changesAccount ? await c.get("bankAccounts", accountId) : source;
    if (!voiding && target.status !== "activa") throw new HttpError(400, "Selecciona una cuenta activa para corregir el importe.");
    const sourceBalance = cents(source.currentBalance) - oldAmount + (changesAccount ? 0 : newAmount);
    if ((changesAccount || newAmount < oldAmount) && sourceBalance < 0 && !source.allowOverdraft) {
      throw new HttpError(409, "Saldo insuficiente en la cuenta de origen para revertir el ingreso.");
    }
    c.put("bankAccounts", { ...source, currentBalance: money(sourceBalance) });
    if (changesAccount) c.put("bankAccounts", { ...target, currentBalance: money(cents(target.currentBalance) + newAmount) });
    accountName = target.bankName;
  }

  const patch = change ? { ...change, bankAccountName: accountName } : { status: "reversed", reversedAt: audit.correctedAt, voidedAt: audit.correctedAt };
  const payments = charge.payments.map((row: Row) => row.id === paymentId ? { ...row, ...patch } : row);
  const paymentDate = !released && (voiding || change?.date !== movement.date)
    ? payments.filter((row: Row) => row.status !== "reversed" && validDate(row.date)).map((row: Row) => row.date).sort().at(-1)
    : charge.paymentDate;

  c.put("monthlyCharges", { ...charge, ...totals, payments, paymentDate });
  c.put("payments", { ...payment, ...patch, ...audit });
  if (!released && (changesAmount || change?.date !== movement.date)) {
    c.put("paymentApplications", { ...application, ...(voiding ? { status: "reversed", reversedAt: audit.correctedAt } : { amount: change?.amount, date: change?.date }) });
  }
  c.put("financialMovements", { ...movement, ...audit,
    ...(change ? { amount: change.amount, date: change.date, bankAccountId: accountId, bankAccountName: accountName,
      paymentMethod: change.method, referenceNumber: change.reference }
      : { status: "anulado", cancelledAt: audit.correctedAt, cancelledBy: audit.correctedBy }) });
  if (changesAmount) await c.clientBalance(charge.clientId);
}
