"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  FileText,
  Plus,
  Trash2,
  DollarSign,
  AlertTriangle,
  Receipt,
  CheckCircle2,
} from "lucide-react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { DebitNote, SriInvoice } from "@/types";

interface DebitNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialInvoice?: SriInvoice | null;
  onSuccess?: (nd: DebitNote) => void;
}

export function DebitNoteModal({
  isOpen,
  onClose,
  initialInvoice,
  onSuccess,
}: DebitNoteModalProps) {
  const { billingInvoices, createDebitNote } = useApp();
  const { showSuccess, showError } = useToast();

  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [date, setDate] = useState("");
  const [reasons, setReasons] = useState<{ reason: string; amount: number }[]>([
    { reason: "Intereses por mora en pago de factura", amount: 5.0 },
  ]);
  const [ivaRate, setIvaRate] = useState<number>(15);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const authorizedInvoices = billingInvoices.filter(
    (inv) => (inv.documentType || "factura") === "factura"
  );

  useEffect(() => {
    if (isOpen) {
      setDate(new Date().toISOString().slice(0, 10));
      setErrorMsg("");
      if (initialInvoice) {
        setSelectedInvoiceId(initialInvoice.id);
      } else if (authorizedInvoices.length > 0) {
        setSelectedInvoiceId(authorizedInvoices[0].id);
      }
    }
  }, [isOpen, initialInvoice, authorizedInvoices]);

  if (!isOpen) return null;

  const targetInvoice = authorizedInvoices.find((i) => i.id === selectedInvoiceId);

  const subtotal = Math.round(
    reasons.reduce((sum, r) => sum + (Number(r.amount) || 0), 0) * 100
  ) / 100;
  const ivaAmount = Math.round(subtotal * (ivaRate / 100) * 100) / 100;
  const total = Math.round((subtotal + ivaAmount) * 100) / 100;

  const handleAddReason = () => {
    setReasons((prev) => [...prev, { reason: "Recargo administrativo o penalidad", amount: 10.0 }]);
  };

  const handleUpdateReason = (index: number, field: "reason" | "amount", value: any) => {
    setReasons((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r;
        return {
          ...r,
          [field]: field === "amount" ? Math.max(0, parseFloat(value) || 0) : value,
        };
      })
    );
  };

  const handleRemoveReason = (index: number) => {
    if (reasons.length <= 1) return;
    setReasons((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!targetInvoice) {
      setErrorMsg("Debe seleccionar la factura electrónica a la cual se aplicará la Nota de Débito.");
      return;
    }

    if (reasons.length === 0 || subtotal <= 0) {
      setErrorMsg("Debe especificar al menos un motivo con un valor mayor a $0.00.");
      return;
    }

    setIsSubmitting(true);
    try {
      const newND = await createDebitNote({
        date: date || new Date().toISOString().slice(0, 10),
        modifiedInvoiceNumber: targetInvoice.documentNumber,
        modifiedInvoiceDate: targetInvoice.date,
        clientId: targetInvoice.clientId,
        clientName: targetInvoice.clientName,
        clientRuc: targetInvoice.clientRuc,
        clientEmail: targetInvoice.clientEmail,
        clientAddress: targetInvoice.clientAddress,
        reasons,
        subtotal,
        ivaRate,
        ivaAmount,
        total,
        status: "emitida",
      });

      showSuccess(
        "Nota de Débito Emitida",
        `La Nota de Débito ${newND.documentNumber} fue generada exitosamente ante el SRI.`
      );
      if (onSuccess) onSuccess(newND);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || "Ocurrió un error al emitir la nota de débito.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-[#004ac6] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/10 text-white">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">Emitir Nota de Débito SRI (05)</h2>
              <p className="text-xs text-blue-100">
                Recargo por intereses, mora o penalidades sobre factura
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs overflow-y-auto max-h-[70vh]">
          {/* Target Invoice */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Factura Electrónica a Modificar *
            </label>
            <select
              value={selectedInvoiceId}
              onChange={(e) => setSelectedInvoiceId(e.target.value)}
              className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-[#004ac6]"
            >
              {authorizedInvoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.documentNumber} • {inv.clientName} (${inv.total.toFixed(2)}) • {inv.date}
                </option>
              ))}
            </select>
          </div>

          {targetInvoice && (
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-slate-600 space-y-1">
              <span className="font-bold text-slate-800 block text-[11px]">Cliente Receptor:</span>
              <p className="font-semibold text-slate-900">{targetInvoice.clientName}</p>
              <p className="font-mono text-[11px]">RUC / Cédula: {targetInvoice.clientRuc} | {targetInvoice.clientEmail}</p>
            </div>
          )}

          {/* Date & IVA */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Fecha de Emisión
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-[#004ac6]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tarifa IVA Aplicable
              </label>
              <select
                value={ivaRate}
                onChange={(e) => setIvaRate(Number(e.target.value))}
                className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-[#004ac6]"
              >
                <option value={15}>15% (General)</option>
                <option value={0}>0% (Sin IVA)</option>
              </select>
            </div>
          </div>

          {/* Reasons List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800">Motivos de Débito</span>
              <button
                type="button"
                onClick={handleAddReason}
                className="text-[11px] font-bold text-[#004ac6] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar Motivo</span>
              </button>
            </div>

            <div className="space-y-2">
              {reasons.map((r, index) => (
                <div key={index} className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <input
                    type="text"
                    value={r.reason}
                    onChange={(e) => handleUpdateReason(index, "reason", e.target.value)}
                    placeholder="Descripción del recargo..."
                    className="flex-1 text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800"
                  />
                  <div className="relative w-24">
                    <span className="absolute left-2 top-1.5 text-slate-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={r.amount}
                      onChange={(e) => handleUpdateReason(index, "amount", e.target.value)}
                      className="w-full text-xs font-mono text-right bg-white border border-slate-300 rounded-lg pl-5 pr-2 py-1.5 text-slate-800"
                    />
                  </div>
                  {reasons.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveReason(index)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 transition"
                      title="Quitar motivo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Totals Summary */}
          <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 space-y-1.5">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-mono font-medium">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>IVA ({ivaRate}%):</span>
              <span className="font-mono font-medium">${ivaAmount.toFixed(2)}</span>
            </div>
            <div className="border-t border-slate-300 pt-1.5 flex justify-between font-bold text-slate-900 text-sm">
              <span>Total Nota de Débito:</span>
              <span className="font-mono text-[#004ac6]">${total.toFixed(2)}</span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold rounded-xl text-xs transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? "Emitiendo..." : "Emitir Nota de Débito SRI"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
