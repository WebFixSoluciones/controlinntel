"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import {
  SriInvoice,
  ClientQuote,
  CreditNote,
  WithholdingReceipt,
  RemissionGuide,
  SriWsResponse,
} from "@/types";
import { RidePreviewModal } from "./RidePreviewModal";
import { QuotePreviewModal } from "./QuotePreviewModal";
import { NewSaleView } from "./NewSaleView";
import { BillingQuoteModal } from "./BillingQuoteModal";
import { CreditNoteModal } from "./CreditNoteModal";
import { RemissionGuideModal } from "./RemissionGuideModal";
import {
  Receipt,
  FileText,
  RotateCcw,
  ShieldCheck,
  Truck,
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
  RefreshCw,
  X,
} from "lucide-react";
import {
  generarFacturaXml,
  generarNotaCreditoXml,
  generarComprobanteRetencionXml,
  generarGuiaRemisionXml,
  generarXmlFirmado,
  descargarXmlArchivo,
  consultarComprobanteEnSri,
} from "@/lib/sri-service";

type BillingTab =
  | "facturas"
  | "nueva_venta"
  | "cotizaciones"
  | "notas_credito"
  | "retenciones"
  | "guias_remision";

export function BillingManager() {
  const router = useRouter();
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
  const subParam = searchParams.get("sub") as BillingTab | null;

  const [activeTab, setActiveTab] = useState<BillingTab>(() => {
    if (subParam && subParam !== ("configuracion_sri" as any)) return subParam;
    return "facturas";
  });

  useEffect(() => {
    if ((subParam as any) === "configuracion_sri") {
      router.replace("/configuracion?sub=sri");
    } else if (subParam) {
      setActiveTab(subParam);
    }
  }, [subParam, router]);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modals state
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [quoteToEdit, setQuoteToEdit] = useState<ClientQuote | null>(null);
  const [quoteToPreview, setQuoteToPreview] = useState<ClientQuote | null>(null);

  const [isCreditNoteModalOpen, setIsCreditNoteModalOpen] = useState(false);
  const [creditNoteInitialInvoice, setCreditNoteInitialInvoice] = useState<SriInvoice | null>(null);

  const [isRemissionModalOpen, setIsRemissionModalOpen] = useState(false);
  const [remissionInitialInvoice, setRemissionInitialInvoice] = useState<SriInvoice | null>(null);

  // RIDE Viewer
  const [isRideOpen, setIsRideOpen] = useState(false);
  const [rideInvoice, setRideInvoice] = useState<SriInvoice | null>(null);
  const [rideCreditNote, setRideCreditNote] = useState<CreditNote | null>(null);
  const [rideWithholding, setRideWithholding] = useState<WithholdingReceipt | null>(null);
  const [rideRemissionGuide, setRideRemissionGuide] = useState<RemissionGuide | null>(null);

  // SRI Status Verification Modal
  const [sriStatusModal, setSriStatusModal] = useState<{
    isOpen: boolean;
    docNumber: string;
    claveAcceso: string;
    result?: SriWsResponse;
    loading: boolean;
  } | null>(null);

  // Convert Quote Dialog
  const [quoteToConvert, setQuoteToConvert] = useState<ClientQuote | null>(null);
  const [convertWarehouseId, setConvertWarehouseId] = useState(
    inventoryWarehouses[0]?.id || "wh-central"
  );
  const [isConverting, setIsConverting] = useState(false);

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
    setRideWithholding(null);
    setRideRemissionGuide(null);
    setIsRideOpen(true);
  };

  const handleOpenNcRide = (nc: CreditNote) => {
    setRideCreditNote(nc);
    setRideInvoice(null);
    setRideWithholding(null);
    setRideRemissionGuide(null);
    setIsRideOpen(true);
  };

  const handleOpenWithholdingRide = (ret: WithholdingReceipt) => {
    setRideWithholding(ret);
    setRideInvoice(null);
    setRideCreditNote(null);
    setRideRemissionGuide(null);
    setIsRideOpen(true);
  };

  const handleOpenRemissionRide = (guia: RemissionGuide) => {
    setRideRemissionGuide(guia);
    setRideInvoice(null);
    setRideCreditNote(null);
    setRideWithholding(null);
    setIsRideOpen(true);
  };

  const handleDownloadXmlDirect = (inv: SriInvoice) => {
    try {
      const rawXml = generarFacturaXml(inv, sriCompanyConfig);
      const signedXml = generarXmlFirmado(rawXml, sriCompanyConfig);
      descargarXmlArchivo(signedXml, `SRI-${inv.documentNumber}.xml`);
      showSuccess("Descarga Exitosa", `XML de Factura ${inv.documentNumber} descargado.`);
    } catch (e: any) {
      showError("Error al generar XML", e?.message || "No se pudo generar el XML");
    }
  };

  const handleDownloadXmlCreditNote = (nc: CreditNote) => {
    try {
      const rawXml = generarNotaCreditoXml(nc, sriCompanyConfig);
      const signedXml = generarXmlFirmado(rawXml, sriCompanyConfig);
      descargarXmlArchivo(signedXml, `SRI-NC-${nc.documentNumber}.xml`);
      showSuccess("Descarga Exitosa", `XML de Nota de Crédito ${nc.documentNumber} descargado.`);
    } catch (e: any) {
      showError("Error al generar XML", e?.message || "No se pudo generar el XML");
    }
  };

  const handleDownloadXmlWithholding = (ret: WithholdingReceipt) => {
    try {
      const rawXml = generarComprobanteRetencionXml(ret, sriCompanyConfig);
      const signedXml = generarXmlFirmado(rawXml, sriCompanyConfig);
      descargarXmlArchivo(signedXml, `SRI-RET-${ret.documentNumber}.xml`);
      showSuccess("Descarga Exitosa", `XML de Retención ${ret.documentNumber} descargado.`);
    } catch (e: any) {
      showError("Error al generar XML", e?.message || "No se pudo generar el XML");
    }
  };

  const handleDownloadXmlRemission = (guia: RemissionGuide) => {
    try {
      const rawXml = generarGuiaRemisionXml(guia, sriCompanyConfig);
      const signedXml = generarXmlFirmado(rawXml, sriCompanyConfig);
      descargarXmlArchivo(signedXml, `SRI-GUIA-${guia.documentNumber}.xml`);
      showSuccess("Descarga Exitosa", `XML de Guía ${guia.documentNumber} descargado.`);
    } catch (e: any) {
      showError("Error al generar XML", e?.message || "No se pudo generar el XML");
    }
  };

  const handleConsultarSri = async (claveAcceso: string, docNumber: string) => {
    setSriStatusModal({
      isOpen: true,
      docNumber,
      claveAcceso,
      loading: true,
    });
    try {
      const res = await consultarComprobanteEnSri(claveAcceso, sriCompanyConfig.ambiente);
      setSriStatusModal({
        isOpen: true,
        docNumber,
        claveAcceso,
        result: res,
        loading: false,
      });
    } catch (err: any) {
      showError("Error de Conexión SRI", err?.message || "No se pudo consultar el SRI.");
      setSriStatusModal(null);
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
      setRideInvoice(invoice);
      setRideCreditNote(null);
      setRideWithholding(null);
      setRideRemissionGuide(null);
      setIsRideOpen(true);
    } catch (err: any) {
      showError("Error de Conversión", err?.message || "Error al convertir la cotización en factura.");
    } finally {
      setIsConverting(false);
    }
  };

  if (activeTab === "nueva_venta") {
    return (
      <NewSaleView
        onBack={() => {
          setActiveTab("facturas");
          router.push("/facturacion?sub=facturas");
        }}
        onSuccess={(inv) => {
          setActiveTab("facturas");
          setRideInvoice(inv);
          setRideCreditNote(null);
          setRideWithholding(null);
          setRideRemissionGuide(null);
          setIsRideOpen(true);
          router.push("/facturacion?sub=facturas");
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Barra de Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-[6px] border border-slate-200/80 shadow-2xs">
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
            className="w-full text-xs pl-9 pr-3 py-2 rounded-[6px] border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] focus:border-transparent outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "facturas" && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs font-semibold rounded-[6px] border border-slate-300 py-2 px-3 bg-white text-slate-700"
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
              className="text-xs font-semibold rounded-[6px] border border-slate-300 py-2 px-3 bg-white text-slate-700"
            >
              <option value="all">Todos los Estados</option>
              <option value="enviada">Enviadas</option>
              <option value="aprobada">Aprobadas</option>
              <option value="facturada">Facturadas</option>
            </select>
          )}

          {activeTab === "facturas" && (
            <button
              onClick={() => {
                setActiveTab("nueva_venta");
                router.push("/facturacion?sub=nueva_venta");
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#004ac6] hover:bg-[#003ca3] text-white rounded-[6px] text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Registrar Venta</span>
            </button>
          )}

          {activeTab === "cotizaciones" && (
            <button
              onClick={() => {
                setQuoteToEdit(null);
                setIsQuoteModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-[6px] text-xs font-bold shadow-sm transition cursor-pointer"
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
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-[6px] text-xs font-bold shadow-sm transition cursor-pointer"
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
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[6px] text-xs font-bold shadow-sm transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Emitir Guía de Remisión</span>
            </button>
          )}
        </div>
      </div>

      {/* Contenido de Cada Pestaña */}

      {/* 1. Facturas */}
      {activeTab === "facturas" && (
        <div className="bg-white rounded-[6px] border border-slate-200/80 shadow-2xs overflow-hidden">
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
                  filteredInvoices.map((inv) => {
                    const isNotaVenta = inv.documentType === "nota_venta";
                    const isDraft = inv.status === "borrador";
                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-slate-900">
                              {inv.documentNumber}
                            </span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-[4px] uppercase ${
                                isNotaVenta
                                  ? "bg-slate-800 text-emerald-300"
                                  : "bg-blue-50 text-[#004ac6] border border-blue-200"
                              }`}
                            >
                              {isNotaVenta ? "Nota Venta" : "Factura"}
                            </span>
                          </div>
                          <span
                            className="text-[10px] font-mono text-slate-400 truncate max-w-[160px] block"
                            title={inv.claveAcceso}
                          >
                            {isNotaVenta
                              ? "Recibo Control Interno"
                              : isDraft
                              ? "Borrador Pendiente"
                              : `Clave: ${(inv.claveAcceso || "").slice(-10)}`}
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
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-[4px] border ${
                              inv.status === "autorizada" || inv.status === "registrado"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                                : inv.status === "anulada"
                                ? "bg-rose-50 text-rose-700 border-rose-300"
                                : inv.status === "emitida"
                                ? "bg-sky-50 text-sky-700 border-sky-300"
                                : "bg-slate-100 text-slate-600 border-slate-200"
                            }`}
                          >
                            {isNotaVenta && inv.status === "autorizada"
                              ? "REGISTRADO"
                              : inv.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => handleOpenRide(inv)}
                              className="p-1.5 rounded-[6px] text-slate-600 hover:text-[#004ac6] hover:bg-blue-50 transition cursor-pointer"
                              title={isNotaVenta ? "Ver / Imprimir Nota de Venta" : "Ver / Imprimir RIDE PDF"}
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            {!isNotaVenta && !isDraft && (
                              <>
                                <button
                                  onClick={() => handleDownloadXmlDirect(inv)}
                                  className="p-1.5 rounded-[6px] text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 transition cursor-pointer"
                                  title="Descargar XML SRI Firmado"
                                >
                                  <FileCode className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleConsultarSri(inv.claveAcceso, inv.documentNumber)}
                                  className="p-1.5 rounded-[6px] text-slate-600 hover:text-sky-600 hover:bg-sky-50 transition cursor-pointer"
                                  title="Consultar Estado en SRI"
                                >
                                  <ShieldCheck className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleEmitNcFromInvoice(inv)}
                                  className="p-1.5 rounded-[6px] text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                  title="Emitir Nota de Crédito"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleEmitRemissionFromInvoice(inv)}
                                  className="p-1.5 rounded-[6px] text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                                  title="Emitir Guía de Remisión"
                                >
                                  <Truck className="w-4 h-4" />
                                </button>
                              </>
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
      )}

      {/* 2. Cotizaciones */}
      {activeTab === "cotizaciones" && (
        <div className="bg-white rounded-[6px] border border-slate-200/80 shadow-2xs overflow-hidden">
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
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-[4px] border ${
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
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[6px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-2xs transition cursor-pointer"
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
                            onClick={() => setQuoteToPreview(q)}
                            className="p-1 rounded-[6px] text-slate-500 hover:text-sky-600 hover:bg-sky-50 transition cursor-pointer"
                            title="Ver / Imprimir Cotización Formal PDF"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              setQuoteToEdit(q);
                              setIsQuoteModalOpen(true);
                            }}
                            className="p-1 rounded-[6px] text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
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
        <div className="bg-white rounded-[6px] border border-slate-200/80 shadow-2xs overflow-hidden">
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
                  <th className="py-3 px-4 text-right">Acciones</th>
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
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-[4px] bg-emerald-50 text-emerald-700 border border-emerald-300">
                          {nc.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleOpenNcRide(nc)}
                            className="p-1.5 rounded-[6px] text-slate-600 hover:text-[#004ac6] hover:bg-blue-50 transition cursor-pointer"
                            title="Ver RIDE PDF"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDownloadXmlCreditNote(nc)}
                            className="p-1.5 rounded-[6px] text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 transition cursor-pointer"
                            title="Descargar XML Nota de Crédito"
                          >
                            <FileCode className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleConsultarSri(nc.claveAcceso, nc.documentNumber)}
                            className="p-1.5 rounded-[6px] text-slate-600 hover:text-sky-600 hover:bg-sky-50 transition cursor-pointer"
                            title="Consultar Estado en SRI"
                          >
                            <ShieldCheck className="w-4 h-4" />
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

      {/* 4. Retenciones */}
      {activeTab === "retenciones" && (
        <div className="bg-white rounded-[6px] border border-slate-200/80 shadow-2xs overflow-hidden">
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
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {billingWithholdings.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
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
                              className="inline-block mr-2 px-2 py-0.5 rounded-[4px] bg-slate-100 text-slate-700 font-mono text-[10px]"
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
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-[4px] bg-emerald-50 text-emerald-700 border border-emerald-300">
                          {ret.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleOpenWithholdingRide(ret)}
                            className="p-1.5 rounded-[6px] text-slate-600 hover:text-[#004ac6] hover:bg-blue-50 transition cursor-pointer"
                            title="Ver RIDE PDF"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDownloadXmlWithholding(ret)}
                            className="p-1.5 rounded-[6px] text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 transition cursor-pointer"
                            title="Descargar XML Retención"
                          >
                            <FileCode className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleConsultarSri(ret.claveAcceso, ret.documentNumber)}
                            className="p-1.5 rounded-[6px] text-slate-600 hover:text-sky-600 hover:bg-sky-50 transition cursor-pointer"
                            title="Consultar Estado en SRI"
                          >
                            <ShieldCheck className="w-4 h-4" />
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

      {/* 5. Guías de Remisión */}
      {activeTab === "guias_remision" && (
        <div className="bg-white rounded-[6px] border border-slate-200/80 shadow-2xs overflow-hidden">
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
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {billingRemissionGuides.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
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
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-[4px] bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {g.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleOpenRemissionRide(g)}
                            className="p-1.5 rounded-[6px] text-slate-600 hover:text-[#004ac6] hover:bg-blue-50 transition cursor-pointer"
                            title="Ver RIDE PDF"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDownloadXmlRemission(g)}
                            className="p-1.5 rounded-[6px] text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 transition cursor-pointer"
                            title="Descargar XML Guía"
                          >
                            <FileCode className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleConsultarSri(g.claveAcceso, g.documentNumber)}
                            className="p-1.5 rounded-[6px] text-slate-600 hover:text-sky-600 hover:bg-sky-50 transition cursor-pointer"
                            title="Consultar Estado en SRI"
                          >
                            <ShieldCheck className="w-4 h-4" />
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

      {/* Modal Dialog: Verificación en vivo de Estado en SRI */}
      {sriStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3">
          <div className="w-full max-w-lg bg-white rounded-[6px] shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-[#004ac6]" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Consulta de Estado en SRI
                </h3>
              </div>
              <button
                onClick={() => setSriStatusModal(null)}
                className="p-1 text-slate-400 hover:text-slate-700 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-[6px] bg-slate-50 border border-slate-200/80 space-y-1">
                <p className="text-slate-600">
                  <span className="font-semibold text-slate-800">Comprobante:</span> {sriStatusModal.docNumber}
                </p>
                <p className="text-slate-600 break-all font-mono text-[11px]">
                  <span className="font-semibold text-slate-800 font-sans">Clave de Acceso:</span> {sriStatusModal.claveAcceso}
                </p>
                <p className="text-slate-600">
                  <span className="font-semibold text-slate-800">Ambiente:</span>{" "}
                  {sriCompanyConfig.ambiente === "2" ? "2 - Producción Oficial" : "1 - Pruebas / Homologación"}
                </p>
              </div>

              {sriStatusModal.loading ? (
                <div className="py-6 flex flex-col items-center justify-center gap-2 text-slate-500">
                  <div className="w-6 h-6 border-2 border-[#004ac6] border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-semibold">Consultando servidores del SRI...</span>
                </div>
              ) : sriStatusModal.result ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-[6px] bg-emerald-50 border border-emerald-200 text-emerald-800 space-y-1">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span className="font-bold text-xs uppercase">
                        Estado SRI: {sriStatusModal.result.estado}
                      </span>
                    </div>
                    {sriStatusModal.result.numeroAutorizacion && (
                      <p className="text-[11px] font-mono break-all text-emerald-900">
                        No. Autorización: {sriStatusModal.result.numeroAutorizacion}
                      </p>
                    )}
                    {sriStatusModal.result.fechaAutorizacion && (
                      <p className="text-[11px] text-emerald-900">
                        Fecha / Hora: {new Date(sriStatusModal.result.fechaAutorizacion).toLocaleString("es-EC")}
                      </p>
                    )}
                  </div>

                  {sriStatusModal.result.mensajes && sriStatusModal.result.mensajes.length > 0 && (
                    <div className="space-y-1">
                      <span className="font-bold text-[11px] text-slate-700">Mensajes del SRI:</span>
                      {sriStatusModal.result.mensajes.map((m, idx) => (
                        <div key={idx} className="p-2 rounded-[4px] bg-slate-100 text-slate-700 text-[11px]">
                          <strong>[{m.tipo || "INFO"}]</strong> {m.mensaje}
                          {m.informacionAdicional && <span className="block text-slate-500">{m.informacionAdicional}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSriStatusModal(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-[6px] text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
              >
                Cerrar Consulta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dialog: Convertir Cotización a Factura */}
      {quoteToConvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3">
          <div className="w-full max-w-md bg-white rounded-[6px] shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[6px] bg-emerald-100 text-emerald-700 flex items-center justify-center">
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
                className="w-full text-xs font-semibold rounded-[6px] border border-slate-300 p-2.5 bg-slate-50 text-slate-900"
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
                className="px-4 py-2 rounded-[6px] text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmConvertQuote}
                disabled={isConverting}
                className="px-5 py-2 rounded-[6px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md flex items-center gap-2 cursor-pointer"
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
          setRideWithholding(null);
          setRideRemissionGuide(null);
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
          setRideRemissionGuide(g);
          setRideInvoice(null);
          setRideCreditNote(null);
          setRideWithholding(null);
          setIsRideOpen(true);
        }}
      />

      <RidePreviewModal
        isOpen={isRideOpen}
        onClose={() => {
          setIsRideOpen(false);
          setRideInvoice(null);
          setRideCreditNote(null);
          setRideWithholding(null);
          setRideRemissionGuide(null);
        }}
        invoice={rideInvoice}
        creditNote={rideCreditNote}
        withholding={rideWithholding}
        remissionGuide={rideRemissionGuide}
        companyConfig={sriCompanyConfig}
      />

      <QuotePreviewModal
        quote={quoteToPreview}
        onClose={() => setQuoteToPreview(null)}
      />
    </div>
  );
}
