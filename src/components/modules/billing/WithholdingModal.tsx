"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  DollarSign,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { SriInvoice, WithholdingReceipt, WithholdingItem } from "@/types";

interface WithholdingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialInvoice?: SriInvoice | null;
  onSuccess?: (ret: WithholdingReceipt) => void;
}

const SRI_RETENTION_PRESETS: Array<{
  label: string;
  taxType: "RENTA" | "IVA";
  code: string;
  percentage: number;
}> = [
  { label: "312 - Transferencia de bienes muebles (1.75%)", taxType: "RENTA", code: "312", percentage: 1.75 },
  { label: "3440 - Otras retenciones aplicables 2.75% (Servicios telecom)", taxType: "RENTA", code: "3440", percentage: 2.75 },
  { label: "303 - Honorarios profesionales (10%)", taxType: "RENTA", code: "303", percentage: 10 },
  { label: "304 - Predomina el intelecto (8%)", taxType: "RENTA", code: "304", percentage: 8 },
  { label: "332 - Pagos bienes/servicios no sujetos a retención (0%)", taxType: "RENTA", code: "332", percentage: 0 },
  { label: "IVA 30% - Retención de IVA Bienes (Cod. 1)", taxType: "IVA", code: "1", percentage: 30 },
  { label: "IVA 70% - Retención de IVA Servicios (Cod. 2)", taxType: "IVA", code: "2", percentage: 70 },
  { label: "IVA 100% - Retención Total de IVA (Cod. 3)", taxType: "IVA", code: "3", percentage: 100 },
];

export function WithholdingModal({
  isOpen,
  onClose,
  initialInvoice,
  onSuccess,
}: WithholdingModalProps) {
  const { billingInvoices, createWithholding } = useApp();
  const { showSuccess } = useToast();

  const sriInvoices = billingInvoices.filter(
    (inv) =>
      (inv.documentType || "factura") === "factura" &&
      inv.status !== "anulada" &&
      inv.status !== "borrador"
  );

  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [date, setDate] = useState("");
  const [fiscalPeriod, setFiscalPeriod] = useState("");
  const [items, setItems] = useState<WithholdingItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const buildDefaultItemsForInvoice = (inv?: SriInvoice): WithholdingItem[] => {
    const baseRenta = inv
      ? Math.round(((inv.subtotal15 || 0) + (inv.subtotal0 || 0)) * 100) / 100
      : 100;
    const baseIva = inv ? Math.round((inv.ivaTotal || 0) * 100) / 100 : 15;
    const rows: WithholdingItem[] = [
      {
        taxType: "RENTA",
        code: "3440",
        percentage: 2.75,
        taxBase: baseRenta,
        retainedAmount: Math.round(baseRenta * 0.0275 * 100) / 100,
      },
    ];
    if (baseIva > 0) {
      rows.push({
        taxType: "IVA",
        code: "2",
        percentage: 70,
        taxBase: baseIva,
        retainedAmount: Math.round(baseIva * 0.7 * 100) / 100,
      });
    }
    return rows;
  };

  useEffect(() => {
    if (isOpen) {
      const today = new Date().toISOString().slice(0, 10);
      setDate(today);
      const [yyyy, mm] = today.split("-");
      setFiscalPeriod(`${mm}/${yyyy}`);
      setErrorMsg("");

      const target = initialInvoice || sriInvoices[0];
      if (target) {
        setSelectedInvoiceId(target.id);
        setItems(buildDefaultItemsForInvoice(target));
      } else {
        setSelectedInvoiceId("");
        setItems(buildDefaultItemsForInvoice(undefined));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialInvoice]);

  if (!isOpen) return null;

  const targetInvoice = sriInvoices.find((i) => i.id === selectedInvoiceId);

  const handleInvoiceChange = (invId: string) => {
    setSelectedInvoiceId(invId);
    const inv = sriInvoices.find((i) => i.id === invId);
    if (inv) {
      const [yyyy, mm] = (inv.date || date).split("-");
      if (yyyy && mm) setFiscalPeriod(`${mm}/${yyyy}`);
      setItems(buildDefaultItemsForInvoice(inv));
    }
  };

  const handleAddItem = () => {
    const baseRenta = targetInvoice
      ? Math.round(((targetInvoice.subtotal15 || 0) + (targetInvoice.subtotal0 || 0)) * 100) / 100
      : 100;
    setItems((prev) => [
      ...prev,
      {
        taxType: "RENTA",
        code: "312",
        percentage: 1.75,
        taxBase: baseRenta,
        retainedAmount: Math.round(baseRenta * 0.0175 * 100) / 100,
      },
    ]);
  };

  const handleApplyPreset = (index: number, presetIndex: number) => {
    const preset = SRI_RETENTION_PRESETS[presetIndex];
    if (!preset) return;
    setItems((prev) =>
      prev.map((it, idx) => {
        if (idx !== index) return it;
        const defaultBase =
          preset.taxType === "IVA"
            ? targetInvoice?.ivaTotal || it.taxBase
            : targetInvoice
            ? (targetInvoice.subtotal15 || 0) + (targetInvoice.subtotal0 || 0)
            : it.taxBase;
        const base = Math.round(Number(defaultBase || 0) * 100) / 100;
        const retained = Math.round(base * (preset.percentage / 100) * 100) / 100;
        return {
          taxType: preset.taxType,
          code: preset.code,
          percentage: preset.percentage,
          taxBase: base,
          retainedAmount: retained,
        };
      })
    );
  };

  const handleUpdateItem = (
    index: number,
    field: keyof WithholdingItem,
    value: string | number
  ) => {
    setItems((prev) =>
      prev.map((it, idx) => {
        if (idx !== index) return it;
        const updated = { ...it, [field]: value };
        if (field === "taxBase" || field === "percentage") {
          const base = Math.max(0, Number(updated.taxBase) || 0);
          const pct = Math.max(0, Number(updated.percentage) || 0);
          updated.taxBase = base;
          updated.percentage = pct;
          updated.retainedAmount = Math.round(base * (pct / 100) * 100) / 100;
        }
        return updated;
      })
    );
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const totalRetained = Math.round(
    items.reduce((sum, it) => sum + (Number(it.retainedAmount) || 0), 0) * 100
  ) / 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!targetInvoice) {
      setErrorMsg("Debe seleccionar una factura electrónica de sustento.");
      return;
    }

    if (items.length === 0) {
      setErrorMsg("Debe registrar al menos un impuesto retenido.");
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createWithholding({
        date: date || new Date().toISOString().slice(0, 10),
        clientId: targetInvoice.clientId,
        clientName: targetInvoice.clientName,
        clientRuc: targetInvoice.clientRuc,
        invoiceNumber: targetInvoice.documentNumber,
        fiscalPeriod: fiscalPeriod || "10/2026",
        items,
        totalRetained,
        status: "autorizada",
      });

      showSuccess(
        "Comprobante de Retención Emitido",
        `Retención ${created.documentNumber} autorizada por $${created.totalRetained.toFixed(2)}.`
      );
      if (onSuccess) onSuccess(created);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || "Error al emitir el comprobante de retención.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-[#e2e8f0] w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh] my-auto">
        {/* Header */}
        <div className="px-6 py-4 bg-[#004ac6] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-white shadow-xs">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight text-white">
                Emitir Comprobante de Retención SRI • 07
              </h2>
              <p className="text-xs text-blue-100">
                Retención electrónica de Impuesto a la Renta e IVA vinculada a factura
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

        {errorMsg && (
          <div className="mx-6 mt-4 p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-xs overflow-y-auto flex-1">
          {/* Factura de Sustento y Periodo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-lg bg-[#f8f9ff] border border-[#e2e8f0]">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Factura de Sustento *
              </label>
              <select
                value={selectedInvoiceId}
                onChange={(e) => handleInvoiceChange(e.target.value)}
                className="w-full text-xs bg-white border border-[#e2e8f0] rounded-lg px-3 py-2 text-slate-800 font-semibold focus:outline-hidden focus:border-[#004ac6]"
              >
                {sriInvoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.documentNumber} • {inv.clientName} (${inv.total.toFixed(2)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Periodo Fiscal (MM/AAAA) *
              </label>
              <input
                type="text"
                value={fiscalPeriod}
                onChange={(e) => setFiscalPeriod(e.target.value)}
                placeholder="10/2026"
                required
                className="w-full text-xs font-mono font-bold bg-white border border-[#e2e8f0] rounded-lg px-3 py-2 text-slate-800 focus:outline-hidden focus:border-[#004ac6]"
              />
            </div>

            {targetInvoice && (
              <div className="sm:col-span-3 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#e2e8f0] text-[11px] text-slate-600">
                <span>
                  <strong className="text-slate-800">Sujeto Retenido:</strong> {targetInvoice.clientName} (RUC: {targetInvoice.clientRuc})
                </span>
                <span className="font-mono">
                  Base Subtotales:{" "}
                  <strong>
                    ${((targetInvoice.subtotal15 || 0) + (targetInvoice.subtotal0 || 0)).toFixed(2)}
                  </strong>{" "}
                  | IVA 15%: <strong>${(targetInvoice.ivaTotal || 0).toFixed(2)}</strong>
                </span>
              </div>
            )}
          </div>

          {/* Detalle de Impuestos Retenidos */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 uppercase tracking-wider text-xs">
                Detalle de Impuestos Retenidos
              </span>
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 text-[#004ac6] hover:bg-blue-100 font-bold text-xs transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar Línea</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {items.map((it, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-lg bg-[#f8f9ff] border border-[#e2e8f0] space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <select
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val)) handleApplyPreset(idx, val);
                      }}
                      defaultValue=""
                      className="text-xs bg-white border border-[#e2e8f0] rounded-lg px-2.5 py-1.5 text-slate-700 flex-1 min-w-[220px] focus:outline-hidden focus:border-[#004ac6]"
                    >
                      <option value="" disabled>
                        Seleccionar código rápido del catálogo SRI...
                      </option>
                      {SRI_RETENTION_PRESETS.map((p, pIdx) => (
                        <option key={pIdx} value={pIdx}>
                          {p.label}
                        </option>
                      ))}
                    </select>

                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                        title="Eliminar impuesto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 items-end">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">
                        Impuesto
                      </label>
                      <select
                        value={it.taxType}
                        onChange={(e) =>
                          handleUpdateItem(idx, "taxType", e.target.value as "RENTA" | "IVA")
                        }
                        className="w-full text-xs font-bold bg-white border border-[#e2e8f0] rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:border-[#004ac6]"
                      >
                        <option value="RENTA">RENTA</option>
                        <option value="IVA">IVA</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">
                        Código SRI
                      </label>
                      <input
                        type="text"
                        value={it.code}
                        onChange={(e) => handleUpdateItem(idx, "code", e.target.value)}
                        className="w-full text-xs font-mono font-bold bg-white border border-[#e2e8f0] rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:border-[#004ac6]"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">
                        Base Imponible ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={it.taxBase}
                        onChange={(e) =>
                          handleUpdateItem(idx, "taxBase", parseFloat(e.target.value) || 0)
                        }
                        className="w-full text-xs font-mono text-right bg-white border border-[#e2e8f0] rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:border-[#004ac6]"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">
                        % Retención
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={it.percentage}
                        onChange={(e) =>
                          handleUpdateItem(idx, "percentage", parseFloat(e.target.value) || 0)
                        }
                        className="w-full text-xs font-mono font-bold text-right bg-white border border-[#e2e8f0] rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:border-[#004ac6]"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">
                        Valor Retenido ($)
                      </label>
                      <div className="w-full text-xs font-mono font-bold text-right bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-2.5 py-1.5">
                        ${it.retainedAmount.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Total Summary */}
          <div className="p-4 rounded-xl bg-slate-900 text-white flex items-center justify-between">
            <span className="font-bold text-xs uppercase tracking-wider">
              Total Comprobante de Retención • 07:
            </span>
            <span className="text-lg font-mono font-black text-emerald-400">
              ${totalRetained.toFixed(2)}
            </span>
          </div>

          {/* Actions */}
          <div className="pt-2 border-t border-[#e2e8f0] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-[#e2e8f0] text-slate-700 hover:bg-slate-100 font-semibold rounded-lg text-xs transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !targetInvoice}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? "Emitiendo..." : "Emitir Retención SRI"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
