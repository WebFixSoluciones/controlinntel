"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { CreditCard, X } from "lucide-react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { chargeBalance, money } from "@/lib/commercial-core";
import { getEcuadorDate } from "@/lib/date-utils";
import { safeNumber } from "@/lib/print-service";
import type { MonthlyCharge } from "@/types";
import { availableClientCredit, allocateClientCredit } from "@/lib/client-credit";

const methods = ["Transferencia Bancaria", "Depósito Bancario", "Efectivo", "Cheque", "Tarjeta de Crédito / Débito"];
const preferredMethod: Record<string, string> = {
  transferencia: methods[0], efectivo: "Efectivo", tarjeta: "Tarjeta de Crédito / Débito",
};
const field = "mt-1 block w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";

export function ChargePaymentModal({ charge, onClose }: { charge: MonthlyCharge; onClose: () => void }) {
  const { monthlyCharges, bankAccounts, clientAdvances, addPaymentToCharge, applyClientCredit } = useApp();
  const { showSuccess } = useToast();
  const titleId = useId();
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const current = monthlyCharges.find(item => item.id === charge.id) || charge;
  const balance = money(chargeBalance(current));
  const [amount, setAmount] = useState(String(balance));
  const [method, setMethod] = useState(preferredMethod[charge.expectedPaymentMethod || ""] || methods[0]);
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(getEcuadorDate);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [source, setSource] = useState<"new" | "advance">("new");
  const credit = availableClientCredit(clientAdvances, charge.clientId);
  const [creditAmount, setCreditAmount] = useState(() => String(Math.min(balance, credit.total)));
  const cash = method === "Efectivo";
  const accounts = bankAccounts.filter(account => account.status === "activa" && (account.accountType === "caja_efectivo") === cash);
  const paymentAmount = Number(source === "advance" ? creditAmount : amount);
  let applications: { advanceId: string; amount: number }[] = [];
  if (source === "advance" && paymentAmount > 0 && paymentAmount <= credit.total) applications = allocateClientCredit(clientAdvances, charge.clientId, paymentAmount);

  async function register(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (pending.current) return;
    const useAdvance = source === "advance";
    const payment = paymentAmount;
    if (!Number.isFinite(payment) || payment <= 0 || payment > balance) {
      setError("Ingresa un importe mayor que cero y que no supere el saldo pendiente.");
      return;
    }
    if (useAdvance && payment > credit.total) {
      setError("El importe supera el saldo a favor disponible. Revisa los anticipos del cliente.");
      return;
    }
    if (!useAdvance && !accounts.some(account => account.id === accountId)) {
      setError(cash ? "Selecciona la caja que recibió el efectivo." : "Selecciona la cuenta bancaria que recibió el pago.");
      return;
    }
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      if (useAdvance) await applyClientCredit(charge.id, payment, date, notes.trim() || undefined);
      else await addPaymentToCharge(charge.id, { amount: payment, method, bankAccountId: accountId, date,
        reference: reference.trim() || undefined, notes: notes.trim() || undefined });
      showSuccess(useAdvance ? "Anticipo aplicado" : "Cobro registrado", `$${safeNumber(payment)} aplicados al comprobante ${charge.invoiceNumber}.`);
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No se pudo registrar el cobro.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-3 sm:p-4">
      <section role="dialog" aria-modal="true" aria-labelledby={titleId}
        className="w-full min-w-0 max-w-lg max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
        <header className="flex items-start justify-between gap-2 border-b border-slate-200 bg-slate-50 p-4">
          <div className="min-w-0">
            <h3 id={titleId} className="flex items-center gap-2 break-words text-sm font-bold"><CreditCard className="h-4 w-4 shrink-0 text-[#004ac6]" /> Registrar cobro</h3>
            <p className="mt-1 break-words text-xs text-slate-600">{charge.invoiceNumber} · {charge.clientName}</p>
          </div>
          <button type="button" aria-label="Cerrar" disabled={busy} onClick={onClose} className="rounded-lg p-2"><X className="h-4 w-4" /></button>
        </header>
        <form onSubmit={register} className="space-y-4 p-4 text-xs">
          <div className="grid grid-cols-2 gap-3 tabular-nums">
            <p className="rounded-lg border border-slate-200 bg-slate-50 p-3">Deuda de esta nota<strong className="mt-1 block text-sm text-amber-800">${safeNumber(balance)}</strong></p>
            <p className="rounded-lg border border-blue-200 bg-blue-50 p-3">Saldo a favor disponible<strong className="mt-1 block text-sm text-[#004ac6]">${safeNumber(credit.total)}</strong></p>
          </div>
          {current.notes && <p className="rounded-lg bg-slate-50 p-3 text-slate-600"><strong>Acuerdo de cobranza:</strong> {current.notes}</p>}
          <div className="flex flex-wrap gap-2" aria-label="Origen del cobro">
            <button type="button" disabled={busy} aria-pressed={source === "new"} onClick={() => { setSource("new"); setError(""); }} className={`rounded-lg border px-3 py-2 font-semibold ${source === "new" ? "border-[#004ac6] bg-blue-50 text-[#004ac6]" : "border-slate-200"}`}>Registrar un pago nuevo</button>
            <button type="button" disabled={busy || !credit.total || balance <= 0} aria-pressed={source === "advance"} onClick={() => { setSource("advance"); setError(""); }} className={`rounded-lg border px-3 py-2 font-semibold disabled:opacity-50 ${source === "advance" ? "border-[#004ac6] bg-blue-50 text-[#004ac6]" : "border-slate-200"}`}>Usar saldo a favor</button>
          </div>
          {credit.advances.length > 0 && <details className="rounded-lg border border-slate-200 p-3">
            <summary className="cursor-pointer font-semibold">Ver {credit.advances.length} anticipo(s) disponible(s)</summary>
            <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto">
              {credit.advances.map(advance => <li key={advance.id} className="flex flex-wrap justify-between gap-1 border-t border-slate-100 pt-2">
                <span>{advance.date} · {advance.reference || advance.notes || "Sin referencia"}</span>
                <span className="font-mono">${safeNumber(advance.remaining)}{applications.some(item => item.advanceId === advance.id) && <strong className="ml-2 text-[#004ac6]">Aplicar ${safeNumber(applications.find(item => item.advanceId === advance.id)?.amount)}</strong>}</span>
              </li>)}
            </ul>
          </details>}
          {source === "advance" && <p className="rounded-lg bg-blue-50 p-3 text-blue-900">Se usarán primero los anticipos más antiguos. La aplicación se guarda al confirmar y no genera otro ingreso bancario.</p>}
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <label className="min-w-0 font-semibold">{source === "advance" ? "Saldo a favor a aplicar ($)" : "Monto a cobrar ($)"}
              <input className={field} type="number" min="0.01" max={source === "advance" ? Math.min(balance, credit.total) : balance} step="0.01" required value={source === "advance" ? creditAmount : amount} onChange={event => source === "advance" ? setCreditAmount(event.target.value) : setAmount(event.target.value)} />
            </label>
            <label className="min-w-0 font-semibold">Fecha del cobro
              <input className={field} type="date" max={getEcuadorDate()} required value={date} onChange={event => setDate(event.target.value)} />
            </label>
            {source === "new" && <><label className="min-w-0 font-semibold">Forma de pago
              <select className={field} value={method} onChange={event => { setMethod(event.target.value); setAccountId(""); }}>
                {methods.map(option => <option key={option}>{option}</option>)}
              </select>
            </label>
            <label className="min-w-0 font-semibold">{cash ? "Caja de recepción" : "Cuenta bancaria de recepción"}
              <select className={field} required value={accountId} onChange={event => setAccountId(event.target.value)}>
                <option value="">Selecciona {cash ? "una caja" : "una cuenta"}</option>
                {accounts.map(account => <option key={account.id} value={account.id}>{account.bankName} · {account.accountNumber}</option>)}
              </select>
            </label></>}
          </div>
          {source === "new" && accounts.length === 0 && <p className="text-amber-800">Registra {cash ? "una caja" : "una cuenta bancaria"} activa en Finanzas → Bancos para recibir este pago.</p>}
          {source === "new" && <label className="block font-semibold">Referencia del pago (opcional)
            <input className={field} maxLength={200} value={reference} onChange={event => setReference(event.target.value)} />
          </label>}
          <label className="block font-semibold">Observaciones (opcional)
            <input className={field} maxLength={500} value={notes} onChange={event => setNotes(event.target.value)} />
          </label>
          <div aria-live="polite" className="rounded-lg border border-slate-200 p-3 tabular-nums">
            <p>Deuda restante después de confirmar: <strong>${safeNumber(Math.max(0, balance - (Number.isFinite(paymentAmount) ? paymentAmount : 0)))}</strong></p>
            {source === "advance" && <p className="mt-1">Saldo a favor restante: <strong>${safeNumber(Math.max(0, credit.total - (Number.isFinite(paymentAmount) ? paymentAmount : 0)))}</strong></p>}
          </div>
          {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-rose-700">{error}</p>}
          <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-3">
            <button type="button" disabled={busy} onClick={onClose} className="rounded-lg px-4 py-2 font-semibold">Cancelar</button>
            <button type="submit" disabled={busy || (source === "new" ? !accounts.length : !credit.total) || balance <= 0} className="rounded-lg bg-[#004ac6] px-4 py-2 font-semibold text-white disabled:opacity-50">
              {busy ? "Guardando…" : source === "advance" ? "Confirmar aplicación de anticipo" : "Confirmar cobro"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
