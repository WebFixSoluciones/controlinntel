"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import {
  SriInvoice,
  ClientQuote,
  CreditNote,
  WithholdingReceipt,
  RemissionGuide,
} from "@/types";
import { RidePreviewModal } from "./RidePreviewModal";
import { NewSaleModal } from "./NewSaleModal";
import { BillingQuoteModal } from "./BillingQuoteModal";
import { CreditNoteModal } from "./CreditNoteModal";
import { RemissionGuideModal } from "./RemissionGuideModal";
import { SriConfigModal } from "./SriConfigModal";
import {
  Receipt,
  FileText,
  RotateCcw,
  ShieldCheck,
  Truck,
  Settings,
  Plus,
  Search,
  Filter,
  Download,
  Printer,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building2,
  DollarSign,
  TrendingUp,
  Percent,
  Check,
  ArrowRight,
  ChevronRight,
  Calendar,
  Layers,
  FileCode,
} from "lucide-react";
import { generarFacturaXml } from "@/lib/sri-service";

type BillingTab =
  | "facturas"
  | "cotizaciones"
  | "notas_credito"
  | "retenciones"
  | "guias_remision"
  | "configuracion_sri";

export function BillingManager() {
  const {
    billingInvoices,
    billingQuotes,
    billingCreditNotes,
    billingWithholdings,
    billingRemissionGuides,
    sriCompanyConfig,
    convertQuoteToInvoice,
    inventoryWarehouses,
  } = useApp();
  const { showConfirm, showSuccess, showError } = useToast();

  const searchParams = useSearchParams();
  const subParam = searchParams.get("sub") as BillingTab | "nueva_venta" | null;

  const [activeTab, setActiveTab] = useState<BillingTab>(() => {
    if (subParam && subParam !== "nueva_venta") return subParam as BillingTab;
    return "facturas";
  });

  useEffect(() => {
    if (subParam === "nueva_venta") {
      setIsNewSaleOpen(true);
      setActiveTab("facturas");
    } else if (subParam === "configuracion_sri") {
      setIsSriConfigOpen(true);
      setActiveTab("facturas");
    } else if (subParam) {
      setActiveTab(subParam as BillingTab);
    }
  }, [subParam]);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modals state
  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [quoteToEdit, setQuoteToEdit] = useState<ClientQuote | null>(null);

  const [isCreditNoteModalOpen, setIsCreditNoteModalOpen] = useState(false);
  const [creditNoteInitialInvoice, setCreditNoteInitialInvoice] = useState<SriInvoice | null>(null);

  const [isRemissionModalOpen, setIsRemissionModalOpen] = useState(false);
  const [remissionInitialInvoice, setRemissionInitialInvoice] = useState<SriInvoice | null>(null);

  const [isSriConfigOpen, setIsSriConfigOpen] = useState(false);

  // RIDE Viewer
  const [isRideOpen, setIsRideOpen] = useState(false);
  const [rideInvoice, setRideInvoice] = useState<SriInvoice | null>(null);
  const [rideCreditNote, setRideCreditNote] = useState<CreditNote | null>(null);

  // Convert Quote Dialog
  const [quoteToConvert, setQuoteToConvert] = useState<ClientQuote | null>(null);
  const [convertWarehouseId, setConvertWarehouseId] = useState(
    inventoryWarehouses[0]?.id || "wh-central"
  );
  const [isConverting, setIsConverting] = useState(false);

  // ==========================================
  // KPIs
  // ==========================================
  const kpis = useMemo(() => {
    const totalFacturado = billingInvoices.reduce((sum, inv) => sum + inv.total, 0);
    const facturasAutorizadas = billingInvoices.filter((i) => i.status === "autorizada").length;
    const totalIvaRecaudado = billingInvoices.reduce((sum, inv) => sum + inv.ivaTotal, 0);
    const cotizacionesPendientes = billingQuotes.filter(
      (q) => q.status === "enviada" || q.status === "aprobada"
    ).length;
    const notasCreditoTotal = billingCreditNotes.reduce((sum, nc) => sum + nc.total, 0);

    return {
      totalFacturado,
      facturasAutorizadas,
      totalFacturas: billingInvoices.length,
      totalIvaRecaudado,
      cotizacionesPendientes,
      notasCreditoTotal,
    };
  }, [billingInvoices, billingQuotes, billingCreditNotes]);

  // ==========================================
  // Filtered Lists
  // ==========================================
  const filteredInvoices = useMemo(() => {
    return billingInvoices.filter((inv) => {
      const q = searchTerm.toLowerCase();
      const matchSearch =
        inv.documentNumber.toLowerCase().includes(q) ||
        inv.clientName.toLowerCase().includes(q) ||
        inv.clientRuc.includes(q) ||
        inv.claveAcceso.includes(q);

      const matchStatus = statusFilter === "all" || inv.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [billingInvoices, searchTerm, statusFilter]);

  const filteredQuotes = useMemo(() => {
    return billingQuotes.filter((q) => {
      const search = searchTerm.toLowerCase();
      const matchSearch =
        q.quoteNumber.toLowerCase().includes(search) ||
        q.clientName.toLowerCase().includes(search) ||
        q.clientRuc.includes(search);

      const matchStatus = statusFilter === "all" || q.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [billingQuotes, searchTerm, statusFilter]);

  const filteredCreditNotes = useMemo(() => {
    return billingCreditNotes.filter((nc) => {
      const search = searchTerm.toLowerCase();
      return (
        nc.documentNumber.toLowerCase().includes(search) ||
        nc.invoiceNumber.toLowerCase().includes(search) ||
        nc.clientName.toLowerCase().includes(search) ||
        nc.clientRuc.includes(search)
      );
    });
  }, [billingCreditNotes, searchTerm]);

  // Actions
  const handleOpenRide = (inv: SriInvoice) => {
    setRideInvoice(inv);
    setRideCreditNote(null);
    setIsRideOpen(true);
  };

  const handleOpenNcRide = (nc: CreditNote) => {
    setRideCreditNote(nc);
    setRideInvoice(null);
    setIsRideOpen(true);
  };

  const handleDownloadXmlDirect = (inv: SriInvoice) => {
    try {
      const xml = generarFacturaXml(inv, sriCompanyConfig);
      const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `SRI-${inv.documentNumber}.xml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showSuccess("Descarga Exitosa", `XML de ${inv.documentNumber} descargado.`);
    } catch (e: any) {
      showError("Error al generar XML", e?.message || "No se pudo generar el XML");
    }
  };

  const handleEmitNcFromInvoice = (inv: SriInvoice) => {
    setCreditNoteInitialInvoice(inv);
    setIsCreditNoteModalOpen(true);
  };

  const handleEmitRemissionFromInvoice = (inv: SriInvoice) => {
    setRemissionInitialInvoice(inv);
    setIsRemissionModalOpen(true);
  };

  const handleConfirmConvertQuote = async () => {
    if (!quoteToConvert) return;
    setIsConverting(true);
    try {
      const invoice = await convertQuoteToInvoice(quoteToConvert.id, convertWarehouseId);
      showSuccess("Facturación Completada", `Cotización ${quoteToConvert.quoteNumber} convertida en Factura ${invoice.documentNumber}.`);
      setQuoteToConvert(null);
      // Abrir RIDE de la nueva factura automáticamente
      setRideInvoice(invoice);
      setRideCreditNote(null);
      setIsRideOpen(true);
    } catch (err: any) {
      showError("Error de Conversión", err?.message || "Error al convertir la cotización en factura.");
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Ejecutivo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-lumina-card">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#004ac6] to-sky-600 flex items-center justify-center text-white shadow-md">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                Facturación & Emisión Electrónica SRI
              </h1>
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                  sriCompanyConfig.ambiente === "2"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                    : "bg-amber-50 text-amber-700 border-amber-300"
                }`}
              >
                {sriCompanyConfig.ambiente === "2" ? "SRI PRODUCCIÓN" : "SRI PRUEBAS"}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Emisor: {sriCompanyConfig.razonSocial} | RUC: {sriCompanyConfig.ruc} | IVA Vigente: 15%
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsSriConfigOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition"
          >
            <Settings className="w-4 h-4 text-slate-500" />
            <span>Config. SRI</span>
          </button>

          <button
            onClick={() => {
              setQuoteToEdit(null);
              setIsQuoteModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold border border-amber-200 transition"
          >
            <FileText className="w-4 h-4 text-amber-600" />
            <span>Nueva Cotización</span>
          </button>

          <button
            onClick={() => setIsNewSaleOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#004ac6] hover:bg-[#003ca3] text-white text-xs font-bold shadow-md transition"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Venta / Factura</span>
          </button>
        </div>
      </div>

      {/* Tarjetas KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Total Facturado
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-black text-slate-900 font-mono">
              ${kpis.totalFacturado.toFixed(2)}
            </span>
            <span className="p-1.5 bg-blue-50 text-[#004ac6] rounded-lg">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-medium">
            {kpis.totalFacturas} comprobantes emitidos
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Autorizadas SRI
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-black text-emerald-600 font-mono">
              {kpis.facturasAutorizadas}
            </span>
            <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <ShieldCheck className="w-4 h-4" />
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-medium">Claves 49 dígitos válidas</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            IVA 15% Recaudado
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-black text-sky-600 font-mono">
              ${kpis.totalIvaRecaudado.toFixed(2)}
            </span>
            <span className="p-1.5 bg-sky-50 text-sky-600 rounded-lg">
              <Percent className="w-4 h-4" />
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-medium">Retención fiscal estimada</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Cotizaciones Activas
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-black text-amber-600 font-mono">
              {kpis.cotizacionesPendientes}
            </span>
            <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <FileText className="w-4 h-4" />
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-medium">Convertibles a factura</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Notas de Crédito
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-black text-rose-600 font-mono">
              ${kpis.notasCreditoTotal.toFixed(2)}
            </span>
            <span className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
              <RotateCcw className="w-4 h-4" />
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-medium">
            {billingCreditNotes.length} comprobantes
          </span>
        </div>
      </div>

      {/* Submodule View Title (No Tabs on Screen) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        <h2 className="text-xl font-bold text-[#0b1c30] tracking-tight flex items-center gap-2">
          {activeTab === "facturas" && "Facturas Emitidas"}
          {activeTab === "cotizaciones" && "Cotizaciones / Proformas"}
          {activeTab === "notas_credito" && "Notas de Crédito"}
          {activeTab === "retenciones" && "Comprobantes de Retención"}
          {activeTab === "guias_remision" && "Guías de Remisión"}
          {activeTab === "configuracion_sri" && "Configuración del Emisor SRI"}
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#f1f5f9] text-[#475569] border border-[#e2e8f0]">
            {activeTab === "facturas" && billingInvoices.length}
            {activeTab === "cotizaciones" && billingQuotes.length}
            {activeTab === "notas_credito" && billingCreditNotes.length}
            {activeTab === "retenciones" && billingWithholdings.length}
            {activeTab === "guias_remision" && billingRemissionGuides.length}
          </span>
        </h2>
      </div>

      {/* Barra de Filtros (para tablas) */}
      {activeTab !== "configuracion_sri" && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={
                activeTab === "facturas"
                  ? "Buscar por cliente, RUC, secuencial 001-001... o clave de acceso"
                  : activeTab === "cotizaciones"
                  ? "Buscar por cotización COT-2026-..., cliente o RUC..."
                  : "Buscar comprobante..."
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] focus:border-transparent outline-hidden"
            />
          </div>

          <div className="flex items-center gap-2">
            {activeTab === "facturas" && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs font-semibold rounded-xl border border-slate-300 py-2 px-3 bg-white text-slate-700"
              >
                <option value="all">Todos los Estados</option>
                <option value="autorizada">Autorizadas</option>
                <option value="emitida">Emitidas</option>
                <option value="borrador">Borradores</option>
              </select>
            )}

            {activeTab === "cotizaciones" && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs font-semibold rounded-xl border border-slate-300 py-2 px-3 bg-white text-slate-700"
              >
                <option value="all">Todos los Estados</option>
                <option value="enviada">Enviadas</option>
                <option value="aprobada">Aprobadas</option>
                <option value="facturada">Facturadas</option>
              </select>
            )}

            {activeTab === "facturas" && (
              <button
                onClick={() => setIsNewSaleOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#004ac6] hover:bg-[#003ca3] text-white rounded-xl text-xs font-bold shadow-sm transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Emitir Factura</span>
              </button>
            )}

            {activeTab === "cotizaciones" && (
              <button
                onClick={() => {
                  setQuoteToEdit(null);
                  setIsQuoteModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Crear Cotización</span>
              </button>
            )}

            {activeTab === "notas_credito" && (
              <button
                onClick={() => {
                  setCreditNoteInitialInvoice(null);
                  setIsCreditNoteModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Emitir Nota de Crédito</span>
              </button>
            )}

            {activeTab === "guias_remision" && (
              <button
                onClick={() => {
                  setRemissionInitialInvoice(null);
                  setIsRemissionModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Emitir Guía de Remisión</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Contenido de Cada Pestaña */}

      {/* 1. Facturas */}
      {activeTab === "facturas" && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-lumina-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <th className="py-3 px-4">No. Factura</th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Cliente / RUC</th>
                  <th className="py-3 px-3">Bodega Despacho</th>
                  <th className="py-3 px-3 text-right">Subtotal 15%</th>
                  <th className="py-3 px-3 text-right">IVA 15%</th>
                  <th className="py-3 px-4 text-right font-black">Total ($)</th>
                  <th className="py-3 px-3 text-center">Estado SRI</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      No se encontraron facturas con los criterios de búsqueda.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-slate-900 block">
                          {inv.documentNumber}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 truncate max-w-[140px] block" title={inv.claveAcceso}>
                          Clave: {inv.claveAcceso.slice(-10)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-medium">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{inv.date}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{inv.clientName}</div>
                        <div className="text-[10px] font-mono text-slate-500">RUC: {inv.clientRuc}</div>
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700">
                          <Layers className="w-3 h-3 text-slate-400" />
                          {inv.warehouseName}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-700">
                        ${inv.subtotal15.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-sky-600 font-semibold">
                        ${inv.ivaTotal.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 text-sm">
                        ${inv.total.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                            inv.status === "autorizada"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                              : inv.status === "emitida"
                              ? "bg-sky-50 text-sky-700 border-sky-300"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          {inv.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleOpenRide(inv)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-[#004ac6] hover:bg-blue-50 transition"
                            title="Ver / Imprimir RIDE PDF"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDownloadXmlDirect(inv)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 transition"
                            title="Descargar XML SRI"
                          >
                            <FileCode className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEmitNcFromInvoice(inv)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="Emitir Nota de Crédito"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEmitRemissionFromInvoice(inv)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition"
                            title="Emitir Guía de Remisión"
                          >
                            <Truck className="w-4 h-4" />
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

      {/* 2. Cotizaciones */}
      {activeTab === "cotizaciones" && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-lumina-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <th className="py-3 px-4">No. Cotización</th>
                  <th className="py-3 px-4">Emisión</th>
                  <th className="py-3 px-4">Vigencia</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-3 text-right">Subtotal</th>
                  <th className="py-3 px-3 text-right">IVA 15%</th>
                  <th className="py-3 px-4 text-right font-black">Total ($)</th>
                  <th className="py-3 px-3 text-center">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredQuotes.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      No se encontraron cotizaciones registradas.
                    </td>
                  </tr>
                ) : (
                  filteredQuotes.map((q) => (
                    <tr key={q.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {q.quoteNumber}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{q.date}</td>
                      <td className="py-3 px-4 text-slate-600">{q.validUntil}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{q.clientName}</div>
                        <div className="text-[10px] font-mono text-slate-500">{q.clientRuc}</div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-700">
                        ${(q.subtotal15 + q.subtotal0).toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-sky-600 font-semibold">
                        ${q.ivaTotal.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-amber-700 text-sm">
                        ${q.total.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                            q.status === "facturada"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                              : q.status === "aprobada"
                              ? "bg-blue-50 text-blue-700 border-blue-300"
                              : "bg-amber-50 text-amber-700 border-amber-300"
                          }`}
                        >
                          {q.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {q.status !== "facturada" ? (
                            <button
                              onClick={() => setQuoteToConvert(q)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-2xs transition"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Convertir a Factura</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-mono">
                              {q.invoiceNumber}
                            </span>
                          )}

                          <button
                            onClick={() => {
                              setQuoteToEdit(q);
                              setIsQuoteModalOpen(true);
                            }}
                            className="p-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                            title="Editar Cotización"
                          >
                            <FileText className="w-3.5 h-3.5" />
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

      {/* 3. Notas de Crédito */}
      {activeTab === "notas_credito" && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-lumina-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <th className="py-3 px-4">No. Comprobante</th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Factura Modificada</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Motivo</th>
                  <th className="py-3 px-4 text-right font-black">Valor Acreditado</th>
                  <th className="py-3 px-3 text-center">Estado SRI</th>
                  <th className="py-3 px-4 text-right">RIDE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCreditNotes.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No hay notas de crédito emitidas.
                    </td>
                  </tr>
                ) : (
                  filteredCreditNotes.map((nc) => (
                    <tr key={nc.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {nc.documentNumber}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{nc.date}</td>
                      <td className="py-3 px-4 font-mono font-semibold text-[#004ac6]">
                        {nc.invoiceNumber}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{nc.clientName}</div>
                        <div className="text-[10px] font-mono text-slate-500">{nc.clientRuc}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-700 max-w-[220px] truncate" title={nc.reason}>
                        {nc.reason}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-rose-600 text-sm">
                        ${nc.total.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300">
                          {nc.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleOpenNcRide(nc)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs transition"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>RIDE</span>
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

      {/* 4. Retenciones */}
      {activeTab === "retenciones" && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-lumina-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <th className="py-3 px-4">No. Retención</th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Factura Origen</th>
                  <th className="py-3 px-4">Cliente Sujeto Retenido</th>
                  <th className="py-3 px-4">Impuestos Retenidos</th>
                  <th className="py-3 px-4 text-right font-black">Total Retenido ($)</th>
                  <th className="py-3 px-3 text-center">Estado SRI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {billingWithholdings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No hay comprobantes de retención registrados.
                    </td>
                  </tr>
                ) : (
                  billingWithholdings.map((ret) => (
                    <tr key={ret.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {ret.documentNumber}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{ret.date}</td>
                      <td className="py-3 px-4 font-mono font-semibold text-[#004ac6]">
                        {ret.invoiceNumber}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{ret.clientName}</div>
                        <div className="text-[10px] font-mono text-slate-500">{ret.clientRuc}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-0.5 text-[11px]">
                          {ret.items.map((it, idx) => (
                            <span
                              key={idx}
                              className="inline-block mr-2 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[10px]"
                            >
                              {it.taxType} {it.percentage}%: ${it.retainedAmount.toFixed(2)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700 text-sm">
                        ${ret.totalRetained.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300">
                          {ret.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Guías de Remisión */}
      {activeTab === "guias_remision" && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-lumina-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <th className="py-3 px-4">No. Guía</th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Transportista & Placa</th>
                  <th className="py-3 px-4">Ruta</th>
                  <th className="py-3 px-4">Destinatario</th>
                  <th className="py-3 px-4">Mercadería</th>
                  <th className="py-3 px-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {billingRemissionGuides.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No hay guías de remisión registradas.
                    </td>
                  </tr>
                ) : (
                  billingRemissionGuides.map((g) => (
                    <tr key={g.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {g.documentNumber}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{g.date}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{g.carrierName}</div>
                        <div className="text-[10px] font-mono text-indigo-700 font-semibold">
                          Placa: {g.licensePlate}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-700 max-w-[200px] truncate" title={g.route}>
                        {g.route}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{g.destClientName}</div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[180px]">
                          {g.destAddress}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {g.items.map((it, idx) => (
                          <span key={idx} className="block text-[11px]">
                            • {it.quantity} {it.unit} - {it.name}
                          </span>
                        ))}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {g.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. Configuración SRI */}
      {activeTab === "configuracion_sri" && (
        <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-lumina-card space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#004ac6]/10 text-[#004ac6] flex items-center justify-center">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Perfil Tributario del Emisor SRI
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Parámetros de facturación autorizados ante el Servicio de Rentas Internas
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsSriConfigOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#004ac6] hover:bg-[#003ca3] text-white rounded-xl text-xs font-bold shadow-md transition"
            >
              <Settings className="w-4 h-4" />
              <span>Editar Parámetros SRI</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] block">
                Identificación de la Empresa
              </span>
              <p>
                <span className="font-semibold text-slate-600">RUC:</span>{" "}
                <span className="font-mono font-bold text-slate-900">{sriCompanyConfig.ruc}</span>
              </p>
              <p>
                <span className="font-semibold text-slate-600">Razón Social:</span>{" "}
                <span className="font-bold text-slate-900">{sriCompanyConfig.razonSocial}</span>
              </p>
              <p>
                <span className="font-semibold text-slate-600">Nombre Comercial:</span>{" "}
                <span className="text-slate-800">{sriCompanyConfig.nombreComercial}</span>
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] block">
                Punto de Emisión & Serie
              </span>
              <p>
                <span className="font-semibold text-slate-600">Establecimiento:</span>{" "}
                <span className="font-mono font-bold text-slate-900">{sriCompanyConfig.establecimiento}</span>
              </p>
              <p>
                <span className="font-semibold text-slate-600">Punto de Emisión:</span>{" "}
                <span className="font-mono font-bold text-slate-900">{sriCompanyConfig.puntoEmision}</span>
              </p>
              <p>
                <span className="font-semibold text-slate-600">Ambiente SRI:</span>{" "}
                <span className="font-bold text-emerald-700 uppercase">
                  {sriCompanyConfig.ambiente === "2" ? "2 - Producción" : "1 - Pruebas / Homologación"}
                </span>
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] block">
                Régimen & Contabilidad
              </span>
              <p>
                <span className="font-semibold text-slate-600">Obligado Contabilidad:</span>{" "}
                <span className="font-bold text-slate-900">
                  {sriCompanyConfig.obligadoContabilidad ? "SI" : "NO"}
                </span>
              </p>
              <p>
                <span className="font-semibold text-slate-600">Tipo Contribuyente:</span>{" "}
                <span className="font-bold uppercase text-slate-900">
                  {sriCompanyConfig.tipoContribuyente.replace("_", " ")}
                </span>
              </p>
              <p>
                <span className="font-semibold text-slate-600">Email Notificaciones:</span>{" "}
                <span className="text-slate-800">{sriCompanyConfig.emailNotificaciones}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dialog: Convertir Cotización a Factura con Selección de Bodega */}
      {quoteToConvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Convertir a Factura Electrónica
                </h3>
                <p className="text-xs text-slate-500">
                  Cotización {quoteToConvert.quoteNumber} (${quoteToConvert.total.toFixed(2)})
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Al confirmar, se emitirá una Factura Electrónica autorizada por el SRI para{" "}
              <strong>{quoteToConvert.clientName}</strong> y se descontarán automáticamente las
              existencias de los productos físicos en la bodega seleccionada.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800">
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

            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setQuoteToConvert(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmConvertQuote}
                disabled={isConverting}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md flex items-center gap-2"
              >
                {isConverting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Facturando...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Confirmar y Facturar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modales Secundarios */}
      <NewSaleModal
        isOpen={isNewSaleOpen}
        onClose={() => setIsNewSaleOpen(false)}
        onSuccess={(inv) => {
          showSuccess("Factura Emitida", `Factura ${inv.documentNumber} emitida con éxito.`);
          setRideInvoice(inv);
          setRideCreditNote(null);
          setIsRideOpen(true);
        }}
      />

      <BillingQuoteModal
        isOpen={isQuoteModalOpen}
        onClose={() => {
          setIsQuoteModalOpen(false);
          setQuoteToEdit(null);
        }}
        quoteToEdit={quoteToEdit}
        onSuccess={(q) => {
          showSuccess("Cotización Guardada", `Cotización ${q.quoteNumber} guardada con éxito.`);
        }}
      />

      <CreditNoteModal
        isOpen={isCreditNoteModalOpen}
        onClose={() => {
          setIsCreditNoteModalOpen(false);
          setCreditNoteInitialInvoice(null);
        }}
        initialInvoice={creditNoteInitialInvoice}
        onSuccess={(nc) => {
          showSuccess("Nota de Crédito Emitida", `Nota de Crédito ${nc.documentNumber} emitida.`);
          setRideCreditNote(nc);
          setRideInvoice(null);
          setIsRideOpen(true);
        }}
      />

      <RemissionGuideModal
        isOpen={isRemissionModalOpen}
        onClose={() => {
          setIsRemissionModalOpen(false);
          setRemissionInitialInvoice(null);
        }}
        initialInvoice={remissionInitialInvoice}
        onSuccess={(g) => {
          showSuccess("Guía Emitida", `Guía de Remisión ${g.documentNumber} emitida con éxito.`);
        }}
      />

      <SriConfigModal
        isOpen={isSriConfigOpen}
        onClose={() => setIsSriConfigOpen(false)}
      />

      <RidePreviewModal
        isOpen={isRideOpen}
        onClose={() => {
          setIsRideOpen(false);
          setRideInvoice(null);
          setRideCreditNote(null);
        }}
        invoice={rideInvoice}
        creditNote={rideCreditNote}
        companyConfig={sriCompanyConfig}
      />
    </div>
  );
}
