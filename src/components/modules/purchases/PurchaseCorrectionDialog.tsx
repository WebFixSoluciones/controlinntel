"use client";

import React, { useState } from "react";
import { X, Plus, Trash2, AlertTriangle } from "lucide-react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { calculateLines } from "@/lib/commercial-core";
import type { PurchaseInvoice, PurchaseItem } from "@/types";

export function PurchaseCorrectionDialog({ invoice, mode, onClose }: { invoice: PurchaseInvoice; mode: "edit" | "delete"; onClose: () => void }) {
  const { suppliers, supplierPayments, supplierCreditNotes, supplierDebitNotes, purchaseWithholdings, updatePurchaseInvoice, deletePurchaseInvoice } = useApp();
  const { showSuccess, showError } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [supplierId, setSupplierId] = useState(invoice.supplierId);
  const [documentNumber, setDocumentNumber] = useState(invoice.documentNumber);
  const [date, setDate] = useState(invoice.date);
  const [dueDate, setDueDate] = useState(invoice.dueDate || "");
  const [notes, setNotes] = useState(invoice.notes || "");
  const [items, setItems] = useState<PurchaseItem[]>(invoice.items.map(item => ({ ...item })));
  const locked = Boolean(invoice.xmlContent || invoice.claveAcceso || invoice.paidAmount > 0 || invoice.inventoryStatus === "ingresado"
    || supplierPayments.some(row => row.purchaseInvoiceId === invoice.id)
    || [...supplierCreditNotes, ...supplierDebitNotes, ...purchaseWithholdings].some(row => row.purchaseInvoiceId === invoice.id));
  const removing = mode === "delete";
  let total: number | undefined;
  try { total = calculateLines(items.map(item => ({ ...item, unitPrice: item.unitCost }))).total; } catch { /* Validation shown on submit. */ }
  const field = "mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm disabled:bg-slate-100 disabled:text-slate-500";
  const updateItem = (index: number, changes: Partial<PurchaseItem>) => setItems(previous => previous.map((item, i) => i === index ? { ...item, ...changes } : item));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      if (removing) {
        await deletePurchaseInvoice(invoice.id, reason.trim(), invoice.version || 0);
        showSuccess("Compra eliminada", `La factura ${invoice.documentNumber} se retiró de las compras activas.`);
      } else {
        await updatePurchaseInvoice(invoice.id, { notes: notes.trim(), dueDate,
          ...(!locked ? { supplierId, documentNumber: documentNumber.trim(), date, items } : {}) }, invoice.version || 0);
        showSuccess("Compra actualizada", `Los cambios de ${documentNumber} se guardaron correctamente.`);
      }
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo guardar la operación.";
      setError(message); showError(removing ? "No se pudo eliminar" : "No se pudo editar", message);
    } finally { setBusy(false); }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
    <form role="dialog" aria-modal="true" aria-labelledby="purchase-correction-title" onSubmit={submit} className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
      <div className="flex items-start justify-between border-b border-slate-200 p-5">
        <div><h2 id="purchase-correction-title" className="text-lg font-bold text-slate-900">{removing ? "Eliminar compra" : "Editar compra"}</h2>
          <p className="mt-1 text-sm text-slate-600">{invoice.documentNumber} · {invoice.supplierName}</p></div>
        <button type="button" aria-label="Cerrar" disabled={busy} onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button>
      </div>
      <div className="space-y-5 overflow-y-auto p-5">
        {removing ? <>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4" />Se retirará esta factura del listado activo.</p>
            <p className="mt-2">Total: <strong className="ui-emphasis">${invoice.total.toFixed(2)}</strong> · Fecha: {invoice.date} · RUC: {invoice.supplierRuc}</p>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li>Se cancelará el saldo pendiente de ${invoice.balanceRemaining.toFixed(2)}.</li>
              {invoice.paidAmount > 0 && <li>Se revertirán los pagos registrados por ${invoice.paidAmount.toFixed(2)} en sus cuentas o saldos de proveedor de origen.</li>}
              {invoice.inventoryStatus === "ingresado" && <li>Se revertirá la recepción si el inventario conserva trazabilidad y no tiene movimientos posteriores.</li>}
              <li>Se conservará la factura con el motivo, la fecha y el responsable de la eliminación.</li>
            </ul>
            <p className="mt-3">Esta acción corrige el registro interno. No anula el comprobante del proveedor ante el SRI ni ejecuta transferencias bancarias.</p>
          </div>
          <label className="block text-sm font-medium text-slate-700">Motivo de eliminación
            <textarea autoFocus required minLength={3} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} className={field} rows={3} placeholder="Ej. Factura ingresada para pruebas" />
          </label>
        </> : <>
          {locked && <p role="note" className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">Esta compra tiene XML, pagos, inventario o documentos vinculados. Puedes corregir las notas y el vencimiento; los datos e importes asentados están protegidos.</p>}
          <fieldset disabled={locked || busy} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="text-sm font-medium text-slate-700">Proveedor<select required value={supplierId} onChange={event => setSupplierId(event.target.value)} className={field}>
                {suppliers.filter(row => row.status === "activo" || row.id === invoice.supplierId).map(row => <option key={row.id} value={row.id}>{row.razonSocial}</option>)}
              </select></label>
              <label className="text-sm font-medium text-slate-700">N.º comprobante<input required pattern="[0-9]{3}-[0-9]{3}-[0-9]{9}" value={documentNumber} onChange={event => setDocumentNumber(event.target.value)} className={field} /></label>
              <label className="text-sm font-medium text-slate-700">Fecha de compra<input type="date" required value={date} onChange={event => setDate(event.target.value)} className={field} /></label>
            </div>
            <div className="space-y-3">
              {items.map((item, index) => <div key={item.id || index} className="grid grid-cols-2 items-end gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-12">
                <label className="col-span-2 text-xs font-medium sm:col-span-4">Descripción<input aria-label={`Descripción ${index + 1}`} required value={item.name} onChange={event => updateItem(index, { name: event.target.value })} className={field} /></label>
                <label className="text-xs font-medium sm:col-span-2">Cantidad<input aria-label={`Cantidad ${index + 1}`} type="number" required min="0.000001" step="any" value={item.quantity} onChange={event => updateItem(index, { quantity: Number(event.target.value) })} className={field} /></label>
                <label className="text-xs font-medium sm:col-span-2">Costo unitario<input aria-label={`Costo unitario ${index + 1}`} type="number" required min="0" step="any" value={item.unitCost} onChange={event => updateItem(index, { unitCost: Number(event.target.value) })} className={field} /></label>
                <label className="text-xs font-medium sm:col-span-2">Descuento ($)<input aria-label={`Descuento ${index + 1}`} type="number" min="0" step="0.01" value={item.discount || 0} onChange={event => updateItem(index, { discount: Number(event.target.value) })} className={field} /></label>
                <label className="text-xs font-medium">IVA (%)<input aria-label={`IVA ${index + 1}`} type="number" required min="0" max="100" step="any" value={item.ivaRate} onChange={event => updateItem(index, { ivaRate: Number(event.target.value) })} className={field} /></label>
                <button type="button" aria-label={`Quitar partida ${index + 1}`} onClick={() => setItems(previous => previous.filter((_, i) => i !== index))} className="p-2 text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>)}
              {!locked && <button type="button" className="flex items-center gap-1 text-sm font-semibold text-blue-700" onClick={() => setItems(previous => [...previous, { id: crypto.randomUUID(), name: "", quantity: 1, unitCost: 0, discount: 0, ivaRate: 15, subtotal: 0, ivaAmount: 0, total: 0, warehouseId: "" }])}><Plus className="h-4 w-4" />Agregar partida</button>}
              <p className="ui-emphasis text-right text-sm font-bold">Total: {total === undefined ? "Revisa las partidas" : `$${total.toFixed(2)}`}</p>
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">Vencimiento<input type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} className={field} disabled={busy} /></label>
            <p className="self-center text-xs text-slate-500">Los pagos se administran desde Cuentas por pagar.</p>
          </div>
          <label className="block text-sm font-medium text-slate-700">Notas<textarea maxLength={2000} value={notes} onChange={event => setNotes(event.target.value)} className={field} rows={3} disabled={busy} /></label>
        </>}
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </div>
      <div className="flex justify-end gap-3 border-t border-slate-200 p-4">
        <button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancelar</button>
        <button type="submit" disabled={busy || removing && reason.trim().length < 3 || !removing && !locked && total === undefined} className={`rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-50 ${removing ? "bg-red-600 hover:bg-red-700" : "bg-blue-700 hover:bg-blue-800"}`}>{busy ? "Guardando…" : removing ? "Confirmar eliminación" : "Guardar cambios"}</button>
      </div>
    </form>
  </div>;
}
