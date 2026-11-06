"use client";


import React, { useState, useRef } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { WithholdingModal } from "../billing/WithholdingModal";
import { RidePreviewModal } from "../billing/RidePreviewModal";
import { fiscalStateLabel, isFiscalAuthorized } from "@/lib/sri-service";
import type { WithholdingReceipt } from "@/types";
import { printHtmlElement } from "@/lib/print-service";
import {
  Plus,
  Percent,
  Search,
  Eye,
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
    billingWithholdings,
    sriCompanyConfig,
  } = useApp();
  const { showSuccess, showWarning } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(!!initialInvoice);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWithholding, setSelectedWithholding] =
    useState<PurchaseWithholding | null>(null);
  const withholdingPrintRef = useRef<HTMLDivElement>(null);

  const [fiscalPreview, setFiscalPreview] = useState<WithholdingReceipt | null>(null);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    onClearInitialInvoice?.();
  };

  const fiscalRows = billingWithholdings.filter(row => row.purchaseInvoiceId);
  const legacy = purchaseWithholdings.filter(row => !fiscalRows.some(fiscal => fiscal.claveAcceso === row.claveAcceso));
  const filtered = [
    ...fiscalRows.map(row => ({
      id: row.id, date: row.date, documentNumber: row.documentNumber, supplierName: row.clientName,
      supplierRuc: row.clientRuc, claveAcceso: row.claveAcceso, totalWithheld: row.totalRetained,
      rentaAmount: row.items.filter(item => item.taxType === "RENTA").reduce((sum, item) => sum + item.retainedAmount, 0),
      ivaAmount: row.items.filter(item => item.taxType === "IVA").reduce((sum, item) => sum + item.retainedAmount, 0),
      statusLabel: fiscalStateLabel(row), preview: () => setFiscalPreview(row),
    })),
    ...legacy.map(row => ({ ...row, statusLabel: "HISTÓRICO LOCAL", preview: () => setSelectedWithholding(row) })),
  ].filter(row => [row.supplierName, row.supplierRuc, row.documentNumber, row.claveAcceso].some(value => value.toLowerCase().includes(searchQuery.trim().toLowerCase())))
    .sort((a, b) => b.date.localeCompare(a.date) || b.documentNumber.localeCompare(a.documentNumber));

  return (
    <div className="space-y-6">
      {/* Unified Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white rounded-xl border border-[#e2e8f0] shadow-2xs">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-[#737686] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por proveedor, RUC o secuencial de retención..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#f8f9ff] border border-[#e2e8f0] rounded-lg text-xs text-[#0b1c30] placeholder-[#737686] focus:outline-hidden focus:border-[#004ac6] focus:bg-white transition-colors"
          />
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer whitespace-nowrap w-full sm:w-auto justify-center"
        >
          <Plus className="w-4 h-4" />
          <span>Emitir Retención</span>
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
        <table className="table-fixed w-full text-left text-xs border-collapse">
          <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-xs uppercase tracking-wider border-b border-[#e2e8f0]">
            <tr>
              <th className="py-3 px-4 w-1/12">Fecha</th>
              <th className="py-3 px-4 w-2/12">N° Retención</th>
              <th className="py-3 px-4 w-3/12">Proveedor / RUC</th>
              <th className="py-3 px-4 w-2/12 text-right">Ret. Renta</th>
              <th className="py-3 px-4 w-2/12 text-right">Ret. IVA</th>
              <th className="py-3 px-4 w-1/12 text-right font-black">Total Retenido</th>
              <th className="py-3 px-4 w-1/12 text-center">RIDE</th>
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
                  <td className="py-3 px-4 font-mono font-bold text-[#004ac6]">{w.documentNumber}<span className="block text-[10px] text-slate-600">{w.statusLabel}</span></td>
                  <td className="py-3 px-4">
                    <div className="font-bold text-[#0b1c30]">{w.supplierName}</div>
                    <div className="text-[11px] font-mono text-[#737686]">{w.supplierRuc}</div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-medium text-[#434655]">
                    ${w.rentaAmount.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-medium text-[#434655]">
                    ${w.ivaAmount.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-[#059669]">
                    ${w.totalWithheld.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={w.preview}
                      className="p-1.5 rounded-lg text-[#004ac6] hover:bg-[#eff4ff]"
                      title="Ver retención"
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

      <WithholdingModal isOpen={isModalOpen || !!initialInvoice} initialPurchaseId={initialInvoice?.id}
        onClose={handleCloseModal} onSuccess={doc => {
          if (isFiscalAuthorized(doc)) showSuccess("Retención autorizada por el SRI", doc.documentNumber);
          else showWarning(fiscalStateLabel(doc), "Consulta la respuesta del SRI desde Facturación SRI → Retenciones.");
          setFiscalPreview(doc);
        }} />
      <RidePreviewModal isOpen={!!fiscalPreview} onClose={() => setFiscalPreview(null)}
        withholding={fiscalPreview} companyConfig={sriCompanyConfig} />

      {/* RIDE Preview Modal */}
      {selectedWithholding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 print:p-0 print:bg-white print:static">
          <div className="bg-white rounded-xl shadow-2xl border border-[#e2e8f0] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150 print:shadow-none print:border-none print:max-h-none">
            <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between bg-slate-900 text-white print:hidden">
              <div>
                <h3 className="text-base font-bold text-white">
                  Registro histórico de retención
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  {selectedWithholding.documentNumber}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    printHtmlElement(
                      withholdingPrintRef.current,
                      `Retencion-${selectedWithholding.documentNumber}`,
                      "a4"
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#004ac6] hover:bg-[#003ca3] text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir registro</span>
                </button>
                <button
                  onClick={() => setSelectedWithholding(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div
              id="withholding-print-area"
              ref={withholdingPrintRef}
              className="p-6 space-y-4 overflow-y-auto flex-1 text-xs bg-white"
            >
              <p className="font-bold text-amber-800">REGISTRO LOCAL · AUTORIZACIÓN SRI SIN VERIFICAR</p>
              {/* Header con Logo INNTEL CORP */}
              <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#e2e8f0]">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-14 rounded-lg bg-white border border-slate-200 p-1.5 flex items-center justify-center shrink-0">
                    <img
                      src="/logo-inntel.webp"
                      alt="INNTEL CORP S.A."
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900">
                      {sriCompanyConfig?.razonSocial || "INNTEL CORP S.A."}
                    </h4>
                    <p className="text-[11px] font-semibold text-[#004ac6]">
                      {sriCompanyConfig?.nombreComercial || "INNTEL CORP - SOLUCIONES INTEGRALES"}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {sriCompanyConfig?.direccionMatriz || "Av. Amazonas N45-12 y Gaspar de Villarroel, Quito"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-black text-slate-900">
                    R.U.C.: {sriCompanyConfig?.ruc || "1792458921001"}
                  </div>
                  <div className="text-xs font-black text-[#004ac6] uppercase">
                    REGISTRO HISTÓRICO DE RETENCIÓN
                  </div>
                  <div className="font-mono font-bold text-slate-800">
                    No. {selectedWithholding.documentNumber}
                  </div>
                </div>
              </div>

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

              <div className="rounded-xl border border-[#e2e8f0] overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-900 text-white text-[11px] font-bold">
                    <tr>
                      <th className="py-2 px-3">Impuesto</th>
                      <th className="py-2 px-3 text-right">Base Imponible</th>
                      <th className="py-2 px-3 text-right">% Retención</th>
                      <th className="py-2 px-3 text-right">Valor Retenido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e2e8f0]">
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-900">Impuesto a la Renta</td>
                      <td className="py-2 px-3 text-right font-mono">${selectedWithholding.rentaBase.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold">{selectedWithholding.rentaPercentage}%</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-[#059669]">${selectedWithholding.rentaAmount.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-900">IVA</td>
                      <td className="py-2 px-3 text-right font-mono">${selectedWithholding.ivaBase.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold">{selectedWithholding.ivaPercentage}%</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-[#059669]">${selectedWithholding.ivaAmount.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-6 py-3 border-t border-[#e2e8f0] flex justify-between items-center print:hidden">
              <span className="text-[11px] text-[#737686] flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#059669]" />
                Comprobante tributario válido SRI Ecuador
              </span>
              <button
                onClick={() => setSelectedWithholding(null)}
                className="px-4 py-2 bg-[#0b1c30] text-white rounded-xl text-xs font-bold hover:bg-[#1a2e47] cursor-pointer"
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
