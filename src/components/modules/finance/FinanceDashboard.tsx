"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import {
  DollarSign,
  FileSpreadsheet,
  Plus,
  CheckCircle2,
  Calendar,
  Search,
  SlidersHorizontal,
  Receipt,
  CreditCard,
  X,
  Clock,
  ArrowRight,
} from "lucide-react";
import { generateBillingBatchExcel, triggerBrowserDownload } from "@/lib/doc-generator";
import { MonthlyCharge } from "@/types";

interface FinanceDashboardProps {
  onOpenNewExpense?: () => void;
}

const PAYMENT_METHODS = [
  "Transferencia Bancaria",
  "Depósito Banco Pichincha",
  "Depósito Banco Guayaquil",
  "Efectivo Dalmau",
  "Efectivo Equinoccio",
  "Cheque",
  "Tarjeta de Crédito / Débito",
];

export function FinanceDashboard({ onOpenNewExpense }: FinanceDashboardProps) {
  const {
    monthlyCharges,
    markChargeAsPaid,
    addMonthlyCharge,
    generateMonthlyBillingBatch,
    clients,
    expenses,
  } = useApp();
  const { showSuccess, showError, showConfirm } = useToast();

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Modals state
  const [payingCharge, setPayingCharge] = useState<MonthlyCharge | null>(null);
  const [isAbono, setIsAbono] = useState(false);
  const [abonoAmount, setAbonoAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);
  const [paymentReference, setPaymentReference] = useState("");

  // Manual Invoice Modal
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualClientId, setManualClientId] = useState(clients[0]?.id || "");
  const [manualConcept, setManualConcept] = useState("");
  const [manualAmount, setManualAmount] = useState<number>(35);
  const [manualMaxDate, setManualMaxDate] = useState(
    new Date(Date.now() + 86400000 * 10).toISOString().split("T")[0]
  );

  // Filter charges
  const filteredCharges = monthlyCharges.filter((c) => {
    const matchesSearch =
      c.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.clientRuc.includes(searchQuery) ||
      c.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.serviceDescription.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "todos" || c.status === statusFilter;

    // Date range filter if set
    let matchesDate = true;
    if (startDate) {
      const chargeDate = c.paymentDate || `${c.year}-${String(c.month).padStart(2, "0")}-01`;
      if (chargeDate < startDate) matchesDate = false;
    }
    if (endDate) {
      const chargeDate = c.paymentDate || `${c.year}-${String(c.month).padStart(2, "0")}-28`;
      if (chargeDate > endDate) matchesDate = false;
    }

    return matchesSearch && matchesStatus && matchesDate;
  });

  const totalBilled = filteredCharges.reduce((sum, c) => sum + c.total, 0);
  const totalPaid = filteredCharges
    .filter((c) => c.status === "pagado")
    .reduce((sum, c) => sum + (c.paidAmount ?? c.total), 0);
  const totalPending = totalBilled - totalPaid;

  const handleExportBatch = async () => {
    if (filteredCharges.length === 0) {
      showError("Sin Registros", "No hay comprobantes que coincidan con los filtros para exportar.");
      return;
    }
    try {
      const blob = await generateBillingBatchExcel(filteredCharges);
      triggerBrowserDownload(blob, `Cobranzas_INNTEL_${new Date().toISOString().split("T")[0]}.xlsx`);
      showSuccess("Lote Exportado", `Archivo Excel con ${filteredCharges.length} registros generado exitosamente.`);
    } catch (e) {
      showError("Error de Exportación", "Ocurrió un problema al construir el archivo Excel.");
    }
  };

  const handleGenerateBatch = () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    showConfirm(
      "¿Emitir Cobros / Órdenes del Día 1?",
      `Se generarán las órdenes de pedido y facturación para ${clients.length} abonados registrados para el periodo ${month}/${year}. ¿Continuar?`,
      async () => {
        try {
          await generateMonthlyBillingBatch(month, year);
          showSuccess("Lote Emitido", `Cobros del Día 1 generados para ${clients.length} abonados.`);
        } catch (error) {
          window.dispatchEvent(new CustomEvent("inntel:error", { detail: error instanceof Error ? error.message : "No se pudo emitir el lote." }));
        }
      },
      "Generar Lote"
    );
  };

  const openPaymentModal = (charge: MonthlyCharge) => {
    setPayingCharge(charge);
    setIsAbono(false);
    setAbonoAmount(charge.total);
    setPaymentMethod(PAYMENT_METHODS[0]);
    setPaymentReference("");
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingCharge) return;

    if (!paymentReference.trim()) {
      showError("Referencia Requerida", "Ingresa el número de comprobante, depósito o voucher.");
      return;
    }

    try {
      if (isAbono) {
        if (abonoAmount <= 0 || abonoAmount >= payingCharge.total) {
          showError("Monto de Abono Inválido", "El abono debe ser mayor a 0 y menor al total de la factura.");
          return;
        }
        const remaining = parseFloat((payingCharge.total - abonoAmount).toFixed(2));
        await markChargeAsPaid(payingCharge.id, paymentMethod, paymentReference, abonoAmount, remaining);
        showSuccess("Abono Registrado", `Se registró el abono de $${abonoAmount.toFixed(2)} USD. Nueva factura emitida por saldo pendiente: $${remaining.toFixed(2)} USD.`);
      } else {
        await markChargeAsPaid(payingCharge.id, paymentMethod, paymentReference, payingCharge.total, 0);
        showSuccess("Pago Completo Registrado", `Factura #${payingCharge.invoiceNumber} por $${payingCharge.total.toFixed(2)} USD pagada vía ${paymentMethod}.`);
      }
      setPayingCharge(null);
    } catch (error) {
      window.dispatchEvent(new CustomEvent("inntel:error", { detail: error instanceof Error ? error.message : "No se pudo registrar el pago." }));
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
      window.dispatchEvent(new CustomEvent("inntel:error", { detail: error instanceof Error ? error.message : "No se pudo crear la factura." }));
    }
  };

  return (
    <div className="w-full space-y-6 select-none">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1c30] tracking-tight flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-[#004ac6]" />
            Control Financiero, Cobranzas & Facturación
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsManualModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-white hover:bg-[#f8f9ff] text-[#004ac6] border border-[#dce9ff] rounded-lg text-xs font-bold shadow-2xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Factura Manual / Ocasional</span>
          </button>

          <button
            onClick={handleGenerateBatch}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <Calendar className="w-4 h-4" />
            <span>Emitir Cobros Día 1</span>
          </button>

          <button
            onClick={handleExportBatch}
            className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-[#f8f9ff] text-[#0b1c30] border border-[#cbd5e1] rounded-lg text-xs font-bold shadow-2xs transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#10B981]" />
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-5 rounded-2xl bg-white border border-[#e2e8f0] shadow-lumina-card">
          <span className="text-[11px] font-bold text-[#737686] uppercase tracking-wider block">Total Facturado</span>
          <span className="text-2xl font-black text-[#0b1c30] mt-1 block font-tnum">${totalBilled.toFixed(2)} USD</span>
          <span className="text-[11px] text-[#737686]">{filteredCharges.length} comprobantes en vista</span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#e2e8f0] shadow-lumina-card">
          <span className="text-[11px] font-bold text-[#737686] uppercase tracking-wider block">Cobrado / Recaudado</span>
          <span className="text-2xl font-black text-[#10B981] mt-1 block font-tnum">${totalPaid.toFixed(2)} USD</span>
          <span className="text-[11px] text-[#059669] font-bold">
            {totalBilled > 0 ? `${Math.round((totalPaid / totalBilled) * 100)}% de efectividad` : "0%"}
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#e2e8f0] shadow-lumina-card">
          <span className="text-[11px] font-bold text-[#737686] uppercase tracking-wider block">Cartera Pendiente</span>
          <span className="text-2xl font-black text-[#f59e0b] mt-1 block font-tnum">${totalPending.toFixed(2)} USD</span>
          <span className="text-[11px] text-amber-600 font-bold">Por recaudar o abonar</span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#e2e8f0] shadow-lumina-card">
          <span className="text-[11px] font-bold text-[#737686] uppercase tracking-wider block">Gastos OPEX Periodo</span>
          <span className="text-2xl font-black text-[#ef4444] mt-1 block font-tnum">
            ${expenses.reduce((s, e) => s + e.amount, 0).toFixed(2)} USD
          </span>
          <span className="text-[11px] text-[#737686]">{expenses.length} egresos operativos</span>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-lumina-card overflow-hidden">
        {/* Filter Toolbar */}
        <div className="p-4 border-b border-[#e2e8f0] flex flex-wrap items-center justify-between gap-3 bg-white">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-[#737686] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar por cliente, RUC o N° Factura..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white text-xs text-[#0b1c30] rounded-lg pl-9 pr-3 py-2 border border-[#cbd5e1] focus:outline-hidden focus:border-[#004ac6]"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#737686]">Desde:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-white text-xs font-medium text-[#434655] rounded-lg px-2.5 py-1.5 border border-[#cbd5e1] focus:outline-hidden cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#737686]">Hasta:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-white text-xs font-medium text-[#434655] rounded-lg px-2.5 py-1.5 border border-[#cbd5e1] focus:outline-hidden cursor-pointer"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white text-xs font-medium text-[#434655] rounded-lg px-3 py-2 border border-[#cbd5e1] focus:outline-hidden cursor-pointer"
            >
              <option value="todos">Todos los Estados</option>
              <option value="pendiente">Pendientes</option>
              <option value="pagado">Pagados</option>
            </select>

            {(searchQuery || startDate || endDate || statusFilter !== "todos") && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setStartDate("");
                  setEndDate("");
                  setStatusFilter("todos");
                }}
                className="text-xs text-[#004ac6] hover:underline font-semibold cursor-pointer px-2"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {/* Invoices Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-[11px] uppercase tracking-wider border-b border-[#e2e8f0]">
              <tr>
                <th className="py-3.5 px-5">Comprobante #</th>
                <th className="py-3.5 px-5">Cliente / RUC</th>
                <th className="py-3.5 px-5">Concepto / Servicio</th>
                <th className="py-3.5 px-5 font-tnum text-right">Subtotal</th>
                <th className="py-3.5 px-5 font-tnum text-right">IVA 15%</th>
                <th className="py-3.5 px-5 font-tnum text-right">Total Factura</th>
                <th className="py-3.5 px-5 text-center">Estado</th>
                <th className="py-3.5 px-5 text-right">Gestión de Pago</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9] font-medium text-[#434655]">
              {filteredCharges.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-[#737686] italic">
                    No se encontraron órdenes de pedido o facturas con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredCharges.map((c) => (
                  <tr key={c.id} className="hover:bg-[#f8f9ff] transition-colors">
                    {/* Comprobante */}
                    <td className="py-3.5 px-5 font-mono font-bold text-[#0b1c30]">
                      <div>{c.invoiceNumber}</div>
                      {c.isOccasional && (
                        <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-purple-50 text-purple-700 border border-purple-200">
                          Servicio Ocasional
                        </span>
                      )}
                      {c.parentChargeId && (
                        <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
                          Saldo Pendiente
                        </span>
                      )}
                    </td>

                    {/* Cliente */}
                    <td className="py-3.5 px-5">
                      <p className="font-bold text-[#0b1c30]">{c.clientName}</p>
                      <span className="font-mono text-[11px] text-[#737686]">{c.clientRuc}</span>
                    </td>

                    {/* Concepto */}
                    <td className="py-3.5 px-5 text-[#434655] max-w-xs">
                      <div>{c.serviceDescription}</div>
                      {c.maxPaymentDate && (
                        <span className="text-[10px] text-amber-700 font-semibold flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          Fecha máx. pago: {c.maxPaymentDate}
                        </span>
                      )}
                    </td>

                    {/* Subtotal & IVA */}
                    <td className="py-3.5 px-5 font-mono text-right text-[#737686]">${c.subtotal.toFixed(2)}</td>
                    <td className="py-3.5 px-5 font-mono text-right text-[#737686]">${c.ivaAmount.toFixed(2)}</td>

                    {/* Total */}
                    <td className="py-3.5 px-5 font-mono font-bold text-[#0b1c30] text-right">
                      ${c.total.toFixed(2)}
                    </td>

                    {/* Estado */}
                    <td className="py-3.5 px-5 text-center">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          c.status === "pagado"
                            ? "bg-[#ecfdf5] text-[#065f46] border border-[#a7f3d0]"
                            : "bg-[#fffbeb] text-[#92400e] border border-[#fde68a]"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            c.status === "pagado" ? "bg-[#10B981]" : "bg-[#f59e0b]"
                          }`}
                        />
                        {c.status.toUpperCase()}
                      </span>
                    </td>

                    {/* Acciones */}
                    <td className="py-3.5 px-5 text-right">
                      {c.status === "pendiente" ? (
                        <button
                          onClick={() => openPaymentModal(c)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-lg text-xs font-bold shadow-2xs transition-all cursor-pointer"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>Registrar Pago</span>
                        </button>
                      ) : (
                        <div className="text-right">
                          <span className="text-[11px] font-bold text-[#10B981] block">
                            ✓ {c.paymentMethod || "Transferencia"}
                          </span>
                          {c.paymentReference && (
                            <span className="text-[10px] font-mono text-[#737686] block">
                              Ref: {c.paymentReference}
                            </span>
                          )}
                          <span className="text-[10px] text-[#737686] block">
                            {c.paymentDate}
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Registrar Pago (Con opción de Abono) */}
      {payingCharge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-lumina-dropdown border border-[#e2e8f0] overflow-hidden">
            <div className="p-4 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8f9ff]">
              <h3 className="font-bold text-[#0b1c30] text-sm flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#004ac6]" />
                Registrar Pago de Factura #{payingCharge.invoiceNumber}
              </h3>
              <button
                onClick={() => setPayingCharge(null)}
                className="p-1 rounded-lg text-[#737686] hover:text-[#0b1c30] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmPayment} className="p-5 space-y-4 text-xs">
              <div className="bg-[#f8f9ff] p-3 rounded-xl border border-[#e2e8f0] space-y-1">
                <div className="flex justify-between">
                  <span className="text-[#737686]">Cliente:</span>
                  <span className="font-bold text-[#0b1c30]">{payingCharge.clientName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#737686]">RUC / C.I.:</span>
                  <span className="font-mono text-[#0b1c30]">{payingCharge.clientRuc}</span>
                </div>
                <div className="flex justify-between text-sm pt-1 border-t border-[#e2e8f0]">
                  <span className="font-bold text-[#0b1c30]">Monto Total Factura:</span>
                  <span className="font-mono font-bold text-[#004ac6]">${payingCharge.total.toFixed(2)} USD</span>
                </div>
              </div>

              {/* Toggle Abono */}
              <div className="flex items-center gap-3 p-3 rounded-xl border border-[#cbd5e1] bg-white">
                <input
                  type="checkbox"
                  id="toggleAbono"
                  checked={isAbono}
                  onChange={(e) => {
                    setIsAbono(e.target.checked);
                    if (e.target.checked) {
                      setAbonoAmount(parseFloat((payingCharge.total / 2).toFixed(2)));
                    } else {
                      setAbonoAmount(payingCharge.total);
                    }
                  }}
                  className="w-4 h-4 text-[#004ac6] rounded border-[#cbd5e1] focus:ring-[#004ac6] cursor-pointer"
                />
                <label htmlFor="toggleAbono" className="font-bold text-[#0b1c30] cursor-pointer flex-1">
                  ¿Es un Abono o Pago Parcial?
                  <span className="block text-[11px] font-normal text-[#737686]">
                    Se liquidará este abono y se generará una nueva factura con el saldo restante.
                  </span>
                </label>
              </div>

              {isAbono && (
                <div className="space-y-2 p-3 bg-amber-50/50 rounded-xl border border-amber-200">
                  <label className="font-bold text-amber-900 block">Monto a Abonar ($ USD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max={payingCharge.total - 0.01}
                    required
                    value={abonoAmount}
                    onChange={(e) => setAbonoAmount(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-amber-300 rounded-lg px-3 py-2 font-bold text-[#0b1c30] text-sm"
                  />
                  <div className="flex justify-between text-[11px] text-amber-800 font-semibold pt-1">
                    <span>Saldo restante a diferir:</span>
                    <span className="font-mono font-bold">
                      ${Math.max(0, payingCharge.total - abonoAmount).toFixed(2)} USD
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="font-bold text-[#434655] block mb-1">Forma de Pago *</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 font-semibold text-[#0b1c30]"
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-[#434655] block mb-1">
                  Número de Referencia / Voucher / Cheque *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: DEP-894210 / TRANSF-90214 / CHQ-0041"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 font-semibold text-[#0b1c30]"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-[#e2e8f0]">
                <button
                  type="button"
                  onClick={() => setPayingCharge(null)}
                  className="px-4 py-2 text-[#737686] hover:bg-[#f8f9ff] rounded-lg font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-lg font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirmar & Registrar Pago</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Factura Manual / Servicio Ocasional */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-lumina-dropdown border border-[#e2e8f0] overflow-hidden">
            <div className="p-4 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8f9ff]">
              <h3 className="font-bold text-[#0b1c30] text-sm flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#004ac6]" />
                Nueva Factura / Cobro para Servicio Ocasional
              </h3>
              <button
                onClick={() => setIsManualModalOpen(false)}
                className="p-1 rounded-lg text-[#737686] hover:text-[#0b1c30] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateManualInvoice} className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-bold text-[#434655] block mb-1">Abonado / Cliente Destinatario *</label>
                <select
                  value={manualClientId}
                  onChange={(e) => setManualClientId(e.target.value)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 font-semibold text-[#0b1c30]"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.businessName} ({c.identificationNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-[#434655] block mb-1">Concepto del Servicio Ocasional *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Instalación de Router WiFi 6 adicional / Visita técnica en sitio"
                  value={manualConcept}
                  onChange={(e) => setManualConcept(e.target.value)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 font-semibold text-[#0b1c30]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#434655] block mb-1">Valor Total ($ USD con IVA) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={manualAmount}
                    onChange={(e) => setManualAmount(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 font-bold text-[#0b1c30] text-sm"
                  />
                  <span className="text-[10px] text-[#737686] block mt-1">
                    Subtotal: ${(manualAmount / 1.15).toFixed(2)} + IVA 15%
                  </span>
                </div>

                <div>
                  <label className="font-bold text-[#434655] block mb-1">Fecha Máxima de Pago *</label>
                  <input
                    type="date"
                    required
                    value={manualMaxDate}
                    onChange={(e) => setManualMaxDate(e.target.value)}
                    className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 font-semibold text-[#0b1c30]"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-[#e2e8f0]">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-4 py-2 text-[#737686] hover:bg-[#f8f9ff] rounded-lg font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-lg font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Emitir Factura Manual</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
