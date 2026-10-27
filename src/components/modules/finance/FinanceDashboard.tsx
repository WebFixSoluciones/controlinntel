"use client";

import React, { useState, useMemo } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { safeNumber, safeFloat } from "@/lib/print-service";
import {
  FileSpreadsheet,
  Plus,
  Search,
  Receipt,
  CreditCard,
  X,
  TrendingUp,
  Clock,
  History,
  Trash2,
  Edit2,
  Calendar,
  Sparkles,
  ArrowDownCircle,
  ArrowUpRight,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { generateBillingBatchExcel, triggerBrowserDownload } from "@/lib/doc-generator";
import { MonthlyCharge, ChargePayment, ClientAdvance } from "@/types";

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
  pago_proveedor: "Pago a Proveedor",
  transferencia_interna: "Transferencia entre Cuentas",
  ingreso_extraordinario: "Otros Ingresos",
  otro: "Otros Gastos",
};

export function formatFinanceCategory(cat?: string): string {
  if (!cat) return "General";
  return EXPENSE_CATEGORY_LABELS[cat] || cat.replace(/_/g, " ");
}

export function FinanceDashboard() {
  const {
    monthlyCharges,
    billingInvoices,
    clients,
    bankAccounts,
    clientAdvances,
    addMonthlyCharge,
    updateMonthlyCharge,
    deleteMonthlyCharge,
    addPaymentToCharge,
    addClientAdvance,
    applyClientAdvance,
    deleteClientAdvance,
  } = useApp();
  const { showSuccess, showError } = useToast();

  const [activeTab, setActiveTab] = useState<"comprobantes" | "anticipos">("comprobantes");

  // Filtros de Cobros
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [typeFilter, setTypeFilter] = useState("todos"); // "todos" | "nota_venta" | "factura"
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Modal Registrar Abono / Cobro
  const [payingCharge, setPayingCharge] = useState<MonthlyCharge | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);
  const [paymentBankId, setPaymentBankId] = useState<string>("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentNotes, setPaymentNotes] = useState("");

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
  const [advClientId, setAdvClientId] = useState("");
  const [advAmount, setAdvAmount] = useState<number>(0);
  const [advMonths, setAdvMonths] = useState<number>(1);
  const [advDate, setAdvDate] = useState(new Date().toISOString().slice(0, 10));
  const [advMethod, setAdvMethod] = useState(PAYMENT_METHODS[0]);
  const [advBankId, setAdvBankId] = useState("");
  const [advReference, setAdvReference] = useState("");
  const [advNotes, setAdvNotes] = useState("");

  // Modal Aplicar Anticipo existente a un cobro
  const [selectedAdvanceToApply, setSelectedAdvanceToApply] = useState<ClientAdvance | null>(null);
  const [targetChargeIdForAdvance, setTargetChargeIdForAdvance] = useState("");
  const [amountToApplyFromAdv, setAmountToApplyFromAdv] = useState<number>(0);

  // Modal Nuevo Cobro Manual Libre
  const [isNewManualChargeOpen, setIsNewManualChargeOpen] = useState(false);
  const [manualClientId, setManualClientId] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [manualTotal, setManualTotal] = useState<number>(0);
  const [manualInvoiceNumber, setManualInvoiceNumber] = useState("");
  const [manualDueDate, setManualDueDate] = useState(new Date().toISOString().slice(0, 10));

  // 1. Unificar todos los cobros (cargados en monthlyCharges + billingInvoices pendientes)
  const unifiedCharges = useMemo(() => {
    const list: MonthlyCharge[] = [...(monthlyCharges || [])];
    const registeredIdentifiers = new Set<string>();

    list.forEach((c) => {
      if (c.invoiceId) registeredIdentifiers.add(c.invoiceId);
      if (c.invoiceNumber) registeredIdentifiers.add(c.invoiceNumber.trim());
    });

    (billingInvoices || []).forEach((inv) => {
      if (inv.status === "borrador" || inv.status === "anulada") return;
      const docNumClean = (inv.documentNumber || "").trim();
      if (registeredIdentifiers.has(inv.id) || (docNumClean && registeredIdentifiers.has(docNumClean))) {
        return;
      }

      const breakdown = inv.paymentsBreakdown;
      const paidImmediate = breakdown
        ? Math.min(
            inv.total,
            (Number(breakdown.efectivo) || 0) +
              (Number(breakdown.transferencia) || 0) +
              (Number(breakdown.tarjeta) || 0)
          )
        : inv.paymentMethod !== "credito"
        ? inv.total
        : 0;

      const creditPart = breakdown
        ? Number(breakdown.credito) || 0
        : inv.paymentMethod === "credito"
        ? inv.total
        : 0;

      const balanceRemaining =
        creditPart > 0
          ? creditPart
          : inv.paymentMethod === "credito"
          ? inv.total
          : Math.max(0, Math.round((inv.total - paidImmediate) * 100) / 100);

      const chargeStatus: "pagado" | "parcial" | "pendiente" =
        balanceRemaining <= 0.009
          ? "pagado"
          : paidImmediate > 0
          ? "parcial"
          : "pendiente";

      const dateParts = (inv.date || "").split("-");
      list.push({
        id: `chg-inv-${inv.id}`,
        invoiceId: inv.id,
        invoiceNumber: inv.documentNumber,
        saleDate: inv.date,
        clientId: inv.clientId,
        clientName: inv.clientName,
        clientRuc: inv.clientRuc,
        month: parseInt(dateParts[1] || "1", 10),
        year: parseInt(dateParts[0] || "2026", 10),
        serviceDescription:
          inv.items?.map((i) => i.name).join(", ") ||
          (inv.documentType === "nota_venta" ? "Nota de Venta" : "Factura de Venta"),
        subtotal: (inv.subtotal15 || 0) + (inv.subtotal0 || 0),
        ivaAmount: inv.ivaTotal || 0,
        maxPaymentDate: inv.creditDueDate || inv.date,
        total: inv.total,
        paidAmount: paidImmediate,
        balanceRemaining,
        status: chargeStatus,
        paymentMethod: inv.paymentMethod,
        paymentDate: paidImmediate > 0 ? inv.date : undefined,
        notes: inv.notes,
      });
    });

    return list;
  }, [monthlyCharges, billingInvoices]);

  // Filtrado de Cobros
  const filteredCharges = useMemo(() => {
    return unifiedCharges.filter((c) => {
      if (!c) return false;
      const q = (searchQuery || "").toLowerCase().trim();
      const clientName = (c.clientName || "").toLowerCase();
      const clientRuc = String(c.clientRuc || "");
      const invoiceNumber = (c.invoiceNumber || "").toLowerCase();
      const serviceDescription = (c.serviceDescription || "").toLowerCase();

      const matchesSearch =
        !q ||
        clientName.includes(q) ||
        clientRuc.includes(q) ||
        invoiceNumber.includes(q) ||
        serviceDescription.includes(q);

      const matchesStatus = statusFilter === "todos" || c.status === statusFilter;

      let matchesType = true;
      if (typeFilter !== "todos") {
        const invMatch = (billingInvoices || []).find(
          (i) => i.id === c.invoiceId || i.documentNumber === c.invoiceNumber
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
  const totalBilled = filteredCharges.reduce((sum, c) => sum + (safeFloat(c.total) || 0), 0);
  const totalPaid = filteredCharges
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

  const handleExportBatch = async () => {
    if (filteredCharges.length === 0) {
      showError("Sin Registros", "No hay cobros con los filtros actuales para exportar.");
      return;
    }
    try {
      const blob = await generateBillingBatchExcel(filteredCharges);
      triggerBrowserDownload(blob, `Cobranzas_Comprobantes_${new Date().toISOString().split("T")[0]}.xlsx`);
      showSuccess("Excel Exportado", `Se descargaron ${filteredCharges.length} comprobantes de cobro.`);
    } catch {
      showError("Error", "No se pudo generar el archivo Excel.");
    }
  };

  const openPaymentModal = (charge: MonthlyCharge) => {
    setPayingCharge(charge);
    const balance =
      charge.balanceRemaining !== undefined
        ? charge.balanceRemaining
        : charge.status === "pagado"
        ? 0
        : charge.total;
    setPaymentAmount(Math.max(0, balance));
    setPaymentMethod(PAYMENT_METHODS[0]);
    setPaymentBankId(bankAccounts.find((b) => b.status === "activa")?.id || bankAccounts[0]?.id || "");
    setPaymentReference(`REF-${Date.now().toString().slice(-6)}`);
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentNotes("");
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingCharge) return;

    if (paymentAmount <= 0) {
      showError("Monto Inválido", "El valor del abono debe ser mayor a $0.00.");
      return;
    }

    try {
      await addPaymentToCharge(payingCharge.id, {
        amount: paymentAmount,
        method: paymentMethod,
        reference: paymentReference.trim() || undefined,
        bankAccountId: paymentBankId || undefined,
        date: paymentDate,
        notes: paymentNotes.trim() || undefined,
      });

      showSuccess(
        "Abono Registrado",
        `Se registró abono de $${paymentAmount.toFixed(2)} al comprobante ${payingCharge.invoiceNumber}.`
      );
      setPayingCharge(null);
    } catch (error) {
      showError("Error", error instanceof Error ? error.message : "No se pudo registrar el cobro.");
    }
  };

  const handleApplyAdvanceDirectly = async (adv: ClientAdvance, charge: MonthlyCharge) => {
    const chargeBalance =
      charge.balanceRemaining !== undefined
        ? charge.balanceRemaining
        : charge.status === "pagado"
        ? 0
        : charge.total;
    const amountToApply = Math.min(adv.remaining, chargeBalance);
    if (amountToApply <= 0) {
      showError("Sin saldo", "El comprobante ya no tiene saldo pendiente o el anticipo está agotado.");
      return;
    }

    try {
      await applyClientAdvance(adv.id, charge.id, amountToApply);
      showSuccess(
        "Anticipo Aplicado",
        `Se aplicaron $${amountToApply.toFixed(2)} del saldo a favor de ${adv.clientName} al comprobante ${charge.invoiceNumber}.`
      );
      setPayingCharge(null);
    } catch (error) {
      showError("Error", error instanceof Error ? error.message : "No se pudo aplicar el anticipo.");
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
      await deleteMonthlyCharge(deletingCharge.id);
      showSuccess("Cobro Eliminado", `Se eliminó el cobro del comprobante ${deletingCharge.invoiceNumber}.`);
      setDeletingCharge(null);
    } catch (error) {
      showError("Error", error instanceof Error ? error.message : "No se pudo eliminar el cobro.");
    }
  };

  const handleCreateAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!advClientId) {
      showError("Cliente Requerido", "Selecciona el cliente que realiza el pago anticipado.");
      return;
    }
    if (advAmount <= 0) {
      showError("Monto Inválido", "El monto del pago anticipado debe ser mayor a $0.00.");
      return;
    }

    const clientObj = clients.find((c) => c.id === advClientId);
    if (!clientObj) return;

    try {
      await addClientAdvance({
        clientId: clientObj.id,
        clientName: clientObj.businessName || "Cliente",
        clientRuc: clientObj.identificationNumber || "",
        date: advDate,
        amount: advAmount,
        monthsCovered: Number(advMonths) || 1,
        method: advMethod,
        reference: advReference.trim() || undefined,
        bankAccountId: advBankId || undefined,
        bankAccountName: advBankId ? bankAccounts.find((b) => b.id === advBankId)?.bankName : undefined,
        notes: advNotes.trim() || undefined,
      });

      showSuccess(
        "Pago Anticipado Registrado",
        `Se registraron $${advAmount.toFixed(2)} (${advMonths} meses) a favor de ${clientObj.businessName}.`
      );
      setIsAdvanceModalOpen(false);
      setAdvClientId("");
      setAdvAmount(0);
      setAdvReference("");
      setAdvNotes("");
    } catch (error) {
      showError("Error", error instanceof Error ? error.message : "No se pudo registrar el anticipo.");
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

    const today = new Date().toISOString().slice(0, 10);
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
    <div className="w-full space-y-6">
      {/* Encabezado Principal & Acciones */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-[#0b1c30] tracking-tight flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#004ac6]" />
            Control de Cobros
          </h2>
          <p className="text-xs text-[#737686] mt-0.5">
            Seguimiento de cobranzas, registro de abonos parciales y pagos anticipados.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setAdvDate(new Date().toISOString().slice(0, 10));
              setAdvBankId(bankAccounts.find((b) => b.status === "activa")?.id || bankAccounts[0]?.id || "");
              setIsAdvanceModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>Registrar Pago Anticipado</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setManualDueDate(new Date().toISOString().slice(0, 10));
              setIsNewManualChargeOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Cobro Manual</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white border border-[#e2e8f0] shadow-2xs">
          <span className="text-[11px] font-bold text-[#737686] uppercase tracking-wider block">
            Total Facturado / Emitido
          </span>
          <span className="text-2xl font-black text-[#0b1c30] mt-1 block font-mono">
            ${safeNumber(totalBilled)} USD
          </span>
          <span className="text-[11px] text-[#737686]">{filteredCharges.length} comprobantes en cartera</span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-[#e2e8f0] shadow-2xs">
          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block flex items-center gap-1">
            <ArrowDownCircle className="w-3.5 h-3.5 text-emerald-600" />
            Total Recaudado / Cobrado
          </span>
          <span className="text-2xl font-black text-emerald-600 mt-1 block font-mono">
            ${safeNumber(totalPaid)} USD
          </span>
          <span className="text-[11px] text-emerald-700/80">Cobros efectivos y abonos asentados</span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-[#e2e8f0] shadow-2xs">
          <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Cartera Pendiente / Saldo
          </span>
          <span className="text-2xl font-black text-amber-600 mt-1 block font-mono">
            ${safeNumber(totalPending)} USD
          </span>
          <span className="text-[11px] text-amber-700/80">Por cobrar a clientes a crédito/plazo</span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-[#e2e8f0] shadow-2xs">
          <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider block flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            Anticipos / Saldo a Favor
          </span>
          <span className="text-2xl font-black text-indigo-600 mt-1 block font-mono">
            ${safeNumber(totalAdvancesAvailable)} USD
          </span>
          <span className="text-[11px] text-indigo-700/80">
            {(clientAdvances || []).filter((a) => a.status === "vigente" && a.remaining > 0).length} clientes con anticipos vigentes
          </span>
        </div>
      </div>

      {/* Tabs Principales de la Vista */}
      <div className="flex items-center gap-2 border-b border-[#e2e8f0]">
        <button
          type="button"
          onClick={() => setActiveTab("comprobantes")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "comprobantes"
              ? "border-[#004ac6] text-[#004ac6] bg-blue-50/50"
              : "border-transparent text-[#737686] hover:text-[#0b1c30]"
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Cobros por Comprobante ({filteredCharges.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("anticipos")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "anticipos"
              ? "border-amber-600 text-amber-700 bg-amber-50/50"
              : "border-transparent text-[#737686] hover:text-[#0b1c30]"
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-600" />
          <span>Anticipos de Clientes ({(clientAdvances || []).length})</span>
          {totalAdvancesAvailable > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
              ${safeNumber(totalAdvancesAvailable)}
            </span>
          )}
        </button>
      </div>

      {/* VISTA 1: COBROS POR COMPROBANTE DE VENTA */}
      {activeTab === "comprobantes" && (
        <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
          {/* Barra de Filtros */}
          <div className="p-3.5 border-b border-[#e2e8f0] flex flex-wrap items-center justify-between gap-3 text-xs bg-[#fcfdff]">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <div className="relative min-w-[240px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar Nro Comprobante, cliente o RUC..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#f8f9ff] text-xs text-slate-900 rounded-lg pl-8 pr-3 py-1.5 border border-[#e2e8f0] focus:bg-white focus:outline-hidden focus:border-[#004ac6]"
                />
              </div>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-[#e2e8f0] text-xs font-semibold text-slate-700 bg-[#f8f9ff] focus:bg-white focus:outline-hidden focus:border-[#004ac6]"
              >
                <option value="todos">Todos los Comprobantes</option>
                <option value="nota_venta">Notas de Venta</option>
                <option value="factura">Facturas SRI</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-[#e2e8f0] text-xs font-semibold text-slate-700 bg-[#f8f9ff] focus:bg-white focus:outline-hidden focus:border-[#004ac6]"
              >
                <option value="todos">Todos los Estados</option>
                <option value="pendiente">Pendientes</option>
                <option value="parcial">Abono Parcial</option>
                <option value="pagado">Pagados</option>
              </select>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-500">Desde:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-2 py-1.5 rounded-lg border border-[#e2e8f0] text-xs text-slate-800 bg-[#f8f9ff] focus:bg-white focus:outline-hidden focus:border-[#004ac6]"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-500">Hasta:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-2 py-1.5 rounded-lg border border-[#e2e8f0] text-xs text-slate-800 bg-[#f8f9ff] focus:bg-white focus:outline-hidden focus:border-[#004ac6]"
                />
              </div>

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
                  className="text-xs text-[#004ac6] hover:underline font-bold cursor-pointer"
                >
                  Limpiar filtros
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleExportBatch}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-[#e2e8f0] rounded-lg text-xs font-bold transition cursor-pointer shadow-2xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Exportar Excel</span>
            </button>
          </div>

          {/* Tabla de Cobros */}
          <div className="overflow-x-auto">
            <table className="table-fixed w-full text-left text-xs border-collapse">
              <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-xs uppercase tracking-wider border-b border-[#e2e8f0]">
                <tr>
                  <th className="w-[18%] py-3 px-4">Comprobante</th>
                  <th className="w-[10%] py-3 px-3">Fecha Venta</th>
                  <th className="w-[24%] py-3 px-4">Cliente / RUC</th>
                  <th className="w-[10%] py-3 px-3 text-right">Total Venta</th>
                  <th className="w-[10%] py-3 px-3 text-right">Abonado</th>
                  <th className="w-[10%] py-3 px-3 text-right">Saldo Pend.</th>
                  <th className="w-[9%] py-3 px-3 text-center">Estado</th>
                  <th className="w-[9%] py-3 px-3 text-right">Acciones</th>
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
                  filteredCharges.map((charge) => {
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
                      (i) => i.id === charge.invoiceId || i.documentNumber === charge.invoiceNumber
                    );
                    const isNotaVenta = invMatch ? invMatch.documentType === "nota_venta" : charge.invoiceNumber.startsWith("001-001");

                    // Anticipos disponibles para este cliente
                    const clientAdvancesList = clientAdvancesMap.get(charge.clientId) || [];
                    const clientAdvanceSum = clientAdvancesList.reduce((sum, a) => sum + a.remaining, 0);

                    return (
                      <tr key={charge.id} className="hover:bg-[#f8f9ff] transition-colors">
                        {/* Comprobante */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-slate-900 block">
                              {charge.invoiceNumber || "S/N"}
                            </span>
                            <span
                              className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-sm border ${
                                isNotaVenta
                                  ? "bg-purple-50 text-purple-700 border-purple-200"
                                  : "bg-blue-50 text-blue-700 border-blue-200"
                              }`}
                            >
                              {isNotaVenta ? "Nota Venta" : "Factura SRI"}
                            </span>
                          </div>
                          {charge.serviceDescription && (
                            <span className="text-[10px] text-slate-500 truncate block mt-0.5 max-w-[220px]" title={charge.serviceDescription}>
                              {charge.serviceDescription}
                            </span>
                          )}
                        </td>

                        {/* Fecha Venta */}
                        <td className="py-3 px-3 font-mono text-slate-600">
                          {charge.saleDate || charge.paymentDate || `${charge.year || 2026}-${String(charge.month || 1).padStart(2, "0")}-01`}
                        </td>

                        {/* Cliente / RUC */}
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 block truncate" title={charge.clientName}>
                            {charge.clientName}
                          </span>
                          <span className="text-[11px] font-mono text-slate-500">
                            {charge.clientRuc || "Consumidor Final"}
                          </span>
                          {clientAdvanceSum > 0 && !isPaid && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-indigo-700 font-bold bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded mt-0.5">
                              <Sparkles className="w-2.5 h-2.5" />
                              Favor: ${safeNumber(clientAdvanceSum)}
                            </span>
                          )}
                        </td>

                        {/* Total Venta */}
                        <td className="py-3 px-3 text-right font-mono text-slate-700 font-semibold">
                          ${safeNumber(charge.total)}
                        </td>

                        {/* Abonado */}
                        <td className="py-3 px-3 text-right font-mono text-emerald-700 font-semibold">
                          ${safeNumber(paid)}
                        </td>

                        {/* Saldo Pendiente */}
                        <td className="py-3 px-3 text-right font-mono font-bold">
                          <span className={balance > 0 ? "text-amber-700" : "text-slate-400"}>
                            ${safeNumber(balance)}
                          </span>
                        </td>

                        {/* Estado */}
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase border ${
                              isPaid
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : isPartial
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}
                          >
                            {isPaid ? "Pagado" : isPartial ? "Parcial" : "Pendiente"}
                          </span>
                        </td>

                        {/* Acciones */}
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {!isPaid && (
                              <button
                                type="button"
                                title="Registrar Cobro / Abono"
                                onClick={() => openPaymentModal(charge)}
                                className="p-1.5 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-md transition cursor-pointer shadow-xs"
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {(charge.payments && charge.payments.length > 0) && (
                              <button
                                type="button"
                                title="Ver Historial de Abonos"
                                onClick={() => setHistoryCharge(charge)}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition cursor-pointer"
                              >
                                <History className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              type="button"
                              title="Editar Cobro"
                              onClick={() => {
                                setEditingCharge(charge);
                                setEditDueDate(charge.maxPaymentDate || "");
                                setEditNotes(charge.notes || "");
                              }}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              title="Eliminar Cobro"
                              onClick={() => setDeletingCharge(charge)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-md transition cursor-pointer"
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
      )}

      {/* VISTA 2: ANTICIPOS DE CLIENTES */}
      {activeTab === "anticipos" && (
        <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-[#e2e8f0] flex flex-wrap items-center justify-between gap-3 bg-[#fcfdff]">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600" />
                Historial de Pagos Anticipados & Saldos a Favor
              </h3>
              <p className="text-[11px] text-slate-500">
                Pagos adelantados por 1, 2 o más meses para cubrir comprobantes presentes y futuros.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setAdvDate(new Date().toISOString().slice(0, 10));
                setAdvBankId(bankAccounts.find((b) => b.status === "activa")?.id || bankAccounts[0]?.id || "");
                setIsAdvanceModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Registrar Anticipo</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="table-fixed w-full text-left text-xs border-collapse">
              <thead className="bg-[#f8f9ff] text-amber-800 font-bold text-xs uppercase tracking-wider border-b border-[#e2e8f0]">
                <tr>
                  <th className="w-2/12 py-3 px-4">Fecha Anticipo</th>
                  <th className="w-3/12 py-3 px-4">Cliente / RUC</th>
                  <th className="w-1/12 py-3 px-3 text-center">Meses</th>
                  <th className="w-1/12 py-3 px-3 text-right">Monto Inicial</th>
                  <th className="w-1/12 py-3 px-3 text-right">Saldo Disponible</th>
                  <th className="w-2/12 py-3 px-3">Método / Banco</th>
                  <th className="w-1/12 py-3 px-3 text-center">Estado</th>
                  <th className="w-1/12 py-3 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {(clientAdvances || []).length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No hay pagos anticipados registrados hasta el momento.
                    </td>
                  </tr>
                ) : (
                  (clientAdvances || []).map((adv) => {
                    const isAvailable = adv.status === "vigente" && adv.remaining > 0;
                    return (
                      <tr key={adv.id} className="hover:bg-[#f8f9ff] transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-600">{adv.date}</td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 block truncate">{adv.clientName}</span>
                          <span className="text-[11px] font-mono text-slate-500">{adv.clientRuc}</span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            {adv.monthsCovered} mes(es)
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-semibold text-slate-700">
                          ${safeNumber(adv.amount)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold">
                          <span className={adv.remaining > 0 ? "text-emerald-700" : "text-slate-400"}>
                            ${safeNumber(adv.remaining)}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-slate-800 block truncate">{adv.method}</span>
                          {adv.bankAccountName && (
                            <span className="text-[10px] text-slate-500 block truncate">{adv.bankAccountName}</span>
                          )}
                          {adv.reference && (
                            <span className="text-[10px] text-slate-400 font-mono block truncate">Ref: {adv.reference}</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase border ${
                              isAvailable
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-slate-100 text-slate-600 border-slate-200"
                            }`}
                          >
                            {isAvailable ? "Disponible" : "Aplicado"}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isAvailable && (
                              <button
                                type="button"
                                title="Aplicar este anticipo a un cobro"
                                onClick={() => {
                                  setSelectedAdvanceToApply(adv);
                                  setAmountToApplyFromAdv(adv.remaining);
                                  setTargetChargeIdForAdvance("");
                                }}
                                className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-bold transition cursor-pointer"
                              >
                                Aplicar
                              </button>
                            )}

                            {(!adv.applications || adv.applications.length === 0) && (
                              <button
                                type="button"
                                title="Eliminar anticipo sin usar"
                                onClick={async () => {
                                  if (confirm(`¿Eliminar anticipo de $${adv.amount} de ${adv.clientName}?`)) {
                                    try {
                                      await deleteClientAdvance(adv.id);
                                      showSuccess("Anticipo Eliminado", "Se eliminó el pago anticipado.");
                                    } catch (err) {
                                      showError("Error", err instanceof Error ? err.message : "No se pudo eliminar.");
                                    }
                                  }
                                }}
                                className="p-1 text-rose-500 hover:text-rose-700 rounded transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
        </div>
      )}

      {/* MODAL 1: REGISTRAR ABONO / COBRO A COMPROBANTE */}
      {payingCharge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#004ac6]" />
                  Abonar al Comprobante: {payingCharge.invoiceNumber}
                </h3>
                <span className="text-[11px] text-slate-500">
                  Cliente: <strong className="text-slate-800">{payingCharge.clientName}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPayingCharge(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Aviso de Saldo a Favor por Anticipos si el cliente tiene */}
            {(() => {
              const clientAdvancesList = clientAdvancesMap.get(payingCharge.clientId) || [];
              const availableAdvance = clientAdvancesList[0];
              if (!availableAdvance) return null;
              return (
                <div className="m-5 mb-0 p-3 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                    <div>
                      <span className="font-bold text-indigo-900 block">
                        Cliente tiene anticipo disponible: ${safeNumber(availableAdvance.remaining)} USD
                      </span>
                      <span className="text-[11px] text-indigo-700">
                        ¿Deseas saldar este comprobante usando el saldo a favor?
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleApplyAdvanceDirectly(availableAdvance, payingCharge)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-bold text-[11px] whitespace-nowrap cursor-pointer transition"
                  >
                    Aplicar Saldo
                  </button>
                </div>
              );
            })()}

            <form onSubmit={handleConfirmPayment} className="p-5 space-y-3.5 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-500 block">Total Comprobante</span>
                  <span className="text-sm font-mono font-bold text-slate-800">${safeNumber(payingCharge.total)}</span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-500 block">Saldo Pendiente</span>
                  <span className="text-sm font-mono font-bold text-amber-700">
                    ${safeNumber(
                      payingCharge.balanceRemaining !== undefined
                        ? payingCharge.balanceRemaining
                        : payingCharge.status === "pagado"
                        ? 0
                        : payingCharge.total
                    )}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Monto a Abonar ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={
                      payingCharge.balanceRemaining !== undefined
                        ? payingCharge.balanceRemaining
                        : payingCharge.total
                    }
                    required
                    value={paymentAmount || ""}
                    onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-emerald-700 focus:outline-hidden focus:border-[#004ac6]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Fecha del Abono *
                  </label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-[#004ac6]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Forma de Pago
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-[#004ac6]"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Cuenta / Banco Destino
                  </label>
                  <select
                    value={paymentBankId}
                    onChange={(e) => setPaymentBankId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-[#004ac6]"
                  >
                    <option value="">Seleccionar cuenta...</option>
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bankName} ({b.accountNumber})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  N° Referencia / Comprobante Bancario
                </label>
                <input
                  type="text"
                  placeholder="Ej: Depósito #491029 / Transf. Pichincha"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:outline-hidden focus:border-[#004ac6]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Observaciones / Notas del Cobro
                </label>
                <input
                  type="text"
                  placeholder="Detalle adicional del pago o abono..."
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-[#004ac6]"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setPayingCharge(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg font-bold shadow-xs cursor-pointer transition"
                >
                  Confirmar y Guardar Abono
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                  Cliente: <strong className="text-slate-800">{historyCharge.clientName}</strong>
                </span>
              </div>
              <button
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
                        <span className="font-mono font-bold text-emerald-700 text-sm block">
                          +${safeNumber(p.amount)}
                        </span>
                        <span className="text-[10px] text-slate-400">Abonado</span>
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
              <button
                type="button"
                onClick={() => setEditingCharge(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditCharge} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Cliente</label>
                <input
                  type="text"
                  disabled
                  value={editingCharge.clientName}
                  className="w-full bg-slate-100 border border-slate-300 rounded-lg px-3 py-2 text-slate-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Fecha Límite / Vencimiento
                </label>
                <input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-hidden focus:border-[#004ac6]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Observaciones / Notas
                </label>
                <textarea
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
              <h3 className="font-bold text-slate-900 text-sm">¿Eliminar este cobro comercial?</h3>
              <p className="text-xs text-slate-600">
                Se removerá el cobro asociado al comprobante <strong>{deletingCharge.invoiceNumber}</strong> por un total de <strong>${safeNumber(deletingCharge.total)}</strong>.
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
                Sí, Eliminar Cobro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: REGISTRAR PAGO ANTICIPADO */}
      {isAdvanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-amber-50/50">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  Registrar Pago Anticipado de Cliente
                </h3>
                <span className="text-[11px] text-slate-500">
                  Abono por adelantado para cubrir 1 o varios meses a futuro
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsAdvanceModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAdvance} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Cliente *
                </label>
                <select
                  required
                  value={advClientId}
                  onChange={(e) => setAdvClientId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-[#004ac6]"
                >
                  <option value="">Seleccionar cliente...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.businessName} ({c.identificationNumber || "S/RUC"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Monto Anticipado ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="Ej: 50.00"
                    value={advAmount || ""}
                    onChange={(e) => setAdvAmount(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-amber-700 focus:outline-hidden focus:border-amber-600"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Meses que Cubre *
                  </label>
                  <select
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
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Fecha del Anticipo *
                  </label>
                  <input
                    type="date"
                    required
                    value={advDate}
                    onChange={(e) => setAdvDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-[#004ac6]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Forma de Pago
                  </label>
                  <select
                    value={advMethod}
                    onChange={(e) => setAdvMethod(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-[#004ac6]"
                  >
                    {PAYMENT_METHODS.filter((m) => m !== "Saldo a Favor / Anticipo").map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Cuenta / Banco Destino
                  </label>
                  <select
                    value={advBankId}
                    onChange={(e) => setAdvBankId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-[#004ac6]"
                  >
                    <option value="">Caja / Efectivo libre</option>
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bankName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    N° Referencia
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Transf. 89102"
                    value={advReference}
                    onChange={(e) => setAdvReference(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:outline-hidden focus:border-[#004ac6]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Notas / Observaciones
                </label>
                <input
                  type="text"
                  placeholder="Ej: Pago adelantado de internet meses Mayo y Junio..."
                  value={advNotes}
                  onChange={(e) => setAdvNotes(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-[#004ac6]"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAdvanceModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold shadow-xs cursor-pointer transition"
                >
                  Guardar Pago Anticipado
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
                  Cliente: <strong>{selectedAdvanceToApply.clientName}</strong> — Saldo disponible:{" "}
                  <strong className="text-emerald-700 font-mono">${safeNumber(selectedAdvanceToApply.remaining)}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAdvanceToApply(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteApplyAdvance} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Comprobante a Saldar *
                </label>
                <select
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
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Monto a Aplicar ($) *
                </label>
                <input
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

      {/* MODAL 7: NUEVO COBRO MANUAL */}
      {isNewManualChargeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#004ac6]" />
                Registrar Cobro Manual
              </h3>
              <button
                type="button"
                onClick={() => setIsNewManualChargeOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateManualCharge} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Cliente *</label>
                <select
                  required
                  value={manualClientId}
                  onChange={(e) => setManualClientId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-[#004ac6]"
                >
                  <option value="">Seleccionar cliente...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.businessName} ({c.identificationNumber || "S/RUC"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  N° Comprobante / Referencia
                </label>
                <input
                  type="text"
                  placeholder="Ej: 001-001-00000045"
                  value={manualInvoiceNumber}
                  onChange={(e) => setManualInvoiceNumber(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:outline-hidden focus:border-[#004ac6]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Concepto / Detalle del Cobro *
                </label>
                <input
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
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Total a Cobrar ($) *
                  </label>
                  <input
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
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Fecha Vencimiento *
                  </label>
                  <input
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
