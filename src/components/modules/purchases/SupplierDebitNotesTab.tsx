"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import {
  FileText,
  Plus,
  ArrowUpRight,
  Search,
  X,
  AlertCircle,
} from "lucide-react";
import { PurchaseInvoice, SupplierDebitNote } from "@/types";

export function SupplierDebitNotesTab() {
  const { supplierDebitNotes, purchaseInvoices, addSupplierDebitNote } = useApp();
  const { showSuccess, showError } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");
  const [documentNumber, setDocumentNumber] = useState<string>("");
  const [claveAcceso, setClaveAcceso] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [total, setTotal] = useState<number>(0);
  const [reason, setReason] = useState<string>("");

  const selectedInvoice = purchaseInvoices.find((inv) => inv.id === selectedInvoiceId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedInvoice) {
      showError("Factura Requerida", "Selecciona la factura de compra asociada.");
      return;
    }
    if (!documentNumber.trim()) {
      showError("Número Requerido", "Ingresa el número de la Nota de Débito.");
      return;
    }
    if (total <= 0) {
      showError("Monto Inválido", "El monto de la nota de débito debe ser mayor a 0.");
      return;
    }

    try {
      await addSupplierDebitNote({
        purchaseInvoiceId: selectedInvoice.id,
        documentNumber: documentNumber.trim(),
        claveAcceso: claveAcceso.trim() || undefined,
        supplierId: selectedInvoice.supplierId,
        supplierName: selectedInvoice.supplierName,
        date,
        total: Number(total),
        reason: reason.trim() || "Cargos adicionales de transporte o mora",
      });

      showSuccess(
        "Nota de Débito Registrada",
        `Nota de Débito ${documentNumber} por $${total.toFixed(2)} incrementó el saldo a pagar de la factura ${selectedInvoice.documentNumber}.`
      );

      setIsModalOpen(false);
      setDocumentNumber("");
      setTotal(0);
      setReason("");
    } catch (err: any) {
      showError("Error al Guardar", err?.message || "No se pudo registrar la nota de débito.");
    }
  };

  const filteredNotes = supplierDebitNotes.filter((n) => {
    const q = searchQuery.toLowerCase();
    return (
      n.supplierName.toLowerCase().includes(q) ||
      n.documentNumber.includes(q)
    );
  });

  return (
    <div className="space-y-6 select-none">
      {/* Unified Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-[#737686] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por proveedor o número de nota de débito..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#f8f9ff] border border-[#e2e8f0] rounded-xl text-xs text-[#0b1c30] placeholder-[#737686] focus:outline-hidden focus:border-[#004ac6] transition-colors"
          />
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer whitespace-nowrap w-full sm:w-auto justify-center"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Nota de Débito</span>
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-[#f8f9ff] text-[#434655] border-b border-[#e2e8f0]">
            <tr>
              <th className="py-3 px-4 font-bold">Fecha</th>
              <th className="py-3 px-4 font-bold">N° Nota Débito</th>
              <th className="py-3 px-4 font-bold">Proveedor</th>
              <th className="py-3 px-4 font-bold">Concepto / Motivo</th>
              <th className="py-3 px-4 font-bold text-right">Valor Incrementado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e2e8f0]">
            {filteredNotes.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-xs text-[#737686]">
                  No hay notas de débito registradas de proveedores.
                </td>
              </tr>
            ) : (
              filteredNotes.map((note) => (
                <tr key={note.id} className="hover:bg-[#f8f9ff]/60 transition-colors">
                  <td className="py-3 px-4 text-[#0b1c30] font-medium">{note.date}</td>
                  <td className="py-3 px-4 font-mono font-bold text-[#b45309]">
                    {note.documentNumber}
                  </td>
                  <td className="py-3 px-4 font-bold text-[#0b1c30]">{note.supplierName}</td>
                  <td className="py-3 px-4 text-[#434655]">{note.reason}</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-[#b45309]">
                    +${note.total.toFixed(2)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#e2e8f0] w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8f9ff]">
              <div>
                <h3 className="text-base font-bold text-[#0b1c30]">
                  Registrar Nota de Débito de Proveedor
                </h3>
                <p className="text-xs text-[#737686]">
                  Aumenta el saldo por pagar de la compra seleccionada
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-[#737686] hover:bg-[#e2e8f0]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">
                  Factura de Compra Afectada *
                </label>
                <select
                  value={selectedInvoiceId}
                  onChange={(e) => setSelectedInvoiceId(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-xs font-medium text-[#0b1c30]"
                >
                  <option value="">-- Seleccionar Factura --</option>
                  {purchaseInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.documentNumber} - {inv.supplierName} (${inv.total.toFixed(2)}) - Saldo: ${inv.balanceRemaining.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">
                    N° Nota de Débito *
                  </label>
                  <input
                    type="text"
                    placeholder="001-002-000000189"
                    value={documentNumber}
                    onChange={(e) => setDocumentNumber(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-xs font-mono font-medium text-[#0b1c30]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">
                    Fecha *
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-xs font-medium text-[#0b1c30]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">
                  Valor Total Débito ($) *
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  value={total || ""}
                  onChange={(e) => setTotal(parseFloat(e.target.value) || 0)}
                  required
                  className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-xs font-mono font-bold text-[#b45309]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">
                  Concepto / Motivo
                </label>
                <input
                  type="text"
                  placeholder="ej. Flete especial de entrega de bobinas"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#e2e8f0]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#434655]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  Guardar Nota de Débito
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
