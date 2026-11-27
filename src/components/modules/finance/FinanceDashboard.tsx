"use client";

import { createSearchMatcher } from "@/lib/search";
import { ClientSearchSelect } from "@/components/ui/ClientSearchSelect";
import { DocumentTablePagination, useDocumentPagination } from "@/components/ui/DocumentTablePagination";
import { compareDatesDescending, getEcuadorDate } from "@/lib/date-utils";
import { isUnusedAdvance } from "@/lib/client-credit";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { ActionIconButton } from "@/components/ui/ActionIconButton";
import { canAccessSubmodule, canUser } from "@/lib/permissions";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/lib/state";
import { activeCommercialDocuments } from "@/lib/sales-policy";
import { ChargePaymentModal } from "./ChargePaymentModal";
import { AdvanceDetailsDialog } from "./AdvanceDetailsDialog";
import { useToast } from "@/lib/toast-context";
import { safeNumber, safeFloat } from "@/lib/print-service";
import {
  FileSpreadsheet,
  Plus,
  Search,
  CreditCard,
  X,
  History,
  Trash2,
  Edit2,
  Sparkles,
  AlertCircle,
  Undo2,
} from "lucide-react";
import { generateBillingBatchExcel, triggerBrowserDownload } from "@/lib/doc-generator";
import type { MonthlyCharge, ClientAdvance, FinancialMovement } from "@/types";
import { Badge } from "@/components/ui/Badge";

const PAYMENT_METHODS = [
  "Transferencia Bancaria",
  "Depósito Bancario",
  "Efectivo",
  "Cheque",
  "Tarjeta de Crédito / Débito",
  "Saldo a Favor / Anticipo",
];

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  enlace_transito: "Internet y Enlaces",
  alquiler_nodo: "Alquiler de Nodos / Locales",
  fibra_equipos: "Equipos y Materiales",
  mantenimiento: "Mantenimiento y Técnicos",
  servicios_basicos: "Servicios Básicos",
  administrativos: "Sueldos y Administrativos",
  seguros: "Seguros y Pólizas",
  opex_servicios: "Servicios y Operación",
  cobro_cliente: "Cobro a Cliente",
  anticipo_cliente: "Anticipo de cliente",
  devolucion_anticipo: "Devolución de anticipo",
  pago_proveedor: "Pago a Proveedor",
  transferencia_interna: "Transferencia entre Cuentas",
  ingreso_extraordinario: "Otros Ingresos",
  otro: "Otros Gastos",
};

export function formatFinanceCategory(cat?: string): string {
  if (!cat) return "General";
  return EXPENSE_CATEGORY_LABELS[cat] || cat.replace(/_/g, " ");
}

export function FinanceDashboard({
  activeTabProp,
}: {
  activeTabProp?: "comprobantes" | "anticipos";
} = {}) {
  const {
    monthlyCharges,
    billingInvoices,
    clients,
    bankAccounts,
    financialMovements,
    clientAdvances,
    currentUser,
    addMonthlyCharge,
    updateMonthlyCharge,
    deleteMonthlyCharge,
    deleteInvoice,
    addClientAdvance,
    applyClientAdvance,
    deleteClientAdvance,
    updateClientAdvance,
    refundClientAdvance,
    reverseChargePayment,
  } = useApp();
  const { showSuccess, showError, showConfirm } = useToast();

  const searchParams = useSearchParams();
  const subParam = searchParams.get("sub");
  const initialTab =
    activeTabProp ||
    (subParam === "anticipos" ? "anticipos" : "comprobantes");
  const [activeTab, setActiveTab] = useState<"comprobantes" | "anticipos">(initialTab);

  useEffect(() => {
    if (activeTabProp) {
      setActiveTab(activeTabProp);
    } else if (subParam) {
      setActiveTab(subParam === "anticipos" ? "anticipos" : "comprobantes");
    }
  }, [activeTabProp, subParam]);

  // Filtros de Cobros
  const [searchQuery, setSearchQuery] = useState("");
  const [advSearchQuery, setAdvSearchQuery] = useState("");
  const [showVoidedAdvances, setShowVoidedAdvances] = useState(false);
  const [statusFilter, setStatusFilter] = useState("todos");
  const [typeFilter, setTypeFilter] = useState("todos"); // "todos" | "nota_venta" | "factura"
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Modal Registrar Abono / Cobro
  const [payingCharge, setPayingCharge] = useState<MonthlyCharge | null>(null);

  // Modal Historial de Abonos
  const [historyCharge, setHistoryCharge] = useState<MonthlyCharge | null>(null);

  // Modal Editar Cobro
  const [editingCharge, setEditingCharge] = useState<MonthlyCharge | null>(null);
  const [editDueDate, setEditDueDate] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Modal Confirmar Eliminación de Cobro
  const [deletingCharge, setDeletingCharge] = useState<MonthlyCharge | null>(null);

  // Modal Registrar Pago Anticipado
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [editingAdvance, setEditingAdvance] = useState<ClientAdvance | null>(null);
  const [advanceDetails, setAdvanceDetails] = useState<{
    advance: ClientAdvance; source?: FinancialMovement; originNumber?: string; status: string; mode: "view" | "void";
  } | null>(null);
  const [savingAdvance, setSavingAdvance] = useState(false);
  const advancePending = useRef(false);
  const [advClientId, setAdvClientId] = useState("");
  const [advAmount, setAdvAmount] = useState<number>(0);
  const [advMonths, setAdvMonths] = useState<number>(1);
  const [advDate, setAdvDate] = useState(getEcuadorDate());
  const [advMethod, setAdvMethod] = useState(PAYMENT_METHODS[0]);
  const [advBankId, setAdvBankId] = useState("");
  const [advReference, setAdvReference] = useState("");
  const [advNotes, setAdvNotes] = useState("");
  const [advReason, setAdvReason] = useState("");

  // Modal Aplicar Anticipo existente a un cobro
  const [selectedAdvanceToApply, setSelectedAdvanceToApply] = useState<ClientAdvance | null>(null);
  const [targetChargeIdForAdvance, setTargetChargeIdForAdvance] = useState("");
  const [amountToApplyFromAdv, setAmountToApplyFromAdv] = useState<number>(0);

  // Modal Registrar Cobro Libre
  const [isNewManualChargeOpen, setIsNewManualChargeOpen] = useState(false);
  const [manualClientId, setManualClientId] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [manualTotal, setManualTotal] = useState<number>(0);
  const [manualInvoiceNumber, setManualInvoiceNumber] = useState("");
  const [manualDueDate, setManualDueDate] = useState(getEcuadorDate());

  // Debts are persisted projections, never synthesized from a sale in the browser.
  const unifiedCharges = useMemo(() => activeCommercialDocuments(monthlyCharges || []), [monthlyCharges]);

  // Filtrado de Cobros
  const filteredCharges = useMemo(() => {
    const matches = createSearchMatcher(searchQuery);
    return unifiedCharges.filter((c) => {
      if (!c) return false;
      const matchesSearch = matches(c.clientName, c.clientRuc, c.invoiceNumber, c.serviceDescription);

      const matchesStatus = statusFilter === "todos" || c.status === statusFilter;

      let matchesType = true;
      if (typeFilter !== "todos") {
        const invMatch = (billingInvoices || []).find(
          (i) => i.id === c.invoiceId && i.clientId === c.clientId
        );
        const docType = invMatch?.documentType || "factura";
        matchesType = docType === typeFilter;
      }

      let matchesDate = true;
      const chargeDate = c.saleDate || c.paymentDate || `${c.year || 2026}-${String(c.month || 1).padStart(2, "0")}-01`;
      if (startDate && chargeDate < startDate) matchesDate = false;
      if (endDate && chargeDate > endDate) matchesDate = false;

      return matchesSearch && matchesStatus && matchesType && matchesDate;
    });
  }, [unifiedCharges, searchQuery, statusFilter, typeFilter, startDate, endDate, billingInvoices]);

  // KPI Totales
  const totalBilled = filteredCharges.filter(c => c.status !== "anulado").reduce((sum, c) => sum + (safeFloat(c.total) || 0), 0);
  const totalPaid = filteredCharges
    .filter((c) => c.status !== "anulado")
    .filter((c) => c.status === "pagado" || safeFloat(c.paidAmount) > 0)
    .reduce((sum, c) => sum + (safeFloat(c.paidAmount) || (c.status === "pagado" ? safeFloat(c.total) : 0)), 0);
  const totalPending = Math.max(0, totalBilled - totalPaid);

  const totalAdvancesAvailable = (clientAdvances || [])
    .filter((a) => a.status === "vigente" && a.remaining > 0)
    .reduce((sum, a) => sum + (safeFloat(a.remaining) || 0), 0);

  // Mapa de anticipos vigentes por clientId
  const clientAdvancesMap = useMemo(() => {
    const map = new Map<string, ClientAdvance[]>();
    (clientAdvances || []).forEach((adv) => {
      if (adv.status === "vigente" && adv.remaining > 0) {
        const list = map.get(adv.clientId) || [];
        list.push(adv);
        map.set(adv.clientId, list);
      }
    });
    return map;
  }, [clientAdvances]);

  const filteredAdvances = useMemo(() => {
    const matches = createSearchMatcher(advSearchQuery);
    return (clientAdvances || []).filter((adv) => {
      if (!adv || adv.deletedAt && !showVoidedAdvances) return false;
      return matches(adv.clientName, adv.clientRuc, adv.method, adv.reference);
    }).sort(compareDatesDescending);
  }, [clientAdvances, advSearchQuery, showVoidedAdvances]);

  const chargeById = useMemo(() => new Map(monthlyCharges.map(charge => [charge.id, charge])), [monthlyCharges]);
  const movementById = useMemo(() => new Map(financialMovements.map(movement => [movement.id, movement])), [financialMovements]);
  const canEditAdvances = canUser(currentUser, "finanzas", "canRegisterReceipts");
  const canReverseMoney = canUser(currentUser, "finanzas", "canCancelPayments");
  const isEditingReleased = Boolean(editingAdvance?.sourcePaymentId);
  const lockAdvanceMoney = Boolean(editingAdvance?.sourcePaymentId && !isUnusedAdvance(editingAdvance));
  const lockAdvanceClient = Boolean(editingAdvance && (isEditingReleased || !isUnusedAdvance(editingAdvance)));

  const chargesPage = useDocumentPagination(filteredCharges, [activeTab, searchQuery, statusFilter, typeFilter, startDate, endDate]);
  const advancesPage = useDocumentPagination(filteredAdvances, [activeTab, advSearchQuery, showVoidedAdvances]);
  const showAdvanceMonths = filteredAdvances.some(advance => advance.monthsCovered > 0);

  function advanceOrigin(advance: ClientAdvance) {
    const charge = advance.sourceChargeId ? chargeById.get(advance.sourceChargeId) : undefined;
    const payment = charge?.payments?.find(item => item.id === advance.sourcePaymentId && item.status === "reversed");
    const movementId = advance.sourcePaymentId ? payment?.movementId : advance.movementId;
    const movement = movementId ? movementById.get(movementId) : undefined;
    const linked = movement?.type === "ingreso" && movement.amount === advance.amount &&
      (advance.sourcePaymentId
        ? movement.category === "cobro_cliente" && movement.relatedEntityId === advance.sourcePaymentId &&
          movement.chargeId === charge?.id && charge?.clientId === advance.clientId
        : movement.category === "anticipo_cliente" && movement.relatedEntityId === advance.id);
    return { source: linked ? movement : undefined, originNumber: charge?.invoiceNumber };
  }

  function openAdvanceEditor(advance: ClientAdvance, source: FinancialMovement) {
    setEditingAdvance(advance);
    setAdvClientId(advance.clientId);
    setAdvAmount(advance.amount);
    setAdvMonths(advance.monthsCovered || 1);
    setAdvDate(source.date || advance.date);
    setAdvMethod(source.paymentMethod || advance.method);
    setAdvBankId(source.bankAccountId);
    setAdvReference(source.referenceNumber ?? advance.reference ?? "");
    setAdvNotes(advance.notes || "");
    setAdvReason("");
    setIsAdvanceModalOpen(true);
  }

  const handleExportBatch = async () => {
    if (filteredCharges.length === 0) {
      showError("Sin Registros", "No hay cobros con los filtros actuales para exportar.");
      return;
    }
    try {
      const blob = await generateBillingBatchExcel(filteredCharges);
      triggerBrowserDownload(blob, `Cobranzas_Comprobantes_${getEcuadorDate()}.xlsx`);
      showSuccess("Excel Exportado", `Se descargaron ${filteredCharges.length} comprobantes de cobro.`);
    } catch {
      showError("Error", "No se pudo generar el archivo Excel.");
    }
  };

  const handleSaveEditCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCharge) return;
    try {
      await updateMonthlyCharge(editingCharge.id, {
        maxPaymentDate: editDueDate || undefined,
        notes: editNotes.trim() || undefined,
      });
      showSuccess("Cobro Actualizado", `Comprobante ${editingCharge.invoiceNumber} modificado correctamente.`);
      setEditingCharge(null);
    } catch (error) {
      showError("Error", error instanceof Error ? error.message : "No se pudo actualizar el cobro.");
    }
  };

  const handleConfirmDeleteCharge = async () => {
    if (!deletingCharge) return;
    try {
      const invId = deletingCharge.invoiceId;

      if (invId) {
        await deleteInvoice(invId);
      } else {
        await deleteMonthlyCharge(deletingCharge.id);
      }

      showSuccess(
        "Anulación registrada",
        `Se conserva el historial de ${deletingCharge.invoiceNumber || ""} y los importes recibidos quedan identificados.`
      );
      setDeletingCharge(null);
    } catch (error) {
      showError("Error", error instanceof Error ? error.message : "No se pudo eliminar el comprobante.");
    }
  };

  const handleCreateAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (advancePending.current) return;
    if (!advClientId) {
      showError("Cliente Requerido", "Selecciona el cliente que realiza el pago anticipado.");
      return;
    }
    if (advAmount <= 0) {
      showError("Monto Inválido", "El monto del pago anticipado debe ser mayor a $0.00.");
      return;
    }

    const clientObj = clients.find((c) => c.id === advClientId);
    const existingClient = editingAdvance?.clientId === advClientId ? editingAdvance : undefined;
    if (!clientObj && !existingClient) {
      showError("Cliente no disponible", "Selecciona el cliente del anticipo.");
      return;
    }
    if (editingAdvance && advReason.trim().length < 3) return;
    const clientName = clientObj?.businessName || existingClient?.clientName || "Cliente";

    try {
      advancePending.current = true;
      setSavingAdvance(true);
      const changes = {
        clientId: advClientId,
        clientName,
        clientRuc: clientObj?.identificationNumber || existingClient?.clientRuc || "",
        date: advDate,
        amount: advAmount,
        monthsCovered: Number(advMonths) || 1,
        method: advMethod,
        reference: advReference.trim() || undefined,
        bankAccountId: advBankId || undefined,
        bankAccountName: advBankId ? bankAccounts.find((b) => b.id === advBankId)?.bankName : undefined,
        notes: advNotes.trim() || undefined,
      };
      if (editingAdvance) await updateClientAdvance(editingAdvance.id, changes, editingAdvance.version || 0, advReason.trim());
      else await addClientAdvance(changes);

      showSuccess(
        editingAdvance ? "Anticipo corregido" : "Pago Anticipado Registrado",
        editingAdvance ? "El cambio quedó registrado en el historial." : `Se registraron $${advAmount.toFixed(2)} (${advMonths} meses) a favor de ${clientName}.`
      );
      setIsAdvanceModalOpen(false);
      setAdvClientId("");
      setAdvAmount(0);
      setAdvReference("");
      setAdvNotes("");
    } catch (error) {
      showError("Error", error instanceof Error ? error.message : "No se pudo registrar el anticipo.");
    } finally {
      advancePending.current = false;
      setSavingAdvance(false);
    }
  };

  const handleExecuteApplyAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdvanceToApply || !targetChargeIdForAdvance) return;
    if (amountToApplyFromAdv <= 0) {
      showError("Monto Inválido", "El monto a aplicar debe ser mayor a $0.00.");
      return;
    }

    try {
      await applyClientAdvance(selectedAdvanceToApply.id, targetChargeIdForAdvance, amountToApplyFromAdv);
      showSuccess("Anticipo Aplicado", `Se aplicaron $${amountToApplyFromAdv.toFixed(2)} al comprobante seleccionado.`);
      setSelectedAdvanceToApply(null);
      setTargetChargeIdForAdvance("");
    } catch (error) {
      showError("Error", error instanceof Error ? error.message : "No se pudo aplicar el anticipo.");
    }
  };

  const handleCreateManualCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualClientId) {
      showError("Cliente Requerido", "Selecciona el cliente del cobro.");
      return;
    }
    if (manualTotal <= 0) {
      showError("Monto Inválido", "El total del cobro debe ser mayor a $0.00.");
      return;
    }

    const clientObj = clients.find((c) => c.id === manualClientId);
    if (!clientObj) return;

    const today = getEcuadorDate();
    const dateParts = today.split("-");
    const docNum = manualInvoiceNumber.trim() || `COB-${Date.now().toString().slice(-6)}`;

    try {
      await addMonthlyCharge({
        clientId: clientObj.id,
        clientName: clientObj.businessName || "Cliente",
        clientRuc: clientObj.identificationNumber || "",
        month: parseInt(dateParts[1] || "1", 10),
        year: parseInt(dateParts[0] || "2026", 10),
        serviceDescription: manualDescription.trim() || "Cobro de Servicios / Equipos",
        subtotal: manualTotal,
        ivaAmount: 0,
        total: manualTotal,
        status: "pendiente",
        invoiceNumber: docNum,
        saleDate: today,
        maxPaymentDate: manualDueDate || today,
        paidAmount: 0,
        balanceRemaining: manualTotal,
      });

      showSuccess("Cobro Registrado", `Cobro por $${manualTotal.toFixed(2)} generado bajo comprobante ${docNum}.`);
      setIsNewManualChargeOpen(false);
      setManualClientId("");
      setManualDescription("");
      setManualTotal(0);
      setManualInvoiceNumber("");
    } catch (error) {
      showError("Error", error instanceof Error ? error.message : "No se pudo crear el cobro.");
    }
  };

  return (
    <div className="w-full space-y-3">
      {/* VISTA 1: COBROS POR COMPROBANTE DE VENTA */}
      {activeTab === "comprobantes" && (
        <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
          {/* Barra de Filtros */}
          <div className="ui-toolbar border-b border-[#e2e8f0] flex flex-wrap items-center justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <div className="relative w-60 max-w-full">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  aria-label="Buscar comprobantes"
                  placeholder="Buscar Nro Comprobante, cliente o RUC..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="ui-cell-control w-full !pl-8"
                />
              </div>

              <select
                aria-label="Filtrar por tipo de comprobante"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="ui-cell-control"
              >
                <option value="todos">Todos los Comprobantes</option>
                <option value="nota_venta">Notas de Venta</option>
                <option value="factura">Facturas SRI</option>
              </select>

              <select
                aria-label="Filtrar por estado del cobro"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="ui-cell-control"
              >
                <option value="todos">Todos los Estados</option>
                <option value="pendiente">Pendientes</option>
                <option value="parcial">Abono Parcial</option>
                <option value="pagado">Pagados</option>
              </select>

              <label className="flex items-center gap-1.5">
                <span>Desde</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="ui-cell-control"
                />
              </label>

              <label className="flex items-center gap-1.5">
                <span>Hasta</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="ui-cell-control"
                />
              </label>

              {(startDate || endDate || searchQuery || statusFilter !== "todos" || typeFilter !== "todos") && (
                <button
                  type="button"
                  onClick={() => {
                    setStartDate("");
                    setEndDate("");
                    setSearchQuery("");
                    setStatusFilter("todos");
                    setTypeFilter("todos");
                  }}
                  className="ui-cell-control cursor-pointer hover:text-[#004ac6]"
                >
                  Limpiar filtros
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {canAccessSubmodule(currentUser, "finanzas", "reportes") && (
                <Link href="/finanzas?sub=reportes&reporte=pagos" className="ui-cell-control inline-flex items-center hover:text-[#004ac6]">
                  Reporte de pagos
                </Link>
              )}
              <button
                type="button"
                onClick={handleExportBatch}
                className="ui-cell-control inline-flex items-center gap-1.5 cursor-pointer hover:text-[#004ac6]"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Exportar cartera</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setManualDueDate(getEcuadorDate());
                  setIsNewManualChargeOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Registrar cobro</span>
              </button>
            </div>
          </div>

          {/* Tabla de Cobros */}
          <div className="ui-table-scroll" role="region" aria-label="Cobranzas" tabIndex={0}>
            <table className="table-fixed w-full min-w-[48rem] text-left border-collapse">
              <thead className="bg-[#f8f9ff] text-[#004ac6] font-semibold border-b border-[#e2e8f0]">
                <tr>
                  <th scope="col" className="w-[20%] px-2 py-2">Comprobante</th>
                  <th scope="col" className="w-20 px-2 py-2">Fecha de venta</th>
                  <th scope="col" className="px-2 py-2">Cliente / RUC</th>
                  <th scope="col" className="w-[5.5rem] px-2 py-2 text-right">Total de venta</th>
                  <th scope="col" className="w-[5.5rem] px-2 py-2 text-right">Abonado</th>
                  <th scope="col" className="w-[5.5rem] px-2 py-2 text-right">Saldo pendiente</th>
                  <th scope="col" className="w-20 px-2 py-2 text-center">Estado</th>
                  <th scope="col" className="w-[calc(var(--ui-row-control)*4+28px)] px-2 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {filteredCharges.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <div className="max-w-xs mx-auto space-y-1">
                        <AlertCircle className="w-6 h-6 text-slate-300 mx-auto" />
                        <p className="font-semibold text-slate-600">No se encontraron cobros registrados.</p>
                        <p className="text-[11px] text-slate-400">
                          Las ventas generadas en el módulo de Ventas aparecerán aquí ligadas a su comprobante.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  chargesPage.rows.map((charge) => {
                    const isCancelled = charge.status === "anulado";
                    const isPaid = charge.status === "pagado";
                    const isPartial = charge.status === "parcial";
                    const balance =
                      charge.balanceRemaining !== undefined
                        ? charge.balanceRemaining
                        : isPaid
                        ? 0
                        : charge.total;

                    const paid =
                      charge.paidAmount !== undefined
                        ? charge.paidAmount
                        : isPaid
                        ? charge.total
                        : 0;

                    // Verificar tipo de comprobante en billingInvoices
                    const invMatch = (billingInvoices || []).find(
                      (i) => i.clientId === charge.clientId && (charge.invoiceId ? i.id === charge.invoiceId : i.documentNumber === charge.invoiceNumber)
                    );
                    const isNotaVenta = invMatch ? invMatch.documentType === "nota_venta" : charge.invoiceNumber.startsWith("001-001");

                    // Anticipos disponibles para este cliente
                    const clientAdvancesList = clientAdvancesMap.get(charge.clientId) || [];
                    const clientAdvanceSum = clientAdvancesList.reduce((sum, a) => sum + a.remaining, 0);

                    return (
                      <tr key={charge.id} className="hover:bg-[#f8f9ff] transition-colors">
                        {/* Comprobante */}
                        <td className="px-2 py-1.5">
                          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                            <span className="font-semibold tabular-nums [overflow-wrap:anywhere]">
                              {charge.invoiceNumber || "S/N"}
                            </span>
                            <Badge>
                              {isNotaVenta ? "Nota de venta" : "Factura SRI"}
                            </Badge>
                          </div>
                          {charge.serviceDescription && (
                            <span className="ui-cell-meta block truncate" title={charge.serviceDescription}>
                              {charge.serviceDescription}
                            </span>
                          )}
                        </td>

                        {/* Fecha Venta */}
                        <td className="px-2 py-1.5 tabular-nums whitespace-nowrap">
                          {charge.saleDate || charge.paymentDate || `${charge.year || 2026}-${String(charge.month || 1).padStart(2, "0")}-01`}
                        </td>

                        {/* Cliente / RUC */}
                        <td className="px-2 py-1.5">
                          <span className="ui-emphasis font-semibold block truncate" title={charge.clientName}>
                            {charge.clientName}
                          </span>
                          <span className="ui-cell-meta block">
                            {charge.clientRuc || "Consumidor Final"}
                          </span>
                          {clientAdvanceSum > 0 && !isPaid && !isCancelled && (
                            <span className="ui-cell-meta block">
                              A favor: ${safeNumber(clientAdvanceSum)}
                            </span>
                          )}
                        </td>

                        {/* Total Venta */}
                        <td className="ui-emphasis px-2 py-1.5 text-right tabular-nums whitespace-nowrap">
                          ${safeNumber(charge.total)}
                        </td>

                        {/* Abonado */}
                        <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">
                          ${safeNumber(paid)}
                        </td>

                        {/* Saldo Pendiente */}
                        <td className="px-2 py-1.5 text-right font-semibold tabular-nums whitespace-nowrap">
                          ${safeNumber(balance)}
                        </td>

                        {/* Estado */}
                        <td className="px-2 py-1.5 text-center">
                          <Badge>
                            {isCancelled ? "Anulado" : isPaid ? "Pagado" : isPartial ? "Parcial" : "Pendiente"}
                          </Badge>
                        </td>

                        {/* Acciones */}
                        <td className="px-2 py-1.5 text-right">
                          <div className="ui-table-actions">
                            {!isPaid && !isCancelled && (
                              <button
                                type="button"
                                title="Registrar cobro / abono"
                                aria-label="Registrar cobro / abono"
                                onClick={() => setPayingCharge(charge)}
                                className="ui-icon-button"
                              >
                                <CreditCard aria-hidden="true" />
                              </button>
                            )}

                            {(charge.payments && charge.payments.length > 0) && (
                              <button
                                type="button"
                                title="Ver historial de abonos"
                                aria-label="Ver historial de abonos"
                                onClick={() => setHistoryCharge(charge)}
                                className="ui-icon-button"
                              >
                                <History aria-hidden="true" />
                              </button>
                            )}

                            <ActionIconButton action="edit" type="button" title="Editar Cobro" disabled={isCancelled} onClick={() => {
                                setEditingCharge(charge);
                                setEditDueDate(charge.maxPaymentDate || "");
                                setEditNotes(charge.notes || "");
                              }} />

                            <ActionIconButton action="delete" type="button" title="Revisar anulación comercial" disabled={isCancelled} onClick={() => setDeletingCharge(charge)} />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <DocumentTablePagination {...chargesPage.controls} />
        </div>
      )}

      {/* VISTA 2: ANTICIPOS DE CLIENTES */}
      {activeTab === "anticipos" && (
        <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
          <div className="ui-toolbar border-b border-[#e2e8f0] flex flex-wrap items-center justify-between">
            <div className="relative w-72 max-w-full">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input aria-label="Buscar anticipo"
                type="text"
                placeholder="Buscar anticipo por cliente o RUC..."
                value={advSearchQuery}
                onChange={(e) => setAdvSearchQuery(e.target.value)}
                className="ui-cell-control w-full !pl-8"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={showVoidedAdvances} onChange={event => setShowVoidedAdvances(event.target.checked)} />
              Incluir anulados
            </label>

            <button
              type="button"
              onClick={() => {
                setAdvDate(getEcuadorDate());
                setAdvClientId(""); setAdvAmount(0); setAdvMonths(1); setAdvReference(""); setAdvNotes("");
                setAdvMethod(PAYMENT_METHODS[0]); setAdvReason("");
                setAdvBankId(bankAccounts.find((b) => b.status === "activa")?.id || bankAccounts[0]?.id || "");
                setIsAdvanceModalOpen(true);
                setEditingAdvance(null);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg text-xs font-bold transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Registrar anticipo</span>
            </button>
          </div>

          <div className="ui-table-scroll" role="region" aria-label="Anticipos de clientes" tabIndex={0}>
            <table className="table-fixed w-full min-w-[53rem] text-left border-collapse">
              <thead className="bg-[#f8f9ff] text-[#004ac6] font-semibold border-b border-[#e2e8f0]">
                <tr>
                  <th scope="col" className="w-20 px-2 py-2">Fecha</th>
                  <th scope="col" className="px-2 py-2">Cliente / RUC</th>
                  {showAdvanceMonths && <th scope="col" className="w-12 px-2 py-2 text-center">Meses</th>}
                  <th scope="col" className="w-20 px-2 py-2 text-right">Monto inicial</th>
                  <th scope="col" className="w-[5.5rem] px-2 py-2 text-right">Saldo disponible</th>
                  <th scope="col" className="w-[20%] px-2 py-2">Método / banco</th>
                  <th scope="col" className="w-28 px-2 py-2 text-center">Estado</th>
                  <th scope="col" className="w-[calc(var(--ui-row-control)*5+32px)] px-2 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {(filteredAdvances || []).length === 0 ? (
                  <tr>
                    <td colSpan={showAdvanceMonths ? 8 : 7} className="py-12 text-center text-slate-400">
                      No hay pagos anticipados registrados hasta el momento.
                    </td>
                  </tr>
                ) : (
                  advancesPage.rows.map((adv) => {
                    const isAvailable = adv.status === "vigente" && adv.remaining > 0;
                    const isCancelled = adv.status === "anulado";
                    const wasRefunded = safeFloat(adv.refundedAmount) > 0;
                    const advanceLabel = isCancelled
                      ? wasRefunded ? "Devuelto" : "Anulado"
                      : isAvailable ? "Disponible" : wasRefunded ? "Aplicado / devuelto" : "Aplicado";
                    const origin = advanceOrigin(adv);
                    const source = origin.source;
                    const bankName = source?.bankAccountName || adv.bankAccountName;
                    const reference = source?.referenceNumber ?? adv.reference;
                    const canEdit = Boolean(source && source.status !== "anulado" && !isCancelled && !adv.deletedAt);
                    const canVoid = canEdit && isUnusedAdvance(adv);
                    const dialogData = { advance: adv, ...origin, status: advanceLabel };
                    return (
                      <tr key={adv.id} className="hover:bg-[#f8f9ff] transition-colors">
                        <td className="px-2 py-1.5 tabular-nums whitespace-nowrap">{adv.date}</td>
                        <td className="px-2 py-1.5">
                          <span className="ui-emphasis font-semibold block truncate" title={adv.clientName}>{adv.clientName}</span>
                          <span className="ui-cell-meta block">{adv.clientRuc}</span>
                        </td>
                        {showAdvanceMonths && <td className="px-2 py-1.5 text-center tabular-nums">
                          {adv.monthsCovered > 0 ? adv.monthsCovered : null}
                        </td>}
                        <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">
                          ${safeNumber(adv.amount)}
                        </td>
                        <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                          <span className="ui-emphasis whitespace-nowrap">${safeNumber(adv.remaining)}</span>
                          {wasRefunded && <span className="ui-cell-meta block">Devuelto: ${safeNumber(adv.refundedAmount)}</span>}
                        </td>
                        <td className="px-2 py-1.5 [overflow-wrap:anywhere]">
                          <span className="ui-cell-meta block">{source?.paymentMethod || adv.method}</span>
                          {bankName && <span className="ui-cell-meta block">{bankName}</span>}
                          {reference && <span className="ui-cell-meta block">Ref: {reference}</span>}
                          {adv.sourcePaymentId && <span className="ui-cell-meta block">
                            {origin.originNumber ? `Origen ${origin.originNumber}` : "Saldo de un cobro revertido"}
                          </span>}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <Badge>
                            {advanceLabel}
                          </Badge>
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <div className="ui-table-actions">
                            <ActionIconButton action="view" label={`Ver anticipo de ${adv.clientName}`} onClick={() => setAdvanceDetails({ ...dialogData, mode: "view" })} />
                            {!isCancelled && canEditAdvances && <ActionIconButton action="edit" label={`Editar anticipo de ${adv.clientName}`}
                              disabled={!canEdit} title={canEdit ? "Editar anticipo" : "El ingreso de origen requiere conciliación"}
                              onClick={() => { if (source) openAdvanceEditor(adv, source); }} />}
                            {!isCancelled && canReverseMoney && <ActionIconButton action="delete" label={`Anular anticipo de ${adv.clientName}`}
                              disabled={!canVoid} title={canVoid ? "Anular anticipo" : "Revisa el origen, las aplicaciones o las devoluciones"}
                              onClick={() => setAdvanceDetails({ ...dialogData, mode: "void" })} />}
                            {isAvailable && (
                              <button
                                type="button"
                                title="Aplicar este anticipo a un cobro"
                                aria-label="Aplicar este anticipo a un cobro"
                                onClick={() => {
                                  setSelectedAdvanceToApply(adv);
                                  setAmountToApplyFromAdv(adv.remaining);
                                  setTargetChargeIdForAdvance("");
                                }}
                                className="ui-icon-button"
                              >
                                <CreditCard aria-hidden="true" />
                              </button>
                            )}

                            {!isCancelled && adv.remaining > 0 && canReverseMoney && (
                              <button
                                type="button"
                                title="Registrar devolución de dinero"
                                aria-label="Registrar devolución de dinero"
                                onClick={() => showConfirm("Registrar devolución de dinero", `¿Confirmas que ya devolviste $${adv.remaining.toFixed(2)} a ${adv.clientName} desde su cuenta de origen? Esta acción registra la salida de dinero en el sistema.`, async () => {
                                    try {
                                      await refundClientAdvance(adv.id);
                                      showSuccess("Devolución registrada", "La salida quedó registrada como devolución de anticipo.");
                                    } catch (err) {
                                      showError("Error", err instanceof Error ? err.message : "No se pudo registrar la devolución.");
                                    }
                                }, "Registrar devolución")}
                                className="ui-icon-button"
                              >
                                <Undo2 aria-hidden="true" />
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
          <DocumentTablePagination {...advancesPage.controls} />
        </div>
      )}

      {payingCharge && <ChargePaymentModal key={payingCharge.id} charge={payingCharge} onClose={() => setPayingCharge(null)} />}

      {/* MODAL 2: HISTORIAL DE ABONOS */}
      {historyCharge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <History className="w-4 h-4 text-[#004ac6]" />
                  Historial de Abonos: {historyCharge.invoiceNumber}
                </h3>
                <span className="text-[11px] text-slate-500">
                  Cliente: <strong className="ui-emphasis text-slate-800">{historyCharge.clientName}</strong>
                </span>
              </div>
              <button aria-label="Cerrar"
                type="button"
                onClick={() => setHistoryCharge(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs max-h-[400px] overflow-y-auto">
              {(!historyCharge.payments || historyCharge.payments.length === 0) ? (
                <div className="text-center py-8 text-slate-400">
                  No se registran abonos detallados en este comprobante.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {historyCharge.payments.map((p, idx) => (
                    <div key={p.id || idx} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{p.method}</span>
                          <span className="text-[10px] font-mono text-slate-500">{p.date}</span>
                        </div>
                        {p.reference && (
                          <span className="text-[11px] text-slate-500 font-mono block">Ref: {p.reference}</span>
                        )}
                        {p.bankAccountName && (
                          <span className="text-[10px] text-slate-400 block">{p.bankAccountName}</span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className={`block font-mono text-sm font-bold ${p.voidedAt ? "text-slate-500 line-through" : "text-emerald-700"}`}>
                          +${safeNumber(p.amount)}
                        </span>
                        <span className="text-[10px] text-slate-500">{p.voidedAt ? "Cobro anulado" : p.status === "reversed" ? "Aplicación revertida" : "Abonado"}</span>
                        {p.status !== "reversed" && historyCharge.status !== "anulado" && <button type="button" className="block text-xs text-blue-700 underline mt-1" onClick={() => showConfirm("Revertir aplicación", "La deuda volverá a quedar pendiente y el dinero quedará disponible como anticipo. No se devuelve dinero del banco.", async () => {try{await reverseChargePayment(historyCharge.id,p.id);setHistoryCharge(null);showSuccess("Aplicación revertida","Saldo disponible y deuda actualizados.");}catch(error){showError("No se pudo revertir",error instanceof Error?error.message:"Revisa el historial.");}})}>Revertir aplicación</button>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Saldo pendiente actual: <strong className="text-amber-700 font-mono">${safeNumber(historyCharge.balanceRemaining || 0)}</strong>
              </span>
              <button
                type="button"
                onClick={() => setHistoryCharge(null)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-bold text-xs cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: EDITAR COBRO */}
      {editingCharge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-[#004ac6]" />
                Editar Cobro: {editingCharge.invoiceNumber}
              </h3>
              <button aria-label="Cerrar"
                type="button"
                onClick={() => setEditingCharge(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditCharge} className="p-5 space-y-3.5 text-xs">
              <div>
                <label htmlFor="finance-dashboard-field-7" className="text-[11px] font-bold text-slate-700 block mb-1">Cliente</label>
                <input id="finance-dashboard-field-7"
                  type="text"
                  disabled
                  value={editingCharge.clientName}
                  className="w-full bg-slate-100 border border-slate-300 rounded-lg px-3 py-2 text-slate-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label htmlFor="finance-dashboard-field-8" className="text-[11px] font-bold text-slate-700 block mb-1">
                  Fecha Límite / Vencimiento
                </label>
                <input id="finance-dashboard-field-8"
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-hidden focus:border-[#004ac6]"
                />
              </div>

              <div>
                <label htmlFor="finance-dashboard-field-9" className="text-[11px] font-bold text-slate-700 block mb-1">
                  Observaciones / Notas
                </label>
                <textarea id="finance-dashboard-field-9"
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Detalles sobre acuerdos de pago, recordatorios..."
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-hidden focus:border-[#004ac6]"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingCharge(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg font-bold shadow-xs cursor-pointer transition"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: CONFIRMAR ELIMINACIÓN DE COBRO */}
      {deletingCharge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden p-5 space-y-4">
            <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-slate-900 text-sm">{deletingCharge.invoiceId ? "¿Anular la venta y su deuda?" : "¿Anular esta deuda manual?"}</h3>
              <p className="text-xs text-slate-600">
                Se anulará {deletingCharge.invoiceId ? "la venta y su deuda" : "la deuda"} <strong>{deletingCharge.invoiceNumber}</strong> por <strong className="ui-emphasis">${safeNumber(deletingCharge.total)}</strong>. El historial se conserva. Los abonos quedan como saldo a favor y la salida de inventario se revierte cuando corresponde. Esta acción no devuelve dinero al cliente.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingCharge(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCharge}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
              >
                Confirmar anulación
              </button>
            </div>
          </div>
        </div>
      )}

      {advanceDetails && <AdvanceDetailsDialog
        key={`${advanceDetails.advance.id}-${advanceDetails.mode}`}
        advance={advanceDetails.advance} source={advanceDetails.source}
        originNumber={advanceDetails.originNumber} status={advanceDetails.status}
        onClose={() => setAdvanceDetails(null)}
        onVoid={advanceDetails.mode === "void" ? async (reason) => {
          const advance = advanceDetails.advance;
          await deleteClientAdvance(advance.id, advance.version || 0, reason);
          showSuccess("Anticipo anulado", "El ingreso se corrigió y la anulación quedó en el historial.");
        } : undefined}
      />}

      {/* MODAL 5: REGISTRAR PAGO ANTICIPADO */}
      {isAdvanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="advance-form-title" className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="shrink-0 px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-amber-50/50">
              <div>
                <h3 id="advance-form-title" className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  {editingAdvance ? "Editar anticipo" : "Registrar Anticipo"}
                </h3>
                <span className="text-[11px] text-slate-500">
                  Abono por adelantado para cubrir 1 o varios meses a futuro
                </span>
              </div>
              <button aria-label="Cerrar"
                type="button"
                  disabled={savingAdvance}
                onClick={() => setIsAdvanceModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAdvance} className="min-h-0 overflow-y-auto p-5 space-y-3.5 text-xs">
              {editingAdvance && <div className="space-y-1 rounded-lg border border-blue-200 bg-blue-50 p-3 text-blue-900">
                <p>Disponible tras el ajuste <strong>${safeNumber(Math.max(0, advAmount - (editingAdvance.amount - editingAdvance.remaining)))}</strong></p>
                {lockAdvanceMoney && <p>Puedes corregir fecha y referencia del ingreso. El saldo tiene aplicaciones o devoluciones.</p>}
                {isEditingReleased && !lockAdvanceMoney && <p>El ajuste actualiza el cobro de origen y su saldo a favor.</p>}
              </div>}
              <div>
                <p className="text-[11px] font-bold text-slate-700 mb-1">Cliente *</p>
                {lockAdvanceClient ? <p className="ui-emphasis rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">{editingAdvance?.clientName}</p>
                  : <ClientSearchSelect clients={clients} value={advClientId} onChange={setAdvClientId} label="Cliente del anticipo" required />}
              </div>

              <div className={isEditingReleased ? "" : "grid grid-cols-2 gap-3"}>
                <div>
                  <label htmlFor="finance-dashboard-field-11" className="text-[11px] font-bold text-slate-700 block mb-1">
                    Monto Anticipado ($) *
                  </label>
                  <input id="finance-dashboard-field-11"
                    type="number"
                    step="0.01"
                    min={editingAdvance ? Math.max(0.01, editingAdvance.amount - editingAdvance.remaining, canReverseMoney ? 0 : editingAdvance.amount) : 0.01}
                    required
                    disabled={lockAdvanceMoney}
                    placeholder="Ej: 50.00"
                    value={advAmount || ""}
                    onChange={(e) => setAdvAmount(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-amber-700 focus:outline-hidden focus:border-amber-600"
                  />
                </div>

                {!isEditingReleased && <div>
                  <label htmlFor="finance-dashboard-field-12" className="text-[11px] font-bold text-slate-700 block mb-1">
                    Meses que Cubre *
                  </label>
                  <select id="finance-dashboard-field-12"
                    value={advMonths}
                    onChange={(e) => setAdvMonths(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-[#004ac6]"
                  >
                    <option value={1}>1 Mes</option>
                    <option value={2}>2 Meses</option>
                    <option value={3}>3 Meses (Trimestre)</option>
                    <option value={6}>6 Meses (Semestre)</option>
                    <option value={12}>12 Meses (Anual)</option>
                  </select>
                </div>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="finance-dashboard-field-13" className="text-[11px] font-bold text-slate-700 block mb-1">
                    {isEditingReleased ? "Fecha del ingreso original *" : "Fecha del Anticipo *"}
                  </label>
                  <input id="finance-dashboard-field-13"
                    type="date"
                    max={getEcuadorDate()}
                    required
                    value={advDate}
                    onChange={(e) => setAdvDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-[#004ac6]"
                  />
                </div>

                <div>
                  <label htmlFor="finance-dashboard-field-14" className="text-[11px] font-bold text-slate-700 block mb-1">
                    Forma de Pago
                  </label>
                  <select id="finance-dashboard-field-14"
                    value={advMethod}
                    disabled={lockAdvanceMoney}
                    onChange={(e) => setAdvMethod(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-[#004ac6]"
                  >
                    {[...new Set([advMethod, ...PAYMENT_METHODS.filter((m) => m !== "Saldo a Favor / Anticipo")])].filter(Boolean).map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="finance-dashboard-field-15" className="text-[11px] font-bold text-slate-700 block mb-1">
                    Cuenta / Banco Destino
                  </label>
                  <select id="finance-dashboard-field-15"
                    required
                    disabled={lockAdvanceMoney || Boolean(editingAdvance && !canReverseMoney)}
                    value={advBankId}
                    onChange={(e) => setAdvBankId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-[#004ac6]"
                  >
                    <option value="">Seleccionar banco o caja</option>
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bankName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="finance-dashboard-field-16" className="text-[11px] font-bold text-slate-700 block mb-1">
                    N.º de comprobante del pago
                  </label>
                  <input id="finance-dashboard-field-16"
                    type="text"
                    placeholder="Ej.: 00089102"
                    maxLength={200}
                    value={advReference}
                    onChange={(e) => setAdvReference(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:outline-hidden focus:border-[#004ac6]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="finance-dashboard-field-17" className="text-[11px] font-bold text-slate-700 block mb-1">
                  Notas / Observaciones
                </label>
                <input id="finance-dashboard-field-17"
                  type="text"
                  placeholder="Ej: Pago adelantado de internet meses Mayo y Junio..."
                  value={advNotes}
                  maxLength={500}
                  onChange={(e) => setAdvNotes(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-[#004ac6]"
                />
              </div>

              {editingAdvance && <label className="block font-semibold text-slate-700">Motivo del ajuste
                <textarea rows={2} required minLength={3} maxLength={500} value={advReason}
                  onChange={event => setAdvReason(event.target.value)} disabled={savingAdvance}
                  className="mt-1 block w-full rounded-lg border border-slate-300 p-2" />
              </label>}

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  disabled={savingAdvance}
                  onClick={() => setIsAdvanceModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingAdvance || Boolean(editingAdvance && advReason.trim().length < 3)}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold shadow-xs cursor-pointer transition"
                >
                  {savingAdvance ? "Guardando…" : editingAdvance ? "Guardar cambios" : "Guardar Pago Anticipado"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: APLICAR ANTICIPO A UN COMPROBANTE PENDIENTE */}
      {selectedAdvanceToApply && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-indigo-50/50">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  Aplicar Anticipo a Comprobante
                </h3>
                <span className="text-[11px] text-slate-500">
                  Cliente: <strong className="ui-emphasis">{selectedAdvanceToApply.clientName}</strong> — Saldo disponible:{" "}
                  <strong className="text-emerald-700 font-mono">${safeNumber(selectedAdvanceToApply.remaining)}</strong>
                </span>
              </div>
              <button aria-label="Cerrar"
                type="button"
                onClick={() => setSelectedAdvanceToApply(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteApplyAdvance} className="p-5 space-y-3.5 text-xs">
              <div>
                <label htmlFor="finance-dashboard-field-18" className="text-[11px] font-bold text-slate-700 block mb-1">
                  Comprobante a Saldar *
                </label>
                <select id="finance-dashboard-field-18"
                  required
                  value={targetChargeIdForAdvance}
                  onChange={(e) => {
                    const chgId = e.target.value;
                    setTargetChargeIdForAdvance(chgId);
                    const target = unifiedCharges.find((c) => c.id === chgId);
                    if (target) {
                      const bal =
                        target.balanceRemaining !== undefined
                          ? target.balanceRemaining
                          : target.status === "pagado"
                          ? 0
                          : target.total;
                      setAmountToApplyFromAdv(Math.min(selectedAdvanceToApply.remaining, bal));
                    }
                  }}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-indigo-600"
                >
                  <option value="">Seleccionar comprobante pendiente...</option>
                  {unifiedCharges
                    .filter((c) => c.clientId === selectedAdvanceToApply.clientId && c.status !== "pagado")
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.invoiceNumber} — Saldo: ${safeNumber(c.balanceRemaining ?? c.total)} ({c.serviceDescription})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label htmlFor="finance-dashboard-field-19" className="text-[11px] font-bold text-slate-700 block mb-1">
                  Monto a Aplicar ($) *
                </label>
                <input id="finance-dashboard-field-19"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedAdvanceToApply.remaining}
                  required
                  value={amountToApplyFromAdv || ""}
                  onChange={(e) => setAmountToApplyFromAdv(parseFloat(e.target.value) || 0)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-indigo-700 focus:outline-hidden focus:border-indigo-600"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setSelectedAdvanceToApply(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-xs cursor-pointer transition"
                >
                  Aplicar Anticipo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 7: REGISTRAR COBRO */}
      {isNewManualChargeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#004ac6]" />
                Registrar Cobro
              </h3>
              <button aria-label="Cerrar"
                type="button"
                onClick={() => setIsNewManualChargeOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateManualCharge} className="p-5 space-y-3.5 text-xs">
              <div>
                <p className="text-[11px] font-bold text-slate-700 mb-1">Cliente *</p>
                <ClientSearchSelect clients={clients} value={manualClientId} onChange={setManualClientId} label="Cliente del cargo" required />
              </div>

              <div>
                <label htmlFor="finance-dashboard-field-21" className="text-[11px] font-bold text-slate-700 block mb-1">
                  N° Comprobante / Referencia
                </label>
                <input id="finance-dashboard-field-21"
                  type="text"
                  placeholder="Ej: 001-001-00000045"
                  value={manualInvoiceNumber}
                  onChange={(e) => setManualInvoiceNumber(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:outline-hidden focus:border-[#004ac6]"
                />
              </div>

              <div>
                <label htmlFor="finance-dashboard-field-22" className="text-[11px] font-bold text-slate-700 block mb-1">
                  Concepto / Detalle del Cobro *
                </label>
                <input id="finance-dashboard-field-22"
                  type="text"
                  required
                  placeholder="Ej: Instalación de Fibra Óptica, Router Dual Band..."
                  value={manualDescription}
                  onChange={(e) => setManualDescription(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-[#004ac6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="finance-dashboard-field-23" className="text-[11px] font-bold text-slate-700 block mb-1">
                    Total a Cobrar ($) *
                  </label>
                  <input id="finance-dashboard-field-23"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={manualTotal || ""}
                    onChange={(e) => setManualTotal(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:border-[#004ac6]"
                  />
                </div>

                <div>
                  <label htmlFor="finance-dashboard-field-24" className="text-[11px] font-bold text-slate-700 block mb-1">
                    Fecha Vencimiento *
                  </label>
                  <input id="finance-dashboard-field-24"
                    type="date"
                    required
                    value={manualDueDate}
                    onChange={(e) => setManualDueDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-[#004ac6]"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsNewManualChargeOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg font-bold shadow-xs cursor-pointer transition"
                >
                  Generar Cobro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
