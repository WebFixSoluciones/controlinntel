"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { SriInvoice, ClientQuote } from "@/types";
import { NewSaleModal } from "../billing/NewSaleModal";
import { EditSaleModal } from "../billing/EditSaleModal";
import { ConvertToSriInvoiceModal } from "./ConvertToSriInvoiceModal";
import { RidePreviewModal } from "../billing/RidePreviewModal";
import { BillingQuoteModal } from "../billing/BillingQuoteModal";
import { QuotePreviewModal } from "../billing/QuotePreviewModal";
import { RecurringBillingView } from "../billing/RecurringBillingView";
import {
  Receipt,
  Plus,
  Search,
  Filter,
  Printer,
  Edit2,
  Trash2,
  FileCheck2,
  CheckCircle2,
  Clock,
  Layers,
  Calendar,
  DollarSign,
  ChevronRight,
  TrendingUp,
  FileText,
  CreditCard,
} from "lucide-react";

export type SalesTab = "notas_venta" | "nueva_venta" | "cotizaciones" | "recurrentes";

export function SalesManager() {
  const {
    billingInvoices,
    billingQuotes,
    sriCompanyConfig,
    deleteInvoice,
  } = useApp();
  const { showConfirm, showSuccess, showError } = useToast();

  const searchParams = useSearchParams();
  const router = useRouter();
  const subParam = searchParams.get("sub") as SalesTab | null;

  const [activeTab, setActiveTab] = useState<SalesTab>(() => {
    if (subParam) return subParam;
    return "notas_venta";
  });

  useEffect(() => {
    if (subParam) {
      setActiveTab(subParam);
    }
  }, [subParam]);

  const [searchTerm, setSearchTerm] = useState("");
  const [sriFilter, setSriFilter] = useState<"todos" | "pendientes" | "facturadas">("todos");

  // Modals state
  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false);
  const [saleToEdit, setSaleToEdit] = useState<SriInvoice | null>(null);
  const [isEditSaleOpen, setIsEditSaleOpen] = useState(false);
  const [saleToConvert, setSaleToConvert] = useState<SriInvoice | null>(null);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [rideSale, setRideSale] = useState<SriInvoice | null>(null);
  const [isRideOpen, setIsRideOpen] = useState(false);

  // Quotes
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [quoteToPreview, setQuoteToPreview] = useState<ClientQuote | null>(null);

  // Commercial sales (Notas de Venta)
  const salesList = useMemo(() => {
    return billingInvoices.filter((inv) => inv.documentType === "nota_venta");
  }, [billingInvoices]);

  const filteredSales = useMemo(() => {
    return salesList.filter((inv) => {
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !q ||
        inv.documentNumber.toLowerCase().includes(q) ||
        inv.clientName.toLowerCase().includes(q) ||
        (inv.clientRuc && inv.clientRuc.includes(q));

      const isFacturada = inv.sriStatus === "facturada" || Boolean(inv.sriInvoiceId);
      const matchesSri =
        sriFilter === "todos" ||
        (sriFilter === "facturadas" && isFacturada) ||
        (sriFilter === "pendientes" && !isFacturada);

      return matchesSearch && matchesSri;
    });
  }, [salesList, searchTerm, sriFilter]);

  // Totals
  const totalSalesAmount = useMemo(() => {
    return salesList.reduce((sum, inv) => sum + (inv.total || 0), 0);
  }, [salesList]);

  const pendingSriCount = useMemo(() => {
    return salesList.filter((inv) => inv.sriStatus !== "facturada" && !inv.sriInvoiceId).length;
  }, [salesList]);

  // Actions
  const handleDeleteSale = (sale: SriInvoice) => {
    showConfirm(
      "¿Eliminar Nota de Venta?",
      `¿Confirmas la eliminación definitiva del comprobante comercial ${sale.documentNumber} (${sale.clientName})? ${
        sale.kardexRegistered
          ? "El stock de los productos se devolverá automáticamente a bodega."
          : ""
      }`,
      async () => {
        try {
          await deleteInvoice(sale.id);
          showSuccess("Venta Eliminada", `La nota de venta ${sale.documentNumber} fue eliminada exitosamente.`);
        } catch (err: any) {
          showError("Error al Eliminar", err?.message || "No se pudo eliminar la venta.");
        }
      },
      "Eliminar Comprobante"
    );
  };

  return (
    <div className="space-y-6 animate-fade-in select-none">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-[#004ac6] text-white shadow-xs">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Ventas Comerciales</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Emisión de Notas de Venta operativas, cotizaciones y ventas recurrentes con pase selectivo a Facturación SRI.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setIsNewSaleOpen(true)}
            className="px-4 py-2.5 bg-[#004ac6] hover:bg-[#003da6] text-white text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Nota de Venta</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto scrollbar-thin">
        {[
          { key: "notas_venta", label: "Notas de Venta", icon: Receipt, count: salesList.length },
          { key: "cotizaciones", label: "Cotizaciones", icon: FileText, count: billingQuotes.length },
          { key: "recurrentes", label: "Recurrentes", icon: Clock },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key as SalesTab);
                router.replace(`/ventas?sub=${tab.key}`);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                isActive
                  ? "bg-[#004ac6] text-white shadow-xs"
                  : "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {typeof tab.count === "number" && (
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
                    isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: NOTAS DE VENTA */}
      {activeTab === "notas_venta" && (
        <div className="space-y-4">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 font-medium block">Total Notas de Venta</span>
                <span className="text-xl font-bold font-mono text-slate-900 mt-1 block">
                  ${totalSalesAmount.toFixed(2)}
                </span>
              </div>
              <div className="p-3 bg-blue-50 text-[#004ac6] rounded-xl">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 font-medium block">Comprobantes Registrados</span>
                <span className="text-xl font-bold font-mono text-slate-900 mt-1 block">
                  {salesList.length}
                </span>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <Receipt className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 font-medium block">Pendientes de Facturar SRI</span>
                <span className="text-xl font-bold font-mono text-amber-600 mt-1 block">
                  {pendingSriCount}
                </span>
              </div>
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <FileCheck2 className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Buscar por cliente, RUC o número..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-slate-800 focus:outline-none focus:border-[#004ac6]"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-slate-500 font-medium">Estado SRI:</span>
              <select
                value={sriFilter}
                onChange={(e) => setSriFilter(e.target.value as any)}
                className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:border-[#004ac6]"
              >
                <option value="todos">Todos los comprobantes</option>
                <option value="pendientes">Pendientes de Facturar SRI</option>
                <option value="facturadas">Facturadas al SRI</option>
              </select>
            </div>
          </div>

          {/* Sales Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                  <th className="py-3 px-4">Nro. Comprobante</th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Método de Pago</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-center">Estado SRI</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 italic">
                      No se encontraron notas de venta registradas.
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((sale) => {
                    const isFacturada = sale.sriStatus === "facturada" || Boolean(sale.sriInvoiceId);
                    return (
                      <tr key={sale.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          {sale.documentNumber}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {sale.date}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-900 block">{sale.clientName}</span>
                          <span className="text-[11px] font-mono text-slate-500">RUC: {sale.clientRuc}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="capitalize font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                            {sale.paymentMethod || "transferencia"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                          ${(sale.total || 0).toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {isFacturada ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              Facturada SRI ({sale.sriDocumentNumber || "01"})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-[#004ac6] border border-blue-200">
                              <Clock className="w-3 h-3" />
                              Venta Comercial (Pendiente SRI)
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {/* Ver / Imprimir RIDE */}
                            <button
                              onClick={() => {
                                setRideSale(sale);
                                setIsRideOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-slate-600 hover:text-[#004ac6] hover:bg-blue-50 transition cursor-pointer"
                              title="Ver / Imprimir Comprobante"
                            >
                              <Printer className="w-4 h-4" />
                            </button>

                            {/* Editar Nota de Venta */}
                            <button
                              onClick={() => {
                                setSaleToEdit(sale);
                                setIsEditSaleOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-slate-600 hover:text-amber-600 hover:bg-amber-50 transition cursor-pointer"
                              title="Editar Nota de Venta"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            {/* Pasar a Factura Electrónica SRI */}
                            {!isFacturada && (
                              <button
                                onClick={() => {
                                  setSaleToConvert(sale);
                                  setIsConvertModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg text-[#004ac6] hover:text-white hover:bg-[#004ac6] bg-blue-50 transition cursor-pointer font-bold flex items-center gap-1 text-[11px] px-2"
                                title="Pasar a Factura Electrónica SRI"
                              >
                                <FileCheck2 className="w-3.5 h-3.5" />
                                <span>Facturar SRI</span>
                              </button>
                            )}

                            {/* Eliminar Nota de Venta */}
                            <button
                              onClick={() => handleDeleteSale(sale)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                              title="Eliminar Nota de Venta"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
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
      )}

      {/* TAB 2: COTIZACIONES */}
      {activeTab === "cotizaciones" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Cotizaciones y Proformas Comerciales</h3>
              <p className="text-xs text-slate-500">
                Gestiona cotizaciones emitidas con opción de conversión a nota de venta o factura.
              </p>
            </div>
            <button
              onClick={() => setIsQuoteModalOpen(true)}
              className="px-4 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Cotización</span>
            </button>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                  <th className="py-2.5 px-4">Nro. Cotización</th>
                  <th className="py-2.5 px-4">Fecha</th>
                  <th className="py-2.5 px-4">Cliente</th>
                  <th className="py-2.5 px-4 text-right">Total</th>
                  <th className="py-2.5 px-4 text-center">Estado</th>
                  <th className="py-2.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {billingQuotes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                      No hay cotizaciones registradas.
                    </td>
                  </tr>
                ) : (
                  billingQuotes.map((q) => (
                    <tr key={q.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{q.quoteNumber}</td>
                      <td className="py-3 px-4 text-slate-600">{q.date}</td>
                      <td className="py-3 px-4 font-medium text-slate-800">{q.clientName}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        ${q.total.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="capitalize px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {q.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setQuoteToPreview(q)}
                          className="p-1.5 text-slate-600 hover:text-[#004ac6] hover:bg-blue-50 rounded-lg transition"
                          title="Ver Cotización"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: VENTAS RECURRENTES */}
      {activeTab === "recurrentes" && <RecurringBillingView />}

      {/* Modals */}
      <NewSaleModal
        isOpen={isNewSaleOpen}
        onClose={() => setIsNewSaleOpen(false)}
        onSuccess={() => {
          showSuccess("Venta Creada", "La Nota de Venta fue emitida exitosamente.");
        }}
      />

      <EditSaleModal
        isOpen={isEditSaleOpen}
        invoice={saleToEdit}
        onClose={() => {
          setIsEditSaleOpen(false);
          setSaleToEdit(null);
        }}
        onSuccess={(updated) => {
          showSuccess("Venta Actualizada", `La Nota de Venta ${updated.documentNumber} fue guardada exitosamente.`);
        }}
      />

      <ConvertToSriInvoiceModal
        isOpen={isConvertModalOpen}
        sale={saleToConvert}
        onClose={() => {
          setIsConvertModalOpen(false);
          setSaleToConvert(null);
        }}
      />

      <RidePreviewModal
        isOpen={isRideOpen}
        onClose={() => {
          setIsRideOpen(false);
          setRideSale(null);
        }}
        invoice={rideSale}
        companyConfig={sriCompanyConfig}
      />

      <BillingQuoteModal
        isOpen={isQuoteModalOpen}
        onClose={() => setIsQuoteModalOpen(false)}
      />

      <QuotePreviewModal
        quote={quoteToPreview}
        onClose={() => setQuoteToPreview(null)}
        companyConfig={sriCompanyConfig}
      />
    </div>
  );
}
