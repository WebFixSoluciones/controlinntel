"use client";

import React, { useState, useMemo } from "react";
import { Client, ClientDocumentFile, SriInvoice, ClientService } from "@/types";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { generateAdhesionContractDocx, triggerBrowserDownload } from "@/lib/doc-generator";
import { NewSaleView } from "../billing/NewSaleView";
import {
  Download,
  FileText,
  Upload,
  Plus,
  Trash2,
  FileCheck,
  ShieldCheck,
  File,
  X,
  Receipt,
  Eye,
  CheckCircle2,
  Calendar,
  DollarSign,
  Search,
  ExternalLink,
  Zap,
} from "lucide-react";

export function ClientContractTab({ client }: { client: Client }) {
  const {
    clientServices,
    clientContracts,
    clientDocuments,
    billingInvoices,
    addClientDocument,
    deleteClientDocument,
  } = useApp();
  const { showError, showSuccess, showConfirm } = useToast();

  // Mode: Sale Emission / Add service via sale
  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false);
  const [selectedInvoiceView, setSelectedInvoiceView] = useState<SriInvoice | null>(null);

  // File upload state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docType, setDocType] = useState<ClientDocumentFile["documentType"]>("contrato_adhesion");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  // Filter
  const [searchQuery, setSearchQuery] = useState("");

  const docs = clientDocuments.filter((d) => d.clientId === client.id);

  // Invoices for this client
  const clientInvoices = useMemo(() => {
    return billingInvoices.filter(
      (inv) =>
        inv.clientId === client.id ||
        (inv.clientRuc && inv.clientRuc === client.identificationNumber)
    );
  }, [billingInvoices, client.id, client.identificationNumber]);

  // Active services from clientServices
  const activeServices = useMemo(() => {
    return clientServices.filter((s) => s.clientId === client.id);
  }, [clientServices, client.id]);

  // Contracts for this client
  const contracts = useMemo(() => {
    return clientContracts.filter((c) => c.clientId === client.id);
  }, [clientContracts, client.id]);

  // Contracted Services List derived from sales invoices & active services
  const contractedServices = useMemo(() => {
    const list: Array<{
      id: string;
      name: string;
      description: string;
      invoiceNumber: string;
      invoiceType: string;
      date: string;
      price: number;
      homologation: string;
      status: string;
      rawInvoice?: SriInvoice;
      rawService?: ClientService;
    }> = [];

    // 1. Services originated from Sales Invoices (Facturas SRI / Notas de Venta)
    clientInvoices.forEach((inv) => {
      inv.items.forEach((it) => {
        list.push({
          id: `inv-svc-${inv.id}-${it.id}`,
          name: it.name,
          description: it.description || "Servicio contratado mediante emisión de venta",
          invoiceNumber: inv.documentNumber,
          invoiceType: inv.paymentMethod === "credito" ? "Venta a Crédito" : "Factura Electrónica SRI",
          date: inv.date,
          price: it.unitPrice,
          homologation: "ARCOTEL-SAI-2026",
          status: inv.status === "anulada" ? "anulado" : "activo",
          rawInvoice: inv,
        });
      });
    });

    // 2. Client active services (if not already included by invoice number)
    activeServices.forEach((s) => {
      const alreadyInList = list.some((l) => l.name.toLowerCase() === s.planName.toLowerCase());
      if (!alreadyInList) {
        const matchingContract = contracts.find((c) => c.planName === s.planName);
        list.push({
          id: `srv-${s.id}`,
          name: s.planName,
          description: `${s.downloadMbps} Mbps bajada / ${s.uploadMbps} Mbps subida • IP: ${s.ipv4Address || "DHCP Dinámica"}`,
          invoiceNumber: matchingContract?.contractNumber || "Venta Inicial",
          invoiceType: s.billingType === "prepago" ? "Nota de Venta Prepago" : "Factura Electrónica SRI",
          date: s.installationDate || client.createdAt?.split("T")[0] || "2026-01-15",
          price: s.customPrice || s.basePrice || 45,
          homologation: matchingContract?.arcotelHomologationCode || "ARCOTEL-SAI-0041",
          status: s.status === "activo" ? "activo" : s.status,
          rawService: s,
        });
      }
    });

    // Filter by search query
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (it) =>
        it.name.toLowerCase().includes(q) ||
        it.description.toLowerCase().includes(q) ||
        it.invoiceNumber.toLowerCase().includes(q) ||
        it.homologation.toLowerCase().includes(q)
    );
  }, [clientInvoices, activeServices, contracts, client.createdAt, searchQuery]);

  const handleDownloadWordContract = async (serviceName?: string) => {
    try {
      const srv = activeServices.find((s) => s.planName === serviceName) || activeServices[0];
      const blob = await generateAdhesionContractDocx(client, srv);
      triggerBrowserDownload(blob, `Contrato_Adhesion_${client.identificationNumber}.docx`);
      showSuccess("Descarga Exitosa", `Contrato de Adhesión para ${client.businessName} descargado.`);
    } catch {
      showError("Error", "No se pudo generar el contrato Word.");
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle.trim()) {
      showError("Título Requerido", "Ingresa un título para el documento.");
      return;
    }
    if (!selectedFile) {
      showError("Archivo Requerido", "Selecciona un archivo PDF, Word o imagen.");
      return;
    }

    setBusy(true);
    try {
      const fileSizeKb = Math.round(selectedFile.size / 1024);
      const sizeStr = fileSizeKb > 1024 ? `${(fileSizeKb / 1024).toFixed(1)} MB` : `${fileSizeKb} KB`;

      await addClientDocument({
        clientId: client.id,
        title: docTitle.trim(),
        documentType: docType,
        fileName: selectedFile.name,
        fileSize: sizeStr,
        fileUrl: "#",
      });

      showSuccess("Archivo Guardado", `Se cargó "${selectedFile.name}" al expediente digital.`);
      setIsUploadModalOpen(false);
      setDocTitle("");
      setSelectedFile(null);
    } catch (err: any) {
      showError("Error", err?.message || "No se pudo guardar el archivo.");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteDoc = (docId: string, title: string) => {
    showConfirm(
      "¿Eliminar Archivo?",
      `¿Deseas retirar "${title}" del expediente digital del cliente?`,
      async () => {
        try {
          await deleteClientDocument(docId);
          showSuccess("Archivo Eliminado", "El documento ha sido retirado.");
        } catch {
          showError("Error", "No se pudo eliminar el archivo.");
        }
      },
      "Eliminar Archivo"
    );
  };

  const getDocTypeBadge = (type: ClientDocumentFile["documentType"]) => {
    switch (type) {
      case "contrato_adhesion":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-50 text-[#004ac6] border border-blue-200">
            Contrato Firmado
          </span>
        );
      case "proteccion_datos":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
            Protección Datos
          </span>
        );
      case "cedula_ruc":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-50 text-purple-700 border border-purple-200">
            Cédula / RUC
          </span>
        );
      case "acta_entrega":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
            Acta Entrega
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-50 text-slate-700 border border-slate-200">
            Comprobante / Archivo
          </span>
        );
    }
  };

  // If sale emission flow is open, render NewSaleView directly for this client
  if (isNewSaleOpen) {
    return (
      <div className="animate-in fade-in duration-200">
        <NewSaleView
          initialClientId={client.id}
          initialDocType="factura"
          onBack={() => setIsNewSaleOpen(false)}
          onSuccess={(invoice) => {
            setIsNewSaleOpen(false);
            showSuccess(
              "Servicio Contratado",
              `Factura ${invoice.documentNumber} emitida con éxito. El servicio ya está registrado en la ficha del cliente.`
            );
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 select-none animate-in fade-in duration-200">
      {/* ========================================================================= */}
      {/* 1. SECCIÓN: SERVICIOS CONTRATADOS DEL CLIENTE (VÍA VENTAS Y FACTURAS)    */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-lumina-card overflow-hidden">
        {/* Header con botón para Contratar Servicio vía Venta */}
        <div className="p-4 px-6 border-b border-[#e2e8f0] bg-[#f8f9ff] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#004ac6] flex items-center justify-center border border-blue-100">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-[#0b1c30] text-xs uppercase tracking-wider">
                Servicios Contratados del Cliente
              </h3>
              <p className="text-[11px] text-[#737686]">
                Servicios activos asociados a facturas de venta y notas de venta emitidas
              </p>
            </div>
          </div>

          {/* Botón único para contratar servicios por medio de una venta */}
          <button
            type="button"
            onClick={() => setIsNewSaleOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
            title="Para agregar servicios se debe emitir una Factura Electrónica o Nota de Venta"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Contratar Servicio (Vía Venta)</span>
          </button>
        </div>

        {/* Buscador de servicios */}
        <div className="p-3 px-6 border-b border-slate-100 bg-white flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Filtrar servicios contratados..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-[#004ac6]"
            />
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            Total contratados: <strong>{contractedServices.length}</strong>
          </span>
        </div>

        {/* Tabla de Servicios Contratados (SIN columna redundante de Cliente) */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[850px]">
            <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-[10px] uppercase tracking-wider border-b border-[#e2e8f0]">
              <tr>
                <th className="py-3 px-5">Servicio / Plan Contratado</th>
                <th className="py-3 px-5">Venta / Comprobante Origen</th>
                <th className="py-3 px-5">Homologación</th>
                <th className="py-3 px-5">Fecha Alta / Vigencia</th>
                <th className="py-3 px-5 text-center">Estado</th>
                <th className="py-3 px-5 text-right">Tarifa</th>
                <th className="py-3 px-5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9] text-[#0b1c30]">
              {contractedServices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-[#737686]">
                    <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-bold text-slate-600">No hay servicios contratados aún para este cliente.</p>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                      Para contratar un nuevo servicio, haz clic en <strong>&quot;Contratar Servicio (Vía Venta)&quot;</strong> y emite la Factura Electrónica o Nota de Venta correspondiente.
                    </p>
                  </td>
                </tr>
              ) : (
                contractedServices.map((svc) => (
                  <tr key={svc.id} className="hover:bg-[#f8f9ff] transition-colors">
                    {/* Servicio / Plan Contratado */}
                    <td className="py-3.5 px-5">
                      <span className="font-bold text-[#0b1c30] block text-xs">{svc.name}</span>
                      <span className="text-[11px] text-[#737686] block truncate max-w-sm">
                        {svc.description}
                      </span>
                    </td>

                    {/* Venta / Comprobante Origen */}
                    <td className="py-3.5 px-5 font-tnum">
                      <div className="flex items-center gap-1.5">
                        <Receipt className="w-3.5 h-3.5 text-[#004ac6] shrink-0" />
                        <span className="font-mono font-bold text-slate-900 text-xs">
                          {svc.invoiceNumber}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 block mt-0.5 font-medium">
                        {svc.invoiceType}
                      </span>
                    </td>

                    {/* Homologación */}
                    <td className="py-3.5 px-5 font-mono text-[11px] text-slate-600">
                      <span className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                        {svc.homologation}
                      </span>
                    </td>

                    {/* Fecha Alta / Vigencia */}
                    <td className="py-3.5 px-5 whitespace-nowrap">
                      <span className="font-semibold text-slate-800 text-xs block">{svc.date}</span>
                      <span className="text-[10px] text-emerald-600 block font-medium">Contrato vigente</span>
                    </td>

                    {/* Estado */}
                    <td className="py-3.5 px-5 text-center">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        ACTIVO
                      </span>
                    </td>

                    {/* Tarifa */}
                    <td className="py-3.5 px-5 text-right font-mono font-bold text-emerald-700 text-xs">
                      ${svc.price.toFixed(2)} USD
                    </td>

                    {/* Acciones */}
                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Descargar Word del Contrato */}
                        <button
                          type="button"
                          onClick={() => handleDownloadWordContract(svc.name)}
                          className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:text-[#004ac6] hover:bg-[#eff4ff] border border-slate-200 rounded-lg transition cursor-pointer"
                          title="Descargar Contrato de Adhesión Word"
                        >
                          <Download className="w-3.5 h-3.5 text-[#004ac6]" />
                          <span>Word</span>
                        </button>

                        {/* Ver Comprobante si existe */}
                        {svc.rawInvoice && (
                          <button
                            type="button"
                            onClick={() => setSelectedInvoiceView(svc.rawInvoice!)}
                            className="p-1.5 text-slate-500 hover:text-[#004ac6] hover:bg-[#eff4ff] rounded-lg transition cursor-pointer"
                            title="Ver Comprobante de Venta"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. EXPEDIENTE DIGITAL DEL CLIENTE (ARCHIVOS / IMÁGENES / MENOS ES MÁS)     */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-lumina-card overflow-hidden">
        {/* Header resumido y conciso */}
        <div className="p-4 px-6 border-b border-[#e2e8f0] bg-[#f8f9ff] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-[#0b1c30] text-xs uppercase tracking-wider flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-[#004ac6]" />
              Expediente Digital
            </h3>
            <p className="text-[11px] text-[#737686]">
              Archivos, contratos firmados, comprobantes e imágenes del cliente
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setDocTitle("");
              setSelectedFile(null);
              setIsUploadModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Subir Archivo</span>
          </button>
        </div>

        {/* Tabla de Archivos */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[650px]">
            <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-[10px] uppercase tracking-wider border-b border-[#e2e8f0]">
              <tr>
                <th className="py-2.5 px-5">Tipo</th>
                <th className="py-2.5 px-5">Título / Archivo</th>
                <th className="py-2.5 px-5">Fecha Carga</th>
                <th className="py-2.5 px-5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9] text-[#0b1c30]">
              {docs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-xs text-slate-400">
                    <Upload className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                    <span>No hay archivos digitales cargados en el expediente.</span>
                  </td>
                </tr>
              ) : (
                docs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-[#f8f9ff] transition-colors">
                    <td className="py-3 px-5">{getDocTypeBadge(doc.documentType)}</td>
                    <td className="py-3 px-5">
                      <div className="font-bold text-[#0b1c30] text-xs">{doc.title}</div>
                      <div className="font-mono text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <FileText className="w-3 h-3 text-slate-400" />
                        <span>{doc.fileName}</span>
                        <span>({doc.fileSize})</span>
                      </div>
                    </td>
                    <td className="py-3 px-5 text-slate-600 text-xs font-mono">
                      {doc.uploadedAt.split("T")[0]}
                    </td>
                    <td className="py-3 px-5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => showSuccess("Descarga Simulada", `Descargando ${doc.fileName}...`)}
                          className="p-1.5 text-slate-500 hover:text-[#004ac6] hover:bg-[#eff4ff] rounded-lg transition cursor-pointer"
                          title="Descargar archivo"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDoc(doc.id, doc.title)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Eliminar documento"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* ========================================================================= */}
      {/* 3. CARD MINIMALISTA: MODELO DE CONTRATO WORD ARCOTEL                     */}
      {/* ========================================================================= */}
      <div className="p-3.5 px-5 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#004ac6] flex items-center justify-center">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-[#0b1c30]">Plantilla de Contrato de Adhesión ARCOTEL (.docx)</h4>
            <span className="text-[11px] text-slate-500">Formato prellenado con datos legales y vigencia</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleDownloadWordContract()}
          className="flex items-center gap-2 px-3.5 py-1.5 bg-white border border-slate-300 hover:border-[#004ac6] hover:text-[#004ac6] text-slate-700 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-[#004ac6]" />
          <span>Descargar Word</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: SUBIR DOCUMENTO / IMAGEN / COMPROBANTE AL EXPEDIENTE              */}
      {/* ========================================================================= */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-4 px-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-[#004ac6]" />
                <h3 className="font-bold text-slate-900 text-xs">Cargar Archivo al Expediente</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Tipo de Archivo *</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as ClientDocumentFile["documentType"])}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-[#004ac6] outline-hidden cursor-pointer"
                >
                  <option value="contrato_adhesion">Contrato de Adhesión / Servicios Firmado</option>
                  <option value="proteccion_datos">Autorización de Protección de Datos</option>
                  <option value="cedula_ruc">Cédula / Nombramiento Legal / RUC</option>
                  <option value="acta_entrega">Acta de Entrega-Recepción de Equipos</option>
                  <option value="otro">Comprobante de Pago / Imagen / Otro</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Título del Documento *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Contrato Firmado 2026 / Comprobante de Depósito"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:ring-1 focus:ring-[#004ac6] outline-hidden"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Seleccionar Archivo (PDF, Word, JPG, PNG) *</label>
                <input
                  type="file"
                  required
                  accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedFile(e.target.files[0]);
                      if (!docTitle) {
                        setDocTitle(e.target.files[0].name.replace(/\.[^/.]+$/, ""));
                      }
                    }
                  }}
                  className="w-full bg-slate-50 border border-dashed border-slate-300 rounded-xl p-3 text-xs text-slate-600 cursor-pointer file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#004ac6] file:text-white hover:file:bg-[#003da6]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{busy ? "Cargando..." : "Subir Archivo"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: VER DETALLE DE COMPROBANTE DE VENTA DE ORIGEN                      */}
      {/* ========================================================================= */}
      {selectedInvoiceView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="p-4 px-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#004ac6]" />
                <h3 className="font-bold text-slate-900 text-xs">
                  Detalle de Venta: {selectedInvoiceView.documentNumber}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInvoiceView(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Cliente:</span>
                  <span className="font-bold text-slate-900">{selectedInvoiceView.clientName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">RUC / CI:</span>
                  <span className="font-mono font-bold text-slate-800">{selectedInvoiceView.clientRuc}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Fecha de Emisión:</span>
                  <span className="font-mono text-slate-700">{selectedInvoiceView.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Método de Pago:</span>
                  <span className="capitalize font-semibold text-slate-800">{selectedInvoiceView.paymentMethod}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                  <span className="text-slate-500">Estado SRI:</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {selectedInvoiceView.status}
                  </span>
                </div>
              </div>

              {/* Items / Detalle del Servicio */}
              <div>
                <span className="text-[11px] font-bold text-slate-700 block mb-2">Servicios / Productos en este Comprobante:</span>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">Detalle</th>
                        <th className="py-2 px-2 text-center">Cant.</th>
                        <th className="py-2 px-3 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedInvoiceView.items.map((it) => (
                        <tr key={it.id}>
                          <td className="py-2 px-3 font-medium text-slate-800">{it.name}</td>
                          <td className="py-2 px-2 text-center font-mono">{it.quantity}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">${it.subtotal.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t border-slate-200 font-bold">
                      <tr>
                        <td colSpan={2} className="py-2 px-3 text-right">TOTAL:</td>
                        <td className="py-2 px-3 text-right font-mono text-emerald-700">${selectedInvoiceView.total.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div className="pt-2 flex justify-end border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedInvoiceView(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
