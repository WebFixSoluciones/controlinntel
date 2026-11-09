"use client";
import { ActionIconButton } from "@/components/ui/ActionIconButton";

import React, { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Client,
  SriInvoice,
  ClientService,
  ServiceStatus,
  ServiceBillingType,
  ServiceBillingFrequency,
  ServiceContractDuration,
  ServiceCategory,
  ServicePaymentMethod,
} from "@/types";
import { InventoryProduct } from "@/types/inventory";
import { canAccessRoute, canAccessSubmodule, canUser, canViewServicePrices } from "@/lib/permissions";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { safeNumber } from "@/lib/print-service";
import { addDays, calculateLines, previewScheduledService, initialServicePeriod, serviceBillingStart, validDate } from "@/lib/commercial-core";
import {
  getEcuadorDate,
  addMonthsSafely,
  diffInCalendarDays,
  formatDateEC,
  calculateContractEndDate,
  calculateNextRenewalDate,
} from "@/lib/date-utils";
import { ProductModal } from "../inventory/ProductModal";
import { RidePreviewModal } from "../billing/RidePreviewModal";
import {
  Plus,
  Trash2,
  ShieldCheck,
  X,
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
  Pencil,
  Clock,
  Globe,
  Server,
  Sparkles,
} from "lucide-react";

function suggestedContractEnd(start: string, duration: ServiceContractDuration) {
  return validDate(start) && duration !== "indefinido" ? addDays(calculateContractEndDate(start, duration), -1) : "";
}

function ServiceBillingPreview({ service, today }: { service: Record<string, unknown>; today: string }) {
  const first = initialServicePeriod(service);
  const scheduled = previewScheduledService(service, today);
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-slate-800" aria-live="polite">
      <p className="font-semibold text-[#004ac6]">Resumen del contrato y facturación</p>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 lg:grid-cols-4">
        <div><dt className="text-[10px] text-slate-500">Inicio del contrato</dt><dd className="font-semibold">{formatDateEC(String(service.contractStartDate || ""))}</dd></div>
        <div><dt className="text-[10px] text-slate-500">Fin del contrato</dt><dd className="font-semibold">{service.contractEndDate ? formatDateEC(String(service.contractEndDate)) : "Indefinido"}</dd></div>
        {first.eligible && <>
          <div><dt className="text-[10px] text-slate-500">Inicio del período</dt><dd className="font-semibold">{formatDateEC(first.billingStart)}</dd></div>
          <div><dt className="text-[10px] text-slate-500">Fin del período</dt><dd className="font-semibold">{formatDateEC(addDays(first.periodEnd, -1))}</dd></div>
        </>}
      </dl>
      {first.eligible ? <p className="mt-2 font-semibold">{first.line.description} · Total del período ${safeNumber(calculateLines([first.line]).total)}</p> :
        <p role="alert" className="mt-2 text-amber-800">{first.reason}</p>}
      {scheduled.plans ? <>
        <p className="mt-2">Próxima emisión automática prevista {formatDateEC(scheduled.emissionDate)} · Vencimiento previsto {formatDateEC(scheduled.dueDate)} · Total de la emisión ${safeNumber(calculateLines(scheduled.plans.map(plan => plan.line)).total)}</p>
        <ul className="mt-1 text-[11px] text-slate-600">{scheduled.plans.map(plan => <li key={plan.key}>{plan.line.description}</li>)}</ul>
      </> : <p className="mt-2 text-amber-800">{scheduled.reason}</p>}
      <p className="mt-2 text-[11px] text-slate-600">El fin del período se calcula con la frecuencia elegida. En prepago se cobra desde el inicio; en pospago, después del fin. La emisión automática se procesa el día 1.</p>
    </div>
  );
}

export function ClientContractTab({ client }: { client: Client }) {
  const {
    currentUser,
    clientServices,
    billingInvoices,
    inventoryProducts,
    sriCompanyConfig,
    addClientService,
    updateClientService,
    deleteClientService,
    renewClientService,
  } = useApp();
  const showPrices = canViewServicePrices(currentUser);
  const canAssign = showPrices && canUser(currentUser, "clientes", "canEditClient");
  const canEditPrices = canAssign && canUser(currentUser, "clientes", "canEditServicePrices");
  const { showError, showSuccess, showConfirm } = useToast();

  const [rideInvoiceToPreview, setRideInvoiceToPreview] = useState<SriInvoice | null>(null);

  // Quick form to add a service strictly from INVENTARIO DE SERVICIOS
  const [isAddingService, setIsAddingService] = useState(false);
  const [serviceSearchQuery, setServiceSearchQuery] = useState("");
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);
  const [selectedService, setSelectedService] = useState<InventoryProduct | null>(null);
  const [newSvcName, setNewSvcName] = useState("");
  const [newSvcDescription, setNewSvcDescription] = useState("");
  const [newSvcPriceSinIva, setNewSvcPriceSinIva] = useState("");
  const [newSvcPriceConIva, setNewSvcPriceConIva] = useState("");
  const [newSvcIvaRate, setNewSvcIvaRate] = useState(15);
  const [newSvcFreq, setNewSvcFreq] = useState<ServiceBillingFrequency>("mensual");
  const [newSvcDuration, setNewSvcDuration] = useState<ServiceContractDuration>("anual");
  const [newSvcCategory, setNewSvcCategory] = useState<ServiceCategory>("internet");
  const [newSvcBillingType, setNewSvcBillingType] = useState<ServiceBillingType>("prepago");
  const [newSvcBillingDay, setNewSvcBillingDay] = useState<number>(1);
  const [newSvcAdvanceNoticeDay, setNewSvcAdvanceNoticeDay] = useState<number>(26);
  const [newSvcStartDate, setNewSvcStartDate] = useState(() => getEcuadorDate());
  const [newSvcPeriodStartDate, setNewSvcPeriodStartDate] = useState(() => getEcuadorDate());
  const [newSvcEndDate, setNewSvcEndDate] = useState(() => suggestedContractEnd(getEcuadorDate(), "anual"));
  const [newSvcAutoRenew, setNewSvcAutoRenew] = useState(true);
  const [newSvcPaymentMethod, setNewSvcPaymentMethod] = useState<ServicePaymentMethod>("credito");
  const [newCycleAnchor, setNewCycleAnchor] = useState<"calendario" | "aniversario">("aniversario");
  const [newPartialPolicy, setNewPartialPolicy] = useState<"prorrateo" | "completo">("prorrateo");
  const [newZeroReason, setNewZeroReason] = useState("");
  const [savingService, setSavingService] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);

  // Edit existing service state
  const [editingService, setEditingService] = useState<ClientService | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPriceSinIva, setEditPriceSinIva] = useState("");
  const [editPriceConIva, setEditPriceConIva] = useState("");
  const [editIvaRate, setEditIvaRate] = useState(15);
  const [editFreq, setEditFreq] = useState<ServiceBillingFrequency>("mensual");
  const [editDuration, setEditDuration] = useState<ServiceContractDuration>("anual");
  const [editCategory, setEditCategory] = useState<ServiceCategory>("internet");
  const [editBillingType, setEditBillingType] = useState<ServiceBillingType>("prepago");
  const [editBillingDay, setEditBillingDay] = useState<number>(1);
  const [editAdvanceNoticeDay, setEditAdvanceNoticeDay] = useState<number>(26);
  const [editStartDate, setEditStartDate] = useState("");
  const [editPeriodStartDate, setEditPeriodStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editAutoRenew, setEditAutoRenew] = useState(true);
  const [editPaymentMethod, setEditPaymentMethod] = useState<ServicePaymentMethod>("credito");
  const [editCycleAnchor, setEditCycleAnchor] = useState<"calendario" | "aniversario">("aniversario");
  const [editPartialPolicy, setEditPartialPolicy] = useState<"prorrateo" | "completo">("prorrateo");
  const [editZeroReason, setEditZeroReason] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const today = getEcuadorDate();
  const assignmentSchedule = isAddingService && selectedService ? {
    id: selectedService.id, planName: newSvcName || selectedService.name, status: client.status,
    createdAt: `${today}T12:00:00-05:00`, contractStartDate: newSvcStartDate, contractEndDate: newSvcEndDate, billingPeriodStartDate: newSvcPeriodStartDate,
    billingType: newSvcBillingType, billingFrequency: newSvcFreq, cycleAnchor: newCycleAnchor,
    firstPeriodPolicy: newPartialPolicy, billingDay: newSvcBillingDay, advanceNoticeDay: newSvcAdvanceNoticeDay,
    customPrice: newSvcPriceSinIva === "" ? undefined : Number(newSvcPriceSinIva), ivaRate: newSvcIvaRate, zeroPriceReason: newZeroReason.trim(),
  } : null;
  const editSchedule = editingService ? {
    ...editingService, contractStartDate: editStartDate, contractEndDate: editEndDate, billingPeriodStartDate: editPeriodStartDate,
    billingType: editBillingType, billingFrequency: editFreq, cycleAnchor: editCycleAnchor,
    firstPeriodPolicy: editPartialPolicy, billingDay: editBillingDay, advanceNoticeDay: editAdvanceNoticeDay,
    basePrice: undefined, customPrice: editPriceSinIva === "" ? undefined : Number(editPriceSinIva), ivaRate: editIvaRate, zeroPriceReason: editZeroReason.trim(),
  } : null;

  const searchDropdownRef = useRef<HTMLDivElement>(null);

  const saveInlineService = async (id: string, changes: Partial<ClientService>) => {
    try {
      await updateClientService(id, changes);
    } catch (error) {
      showError("No se pudo actualizar el servicio", error instanceof Error ? error.message : "Revisa los datos e inténtalo nuevamente.");
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(event.target as Node)) {
        setShowServiceDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [serviceFilter, setServiceFilter] = useState<
    "todos" | "con_venta" | "pendiente_venta" | "facturables" | "por_renovar"
  >("todos");

  // Available services exclusively from inventory catalog (type === "servicio")
  const availableServices = useMemo(() => {
    return inventoryProducts.filter((p) => p.type === "servicio" && p.status === "activo");
  }, [inventoryProducts]);

  // Search filter for predictive dropdown when adding a new service
  const searchedInventoryServices = useMemo(() => {
    const q = serviceSearchQuery.trim().toLowerCase();
    if (!q) return availableServices.slice(0, 10);
    return availableServices
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q))
      )
      .slice(0, 15);
  }, [availableServices, serviceSearchQuery]);

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

  const getDurationLabel = (duration?: ServiceContractDuration): string => {
    switch (duration) {
      case "mensual":
        return "1 Mes";
      case "trimestral":
        return "3 Meses (Trimestral)";
      case "semestral":
        return "6 Meses (Semestral)";
      case "anual":
        return "1 Año (Anual)";
      case "bianual":
        return "2 Años (Bianual)";
      case "indefinido":
        return "Indefinido";
      default:
        return "1 Año";
    }
  };

  const getFreqLabel = (freq?: ServiceBillingFrequency): string => {
    switch (freq) {
      case "mensual":
        return "Mensual";
      case "trimestral":
        return "Trimestral";
      case "semestral":
        return "Semestral";
      case "anual":
        return "Anual";
      default:
        return "Mensual";
    }
  };

  // Helper: cálculo preciso de días hasta renovación o caducidad del contrato
  const getRenewalStatus = (nextDate?: string, contractEndDate?: string) => {
    const today = getEcuadorDate();

    // 1. Verificar si el contrato completo ya expiró o está a punto de caducar
    if (contractEndDate) {
      const contractDiff = diffInCalendarDays(today, contractEndDate);
      if (contractDiff < 0) {
        return {
          label: `Contrato Caducado (${Math.abs(contractDiff)}d)`,
          tone: "rose" as const,
          daysLeft: contractDiff,
          isContractExpired: true,
          isExpiringSoon: true,
        };
      }
      if (contractDiff <= 15) {
        return {
          label: `Contrato por caducar (${contractDiff}d)`,
          tone: "amber" as const,
          daysLeft: contractDiff,
          isContractExpiringSoon: true,
          isExpiringSoon: true,
        };
      }
    }

    // 2. Verificar fecha de próximo cobro / ciclo
    if (!nextDate) {
      return { label: "Sin fecha", tone: "slate" as const, daysLeft: 999, isExpiringSoon: false };
    }
    const diffDays = diffInCalendarDays(today, nextDate);

    if (diffDays < 0) {
      return {
        label: `Vencido (${Math.abs(diffDays)}d)`,
        tone: "rose" as const,
        daysLeft: diffDays,
        isExpiringSoon: true,
      };
    }
    if (diffDays <= 15) {
      return {
        label: `A punto de caducar (${diffDays}d)`,
        tone: "amber" as const,
        daysLeft: diffDays,
        isExpiringSoon: true,
      };
    }
    if (diffDays <= 30) {
      return {
        label: `Por renovar (${diffDays}d)`,
        tone: "amber" as const,
        daysLeft: diffDays,
        isExpiringSoon: false,
      };
    }
    return {
      label: `Al día (${diffDays}d)`,
      tone: "emerald" as const,
      daysLeft: diffDays,
      isExpiringSoon: false,
    };
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
      const renewal = getRenewalStatus(s.nextRenewalDate, s.contractEndDate);
      const isDueSoon = renewal.isExpiringSoon || renewal.daysLeft <= 15 || s.status === "por_renovar";

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
    const expiringList = servicesForClient.filter((s) => {
      const renewal = getRenewalStatus(s.nextRenewalDate, s.contractEndDate);
      return renewal.isExpiringSoon || s.status === "por_renovar";
    });

    return {
      total,
      conVentaCount,
      pendienteVentaCount,
      billableCount: billableList.length,
      nonBillableCount,
      subtotalBillable,
      totalWithTax: Math.round(billableList.reduce((sum,s) => sum + (s.customPrice ?? s.basePrice ?? 0) * (1 + (s.ivaRate ?? 0) / 100), 0) * 100) / 100,
      expiringCount: expiringList.length,
    };
  }, [servicesForClient]);

  // Handlers for product selection and real-time VAT price synchronization
  const handleSelectProduct = (prod: InventoryProduct) => {
    setSelectedService(prod);
    setServiceSearchQuery(prod.name);
    setShowServiceDropdown(false);

    // 1. Traer nombre del servicio
    setNewSvcName(prod.name);

    // 2. Traer descripción del servicio (editable)
    setNewSvcDescription(prod.description || "");

    // 3. Traer precios sin IVA y con IVA calculados
    const rate = prod.ivaRate ?? 15;
    setNewSvcIvaRate(rate);

    const baseSinIva = prod.salePrice ?? 0;
    if (baseSinIva > 0) {
      setNewSvcPriceSinIva(baseSinIva.toFixed(2));
      const conIva = prod.salePriceConIva
        ? prod.salePriceConIva
        : Math.round(baseSinIva * (1 + rate / 100) * 100) / 100;
      setNewSvcPriceConIva(conIva.toFixed(2));
    } else if (prod.salePriceConIva && prod.salePriceConIva > 0) {
      setNewSvcPriceConIva(prod.salePriceConIva.toFixed(2));
      const sinIva = Math.round((prod.salePriceConIva / (1 + rate / 100)) * 100) / 100;
      setNewSvcPriceSinIva(sinIva.toFixed(2));
    } else {
      setNewSvcPriceSinIva("");
      setNewSvcPriceConIva("");
    }

    // Contract frequency and dates are explicit choices, independent of product names.
    setNewSvcCategory(prod.serviceCategory || "otro");
  };

  const handleClearSelectedProduct = () => {
    setSelectedService(null);
    setServiceSearchQuery("");
    setNewSvcName("");
    setNewSvcDescription("");
    setNewSvcPriceSinIva("");
    setNewSvcPriceConIva("");
    setNewSvcCategory("internet");
    setNewSvcFreq("mensual");
    setNewSvcDuration("anual");
    setNewSvcStartDate(getEcuadorDate());
    setNewSvcPeriodStartDate(getEcuadorDate());
    setNewSvcEndDate(suggestedContractEnd(getEcuadorDate(), "anual"));
    setNewSvcAutoRenew(true);
    setNewSvcPaymentMethod("credito");
    setShowServiceDropdown(true);
  };

  const handleFreqChange = (freq: ServiceBillingFrequency) => {
    setNewSvcFreq(freq);
  };

  const handleDurationChange = (dur: ServiceContractDuration) => {
    setNewSvcDuration(dur);
    setNewSvcEndDate(suggestedContractEnd(newSvcStartDate, dur));
  };

  const handleStartDateChange = (startDate: string) => {
    setNewSvcStartDate(startDate);
    setNewSvcEndDate(suggestedContractEnd(startDate, newSvcDuration));
  };

  const handlePriceSinIvaChange = (val: string) => {
    setNewSvcPriceSinIva(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0) {
      const calculatedConIva = Math.round(num * (1 + newSvcIvaRate / 100) * 100) / 100;
      setNewSvcPriceConIva(calculatedConIva.toFixed(2));
    } else if (val === "") {
      setNewSvcPriceConIva("");
    }
  };

  const handlePriceConIvaChange = (val: string) => {
    setNewSvcPriceConIva(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0) {
      const calculatedSinIva = Math.round((num / (1 + newSvcIvaRate / 100)) * 100) / 100;
      setNewSvcPriceSinIva(calculatedSinIva.toFixed(2));
    } else if (val === "") {
      setNewSvcPriceSinIva("");
    }
  };

  const handleIvaRateChange = (rate: number) => {
    setNewSvcIvaRate(rate);
    const numSinIva = parseFloat(newSvcPriceSinIva);
    if (!isNaN(numSinIva) && numSinIva >= 0) {
      const calculatedConIva = Math.round(numSinIva * (1 + rate / 100) * 100) / 100;
      setNewSvcPriceConIva(calculatedConIva.toFixed(2));
    }
  };

  const handleBillingDayChange = (day: number) => {
    setNewSvcBillingDay(day);
  };

  const handleEditBillingDayChange = (day: number) => {
    setEditBillingDay(day);
  };

  // Add new service handler taking exclusively from INVENTARIO DE SERVICIOS
  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService) {
      showError("Servicio Requerido", "Debes buscar y seleccionar un servicio del Inventario de Servicios.");
      return;
    }
    const finalName = newSvcName.trim() || selectedService.name;
    const priceSinIvaNum = parseFloat(newSvcPriceSinIva);
    if (isNaN(priceSinIvaNum) || priceSinIvaNum < 0 || (priceSinIvaNum === 0 && !newZeroReason.trim())) {
      showError("Tarifa inválida", "Ingresa una tarifa válida y un motivo si es gratuita.");
      return;
    }
    const priceConIvaNum =
      parseFloat(newSvcPriceConIva) ||
      Math.round(priceSinIvaNum * (1 + newSvcIvaRate / 100) * 100) / 100;
    const period = initialServicePeriod({ ...assignmentSchedule, status: "activo", isBillableInCurrentCycle: true });
    if (!period.eligible) {
      showError("Revisa el período", period.reason);
      return;
    }

    setSavingService(true);
    try {
      await addClientService({
        clientId: client.id,
        planId: selectedService.id,
        planName: finalName,
        notes: newSvcDescription.trim(),
        description: newSvcDescription.trim(),
        inventoryProductId: selectedService.id,
        inventorySku: selectedService.sku,
        status: "activo",
        billingType: newSvcBillingType,
        billingDay: newSvcBillingDay,
        advanceNoticeDay: newSvcAdvanceNoticeDay,
        billingFrequency: newSvcFreq,
        contractDuration: newSvcDuration,
        contractStartDate: newSvcStartDate,
        contractEndDate: newSvcEndDate || undefined,
        autoRenew: newSvcAutoRenew,
        cycleAnchor: newCycleAnchor,
        firstPeriodPolicy: newPartialPolicy,
        zeroPriceReason: newZeroReason.trim(),
        serviceCategory: newSvcCategory,
        paymentMethod: newSvcPaymentMethod,
        isBillableInCurrentCycle: true,
        billingPeriodStartDate: newSvcPeriodStartDate,
        basePrice: selectedService.salePrice,
        customPrice: priceSinIvaNum,
        priceConIva: priceConIvaNum,
        ivaRate: newSvcIvaRate,
        origin: "manual",
        saleStatus: "pendiente_venta",
        downloadMbps: 0,
        uploadMbps: 0,
        cutoffDay: newSvcBillingDay || 5,
        nodeId: "",
        nodeName: "Sin configurar",
        ipv4Address: "",
        pppoeUser: "",
        installationAddress: client.address || "Dirección Principal",
        installationDate: newSvcStartDate || getEcuadorDate(),
      });
      showSuccess("Servicio asignado", "La nota de venta se generará en el ciclo elegible del día 1 o por emisión manual en Ventas recurrentes.");
      setSelectedService(null);
      setServiceSearchQuery("");
      setNewSvcName("");
      setNewSvcDescription("");
      setNewSvcPriceSinIva("");
      setNewSvcPriceConIva("");
      setNewSvcBillingType("prepago");
      setNewSvcBillingDay(1);
      setNewSvcAdvanceNoticeDay(26);
      setNewSvcPaymentMethod("credito");
      setIsAddingService(false);
    } catch (err: any) {
      showError("Error", err?.message || "No se pudo añadir el servicio.");
    } finally {
      setSavingService(false);
    }
  };

  // Edit existing service handlers
  const handleOpenEditService = (svc: ClientService) => {
    setEditingService(svc);
    setEditName(svc.planName);
    setEditDescription(svc.description || svc.notes || "");
    const sinIva = svc.customPrice ?? svc.basePrice ?? 0;
    const rate = svc.ivaRate ?? 15;
    setEditIvaRate(rate);
    setEditPriceSinIva(sinIva.toFixed(2));
    const conIva = svc.priceConIva ?? Math.round(sinIva * (1 + rate / 100) * 100) / 100;
    setEditPriceConIva(conIva.toFixed(2));
    setEditBillingType(
      svc.billingType === "pospago" || svc.billingType === "postpago" ? "postpago" : "prepago"
    );
    setEditBillingDay(svc.billingDay ?? 1);
    setEditPaymentMethod(svc.paymentMethod || "credito");
    setEditAdvanceNoticeDay(svc.advanceNoticeDay ?? 26);
    setEditFreq(svc.billingFrequency || "mensual");
    setEditDuration(svc.contractDuration || (svc.contractEndDate ? "anual" : "indefinido"));
    const lower = (svc.planName + " " + (svc.notes || "")).toLowerCase();
    const defaultCat: ServiceCategory =
      svc.serviceCategory || (lower.includes("hosting") ? "hosting" : lower.includes("dominio") ? "dominio" : "internet");
    setEditCategory(defaultCat);
    setEditStartDate(svc.contractStartDate || svc.installationDate || getEcuadorDate());
    setEditPeriodStartDate(serviceBillingStart(svc) || getEcuadorDate());
    setEditEndDate(svc.contractEndDate || "");
    setEditAutoRenew(svc.autoRenew ?? true);
    setEditCycleAnchor(svc.cycleAnchor || "aniversario");
    setEditPartialPolicy(svc.firstPeriodPolicy || "prorrateo");
    setEditZeroReason(svc.zeroPriceReason || "");
  };

  const handleEditFreqChange = (freq: ServiceBillingFrequency) => {
    setEditFreq(freq);
  };

  const handleEditDurationChange = (dur: ServiceContractDuration) => {
    setEditDuration(dur);
    if (editStartDate) {
      setEditEndDate(suggestedContractEnd(editStartDate, dur));
    }
  };

  const handleEditPriceSinIvaChange = (val: string) => {
    setEditPriceSinIva(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0) {
      const calculatedConIva = Math.round(num * (1 + editIvaRate / 100) * 100) / 100;
      setEditPriceConIva(calculatedConIva.toFixed(2));
    } else if (val === "") {
      setEditPriceConIva("");
    }
  };

  const handleEditPriceConIvaChange = (val: string) => {
    setEditPriceConIva(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0) {
      const calculatedSinIva = Math.round((num / (1 + editIvaRate / 100)) * 100) / 100;
      setEditPriceSinIva(calculatedSinIva.toFixed(2));
    } else if (val === "") {
      setEditPriceSinIva("");
    }
  };

  const handleEditIvaRateChange = (rate: number) => {
    setEditIvaRate(rate);
    const numSinIva = parseFloat(editPriceSinIva);
    if (!isNaN(numSinIva) && numSinIva >= 0) {
      const calculatedConIva = Math.round(numSinIva * (1 + rate / 100) * 100) / 100;
      setEditPriceConIva(calculatedConIva.toFixed(2));
    }
  };

  const handleSaveEditService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService) return;
    const priceSinIvaNum = parseFloat(editPriceSinIva);
    if (isNaN(priceSinIvaNum) || priceSinIvaNum < 0 || (priceSinIvaNum === 0 && !editZeroReason.trim())) {
      showError("Tarifa inválida", "Ingresa una tarifa sin IVA mayor a $0.00.");
      return;
    }
    const priceConIvaNum =
      parseFloat(editPriceConIva) ||
      Math.round(priceSinIvaNum * (1 + editIvaRate / 100) * 100) / 100;
    const period = initialServicePeriod({ ...editSchedule, status: "activo", isBillableInCurrentCycle: true });
    if (!period.eligible) {
      showError("Revisa el período", period.reason);
      return;
    }

    setSavingEdit(true);
    try {
      await updateClientService(editingService.id, {
        planName: editName.trim() || editingService.planName,
        description: editDescription.trim(),
        notes: editDescription.trim(),
        customPrice: priceSinIvaNum,
        priceConIva: priceConIvaNum,
        ivaRate: editIvaRate,
        billingType: editBillingType,
        billingDay: editBillingDay,
        advanceNoticeDay: editAdvanceNoticeDay,
        billingFrequency: editFreq,
        contractDuration: editDuration,
        contractStartDate: editStartDate,
        contractEndDate: editEndDate,
        autoRenew: editAutoRenew,
        paymentMethod: editPaymentMethod,
        cycleAnchor: editCycleAnchor,
        firstPeriodPolicy: editPartialPolicy,
        zeroPriceReason: editZeroReason.trim(),
        serviceCategory: editCategory,
        billingPeriodStartDate: editPeriodStartDate,
      });
      showSuccess("Servicio Actualizado", "Los cambios y el ciclo de renovación se guardaron correctamente.");
      setEditingService(null);
    } catch (err: any) {
      showError("Error", err?.message || "No se pudo actualizar el servicio.");
    } finally {
      setSavingEdit(false);
    }
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

  // Notify via WhatsApp (1 click) con soporte para hosting/dominios anuales y contratos
  const handleNotifyWhatsApp = async (svc: ClientService) => {
    const rawPhone = (client.phone || "").replace(/\D/g, "");
    const cleanPhone = rawPhone.startsWith("0")
      ? `593${rawPhone.slice(1)}`
      : rawPhone.startsWith("593")
      ? rawPhone
      : `593${rawPhone}`;

    const price = (svc.customPrice ?? svc.basePrice ?? 0).toFixed(2);
    const freqLabel = getFreqLabel(svc.billingFrequency);
    const renewalDate = svc.nextRenewalDate || "próximo vencimiento";
    const isHostingOrDom =
      svc.serviceCategory === "hosting" ||
      svc.serviceCategory === "dominio" ||
      svc.planName.toLowerCase().includes("hosting") ||
      svc.planName.toLowerCase().includes("dominio") ||
      svc.billingFrequency === "anual";

    const contractInfo = svc.contractEndDate ? ` (Vigencia de contrato hasta: ${svc.contractEndDate})` : "";

    const message = isHostingOrDom
      ? `Hola *${client.businessName}*, le saludamos de *Control Inntel*. Le recordamos que su servicio de Hosting/Dominio *${svc.planName}* ($${price} + IVA) tiene fecha de renovación/caducidad el *${renewalDate}*${contractInfo}. Por favor confírmenos su renovación para mantener el servicio y la continuidad de sus plataformas.`
      : `Hola *${client.businessName}*, le saludamos de *Control Inntel*. Le informamos que su servicio *${svc.planName}* (modalidad ${freqLabel} - $${price} + IVA) registra fecha de renovación para el *${renewalDate}*${contractInfo}. Le recordamos su renovación para mantener el servicio activo en el presente ciclo.`;

    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");
    await updateClientService(svc.id, {
      lastNotificationSentAt: getEcuadorDate(),
    });
  };

  // Notify via Email (1 click) con soporte para hosting/dominios anuales y contratos
  const handleNotifyEmail = async (svc: ClientService) => {
    const price = (svc.customPrice ?? svc.basePrice ?? 0).toFixed(2);
    const freqLabel = getFreqLabel(svc.billingFrequency);
    const renewalDate = svc.nextRenewalDate || "próximo periodo";
    const isHostingOrDom =
      svc.serviceCategory === "hosting" ||
      svc.serviceCategory === "dominio" ||
      svc.planName.toLowerCase().includes("hosting") ||
      svc.planName.toLowerCase().includes("dominio") ||
      svc.billingFrequency === "anual";

    const contractInfo = svc.contractEndDate ? `\nVigencia del contrato hasta: ${svc.contractEndDate}` : "";

    const subject = isHostingOrDom
      ? `Aviso de Caducidad / Renovación Anual: ${svc.planName} - ${client.businessName}`
      : `Aviso de Renovación de Servicio (${freqLabel}): ${svc.planName}`;

    const body = `Estimado(a) ${client.businessName},\n\nLe saludamos cordialmente de Control Inntel.\n\nLe notificamos que su servicio "${svc.planName}" con tarifa ${freqLabel.toLowerCase()} de $${price} USD (+ IVA) registra fecha de vencimiento/renovación el ${renewalDate}.${contractInfo}\n\nPor favor confírmenos la renovación o continuidad de su servicio para proceder con la emisión del comprobante y garantizar la disponibilidad continua.\n\nAtentamente,\nDepartamento de Facturación y Operaciones\nINNTEL CORP S.A.`;

    window.open(
      `mailto:${client.email || ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
      "_self"
    );
    await updateClientService(svc.id, {
      lastNotificationSentAt: getEcuadorDate(),
    });
  };

  // Renew service (+1 month, +3 months, +6 months, or +1 year)
  const handleRenewService = async (svc: ClientService) => {
    try {
      await renewClientService(svc.id);
      let periodName = "1 mes";
      if (svc.billingFrequency === "anual") periodName = "1 año";
      else if (svc.billingFrequency === "semestral") periodName = "6 meses";
      else if (svc.billingFrequency === "trimestral") periodName = "3 meses";

      showSuccess(
        "Servicio Renovado",
        `Se extendió la vigencia de "${svc.planName}" por +${periodName} y quedó Activo/Facturable.`
      );
    } catch {
      showError("Error", "No se pudo renovar el servicio.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Banner de alerta cuando existen servicios a punto de caducar o vencidos */}
      {serviceMetrics.expiringCount > 0 && (
        <div className="p-3.5 px-4 bg-amber-50 border border-amber-300 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs text-amber-950 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0 text-amber-700">
              <AlertTriangle className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <p className="font-bold text-amber-950 text-xs">
                Alerta de Caducidad: {serviceMetrics.expiringCount} servicio(s) están a punto de caducar o vencidos
              </p>
              <p className="text-[11px] text-amber-800">
                Servicios de hosting, dominios o ciclos con vencimiento próximo (≤ 15 días) requieren confirmación o cobro para garantizar su continuidad.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setServiceFilter("por_renovar")}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition shrink-0 cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Ver a punto de caducar ({serviceMetrics.expiringCount})</span>
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
        {/* 1.1 Si no hay servicios creados en inventario: Aviso guiado con acceso directo */}
        {canAssign && isAddingService && availableServices.length === 0 && (
          <div className="p-4 px-6 bg-amber-50 border-b border-amber-200 flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
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
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-600 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => setIsProductModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#004ac6] hover:bg-[#003da6] text-white text-xs font-bold transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Crear Servicio en Inventario</span>
              </button>
            </div>
          </div>
        )}

        {/* 1.2 Formulario de asignación exclusiva desde INVENTARIO DE SERVICIOS */}
        {canAssign && isAddingService && availableServices.length > 0 && (
          <form
            onSubmit={handleCreateService}
            className="p-5 px-6 bg-[#f8f9ff] border-b border-[#e2e8f0] space-y-4 animate-in fade-in"
          >
            <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-2">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-[#004ac6]" />
                <h4 className="text-xs font-bold text-[#0b1c30] uppercase tracking-wide">
                  Asignar Servicio
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsProductModalOpen(true)}
                className="text-xs font-bold text-[#004ac6] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Crear Servicio</span>
              </button>
            </div>

            {/* Fila compacta: el buscador y el nombre comparten línea */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="relative" ref={searchDropdownRef}>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-[#0b1c30]">
                  Buscar Producto / Servicio *
                </label>
                {selectedService && (
                  <button
                    type="button"
                    onClick={handleClearSelectedProduct}
                    className="text-xs text-[#004ac6] hover:underline flex items-center gap-1 cursor-pointer font-semibold"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Cambiar servicio</span>
                  </button>
                )}
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Escribe el nombre o SKU para buscar..."
                  value={serviceSearchQuery}
                  onFocus={() => setShowServiceDropdown(true)}
                  onChange={(e) => {
                    setServiceSearchQuery(e.target.value);
                    setShowServiceDropdown(true);
                  }}
                  className="w-full pl-9 pr-9 py-2 bg-white border border-[#cbd5e1] rounded-lg text-xs font-semibold text-[#0b1c30] placeholder-slate-400 focus:border-[#004ac6] focus:outline-hidden"
                />
                {serviceSearchQuery && (
                  <button aria-label="Cerrar"
                    type="button"
                    onClick={() => {
                      setServiceSearchQuery("");
                      setSelectedService(null);
                      setShowServiceDropdown(true);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Menú desplegable con los resultados de la búsqueda */}
              {showServiceDropdown && (
                <div className="absolute z-30 mt-1 w-full bg-white rounded-lg shadow-xl border border-slate-200 max-h-60 overflow-y-auto divide-y divide-slate-100">
                  {searchedInventoryServices.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-500">
                      No se encontraron servicios con esa búsqueda. Usa el botón{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setShowServiceDropdown(false);
                          setIsProductModalOpen(true);
                        }}
                        className="text-[#004ac6] font-bold underline cursor-pointer"
                      >
                        + Crear Servicio
                      </button>
                    </div>
                  ) : (
                    searchedInventoryServices.map((prod) => {
                      const sinIva = prod.salePrice ?? 0;
                      const conIva =
                        prod.salePriceConIva ?? Math.round(sinIva * 1.15 * 100) / 100;
                      const isSelected = selectedService?.id === prod.id;
                      return (
                        <button
                          key={prod.id}
                          type="button"
                          onClick={() => handleSelectProduct(prod)}
                          className={`w-full text-left px-3.5 py-2 hover:bg-[#f8f9ff] transition flex items-center justify-between gap-3 cursor-pointer ${
                            isSelected ? "bg-[#eff4ff] border-l-4 border-[#004ac6]" : ""
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10px] font-bold bg-[#eff4ff] text-[#004ac6] px-1.5 py-0.5 rounded-md border border-[#dce9ff]">
                                {prod.sku}
                              </span>
                              <span className="font-bold text-xs text-slate-900 truncate">
                                {prod.name}
                              </span>
                              {prod.categoryName && (
                                <span className="text-[10px] text-slate-400 font-medium">
                                  • {prod.categoryName}
                                </span>
                              )}
                            </div>
                            {prod.description && (
                              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                {prod.description}
                              </p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-mono font-bold text-xs text-slate-900">
                              ${sinIva.toFixed(2)}{" "}
                              <span className="text-[10px] text-slate-400 font-normal">
                                sin IVA
                              </span>
                            </div>
                            <div className="font-mono text-[10px] text-emerald-700 font-semibold">
                              ${conIva.toFixed(2)}{" "}
                              <span className="text-[9px] text-slate-400">c/IVA</span>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

              <div>
                <label htmlFor="client-contract-tab-field-1" className="block text-xs font-bold text-[#434655] mb-1">
                  Nombre del Servicio *
                </label>
                <input id="client-contract-tab-field-1"
                  type="text"
                  required
                  placeholder="Ej. Internet Dedicado 100 Mbps"
                  value={newSvcName}
                  onChange={(e) => setNewSvcName(e.target.value)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 text-xs font-semibold text-[#0b1c30] focus:border-[#004ac6] focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label htmlFor="client-contract-tab-field-2" className="block text-xs font-bold text-[#434655] mb-1">
                Descripción
              </label>
              <textarea id="client-contract-tab-field-2"
                rows={2}
                placeholder="Detalles técnicos o características del servicio..."
                value={newSvcDescription}
                onChange={(e) => setNewSvcDescription(e.target.value)}
                className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-1.5 text-xs text-[#0b1c30] focus:border-[#004ac6] focus:outline-hidden resize-none"
              />
            </div>

            {/* Tarifas Sincronizadas (Sin IVA / Con IVA) y Tasa SRI */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              {/* Tarifa sin IVA */}
              <div>
                <label className="block text-xs font-bold text-[#434655] mb-1">
                  Tarifa sin IVA ($) *
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-xs text-slate-400">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={newSvcPriceSinIva}
                    onChange={(e) => handlePriceSinIvaChange(e.target.value)}
                    className="w-full bg-white border border-[#cbd5e1] rounded-lg pl-6 pr-3 py-2 text-xs font-mono font-bold text-[#0b1c30] focus:border-[#004ac6] focus:outline-hidden"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Base imponible</span>
              </div>

              {/* Tarifa con IVA */}
              <div>
                <label className="block text-xs font-bold text-[#434655] mb-1">
                  Tarifa con IVA ($) *
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-xs text-slate-400">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={newSvcPriceConIva}
                    onChange={(e) => handlePriceConIvaChange(e.target.value)}
                    className="w-full bg-white border border-[#cbd5e1] rounded-lg pl-6 pr-3 py-2 text-xs font-mono font-bold text-emerald-700 focus:border-[#004ac6] focus:outline-hidden"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Total cliente</span>
              </div>

              {/* Selector IVA */}
              <div>
                <label htmlFor="client-contract-tab-field-3" className="block text-xs font-bold text-[#434655] mb-1">
                  IVA Aplicable
                </label>
                <select id="client-contract-tab-field-3"
                  value={newSvcIvaRate}
                  onChange={(e) => handleIvaRateChange(Number(e.target.value))}
                  className="w-full bg-white border border-[#cbd5e1] rounded-lg px-2.5 py-2 text-xs font-bold text-[#0b1c30] cursor-pointer focus:border-[#004ac6] focus:outline-hidden"
                >
                  <option value={15}>15% (Vigente SRI)</option>
                  <option value={5}>5% (Materiales)</option>
                  <option value={0}>0% (Exento)</option>
                </select>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Tasa impositiva</span>
              </div>
            </div>

            {/* Configuración de Ciclo, Contrato y Facturación Recurrente */}
            <div className="p-4 bg-white rounded-xl border border-[#cbd5e1] space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-[#f1f5f9]">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#004ac6]" />
                  <span className="font-bold text-[#0b1c30] uppercase tracking-wide text-xs">
                    Ciclo de Facturación y Vigencia
                  </span>
                </div>
                <span className="text-[11px] text-[#64748b]">
                  Recurrencia y cobranza automática
                </span>
              </div>

              {/* Fila 1: Modalidad, día de cobro, anticipo de cobranza y tipo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Modalidad: PREPAGO / POSTPAGO */}
                <div>
                  <label htmlFor="client-contract-tab-field-4" className="block text-xs font-bold text-[#434655] mb-1">
                    Modalidad *
                  </label>
                  <select id="client-contract-tab-field-4"
                    value={newSvcBillingType}
                    onChange={(e) => setNewSvcBillingType(e.target.value as ServiceBillingType)}
                    className="w-full bg-white border border-[#cbd5e1] rounded-lg px-2.5 py-2 text-xs font-bold text-[#0b1c30] cursor-pointer focus:border-[#004ac6] focus:outline-hidden"
                  >
                    <option value="prepago">PREPAGO (Por adelantado)</option>
                    <option value="postpago">POSTPAGO (Mes vencido)</option>
                  </select>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    {newSvcBillingType === "prepago" ? "El período es exigible desde su inicio" : "El período es exigible después de que termina"}
                  </span>
                </div>

                <div>
                  <label htmlFor="client-contract-tab-field-5" className="block text-xs font-bold text-[#434655] mb-1">
                    Día de cobro *
                  </label>
                  <select id="client-contract-tab-field-5"
                    value={newSvcBillingDay}
                    onChange={(e) => handleBillingDayChange(Number(e.target.value))}
                    className="w-full bg-white border border-[#cbd5e1] rounded-lg px-2.5 py-2 text-xs font-bold text-[#0b1c30] cursor-pointer focus:border-[#004ac6] focus:outline-hidden"
                  >
                    <option value={1}>Día 1 de cada mes</option>
                    <option value={2}>Día 2 de cada mes</option>
                    <option value={5}>Día 5 de cada mes</option>
                    <option value={10}>Día 10 de cada mes</option>
                    <option value={15}>Día 15 de cada mes</option>
                    <option value={20}>Día 20 de cada mes</option>
                    <option value={25}>Día 25 de cada mes</option>
                    <option value={28}>Día 28 de cada mes</option>
                    <option value={30}>Día 30 de cada mes</option>
                  </select>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Vencimiento de la cuenta por cobrar</span>
                </div>

                {/* Anticipo de Cobranza */}
                <div>
                  <label htmlFor="client-contract-tab-field-6" className="block text-xs font-bold text-[#434655] mb-1">
                    Anticipo de Cobranza *
                  </label>
                  <select id="client-contract-tab-field-6"
                    value={newSvcAdvanceNoticeDay}
                    onChange={(e) => setNewSvcAdvanceNoticeDay(Number(e.target.value))}
                    className="w-full bg-white border border-[#cbd5e1] rounded-lg px-2.5 py-2 text-xs font-bold text-[#0b1c30] cursor-pointer focus:border-[#004ac6] focus:outline-hidden"
                  >
                    <option value={26}>Día 26 de cada mes</option>
                    <option value={25}>Día 25 de cada mes</option>
                    <option value={20}>Día 20 de cada mes</option>
                    <option value={28}>Día 28 de cada mes</option>
                    <option value={1}>Día 1 de cada mes</option>
                    <option value={5}>Día 5 de cada mes</option>
                    <option value={10}>Día 10 de cada mes</option>
                    <option value={15}>Día 15 de cada mes</option>
                  </select>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Referencia para los avisos de cobro</span>
                </div>

                {/* Forma de Pago pactada para las facturas de este servicio */}
                <div>
                  <label htmlFor="client-contract-tab-field-6b" className="block text-xs font-bold text-[#434655] mb-1">
                    Forma de Pago *
                  </label>
                  <select id="client-contract-tab-field-6b"
                    value={newSvcPaymentMethod}
                    onChange={(e) => setNewSvcPaymentMethod(e.target.value as ServicePaymentMethod)}
                    className="w-full bg-white border border-[#cbd5e1] rounded-lg px-2.5 py-2 text-xs font-bold text-[#0b1c30] cursor-pointer focus:border-[#004ac6] focus:outline-hidden"
                  >
                    <option value="credito">Crédito (a cuenta)</option>
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia bancaria</option>
                    <option value="tarjeta">Tarjeta de crédito</option>
                  </select>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    {newSvcPaymentMethod === "credito"
                      ? "La nota pasa a cuentas por cobrar"
                      : "Cobro preferido; la nota nace pendiente"}
                  </span>
                </div>
              </div>

              {/* Fila 2: Frecuencia, Duración, Fecha Inicio y Próximo Cobro */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                {/* Frecuencia de Cobro */}
                <div>
                  <label htmlFor="client-contract-tab-field-7" className="block text-xs font-bold text-[#434655] mb-1">
                    Frecuencia de Facturación *
                  </label>
                  <select id="client-contract-tab-field-7"
                    value={newSvcFreq}
                    onChange={(e) => handleFreqChange(e.target.value as ServiceBillingFrequency)}
                    className="w-full bg-white border border-[#cbd5e1] rounded-lg px-2.5 py-2 text-xs font-bold text-[#0b1c30] cursor-pointer focus:border-[#004ac6] focus:outline-hidden"
                  >
                    <option value="mensual">Mensual (Factura mes a mes)</option>
                    <option value="trimestral">Trimestral (Cada 3 meses)</option>
                    <option value="semestral">Semestral (Cada 6 meses)</option>
                    <option value="anual">Anual (Hosting / Dominios)</option>
                  </select>
                </div>

                {/* Duración del Contrato */}
                <div>
                  <label htmlFor="client-contract-tab-field-8" className="block text-xs font-bold text-[#434655] mb-1">
                    Duración del contrato *
                  </label>
                  <select id="client-contract-tab-field-8"
                    value={newSvcDuration}
                    onChange={(e) => handleDurationChange(e.target.value as ServiceContractDuration)}
                    className="w-full bg-white border border-[#cbd5e1] rounded-lg px-2.5 py-2 text-xs font-bold text-[#0b1c30] cursor-pointer focus:border-[#004ac6] focus:outline-hidden"
                  >
                    <option value="mensual">1 Mes</option>
                    <option value="trimestral">3 Meses (Trimestral)</option>
                    <option value="semestral">6 Meses (Semestral)</option>
                    <option value="anual">1 Año (Anual - 12 meses)</option>
                    <option value="bianual">2 Años (Bianual - 24 meses)</option>
                    <option value="indefinido">Indefinido / Permanente</option>
                  </select>
                </div>

                {/* Fecha Inicio Contrato */}
                <div>
                  <label htmlFor="client-contract-tab-field-9" className="block text-xs font-bold text-[#434655] mb-1">
                    Fecha Inicio de Contrato
                  </label>
                  <input id="client-contract-tab-field-9"
                    type="date"
                    required
                    value={newSvcStartDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className="w-full bg-white border border-[#cbd5e1] rounded-lg px-2.5 py-2 text-xs font-mono text-[#0b1c30] focus:border-[#004ac6] focus:outline-hidden"
                  />
                </div>

                {/* Próximo Cobro */}
                <div>
                  <label htmlFor="client-contract-tab-field-10" className="block text-xs font-bold text-[#434655] mb-1">
                    Inicio del período *
                  </label>
                  <input id="client-contract-tab-field-10"
                    type="date"
                    required
                    min={newSvcStartDate || undefined}
                    value={newSvcPeriodStartDate}
                    onChange={(e) => setNewSvcPeriodStartDate(e.target.value)}
                    className="w-full bg-white border border-[#cbd5e1] rounded-lg px-2.5 py-2 text-xs font-mono text-[#0b1c30] focus:border-[#004ac6] focus:outline-hidden"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Fecha desde la que se cuenta el servicio que se cobrará</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-xs font-semibold">Cómo se calcula el período
                  <select value={newCycleAnchor} onChange={e => setNewCycleAnchor(e.target.value as "calendario" | "aniversario")} className="block w-full border rounded p-2 mt-1"><option value="aniversario">Desde el inicio del período</option><option value="calendario">Mes calendario (del 1 al último día)</option></select>
                  <span className="mt-1 block text-[10px] font-normal text-slate-500">{newCycleAnchor === "calendario" ? "Los ciclos se alinean al día 1. Si comienzas a mitad de mes, elige cómo cobrar ese primer tramo." : "La frecuencia cuenta desde el inicio del período que seleccionaste."}</span>
                </label>
                {newCycleAnchor === "calendario" && newSvcPeriodStartDate && !newSvcPeriodStartDate.endsWith("-01") && <label className="text-xs font-semibold">Primer período parcial
                  <select value={newPartialPolicy} onChange={e => setNewPartialPolicy(e.target.value as "prorrateo" | "completo")} className="block w-full border rounded p-2 mt-1"><option value="prorrateo">Prorratear por días reales</option><option value="completo">Cobrar período completo</option></select>
                </label>}
                <label className="text-xs font-semibold">Motivo de gratuidad, si la tarifa es cero<input value={newZeroReason} onChange={e => setNewZeroReason(e.target.value)} className="block w-full border rounded p-2 mt-1" /></label>
              </div>
              {/* Fila 3: Fin Contrato y Switch Auto-Renovación */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Fecha Fin Contrato */}
                <div>
                  <label htmlFor="client-contract-tab-field-11" className="block text-xs font-bold text-[#434655] mb-1">
                    Vigencia de Contrato Hasta
                  </label>
                  <input id="client-contract-tab-field-11"
                    type="date"
                    required={newSvcDuration !== "indefinido"}
                    min={newSvcStartDate || undefined}
                    value={newSvcEndDate}
                    onChange={(e) => setNewSvcEndDate(e.target.value)}
                    disabled={newSvcDuration === "indefinido"}
                    className="w-full bg-white border border-[#cbd5e1] rounded-lg px-2.5 py-2 text-xs font-mono text-[#0b1c30] disabled:bg-slate-100 disabled:text-slate-400 focus:border-[#004ac6] focus:outline-hidden"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    {newSvcDuration === "indefinido" ? "Sin fecha límite de vigencia" : "Fecha límite del compromiso contratado"}
                  </span>
                </div>

                {/* Switch Auto-Renovación */}
                <div className="flex items-center gap-2 pt-4">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={newSvcAutoRenew}
                      onChange={(e) => setNewSvcAutoRenew(e.target.checked)}
                      className="rounded border-[#cbd5e1] text-[#004ac6] focus:ring-[#004ac6] w-4 h-4 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-bold text-[#0b1c30] block">Marcar para revisión de renovación</span>
                      <span className="text-[10px] text-slate-500 block">
                        Identifica el servicio para revisar su continuidad al vencer.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {assignmentSchedule && <ServiceBillingPreview service={assignmentSchedule} today={today} />}

            {/* Ficha Resumen del Servicio de Inventario Seleccionado */}
            {selectedService && (
              <div className="p-3 bg-white rounded-lg border border-[#e2e8f0] text-xs flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold bg-[#eff4ff] text-[#004ac6] px-2 py-0.5 rounded-md border border-[#dce9ff]">
                      {selectedService.sku}
                    </span>
                    <span className="font-bold text-[#0b1c30]">{newSvcName || selectedService.name}</span>
                    {selectedService.categoryName && (
                      <span className="text-xs text-[#64748b]">• {selectedService.categoryName}</span>
                    )}
                  </div>
                  {newSvcDescription && (
                    <p className="text-[11px] text-slate-600 line-clamp-1 italic">{newSvcDescription}</p>
                  )}
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Base sin IVA</span>
                    <span className="font-mono font-bold text-[#0b1c30]">
                      ${safeNumber(parseFloat(newSvcPriceSinIva) || 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">IVA ({newSvcIvaRate}%)</span>
                    <span className="font-mono font-bold text-slate-600">
                      ${safeNumber(
                        Math.round(
                          (parseFloat(newSvcPriceSinIva) || 0) * (newSvcIvaRate / 100) * 100
                        ) / 100
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#004ac6] block uppercase font-bold">Total Facturable</span>
                    <span className="font-mono font-bold text-emerald-700 text-sm">
                      ${safeNumber(parseFloat(newSvcPriceConIva) || 0)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Información de Asignación */}
            <div className="flex items-center gap-2.5 p-3 rounded-lg bg-[#eff4ff] border border-[#dce9ff] text-xs text-[#004ac6]">
              <ShieldCheck className="w-4 h-4 text-[#004ac6] shrink-0" />
              <p className="text-xs">
                El servicio seleccionado del catálogo oficial de inventario quedará activo en la ficha técnica del cliente.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsAddingService(false);
                  handleClearSelectedProduct();
                }}
                className="px-3.5 py-2 rounded-lg border border-[#cbd5e1] bg-white text-[#434655] text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingService || !selectedService}
                className="px-4 py-2 rounded-lg bg-[#004ac6] hover:bg-[#003da6] disabled:opacity-50 text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                {savingService ? "Guardando..." : "Asignar Servicio"}
              </button>
            </div>
          </form>
        )}

        {/* Barra de búsqueda y filtro rápido de estado con botones de acción alineados a la derecha */}
        <div className="p-3 px-6 border-b border-[#e2e8f0] bg-white flex flex-wrap items-center justify-between gap-3">
          <div className="relative min-w-0 w-full sm:flex-1 sm:max-w-xs">
            <Search className="w-3.5 h-3.5 text-[#64748b] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por servicio o SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-[#e2e8f0] bg-[#f8f9ff] text-[#0b1c30] placeholder-[#64748b] focus:bg-white focus:outline-hidden focus:border-[#004ac6] transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs">
              {[
                { id: "todos", label: "Todos" },
                { id: "facturables", label: "Activos" },
                { id: "por_renovar", label: "Por Renovar" },
              ].map((tab) => {
                const isActive = serviceFilter === tab.id;
                const isWarningTab = tab.id === "por_renovar" && serviceMetrics.expiringCount > 0;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setServiceFilter(tab.id as any)}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                      isActive
                        ? isWarningTab
                          ? "bg-amber-600 text-white shadow-xs"
                          : "bg-[#004ac6] text-white shadow-2xs"
                        : isWarningTab
                        ? "bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200"
                        : "bg-[#f8f9ff] text-[#434655] hover:bg-slate-100 border border-[#e2e8f0]"
                    }`}
                  >
                    {isWarningTab && <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
                    <span>{tab.label}</span>
                    {tab.id === "por_renovar" && serviceMetrics.expiringCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-amber-500 text-white">
                        {serviceMetrics.expiringCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <span className="h-4 w-px bg-slate-200 hidden sm:inline-block" aria-hidden="true" />

            {canAccessRoute(currentUser, "/ventas") && canAccessSubmodule(currentUser, "ventas", "recurrentes") && canUser(currentUser, "facturacion", "canCreateInvoice") && (
              <Link href={`/ventas?sub=recurrentes&cliente=${encodeURIComponent(client.id)}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 text-xs font-semibold text-[#004ac6] hover:bg-blue-50">
                <ExternalLink className="w-3.5 h-3.5" />
                Ventas recurrentes
              </Link>
            )}
            {canAssign && (
            <button
              type="button"
              onClick={() => setIsAddingService((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAddingService ? "Cerrar" : "Agregar Servicio"}</span>
            </button>
            )}
          </div>
        </div>

        {/* Tabla de Control Individual de Servicios Contratados */}
        <div role="region" aria-label="Tabla de servicios contratados" tabIndex={0} className="max-w-full overflow-x-auto overscroll-x-contain">
          <table className={`w-full text-left text-xs table-fixed ${showPrices ? "min-w-[70rem]" : "min-w-[62rem]"}`}>
            <colgroup>
              <col style={{ width: showPrices ? "33%" : "42%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "11%" }} />
              {showPrices && <col style={{ width: "9%" }} />}
              <col style={{ width: "11%" }} />
            </colgroup>
            <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-xs uppercase tracking-wider border-b border-[#e2e8f0]">
              <tr>
                <th className="py-3 px-3">Servicio</th>
                <th className="py-3 px-2">Ciclo</th>
                <th className="py-3 px-2">Renovación</th>
                <th className="py-3 px-2 text-center">Estado</th>
                <th className="py-3 px-2 text-center">Facturar</th>
                {showPrices && <th className="py-3 px-2 text-right">Tarifa</th>}
                <th className="py-3 px-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9] text-[#0b1c30]">
              {filteredServices.length === 0 ? (
                <tr>
                  <td colSpan={showPrices ? 7 : 6} className="py-10 text-center text-xs text-[#737686]">
                    <p className="font-bold text-[#434655]">
                      No hay servicios registrados con este filtro.
                    </p>
                    {canAssign && <p className="text-xs text-[#64748b] mt-1">Usa Agregar Servicio para asignar un servicio del inventario.</p>}
                  </td>
                </tr>
              ) : (
                filteredServices.map((svc) => {
                  const isBillable = svc.status === "activo" && svc.isBillableInCurrentCycle !== false;
                  const renewal = getRenewalStatus(svc.nextRenewalDate, svc.contractEndDate);
                  const price = svc.customPrice ?? svc.basePrice ?? 0;

                  return (
                    <tr
                      key={svc.id}
                      className={`transition-colors ${
                        isBillable ? "hover:bg-[#f8f9ff]" : "bg-slate-50/70 text-slate-500"
                      }`}
                    >
                      {/* 1. Servicio Contratado */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`font-bold text-xs break-words ${isBillable ? "text-[#0b1c30]" : "text-slate-500 line-through"}`}>
                            {svc.planName}
                          </span>
                          <span className={`font-mono text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md ${
                            svc.billingType === "postpago" || svc.billingType === "pospago"
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : "bg-blue-50 text-blue-700 border border-blue-200"
                          }`}>
                            {svc.billingType === "postpago" || svc.billingType === "pospago" ? "POSTPAGO" : "PREPAGO"}
                          </span>
                          {svc.serviceCategory && (
                            <span className="font-mono text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-[#eff4ff] text-[#004ac6] border border-[#dce9ff]">
                              {svc.serviceCategory}
                            </span>
                          )}
                          {svc.autoRenew && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                              <span>Renovación prevista</span>
                            </span>
                          )}
                        </div>
                        {(svc.description || svc.notes) && (
                          <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5 font-normal">
                            {svc.description || svc.notes}
                          </p>
                        )}
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-1 flex-wrap">
                          {svc.inventorySku && (
                            <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-sm text-[9px] font-bold">
                              {svc.inventorySku}
                            </span>
                          )}
                          <span className="text-slate-600">
                            Contrato: <strong>{getDurationLabel(svc.contractDuration || "anual")}</strong>
                          </span>
                          <span>• Cobro: Día {svc.billingDay ?? 1}</span>
                          <span>• Anticipo: Día {svc.advanceNoticeDay ?? 26}</span>
                          {svc.contractEndDate && (
                            <span className="text-slate-500 font-mono">
                              • Fin: {formatDateEC(svc.contractEndDate)}
                            </span>
                          )}
                          <span>
                            {svc.lastBilledPeriod
                              ? `• Últ. facturado: ${svc.lastBilledPeriod}`
                              : `• Alta: ${svc.installationDate || "—"}`}
                          </span>
                          {svc.lastNotificationSentAt && <span>• Avisado: {svc.lastNotificationSentAt}</span>}
                        </div>
                      </td>

                      {/* 2. Frecuencia (Mensual / Trimestral / Semestral / Anual) */}
                      <td className="py-3.5 px-2">
                        <select
                          value={svc.billingFrequency || "mensual"}
                          onChange={(e) => {
                            const freq = e.target.value as ServiceBillingFrequency;
                            const baseDate = serviceBillingStart(svc) || getEcuadorDate();
                            const nextDate = calculateNextRenewalDate(baseDate, freq);
                            void saveInlineService(svc.id, {
                              billingFrequency: freq,
                              nextRenewalDate: nextDate,
                            });
                          }}
                          className="w-full min-w-0 max-w-full bg-white border border-[#e2e8f0] rounded-lg px-2 py-1 text-xs font-bold text-[#0b1c30] focus:outline-hidden focus:border-[#004ac6] cursor-pointer"
                        >
                          <option value="mensual">Mensual</option>
                          <option value="trimestral">Trimestral</option>
                          <option value="semestral">Semestral</option>
                          <option value="anual">Anual</option>
                        </select>
                      </td>

                      {/* 3. Próxima Renovación + Semáforo */}
                      <td className="py-3.5 px-2">
                        <div className="flex flex-col gap-1">
                          <input
                            type="date"
                            value={svc.nextRenewalDate || ""}
                            onChange={(e) =>
                              void saveInlineService(svc.id, { nextRenewalDate: e.target.value })
                            }
                            className="w-full min-w-0 max-w-full bg-white border border-[#e2e8f0] rounded-lg px-2 py-0.5 text-xs font-mono text-[#0b1c30] cursor-pointer focus:outline-hidden focus:border-[#004ac6]"
                          />
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold w-fit ${
                              renewal.tone === "rose"
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : renewal.tone === "amber"
                                ? "bg-amber-50 text-amber-800 border border-amber-300"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            }`}
                          >
                            <Clock className="w-2.5 h-2.5" />
                            {renewal.label}
                          </span>
                        </div>
                      </td>

                      {/* 4. Estado Operativo */}
                      <td className="py-3.5 px-2 text-center">
                        <select
                          value={svc.status}
                          onChange={(e) => handleStatusChange(svc, e.target.value as ServiceStatus)}
                          className={`w-full min-w-0 max-w-full rounded-md px-1 py-1 text-[11px] font-bold uppercase border cursor-pointer focus:outline-hidden ${
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

                      {/* 5. Switch Facturable vs No Facturado en el ciclo actual */}
                      <td className="py-3.5 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleBillable(svc)}
                          className={`inline-flex w-full min-w-0 max-w-full justify-center items-center gap-1 px-1 py-1 rounded-md text-[10px] font-bold uppercase transition cursor-pointer ${
                            isBillable
                              ? "bg-[#eff4ff] text-[#004ac6] border border-[#dce9ff] hover:bg-blue-100"
                              : "bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
                          }`}
                          aria-label="Clic para incluir o excluir este servicio de la factura del ciclo actual" title="Clic para incluir o excluir este servicio de la factura del ciclo actual"
                        >
                          {isBillable ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#004ac6]" />
                              <span>Facturable</span>
                            </>
                          ) : (
                            <>
                              <Ban className="w-3.5 h-3.5 text-amber-700" />
                              <span>Excluido</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* 6. Tarifa Base */}
                      {showPrices && <td className="py-3.5 px-2 text-right font-mono text-xs">
                        <span className={`block font-bold ${isBillable ? "text-emerald-700 font-bold" : "text-slate-400 line-through"}`}>
                          ${safeNumber(price)}
                        </span>
                        <span className="block text-[10px] text-slate-500 font-medium">
                          ${safeNumber(svc.priceConIva || Math.round(price * 1.15 * 100) / 100)} c/IVA
                        </span>
                      </td>}

                      {/* 7. Acciones: WhatsApp, Correo, Editar, Renovar, Eliminar */}
                      <td className="py-3.5 px-3 text-right">
                        <div className="grid grid-cols-3 items-center justify-items-center gap-1">
                          {showPrices && <button
                            type="button"
                            onClick={() => handleNotifyWhatsApp(svc)}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                            aria-label="Notificar renovación por WhatsApp" title="Notificar renovación por WhatsApp"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>}

                          {showPrices && <button
                            type="button"
                            onClick={() => handleNotifyEmail(svc)}
                            className="p-1.5 text-[#004ac6] hover:bg-[#eff4ff] rounded-lg transition cursor-pointer"
                            aria-label="Notificar renovación por Correo Electrónico" title="Notificar renovación por Correo Electrónico"
                          >
                            <Mail className="w-4 h-4" />
                          </button>}

                          {canEditPrices && <ActionIconButton action="edit" type="button" onClick={() => handleOpenEditService(svc)} aria-label="Editar nombre, descripción o tarifa del servicio" title="Editar nombre, descripción o tarifa del servicio" />}

                          <button
                            type="button"
                            onClick={() => handleRenewService(svc)}
                            className="col-span-2 w-full justify-center px-1 py-1 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition flex items-center gap-1 cursor-pointer"
                            aria-label="Renovar por +1 periodo y activar servicio" title="Renovar por +1 periodo y activar servicio"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Renovar</span>
                          </button>

                          <ActionIconButton action="delete" type="button" onClick={() =>
                              showConfirm(
                                "¿Retirar Servicio?",
                                `¿Deseas eliminar "${svc.planName}" de la lista de servicios de este cliente?`,
                                () => deleteClientService(svc.id),
                                "Eliminar"
                              )
                            } aria-label="Eliminar servicio" title="Eliminar servicio" />
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

      {/* MODAL 3: EDITAR SERVICIO DEL CLIENTE */}
      {canEditPrices && editingService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60">
          <section role="dialog" aria-modal="true" aria-labelledby="client-service-edit-title" className="flex max-h-[92dvh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-2xl">
            {/* Cabecera Master Modal */}
            <div className="bg-[#004ac6] text-white px-4 py-3 sm:px-5 shrink-0 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 id="client-service-edit-title" className="text-sm font-semibold text-balance leading-tight">Editar Servicio del Cliente</h3>
                  <p className="text-[11px] text-white/80 break-words">
                    {editingService.inventorySku ? `[${editingService.inventorySku}] ` : ""}
                    {editingService.planName}
                  </p>
                </div>
              </div>
              <button aria-label="Cerrar"
                type="button"
                disabled={savingEdit}
                onClick={() => setEditingService(null)}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Formulario de Edición */}
            <form id="client-service-edit-form" onSubmit={handleSaveEditService} className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label htmlFor="client-contract-tab-field-12" className="block text-xs font-bold text-[#434655] mb-1">
                  Nombre del Servicio *
                </label>
                <input id="client-contract-tab-field-12"
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="min-w-0 w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 text-xs font-semibold text-[#0b1c30] focus:border-[#004ac6] focus:outline-hidden"
                />
              </div>

              <div>
                <label htmlFor="client-contract-tab-field-13" className="block text-xs font-bold text-[#434655] mb-1">
                  Descripción
                </label>
                <textarea id="client-contract-tab-field-13"
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Detalles técnicos, SLA, alcance o notas..."
                  className="min-w-0 w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 text-xs text-[#0b1c30] focus:border-[#004ac6] focus:outline-hidden resize-none"
                />
              </div>

              <div className="grid min-w-0 grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#434655] mb-1">
                    Tarifa sin IVA ($) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-xs text-slate-400">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={editPriceSinIva}
                      onChange={(e) => handleEditPriceSinIvaChange(e.target.value)}
                      className="min-w-0 w-full bg-white border border-[#cbd5e1] rounded-lg pl-6 pr-3 py-2 text-xs font-mono font-bold text-[#0b1c30] focus:border-[#004ac6] focus:outline-hidden"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Base imponible</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#434655] mb-1">
                    Tarifa con IVA ($) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-xs text-slate-400">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editPriceConIva}
                      onChange={(e) => handleEditPriceConIvaChange(e.target.value)}
                      className="min-w-0 w-full bg-white border border-[#cbd5e1] rounded-lg pl-6 pr-3 py-2 text-xs font-mono font-bold text-emerald-700 focus:border-[#004ac6] focus:outline-hidden"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Total cliente</span>
                </div>
              </div>

              <div className="grid min-w-0 grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="client-contract-tab-field-14" className="block text-xs font-bold text-[#434655] mb-1">
                    IVA Aplicable
                  </label>
                  <select id="client-contract-tab-field-14"
                    value={editIvaRate}
                    onChange={(e) => handleEditIvaRateChange(Number(e.target.value))}
                    className="min-w-0 w-full bg-white border border-[#cbd5e1] rounded-lg px-2.5 py-2 text-xs font-bold text-[#0b1c30] cursor-pointer focus:border-[#004ac6] focus:outline-hidden"
                  >
                    <option value={15}>15% (Vigente SRI)</option>
                    <option value={5}>5% (Materiales)</option>
                    <option value={0}>0% (Exento)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#434655] mb-1">
                    Categoría de Catálogo
                  </label>
                  <div className="w-full bg-slate-50 border border-[#cbd5e1] rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-700 flex items-center gap-1.5 min-h-[38px]">
                    <span className="w-2 h-2 rounded-full bg-[#004ac6] shrink-0" />
                    <span className="truncate">
                      {inventoryProducts.find(p => p.id === (editingService?.inventoryProductId || editingService?.planId))?.categoryName || "Sin categoría"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Ciclo, Período de Contrato y Renovación */}
              <div className="md:col-span-2 min-w-0 p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2 flex items-center gap-1.5 text-slate-800 font-bold">
                  <Clock className="w-3.5 h-3.5 text-[#004ac6]" />
                  <span>Ciclo de Facturación y Vigencia</span>
                </div>

                <div className="grid min-w-0 grid-cols-1 sm:grid-cols-3 gap-3 md:col-span-2">
                  <div>
                    <label htmlFor="client-contract-tab-field-15" className="block text-xs font-bold text-[#434655] mb-1">
                      Modalidad *
                    </label>
                    <select id="client-contract-tab-field-15"
                      value={editBillingType}
                      onChange={(e) => setEditBillingType(e.target.value as ServiceBillingType)}
                      className="min-w-0 w-full bg-white border border-[#cbd5e1] rounded-lg px-2.5 py-2 text-xs font-bold text-[#0b1c30] cursor-pointer focus:border-[#004ac6] focus:outline-hidden"
                    >
                      <option value="prepago">PREPAGO</option>
                      <option value="postpago">POSTPAGO</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="client-contract-tab-field-16" className="block text-xs font-bold text-[#434655] mb-1">
                      Día de cobro *
                    </label>
                    <select id="client-contract-tab-field-16"
                      value={editBillingDay}
                      onChange={(e) => handleEditBillingDayChange(Number(e.target.value))}
                      className="min-w-0 w-full bg-white border border-[#cbd5e1] rounded-lg px-2.5 py-2 text-xs font-bold text-[#0b1c30] cursor-pointer focus:border-[#004ac6] focus:outline-hidden"
                    >
                      <option value={1}>Día 1 de cada mes</option>
                      <option value={2}>Día 2 de cada mes</option>
                      <option value={5}>Día 5 de cada mes</option>
                      <option value={10}>Día 10 de cada mes</option>
                      <option value={15}>Día 15 de cada mes</option>
                      <option value={20}>Día 20 de cada mes</option>
                      <option value={25}>Día 25 de cada mes</option>
                      <option value={28}>Día 28 de cada mes</option>
                      <option value={30}>Día 30 de cada mes</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="client-contract-tab-field-17" className="block text-xs font-bold text-[#434655] mb-1">
                      Anticipo Cobranza *
                    </label>
                    <select id="client-contract-tab-field-17"
                      value={editAdvanceNoticeDay}
                      onChange={(e) => setEditAdvanceNoticeDay(Number(e.target.value))}
                      className="min-w-0 w-full bg-white border border-[#cbd5e1] rounded-lg px-2.5 py-2 text-xs font-bold text-[#0b1c30] cursor-pointer focus:border-[#004ac6] focus:outline-hidden"
                    >
                      <option value={26}>Día 26 de cada mes</option>
                      <option value={25}>Día 25 de cada mes</option>
                      <option value={20}>Día 20 de cada mes</option>
                      <option value={28}>Día 28 de cada mes</option>
                      <option value={1}>Día 1 de cada mes</option>
                      <option value={5}>Día 5 de cada mes</option>
                      <option value={10}>Día 10 de cada mes</option>
                      <option value={15}>Día 15 de cada mes</option>
                    </select>
                  </div>
                </div>

                <div className="grid min-w-0 grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="client-contract-tab-field-18" className="block text-xs font-bold text-[#434655] mb-1">
                      Frecuencia de Facturación *
                    </label>
                    <select id="client-contract-tab-field-18"
                      value={editFreq}
                      onChange={(e) => handleEditFreqChange(e.target.value as ServiceBillingFrequency)}
                      className="min-w-0 w-full bg-white border border-[#cbd5e1] rounded-lg px-2.5 py-2 text-xs font-bold text-[#0b1c30] cursor-pointer focus:border-[#004ac6] focus:outline-hidden"
                    >
                      <option value="mensual">Mensual (Factura mes a mes)</option>
                      <option value="trimestral">Trimestral (Cada 3 meses)</option>
                      <option value="semestral">Semestral (Cada 6 meses)</option>
                      <option value="anual">Anual (Hosting / Dominios)</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="client-contract-tab-field-19" className="block text-xs font-bold text-[#434655] mb-1">
                      Duración del contrato *
                    </label>
                    <select id="client-contract-tab-field-19"
                      value={editDuration}
                      onChange={(e) => handleEditDurationChange(e.target.value as ServiceContractDuration)}
                      className="min-w-0 w-full bg-white border border-[#cbd5e1] rounded-lg px-2.5 py-2 text-xs font-bold text-[#0b1c30] cursor-pointer focus:border-[#004ac6] focus:outline-hidden"
                    >
                      <option value="mensual">1 Mes</option>
                      <option value="trimestral">3 Meses (Trimestral)</option>
                      <option value="semestral">6 Meses (Semestral)</option>
                      <option value="anual">1 Año (Anual - 12 meses)</option>
                      <option value="bianual">2 Años (Bianual - 24 meses)</option>
                      <option value="indefinido">Indefinido / Permanente</option>
                    </select>
                  </div>
                </div>

                <div className="grid min-w-0 grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="client-contract-tab-field-20" className="block text-xs font-bold text-[#434655] mb-1">
                      Fecha Inicio de Contrato
                    </label>
                    <input id="client-contract-tab-field-20"
                      type="date"
                      required
                      value={editStartDate}
                      onChange={(e) => {
                        setEditStartDate(e.target.value);
                        setEditEndDate(suggestedContractEnd(e.target.value, editDuration));
                      }}
                      className="min-w-0 w-full bg-white border border-[#cbd5e1] rounded-lg px-2.5 py-2 text-xs font-mono text-[#0b1c30] focus:border-[#004ac6] focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label htmlFor="client-contract-tab-field-21" className="block text-xs font-bold text-[#434655] mb-1">
                      Inicio del período *
                    </label>
                    <input id="client-contract-tab-field-21"
                      type="date"
                      required
                      min={editStartDate || undefined}
                      max={editEndDate || undefined}
                      value={editPeriodStartDate}
                      onChange={(e) => setEditPeriodStartDate(e.target.value)}
                      className="min-w-0 w-full bg-white border border-[#cbd5e1] rounded-lg px-2.5 py-2 text-xs font-mono text-[#0b1c30] focus:border-[#004ac6] focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="client-contract-tab-field-22" className="block text-xs font-bold text-[#434655] mb-1">
                    Vigencia de Contrato Hasta
                  </label>
                  <input id="client-contract-tab-field-22"
                    type="date"
                    required={editDuration !== "indefinido"}
                    min={editStartDate || undefined}
                    value={editEndDate}
                    onChange={(e) => setEditEndDate(e.target.value)}
                    disabled={editDuration === "indefinido"}
                    className="min-w-0 w-full bg-white border border-[#cbd5e1] rounded-lg px-2.5 py-2 text-xs font-mono text-[#0b1c30] disabled:bg-slate-100 disabled:text-slate-400 focus:border-[#004ac6] focus:outline-hidden"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    {editDuration === "indefinido" ? "Sin fecha límite de vigencia" : "Fecha límite del compromiso contratado"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="text-xs font-semibold">Cómo se calcula el período<select value={editCycleAnchor} onChange={e => setEditCycleAnchor(e.target.value as "calendario" | "aniversario")} className="block w-full border rounded p-2 mt-1"><option value="aniversario">Desde el inicio del período</option><option value="calendario">Mes calendario (del 1 al último día)</option></select></label>
                  {editCycleAnchor === "calendario" && editPeriodStartDate && !editPeriodStartDate.endsWith("-01") && <label className="text-xs font-semibold">Primer período parcial<select value={editPartialPolicy} onChange={e => setEditPartialPolicy(e.target.value as "prorrateo" | "completo")} className="block w-full border rounded p-2 mt-1"><option value="prorrateo">Prorratear por días reales</option><option value="completo">Cobrar período completo</option></select></label>}
                  <label className="text-xs font-semibold">Forma de pago preferida
                    <select value={editPaymentMethod} onChange={e => setEditPaymentMethod(e.target.value as ServicePaymentMethod)} className="block w-full border rounded p-2 mt-1">
                      <option value="credito">Crédito (a cuenta)</option>
                      <option value="efectivo">Efectivo</option>
                      <option value="transferencia">Transferencia bancaria</option>
                      <option value="tarjeta">Tarjeta de crédito</option>
                    </select>
                  </label>
                  {Number(editPriceSinIva) === 0 && <label className="text-xs font-semibold">Motivo de gratuidad<input value={editZeroReason} onChange={e => setEditZeroReason(e.target.value)} className="block w-full border rounded p-2 mt-1" /></label>}
                </div>
                <div className="pt-1 md:col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editAutoRenew}
                      onChange={(e) => setEditAutoRenew(e.target.checked)}
                      className="rounded border-[#cbd5e1] text-[#004ac6] focus:ring-[#004ac6] w-4 h-4 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-bold text-[#0b1c30] block">Marcar para revisión de renovación</span>
                      <span className="text-[10px] text-slate-500 block">
                        Identifica el servicio para revisar su continuidad al vencer.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {editSchedule && <div className="md:col-span-2"><ServiceBillingPreview service={editSchedule} today={today} /></div>}
            </form>
              <footer className="shrink-0 flex items-center justify-end gap-2 border-t border-[#e2e8f0] bg-white px-4 py-3 sm:px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  disabled={savingEdit}
                  onClick={() => setEditingService(null)}
                  className="px-3.5 py-2 rounded-lg border border-[#cbd5e1] bg-white text-[#434655] text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  form="client-service-edit-form"
                  disabled={savingEdit}
                  className="px-4 py-2 rounded-lg bg-[#004ac6] hover:bg-[#003da6] disabled:opacity-50 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  {savingEdit ? "Guardando..." : "Guardar Cambios"}
                </button>
              </footer>
          </section>
        </div>
      )}
    </div>
  );
}
