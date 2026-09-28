"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import {
  calculateWithholdingAmounts,
  generateWithholdingAccessKey,
} from "@/lib/purchases-service";
import {
  FileText,
  Plus,
  Percent,
  Search,
  Eye,
  CheckCircle,
  X,
  Printer,
  ShieldCheck,
} from "lucide-react";
import { PurchaseInvoice, PurchaseWithholding } from "@/types";

interface PurchaseWithholdingsTabProps {
  initialInvoice?: PurchaseInvoice | null;
  onClearInitialInvoice?: () => void;
}

export function PurchaseWithholdingsTab({
  initialInvoice,
  onClearInitialInvoice,
}: PurchaseWithholdingsTabProps) {
  const {
    purchaseWithholdings,
    purchaseInvoices,
    sriCompanyConfig,
    addPurchaseWithholding,
  } = useApp();
  const { showSuccess, showError } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(!!initialInvoice);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWithholding, setSelectedWithholding] =
    useState<PurchaseWithholding | null>(null);

  // Form State
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(
    initialInvoice?.id || ""
  );
  const [documentNumber, setDocumentNumber] = useState<string>(() => {
    const count = purchaseWithholdings.length + 1;
    return `001-001-${String(count).padStart(9, "0")}`;
  });
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [rentaPercentage, setRentaPercentage] = useState<number>(1.75);
  const [ivaPercentage, setIvaPercentage] = useState<number>(30);

  const selectedInvoice = purchaseInvoices.find((inv) => inv.id === selectedInvoiceId);

  // Calculate live values
  const { rentaBase, rentaAmount, ivaBase, ivaRetainedAmount, totalWithheld } =
    calculateWithholdingAmounts({
      baseImponible15: selectedInvoice?.subtotal15 || 0,
      baseImponible0: selectedInvoice?.subtotal0 || 0,
      ivaAmount: selectedInvoice?.ivaAmount || 0,
      rentaPercentage,
      ivaPercentage,
    });

  const handleOpenModal = (invoice?: PurchaseInvoice) => {
    if (invoice) {
      setSelectedInvoiceId(invoice.id);
    }
    const count = purchaseWithholdings.length + 1;
    setDocumentNumber(`001-001-${String(count).padStart(9, "0")}`);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    if (onClearInitialInvoice) onClearInitialInvoice();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedInvoice) {
      showError("Factura Requerida", "Debes seleccionar la factura del proveedor a retener.");
      return;
    }

    try {
      const secuencialStr = documentNumber.split("-")[2] || "1";
      const claveAcceso = generateWithholdingAccessKey({
        date,
        companyRuc: sriCompanyConfig.ruc || "1792458921001",
        ambiente: sriCompanyConfig.ambiente || "1",
        establecimiento: sriCompanyConfig.establecimiento || "001",
        puntoEmision: sriCompanyConfig.puntoEmision || "001",
        secuencial: secuencialStr,
      });

      await addPurchaseWithholding({
        purchaseInvoiceId: selectedInvoice.id,
        documentNumber,
        claveAcceso,
        supplierId: selectedInvoice.supplierId,
        supplierName: selectedInvoice.supplierName,
        supplierRuc: selectedInvoice.supplierRuc,
        date,
        rentaBase,
        rentaPercentage,
        rentaAmount,
        ivaBase,
        ivaPercentage,
        ivaAmount: ivaRetainedAmount,
        totalWithheld,
      });

      showSuccess(
        "Retención Emitida",
        `Comprobante ${documentNumber} por $${totalWithheld.toFixed(2)} emitido hacia ${selectedInvoice.supplierName}.`
      );

      handleCloseModal();
    } catch (err: any) {
      showError("Error al Emitir", err?.message || "No se pudo generar la retención electrónica.");
    }
  };

  const filtered = purchaseWithholdings.filter((w) => {
    const q = searchQuery.toLowerCase();
    return (
      w.supplierName.toLowerCase().includes(q) ||
      w.supplierRuc.includes(q) ||
      w.documentNumber.includes(q) ||
      w.claveAcceso.includes(q)
    );
  });

  return (
    <div className="space-y-6 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs">
        <div>
          <h2 className="text-base font-bold text-[#0b1c30] flex items-center gap-2">
            <Percent className="w-5 h-5 text-[#059669]" />
            Retenciones Electrónicas de Compras (SRI)
          </h2>
          <p className="text-xs text-[#737686]">
            Emisión de comprobantes de retención en la fuente e IVA emitidos por INNTEL CORP hacia los proveedores.
          </p>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Emitir Retención</span>
        </button>
      </div>

      {/* Search */}
      <div className="p-3 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-[#737686] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por proveedor, RUC o secuencial de retención..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#f8f9ff] border border-[#e2e8f0] rounded-xl text-xs text-[#0b1c30] placeholder-[#737686] focus:outline-hidden focus:border-[#004ac6]"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-[#f8f9ff] text-[#434655] border-b border-[#e2e8f0]">
            <tr>
              <th className="py-3 px-4 font-bold">Fecha</th>
              <th className="py-3 px-4 font-bold">N° Retención</th>
              <th className="py-3 px-4 font-bold">Proveedor / RUC</th>
              <th className="py-3 px-4 font-bold text-right">Ret. Renta</th>
              <th className="py-3 px-4 font-bold text-right">Ret. IVA</th>
              <th className="py-3 px-4 font-bold text-right">Total Retenido</th>
              <th className="py-3 px-4 font-bold text-center">RIDE</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e2e8f0]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-xs text-[#737686]">
                  No se registran retenciones de compras emitidas.
                </td>
              </tr>
            ) : (
              filtered.map((w) => (
                <tr key={w.id} className="hover:bg-[#f8f9ff]/60 transition-colors">
                  <td className="py-3 px-4 text-[#0b1c30] font-medium">{w.date}</td>
                  <td className="py-3 px-4 font-mono font-bold text-[#004ac6]">{w.documentNumber}</td>
                  <td className="py-3 px-4">
                    <div className="font-bold text-[#0b1c30]">{w.supplierName}</div>
                    <div className="text-[11px] font-mono text-[#737686]">{w.supplierRuc}</div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-medium text-[#434655]">
                    ${w.rentaAmount.toFixed(2)} ({w.rentaPercentage}%)
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-medium text-[#434655]">
                    ${w.ivaAmount.toFixed(2)} ({w.ivaPercentage}%)
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-[#059669]">
                    ${w.totalWithheld.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => setSelectedWithholding(w)}
                      className="p-1.5 rounded-lg text-[#004ac6] hover:bg-[#eff4ff]"
                      title="Ver RIDE de Retención"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Emitir Retención */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#e2e8f0] w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8f9ff]">
              <div>
                <h3 className="text-base font-bold text-[#0b1c30]">
                  Emitir Comprobante de Retención SRI
                </h3>
                <p className="text-xs text-[#737686]">
                  Calcula y genera la clave de acceso de 49 dígitos para el proveedor
                </p>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-1.5 rounded-lg text-[#737686] hover:bg-[#e2e8f0]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">
                  Factura de Compra *
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
                      {inv.documentNumber} - {inv.supplierName} (Subtotal: ${inv.subtotal.toFixed(2)}, IVA: ${inv.ivaAmount.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">
                    Secuencial Retención *
                  </label>
                  <input
                    type="text"
                    value={documentNumber}
                    onChange={(e) => setDocumentNumber(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-xs font-mono font-medium text-[#0b1c30]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">
                    Fecha de Emisión *
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

              {/* Percentages */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-[#f8f9ff] rounded-xl border border-[#e2e8f0]">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">
                    % Retención Renta
                  </label>
                  <select
                    value={rentaPercentage}
                    onChange={(e) => setRentaPercentage(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-xs font-medium text-[#0b1c30]"
                  >
                    <option value={1.75}>1.75% (Bienes y materiales)</option>
                    <option value={2.75}>2.75% (Servicios técnicos)</option>
                    <option value={8}>8.00% (Honorarios profesionales)</option>
                    <option value={0}>0.00% (No aplica)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">
                    % Retención IVA
                  </label>
                  <select
                    value={ivaPercentage}
                    onChange={(e) => setIvaPercentage(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-xs font-medium text-[#0b1c30]"
                  >
                    <option value={30}>30% (Bienes con IVA)</option>
                    <option value={70}>70% (Servicios con IVA)</option>
                    <option value={100}>100% (Honorarios / Liquidaciones)</option>
                    <option value={0}>0% (No aplica)</option>
                  </select>
                </div>
              </div>

              {/* Calculations summary */}
              {selectedInvoice && (
                <div className="p-4 bg-[#eff4ff] rounded-xl border border-[#bfdbfe] space-y-2 text-xs">
                  <div className="flex justify-between text-[#434655]">
                    <span>Base Imponible Renta:</span>
                    <span className="font-mono font-medium">${rentaBase.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[#434655]">
                    <span>Monto Retenido Renta ({rentaPercentage}%):</span>
                    <span className="font-mono font-medium text-[#059669]">${rentaAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[#434655]">
                    <span>Base IVA:</span>
                    <span className="font-mono font-medium">${ivaBase.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[#434655]">
                    <span>Monto Retenido IVA ({ivaPercentage}%):</span>
                    <span className="font-mono font-medium text-[#059669]">${ivaRetainedAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm text-[#004ac6] pt-1 border-t border-[#bfdbfe]">
                    <span>Total Retención a Entregar:</span>
                    <span className="font-mono">${totalWithheld.toFixed(2)}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-[#e2e8f0]">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-xs font-semibold text-[#434655]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!selectedInvoice}
                  className="px-5 py-2.5 bg-[#004ac6] hover:bg-[#003da6] disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  Emitir Retención Oficial
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RIDE Preview Modal */}
      {selectedWithholding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#e2e8f0] w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8f9ff]">
              <div>
                <h3 className="text-base font-bold text-[#0b1c30]">
                  Comprobante de Retención RIDE
                </h3>
                <p className="text-xs text-[#737686] font-mono">
                  {selectedWithholding.documentNumber}
                </p>
              </div>
              <button
                onClick={() => setSelectedWithholding(null)}
                className="p-1.5 rounded-lg text-[#737686] hover:bg-[#e2e8f0]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              <div className="p-3 bg-[#f8f9ff] rounded-xl border border-[#e2e8f0]">
                <div className="text-[10px] font-bold text-[#737686] uppercase">Clave de Acceso SRI (49 dígitos)</div>
                <div className="font-mono text-[#004ac6] break-all select-all font-semibold mt-1">
                  {selectedWithholding.claveAcceso}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 bg-white border border-[#e2e8f0] rounded-xl">
                <div>
                  <span className="text-[#737686]">Sujeto Retenido:</span>
                  <div className="font-bold text-[#0b1c30]">{selectedWithholding.supplierName}</div>
                </div>
                <div>
                  <span className="text-[#737686]">RUC:</span>
                  <div className="font-mono font-bold text-[#0b1c30]">{selectedWithholding.supplierRuc}</div>
                </div>
                <div>
                  <span className="text-[#737686]">Fecha de Emisión:</span>
                  <div className="font-medium">{selectedWithholding.date}</div>
                </div>
                <div>
                  <span className="text-[#737686]">Total Retenido:</span>
                  <div className="font-mono font-bold text-[#059669] text-sm">
                    ${selectedWithholding.totalWithheld.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-3 border-t border-[#e2e8f0] flex justify-between items-center">
              <span className="text-[11px] text-[#737686] flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#059669]" />
                Comprobante tributario válido SRI Ecuador
              </span>
              <button
                onClick={() => setSelectedWithholding(null)}
                className="px-4 py-2 bg-[#0b1c30] text-white rounded-xl text-xs font-bold hover:bg-[#1a2e47]"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
