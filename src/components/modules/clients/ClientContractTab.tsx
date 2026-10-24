"use client";

import React, { useState, useMemo } from "react";
import {
  Client,
  ClientDocumentFile,
  SriInvoice,
  ClientService,
  ServiceStatus,
  ServiceBillingFrequency,
  InvoiceItem,
} from "@/types";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { safeNumber } from "@/lib/print-service";
import { NewSaleView } from "../billing/NewSaleView";
import { ProductModal } from "../inventory/ProductModal";
import { RidePreviewModal } from "../billing/RidePreviewModal";
import { ClientTabHeader } from "./ClientTabHeader";
import {
  Download,
  FileText,
  Upload,
  Plus,
  Trash2,
  FileCheck,
  ShieldCheck,
  X,
  Receipt,
  Eye,
  CheckCircle2,
  Calendar,
  Search,
  RefreshCw,
  MessageCircle,
  Mail,
  Ban,
  AlertTriangle,
  Wrench,
  ExternalLink,
} from "lucide-react";

export function ClientContractTab({ client }: { client: Client }) {
  const {
    clientServices,
    clientDocuments,
    billingInvoices,
    inventoryProducts,
    sriCompanyConfig,
    addClientService,
    updateClientService,
    deleteClientService,
    renewClientService,
    emitRecurringInvoiceForClient,
    addClientDocument,
    deleteClientDocument,
  } = useApp();
  const { showError, showSuccess, showConfirm } = useToast();

  // Mode: Sale Emission / Add service via sale
  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false);
  const [saleInitialItems, setSaleInitialItems] = useState<InvoiceItem[] | undefined>(undefined);
  const [rideInvoiceToPreview, setRideInvoiceToPreview] = useState<SriInvoice | null>(null);

  // Quick form to add a service strictly from INVENTARIO DE SERVICIOS
  const [isAddingService, setIsAddingService] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [newSvcPrice, setNewSvcPrice] = useState("");
  const [newSvcFreq, setNewSvcFreq] = useState<ServiceBillingFrequency>("mensual");
  const [newSvcRenewalDate, setNewSvcRenewalDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split("T")[0];
  });
  const [savingService, setSavingService] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);

  // File upload state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docType, setDocType] = useState<ClientDocumentFile["documentType"]>("contrato_adhesion");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [emittingRecurring, setEmittingRecurring] = useState(false);

  // Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [serviceFilter, setServiceFilter] = useState<
    "todos" | "con_venta" | "pendiente_venta" | "facturables" | "por_renovar"
  >("todos");

  const docs = clientDocuments.filter((d) => d.clientId === client.id);

  // Available services exclusively from inventory catalog (type === "servicio")
  const availableServices = useMemo(() => {
    return inventoryProducts.filter((p) => p.type === "servicio" && p.status === "activo");
  }, [inventoryProducts]);

  // Invoices for this client
  const clientInvoices = useMemo(() => {
    return billingInvoices.filter(
      (inv) =>
        inv.clientId === client.id ||
        (inv.clientRuc && inv.clientRuc === client.identificationNumber)
    );
  }, [billingInvoices, client.id, client.identificationNumber]);

  // Client recurring services from clientServices
  const servicesForClient = useMemo(() => {
    return clientServices.filter((s) => s.clientId === client.id && s.status !== "retirado");
  }, [clientServices, client.id]);

  // Helper: calculate days until renewal
  const getRenewalStatus = (nextDate?: string) => {
    if (!nextDate) {
      return { label: "Sin fecha", tone: "slate", daysLeft: 999 };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(`${nextDate}T00:00:00`);
    const diffDays = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { label: `Vencido (${Math.abs(diffDays)}d)`, tone: "rose", daysLeft: diffDays };
    }
    if (diffDays <= 15) {
      return { label: `Por renovar (${diffDays}d)`, tone: "amber", daysLeft: diffDays };
    }
    return { label: `Al día (${diffDays}d)`, tone: "emerald", daysLeft: diffDays };
  };

  // Filtered recurring services
  const filteredServices = useMemo(() => {
    return servicesForClient.filter((s) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        s.planName.toLowerCase().includes(q) ||
        (s.inventorySku && s.inventorySku.toLowerCase().includes(q)) ||
        (s.saleDocNumber && s.saleDocNumber.toLowerCase().includes(q)) ||
        (s.notes && s.notes.toLowerCase().includes(q));

      const hasSale = s.saleStatus === "emitida" || !!s.saleDocNumber;
      const isPendingSale = s.saleStatus === "pendiente_venta" || (!s.saleDocNumber && s.origin === "manual");
      const isBillable = s.status === "activo" && s.isBillableInCurrentCycle !== false;
      const renewal = getRenewalStatus(s.nextRenewalDate);
      const isDueSoon = renewal.daysLeft <= 15 || s.status === "por_renovar";

      const matchesFilter =
        serviceFilter === "todos" ||
        (serviceFilter === "con_venta" && hasSale) ||
        (serviceFilter === "pendiente_venta" && isPendingSale) ||
        (serviceFilter === "facturables" && isBillable) ||
        (serviceFilter === "por_renovar" && isDueSoon);

      return matchesQuery && matchesFilter;
    });
  }, [servicesForClient, searchQuery, serviceFilter]);

  // Summary metrics for this client's services
  const serviceMetrics = useMemo(() => {
    const total = servicesForClient.length;
    const conVentaCount = servicesForClient.filter(
      (s) => s.saleStatus === "emitida" || !!s.saleDocNumber
    ).length;
    const pendienteVentaCount = servicesForClient.filter(
      (s) => s.saleStatus === "pendiente_venta" || (!s.saleDocNumber && s.origin === "manual")
    ).length;
    const billableList = servicesForClient.filter(
      (s) => s.status === "activo" && s.isBillableInCurrentCycle !== false
    );
    const nonBillableCount = total - billableList.length;
    const subtotalBillable = billableList.reduce(
      (sum, s) => sum + (s.customPrice ?? s.basePrice ?? 0),
      0
    );
    return {
      total,
      conVentaCount,
      pendienteVentaCount,
      billableCount: billableList.length,
      nonBillableCount,
      subtotalBillable,
      totalWithTax: Math.round(subtotalBillable * 1.15 * 100) / 100,
    };
  }, [servicesForClient]);

  // Add new service handler taking exclusively from INVENTARIO DE SERVICIOS
  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedProd = availableServices.find((p) => p.id === selectedServiceId);
    if (!selectedProd) {
      showError("Servicio Requerido", "Debes seleccionar un servicio técnico del Inventario de Servicios.");
      return;
    }
    const priceNum = parseFloat(newSvcPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      showError("Tarifa inválida", "Ingresa un valor mayor a $0.00.");
      return;
    }

    setSavingService(true);
    try {
      await addClientService({
        clientId: client.id,
        planId: selectedProd.id,
        planName: selectedProd.name,
        inventoryProductId: selectedProd.id,
        inventorySku: selectedProd.sku,
        status: "activo",
        billingType: "pospago",
        billingFrequency: newSvcFreq,
        isBillableInCurrentCycle: true,
        nextRenewalDate: newSvcRenewalDate,
        basePrice: selectedProd.salePrice,
        customPrice: priceNum,
        origin: "manual",
        saleStatus: "pendiente_venta",
        downloadMbps: 100,
        uploadMbps: 100,
        cutoffDay: 5,
        nodeId: "node-1",
        nodeName: "NODO-CENTRAL",
        ipv4Address: "DHCP",
        pppoeUser: `svc-${Date.now()}`,
        installationAddress: client.address || "Dirección Principal",
        installationDate: new Date().toISOString().split("T")[0],
      });
      showSuccess(
        "Servicio Asignado",
        `Se vinculó "${selectedProd.name}" a la ficha del cliente como 'Pendiente de generar Nota de Venta'.`
      );
      setSelectedServiceId("");
      setNewSvcPrice("");
      setIsAddingService(false);
    } catch (err: any) {
      showError("Error", err?.message || "No se pudo añadir el servicio.");
    } finally {
      setSavingService(false);
    }
  };

  // Launch New Sale pre-configured with this client service
  const handleGenerateNotaVentaForService = (svc: ClientService) => {
    const price = svc.customPrice ?? svc.basePrice ?? 0;
    const ivaRate = 15;
    const ivaAmount = Math.round(price * 0.15 * 100) / 100;
    const total = Math.round((price + ivaAmount) * 100) / 100;

    const item: InvoiceItem = {
      id: `it-${Date.now()}`,
      productId: svc.inventoryProductId || svc.planId,
      sku: svc.inventorySku || "SRV-001",
      name: svc.planName,
      description: `Servicio contratado: ${svc.planName} (${svc.billingFrequency === "anual" ? "Anual" : "Mensual"})`,
      unit: "servicio",
      quantity: 1,
      unitPrice: price,
      discount: 0,
      ivaRate,
      subtotal: price,
      ivaAmount,
      total,
    };

    setSaleInitialItems([item]);
    setIsNewSaleOpen(true);
  };

  // View linked sales document RIDE / Ticket
  const handleOpenSaleDoc = (svc: ClientService) => {
    const inv = billingInvoices.find(
      (i) => i.id === svc.saleInvoiceId || i.documentNumber === svc.saleDocNumber
    );
    if (inv) {
      setRideInvoiceToPreview(inv);
    } else {
      showError(
        "Comprobante no disponible",
        `No se encontró el registro local para el comprobante ${svc.saleDocNumber || ""}.`
      );
    }
  };

  // Toggle billable in current cycle (Facturable vs No Facturado)
  const handleToggleBillable = async (svc: ClientService) => {
    const currentlyBillable = svc.isBillableInCurrentCycle !== false && svc.status === "activo";
    const nextBillable = !currentlyBillable;
    try {
      await updateClientService(svc.id, {
        isBillableInCurrentCycle: nextBillable,
        ...(nextBillable && svc.status !== "activo" ? { status: "activo" } : {}),
        nonBillableReason: nextBillable ? "" : "Excluido del ciclo actual (No contratado este periodo)",
      });
      showSuccess(
        nextBillable ? "Incluido en Facturación" : "Pasó a No Facturado",
        nextBillable
          ? `"${svc.planName}" se facturará normalmente en este ciclo.`
          : `"${svc.planName}" fue marcado como No Facturado y no se cobrará en este ciclo.`
      );
    } catch {
      showError("Error", "No se pudo actualizar la facturabilidad del servicio.");
    }
  };

  // Change operational status (Activo / Inactivo / Por Renovar / Suspendido)
  const handleStatusChange = async (svc: ClientService, newStatus: ServiceStatus) => {
    const autoBillable = newStatus === "activo";
    try {
      await updateClientService(svc.id, {
        status: newStatus,
        isBillableInCurrentCycle: autoBillable,
      });
      showSuccess(
        "Estado Actualizado",
        `El servicio "${svc.planName}" ahora está ${newStatus.replace("_", " ").toUpperCase()}.`
      );
    } catch {
      showError("Error", "No se pudo cambiar el estado del servicio.");
    }
  };

  // Notify via WhatsApp (1 click)
  const handleNotifyWhatsApp = async (svc: ClientService) => {
    const rawPhone = (client.phone || "").replace(/\D/g, "");
    const cleanPhone = rawPhone.startsWith("0")
      ? `593${rawPhone.slice(1)}`
      : rawPhone.startsWith("593")
      ? rawPhone
      : `593${rawPhone}`;

    const price = (svc.customPrice ?? svc.basePrice ?? 0).toFixed(2);
    const freqLabel = svc.billingFrequency === "anual" ? "anual" : "mensual";
    const renewalDate = svc.nextRenewalDate || "próximo vencimiento";

    const message = `Hola *${client.businessName}*, le saludamos de *Control Inntel*. Le informamos que su servicio *${svc.planName}* (ciclo ${freqLabel} - $${price} + IVA) tiene fecha de renovación para el *${renewalDate}*. Por favor confírmenos su renovación para mantener el servicio activo en el presente periodo.`;

    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");
    await updateClientService(svc.id, {
      lastNotificationSentAt: new Date().toISOString().split("T")[0],
    });
  };

  // Notify via Email (1 click)
  const handleNotifyEmail = async (svc: ClientService) => {
    const price = (svc.customPrice ?? svc.basePrice ?? 0).toFixed(2);
    const freqLabel = svc.billingFrequency === "anual" ? "Anual" : "Mensual";
    const renewalDate = svc.nextRenewalDate || "próximo periodo";

    const subject = `Aviso de Renovación de Servicio (${freqLabel}): ${svc.planName}`;
    const body = `Estimado(a) ${client.businessName},\n\nLe saludamos cordialmente. Le informamos que su servicio contratado "${svc.planName}" con tarifa ${freqLabel.toLowerCase()} de $${price} USD (+ IVA) registra fecha de renovación el ${renewalDate}.\n\nPor favor confírmenos la continuidad del servicio para proceder con la facturación correspondiente del periodo.\n\nAtentamente,\nDepartamento de Facturación y Cartera`;

    window.open(
      `mailto:${client.email || ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
      "_self"
    );
    await updateClientService(svc.id, {
      lastNotificationSentAt: new Date().toISOString().split("T")[0],
    });
  };

  // Renew service (+1 month or +1 year)
  const handleRenewService = async (svc: ClientService) => {
    try {
      await renewClientService(svc.id);
      const periodName = svc.billingFrequency === "anual" ? "1 año" : "1 mes";
      showSuccess("Servicio Renovado", `Se extendió la vigencia de "${svc.planName}" por +${periodName} y quedó Activo/Facturable.`);
    } catch {
      showError("Error", "No se pudo renovar el servicio.");
    }
  };

  // Emit recurring invoice for active & billable services of this client
  const handleEmitClientRecurringInvoice = async () => {
    if (serviceMetrics.billableCount === 0) {
      showError("Sin servicios facturables", "Activa al menos un servicio como Facturable antes de emitir la factura.");
      return;
    }
    setEmittingRecurring(true);
    try {
      const now = new Date();
      const invoice = await emitRecurringInvoiceForClient(
        client.id,
        now.getMonth() + 1,
        now.getFullYear()
      );
      if (invoice) {
        showSuccess(
          "Factura Recurrente Emitida",
          `Se emitió la factura ${invoice.documentNumber} con ${serviceMetrics.billableCount} servicio(s) facturable(s) por $${invoice.total.toFixed(2)}.`
        );
      }
    } catch (err: any) {
      showError("Error al Facturar", err?.message || "No se pudo generar la factura recurrente.");
    } finally {
      setEmittingRecurring(false);
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

      let fileUrl = "#";
      try {
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("folder", `client-docs/${client.id}`);
        const uploadRes = await fetch("/api/blob/upload", {
          method: "POST",
          body: formData,
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          if (uploadData.url) fileUrl = uploadData.url;
        }
      } catch (uploadErr) {
        console.warn("Upload service note:", uploadErr);
      }

      await addClientDocument({
        clientId: client.id,
        title: docTitle.trim(),
        documentType: docType,
        fileName: selectedFile.name,
        fileSize: sizeStr,
        fileUrl,
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

  const triggerRealDownload = (url?: string, filename?: string) => {
    const name = filename || "documento_cliente";
    if (!url || url === "#") {
      const textContent = `CONTROL INNTEL - EXPEDIENTE DIGITAL DEL CLIENTE\nDocumento: ${name}\nFecha: ${new Date().toLocaleString("es-EC")}\nRegistro Verificado`;
      const blob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = name.includes(".") ? name : `${name}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      showSuccess("Descarga Iniciada", `Descargando: ${name}`);
      return;
    }
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSuccess("Descarga Iniciada", `Descargando: ${name}`);
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

  if (isNewSaleOpen) {
    return (
      <div className="animate-in fade-in duration-200">
        <NewSaleView
          initialClientId={client.id}
          initialDocType="nota_venta"
          initialItems={saleInitialItems}
          onBack={() => {
            setIsNewSaleOpen(false);
            setSaleInitialItems(undefined);
          }}
          onSuccess={(invoice) => {
            setIsNewSaleOpen(false);
            setSaleInitialItems(undefined);
            showSuccess(
              "Venta Registrada",
              `${invoice.documentType === "nota_venta" ? "Nota de Venta" : "Factura"} ${invoice.documentNumber} emitida con éxito. El servicio quedó vinculado y al día.`
            );
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 select-none animate-in fade-in duration-200">
      {/* ========================================================================= */}
      {/* 1. SEGUIMIENTO DE SERVICIOS */}
      <ClientTabHeader
        title="Servicios"
        icon={ShieldCheck}
        badge={
          <div className="flex items-center gap-2.5 text-xs">
            <span className="text-slate-500">Total: <strong className="text-slate-800">{serviceMetrics.total}</strong></span>
            <span className="text-emerald-700">Con Venta: <strong>{serviceMetrics.conVentaCount}</strong></span>
            <span className="text-amber-700">Pendiente Venta: <strong>{serviceMetrics.pendienteVentaCount}</strong></span>
            <span className="text-blue-700">Activos: <strong>{serviceMetrics.billableCount}</strong></span>
          </div>
        }
        actions={
          <>
            <button
              type="button"
              onClick={() => setIsAddingService((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-[#004ac6] border border-blue-200 rounded-[6px] text-xs font-semibold transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAddingService ? "Cerrar" : "Nuevo Servicio"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSaleInitialItems(undefined);
                setIsNewSaleOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-[6px] text-xs font-semibold transition cursor-pointer"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Nueva Venta</span>
            </button>

            {serviceMetrics.billableCount > 0 && (
              <button
                type="button"
                disabled={emittingRecurring}
                onClick={handleEmitClientRecurringInvoice}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#004ac6] hover:bg-[#003da6] disabled:opacity-50 text-white rounded-[6px] text-xs font-semibold transition shadow-xs cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{emittingRecurring ? "Facturando..." : "Facturar Activos"}</span>
              </button>
            )}
          </>
        }
      />

      <div className="bg-white rounded-[6px] border border-slate-200 shadow-xs overflow-hidden">
        {/* Resumen rápido del ciclo actual del cliente */}
        <div className="px-6 py-2.5 bg-slate-50/70 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="font-mono text-xs">
            <span className="text-slate-500">Monto Mensual (IVA incl.): </span>
            <strong className="text-[#004ac6] text-sm">${safeNumber(serviceMetrics.totalWithTax)}</strong>
          </div>
          {serviceMetrics.pendienteVentaCount > 0 && (
            <div className="flex items-center gap-2 text-amber-800 bg-amber-50 px-3 py-1 rounded-[6px] border border-amber-200 font-semibold text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{serviceMetrics.pendienteVentaCount} servicio(s) asignado(s) manualmente sin Nota de Venta</span>
            </div>
          )}
        </div>

        {/* 1.1 Si no hay servicios creados en inventario: Aviso guiado con acceso directo */}
        {isAddingService && availableServices.length === 0 && (
          <div className="p-4 px-6 bg-amber-50 border-b border-amber-200 flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[6px] bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">
                  No hay servicios registrados en el Inventario de Servicios
                </h4>
                <p className="text-[11px] text-slate-600">
                  Para dar seguimiento a los servicios del cliente, los servicios deben tomarse exclusivamente del catálogo oficial de <strong>Inventarios &gt; Servicios</strong>.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAddingService(false)}
                className="px-3 py-1.5 rounded-[6px] border border-slate-300 bg-white text-slate-600 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => setIsProductModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[#004ac6] hover:bg-[#003da6] text-white text-xs font-bold transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Crear Servicio en Inventario</span>
              </button>
            </div>
          </div>
        )}

        {/* 1.2 Formulario de asignación exclusiva desde INVENTARIO DE SERVICIOS */}
        {isAddingService && availableServices.length > 0 && (
          <form
            onSubmit={handleCreateService}
            className="p-5 px-6 bg-blue-50/50 border-b border-blue-100 space-y-4 animate-in fade-in"
          >
            <div className="flex items-center justify-between border-b border-blue-200/60 pb-2">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-[#004ac6]" />
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                  Asignar Servicio desde Inventario de Servicios
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsProductModalOpen(true)}
                className="text-[11px] font-bold text-[#004ac6] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Crear Nuevo Servicio en Inventario</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {/* Selector Exclusivo de Inventario */}
              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Servicio del Inventario (Catálogo Oficial) *
                </label>
                <select
                  required
                  value={selectedServiceId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedServiceId(id);
                    const prod = availableServices.find((p) => p.id === id);
                    if (prod) {
                      setNewSvcPrice(prod.salePrice ? prod.salePrice.toString() : "0.00");
                    }
                  }}
                  className="w-full bg-white border border-slate-300 rounded-[6px] px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-hidden focus:border-[#004ac6] cursor-pointer"
                >
                  <option value="">-- Selecciona un servicio ({availableServices.length} disponibles) --</option>
                  {availableServices.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.sku}] {p.name} — ${safeNumber(p.salePrice)} {p.categoryName ? `(${p.categoryName})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tarifa Base sin IVA */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Tarifa Asignada ($ sin IVA) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={newSvcPrice}
                  onChange={(e) => setNewSvcPrice(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-[6px] px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:border-[#004ac6]"
                />
              </div>

              {/* Periodicidad y Próxima Renovación */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Ciclo y Próxima Renovación
                </label>
                <div className="flex items-center gap-1.5">
                  <select
                    value={newSvcFreq}
                    onChange={(e) => setNewSvcFreq(e.target.value as ServiceBillingFrequency)}
                    className="bg-white border border-slate-300 rounded-[6px] px-2 py-2 text-xs font-semibold text-slate-800"
                  >
                    <option value="mensual">Mensual</option>
                    <option value="anual">Anual</option>
                  </select>
                  <input
                    type="date"
                    value={newSvcRenewalDate}
                    onChange={(e) => setNewSvcRenewalDate(e.target.value)}
                    className="bg-white border border-slate-300 rounded-[6px] px-2 py-2 text-xs font-mono text-slate-800 w-full"
                  />
                </div>
              </div>
            </div>

            {/* Ficha Resumen del Servicio de Inventario Seleccionado */}
            {selectedServiceId && (() => {
              const prod = availableServices.find((p) => p.id === selectedServiceId);
              if (!prod) return null;
              const priceVal = parseFloat(newSvcPrice) || prod.salePrice || 0;
              const ivaVal = Math.round(priceVal * (prod.ivaRate || 15) / 100 * 100) / 100;
              const totalVal = Math.round((priceVal + ivaVal) * 100) / 100;

              return (
                <div className="p-3 bg-white rounded-[6px] border border-blue-200/80 text-xs flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold bg-blue-100 text-[#004ac6] px-1.5 py-0.5 rounded-[4px]">
                        {prod.sku}
                      </span>
                      <span className="font-bold text-slate-900">{prod.name}</span>
                      {prod.categoryName && (
                        <span className="text-[10px] text-slate-500">• {prod.categoryName}</span>
                      )}
                    </div>
                    {prod.description && (
                      <p className="text-[11px] text-slate-500">{prod.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Tarifa Base</span>
                      <span className="font-mono font-bold text-slate-800">${safeNumber(priceVal)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">IVA ({prod.ivaRate || 15}%)</span>
                      <span className="font-mono font-bold text-slate-600">${safeNumber(ivaVal)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#004ac6] block uppercase font-bold">Total Facturable</span>
                      <span className="font-mono font-bold text-emerald-700 text-sm">${safeNumber(totalVal)}</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Aviso de Asignación Manual */}
            <div className="flex items-start gap-2.5 p-2.5 rounded-[6px] bg-amber-50/80 border border-amber-200 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                <strong>Asignación Manual sin Venta:</strong> El servicio se vinculará a la ficha del cliente y quedará marcado como <span className="font-bold text-amber-800 underline">&quot;Pendiente de generar Nota de Venta&quot;</span>. Podrás emitirle su Nota de Venta comercial en cualquier momento con 1 solo clic.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsAddingService(false);
                  setSelectedServiceId("");
                }}
                className="px-3.5 py-1.5 rounded-[6px] border border-slate-300 bg-white text-slate-600 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingService || !selectedServiceId}
                className="px-4 py-1.5 rounded-[6px] bg-[#004ac6] hover:bg-[#003da6] disabled:opacity-50 text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                {savingService ? "Guardando..." : "Asignar Servicio al Cliente"}
              </button>
            </div>
          </form>
        )}

        {/* Barra de búsqueda y filtro rápido de estado */}
        <div className="p-3 px-6 border-b border-slate-100 bg-white flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por servicio, SKU o nota de venta..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-1.5 rounded-[6px] border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-[#004ac6]"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs flex-wrap">
            {(
              [
                { id: "todos", label: `Todos (${serviceMetrics.total})` },
                { id: "con_venta", label: `Con Venta (${serviceMetrics.conVentaCount})` },
                { id: "pendiente_venta", label: `Pendiente Venta (${serviceMetrics.pendienteVentaCount})` },
                { id: "facturables", label: `Activos (${serviceMetrics.billableCount})` },
                { id: "por_renovar", label: "Por Renovar" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setServiceFilter(tab.id)}
                className={`px-2.5 py-1 rounded-[6px] font-bold text-[11px] transition cursor-pointer ${
                  serviceFilter === tab.id
                    ? "bg-[#004ac6] text-white shadow-2xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tabla de Control Individual de Servicios Contratados */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[960px]">
            <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-[10px] uppercase tracking-wider border-b border-[#e2e8f0]">
              <tr>
                <th className="py-3 px-5">Servicio</th>
                <th className="py-3 px-4">Origen / Venta</th>
                <th className="py-3 px-4">Ciclo</th>
                <th className="py-3 px-4">Renovación</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-center">Facturar</th>
                <th className="py-3 px-4 text-right">Tarifa</th>
                <th className="py-3 px-5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9] text-[#0b1c30]">
              {filteredServices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-xs text-[#737686]">
                    <p className="font-bold text-slate-600">
                      No hay servicios registrados con este filtro.
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Usa el botón <strong>&quot;Nuevo Servicio&quot;</strong> para asignar servicios del Inventario de Servicios o <strong>&quot;Nueva Venta&quot;</strong> para emitir su Nota de Venta.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredServices.map((svc) => {
                  const isBillable = svc.status === "activo" && svc.isBillableInCurrentCycle !== false;
                  const renewal = getRenewalStatus(svc.nextRenewalDate);
                  const price = svc.customPrice ?? svc.basePrice ?? 0;
                  const hasSale = svc.saleStatus === "emitida" || !!svc.saleDocNumber;

                  return (
                    <tr
                      key={svc.id}
                      className={`transition-colors ${
                        isBillable ? "hover:bg-[#f8f9ff]" : "bg-slate-50/70 text-slate-500"
                      }`}
                    >
                      {/* 1. Servicio Contratado */}
                      <td className="py-3.5 px-5">
                        <span className={`font-bold block text-xs ${isBillable ? "text-[#0b1c30]" : "text-slate-500 line-through"}`}>
                          {svc.planName}
                        </span>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
                          {svc.inventorySku && (
                            <span className="font-mono bg-slate-100 text-slate-700 px-1 py-0.2 rounded text-[9px] font-bold">
                              {svc.inventorySku}
                            </span>
                          )}
                          <span>
                            {svc.lastBilledPeriod
                              ? `Últ. facturado: ${svc.lastBilledPeriod}`
                              : `Alta: ${svc.installationDate || "2026-01-15"}`}
                          </span>
                          {svc.lastNotificationSentAt && <span>• Avisado: {svc.lastNotificationSentAt}</span>}
                        </div>
                      </td>

                      {/* 2. Origen / Comprobante de Venta */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {hasSale ? (
                          <div className="space-y-0.5">
                            <button
                              type="button"
                              onClick={() => handleOpenSaleDoc(svc)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[4px] text-[10px] font-bold border transition cursor-pointer ${
                                svc.origin === "nota_venta"
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                                  : "bg-blue-50 text-[#004ac6] border-blue-300 hover:bg-blue-100"
                              }`}
                              title="Ver / Imprimir Comprobante"
                            >
                              {svc.origin === "nota_venta" ? (
                                <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <FileText className="w-3.5 h-3.5 text-blue-600" />
                              )}
                              <span>{svc.origin === "nota_venta" ? "Nota Venta:" : "Factura:"}</span>
                              <span className="font-mono">{svc.saleDocNumber || "Emitida"}</span>
                            </button>
                            {svc.saleDate && (
                              <p className="text-[10px] text-slate-500 font-mono">
                                Fecha: {svc.saleDate}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                              <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                              <span>Pendiente Nota de Venta</span>
                            </span>
                            <div>
                              <button
                                type="button"
                                onClick={() => handleGenerateNotaVentaForService(svc)}
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-[#004ac6] hover:text-[#003da6] hover:underline cursor-pointer"
                              >
                                <Receipt className="w-3 h-3" />
                                <span>+ Generar Nota de Venta</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* 3. Frecuencia (Mensual / Anual) */}
                      <td className="py-3.5 px-4">
                        <select
                          value={svc.billingFrequency || "mensual"}
                          onChange={(e) =>
                            updateClientService(svc.id, {
                              billingFrequency: e.target.value as ServiceBillingFrequency,
                            })
                          }
                          className="bg-white border border-slate-200 rounded-[6px] px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-hidden focus:border-[#004ac6] cursor-pointer"
                        >
                          <option value="mensual">Mensual</option>
                          <option value="anual">Anual</option>
                        </select>
                      </td>

                      {/* 4. Próxima Renovación + Semáforo */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1">
                          <input
                            type="date"
                            value={svc.nextRenewalDate || ""}
                            onChange={(e) =>
                              updateClientService(svc.id, { nextRenewalDate: e.target.value })
                            }
                            className="bg-white border border-slate-200 rounded-[6px] px-2 py-0.5 text-[11px] font-mono text-slate-800 w-32 cursor-pointer"
                          />
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10px] font-bold w-fit ${
                              renewal.tone === "rose"
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : renewal.tone === "amber"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            }`}
                          >
                            {renewal.label}
                          </span>
                        </div>
                      </td>

                      {/* 5. Estado Operativo */}
                      <td className="py-3.5 px-4 text-center">
                        <select
                          value={svc.status}
                          onChange={(e) => handleStatusChange(svc, e.target.value as ServiceStatus)}
                          className={`rounded-[6px] px-2.5 py-1 text-[11px] font-bold uppercase border cursor-pointer focus:outline-hidden ${
                            svc.status === "activo"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : svc.status === "por_renovar"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-slate-100 text-slate-600 border-slate-300"
                          }`}
                        >
                          <option value="activo">ACTIVO</option>
                          <option value="por_renovar">POR RENOVAR</option>
                          <option value="inactivo">INACTIVO</option>
                          <option value="suspendido">SUSPENDIDO</option>
                        </select>
                      </td>

                      {/* 6. Switch Facturable vs No Facturado en el ciclo actual */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleBillable(svc)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase transition cursor-pointer ${
                            isBillable
                              ? "bg-blue-50 text-[#004ac6] border border-blue-200 hover:bg-blue-100"
                              : "bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
                          }`}
                          title="Clic para incluir o excluir este servicio de la factura del ciclo actual"
                        >
                          {isBillable ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-[#004ac6]" />
                              <span>Facturable</span>
                            </>
                          ) : (
                            <>
                              <Ban className="w-3 h-3 text-amber-700" />
                              <span>No Facturado</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* 7. Tarifa Base */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-xs">
                        <span className={isBillable ? "text-emerald-700" : "text-slate-400 line-through"}>
                          ${safeNumber(price)}
                        </span>
                      </td>

                      {/* 8. Acciones: Generar Venta (si pendiente), WhatsApp, Correo, Renovar, Eliminar */}
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!hasSale && (
                            <button
                              type="button"
                              onClick={() => handleGenerateNotaVentaForService(svc)}
                              className="px-2 py-1 text-[10px] font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-[6px] transition flex items-center gap-1 cursor-pointer"
                              title="Generar Nota de Venta comercial para este servicio"
                            >
                              <Receipt className="w-3 h-3 text-emerald-400" />
                              <span>Nota Venta</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleNotifyWhatsApp(svc)}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-[6px] transition cursor-pointer"
                            title="Notificar renovación por WhatsApp"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleNotifyEmail(svc)}
                            className="p-1.5 text-[#004ac6] hover:bg-blue-50 rounded-[6px] transition cursor-pointer"
                            title="Notificar renovación por Correo Electrónico"
                          >
                            <Mail className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRenewService(svc)}
                            className="px-2 py-1 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-[6px] transition flex items-center gap-1 cursor-pointer"
                            title="Renovar por +1 periodo y activar servicio"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Renovar</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              showConfirm(
                                "¿Retirar Servicio?",
                                `¿Deseas eliminar "${svc.planName}" de la lista de servicios de este cliente?`,
                                () => deleteClientService(svc.id),
                                "Eliminar"
                              )
                            }
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-[6px] transition cursor-pointer"
                            title="Eliminar servicio"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* 2. EXPEDIENTE DIGITAL DEL CLIENTE */}
      <ClientTabHeader
        title="Documentos"
        icon={FileCheck}
        badge={
          <span className="text-[11px] font-semibold text-slate-500">
            ({docs.length})
          </span>
        }
        actions={
          <button
            type="button"
            onClick={() => {
              setDocTitle("");
              setSelectedFile(null);
              setIsUploadModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg text-xs font-semibold transition shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Subir</span>
          </button>
        }
      />

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[650px]">
            <thead className="bg-slate-50 text-slate-500 font-bold text-[10px] uppercase tracking-wider border-b border-slate-200">
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
                          onClick={() => triggerRealDownload(doc.fileUrl, doc.fileName)}
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

      {/* MODAL: SUBIR DOCUMENTO AL EXPEDIENTE */}
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

      {/* MODAL 1: CREAR SERVICIO EN EL INVENTARIO OFICIAL */}
      <ProductModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        defaultType="servicio"
      />

      {/* MODAL 2: VISOR OFICIAL RIDE / TICKET DE LA NOTA DE VENTA O FACTURA */}
      {rideInvoiceToPreview && (
        <RidePreviewModal
          isOpen={!!rideInvoiceToPreview}
          onClose={() => setRideInvoiceToPreview(null)}
          invoice={rideInvoiceToPreview}
          companyConfig={sriCompanyConfig}
        />
      )}
    </div>
  );
}
