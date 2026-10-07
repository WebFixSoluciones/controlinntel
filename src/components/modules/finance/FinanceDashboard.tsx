"use client";

import React, { useState, useMemo, useRef } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import {
  DollarSign,
  FileSpreadsheet,
  Plus,
  CheckCircle2,
  Calendar,
  Search,
  Receipt,
  CreditCard,
  X,
  FileText,
  Trash2,
  Upload,
  Percent,
  TrendingUp,
  Tag,
  Building,
} from "lucide-react";
import { generateBillingBatchExcel, triggerBrowserDownload } from "@/lib/doc-generator";
import { MonthlyCharge, Expense } from "@/types";

interface FinanceDashboardProps {
  onOpenNewExpense?: () => void;
}

const DEFAULT_PAYMENT_METHODS = [
  "Transferencia Bancaria",
  "Depósito Banco Pichincha",
  "Depósito Banco Guayaquil",
  "Efectivo Dalmau",
  "Efectivo Equinoccio",
  "Cheque",
  "Tarjeta de Crédito / Débito",
];

const DEFAULT_EXPENSE_CATEGORIES = [
  { id: "enlace_transito", label: "Tránsito IP & Conectividad" },
  { id: "alquiler_nodo", label: "Infraestructura & Alquiler de Nodos" },
  { id: "fibra_equipos", label: "Fibra, Equipos & Ferretería" },
  { id: "mantenimiento", label: "Mantenimiento & Cuadrillas" },
  { id: "seguros", label: "Pólizas & Seguros" },
  { id: "otro", label: "Gastos Generales / Administrativos" },
];

export function FinanceDashboard({ onOpenNewExpense }: FinanceDashboardProps) {
  const {
    monthlyCharges,
    markChargeAsPaid,
    addMonthlyCharge,
    generateMonthlyBillingBatch,
    clients,
    clientServices,
    expenses,
    addExpense,
    currentUser,
  } = useApp();
  const { showSuccess, showError, showConfirm } = useToast();

  // Vista activa principal: Ingresos/Facturas vs Gastos OPEX
  const [activeFinanceTab, setActiveFinanceTab] = useState<"ingresos" | "gastos">("ingresos");

  // Filtros de Ingresos
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Filtros de Gastos
  const [expenseSearchQuery, setExpenseSearchQuery] = useState("");
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState("todas");
  const [expenseStartDate, setExpenseStartDate] = useState("");
  const [expenseEndDate, setExpenseEndDate] = useState("");

  // Categorías de Gastos dinámicas
  const [expenseCategories, setExpenseCategories] = useState(DEFAULT_EXPENSE_CATEGORIES);
  const [newCatName, setNewCatName] = useState("");
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  // Formas de pago dinámicas
  const [paymentMethods, setPaymentMethods] = useState<string[]>(DEFAULT_PAYMENT_METHODS);
  const [newPaymentMethod, setNewPaymentMethod] = useState("");
  const [isAddingPaymentMethod, setIsAddingPaymentMethod] = useState(false);

  // Modal Registrar Pago (idéntico a imagen del usuario)
  const [payingCharge, setPayingCharge] = useState<MonthlyCharge | null>(null);
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentDueDate, setPaymentDueDate] = useState("");
  const [printOption, setPrintOption] = useState<"nada" | "ticket" | "factura">("nada");
  const [paymentMethod, setPaymentMethod] = useState(DEFAULT_PAYMENT_METHODS[0]);
  const [paymentAction, setPaymentAction] = useState<string>("marcar_pagado");
  const [paymentReference, setPaymentReference] = useState("");
  const [totalToPay, setTotalToPay] = useState<number>(0);
  const [voucherFileName, setVoucherFileName] = useState<string>("");
  const voucherInputRef = useRef<HTMLInputElement>(null);

  // Modal Factura Manual / Ocasional
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualClientSearch, setManualClientSearch] = useState("");
  const [manualClientId, setManualClientId] = useState(clients[0]?.id || "");
  const [manualConcept, setManualConcept] = useState("");
  const [manualAmount, setManualAmount] = useState<number>(35);
  const [manualMaxDate, setManualMaxDate] = useState(
    new Date(Date.now() + 86400000 * 10).toISOString().split("T")[0]
  );

  // Modal Nuevo Gasto OPEX
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expSupplier, setExpSupplier] = useState("");
  const [expAmount, setExpAmount] = useState<number>(100);
  const [expCategory, setExpCategory] = useState<string>("enlace_transito");
  const [expDescription, setExpDescription] = useState("");
  const [expMethod, setExpMethod] = useState<"transferencia" | "tarjeta_credito" | "efectivo">("transferencia");

  // Filtrado de Cobros / Ingresos
  const filteredCharges = useMemo(() => {
    return monthlyCharges.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        c.clientName.toLowerCase().includes(q) ||
        c.clientRuc.includes(q) ||
        c.invoiceNumber.toLowerCase().includes(q) ||
        c.serviceDescription.toLowerCase().includes(q);

      const matchesStatus = statusFilter === "todos" || c.status === statusFilter;

      let matchesDate = true;
      const chargeDate = c.paymentDate || `${c.year}-${String(c.month).padStart(2, "0")}-01`;
      if (startDate && chargeDate < startDate) matchesDate = false;
      if (endDate && chargeDate > endDate) matchesDate = false;

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [monthlyCharges, searchQuery, statusFilter, startDate, endDate]);

  // Filtrado de Gastos OPEX
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const q = expenseSearchQuery.toLowerCase().trim();
      const matchesText =
        !q ||
        e.supplierName.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q);

      const matchesCat =
        expenseCategoryFilter === "todas" || e.category === expenseCategoryFilter;

      let matchesDate = true;
      if (expenseStartDate && e.expenseDate < expenseStartDate) matchesDate = false;
      if (expenseEndDate && e.expenseDate > expenseEndDate) matchesDate = false;

      return matchesText && matchesCat && matchesDate;
    });
  }, [expenses, expenseSearchQuery, expenseCategoryFilter, expenseStartDate, expenseEndDate]);

  // KPIs Financieros Consolidados
  const totalBilled = filteredCharges.reduce((sum, c) => sum + c.total, 0);
  const totalPaid = filteredCharges
    .filter((c) => c.status === "pagado")
    .reduce((sum, c) => sum + (c.paidAmount ?? c.total), 0);
  const totalPending = totalBilled - totalPaid;

  const totalOpex = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  // UTILIDAD NETA DEL MES (Requerimiento Maestro del usuario)
  const utilidadNetaMes = totalPaid - totalOpex;
  const margenUtilidad = totalPaid > 0 ? (utilidadNetaMes / totalPaid) * 100 : 0;

  // Manejo de Métodos de Pago dinámicos
  const handleAddPaymentMethod = () => {
    if (!newPaymentMethod.trim()) return;
    if (!paymentMethods.includes(newPaymentMethod.trim())) {
      setPaymentMethods([...paymentMethods, newPaymentMethod.trim()]);
      setPaymentMethod(newPaymentMethod.trim());
      showSuccess("Forma de Pago Agregada", `Se agregó "${newPaymentMethod.trim()}".`);
    }
    setNewPaymentMethod("");
    setIsAddingPaymentMethod(false);
  };

  // Manejo de Categorías de Gastos dinámicas
  const handleAddExpenseCategory = () => {
    if (!newCatName.trim()) return;
    const catId = newCatName.trim().toLowerCase().replace(/\s+/g, "_");
    setExpenseCategories([...expenseCategories, { id: catId, label: newCatName.trim() }]);
    setExpCategory(catId);
    showSuccess("Categoría Creada", `Nueva categoría de gastos "${newCatName.trim()}" disponible.`);
    setNewCatName("");
    setIsAddingCategory(false);
  };

  const handleExportBatch = async () => {
    if (filteredCharges.length === 0) {
      showError("Sin Registros", "No hay comprobantes que coincidan con los filtros para exportar.");
      return;
    }
    try {
      const blob = await generateBillingBatchExcel(filteredCharges);
      triggerBrowserDownload(blob, `Cobranzas_INNTEL_${new Date().toISOString().split("T")[0]}.xlsx`);
      showSuccess("Lote Exportado", `Archivo Excel con ${filteredCharges.length} registros generado exitosamente.`);
    } catch {
      showError("Error de Exportación", "Ocurrió un problema al construir el archivo Excel.");
    }
  };

  const handleGenerateBatch = () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    showConfirm(
      "¿Emitir Cobros / Órdenes del Día 1?",
      `Se generarán las órdenes de facturación para ${clients.length} clientes registrados para el periodo ${month}/${year}. ¿Continuar?`,
      async () => {
        try {
          await generateMonthlyBillingBatch(month, year);
          showSuccess("Lote Emitido", `Cobros del Día 1 generados para ${clients.length} clientes.`);
        } catch (error) {
          window.dispatchEvent(
            new CustomEvent("inntel:error", {
              detail: error instanceof Error ? error.message : "No se pudo emitir el lote.",
            })
          );
        }
      },
      "Generar Lote"
    );
  };

  // Abrir Modal de Pago
  const openPaymentModal = (charge: MonthlyCharge) => {
    setPayingCharge(charge);
    const now = new Date();
    const formattedNow = `${now.toISOString().slice(0, 10)} ${now.toTimeString().slice(0, 5)}`;
    setPaymentDate(formattedNow);
    setPaymentDueDate(charge.maxPaymentDate || now.toISOString().slice(0, 10));
    setPrintOption("nada");
    setPaymentMethod(paymentMethods[0]);
    setPaymentAction("marcar_pagado");
    setPaymentReference(`DEP-${Date.now().toString().slice(-6)}`);
    setTotalToPay(charge.balanceRemaining !== undefined ? charge.balanceRemaining : charge.total);
    setVoucherFileName("");
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingCharge) return;

    if (!paymentReference.trim()) {
      showError("Referencia Requerida", "Ingresa el número de comprobante, depósito o voucher.");
      return;
    }

    if (totalToPay <= 0) {
      showError("Valor Inválido", "El valor a pagar debe ser mayor a 0.");
      return;
    }

    const currentTotal = payingCharge.balanceRemaining !== undefined ? payingCharge.balanceRemaining : payingCharge.total;
    const isPartialAbono = totalToPay < currentTotal;

    try {
      if (isPartialAbono) {
        const remaining = parseFloat((currentTotal - totalToPay).toFixed(2));
        await markChargeAsPaid(payingCharge.id, paymentMethod, paymentReference, totalToPay, remaining);
        showSuccess(
          "Abono Registrado",
          `Abono de $${totalToPay.toFixed(2)} USD registrado. Saldo pendiente: $${remaining.toFixed(2)} USD.`
        );
      } else {
        await markChargeAsPaid(payingCharge.id, paymentMethod, paymentReference, totalToPay, 0);
        showSuccess(
          "Pago Completo Registrado",
          `Factura #${payingCharge.invoiceNumber} por $${totalToPay.toFixed(2)} USD pagada vía ${paymentMethod}.`
        );
      }
      setPayingCharge(null);
    } catch (error) {
      window.dispatchEvent(
        new CustomEvent("inntel:error", {
          detail: error instanceof Error ? error.message : "No se pudo registrar el pago.",
        })
      );
    }
  };

  // Crear Factura Manual con búsqueda predictiva de cliente
  const filteredClientsForManual = useMemo(() => {
    if (!manualClientSearch.trim()) return clients;
    const q = manualClientSearch.toLowerCase();
    return clients.filter((c) => c.businessName.toLowerCase().includes(q) || c.identificationNumber.includes(q));
  }, [clients, manualClientSearch]);

  const handleSelectManualClient = (c: typeof clients[0]) => {
    setManualClientId(c.id);
    const clientSrvs = clientServices.filter((s) => s.clientId === c.id && s.status === "activo");
    if (clientSrvs.length > 0) {
      setManualConcept(`${clientSrvs[0].planName} - Servicio Ocasional / Mes`);
      setManualAmount(clientSrvs[0].customPrice);
    } else {
      setManualConcept("Servicio de Telecomunicaciones Ocasional");
    }
  };

  const handleCreateManualInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualClientId) {
      showError("Cliente Requerido", "Selecciona el cliente para emitir el comprobante.");
      return;
    }
    if (!manualConcept.trim()) {
      showError("Concepto Requerido", "Ingresa la descripción del servicio ocasional.");
      return;
    }
    if (manualAmount <= 0) {
      showError("Valor Inválido", "El valor del servicio debe ser mayor a cero.");
      return;
    }

    const client = clients.find((c) => c.id === manualClientId);
    if (!client) return;

    const subtotal = parseFloat((manualAmount / 1.15).toFixed(2));
    const ivaAmount = parseFloat((manualAmount - subtotal).toFixed(2));
    const now = new Date();

    try {
      await addMonthlyCharge({
        clientId: client.id,
        clientName: client.businessName,
        clientRuc: client.identificationNumber,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        serviceDescription: manualConcept,
        subtotal,
        ivaAmount,
        total: manualAmount,
        status: "pendiente",
        invoiceNumber: `001-200-${Math.floor(Math.random() * 900000 + 100000)}`,
        maxPaymentDate: manualMaxDate,
        isOccasional: true,
      });

      showSuccess("Factura Manual Creada", `Comprobante por $${manualAmount.toFixed(2)} USD emitido para ${client.businessName}.`);
      setIsManualModalOpen(false);
      setManualConcept("");
      setManualAmount(35);
    } catch (error) {
      window.dispatchEvent(
        new CustomEvent("inntel:error", {
          detail: error instanceof Error ? error.message : "No se pudo crear la factura.",
        })
      );
    }
  };

  // Crear Gasto OPEX
  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expSupplier.trim()) {
      showError("Proveedor Requerido", "Ingresa el nombre o razón social del proveedor.");
      return;
    }
    if (expAmount <= 0) {
      showError("Monto Inválido", "El monto del gasto debe ser mayor a cero.");
      return;
    }

    try {
      await addExpense({
        supplierName: expSupplier.trim(),
        amount: Number(expAmount),
        category: expCategory as any,
        description: expDescription.trim() || "Gasto operativo del mes",
        expenseDate: new Date().toISOString().split("T")[0],
        paymentMethod: expMethod,
      });
      showSuccess("Gasto OPEX Registrado", `Gasto de $${Number(expAmount).toFixed(2)} USD registrado.`);
      setIsExpenseModalOpen(false);
      setExpSupplier("");
      setExpDescription("");
      setExpAmount(100);
    } catch (error) {
      window.dispatchEvent(
        new CustomEvent("inntel:error", {
          detail: error instanceof Error ? error.message : "No se pudo registrar el gasto.",
        })
      );
    }
  };

  return (
    <div className="w-full space-y-6 select-none">
      {/* Botones de Navegación de Pestañas Principales (idéntico a imagen del usuario) */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveFinanceTab("ingresos")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-[6px] text-xs font-bold transition-all cursor-pointer ${
            activeFinanceTab === "ingresos"
              ? "bg-[#004ac6] text-white shadow-xs"
              : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Ingresos, Cobranzas & Facturas</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveFinanceTab("gastos")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-[6px] text-xs font-bold transition-all cursor-pointer ${
            activeFinanceTab === "gastos"
              ? "bg-[#712ae2] text-white shadow-xs"
              : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Gastos Operativos & OPEX</span>
        </button>
      </div>

      {/* Tarjeta de Utilidad Neta Mensual */}
      <div className="p-4 bg-gradient-to-r from-blue-900 to-indigo-950 text-white rounded-[6px] shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[6px] bg-white/10 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200 block">
              Utilidad Neta del Mes (Ingresos Cobrados − Gastos OPEX)
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className={`text-2xl font-black font-tnum ${utilidadNetaMes >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                ${utilidadNetaMes.toFixed(2)} USD
              </span>
              <span className="text-xs font-bold text-blue-200 bg-white/10 px-2 py-0.5 rounded-[6px]">
                Margen Operativo: {margenUtilidad.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs text-blue-100">
          <div>
            <span className="text-[10px] text-blue-300 block">Ingresos Cobrados</span>
            <span className="font-bold text-white font-tnum">${totalPaid.toFixed(2)} USD</span>
          </div>
          <div className="h-6 w-px bg-white/20" />
          <div>
            <span className="text-[10px] text-blue-300 block">Gastos OPEX</span>
            <span className="font-bold text-rose-300 font-tnum">${totalOpex.toFixed(2)} USD</span>
          </div>
        </div>
      </div>

      {/* VISTA 1: INGRESOS, COBRANZAS & FACTURAS */}
      {activeFinanceTab === "ingresos" && (
        <div className="space-y-6">
          {/* Top Actions Header */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-[#004ac6]" />
                Detalle de Órdenes de Pedido & Pre-Facturas Emitidas
              </h1>
              <p className="text-xs text-slate-500">
                Control de emisión mensual, estados de pago y liquidación de abonos por cliente
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => setIsManualModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-[#004ac6] border border-[#dce9ff] rounded-[6px] text-xs font-bold shadow-2xs transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Factura Manual / Ocasional</span>
              </button>

              <button
                onClick={handleGenerateBatch}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#004ac6] hover:bg-[#003ca0] text-white rounded-[6px] text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Emitir Cobros Día 1</span>
              </button>

              <button
                onClick={handleExportBatch}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 rounded-[6px] text-xs font-bold shadow-2xs transition-all cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Exportar Excel</span>
              </button>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-[6px] bg-white border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Facturado</span>
              <span className="text-xl font-black text-slate-900 mt-0.5 block font-tnum">${totalBilled.toFixed(2)} USD</span>
              <span className="text-[11px] text-slate-500">{filteredCharges.length} comprobantes</span>
            </div>

            <div className="p-4 rounded-[6px] bg-white border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Cobrado / Recaudado</span>
              <span className="text-xl font-black text-emerald-600 mt-0.5 block font-tnum">${totalPaid.toFixed(2)} USD</span>
              <span className="text-[11px] text-emerald-700 font-bold">
                {totalBilled > 0 ? `${Math.round((totalPaid / totalBilled) * 100)}% de efectividad` : "0%"}
              </span>
            </div>

            <div className="p-4 rounded-[6px] bg-white border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Cartera Pendiente</span>
              <span className="text-xl font-black text-amber-600 mt-0.5 block font-tnum">${totalPending.toFixed(2)} USD</span>
              <span className="text-[11px] text-amber-700 font-semibold">Por recaudar o liquidar</span>
            </div>
          </div>

          {/* Tabla de Facturas & Cobros con Filtros de Fecha */}
          <div className="bg-white rounded-[6px] border border-slate-200 shadow-2xs overflow-hidden">
            {/* Barra de Filtros con Rango de Fechas */}
            <div className="p-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-white text-xs">
              <div className="flex flex-wrap items-center gap-3 flex-1">
                <div className="relative min-w-[220px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Buscar por cliente, RUC o N° Factura..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white text-xs text-slate-900 rounded-[6px] pl-8 pr-3 py-1.5 border border-slate-200 focus:outline-hidden focus:border-[#004ac6]"
                  />
                </div>

                {/* Filtro por Fecha Desde y Hasta */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Desde:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-2 py-1.5 rounded-[6px] border border-slate-200 text-xs text-slate-800"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Hasta:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-2 py-1.5 rounded-[6px] border border-slate-200 text-xs text-slate-800"
                  />
                </div>

                {/* Filtro por Estado */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-[6px] border border-slate-200 text-xs font-semibold text-slate-800"
                >
                  <option value="todos">Todos los Estados</option>
                  <option value="pendiente">Solo Pendientes</option>
                  <option value="pagado">Solo Pagados</option>
                </select>
              </div>

              {(startDate || endDate || searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setStartDate("");
                    setEndDate("");
                    setSearchQuery("");
                  }}
                  className="text-xs text-[#004ac6] hover:underline font-bold cursor-pointer"
                >
                  Limpiar Filtros
                </button>
              )}
            </div>

            {/* Tabla Principal de Pre-Facturas */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f8f9ff] text-[10px] uppercase tracking-wide text-slate-600 border-b border-slate-200 font-bold">
                  <tr>
                    <th className="py-3 px-4">Cliente / Identificación</th>
                    <th className="py-3 px-4">Concepto del Servicio</th>
                    <th className="py-3 px-4 text-right">Subtotal</th>
                    <th className="py-3 px-4 text-right">IVA 15%</th>
                    <th className="py-3 px-4 text-right">Total</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredCharges.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 italic">
                        No se encontraron registros de cobros o facturas con los filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    filteredCharges.map((charge) => {
                      const isPaid = charge.status === "pagado";
                      return (
                        <tr key={charge.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-900 block">{charge.clientName}</span>
                            <span className="text-[10px] font-mono text-slate-500">
                              {charge.clientRuc} · Factura #{charge.invoiceNumber}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <span className="text-slate-800 font-medium block">{charge.serviceDescription}</span>
                            {charge.maxPaymentDate && (
                              <span className="text-[10px] text-amber-700 font-semibold">
                                Vence: {charge.maxPaymentDate}
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right font-mono text-slate-700">
                            ${charge.subtotal.toFixed(2)}
                          </td>

                          <td className="py-3 px-4 text-right font-mono text-slate-700">
                            ${charge.ivaAmount.toFixed(2)}
                          </td>

                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                            ${charge.total.toFixed(2)}
                          </td>

                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-[6px] text-[10px] font-extrabold uppercase tracking-wide border ${
                                isPaid
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                              }`}
                            >
                              {charge.status.toUpperCase()}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right">
                            {isPaid ? (
                              <div className="text-[10px] font-mono text-slate-500">
                                <span>{charge.paymentDate?.slice(0, 10) || "Pagado"}</span>
                                {charge.paymentReference && (
                                  <span className="block font-semibold text-emerald-700">
                                    Ref: {charge.paymentReference}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openPaymentModal(charge)}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[6px] font-bold text-xs shadow-xs transition-colors cursor-pointer"
                              >
                                Marcar Pagado
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VISTA 2: GASTOS OPERATIVOS & OPEX (idéntico a imagen del usuario) */}
      {activeFinanceTab === "gastos" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Receipt className="w-5 h-5 text-[#712ae2]" />
                Control de Gastos Operativos & OPEX
              </h1>
              <p className="text-xs text-slate-500">
                Registro y categorización de egresos de infraestructura, conectividad y operaciones
              </p>
            </div>

            <button
              onClick={() => setIsExpenseModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#712ae2] hover:bg-[#5b1fb8] text-white rounded-[6px] text-xs font-bold shadow-xs cursor-pointer transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Registrar Gasto OPEX</span>
            </button>
          </div>

          {/* KPI Cards de Gastos */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-[6px] bg-white border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Egresos OPEX</span>
              <span className="text-xl font-black text-rose-600 mt-0.5 block font-tnum">${totalOpex.toFixed(2)} USD</span>
              <span className="text-[11px] text-slate-500">{filteredExpenses.length} egresos contabilizados</span>
            </div>

            <div className="p-4 rounded-[6px] bg-white border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Tránsito IP & Conectividad</span>
              <span className="text-xl font-black text-slate-900 mt-0.5 block font-tnum">
                ${expenses.filter((e) => e.category === "enlace_transito").reduce((s, e) => s + e.amount, 0).toFixed(2)} USD
              </span>
              <span className="text-[11px] text-slate-500">Enlaces dedicados BGP / Carriers</span>
            </div>

            <div className="p-4 rounded-[6px] bg-white border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Infraestructura & Nodos</span>
              <span className="text-xl font-black text-slate-900 mt-0.5 block font-tnum">
                ${expenses.filter((e) => e.category === "alquiler_nodo").reduce((s, e) => s + e.amount, 0).toFixed(2)} USD
              </span>
              <span className="text-[11px] text-slate-500">Arriendos de torres y mantenimiento</span>
            </div>
          </div>

          {/* Tabla de Gastos con Filtro de Fechas y Categorías */}
          <div className="bg-white rounded-[6px] border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-3 flex-1">
                <div className="relative min-w-[200px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Buscar por proveedor o detalle..."
                    value={expenseSearchQuery}
                    onChange={(e) => setExpenseSearchQuery(e.target.value)}
                    className="w-full bg-white rounded-[6px] pl-8 pr-3 py-1.5 border border-slate-200 text-xs"
                  />
                </div>

                {/* Filtro de Fechas para Gastos */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Desde:</span>
                  <input
                    type="date"
                    value={expenseStartDate}
                    onChange={(e) => setExpenseStartDate(e.target.value)}
                    className="px-2 py-1.5 rounded-[6px] border border-slate-200 text-xs text-slate-800"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Hasta:</span>
                  <input
                    type="date"
                    value={expenseEndDate}
                    onChange={(e) => setExpenseEndDate(e.target.value)}
                    className="px-2 py-1.5 rounded-[6px] border border-slate-200 text-xs text-slate-800"
                  />
                </div>

                {/* Selector de Categorías de Gastos */}
                <select
                  value={expenseCategoryFilter}
                  onChange={(e) => setExpenseCategoryFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-[6px] border border-slate-200 text-xs font-semibold text-slate-800"
                >
                  <option value="todas">Todas las Categorías</option>
                  {expenseCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {(expenseStartDate || expenseEndDate || expenseSearchQuery || expenseCategoryFilter !== "todas") && (
                <button
                  type="button"
                  onClick={() => {
                    setExpenseStartDate("");
                    setExpenseEndDate("");
                    setExpenseSearchQuery("");
                    setExpenseCategoryFilter("todas");
                  }}
                  className="text-xs text-[#712ae2] hover:underline font-bold cursor-pointer"
                >
                  Limpiar Filtros
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f8f9ff] text-[10px] uppercase tracking-wide text-slate-600 border-b border-slate-200 font-bold">
                  <tr>
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Proveedor / Beneficiario</th>
                    <th className="py-3 px-4">Categoría</th>
                    <th className="py-3 px-4">Descripción / Concepto</th>
                    <th className="py-3 px-4">Método de Pago</th>
                    <th className="py-3 px-4 text-right">Monto ($ USD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 italic">
                        No hay egresos u operaciones registradas con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-600">{exp.expenseDate}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{exp.supplierName}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-[6px] text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 uppercase">
                            {exp.category.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-800">{exp.description}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-[6px] text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {exp.paymentMethod}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-rose-600">
                          ${exp.amount.toFixed(2)} USD
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR PAGO FACTURA # (Idéntico a imagen image41.png del usuario) */}
      {payingCharge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none">
          <div className="w-full max-w-4xl bg-white rounded-[6px] shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            {/* Header del Modal */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-[4px] bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Registrar Pago Factura # {payingCharge.invoiceNumber}
                </h3>
              </div>
              <button
                onClick={() => setPayingCharge(null)}
                className="p-1 rounded-[6px] text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Formulario en Cuadrícula exactamente como image41.png */}
            <form onSubmit={handleConfirmPayment} className="p-6 space-y-4 text-xs bg-white">
              {/* Fila 1: Nombre de usuario, Fecha pago, Fecha Vencimiento, Imprimir */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Nombre de usuario
                  </label>
                  <input
                    type="text"
                    disabled
                    value={`${payingCharge.clientName} (${payingCharge.clientRuc})`}
                    className="w-full bg-slate-100 border border-slate-200 rounded-[4px] px-2.5 py-1.5 text-xs text-slate-700 font-medium"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Fecha pago
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-[4px] px-2.5 py-1.5 text-xs font-mono text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Fecha Vencimiento
                  </label>
                  <input
                    type="text"
                    value={paymentDueDate}
                    onChange={(e) => setPaymentDueDate(e.target.value)}
                    className="w-full bg-slate-100 border border-slate-200 rounded-[4px] px-2.5 py-1.5 text-xs font-mono text-slate-700"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Imprimir
                  </label>
                  <select
                    value={printOption}
                    onChange={(e) => setPrintOption(e.target.value as any)}
                    className="w-full bg-white border border-slate-300 rounded-[4px] px-2.5 py-1.5 text-xs font-medium text-slate-800"
                  >
                    <option value="nada">Nada</option>
                    <option value="ticket">Ticket Térmico</option>
                    <option value="factura">Factura RIDE Oficial</option>
                  </select>
                </div>
              </div>

              {/* Fila 2: Forma de pago, Acción al pagar, Referencia de Pago, Total a pagar */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-700">Forma de pago</label>
                    <button
                      type="button"
                      onClick={() => setIsAddingPaymentMethod(!isAddingPaymentMethod)}
                      className="text-[10px] font-bold text-[#004ac6] hover:underline cursor-pointer"
                    >
                      + Nueva
                    </button>
                  </div>

                  {isAddingPaymentMethod ? (
                    <div className="flex gap-1">
                      <input
                        type="text"
                        placeholder="Ej: Depósito Pacífico"
                        value={newPaymentMethod}
                        onChange={(e) => setNewPaymentMethod(e.target.value)}
                        className="w-full text-xs px-2 py-1 border border-slate-300 rounded-[4px]"
                      />
                      <button
                        type="button"
                        onClick={handleAddPaymentMethod}
                        className="px-2 bg-[#004ac6] text-white rounded-[4px] text-[10px] font-bold"
                      >
                        OK
                      </button>
                    </div>
                  ) : (
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-[4px] px-2.5 py-1.5 text-xs font-medium text-slate-800"
                    >
                      {paymentMethods.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Acción al pagar
                  </label>
                  <select
                    value={paymentAction}
                    onChange={(e) => setPaymentAction(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-[4px] px-2.5 py-1.5 text-xs font-medium text-slate-800"
                  >
                    <option value="marcar_pagado">Cambiar estado a pagado</option>
                    <option value="emitir_comprobante">Emitir comprobante digital</option>
                    <option value="notificar_cliente">Notificar por correo</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Referencia de Pago *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: DEP-894210 / TRANSF-90214"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-[4px] px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Total a pagar ($ USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={payingCharge.balanceRemaining !== undefined ? payingCharge.balanceRemaining : payingCharge.total}
                    value={totalToPay}
                    onChange={(e) => setTotalToPay(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-300 rounded-[4px] px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900"
                  />
                  {totalToPay < (payingCharge.balanceRemaining !== undefined ? payingCharge.balanceRemaining : payingCharge.total) && (
                    <span className="text-[10px] text-amber-600 block mt-0.5">
                      Abono parcial: se diferirá el saldo restante.
                    </span>
                  )}
                </div>
              </div>

              {/* Input oculto para adjuntar voucher */}
              <input
                type="file"
                ref={voucherInputRef}
                className="hidden"
                accept="image/*,.pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setVoucherFileName(f.name);
                    showSuccess("Comprobante Seleccionado", `Archivo "${f.name}" adjunto.`);
                  }
                }}
              />

              {voucherFileName && (
                <div className="flex items-center gap-2 p-2 rounded-[4px] bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Comprobante adjunto: <strong>{voucherFileName}</strong></span>
                </div>
              )}

              {/* Botones exactamente alineados a imagen image41.png */}
              <div className="pt-4 flex items-center justify-center gap-2 border-t border-slate-100">
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2 bg-[#00a8e8] hover:bg-[#0092ca] text-white rounded-[4px] text-xs font-bold shadow-xs cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Guardar Pago</span>
                </button>

                <button
                  type="button"
                  onClick={() => voucherInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#28a745] hover:bg-[#218838] text-white rounded-[4px] text-xs font-bold shadow-xs cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Ver/Adjuntar Comprobante de pago</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPayingCharge(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-[4px] text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: FACTURA MANUAL / OCASIONAL CON BÚSQUEDA PREDICTIVA */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none">
          <div className="w-full max-w-lg bg-white rounded-[6px] shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#004ac6]" />
                Emitir Factura Manual / Servicio Ocasional
              </h3>
              <button
                onClick={() => setIsManualModalOpen(false)}
                className="p-1 rounded-[6px] text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateManualInvoice} className="p-5 space-y-3.5 text-xs">
              {/* Buscador predictivo de Cliente */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Buscar & Seleccionar Cliente *
                </label>
                <div className="space-y-1.5">
                  <input
                    type="text"
                    placeholder="Escribe el nombre o RUC del cliente..."
                    value={manualClientSearch}
                    onChange={(e) => setManualClientSearch(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-[6px] px-3 py-1.5 text-xs text-slate-800"
                  />
                  <select
                    value={manualClientId}
                    onChange={(e) => {
                      const c = clients.find((cl) => cl.id === e.target.value);
                      if (c) handleSelectManualClient(c);
                    }}
                    className="w-full bg-white border border-slate-300 rounded-[6px] px-3 py-2 text-xs font-bold text-slate-800"
                  >
                    {filteredClientsForManual.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.businessName} ({c.identificationNumber})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Concepto del Servicio / Producto *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Mantenimiento correctivo de fibra / Servicio adicional..."
                  value={manualConcept}
                  onChange={(e) => setManualConcept(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-[6px] px-3 py-2 font-medium text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Valor Total ($ USD) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={manualAmount}
                    onChange={(e) => setManualAmount(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-300 rounded-[6px] px-3 py-2 font-bold font-mono text-slate-900"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Fecha Máxima de Pago *
                  </label>
                  <input
                    type="date"
                    required
                    value={manualMaxDate}
                    onChange={(e) => setManualMaxDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-[6px] px-3 py-2 text-slate-800 font-medium"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-[6px] border border-slate-200 flex justify-between text-xs">
                <span className="text-slate-600">Subtotal: ${(manualAmount / 1.15).toFixed(2)}</span>
                <span className="text-slate-600">IVA 15%: ${(manualAmount - manualAmount / 1.15).toFixed(2)}</span>
                <span className="font-bold text-slate-900">Total: ${manualAmount.toFixed(2)} USD</span>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-[6px] font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#004ac6] hover:bg-[#003ca0] text-white rounded-[6px] font-bold shadow-xs cursor-pointer"
                >
                  Emitir Comprobante
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR GASTO OPEX */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none">
          <div className="w-full max-w-md bg-white rounded-[6px] shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-purple-50/50">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#712ae2]" />
                Registrar Gasto de Operación OPEX
              </h3>
              <button
                onClick={() => setIsExpenseModalOpen(false)}
                className="p-1 rounded-[6px] text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Proveedor / Beneficiario *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Alexander Salgado / Telconet Latam..."
                  value={expSupplier}
                  onChange={(e) => setExpSupplier(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-[6px] px-3 py-2 text-slate-900 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700">Categoría</label>
                    <button
                      type="button"
                      onClick={() => setIsAddingCategory(!isAddingCategory)}
                      className="text-[10px] font-bold text-[#712ae2] hover:underline cursor-pointer"
                    >
                      + Nueva
                    </button>
                  </div>

                  {isAddingCategory ? (
                    <div className="flex gap-1">
                      <input
                        type="text"
                        placeholder="Nueva categoría..."
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        className="w-full text-xs px-2 py-1 border border-slate-300 rounded-[4px]"
                      />
                      <button
                        type="button"
                        onClick={handleAddExpenseCategory}
                        className="px-2 bg-[#712ae2] text-white rounded-[4px] text-[10px] font-bold"
                      >
                        OK
                      </button>
                    </div>
                  ) : (
                    <select
                      value={expCategory}
                      onChange={(e) => setExpCategory(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-[6px] px-3 py-2 text-slate-800 font-medium"
                    >
                      {expenseCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Valor ($ USD) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={expAmount}
                    onChange={(e) => setExpAmount(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-300 rounded-[6px] px-3 py-2 font-bold font-mono text-rose-600"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Descripción / Concepto</label>
                <textarea
                  rows={2}
                  placeholder="Detalle del comprobante..."
                  value={expDescription}
                  onChange={(e) => setExpDescription(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-[6px] px-3 py-2 text-slate-900"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-[6px] font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#712ae2] hover:bg-[#5b1fb8] text-white rounded-[6px] font-bold shadow-xs cursor-pointer"
                >
                  Guardar Gasto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
