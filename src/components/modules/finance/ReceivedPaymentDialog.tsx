"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { getEcuadorDate } from "@/lib/date-utils";
import { type ReceivedPayment } from "@/lib/payment-report";
import { canUser } from "@/lib/permissions";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";

export type ReceivedPaymentDialogMode = "view" | "edit" | "void";

const input = "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100";
const methods = ["Transferencia Bancaria", "Depósito Bancario", "Efectivo", "Cheque", "Tarjeta de Crédito / Débito"];
const usd = (amount: number) => `$${amount.toFixed(2)}`;

export function ReceivedPaymentDialog({ row, mode, duplicateCount, onClose }: { row: ReceivedPayment; mode: ReceivedPaymentDialogMode; duplicateCount: number; onClose: () => void }) {
  const { currentUser, bankAccounts, correctReceivedPayment } = useApp();
  const { showSuccess } = useToast();
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(row.date);
  const [amount, setAmount] = useState(String(row.amount));
  const [method, setMethod] = useState(row.method || methods[0]);
  const [accountId, setAccountId] = useState(row.accountId);
  const [reference, setReference] = useState(row.reference);
  const correction = row.correction;
  const metadataOnly = correction?.kind === "released";
  const canReverseMoney = canUser(currentUser, "finanzas", "canCancelPayments");
  const isCash = /^efectivo$/i.test(method);
  const accounts = bankAccounts.filter(account => account.id === row.accountId || account.status === "activa" && (account.accountType === "caja_efectivo") === isCash);
  const targetAccount = accounts.find(account => account.id === accountId);
  const minimum = Math.max(0.01, correction?.minimumAmount ?? 0, canReverseMoney ? 0 : row.amount);
  const maximum = correction?.pendingBalance === undefined ? undefined : Math.round((row.amount + correction.pendingBalance) * 100) / 100;
  const nextAmount = mode === "void" ? 0 : amount ? Number(amount) : row.amount;
  const difference = nextAmount - row.amount;
  const title = mode === "view" ? "Detalle del pago" : mode === "void" ? "Anular cobro" : "Editar cobro";

  useEffect(() => {
    const modal = dialog.current;
    modal?.showModal();
    return () => modal?.close();
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || !correction || mode === "view" || mode === "void" && !correction.canVoid) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await correctReceivedPayment(mode === "void" ? "voidReceivedPayment" : "editReceivedPayment", {
        movementId: row.movementId, expectedVersion: correction.movementVersion, expectedOriginVersion: correction.originVersion, reason: reason.trim(),
        ...(mode === "edit" ? { date, amount: nextAmount, bankAccountId: accountId, method, reference } : {}),
      });
      showSuccess(mode === "void" ? "Cobro anulado" : "Cobro ajustado", "El cambio quedó registrado en el historial.");
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No se pudo completar el ajuste.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return <dialog ref={dialog} aria-labelledby="received-payment-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
    className="m-auto max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-2xl overflow-y-auto rounded-xl p-0 text-slate-800 shadow-xl backdrop:bg-slate-900/50">
    <form onSubmit={save}>
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 p-4">
        <div><h2 id="received-payment-title" className="text-base font-semibold">{title}</h2><p className="mt-1 text-xs text-slate-600">{row.client || row.kind} · {usd(row.amount)}</p></div>
        <button type="button" aria-label="Cerrar" onClick={onClose} disabled={busy} className="rounded-md p-1.5 hover:bg-slate-200"><X aria-hidden="true" className="size-4" /></button>
      </header>
      <div className="space-y-4 p-4 text-sm">
        <dl className="grid gap-x-5 gap-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs sm:grid-cols-2">
          {[["Comprobante del pago", row.reference], ["Fecha del pago", row.date], ["Cuenta de recepción", row.account], ["Forma de pago", row.method],
            ["Comprobante de origen", row.originDocument], ["Comprobantes aplicados", row.documents]].map(([label, value]) =>
            <div key={label}><dt className="text-slate-500">{label}</dt><dd className="mt-0.5 break-words font-medium">{value || "—"}</dd></div>)}
          {row.correctionReason && <div className="sm:col-span-2"><dt className="text-slate-500">Último motivo de ajuste</dt><dd className="mt-0.5 break-words font-medium">{row.correctionReason}</dd></div>}
        </dl>
        {duplicateCount > 1 && <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-900">Esta referencia aparece en {duplicateCount} ingresos de la misma cuenta. El ajuste se aplica solo a este registro.</p>}
        {mode === "view" && <p className="text-xs text-slate-600">{!correction ? "El vínculo del cobro requiere revisión antes de hacer ajustes." : metadataOnly ? "El abono se desaplicó. Puedes corregir la fecha o la referencia del ingreso." : !correction.canVoid ? "El anticipo tiene aplicaciones o devoluciones registradas. Revisa esos movimientos antes de anularlo." : "Ingreso vinculado al registro financiero."}</p>}
        {mode === "edit" && <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium">Fecha del pago<input type="date" required max={getEcuadorDate()} className={input} value={date} onChange={event => setDate(event.target.value)} /></label>
          <label className="text-xs font-medium">N.º de comprobante del pago<input maxLength={200} className={input} value={reference} onChange={event => setReference(event.target.value)} /></label>
          {!metadataOnly && <>
            <label className="text-xs font-medium">Importe recibido<input type="number" required min={minimum} max={maximum} step="0.01" className={input} value={amount} onChange={event => setAmount(event.target.value)} /></label>
            <label className="text-xs font-medium">Forma de pago<select required className={input} value={method} onChange={event => setMethod(event.target.value)}>
              {[...new Set([method, row.method, ...methods])].filter(Boolean).map(item => <option key={item}>{item}</option>)}
            </select></label>
            <label className="text-xs font-medium sm:col-span-2">Cuenta de recepción<select required disabled={!canReverseMoney} className={input} value={accountId} onChange={event => setAccountId(event.target.value)}>
              {!accounts.some(account => account.id === row.accountId) && <option value={row.accountId}>{row.account || "Cuenta original"}</option>}
              {accounts.map(account => <option key={account.id} value={account.id}>{account.bankName} · {account.accountNumber?.slice(-4)}</option>)}
            </select></label>
          </>}
        </fieldset>}
        {mode !== "view" && <>
          <div aria-live="polite" className={`space-y-1 rounded-lg p-3 text-xs ${mode === "void" ? "bg-amber-50 text-amber-900" : "bg-blue-50 text-blue-900"}`}>
            {mode === "void" ? <p>Se restarán <strong>{usd(row.amount)}</strong> de {row.account || "la cuenta de recepción"}. El registro quedará anulado en el historial.</p>
              : accountId !== row.accountId ? <p>Se restarán {usd(row.amount)} de la cuenta original y se sumarán {usd(nextAmount)} a {targetAccount?.bankName || "la cuenta elegida"}.</p>
                : difference ? <p>El saldo de la cuenta {difference > 0 ? "aumentará" : "disminuirá"} {usd(Math.abs(difference))}.</p>
                  : <p>El ajuste conserva los saldos.</p>}
            {correction?.pendingBalance !== undefined && (mode === "void" || difference !== 0) && <p>Saldo pendiente del comprobante tras el ajuste <strong>{usd(Math.max(0, correction.pendingBalance - difference))}</strong></p>}
            {correction?.creditRemaining !== undefined && (mode === "void" || difference !== 0) && <p>Saldo a favor tras el ajuste <strong>{usd(Math.max(0, correction.creditRemaining + difference))}</strong></p>}
          </div>
          <label className="block text-xs font-medium">Motivo del {mode === "void" ? "registro erróneo" : "ajuste"}<textarea required minLength={3} maxLength={500} rows={2} disabled={busy} className={input} value={reason} onChange={event => setReason(event.target.value)} /></label>
        </>}
        {error && <p role="alert" className="rounded-md bg-rose-50 p-2 text-xs text-rose-700">{error}</p>}
      </div>
      <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200 p-4 text-xs font-semibold">
        <button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2">{mode === "view" ? "Cerrar" : "Cancelar"}</button>
        {mode !== "view" && <button type="submit" disabled={busy || reason.trim().length < 3} className={`rounded-lg px-4 py-2 text-white disabled:opacity-50 ${mode === "void" ? "bg-rose-700" : "bg-[#004ac6]"}`}>
          {busy ? "Guardando…" : mode === "void" ? "Confirmar anulación" : "Guardar ajuste"}
        </button>}
      </footer>
    </form>
  </dialog>;
}
