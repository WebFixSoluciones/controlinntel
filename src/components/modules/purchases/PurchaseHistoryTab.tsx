"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { canAccessSubmodule, canUser } from "@/lib/permissions";
import { inReportPeriod } from "@/lib/company-reporting";
import { cents, money } from "@/lib/commercial-core";
import {
  Search,
  Filter,
  Plus,
  Eye,
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
  const { purchaseInvoices, suppliers, currentUser } = useApp();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("todos");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const invalidRange = !!dateFrom && !!dateTo && dateFrom > dateTo;
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

    return !invalidRange && matchSearch && matchSupplier && matchStatus && inReportPeriod(inv.date, dateFrom, dateTo);
  });

  return (
    <div className="space-y-6">
      {/* Filter and Search Bar with Action Button */}
      <div className="flex flex-wrap items-end justify-between gap-3 p-3 bg-white rounded-xl border border-[#e2e8f0] shadow-2xs">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-[#737686] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por proveedor, RUC, factura o clave..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#f8f9ff] border border-[#e2e8f0] rounded-lg text-xs text-[#0b1c30] placeholder-[#737686] focus:outline-hidden focus:border-[#004ac6] focus:bg-white transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Supplier Filter */}
          <select
            aria-label="Filtrar por proveedor"
            value={filterSupplier}
            onChange={(e) => setFilterSupplier(e.target.value)}
            className="px-3 py-2 bg-[#f8f9ff] border border-[#e2e8f0] rounded-lg text-xs font-medium text-[#434655] focus:outline-hidden focus:border-[#004ac6] focus:bg-white cursor-pointer"
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
            aria-label="Filtrar por estado de pago"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-[#f8f9ff] border border-[#e2e8f0] rounded-lg text-xs font-medium text-[#434655] focus:outline-hidden focus:border-[#004ac6] focus:bg-white cursor-pointer"
          >
            <option value="todos">Todos los Estados</option>
            <option value="pagado">Pagado</option>
            <option value="abono_parcial">Abono Parcial</option>
            <option value="pendiente">Pendiente</option>
          </select>

          <label className="text-xs text-slate-600">Desde
            <input type="date" value={dateFrom} max={dateTo || undefined} aria-invalid={invalidRange} aria-describedby={invalidRange ? "purchase-date-error" : undefined}
              onChange={event => setDateFrom(event.target.value)} className="ml-2 rounded-lg border border-[#e2e8f0] bg-white px-2 py-2 text-xs" />
          </label>
          <label className="text-xs text-slate-600">Hasta
            <input type="date" value={dateTo} min={dateFrom || undefined} aria-invalid={invalidRange} aria-describedby={invalidRange ? "purchase-date-error" : undefined}
              onChange={event => setDateTo(event.target.value)} className="ml-2 rounded-lg border border-[#e2e8f0] bg-white px-2 py-2 text-xs" />
          </label>
          <button type="button" onClick={() => { setDateFrom(""); setDateTo(""); setSearchQuery(""); setFilterSupplier("todos"); setFilterStatus("todos"); }}
            className="rounded-lg border border-[#e2e8f0] px-3 py-2 text-xs text-slate-600">Limpiar filtros</button>
          <button
            disabled={!canAccessSubmodule(currentUser, "compras", "registrar_compra") || !canUser(currentUser, "compras", "canRegisterPurchase")}
            onClick={onOpenNewPurchase}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Compra</span>
          </button>
        </div>
      </div>

      {invalidRange && <p id="purchase-date-error" role="alert" className="text-xs text-red-600">La fecha Desde no puede ser posterior a Hasta.</p>}
      <p role="status" className="text-xs text-slate-600 tabular-nums">{filteredInvoices.length} de {purchaseInvoices.length} compras · Total filtrado: ${money(filteredInvoices.reduce((sum, invoice) => sum + cents(invoice.total), 0)).toFixed(2)}</p>

      {/* Table of Invoices */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-fixed w-full text-left text-xs border-collapse min-w-[1100px]">
            <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-xs uppercase tracking-wider border-b border-[#e2e8f0]">
              <tr>
                <th className="py-3 px-4 w-1/12">Fecha</th>
                <th className="py-3 px-4 w-2/12">N° Comprobante</th>
                <th className="py-3 px-4 w-3/12">Proveedor / RUC</th>
                <th className="py-3 px-4 w-1/12 text-center">Condición</th>
                <th className="py-3 px-4 w-1/12 text-right">Subtotal</th>
                <th className="py-3 px-4 w-1/12 text-right">IVA</th>
                <th className="py-3 px-4 w-1/12 text-right font-black">Total Factura</th>
                <th className="py-3 px-4 w-1/12 text-center">Estado Pago</th>
                <th className="py-3 px-4 w-1/12 text-center">Inventario</th>
                <th className="py-3 px-4 w-1/12 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-xs text-[#737686] italic">
                    No se encontraron comprobantes de compra con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const isPaid = inv.paymentStatus === "pagado";
                  const isPartial = inv.paymentStatus === "abono_parcial";

                  return (
                    <tr key={inv.id} className="hover:bg-[#f8f9ff] transition-colors">
                      <td className="py-3 px-4 font-medium text-[#0b1c30] whitespace-nowrap">
                        {String(inv.date || "").slice(0, 10)}
                      </td>

                      <td className="py-3 px-4 font-mono font-bold text-[#004ac6] whitespace-nowrap">
                        {inv.documentNumber}
                      </td>

                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-bold text-[#0b1c30] truncate" title={inv.supplierName}>
                          {inv.supplierName}
                        </div>
                        <div className="text-xs font-mono text-[#737686]">
                          {inv.supplierRuc}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold ${
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
                          className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${
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
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold ${
                            inv.inventoryStatus === "ingresado"
                              ? "bg-[#eff4ff] text-[#004ac6] border border-[#bfdbfe]"
                              : "bg-[#f1f5f9] text-[#64748b] border border-[#cbd5e1]"
                          }`}
                        >
                          {inv.inventoryStatus === "ingresado" ? "Ingresado" : "N/A"}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setSelectedInvoice(inv)}
                            className="p-1.5 rounded-lg text-[#004ac6] hover:bg-[#eff4ff] transition-colors cursor-pointer"
                            title="Ver Detalle"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {onOpenWithholdingForInvoice && canAccessSubmodule(currentUser, "compras", "retenciones") && canUser(currentUser, "compras", "canEmitWithholding") && (
                            <button
                              onClick={() => onOpenWithholdingForInvoice(inv)}
                              className="p-1.5 rounded-lg text-[#059669] hover:bg-[#ecfdf5] transition-colors cursor-pointer"
                              title="Emitir Retención SRI"
                            >
                              <Percent className="w-4 h-4" />
                            </button>
                          )}

                          {onOpenCreditNoteForInvoice && canAccessSubmodule(currentUser, "compras", "notas_credito") && canUser(currentUser, "compras", "canRegisterPurchase") && (
                            <button
                              onClick={() => onOpenCreditNoteForInvoice(inv)}
                              className="p-1.5 rounded-lg text-[#b45309] hover:bg-[#fffbeb] transition-colors cursor-pointer"
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
          <div className="bg-white rounded-xl shadow-2xl border border-[#e2e8f0] w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8f9ff]">
              <div>
                <h3 className="text-base font-bold text-[#0b1c30]">
                  Factura de Proveedor: {selectedInvoice.documentNumber}
                </h3>
                <p className="text-xs text-[#737686]">
                  {selectedInvoice.supplierName} • <span className="font-mono">RUC: {selectedInvoice.supplierRuc}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="p-1.5 rounded-lg text-[#737686] hover:bg-[#e2e8f0] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Clave de Acceso */}
              {selectedInvoice.claveAcceso && (
                <div className="p-3 bg-[#f8f9ff] rounded-lg border border-[#e2e8f0] text-xs">
                  <div className="text-xs font-bold text-[#737686] uppercase tracking-wider">
                    Clave de Acceso SRI (49 dígitos)
                  </div>
                  <div className="font-mono text-xs text-[#004ac6] break-all select-all font-medium mt-0.5">
                    {selectedInvoice.claveAcceso}
                  </div>
                </div>
              )}

              {/* Items List */}
              <div className="border border-[#e2e8f0] rounded-lg overflow-hidden">
                <table className="table-fixed w-full text-left text-xs">
                  <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-xs uppercase tracking-wider border-b border-[#e2e8f0]">
                    <tr>
                      <th className="py-2.5 px-3 w-6/12">Ítem / Descripción</th>
                      <th className="py-2.5 px-3 w-2/12 text-center">Cant.</th>
                      <th className="py-2.5 px-3 w-2/12 text-right">Costo Unit.</th>
                      <th className="py-2.5 px-3 w-2/12 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f5f9]">
                    {selectedInvoice.items?.map((it, idx) => (
                      <tr key={idx} className="hover:bg-[#f8f9ff]">
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-[#0b1c30]">{it.name}</div>
                          {it.sku && <div className="text-xs text-[#737686] font-mono">SKU: {it.sku}</div>}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">{it.quantity}</td>
                        <td className="py-2.5 px-3 text-right font-mono">${it.unitCost.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-[#0b1c30]">${it.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial State */}
              <div className="p-4 bg-[#f8f9ff] rounded-lg border border-[#e2e8f0] grid grid-cols-2 gap-3 text-xs">
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
                className="px-4 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
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
