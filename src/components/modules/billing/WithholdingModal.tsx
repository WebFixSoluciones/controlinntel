"use client";

import { useEffect, useState } from "react";
import { Percent, X } from "lucide-react";
import { useApp } from "@/lib/state";
import type { WithholdingReceipt } from "@/types";

interface WithholdingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPurchaseId?: string;
  correction?: WithholdingReceipt;
  onSuccess?: (document: WithholdingReceipt) => void;
}

const ivaCodes: Record<number, string> = { 10: "9", 20: "10", 30: "1", 50: "11", 70: "2", 100: "3" };
const field = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs";

export function WithholdingModal({ isOpen, onClose, initialPurchaseId, correction, onSuccess }: WithholdingModalProps) {
  const { purchaseInvoices, createWithholding } = useApp();
  const [purchaseId, setPurchaseId] = useState("");
  const [supportCode, setSupportCode] = useState("");
  const [relatedParty, setRelatedParty] = useState<"" | "si" | "no">("");
  const [paymentCode, setPaymentCode] = useState<"01" | "16" | "19" | "20">("20");
  const [rentaCode, setRentaCode] = useState("");
  const [rentaBase, setRentaBase] = useState("");
  const [rentaRate, setRentaRate] = useState("");
  const [ivaBase, setIvaBase] = useState("");
  const [ivaRate, setIvaRate] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const available = purchaseInvoices.filter(purchase => /^\d{49}$/.test(purchase.claveAcceso || ""));

  useEffect(() => {
    if (!isOpen) return;
    const renta = correction?.items.find(item => item.taxType === "RENTA");
    const iva = correction?.items.find(item => item.taxType === "IVA");
    setPurchaseId(correction?.purchaseInvoiceId || initialPurchaseId || "");
    setSupportCode(correction?.support?.code || "");
    setRelatedParty(correction?.support ? correction.support.relatedParty ? "si" : "no" : "");
    setPaymentCode((correction?.support?.paymentCode as typeof paymentCode) || "20");
    setRentaCode(renta?.code || "");
    setRentaBase(renta ? String(renta.taxBase) : "");
    setRentaRate(renta ? String(renta.percentage) : "");
    setIvaBase(iva ? String(iva.taxBase) : "");
    setIvaRate(iva?.percentage || 0);
    setError("");
  }, [isOpen, initialPurchaseId, correction]);

  if (!isOpen) return null;
  const purchase = available.find(item => item.id === purchaseId);
  const close = () => { if (!saving) onClose(); };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!purchase || !relatedParty) return;
    const items: Parameters<typeof createWithholding>[0]["items"] = [];
    if (Number(rentaRate) > 0) items.push({ taxType: "RENTA", code: rentaCode.trim().toUpperCase(), taxBase: Number(rentaBase), percentage: Number(rentaRate) });
    if (ivaRate) items.push({ taxType: "IVA", code: ivaCodes[ivaRate], taxBase: Number(ivaBase), percentage: ivaRate });
    if (!items.length || items.some(item => !item.code || item.taxBase <= 0)) {
      setError("Indica al menos una retención con su código, base y porcentaje.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await createWithholding({ purchaseInvoiceId: purchase.id, supportCode, relatedParty: relatedParty === "si", paymentCode, items }, correction?.id);
      onSuccess?.(result);
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo procesar la retención.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="sri-retencion-title" className="w-full max-w-2xl max-h-[90vh] overflow-auto rounded-xl bg-white shadow-xl">
        <header className="flex items-center justify-between bg-[#004ac6] px-5 py-4 text-white">
          <h2 id="sri-retencion-title" className="flex items-center gap-2 font-semibold"><Percent className="h-4 w-4" /> Emitir retención a proveedor</h2>
          <button type="button" aria-label="Cerrar" disabled={saving} onClick={close}><X className="h-5 w-5" /></button>
        </header>
        <form onSubmit={submit} className="space-y-4 p-5 text-xs text-slate-700">
          <label className="block font-semibold">Factura electrónica de compra
            <select className={field} required disabled={!!correction} value={purchaseId} onChange={event => setPurchaseId(event.target.value)}>
              <option value="">Selecciona la factura de sustento</option>
              {available.map(item => <option key={item.id} value={item.id}>{item.documentNumber} · {item.supplierName} · ${item.total.toFixed(2)}</option>)}
            </select>
          </label>
          {available.length === 0 && <p className="rounded-lg bg-amber-50 p-3">Registra primero una factura de proveedor con clave de acceso.</p>}
          {purchase && <p className="rounded-lg bg-slate-50 p-3">Proveedor {purchase.supplierRuc} · Base de compra ${purchase.subtotal.toFixed(2)} · IVA ${purchase.ivaAmount.toFixed(2)}</p>}
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="font-semibold">Código de sustento ATS
              <input className={field} required pattern="[0-9]{2}" maxLength={2} value={supportCode} onChange={event => setSupportCode(event.target.value)} />
            </label>
            <label className="font-semibold">Parte relacionada
              <select className={field} required value={relatedParty} onChange={event => setRelatedParty(event.target.value as typeof relatedParty)}>
                <option value="">Selecciona</option><option value="no">No</option><option value="si">Sí</option>
              </select>
            </label>
            <label className="font-semibold">Forma de pago SRI
              <select className={field} value={paymentCode} onChange={event => setPaymentCode(event.target.value as typeof paymentCode)}>
                <option value="01">Sin sistema financiero</option><option value="16">Tarjeta de débito</option>
                <option value="19">Tarjeta de crédito</option><option value="20">Otros con sistema financiero</option>
              </select>
            </label>
          </div>
          <fieldset className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-3">
            <legend className="px-1 font-semibold">Retención de renta</legend>
            <label>Código SRI<input className={field} required={Number(rentaRate) > 0} maxLength={5} value={rentaCode} onChange={event => setRentaCode(event.target.value)} /></label>
            <label>Base<input className={field} type="number" min="0.01" step="0.01" max={purchase?.subtotal} required={Number(rentaRate) > 0} value={rentaBase} onChange={event => setRentaBase(event.target.value)} /></label>
            <label>Porcentaje<input className={field} type="number" min="0" max="100" step="0.01" value={rentaRate} onChange={event => setRentaRate(event.target.value)} /></label>
          </fieldset>
          <fieldset className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
            <legend className="px-1 font-semibold">Retención de IVA</legend>
            <label>Base de IVA a retener<input className={field} type="number" min="0.01" step="0.01" max={purchase?.ivaAmount} required={ivaRate > 0} value={ivaBase} onChange={event => setIvaBase(event.target.value)} /></label>
            <label>Porcentaje<select className={field} value={ivaRate} onChange={event => setIvaRate(Number(event.target.value))}>
              <option value={0}>Sin retención de IVA</option>
              {Object.keys(ivaCodes).map(value => <option key={value} value={value}>{value}%</option>)}
            </select></label>
          </fieldset>
          <p className="text-right font-semibold">Total a retener ${((Math.round(Number(rentaBase) * Number(rentaRate)) + Math.round(Number(ivaBase) * ivaRate)) / 100).toFixed(2)}</p>
          {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-rose-700">{error}</p>}
          <footer className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <button type="button" disabled={saving} onClick={close} className="rounded-lg px-4 py-2">Cancelar</button>
            <button disabled={saving || !purchase} className="rounded-lg bg-[#004ac6] px-4 py-2 font-semibold text-white disabled:opacity-50">
              {saving ? "Procesando…" : "Firmar y enviar al SRI"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
