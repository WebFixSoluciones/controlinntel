"use client";

import { createSearchMatcher } from "@/lib/search";
import { compareDocumentsDescending } from "@/lib/sales-policy";

import { DocumentTablePagination, useDocumentPagination } from "@/components/ui/DocumentTablePagination";
import { ActionIconButton } from "@/components/ui/ActionIconButton";
import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { canAccessSubmodule, canUser } from "@/lib/permissions";
import { inReportPeriod } from "@/lib/company-reporting";
import { cents, money } from "@/lib/commercial-core";
import {
  Search,
  Plus,
  Layers,
  Percent,
  X,
} from "lucide-react";
import { PurchaseInvoice } from "@/types";
import { PurchaseCorrectionDialog } from "./PurchaseCorrectionDialog";

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
  const [correction, setCorrection] = useState<{ invoice: PurchaseInvoice; mode: "edit" | "delete" } | null>(null);
  const activeInvoices = purchaseInvoices.filter(inv => inv.status !== "anulada");

  // Filters
  const matches = createSearchMatcher(searchQuery);
  const filteredInvoices = purchaseInvoices.filter((inv) => {
    const matchSearch = matches(inv.supplierName, inv.supplierRuc, inv.documentNumber, inv.claveAcceso);

    const matchSupplier =
      filterSupplier === "todos" || inv.supplierId === filterSupplier;

    const matchStatus =
      filterStatus === "eliminadas" ? inv.status === "anulada" : inv.status !== "anulada" && (filterStatus === "todos" || inv.paymentStatus === filterStatus);

    return !invalidRange && matchSearch && matchSupplier && matchStatus && inReportPeriod(inv.date, dateFrom, dateTo);
  }).sort(compareDocumentsDescending);

  const invoicesPage = useDocumentPagination(filteredInvoices, [searchQuery, filterSupplier, filterStatus, dateFrom, dateTo]);

  return (
    <div className="space-y-3">
      {/* Filter and Search Bar with Action Button */}
      <div className="ui-toolbar flex flex-wrap items-center justify-between bg-white rounded-xl border border-[#e2e8f0]">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-[#737686] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            aria-label="Buscar compras"
            placeholder="Buscar por proveedor, RUC, factura o clave..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="ui-cell-control w-full !pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          {/* Supplier Filter */}
          <select
            aria-label="Filtrar por proveedor"
            value={filterSupplier}
            onChange={(e) => setFilterSupplier(e.target.value)}
            className="ui-cell-control max-w-full cursor-pointer"
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
            className="ui-cell-control cursor-pointer"
          >
            <option value="todos">Todos los Estados</option>
            <option value="pagado">Pagado</option>
            <option value="abono_parcial">Abono Parcial</option>
            <option value="pendiente">Pendiente</option>
            <option value="eliminadas">Eliminadas</option>
          </select>

          <label className="flex items-center gap-1.5 text-xs">Desde
            <input type="date" value={dateFrom} max={dateTo || undefined} aria-invalid={invalidRange} aria-describedby={invalidRange ? "purchase-date-error" : undefined}
              onChange={event => setDateFrom(event.target.value)} className="ui-cell-control" />
          </label>
          <label className="flex items-center gap-1.5 text-xs">Hasta
            <input type="date" value={dateTo} min={dateFrom || undefined} aria-invalid={invalidRange} aria-describedby={invalidRange ? "purchase-date-error" : undefined}
              onChange={event => setDateTo(event.target.value)} className="ui-cell-control" />
          </label>
          <button type="button" onClick={() => { setDateFrom(""); setDateTo(""); setSearchQuery(""); setFilterSupplier("todos"); setFilterStatus("todos"); }}
            className="ui-cell-control cursor-pointer hover:text-[#004ac6]">Limpiar filtros</button>
          <button
            disabled={!canAccessSubmodule(currentUser, "compras", "registrar_compra") || !canUser(currentUser, "compras", "canRegisterPurchase")}
            onClick={onOpenNewPurchase}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar compra</span>
          </button>
        </div>
      </div>

      {invalidRange && <p id="purchase-date-error" role="alert" className="text-xs text-red-600">La fecha Desde no puede ser posterior a Hasta.</p>}
      <p role="status" className="text-xs tabular-nums">{filteredInvoices.length} de {filterStatus === "eliminadas" ? purchaseInvoices.length - activeInvoices.length : activeInvoices.length} compras {filterStatus === "eliminadas" ? "eliminadas" : "activas"} · Total filtrado: ${money(filteredInvoices.reduce((sum, invoice) => sum + cents(invoice.total), 0)).toFixed(2)}</p>

      {/* Table of Invoices */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
        <div className="ui-table-scroll" role="region" aria-label="Historial de compras" tabIndex={0}>
          <table className="table-fixed w-full min-w-[55rem] text-left border-collapse">
            <thead className="bg-[#f8f9ff] text-[#004ac6] font-semibold border-b border-[#e2e8f0]">
              <tr>
                <th scope="col" className="w-[4.5rem] px-2 py-2">Fecha</th>
                <th scope="col" className="w-[8rem] px-2 py-2">Comprobante</th>
                <th scope="col" className="px-2 py-2">Proveedor / RUC</th>
                <th scope="col" className="w-16 px-2 py-2 text-center">Condición</th>
                <th scope="col" className="w-[4.5rem] px-2 py-2 text-right">Subtotal</th>
                <th scope="col" className="w-16 px-2 py-2 text-right">IVA</th>
                <th scope="col" className="w-[4.5rem] px-2 py-2 text-right">Total</th>
                <th scope="col" className="w-[5.5rem] px-2 py-2 text-center">Estado de pago</th>
                <th scope="col" className="w-[4.5rem] px-2 py-2 text-center">Inventario</th>
                <th scope="col" className="w-[calc(var(--ui-row-control)*5+32px)] px-2 py-2 text-right">Acciones</th>
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
                invoicesPage.rows.map((inv) => {
                  const isPaid = inv.paymentStatus === "pagado";
                  const isPartial = inv.paymentStatus === "abono_parcial";

                  return (
                    <tr key={inv.id} className="hover:bg-[#f8f9ff] transition-colors">
                      <td className="px-2 py-1.5 tabular-nums whitespace-nowrap">
                        {String(inv.date || "").slice(0, 10)}
                      </td>

                      <td className="px-2 py-1.5 font-semibold tabular-nums [overflow-wrap:anywhere]">
                        {inv.documentNumber}
                      </td>

                      <td className="px-2 py-1.5">
                        <div className="font-semibold truncate" title={inv.supplierName}>
                          {inv.supplierName}
                        </div>
                        <div className="ui-cell-meta">
                          {inv.supplierRuc}
                        </div>
                      </td>

                      <td className="px-2 py-1.5 text-center">
                        {inv.paymentCondition === "contado" ? "Contado" : "Crédito"}
                      </td>

                      <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">
                        ${inv.subtotal.toFixed(2)}
                      </td>

                      <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">
                        ${inv.ivaAmount.toFixed(2)}
                      </td>

                      <td className="px-2 py-1.5 text-right font-semibold tabular-nums whitespace-nowrap">
                        ${inv.total.toFixed(2)}
                      </td>

                      <td className="px-2 py-1.5 text-center">
                        <span className="ui-badge">
                          {inv.status === "anulada" ? "Eliminada" : isPaid ? "Pagado" : isPartial ? "Abono parcial" : "Pendiente"}
                        </span>
                      </td>

                      <td className="px-2 py-1.5 text-center">
                        {inv.inventoryStatus === "ingresado" ? inv.status === "anulada" ? "Revertido" : "Ingresado" : "N/A"}
                      </td>

                      <td className="px-2 py-1.5 text-right">
                        <div className="ui-table-actions">
                          <ActionIconButton action="view"
                            onClick={() => setSelectedInvoice(inv)}
                            title="Ver detalle"
                            label={`Ver detalle de la compra ${inv.documentNumber}`}
                          />

                          {inv.status !== "anulada" && canUser(currentUser, "compras", "canEditPurchase") && <ActionIconButton action="edit" onClick={() => setCorrection({ invoice: inv, mode: "edit" })} title="Editar compra" label={`Editar compra ${inv.documentNumber}`} />}
                          {inv.status !== "anulada" && canUser(currentUser, "compras", "canDeletePurchase") && <ActionIconButton action="delete" onClick={() => setCorrection({ invoice: inv, mode: "delete" })} title="Eliminar compra" label={`Eliminar compra ${inv.documentNumber}`} />}

                          {inv.status !== "anulada" && onOpenWithholdingForInvoice && canAccessSubmodule(currentUser, "compras", "retenciones") && canUser(currentUser, "compras", "canEmitWithholding") && (
                            <button
                              type="button"
                              onClick={() => onOpenWithholdingForInvoice(inv)}
                              className="ui-icon-button"
                              title="Emitir retención SRI"
                              aria-label="Emitir retención SRI"
                            >
                              <Percent aria-hidden="true" />
                            </button>
                          )}

                          {inv.status !== "anulada" && onOpenCreditNoteForInvoice && canAccessSubmodule(currentUser, "compras", "notas_credito") && canUser(currentUser, "compras", "canRegisterPurchase") && (
                            <button
                              type="button"
                              onClick={() => onOpenCreditNoteForInvoice(inv)}
                              className="ui-icon-button"
                              title="Registrar nota de crédito"
                              aria-label="Registrar nota de crédito"
                            >
                              <Layers aria-hidden="true" />
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
        <DocumentTablePagination {...invoicesPage.controls} />
      </div>

      {correction && <PurchaseCorrectionDialog key={`${correction.mode}-${correction.invoice.id}`} invoice={correction.invoice} mode={correction.mode} onClose={() => setCorrection(null)} />}

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
              {selectedInvoice.status === "anulada" && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><strong>Compra eliminada</strong><p>{selectedInvoice.cancellationReason}</p><p>{selectedInvoice.cancelledAt?.slice(0, 10)} · Responsable: {selectedInvoice.cancelledBy}</p><p>Pagos revertidos: ${(selectedInvoice.cancelledPaidAmount || 0).toFixed(2)}</p></div>}
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
                  <strong className="text-[#0b1c30] capitalize">{selectedInvoice.status === "anulada" ? "Eliminada" : selectedInvoice.paymentStatus}</strong>
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
