"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { SriInvoice, ClientQuote } from "@/types";
import { NewSaleView } from "../billing/NewSaleView";
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
  Printer,
  Edit2,
  Trash2,
  FileCheck2,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  Check,
} from "lucide-react";

export type SalesTab = "notas_venta" | "nueva_venta" | "cotizaciones" | "recurrentes";

export function SalesManager() {
  const {
    billingInvoices,
    billingQuotes,
    sriCompanyConfig,
    deleteInvoice,
    deleteBillingQuote,
    convertQuoteToInvoice,
    inventoryWarehouses,
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

  useEffect(() => {
    const handleReset = (event: any) => {
      const detail = event?.detail;
      if (detail?.href?.startsWith("/ventas") || detail?.key) {
        setQuoteToConvert(null);
        setQuoteToPreview(null);
        setIsQuoteModalOpen(false);
        if (detail?.key) {
          setActiveTab(detail.key as SalesTab);
        } else {
          setActiveTab("notas_venta");
        }
      }
    };
    window.addEventListener("inntel:reset-submodule-view", handleReset);
    return () => {
      window.removeEventListener("inntel:reset-submodule-view", handleReset);
    };
  }, []);

  const [searchTerm, setSearchTerm] = useState("");
  const [sriFilter, setSriFilter] = useState<"todos" | "pendientes" | "facturadas">("todos");

  // Quotes filters
  const [quoteSearchTerm, setQuoteSearchTerm] = useState("");
  const [quoteStatusFilter, setQuoteStatusFilter] = useState<string>("all");

  // Modals state
  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false);
  const [saleToEdit, setSaleToEdit] = useState<SriInvoice | null>(null);
  const [isEditSaleOpen, setIsEditSaleOpen] = useState(false);
  const [saleToConvert, setSaleToConvert] = useState<SriInvoice | null>(null);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [rideSale, setRideSale] = useState<SriInvoice | null>(null);
  const [isRideOpen, setIsRideOpen] = useState(false);

  // Quotes state
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [quoteToEdit, setQuoteToEdit] = useState<ClientQuote | null>(null);
  const [quoteToPreview, setQuoteToPreview] = useState<ClientQuote | null>(null);
  const [quoteToConvert, setQuoteToConvert] = useState<ClientQuote | null>(null);
  const [convertDocType, setConvertDocType] = useState<"nota_venta" | "factura">("nota_venta");
  const [convertWarehouseId, setConvertWarehouseId] = useState(
    inventoryWarehouses[0]?.id || "wh-central"
  );
  const [isConvertingQuote, setIsConvertingQuote] = useState(false);

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

  const filteredQuotes = useMemo(() => {
    return billingQuotes.filter((q) => {
      const term = quoteSearchTerm.toLowerCase().trim();
      const matchSearch =
        !term ||
        q.quoteNumber.toLowerCase().includes(term) ||
        q.clientName.toLowerCase().includes(term) ||
        (q.clientRuc && q.clientRuc.includes(term));

      const matchStatus = quoteStatusFilter === "all" || q.status === quoteStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [billingQuotes, quoteSearchTerm, quoteStatusFilter]);

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

  const handleConfirmConvertQuote = async () => {
    if (!quoteToConvert) return;
    setIsConvertingQuote(true);
    try {
      const createdDoc = await convertQuoteToInvoice(
        quoteToConvert.id,
        convertWarehouseId,
        "transferencia",
        convertDocType
      );
      showSuccess(
        convertDocType === "nota_venta" ? "Nota de Venta Emitida" : "Factura SRI Emitida",
        `Cotización ${quoteToConvert.quoteNumber} convertida en ${
          convertDocType === "nota_venta" ? "Nota de Venta" : "Factura SRI"
        } ${createdDoc.documentNumber}.`
      );
      setQuoteToConvert(null);
      setRideSale(createdDoc);
      setIsRideOpen(true);
    } catch (err: any) {
      showError("Error de Conversión", err?.message || "No se pudo convertir la cotización.");
    } finally {
      setIsConvertingQuote(false);
    }
  };

  if (activeTab === "nueva_venta") {
    return (
      <NewSaleView
        initialDocType="nota_venta"
        onBack={() => {
          setActiveTab("notas_venta");
          router.push("/ventas?sub=notas_venta");
        }}
        onSuccess={(inv) => {
          setActiveTab("notas_venta");
          setRideSale(inv);
          setIsRideOpen(true);
          router.push("/ventas?sub=notas_venta");
        }}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
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
            onClick={() => {
              setActiveTab("nueva_venta");
              router.push("/ventas?sub=nueva_venta");
            }}
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
          { key: "nueva_venta", label: "Nueva Venta", icon: Plus },
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
                    const linkedSriInv = sale.sriInvoiceId
                      ? billingInvoices.find((i) => i.id === sale.sriInvoiceId)
                      : null;
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
                            <button
                              type="button"
                              onClick={() => {
                                if (linkedSriInv) {
                                  setRideSale(linkedSriInv);
                                  setIsRideOpen(true);
                                }
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition cursor-pointer"
                              title="Clic para ver Factura SRI vinculada"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              Facturada SRI ({sale.sriDocumentNumber || "01"})
                            </button>
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
                              title="Ver / Imprimir Nota de Venta"
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Cotizaciones y Proformas Comerciales</h3>
              <p className="text-xs text-slate-500">
                Gestiona cotizaciones emitidas con opción de conversión directa a Nota de Venta o Factura SRI.
              </p>
            </div>
            <button
              onClick={() => {
                setQuoteToEdit(null);
                setIsQuoteModalOpen(true);
              }}
              className="px-4 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Cotización</span>
            </button>
          </div>

          {/* Quotes Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar cotización, cliente o RUC..."
                value={quoteSearchTerm}
                onChange={(e) => setQuoteSearchTerm(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-slate-800 focus:outline-none focus:border-[#004ac6]"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-slate-500 font-medium">Estado:</span>
              <select
                value={quoteStatusFilter}
                onChange={(e) => setQuoteStatusFilter(e.target.value)}
                className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:border-[#004ac6]"
              >
                <option value="all">Todos los estados</option>
                <option value="enviada">Enviadas</option>
                <option value="aprobada">Aprobadas</option>
                <option value="facturada">Facturadas / Convertidas</option>
                <option value="rechazada">Rechazadas</option>
              </select>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                  <th className="py-2.5 px-4">Nro. Cotización</th>
                  <th className="py-2.5 px-4">Emisión / Vigencia</th>
                  <th className="py-2.5 px-4">Cliente</th>
                  <th className="py-2.5 px-4 text-right">Total</th>
                  <th className="py-2.5 px-4 text-center">Estado</th>
                  <th className="py-2.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredQuotes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                      No hay cotizaciones registradas.
                    </td>
                  </tr>
                ) : (
                  filteredQuotes.map((q) => (
                    <tr key={q.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{q.quoteNumber}</td>
                      <td className="py-3 px-4 text-slate-600">
                        <div>{q.date}</div>
                        <div className="text-[10px] text-slate-400">Vence: {q.validUntil}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800">{q.clientName}</div>
                        <div className="text-[10px] font-mono text-slate-500">RUC: {q.clientRuc}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        ${q.total.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`uppercase px-2 py-0.5 rounded text-[10px] font-bold border ${
                            q.status === "facturada"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : q.status === "aprobada"
                              ? "bg-blue-50 text-[#004ac6] border-blue-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          {q.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {q.status !== "facturada" ? (
                            <>
                              <button
                                onClick={() => {
                                  setConvertDocType("nota_venta");
                                  setQuoteToConvert(q);
                                }}
                                className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-[#004ac6] text-[#004ac6] hover:text-white font-bold text-[11px] transition cursor-pointer"
                                title="Convertir a Nota de Venta"
                              >
                                + Nota Venta
                              </button>
                              <button
                                onClick={() => {
                                  setConvertDocType("factura");
                                  setQuoteToConvert(q);
                                }}
                                className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white font-bold text-[11px] transition cursor-pointer"
                                title="Convertir a Factura SRI"
                              >
                                + Factura SRI
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] font-mono text-slate-500 mr-1">
                              {q.invoiceNumber}
                            </span>
                          )}

                          <button
                            onClick={() => setQuoteToPreview(q)}
                            className="p-1.5 text-slate-600 hover:text-[#004ac6] hover:bg-blue-50 rounded-lg transition cursor-pointer"
                            title="Ver / Imprimir Cotización"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => {
                              setQuoteToEdit(q);
                              setIsQuoteModalOpen(true);
                            }}
                            className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                            title="Editar Cotización"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => {
                              showConfirm(
                                "¿Eliminar Cotización?",
                                `¿Confirmas eliminar la cotización ${q.quoteNumber} (${q.clientName})?`,
                                async () => {
                                  await deleteBillingQuote(q.id);
                                  showSuccess("Cotización Eliminada", `La cotización ${q.quoteNumber} fue eliminada.`);
                                },
                                "Eliminar"
                              );
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="Eliminar Cotización"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
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
      {activeTab === "recurrentes" && (
        <RecurringBillingView
          onOpenInvoiceRide={(inv) => {
            setRideSale(inv);
            setIsRideOpen(true);
          }}
        />
      )}

      {/* Modal: Convertir Cotización a Nota de Venta o Factura */}
      {quoteToConvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#004ac6] flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Convertir Cotización {quoteToConvert.quoteNumber}
                </h3>
                <p className="text-xs text-slate-500">
                  Cliente: {quoteToConvert.clientName} (${quoteToConvert.total.toFixed(2)})
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Tipo de Comprobante a Generar:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setConvertDocType("nota_venta")}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                      convertDocType === "nota_venta"
                        ? "bg-blue-50 border-[#004ac6] text-[#004ac6]"
                        : "bg-white border-slate-200 text-slate-600"
                    }`}
                  >
                    Nota de Venta
                  </button>
                  <button
                    type="button"
                    onClick={() => setConvertDocType("factura")}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                      convertDocType === "factura"
                        ? "bg-emerald-50 border-emerald-600 text-emerald-700"
                        : "bg-white border-slate-200 text-slate-600"
                    }`}
                  >
                    Factura SRI (01)
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Bodega de Despacho de Mercadería:
                </label>
                <select
                  value={convertWarehouseId}
                  onChange={(e) => setConvertWarehouseId(e.target.value)}
                  className="w-full text-xs font-semibold rounded-xl border border-slate-300 p-2.5 bg-slate-50 text-slate-900"
                >
                  {inventoryWarehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setQuoteToConvert(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmConvertQuote}
                disabled={isConvertingQuote}
                className="px-5 py-2 rounded-xl bg-[#004ac6] hover:bg-[#003da6] text-white text-xs font-bold shadow-xs flex items-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{isConvertingQuote ? "Procesando..." : "Confirmar y Emitir"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <NewSaleModal
        isOpen={isNewSaleOpen}
        documentType="nota_venta"
        onClose={() => setIsNewSaleOpen(false)}
        onSuccess={(inv) => {
          showSuccess("Venta Creada", "La Nota de Venta fue emitida exitosamente.");
          setRideSale(inv);
          setIsRideOpen(true);
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
        onSuccess={(newSriInvoice) => {
          setRideSale(newSriInvoice);
          setIsRideOpen(true);
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
        quoteToEdit={quoteToEdit}
        onClose={() => {
          setIsQuoteModalOpen(false);
          setQuoteToEdit(null);
        }}
        onSuccess={(q) => {
          showSuccess("Cotización Guardada", `La cotización ${q.quoteNumber} fue registrada exitosamente.`);
        }}
      />

      <QuotePreviewModal
        quote={quoteToPreview}
        onClose={() => setQuoteToPreview(null)}
        companyConfig={sriCompanyConfig}
        onConvertToInvoice={(q) => {
          setQuoteToPreview(null);
          setConvertDocType("nota_venta");
          setQuoteToConvert(q);
        }}
      />
    </div>
  );
}
