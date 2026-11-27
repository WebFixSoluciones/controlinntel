"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { isUnusedAdvance } from "@/lib/client-credit";
import { safeNumber } from "@/lib/print-service";
import type { ClientAdvance, FinancialMovement } from "@/types";

export function AdvanceDetailsDialog({ advance, source, originNumber, status, onClose, onVoid }: {
  advance: ClientAdvance;
  source?: FinancialMovement;
  originNumber?: string;
  status: string;
  onClose: () => void;
  onVoid?: (reason: string) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const applications = advance.applications || [];
  const active = advance.status !== "anulado" && !advance.deletedAt;
  const account = source?.bankAccountName || advance.bankAccountName;
  const title = onVoid ? "Anular anticipo" : "Detalle del anticipo";

  useEffect(() => {
    const modal = dialog.current;
    modal?.showModal();
    return () => modal?.close();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!onVoid || pending.current || !source || !isUnusedAdvance(advance) || reason.trim().length < 3) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await onVoid(reason.trim());
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No se pudo anular el anticipo.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  const details = [
    ["Fecha del anticipo", advance.date],
    ["Estado", status],
    ["Importe registrado", `$${safeNumber(advance.amount)}`],
    ["Saldo disponible", `$${safeNumber(advance.remaining)}`],
    ["Forma de pago", source?.paymentMethod || advance.method],
    ["Cuenta de recepción", account],
    ["Comprobante del pago", source?.referenceNumber ?? advance.reference],
    ...(originNumber ? [["Cobro de origen", originNumber], ["Fecha del ingreso original", source?.date]] : []),
    ...(advance.refundedAmount ? [["Importe devuelto", `$${safeNumber(advance.refundedAmount)}`]] : []),
  ];

  return <dialog ref={dialog} aria-labelledby="advance-details-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
    className="m-auto max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-xl overflow-y-auto rounded-xl p-0 text-slate-800 shadow-xl backdrop:bg-slate-900/50">
    <form onSubmit={submit}>
      <header className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 p-4">
        <div>
          <h2 id="advance-details-title" className="text-base font-semibold">{title}</h2>
          <p className="ui-emphasis mt-1 text-xs text-slate-600">{advance.clientName} · {advance.clientRuc}</p>
        </div>
        <button type="button" aria-label="Cerrar" disabled={busy} onClick={onClose} className="rounded-md p-1.5 hover:bg-slate-200">
          <X aria-hidden="true" className="size-4" />
        </button>
      </header>
      <div className="space-y-4 p-4 text-xs">
        <dl className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
          {details.map(([label, value]) => <div key={label}><dt className="text-slate-500">{label}</dt>
            <dd className="mt-0.5 break-words font-semibold">{value || "—"}</dd></div>)}
          {advance.notes && <div className="sm:col-span-2"><dt className="text-slate-500">Notas</dt><dd className="break-words">{advance.notes}</dd></div>}
          {advance.correctionReason && <div className="sm:col-span-2"><dt className="text-slate-500">Último motivo de ajuste</dt><dd className="break-words">{advance.correctionReason}</dd></div>}
        </dl>
        {applications.length > 0 && <div className="space-y-1.5">
          <h3 className="font-semibold">Aplicaciones a comprobantes</h3>
          <ul className="divide-y divide-slate-100">
            {applications.map((item, index) => <li key={item.id || index} className="flex flex-wrap justify-between gap-2 py-1.5">
              <span>{item.invoiceNumber || "Comprobante vinculado"} · {item.date}</span>
              <span>${safeNumber(item.amount)} · {item.status === "reversed" ? "Revertida" : "Aplicada"}</span>
            </li>)}
          </ul>
        </div>}
        {onVoid ? <>
          <p className="rounded-lg bg-amber-50 p-3 text-amber-900">
            Se restarán <strong>${safeNumber(advance.amount)}</strong> de {account || "la cuenta de recepción"} y el saldo disponible quedará en $0.00. La anulación quedará en el historial.
          </p>
          <label className="block font-medium">Motivo de la anulación
            <textarea rows={2} required minLength={3} maxLength={500} value={reason} disabled={busy} onChange={event => setReason(event.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 p-2 text-sm" />
          </label>
        </> : active && !source ? <p className="text-amber-900">El ingreso de origen requiere conciliación antes de modificar este anticipo.</p>
          : active && !isUnusedAdvance(advance) ? <p className="text-slate-600">Revisa las aplicaciones o devoluciones antes de anular este anticipo.</p> : null}
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-rose-700">{error}</p>}
      </div>
      <footer className="flex justify-end gap-2 border-t border-slate-200 p-4 text-xs font-semibold">
        <button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2">{onVoid ? "Cancelar" : "Cerrar"}</button>
        {onVoid && <button type="submit" disabled={busy || reason.trim().length < 3} className="rounded-lg bg-rose-700 px-4 py-2 text-white disabled:opacity-50">
          {busy ? "Anulando…" : "Confirmar anulación"}
        </button>}
      </footer>
    </form>
  </dialog>;
}
