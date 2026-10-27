"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useApp } from "@/lib/state";
import { calculateLines, planServicePeriod } from "@/lib/commercial-core";
import { getEcuadorDate } from "@/lib/date-utils";
import { api } from "@/lib/api-client";
import { useToast } from "@/lib/toast-context";
import { Client, ClientService, ServiceBillingFrequency, ServiceStatus, SriInvoice } from "@/types";
import {
  Calendar,
  CheckCircle2,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Mail,
  Ban,
  Receipt,
  BellRing,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

interface RecurringBillingViewProps {
  onOpenInvoiceRide?: (inv: SriInvoice) => void;
}

export function RecurringBillingView({ onOpenInvoiceRide }: RecurringBillingViewProps) {
  const {
    clients,
    clientServices,
    updateClientService,
    deleteClientService,
    renewClientService,
    emitRecurringInvoiceForClient,
    startBillingRun,
    processBillingRun,
    refresh,
  } = useApp();
  const { showSuccess, showError, showConfirm } = useToast();

  // Sub-mode: "lote" (Emisión Recurrente por Cliente) | "renovaciones" (Alertas y Seguimiento Global)
  const [subView, setSubView] = useState<"lote" | "renovaciones">("lote");

  // Period selection
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<string>(MONTHS[now.getMonth()]);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [frequencyFilter, setFrequencyFilter] = useState<"todos" | ServiceBillingFrequency>("todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const [emittingClientId, setEmittingClientId] = useState<string | null>(null);
  const [emittingBatch, setEmittingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState("");
  const [savedRuns, setSavedRuns] = useState<{ id: string; units: { index: number; status: string }[] }[]>([]);
  const loadRuns = async () => setSavedRuns((await api<{ runs: { id: string; units: { index: number; status: string }[] }[] }>("/api/commercial")).runs);
  useEffect(() => { void loadRuns().catch(() => {}); }, []);

  // Filter for Renovaciones tab
  const [renewalFilter, setRenewalFilter] = useState<
    "por_renovar" | "no_facturados" | "inactivos" | "todos"
  >("todos");

  const selectedMonthNum = Math.max(1, MONTHS.indexOf(selectedMonth) + 1);
  const periodKey = `${selectedYear}-${String(selectedMonthNum).padStart(2, "0")}`;

  // Helper: calculate days until renewal
  const getRenewalStatus = (nextDate?: string) => {
    if (!nextDate) {
      return { label: "Sin fecha", tone: "slate" as const, daysLeft: 999 };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(`${nextDate}T00:00:00`);
    const diffDays = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { label: `Vencido hace ${Math.abs(diffDays)}d`, tone: "rose" as const, daysLeft: diffDays };
    }
    if (diffDays <= 15) {
      return { label: `Vence en ${diffDays}d`, tone: "amber" as const, daysLeft: diffDays };
    }
    return { label: `Al día (${diffDays}d)`, tone: "emerald" as const, daysLeft: diffDays };
  };

  // Group recurring clients with their services
  const recurringClientsRows = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return clients
      .map((client) => {
        const allClientServices = clientServices.filter(
          (s) => s.clientId === client.id && s.status !== "retirado"
        );
        if (allClientServices.length === 0) return null;

        // Filter services by selected frequency if needed
        const matchingFreqServices = allClientServices.filter((s) => {
          const freq = s.billingFrequency || "mensual";
          return frequencyFilter === "todos" || freq === frequencyFilter;
        });

        if (matchingFreqServices.length === 0) return null;

        const plans = matchingFreqServices.map(service => ({ service, plan: planServicePeriod(service, selectedMonthNum, selectedYear, getEcuadorDate()) }));
        const billableServices = plans.filter(({ service, plan }) => plan.eligible && service.lastBilledPeriod !== periodKey).map(p => p.service);
        const nonBillableServices = matchingFreqServices.filter(service => !billableServices.some(s => s.id === service.id));
        const eligibleLines = plans.filter(({ service, plan }) => plan.eligible && service.lastBilledPeriod !== periodKey).flatMap(({ plan }) => plan.eligible ? [plan.line] : []);
        const calculated = eligibleLines.length ? calculateLines(eligibleLines) : { subtotal: 0, ivaTotal: 0, total: 0 };
        const subtotal = calculated.subtotal, iva = calculated.ivaTotal, total = calculated.total;
        const alreadyBilledInPeriod = matchingFreqServices.length > 0 && matchingFreqServices.every(s => s.lastBilledPeriod === periodKey);

        const hasMonthly = matchingFreqServices.some(
          (s) => (s.billingFrequency || "mensual") === "mensual"
        );
        const hasAnnual = matchingFreqServices.some((s) => s.billingFrequency === "anual");
        const freqLabel =
          hasMonthly && hasAnnual ? "Mensual / Anual" : hasAnnual ? "Anual" : "Mensual";

        const hasPrepago = matchingFreqServices.some((s) => s.billingType === "prepago");
        const hasPostpago = matchingFreqServices.some((s) => s.billingType === "pospago" || s.billingType === "postpago");
        const modalityLabel = hasPrepago && hasPostpago ? "Prepago/Post" : hasPrepago ? "Prepago" : "Postpago";
        const billingDay = matchingFreqServices[0]?.billingDay || 1;
        const advanceNoticeDay = matchingFreqServices[0]?.advanceNoticeDay || 26;

        return {
          client,
          services: matchingFreqServices,
          billableServices,
          nonBillableServices,
          subtotal,
          iva,
          total,
          alreadyBilledInPeriod,
          freqLabel,
          hasPrepago,
          hasPostpago,
          modalityLabel,
          billingDay,
          advanceNoticeDay,
        };
      })
      .filter((row): row is NonNullable<typeof row> => {
        if (!row) return false;
        if (!q) return true;
        return (
          row.client.businessName.toLowerCase().includes(q) ||
          row.client.identificationNumber.toLowerCase().includes(q) ||
          row.services.some((s) => s.planName.toLowerCase().includes(q))
        );
      });
  }, [clients, clientServices, frequencyFilter, searchQuery, periodKey]);

  // All services enriched with client for Renovaciones tab
  const enrichedServices = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return clientServices
      .filter((s) => s.status !== "retirado")
      .map((svc) => {
        const client = clients.find((c) => c.id === svc.clientId);
        const renewal = getRenewalStatus(svc.nextRenewalDate);
        const isBillable = svc.status === "activo" && svc.isBillableInCurrentCycle !== false;
        return { svc, client, renewal, isBillable };
      })
      .filter((item) => {
        if (!item.client) return false;
        if (
          frequencyFilter !== "todos" &&
          (item.svc.billingFrequency || "mensual") !== frequencyFilter
        ) {
          return false;
        }
        if (q) {
          const match =
            item.client.businessName.toLowerCase().includes(q) ||
            item.client.identificationNumber.toLowerCase().includes(q) ||
            item.svc.planName.toLowerCase().includes(q);
          if (!match) return false;
        }
        if (renewalFilter === "por_renovar") {
          return item.renewal.daysLeft <= 15 || item.svc.status === "por_renovar";
        }
        if (renewalFilter === "no_facturados") {
          return !item.isBillable;
        }
        if (renewalFilter === "inactivos") {
          return item.svc.status === "inactivo" || item.svc.status === "suspendido";
        }
        return true;
      })
      .sort((a, b) => a.renewal.daysLeft - b.renewal.daysLeft);
  }, [clientServices, clients, frequencyFilter, searchQuery, renewalFilter]);

  // Summary KPIs
  const summaryStats = useMemo(() => {
    const totalClients = recurringClientsRows.length;
    const totalBillableServices = recurringClientsRows.reduce(
      (sum, r) => sum + r.billableServices.length,
      0
    );
    const totalNonBillableServices = recurringClientsRows.reduce(
      (sum, r) => sum + r.nonBillableServices.length,
      0
    );
    const totalPendingAmount = recurringClientsRows
      .filter((r) => !r.alreadyBilledInPeriod)
      .reduce((sum, r) => sum + r.total, 0);

    const dueSoonCount = clientServices.filter((s) => {
      if (s.status === "retirado") return false;
      const ren = getRenewalStatus(s.nextRenewalDate);
      return ren.daysLeft <= 15 || s.status === "por_renovar";
    }).length;

    return {
      totalClients,
      totalBillableServices,
      totalNonBillableServices,
      totalPendingAmount: Math.round(totalPendingAmount * 100) / 100,
      dueSoonCount,
    };
  }, [recurringClientsRows, clientServices]);

  // Emit single client recurring invoice
  const handleEmitClientInvoice = async (clientId: string, clientName: string) => {
    setEmittingClientId(clientId);
    try {
      const inv = await emitRecurringInvoiceForClient(
        clientId,
        selectedMonthNum,
        selectedYear,
        recurringClientsRows.find(row => row.client.id === clientId)?.billableServices.map(service => service.id)
      );
      if (inv) {
        showSuccess(
          "Nota de Venta Recurrente Emitida",
          `Se emitió la Nota de Venta ${inv.documentNumber} para ${clientName} por $${inv.total.toFixed(2)}.`
        );
        if (onOpenInvoiceRide) {
          onOpenInvoiceRide(inv);
        }
      } else {
        showError(
          "Sin servicios facturables",
          "El cliente no tiene servicios marcados como Facturables para este ciclo."
        );
      }
    } catch (err: any) {
      showError("Error", err?.message || "No se pudo emitir la nota de venta recurrente.");
    } finally {
      setEmittingClientId(null);
    }
  };

  const resumeBillingRun = async (run: { id: string; units: { index: number; status: string }[] }) => {
    setEmittingBatch(true);
    const failures: string[] = [];
    let done = run.units.filter(unit => unit.status === "completed").length;
    try {
      for (const unit of run.units.filter(unit => unit.status !== "completed")) {
        setBatchProgress(`${done}/${run.units.length}`);
        const result = await processBillingRun(run.id, unit.index);
        if (result.status === "completed") done++;
        else failures.push(result.error || "Unidad pendiente de revisión.");
      }
      setBatchProgress(`${done}/${run.units.length}`);
      await refresh();
      await loadRuns();
      if (failures.length) showError("Lote con incidencias", failures.slice(0, 3).join(" · "));
      else showSuccess("Lote completado", `${done} documentos confirmados. El resultado queda guardado.`);
    } catch (error) {
      showError("Lote pendiente", error instanceof Error ? error.message : "Puedes reanudar el lote guardado.");
    } finally { setEmittingBatch(false); }
  };

  const handleEmitBatch = async () => {
    const pending = recurringClientsRows.filter(row => row.billableServices.length > 0);
    if (!pending.length) return;
    try {
      setEmittingBatch(true);
      const run = await startBillingRun(pending.map(row => ({ clientId: row.client.id, month: selectedMonthNum, year: selectedYear,
        serviceIds: row.billableServices.map(service => service.id), expectedTotal: row.total })));
      await resumeBillingRun(run);
    } catch (error) {
      showError("No se inició el lote", error instanceof Error ? error.message : "Revisa los servicios.");
      setEmittingBatch(false);
    }
  };

  // Eliminar un servicio recurrente individual
  const handleDeleteService = (serviceId: string, planName: string, clientName: string) => {
    showConfirm(
      "¿Eliminar Servicio Recurrente?",
      `Se retirará el servicio "${planName}" de ${clientName} de futuras emisiones. Sus deudas y cobros anteriores se conservan.`,
      async () => {
        try {
          await deleteClientService(serviceId);
          showSuccess("Servicio Eliminado", `El servicio "${planName}" fue eliminado correctamente.`);
        } catch (err: any) {
          showError("Error al Eliminar", err?.message || "No se pudo eliminar el servicio.");
        }
      },
      "Eliminar"
    );
  };

  // Limpiar / Eliminar todos los servicios de un cliente
  const handlePurgeAllClientServices = (clientId: string, clientName: string, count: number) => {
    showConfirm(
      "¿Eliminar Todos los Servicios?",
      `¿Estás seguro de eliminar los ${count} servicio(s) de ${clientName}? Se retirarán por completo de la recurrencia y se limpiarán los cobros pendientes.`,
      async () => {
        try {
          const clientSvcs = clientServices.filter((s) => s.clientId === clientId);
          for (const s of clientSvcs) {
            await deleteClientService(s.id);
          }
          showSuccess("Servicios Eliminados", `Se eliminaron ${clientSvcs.length} servicios de ${clientName}.`);
        } catch (err: any) {
          showError("Error al Eliminar", err?.message || "No se pudieron eliminar los servicios.");
        }
      },
      "Eliminar Todos"
    );
  };

  // Toggle service billable status
  const handleToggleBillable = async (svc: ClientService) => {
    const currentlyBillable = svc.status === "activo" && svc.isBillableInCurrentCycle !== false;
    const nextBillable = !currentlyBillable;
    await updateClientService(svc.id, {
      isBillableInCurrentCycle: nextBillable,
      ...(nextBillable && svc.status !== "activo" ? { status: "activo" } : {}),
      nonBillableReason: nextBillable ? "" : `No facturado en ${periodKey}`,
    });
    showSuccess(
      nextBillable ? "Servicio Facturable" : "Pasó a No Facturado",
      nextBillable
        ? `"${svc.planName}" se incluirá en la facturación.`
        : `"${svc.planName}" fue excluido de la factura de este ciclo.`
    );
  };

  // WhatsApp 1-click reminder
  const handleNotifyWhatsApp = async (client: Client, svc: ClientService) => {
    const rawPhone = (client.phone || "").replace(/\D/g, "");
    const cleanPhone = rawPhone.startsWith("0")
      ? `593${rawPhone.slice(1)}`
      : rawPhone.startsWith("593")
      ? rawPhone
      : `593${rawPhone}`;

    const price = (svc.customPrice ?? svc.basePrice ?? 0).toFixed(2);
    const freq = svc.billingFrequency === "anual" ? "anual" : "mensual";
    const due = svc.nextRenewalDate || `${selectedMonth} ${selectedYear}`;

    const text = `Hola *${client.businessName}*, le saludamos de *Control Inntel*. Le recordamos que su servicio *${svc.planName}* (ciclo ${freq} - $${price} + IVA) tiene fecha de renovación el *${due}*. Por favor confírmenos su renovación para mantener activo el servicio.`;

    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`, "_blank");
    await updateClientService(svc.id, {
      lastNotificationSentAt: new Date().toISOString().split("T")[0],
    });
  };

  // Email 1-click reminder
  const handleNotifyEmail = async (client: Client, svc: ClientService) => {
    const price = (svc.customPrice ?? svc.basePrice ?? 0).toFixed(2);
    const freq = svc.billingFrequency === "anual" ? "Anual" : "Mensual";
    const due = svc.nextRenewalDate || `${selectedMonth} ${selectedYear}`;

    const subject = `Aviso de Renovación de Servicio (${freq}) - ${svc.planName}`;
    const body = `Estimado(a) ${client.businessName},\n\nLe informamos que su servicio contratado "${svc.planName}" (${freq} - $${price} USD + IVA) registra fecha de renovación para el ${due}.\n\nAgradecemos su confirmación para proceder con la emisión de la factura correspondiente.\n\nAtentamente,\nÁrea de Facturación`;

    window.open(
      `mailto:${client.email || ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
      "_self"
    );
    await updateClientService(svc.id, {
      lastNotificationSentAt: new Date().toISOString().split("T")[0],
    });
  };

  return (
    <div className="space-y-5">
      {/* Top Bar: Selector de Vista + Periodo + Frecuencia */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
        {/* Selector de Sub-vista */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setSubView("lote")}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
              subView === "lote"
                ? "bg-white text-[#004ac6] shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Facturación</span>
          </button>

          <button
            type="button"
            onClick={() => setSubView("renovaciones")}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
              subView === "renovaciones"
                ? "bg-white text-[#004ac6] shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <BellRing className="w-3.5 h-3.5" />
            <span>Renovaciones</span>
            {summaryStats.dueSoonCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white">
                {summaryStats.dueSoonCount}
              </span>
            )}
          </button>
        </div>

        {/* Controles de Periodo y Frecuencia */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
            <Calendar className="w-3.5 h-3.5 text-[#004ac6]" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent font-bold text-slate-800 focus:outline-hidden cursor-pointer"
            >
              {MONTHS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent font-mono font-bold text-slate-800 focus:outline-hidden cursor-pointer"
            >
              {[2025, 2026, 2027].map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          <select
            value={frequencyFilter}
            onChange={(e) => setFrequencyFilter(e.target.value as any)}
            className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 cursor-pointer"
          >
            <option value="todos">Frecuencia</option>
            <option value="mensual">Mensual</option>
            <option value="trimestral">Trimestral</option>
            <option value="semestral">Semestral</option>
            <option value="anual">Anual</option>
          </select>

          {subView === "lote" && (
            <button
              type="button"
              disabled={emittingBatch || summaryStats.totalPendingAmount <= 0}
              onClick={handleEmitBatch}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#004ac6] hover:bg-[#003da6] disabled:opacity-40 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{emittingBatch ? `Emitiendo ${batchProgress}` : "Facturar Lote"}</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Strip limpio y directo */}
      {savedRuns.length > 0 && <div className="rounded-lg border bg-white p-3 space-y-2" aria-label="Lotes pendientes">
        <p className="text-sm font-semibold">Lotes guardados pendientes de completar</p>
        {savedRuns.map(run => <button key={run.id} disabled={emittingBatch} onClick={() => { void resumeBillingRun(run); }} className="block text-sm text-blue-700 underline disabled:opacity-50">Reanudar lote {run.id.slice(0, 8)} · {run.units.filter(unit => unit.status === "completed").length}/{run.units.length} confirmados</button>)}
      </div>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Clientes
          </span>
          <span className="text-lg font-black text-slate-900 font-mono">
            {summaryStats.totalClients}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/30">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
            Activos
          </span>
          <span className="text-lg font-black text-emerald-700 font-mono">
            {summaryStats.totalBillableServices}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-amber-200 bg-amber-50/30">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
            Pausados
          </span>
          <span className="text-lg font-black text-amber-700 font-mono">
            {summaryStats.totalNonBillableServices}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-blue-200 bg-blue-50/30">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#004ac6] block">
            Por Facturar
          </span>
          <span className="text-lg font-black text-[#004ac6] font-mono">
            ${summaryStats.totalPendingAmount.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Buscador + Filtros secundarios */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Buscar cliente, RUC o servicio..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-[#004ac6]"
          />
        </div>

        {subView === "renovaciones" && (
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: "todos", label: "Todos" },
                { id: "por_renovar", label: "Por Renovar" },
                { id: "no_facturados", label: "No Facturados" },
                { id: "inactivos", label: "Inactivos" },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setRenewalFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  renewalFilter === f.id
                    ? "bg-[#004ac6] text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SUB-VISTA 1: LOTE DE FACTURACIÓN RECURRENTE POR CLIENTE                   */}
      {/* ========================================================================= */}
      {subView === "lote" && (
        <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="table-fixed w-full text-left text-xs border-collapse">
              <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-xs uppercase tracking-wider border-b border-[#e2e8f0]">
                <tr>
                  <th className="py-3 px-4 w-3/12">Cliente</th>
                  <th className="py-3 px-3 w-1/12">Ciclo</th>
                  <th className="py-3 px-3 text-center w-1/12">Activos</th>
                  <th className="py-3 px-3 text-center w-1/12">Pausados</th>
                  <th className="py-3 px-3 text-right w-1/12">Subtotal</th>
                  <th className="py-3 px-3 text-right w-1/12">IVA</th>
                  <th className="py-3 px-4 text-right font-black w-1/12">Total</th>
                  <th className="py-3 px-3 text-center w-1/12">Estado</th>
                  <th className="py-3 px-4 text-right w-2/12">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recurringClientsRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      No se encontraron clientes recurrentes con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  recurringClientsRows.map((row) => {
                    const isExpanded = expandedClientId === row.client.id;
                    return (
                      <React.Fragment key={row.client.id}>
                        <tr className="hover:bg-slate-50/70 transition">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">{row.client.businessName}</div>
                            <div className="text-[10px] font-mono text-slate-500">
                              RUC/CI: {row.client.identificationNumber}
                            </div>
                          </td>

                          <td className="py-3.5 px-3">
                            <div className="space-y-1">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-[#004ac6] border border-blue-200">
                                {row.freqLabel}
                              </span>
                              <div className="flex items-center gap-1">
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase border ${
                                    row.hasPrepago
                                      ? "bg-cyan-50 text-cyan-800 border-cyan-200"
                                      : "bg-purple-50 text-purple-800 border-purple-200"
                                  }`}
                                >
                                  {row.modalityLabel}
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono" title={`Facturación: Día ${row.billingDay} • Aviso previo: Día ${row.advanceNoticeDay}`}>
                                  D{row.billingDay}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-3 text-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {row.billableServices.length} de {row.services.length}
                            </span>
                          </td>

                          <td className="py-3.5 px-3 text-center">
                            {row.nonBillableServices.length > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                {row.nonBillableServices.length} excluido(s)
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">0</span>
                            )}
                          </td>

                          <td className="py-3.5 px-3 text-right font-mono text-slate-700">
                            ${row.subtotal.toFixed(2)}
                          </td>

                          <td className="py-3.5 px-3 text-right font-mono text-sky-600 font-semibold">
                            ${row.iva.toFixed(2)}
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono font-black text-slate-900 text-sm">
                            ${row.total.toFixed(2)}
                          </td>

                          <td className="py-3.5 px-3 text-center">
                            {row.alreadyBilledInPeriod ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Facturado
                              </span>
                            ) : row.billableServices.length === 0 ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-500 border border-slate-200">
                                Sin Servicios Activos
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
                                Pendiente
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedClientId(isExpanded ? null : row.client.id)
                                }
                                className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                                title="Ver o apagar servicios individuales de este cliente antes de facturar"
                              >
                                <SlidersHorizontal className="w-3 h-3 text-[#004ac6]" />
                                <span>Servicios ({row.services.length})</span>
                                {isExpanded ? (
                                  <ChevronUp className="w-3 h-3" />
                                ) : (
                                  <ChevronDown className="w-3 h-3" />
                                )}
                              </button>

                              <button
                                type="button"
                                disabled={
                                  row.billableServices.length === 0 ||
                                  emittingBatch || emittingClientId === row.client.id
                                }
                                onClick={() =>
                                  handleEmitClientInvoice(row.client.id, row.client.businessName)
                                }
                                className="px-3 py-1 rounded-lg bg-[#004ac6] hover:bg-[#003da6] disabled:opacity-40 text-white font-bold text-[11px] transition cursor-pointer"
                              >
                                {emittingClientId === row.client.id
                                  ? "Emitiendo..."
                                  : row.alreadyBilledInPeriod
                                  ? "Ya emitida"
                                  : "Generar Nota Venta"}
                              </button>

                              {row.services.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handlePurgeAllClientServices(
                                      row.client.id,
                                      row.client.businessName,
                                      row.services.length
                                    )
                                  }
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                  title={`Eliminar los ${row.services.length} servicios de ${row.client.businessName}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Desplegable limpio para encender/apagar y eliminar servicios del cliente */}
                        {isExpanded && (
                          <tr className="bg-slate-50/90">
                            <td colSpan={9} className="p-4 px-6 border-b border-slate-200">
                              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                                <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-800 text-xs">
                                      Servicios Recurrentes ({row.services.length})
                                    </span>
                                    <span className="text-[10px] text-slate-500">
                                      — {row.client.businessName}
                                    </span>
                                  </div>
                                  {row.services.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handlePurgeAllClientServices(
                                          row.client.id,
                                          row.client.businessName,
                                          row.services.length
                                        )
                                      }
                                      className="text-[11px] text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1 rounded-lg font-bold inline-flex items-center gap-1 border border-rose-200 transition cursor-pointer"
                                      title="Eliminar todos los servicios recurrentes acumulados de este cliente"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      <span>Eliminar Todos los Servicios</span>
                                    </button>
                                  )}
                                </div>
                                <table className="w-full text-left text-xs">
                                  <thead className="text-[10px] uppercase text-slate-400 bg-slate-50/60 border-b border-slate-100">
                                    <tr>
                                      <th className="py-2 px-4">Servicio</th>
                                      <th className="py-2 px-3">Ciclo</th>
                                      <th className="py-2 px-3">Modalidad</th>
                                      <th className="py-2 px-3">Renovación</th>
                                      <th className="py-2 px-3 text-center">Estado</th>
                                      <th className="py-2 px-3 text-center">Facturar</th>
                                      <th className="py-2 px-4 text-right">Tarifa</th>
                                      <th className="py-2 px-3 text-center">Acciones</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {row.services.map((svc) => {
                                      const billable =
                                        svc.status === "activo" &&
                                        svc.isBillableInCurrentCycle !== false;
                                      const price = svc.customPrice ?? svc.basePrice ?? 0;
                                      return (
                                        <tr key={svc.id} className="hover:bg-slate-50/60 transition">
                                          <td className="py-2.5 px-4 font-bold text-slate-800">
                                            {svc.planName}
                                          </td>
                                          <td className="py-2.5 px-3 capitalize text-slate-600">
                                            {svc.billingFrequency || "mensual"}
                                          </td>
                                          <td className="py-2.5 px-3">
                                            <span
                                              className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase border ${
                                                svc.billingType === "prepago"
                                                  ? "bg-cyan-50 text-cyan-800 border-cyan-200"
                                                  : "bg-purple-50 text-purple-800 border-purple-200"
                                              }`}
                                            >
                                              {svc.billingType === "prepago" ? "PREPAGO" : "POSTPAGO"}
                                            </span>
                                            <span className="text-[10px] text-slate-400 block font-mono">
                                              Día {svc.billingDay ?? 1}
                                            </span>
                                          </td>
                                          <td className="py-2.5 px-3 font-mono text-slate-600">
                                            {svc.nextRenewalDate || "—"}
                                          </td>
                                          <td className="py-2.5 px-3 text-center">
                                            <select
                                              value={svc.status}
                                              onChange={(e) => {
                                                const st = e.target.value as ServiceStatus;
                                                updateClientService(svc.id, {
                                                  status: st,
                                                  isBillableInCurrentCycle: st === "activo",
                                                });
                                              }}
                                              className="border border-slate-200 rounded px-2 py-0.5 text-[11px] font-bold uppercase bg-white cursor-pointer"
                                            >
                                              <option value="activo">ACTIVO</option>
                                              <option value="por_renovar">POR RENOVAR</option>
                                              <option value="inactivo">INACTIVO</option>
                                              <option value="suspendido">SUSPENDIDO</option>
                                            </select>
                                          </td>
                                          <td className="py-2.5 px-3 text-center">
                                            <button
                                              type="button"
                                              onClick={() => handleToggleBillable(svc)}
                                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border cursor-pointer ${
                                                billable
                                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                  : "bg-amber-50 text-amber-800 border-amber-200"
                                              }`}
                                            >
                                              {billable ? "Sí" : "No"}
                                            </button>
                                          </td>
                                          <td className="py-2.5 px-4 text-right font-mono font-bold">
                                            ${price.toFixed(2)}
                                          </td>
                                          <td className="py-2.5 px-3 text-center">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                handleDeleteService(
                                                  svc.id,
                                                  svc.planName,
                                                  row.client.businessName
                                                )
                                              }
                                              className="p-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                              title="Eliminar este servicio recurrente"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-VISTA 2: SEGUIMIENTO GLOBAL DE SERVICIOS & ALERTAS DE RENOVACIÓN      */}
      {/* ========================================================================= */}
      {subView === "renovaciones" && (
        <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="table-fixed w-full text-left text-xs border-collapse">
              <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-xs uppercase tracking-wider border-b border-[#e2e8f0]">
                <tr>
                  <th className="py-3 px-4 w-3/12">Cliente</th>
                  <th className="py-3 px-4 w-3/12">Servicio</th>
                  <th className="py-3 px-3 w-1/12">Ciclo</th>
                  <th className="py-3 px-3 w-1/12">Renovación</th>
                  <th className="py-3 px-3 text-center w-1/12">Estado</th>
                  <th className="py-3 px-3 text-center w-1/12">Facturar</th>
                  <th className="py-3 px-3 text-right w-1/12">Tarifa</th>
                  <th className="py-3 px-4 text-right w-1/12">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {enrichedServices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No hay servicios que coincidan con el filtro seleccionado.
                    </td>
                  </tr>
                ) : (
                  enrichedServices.map(({ svc, client, renewal, isBillable }) => {
                    if (!client) return null;
                    const price = svc.customPrice ?? svc.basePrice ?? 0;

                    return (
                      <tr
                        key={svc.id}
                        className={`transition ${
                          isBillable ? "hover:bg-slate-50/70" : "bg-slate-50/60 text-slate-500"
                        }`}
                      >
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{client.businessName}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {client.phone} • {client.email}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-800">{svc.planName}</div>
                          {svc.lastNotificationSentAt && (
                            <span className="text-[10px] text-emerald-600 font-medium block">
                              Notificado: {svc.lastNotificationSentAt}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3">
                          <select
                            value={svc.billingFrequency || "mensual"}
                            onChange={(e) =>
                              updateClientService(svc.id, {
                                billingFrequency: e.target.value as ServiceBillingFrequency,
                              })
                            }
                            className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 cursor-pointer"
                          >
                            <option value="mensual">Mensual</option>
                            <option value="trimestral">Trimestral</option>
                            <option value="semestral">Semestral</option>
                            <option value="anual">Anual</option>
                          </select>
                        </td>

                        <td className="py-3 px-3">
                          <div className="flex flex-col gap-1">
                            <input
                              type="date"
                              value={svc.nextRenewalDate || ""}
                              onChange={(e) =>
                                updateClientService(svc.id, { nextRenewalDate: e.target.value })
                              }
                              className="bg-white border border-slate-200 rounded px-2 py-0.5 text-[11px] font-mono text-slate-800 w-32"
                            />
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold w-fit ${
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

                        <td className="py-3 px-3 text-center">
                          <select
                            value={svc.status}
                            onChange={(e) => {
                              const st = e.target.value as ServiceStatus;
                              updateClientService(svc.id, {
                                status: st,
                                isBillableInCurrentCycle: st === "activo",
                              });
                            }}
                            className={`rounded-lg px-2 py-1 text-[10px] font-bold uppercase border cursor-pointer ${
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

                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleBillable(svc)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border cursor-pointer ${
                              isBillable
                                ? "bg-blue-50 text-[#004ac6] border-blue-200"
                                : "bg-amber-50 text-amber-800 border-amber-200"
                            }`}
                          >
                            {isBillable ? (
                              <>
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Facturable</span>
                              </>
                            ) : (
                              <>
                                <Ban className="w-3 h-3" />
                                <span>No Facturado</span>
                              </>
                            )}
                          </button>
                        </td>

                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">
                          ${price.toFixed(2)}
                        </td>

                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleNotifyWhatsApp(client, svc)}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                              title="Avisar por WhatsApp"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleNotifyEmail(client, svc)}
                              className="p-1.5 text-[#004ac6] hover:bg-blue-50 rounded-lg transition cursor-pointer"
                              title="Avisar por Correo Electrónico"
                            >
                              <Mail className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={async () => {
                                await renewClientService(svc.id);
                                showSuccess(
                                  "Servicio Renovado",
                                  `Se renovó "${svc.planName}" de ${client.businessName} para el siguiente periodo.`
                                );
                              }}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                              title="Confirmar renovación y avanzar fecha al próximo ciclo"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>Renovar</span>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteService(svc.id, svc.planName, client.businessName)
                              }
                              className="p-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Eliminar este servicio recurrente"
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
    </div>
  );
}
