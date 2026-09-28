"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import {
  Search,
  Filter,
  FileText,
  Plus,
  Eye,
  CheckCircle,
  Clock,
  AlertTriangle,
  Building2,
  Calendar,
  Layers,
  Percent,
  X,
  CreditCard,
} from "lucide-react";
import { PurchaseInvoice } from "@/types";

interface PurchaseHistoryTabProps {
  onOpenNewPurchase: () => void;
  onOpenWithholdingForInvoice?: (invoice: PurchaseInvoice) => void;
  onOpenCreditNoteForInvoice?: (invoice: PurchaseInvoice) => void;
}

export function PurchaseHistoryTab({
  onOpenNewPurchase,
  onOpenWithholdingForInvoice,
  onOpenCreditNoteForInvoice,
}: PurchaseHistoryTabProps) {
  const { purchaseInvoices, suppliers, inventoryWarehouses } = useApp();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("todos");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null);

  // Filters
  const filteredInvoices = purchaseInvoices.filter((inv) => {
    const query = searchQuery.toLowerCase();
    const matchSearch =
      inv.supplierName.toLowerCase().includes(query) ||
      inv.supplierRuc.includes(query) ||
      inv.documentNumber.includes(query) ||
      (inv.claveAcceso && inv.claveAcceso.includes(query));

    const matchSupplier =
      filterSupplier === "todos" || inv.supplierId === filterSupplier;

    const matchStatus =
      filterStatus === "todos" || inv.paymentStatus === filterStatus;

    return matchSearch && matchSupplier && matchStatus;
  });

  // KPI Calculations
  const totalPurchases = purchaseInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const totalPaid = purchaseInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
  const totalPending = purchaseInvoices.reduce((sum, inv) => sum + (inv.balanceRemaining || 0), 0);
  const totalCount = purchaseInvoices.length;

  return (
    <div className="space-y-6 select-none">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs">
          <div className="flex items-center justify-between text-[#737686] text-xs font-semibold">
            <span>Total Compras Acumulado</span>
            <div className="p-2 bg-[#eff4ff] text-[#004ac6] rounded-xl">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-[#0b1c30]">
            ${totalPurchases.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="mt-1 text-[11px] text-[#737686]">
            {totalCount} comprobantes mercantiles
          </p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs">
          <div className="flex items-center justify-between text-[#737686] text-xs font-semibold">
            <span>Compras Liquidadas</span>
            <div className="p-2 bg-[#ecfdf5] text-[#059669] rounded-xl">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-[#059669]">
            ${totalPaid.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="mt-1 text-[11px] text-[#059669] font-medium">
            Pagos de contado y abonos conciliados
          </p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs">
          <div className="flex items-center justify-between text-[#737686] text-xs font-semibold">
            <span>Saldo Pendiente (CxP)</span>
            <div className="p-2 bg-[#fffbeb] text-[#b45309] rounded-xl">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-[#b45309]">
            ${totalPending.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="mt-1 text-[11px] text-[#b45309] font-medium">
            Obligaciones comerciales por pagar
          </p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#737686] text-xs font-semibold">
            <span>Acción Rápida</span>
            <div className="p-2 bg-[#eff4ff] text-[#004ac6] rounded-xl">
              <Plus className="w-4 h-4" />
            </div>
          </div>
          <button
            onClick={onOpenNewPurchase}
            className="w-full mt-3 py-2 px-3 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Nueva Compra</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-[#737686] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por proveedor, RUC, factura o clave..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#f8f9ff] border border-[#e2e8f0] rounded-xl text-xs text-[#0b1c30] placeholder-[#737686] focus:outline-hidden focus:border-[#004ac6] transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Supplier Filter */}
          <select
            value={filterSupplier}
            onChange={(e) => setFilterSupplier(e.target.value)}
            className="px-3 py-2 bg-[#f8f9ff] border border-[#e2e8f0] rounded-xl text-xs font-medium text-[#434655] focus:outline-hidden focus:border-[#004ac6]"
          >
            <option value="todos">Todos los Proveedores</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.razonSocial}
              </option>
            ))}
          </select>

          {/* Payment Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-[#f8f9ff] border border-[#e2e8f0] rounded-xl text-xs font-medium text-[#434655] focus:outline-hidden focus:border-[#004ac6]"
          >
            <option value="todos">Todos los Estados</option>
            <option value="pagado">Pagado</option>
            <option value="abono_parcial">Abono Parcial</option>
            <option value="pendiente">Pendiente</option>
          </select>
        </div>
      </div>

      {/* Table of Invoices */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#f8f9ff] text-[#434655] border-b border-[#e2e8f0]">
              <tr>
                <th className="py-3 px-4 font-bold">Fecha</th>
                <th className="py-3 px-4 font-bold">N° Comprobante</th>
                <th className="py-3 px-4 font-bold">Proveedor / RUC</th>
                <th className="py-3 px-4 font-bold text-center">Condición</th>
                <th className="py-3 px-4 font-bold text-right">Subtotal</th>
                <th className="py-3 px-4 font-bold text-right">IVA</th>
                <th className="py-3 px-4 font-bold text-right">Total Factura</th>
                <th className="py-3 px-4 font-bold text-center">Estado Pago</th>
                <th className="py-3 px-4 font-bold text-center">Inventario</th>
                <th className="py-3 px-4 font-bold text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0]">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-xs text-[#737686]">
                    No se encontraron comprobantes de compra con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const isPaid = inv.paymentStatus === "pagado";
                  const isPartial = inv.paymentStatus === "abono_parcial";

                  return (
                    <tr key={inv.id} className="hover:bg-[#f8f9ff]/60 transition-colors">
                      <td className="py-3 px-4 font-medium text-[#0b1c30] whitespace-nowrap">
                        {inv.date}
                      </td>

                      <td className="py-3 px-4 font-mono font-bold text-[#004ac6] whitespace-nowrap">
                        {inv.documentNumber}
                      </td>

                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-bold text-[#0b1c30] truncate" title={inv.supplierName}>
                          {inv.supplierName}
                        </div>
                        <div className="text-[11px] font-mono text-[#737686]">
                          {inv.supplierRuc}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            inv.paymentCondition === "contado"
                              ? "bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0]"
                              : "bg-[#eff4ff] text-[#004ac6] border border-[#bfdbfe]"
                          }`}
                        >
                          {inv.paymentCondition === "contado" ? "Contado" : "Crédito"}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-medium text-[#434655]">
                        ${inv.subtotal.toFixed(2)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-medium text-[#737686]">
                        ${inv.ivaAmount.toFixed(2)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-[#0b1c30]">
                        ${inv.total.toFixed(2)}
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            isPaid
                              ? "bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0]"
                              : isPartial
                              ? "bg-[#fffbeb] text-[#b45309] border border-[#fde68a]"
                              : "bg-[#fef2f2] text-[#dc2626] border border-[#fecaca]"
                          }`}
                        >
                          {isPaid ? "Pagado" : isPartial ? "Abono Parcial" : "Pendiente"}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            inv.inventoryStatus === "ingresado"
                              ? "bg-[#eff4ff] text-[#004ac6] border border-[#bfdbfe]"
                              : "bg-[#f1f5f9] text-[#64748b] border border-[#cbd5e1]"
                          }`}
                        >
                          {inv.inventoryStatus === "ingresado" ? "Ingresado" : "N/A"}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setSelectedInvoice(inv)}
                            className="p-1.5 rounded-lg text-[#004ac6] hover:bg-[#eff4ff] transition-colors"
                            title="Ver Detalle"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {onOpenWithholdingForInvoice && (
                            <button
                              onClick={() => onOpenWithholdingForInvoice(inv)}
                              className="p-1.5 rounded-lg text-[#059669] hover:bg-[#ecfdf5] transition-colors"
                              title="Emitir Retención SRI"
                            >
                              <Percent className="w-4 h-4" />
                            </button>
                          )}

                          {onOpenCreditNoteForInvoice && (
                            <button
                              onClick={() => onOpenCreditNoteForInvoice(inv)}
                              className="p-1.5 rounded-lg text-[#b45309] hover:bg-[#fffbeb] transition-colors"
                              title="Registrar Nota de Crédito"
                            >
                              <Layers className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#e2e8f0] w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8f9ff]">
              <div>
                <h3 className="text-base font-bold text-[#0b1c30]">
                  Factura de Proveedor: {selectedInvoice.documentNumber}
                </h3>
                <p className="text-xs text-[#737686]">
                  {selectedInvoice.supplierName} (RUC: {selectedInvoice.supplierRuc})
                </p>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="p-1.5 rounded-lg text-[#737686] hover:bg-[#e2e8f0] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Clave de Acceso */}
              {selectedInvoice.claveAcceso && (
                <div className="p-3 bg-[#f8f9ff] rounded-xl border border-[#e2e8f0] text-xs">
                  <div className="text-[10px] font-bold text-[#737686] uppercase tracking-wider">
                    Clave de Acceso SRI (49 dígitos)
                  </div>
                  <div className="font-mono text-xs text-[#004ac6] break-all select-all font-medium mt-0.5">
                    {selectedInvoice.claveAcceso}
                  </div>
                </div>
              )}

              {/* Items List */}
              <div className="border border-[#e2e8f0] rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#f8f9ff] text-[#434655] border-b border-[#e2e8f0]">
                    <tr>
                      <th className="py-2 px-3 font-bold">Ítem / Descripción</th>
                      <th className="py-2 px-3 font-bold text-center">Cant.</th>
                      <th className="py-2 px-3 font-bold text-right">Costo Unit.</th>
                      <th className="py-2 px-3 font-bold text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e2e8f0]">
                    {selectedInvoice.items?.map((it, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-3">
                          <div className="font-medium text-[#0b1c30]">{it.name}</div>
                          {it.sku && <div className="text-[10px] text-[#737686] font-mono">SKU: {it.sku}</div>}
                        </td>
                        <td className="py-2 px-3 text-center font-mono">{it.quantity}</td>
                        <td className="py-2 px-3 text-right font-mono">${it.unitCost.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold">${it.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial State */}
              <div className="p-4 bg-[#f8f9ff] rounded-xl border border-[#e2e8f0] grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[#737686]">Condición:</span>{" "}
                  <strong className="text-[#0b1c30] capitalize">{selectedInvoice.paymentCondition}</strong>
                </div>
                <div>
                  <span className="text-[#737686]">Estado:</span>{" "}
                  <strong className="text-[#0b1c30] capitalize">{selectedInvoice.paymentStatus}</strong>
                </div>
                <div>
                  <span className="text-[#737686]">Monto Pagado:</span>{" "}
                  <strong className="font-mono text-[#059669]">${selectedInvoice.paidAmount.toFixed(2)}</strong>
                </div>
                <div>
                  <span className="text-[#737686]">Saldo Remanente:</span>{" "}
                  <strong className="font-mono text-[#b45309]">${selectedInvoice.balanceRemaining.toFixed(2)}</strong>
                </div>
              </div>
            </div>

            <div className="px-6 py-3 border-t border-[#e2e8f0] flex justify-end">
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 bg-[#0b1c30] text-white rounded-xl text-xs font-bold hover:bg-[#1a2e47] transition-colors"
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
