"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Layers,
  Trash2,
  Package,
} from "lucide-react";
import { useApp } from "@/lib/state";
import { CreditNote, InvoiceItem, SriInvoice } from "@/types";

interface CreditNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialInvoice?: SriInvoice | null;
  onSuccess?: (nc: CreditNote) => void;
}

export function CreditNoteModal({
  isOpen,
  onClose,
  initialInvoice,
  onSuccess,
}: CreditNoteModalProps) {
  const {
    billingInvoices,
    inventoryWarehouses,
    createCreditNote,
  } = useApp();

  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [reason, setReason] = useState("Devolución de mercadería por garantía o cambio de requerimiento");
  const [warehouseId, setWarehouseId] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (isOpen) {
      if (initialInvoice) {
        setSelectedInvoiceId(initialInvoice.id);
        setWarehouseId(initialInvoice.warehouseId || inventoryWarehouses[0]?.id || "");
        setItems(JSON.parse(JSON.stringify(initialInvoice.items || [])));
      } else if (billingInvoices.length > 0) {
        const first = billingInvoices[0];
        setSelectedInvoiceId(first.id);
        setWarehouseId(first.warehouseId || inventoryWarehouses[0]?.id || "");
        setItems(JSON.parse(JSON.stringify(first.items || [])));
      }
      setErrorMsg("");
    }
  }, [isOpen, initialInvoice, billingInvoices, inventoryWarehouses]);

  if (!isOpen) return null;

  const selectedInvoice = billingInvoices.find((i) => i.id === selectedInvoiceId);
  const currentWarehouse = inventoryWarehouses.find((w) => w.id === warehouseId) || inventoryWarehouses[0];

  const handleInvoiceChange = (invId: string) => {
    setSelectedInvoiceId(invId);
    const inv = billingInvoices.find((i) => i.id === invId);
    if (inv) {
      setWarehouseId(inv.warehouseId || inventoryWarehouses[0]?.id || "");
      setItems(JSON.parse(JSON.stringify(inv.items || [])));
    }
  };

  const handleUpdateQuantity = (itemId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(itemId);
      return;
    }
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const subtotal = it.unitPrice * newQty - it.discount;
        const ivaAmount = subtotal * (it.ivaRate / 100);
        const total = subtotal + ivaAmount;
        return { ...it, quantity: newQty, subtotal, ivaAmount, total };
      })
    );
  };

  const handleRemoveItem = (itemId: string) => {
    setItems((prev) => prev.filter((it) => it.id !== itemId));
  };

  const subtotal15 = items.filter((it) => it.ivaRate === 15).reduce((sum, it) => sum + it.subtotal, 0);
  const subtotal0 = items.filter((it) => it.ivaRate === 0).reduce((sum, it) => sum + it.subtotal, 0);
  const ivaTotal = items.reduce((sum, it) => sum + it.ivaAmount, 0);
  const total = subtotal15 + subtotal0 + ivaTotal;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) {
      setErrorMsg("Debe seleccionar una factura válida.");
      return;
    }
    if (items.length === 0) {
      setErrorMsg("Debe incluir al menos un ítem a devolver o anular.");
      return;
    }
    if (!reason.trim()) {
      setErrorMsg("Debe especificar el motivo de emisión de la nota de crédito.");
      return;
    }

    setIsSubmitting(true);
    try {
      const nc = await createCreditNote({
        date: new Date().toISOString().slice(0, 10),
        invoiceId: selectedInvoice.id,
        invoiceNumber: selectedInvoice.documentNumber,
        invoiceDate: selectedInvoice.date,
        clientId: selectedInvoice.clientId,
        clientName: selectedInvoice.clientName,
        clientRuc: selectedInvoice.clientRuc,
        reason,
        items,
        subtotal15,
        subtotal0,
        ivaTotal,
        total,
        warehouseId,
        warehouseName: currentWarehouse?.name || "Bodega Central",
        status: "autorizada",
      });

      if (onSuccess) onSuccess(nc);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Error al emitir la nota de crédito.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-400/30 flex items-center justify-center text-rose-400">
              <RotateCcw className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Ajustes Tributarios SRI
              </span>
              <h2 className="text-lg font-black text-white">
                Emitir Nota de Crédito Electrónica
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Fila 1: Factura Origen & Bodega */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Factura que Modifica:
              </label>
              <select
                value={selectedInvoiceId}
                onChange={(e) => handleInvoiceChange(e.target.value)}
                className="w-full text-xs font-semibold rounded-xl border border-slate-300 p-2.5 bg-white text-slate-900"
              >
                {billingInvoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.documentNumber} - {inv.clientName} (${inv.total.toFixed(2)})
                  </option>
                ))}
              </select>
              {selectedInvoice && (
                <p className="text-[10px] text-slate-500 mt-1">
                  Fecha Emisión: {selectedInvoice.date} | RUC: {selectedInvoice.clientRuc}
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Bodega de Reingreso de Stock:
              </label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="w-full text-xs font-semibold rounded-xl border border-slate-300 p-2.5 bg-white text-slate-900"
              >
                {inventoryWarehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-emerald-600 font-semibold mt-1">
                Los productos devueltos reingresarán automáticamente al Kardex de esta bodega.
              </p>
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Motivo de la Modificación / Devolución *:
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white"
                placeholder="Ej. Devolución de 1 equipo por cambio de especificación..."
              />
            </div>
          </div>

          {/* Fila 2: Ítems a Devolver */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <Package className="w-4 h-4 text-rose-600" />
              Ítems a Devolver / Descontar ({items.length})
            </h3>

            <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <th className="py-2.5 px-3">Producto / Servicio</th>
                    <th className="py-2.5 px-2 text-center w-20">Cant. Devuelta</th>
                    <th className="py-2.5 px-3 text-right w-24">Precio ($)</th>
                    <th className="py-2.5 px-2 text-center w-20">IVA</th>
                    <th className="py-2.5 px-3 text-right w-24">Total ($)</th>
                    <th className="py-2.5 px-2 text-center w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((it) => (
                    <tr key={it.id} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3">
                        <p className="font-bold text-slate-900">{it.name}</p>
                        <p className="text-[10px] text-slate-500 font-mono">SKU: {it.sku}</p>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <input
                          type="number"
                          min="1"
                          value={it.quantity}
                          onChange={(e) => handleUpdateQuantity(it.id, parseFloat(e.target.value) || 1)}
                          className="w-16 text-center text-xs font-bold rounded-lg border border-slate-300 p-1"
                        />
                      </td>
                      <td className="py-2 px-3 text-right font-mono">${it.unitPrice.toFixed(2)}</td>
                      <td className="py-2 px-2 text-center font-bold">{it.ivaRate}%</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                        ${it.total.toFixed(2)}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(it.id)}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Resumen */}
          <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-2">
            <div className="flex justify-between text-xs text-slate-300">
              <span>Subtotal 15%:</span>
              <span className="font-mono">${subtotal15.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-300">
              <span>Subtotal 0%:</span>
              <span className="font-mono">${subtotal0.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs text-sky-300">
              <span>IVA 15%:</span>
              <span className="font-mono font-bold">${ivaTotal.toFixed(2)}</span>
            </div>
            <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-sm font-black">
              <span>TOTAL NOTA DE CRÉDITO:</span>
              <span className="text-xl font-mono text-rose-400">${total.toFixed(2)}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSubmitting || items.length === 0}
              className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold shadow-md transition flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Emitir Nota de Crédito SRI</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
