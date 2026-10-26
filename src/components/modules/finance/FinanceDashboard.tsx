"use client";

import React, { useState, useMemo } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import {
  DollarSign,
  FileSpreadsheet,
  Plus,
  Search,
  Receipt,
  CreditCard,
  X,
  TrendingUp,
} from "lucide-react";
import { generateBillingBatchExcel, triggerBrowserDownload } from "@/lib/doc-generator";
import { MonthlyCharge } from "@/types";

interface FinanceDashboardProps {
  onOpenNewExpense?: () => void;
}

const PAYMENT_METHODS = [
  "Transferencia Bancaria",
  "Depósito Bancario",
  "Efectivo",
  "Cheque",
  "Tarjeta de Crédito / Débito",
];

const EXPENSE_CATEGORIES = [
  { id: "enlace_transito", label: "Internet y Enlaces" },
  { id: "alquiler_nodo", label: "Alquiler de Nodos / Locales" },
  { id: "fibra_equipos", label: "Equipos y Materiales" },
  { id: "mantenimiento", label: "Mantenimiento y Técnicos" },
  { id: "servicios_basicos", label: "Servicios Básicos" },
  { id: "administrativos", label: "Sueldos y Administrativos" },
  { id: "seguros", label: "Seguros y Pólizas" },
  { id: "otro", label: "Otros Gastos" },
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

export function FinanceDashboard({ onOpenNewExpense }: FinanceDashboardProps) {
  const {
    monthlyCharges,
    markChargeAsPaid,
    expenses,
    addExpense,
    bankAccounts,
    addFinancialMovement,
  } = useApp();
  const { showSuccess, showError } = useToast();

  const [activeFinanceTab, setActiveFinanceTab] = useState<"ingresos" | "gastos">("ingresos");

  // Filtros de Cobros
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Filtros de Gastos
  const [expenseSearchQuery, setExpenseSearchQuery] = useState("");
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState("todas");
  const [expenseStartDate, setExpenseStartDate] = useState("");
  const [expenseEndDate, setExpenseEndDate] = useState("");

  // Modal Registrar Cobro (Directo y conciso: 4 campos)
  const [payingCharge, setPayingCharge] = useState<MonthlyCharge | null>(null);
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);
  const [paymentBankId, setPaymentBankId] = useState<string>(bankAccounts[0]?.id || "");
  const [paymentReference, setPaymentReference] = useState("");
  const [totalToPay, setTotalToPay] = useState<number>(0);

  // Modal Registrar Gasto (Directo y conciso)
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expSupplier, setExpSupplier] = useState("");
  const [expAmount, setExpAmount] = useState<number>(0);
  const [expCategory, setExpCategory] = useState<string>("enlace_transito");
  const [expDescription, setExpDescription] = useState("");
  const [expBankId, setExpBankId] = useState<string>(bankAccounts[0]?.id || "");
  const [expMethod, setExpMethod] = useState<"transferencia" | "tarjeta_credito" | "efectivo">("transferencia");

  // Filtrado de Cobros
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

  // Filtrado de Gastos
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

  // Totales
  const totalBilled = filteredCharges.reduce((sum, c) => sum + c.total, 0);
  const totalPaid = filteredCharges
    .filter((c) => c.status === "pagado" || (c.paidAmount && c.paidAmount > 0))
    .reduce((sum, c) => sum + (c.paidAmount ?? (c.status === "pagado" ? c.total : 0)), 0);
  const totalPending = Math.max(0, totalBilled - totalPaid);
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const netBalance = totalPaid - totalExpenses;

  const handleExportBatch = async () => {
    if (filteredCharges.length === 0) {
      showError("Sin Registros", "No hay cobros con los filtros actuales para exportar.");
      return;
    }
    try {
      const blob = await generateBillingBatchExcel(filteredCharges);
      triggerBrowserDownload(blob, `Cobranzas_${new Date().toISOString().split("T")[0]}.xlsx`);
      showSuccess("Excel Exportado", `Se descargaron ${filteredCharges.length} registros.`);
    } catch {
      showError("Error", "No se pudo generar el archivo Excel.");
    }
  };

  const openPaymentModal = (charge: MonthlyCharge) => {
    setPayingCharge(charge);
    setPaymentMethod(PAYMENT_METHODS[0]);
    setPaymentBankId(bankAccounts.find((b) => b.status === "activa")?.id || bankAccounts[0]?.id || "");
    setPaymentReference(`REF-${Date.now().toString().slice(-6)}`);
    setTotalToPay(charge.balanceRemaining !== undefined ? charge.balanceRemaining : charge.total);
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingCharge) return;

    if (totalToPay <= 0) {
      showError("Monto Inválido", "El valor a cobrar debe ser mayor a $0.00.");
      return;
    }

    const currentTotal =
      payingCharge.balanceRemaining !== undefined ? payingCharge.balanceRemaining : payingCharge.total;
    const remaining = Math.max(0, parseFloat((currentTotal - totalToPay).toFixed(2)));

    try {
      await markChargeAsPaid(
        payingCharge.id,
        paymentMethod,
        paymentReference.trim() || undefined,
        totalToPay,
        remaining,
        paymentBankId
      );
      showSuccess(
        remaining > 0 ? "Abono Registrado" : "Cobro Registrado",
        `Se registró $${totalToPay.toFixed(2)} para ${payingCharge.clientName}.`
      );
      setPayingCharge(null);
    } catch (error) {
      showError("Error", error instanceof Error ? error.message : "No se pudo registrar el cobro.");
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expSupplier.trim()) {
      showError("Proveedor Requerido", "Ingresa el nombre del proveedor o beneficiario.");
      return;
    }
    if (expAmount <= 0) {
      showError("Monto Inválido", "El monto del gasto debe ser mayor a $0.00.");
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    const targetBank =
      bankAccounts.find((b) => b.id === expBankId) ||
      bankAccounts.find((b) => b.status === "activa") ||
      bankAccounts[0];

    try {
      await addExpense({
        supplierName: expSupplier.trim(),
        amount: Number(expAmount),
        category: expCategory as any,
        description: expDescription.trim() || formatFinanceCategory(expCategory),
        expenseDate: today,
        paymentMethod: expMethod,
      });

      if (targetBank) {
        await addFinancialMovement({
          type: "egreso",
          date: today,
          amount: Number(expAmount),
          category: expCategory,
          description: `${expSupplier.trim()} - ${expDescription.trim() || formatFinanceCategory(expCategory)}`,
          bankAccountId: targetBank.id,
          bankAccountName: targetBank.bankName,
          paymentMethod: expMethod === "efectivo" ? "efectivo" : "transferencia",
        });
      }

      showSuccess("Gasto Registrado", `Gasto de $${Number(expAmount).toFixed(2)} guardado.`);
      setIsExpenseModalOpen(false);
      setExpSupplier("");
      setExpDescription("");
      setExpAmount(0);
    } catch (error) {
      showError("Error", error instanceof Error ? error.message : "No se pudo guardar el gasto.");
    }
  };

  return (
    <div className="w-full space-y-5">
      {/* Selector Simple: Cobros vs Gastos + Resumen Compacto */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-[#e2e8f0] shadow-2xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveFinanceTab("ingresos")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeFinanceTab === "ingresos"
                ? "bg-[#004ac6] text-white shadow-xs"
                : "bg-[#f8f9ff] text-slate-700 hover:bg-slate-100 border border-[#e2e8f0]"
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Cobros de Clientes</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFinanceTab("gastos")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeFinanceTab === "gastos"
                ? "bg-[#004ac6] text-white shadow-xs"
                : "bg-[#f8f9ff] text-slate-700 hover:bg-slate-100 border border-[#e2e8f0]"
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Gastos</span>
          </button>
        </div>

        {/* Resumen rápido en una sola línea */}
        <div className="flex flex-wrap items-center gap-5 text-xs">
          <div>
            <span className="text-slate-500 mr-1.5">Cobrado:</span>
            <span className="font-mono font-bold text-emerald-600">${totalPaid.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-slate-500 mr-1.5">Por Cobrar:</span>
            <span className="font-mono font-bold text-amber-600">${totalPending.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-slate-500 mr-1.5">Gastos:</span>
            <span className="font-mono font-bold text-rose-600">${totalExpenses.toFixed(2)}</span>
          </div>
          <div className="pl-4 border-l border-[#e2e8f0] flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-[#004ac6]" />
            <span className="text-slate-600 font-semibold">Saldo Neto:</span>
            <span className={`font-mono font-black ${netBalance >= 0 ? "text-[#004ac6]" : "text-rose-600"}`}>
              ${netBalance.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* VISTA 1: COBROS DE CLIENTES */}
      {activeFinanceTab === "ingresos" && (
        <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
          <div className="p-3.5 border-b border-[#e2e8f0] flex flex-wrap items-center justify-between gap-3 text-xs bg-[#fcfdff]">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <div className="relative min-w-[220px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar cliente, RUC o comprobante..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#f8f9ff] text-xs text-slate-900 rounded-lg pl-8 pr-3 py-1.5 border border-[#e2e8f0] focus:bg-white focus:outline-hidden focus:border-[#004ac6]"
                />
              </div>

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

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-[#e2e8f0] text-xs font-semibold text-slate-700 bg-[#f8f9ff] focus:bg-white focus:outline-hidden focus:border-[#004ac6]"
              >
                <option value="todos">Todos los Estados</option>
                <option value="pendiente">Pendientes</option>
                <option value="pagado">Pagados</option>
              </select>

              {(startDate || endDate || searchQuery || statusFilter !== "todos") && (
                <button
                  type="button"
                  onClick={() => {
                    setStartDate("");
                    setEndDate("");
                    setSearchQuery("");
                    setStatusFilter("todos");
                  }}
                  className="text-xs text-[#004ac6] hover:underline font-bold cursor-pointer"
                >
                  Limpiar
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

          <div className="overflow-x-auto">
            <table className="table-fixed w-full text-left text-xs border-collapse">
              <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-xs uppercase tracking-wider border-b border-[#e2e8f0]">
                <tr>
                  <th className="w-3/12 py-3 px-4">Cliente</th>
                  <th className="w-3/12 py-3 px-4">Servicio / Concepto</th>
                  <th className="w-1/12 py-3 px-4 text-right">Total</th>
                  <th className="w-1/12 py-3 px-4 text-right">Saldo</th>
                  <th className="w-2/12 py-3 px-4 text-center">Estado</th>
                  <th className="w-2/12 py-3 px-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {filteredCharges.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400">
                      No se encontraron cobros registrados.
                    </td>
                  </tr>
                ) : (
                  filteredCharges.map((charge) => {
                    const isPaid = charge.status === "pagado";
                    const balance =
                      charge.balanceRemaining !== undefined
                        ? charge.balanceRemaining
                        : isPaid
                        ? 0
                        : charge.total;

                    return (
                      <tr key={charge.id} className="hover:bg-[#f8f9ff] transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 block truncate">{charge.clientName}</span>
                          <span className="text-[11px] font-mono text-slate-500">
                            {charge.clientRuc} · #{charge.invoiceNumber}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <span className="text-slate-800 block truncate">{charge.serviceDescription}</span>
                          {charge.maxPaymentDate && !isPaid && (
                            <span className="text-[10px] text-amber-700 font-semibold">
                              Vence: {charge.maxPaymentDate}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right font-mono text-slate-700">
                          ${charge.total.toFixed(2)}
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          ${balance.toFixed(2)}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${
                              isPaid
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}
                          >
                            {isPaid ? "Pagado" : "Pendiente"}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right">
                          {isPaid ? (
                            <div className="text-[11px] font-mono text-slate-500">
                              <span>{charge.paymentDate?.slice(0, 10) || "Pagado"}</span>
                              {charge.paymentReference && (
                                <span className="block text-[10px] text-emerald-700 font-semibold truncate">
                                  Ref: {charge.paymentReference}
                                </span>
                              )}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openPaymentModal(charge)}
                              className="px-3 py-1.5 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg font-bold text-xs transition cursor-pointer shadow-xs"
                            >
                              Registrar Cobro
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
      )}

      {/* VISTA 2: GASTOS */}
      {activeFinanceTab === "gastos" && (
        <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
          <div className="p-3.5 border-b border-[#e2e8f0] flex flex-wrap items-center justify-between gap-3 text-xs bg-[#fcfdff]">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar proveedor o concepto..."
                  value={expenseSearchQuery}
                  onChange={(e) => setExpenseSearchQuery(e.target.value)}
                  className="w-full bg-[#f8f9ff] rounded-lg pl-8 pr-3 py-1.5 border border-[#e2e8f0] text-xs focus:bg-white focus:outline-hidden focus:border-[#004ac6]"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-500">Desde:</span>
                <input
                  type="date"
                  value={expenseStartDate}
                  onChange={(e) => setExpenseStartDate(e.target.value)}
                  className="px-2 py-1.5 rounded-lg border border-[#e2e8f0] text-xs text-slate-800 bg-[#f8f9ff] focus:bg-white focus:outline-hidden focus:border-[#004ac6]"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-500">Hasta:</span>
                <input
                  type="date"
                  value={expenseEndDate}
                  onChange={(e) => setExpenseEndDate(e.target.value)}
                  className="px-2 py-1.5 rounded-lg border border-[#e2e8f0] text-xs text-slate-800 bg-[#f8f9ff] focus:bg-white focus:outline-hidden focus:border-[#004ac6]"
                />
              </div>

              <select
                value={expenseCategoryFilter}
                onChange={(e) => setExpenseCategoryFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-[#e2e8f0] text-xs font-semibold text-slate-700 bg-[#f8f9ff] focus:bg-white focus:outline-hidden focus:border-[#004ac6]"
              >
                <option value="todas">Todas las Categorías</option>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>

              {(expenseStartDate || expenseEndDate || expenseSearchQuery || expenseCategoryFilter !== "todas") && (
                <button
                  type="button"
                  onClick={() => {
                    setExpenseStartDate("");
                    setExpenseEndDate("");
                    setExpenseSearchQuery("");
                    setExpenseCategoryFilter("todas");
                  }}
                  className="text-xs text-[#004ac6] hover:underline font-bold cursor-pointer"
                >
                  Limpiar
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setExpBankId(bankAccounts.find((b) => b.status === "activa")?.id || bankAccounts[0]?.id || "");
                setIsExpenseModalOpen(true);
                if (onOpenNewExpense) onOpenNewExpense();
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nuevo Gasto</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="table-fixed w-full text-left text-xs border-collapse">
              <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-xs uppercase tracking-wider border-b border-[#e2e8f0]">
                <tr>
                  <th className="w-2/12 py-3 px-4">Fecha</th>
                  <th className="w-3/12 py-3 px-4">Proveedor / Beneficiario</th>
                  <th className="w-2/12 py-3 px-4">Categoría</th>
                  <th className="w-2/12 py-3 px-4">Concepto</th>
                  <th className="w-1/12 py-3 px-4">Forma de Pago</th>
                  <th className="w-2/12 py-3 px-4 text-right">Monto ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400">
                      No hay gastos registrados con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-[#f8f9ff] transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-600">{exp.expenseDate}</td>
                      <td className="py-3 px-4 font-bold text-slate-900 truncate">{exp.supplierName}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {formatFinanceCategory(exp.category)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-700 truncate">{exp.description}</td>
                      <td className="py-3 px-4 capitalize text-slate-600 truncate">
                        {exp.paymentMethod.replace(/_/g, " ")}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-rose-600">
                        ${exp.amount.toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL SIMPLIFICADO: REGISTRAR COBRO */}
      {payingCharge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#004ac6]" />
                <h3 className="font-bold text-slate-900 text-sm">Registrar Cobro</h3>
              </div>
              <button
                onClick={() => setPayingCharge(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmPayment} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-blue-50/70 rounded-lg border border-blue-200/80 space-y-1">
                <div className="font-bold text-slate-900">{payingCharge.clientName}</div>
                <div className="flex justify-between text-slate-600">
                  <span>Comprobante #{payingCharge.invoiceNumber}</span>
                  <span className="font-mono font-bold text-[#004ac6]">
                    Saldo: $
                    {(payingCharge.balanceRemaining !== undefined
                      ? payingCharge.balanceRemaining
                      : payingCharge.total
                    ).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Monto a Cobrar ($) *
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
                    value={totalToPay || ""}
                    onChange={(e) => setTotalToPay(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-emerald-700"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Cuenta / Banco Destino *
                  </label>
                  <select
                    value={paymentBankId}
                    onChange={(e) => setPaymentBankId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-800"
                  >
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bankName}
                      </option>
                    ))}
                  </select>
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
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-800"
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
                    N° Referencia / Comprobante
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: 094812"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800"
                  />
                </div>
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
                  className="px-5 py-2 bg-[#004ac6] hover:bg-[#003ca0] text-white rounded-lg font-bold shadow-xs cursor-pointer"
                >
                  Guardar Cobro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL SIMPLIFICADO: NUEVO GASTO */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#004ac6]" />
                Nuevo Gasto
              </h3>
              <button
                onClick={() => setIsExpenseModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Proveedor o Beneficiario *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Empresa Eléctrica, Proveedor de Fibra..."
                  value={expSupplier}
                  onChange={(e) => setExpSupplier(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Categoría</label>
                  <select
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800"
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Monto ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={expAmount || ""}
                    onChange={(e) => setExpAmount(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 font-bold font-mono text-rose-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Pagado desde Cuenta</label>
                  <select
                    value={expBankId}
                    onChange={(e) => setExpBankId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800"
                  >
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bankName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Forma de Pago</label>
                  <select
                    value={expMethod}
                    onChange={(e) => setExpMethod(e.target.value as any)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800"
                  >
                    <option value="transferencia">Transferencia</option>
                    <option value="efectivo">Efectivo</option>
                    <option value="tarjeta_credito">Tarjeta</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Concepto / Detalle</label>
                <input
                  type="text"
                  placeholder="Descripción breve del gasto..."
                  value={expDescription}
                  onChange={(e) => setExpDescription(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#004ac6] hover:bg-[#003ca0] text-white rounded-lg font-bold shadow-xs cursor-pointer"
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
