"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import {
  CreditCard,
  Search,
  CheckCircle,
  Clock,
  AlertTriangle,
  Calendar,
  Building2,
  DollarSign,
  Plus,
  X,
  History,
} from "lucide-react";
import { PurchaseInvoice } from "@/types";

export function AccountsPayableTab() {
  const {
    purchaseInvoices,
    bankAccounts,
    supplierPayments,
    addSupplierPayment,
    currentUser,
  } = useApp();
  const { showSuccess, showError } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterDueStatus, setFilterDueStatus] = useState("todos");

  // Payment Modal State
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [bankAccountId, setBankAccountId] = useState<string>(bankAccounts[0]?.id || "");
  const [paymentMethod, setPaymentMethod] = useState<"transferencia" | "cheque" | "efectivo">("transferencia");
  const [referenceNumber, setReferenceNumber] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [paymentNotes, setPaymentNotes] = useState<string>("");

  const todayStr = new Date().toISOString().slice(0, 10);

  // Helper to determine due status
  const getDueStatus = (dueDate?: string) => {
    if (!dueDate) return { label: "Al Día", color: "green", days: 99 };
    const due = new Date(dueDate).getTime();
    const today = new Date(todayStr).getTime();
    const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { label: "Vencida", color: "red", days: diffDays };
    if (diffDays <= 5) return { label: "Por Vencer", color: "yellow", days: diffDays };
    return { label: "Al Día", color: "green", days: diffDays };
  };

  const handleOpenPaymentModal = (inv: PurchaseInvoice) => {
    setSelectedInvoice(inv);
    setPaymentAmount(inv.balanceRemaining);
    setReferenceNumber(`TRF-${Date.now().toString().slice(-6)}`);
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    if (paymentAmount <= 0) {
      showError("Monto Inválido", "El monto a pagar debe ser mayor a cero.");
      return;
    }
    if (paymentAmount > selectedInvoice.balanceRemaining + 0.01) {
      showError("Exceso de Monto", `El monto ingresado ($${paymentAmount.toFixed(2)}) supera el saldo pendiente ($${selectedInvoice.balanceRemaining.toFixed(2)}).`);
      return;
    }

    const bank = bankAccounts.find((b) => b.id === bankAccountId) || bankAccounts[0];
    if (!bank) {
      showError("Cuenta Requerida", "Debes seleccionar una cuenta bancaria.");
      return;
    }

    if (bank.currentBalance < paymentAmount) {
      showError("Fondos Insuficientes", `La cuenta ${bank.bankName} solo dispone de $${bank.currentBalance.toFixed(2)}.`);
      return;
    }

    try {
      await addSupplierPayment({
        purchaseInvoiceId: selectedInvoice.id,
        supplierId: selectedInvoice.supplierId,
        supplierName: selectedInvoice.supplierName,
        date: paymentDate,
        amount: Number(paymentAmount),
        bankAccountId: bank.id,
        bankAccountName: bank.bankName,
        paymentMethod,
        referenceNumber: referenceNumber.trim() || `TRF-${Date.now().toString().slice(-6)}`,
        notes: paymentNotes.trim() || undefined,
        registeredBy: currentUser.displayName,
      });

      showSuccess(
        "Abono Registrado",
        `Pago por $${paymentAmount.toFixed(2)} aplicado a ${selectedInvoice.supplierName} desde ${bank.bankName}.`
      );

      setSelectedInvoice(null);
    } catch (err: any) {
      showError("Error al Pagar", err?.message || "No se pudo registrar el pago al proveedor.");
    }
  };

  // Only invoices with pending balances or credit purchases
  const pendingInvoices = purchaseInvoices.filter(
    (inv) => inv.balanceRemaining > 0 || inv.paymentStatus !== "pagado"
  );

  const filteredInvoices = pendingInvoices.filter((inv) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      inv.supplierName.toLowerCase().includes(q) ||
      inv.supplierRuc.includes(q) ||
      inv.documentNumber.includes(q);

    const dueInfo = getDueStatus(inv.dueDate);
    const matchDue =
      filterDueStatus === "todos" ||
      (filterDueStatus === "vencidas" && dueInfo.color === "red") ||
      (filterDueStatus === "por_vencer" && dueInfo.color === "yellow") ||
      (filterDueStatus === "al_dia" && dueInfo.color === "green");

    return matchSearch && matchDue;
  });

  // KPI calculations
  const totalCxP = pendingInvoices.reduce((sum, inv) => sum + inv.balanceRemaining, 0);
  const totalVencidas = pendingInvoices
    .filter((inv) => getDueStatus(inv.dueDate).color === "red")
    .reduce((sum, inv) => sum + inv.balanceRemaining, 0);
  const totalPorVencer = pendingInvoices
    .filter((inv) => getDueStatus(inv.dueDate).color === "yellow")
    .reduce((sum, inv) => sum + inv.balanceRemaining, 0);
  const totalPagadoHistorico = purchaseInvoices.reduce((sum, inv) => sum + inv.paidAmount, 0);

  return (
    <div className="space-y-6 select-none">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs">
          <div className="flex items-center justify-between text-[#737686] text-xs font-semibold">
            <span>Total Cuentas por Pagar (CxP)</span>
            <div className="p-2 bg-[#fffbeb] text-[#b45309] rounded-xl">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-[#b45309]">
            ${totalCxP.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="mt-1 text-[11px] text-[#737686]">{pendingInvoices.length} facturas con saldo</p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs">
          <div className="flex items-center justify-between text-[#737686] text-xs font-semibold">
            <span>Deudas Vencidas</span>
            <div className="p-2 bg-[#fef2f2] text-[#dc2626] rounded-xl">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-[#dc2626]">
            ${totalVencidas.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="mt-1 text-[11px] text-[#dc2626] font-medium">Plazo de crédito comercial superado</p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs">
          <div className="flex items-center justify-between text-[#737686] text-xs font-semibold">
            <span>Por Vencer (&le; 5 días)</span>
            <div className="p-2 bg-[#fffbeb] text-[#d97706] rounded-xl">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-[#d97706]">
            ${totalPorVencer.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="mt-1 text-[11px] text-[#d97706] font-medium">Próximos compromisos bancarios</p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs">
          <div className="flex items-center justify-between text-[#737686] text-xs font-semibold">
            <span>Total Pagado Acumulado</span>
            <div className="p-2 bg-[#ecfdf5] text-[#059669] rounded-xl">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-[#059669]">
            ${totalPagadoHistorico.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="mt-1 text-[11px] text-[#059669]">Obligaciones liquidadas</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-[#737686] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por proveedor, RUC o N° Factura..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#f8f9ff] border border-[#e2e8f0] rounded-xl text-xs text-[#0b1c30] placeholder-[#737686] focus:outline-hidden focus:border-[#004ac6]"
          />
        </div>

        <select
          value={filterDueStatus}
          onChange={(e) => setFilterDueStatus(e.target.value)}
          className="px-3 py-2 bg-[#f8f9ff] border border-[#e2e8f0] rounded-xl text-xs font-medium text-[#434655]"
        >
          <option value="todos">Todos los Vencimientos</option>
          <option value="vencidas">🔴 Solo Vencidas</option>
          <option value="por_vencer">🟡 Por Vencer (&le; 5 días)</option>
          <option value="al_dia">🟢 Al Día</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-[#f8f9ff] text-[#434655] border-b border-[#e2e8f0]">
            <tr>
              <th className="py-3 px-4 font-bold">N° Factura</th>
              <th className="py-3 px-4 font-bold">Proveedor / RUC</th>
              <th className="py-3 px-4 font-bold">Emisión</th>
              <th className="py-3 px-4 font-bold">Vencimiento</th>
              <th className="py-3 px-4 font-bold text-center">Semáforo</th>
              <th className="py-3 px-4 font-bold text-right">Total Factura</th>
              <th className="py-3 px-4 font-bold text-right">Abonado</th>
              <th className="py-3 px-4 font-bold text-right">Saldo Pendiente</th>
              <th className="py-3 px-4 font-bold text-center">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e2e8f0]">
            {filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-xs text-[#737686]">
                  No hay cuentas por pagar pendientes registradas con los filtros actuales.
                </td>
              </tr>
            ) : (
              filteredInvoices.map((inv) => {
                const dueInfo = getDueStatus(inv.dueDate);

                return (
                  <tr key={inv.id} className="hover:bg-[#f8f9ff]/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-[#004ac6] whitespace-nowrap">
                      {inv.documentNumber}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#0b1c30]">{inv.supplierName}</div>
                      <div className="text-[11px] font-mono text-[#737686]">{inv.supplierRuc}</div>
                    </td>
                    <td className="py-3 px-4 text-[#434655] whitespace-nowrap">{inv.date}</td>
                    <td className="py-3 px-4 font-medium text-[#0b1c30] whitespace-nowrap">
                      {inv.dueDate || "Sin plazo"}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          dueInfo.color === "red"
                            ? "bg-[#fef2f2] text-[#dc2626] border border-[#fecaca]"
                            : dueInfo.color === "yellow"
                            ? "bg-[#fffbeb] text-[#b45309] border border-[#fde68a]"
                            : "bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0]"
                        }`}
                      >
                        {dueInfo.label}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-[#434655]">
                      ${inv.total.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-[#059669]">
                      ${inv.paidAmount.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-[#b45309]">
                      ${inv.balanceRemaining.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleOpenPaymentModal(inv)}
                        className="px-3 py-1 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
                      >
                        Abonar / Pagar
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Registrar Abono/Pago CxP */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#e2e8f0] w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8f9ff]">
              <div>
                <h3 className="text-base font-bold text-[#0b1c30]">Registrar Abono a Proveedor</h3>
                <p className="text-xs text-[#737686]">Factura {selectedInvoice.documentNumber} - {selectedInvoice.supplierName}</p>
              </div>
              <button onClick={() => setSelectedInvoice(null)} className="p-1.5 rounded-lg text-[#737686] hover:bg-[#e2e8f0]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitPayment} className="p-6 space-y-4">
              <div className="p-3 bg-[#eff4ff] rounded-xl border border-[#bfdbfe] text-xs grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[#737686]">Total Factura:</span>
                  <div className="font-mono font-bold text-[#0b1c30]">${selectedInvoice.total.toFixed(2)}</div>
                </div>
                <div>
                  <span className="text-[#737686]">Saldo Pendiente:</span>
                  <div className="font-mono font-bold text-[#b45309] text-sm">${selectedInvoice.balanceRemaining.toFixed(2)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">
                    Monto a Pagar ($ USD) *
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    max={selectedInvoice.balanceRemaining}
                    step="any"
                    value={paymentAmount || ""}
                    onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                    required
                    className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-xs font-mono font-bold text-[#004ac6]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">
                    Fecha del Pago *
                  </label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">
                    Cuenta Bancaria Origen *
                  </label>
                  <select
                    value={bankAccountId}
                    onChange={(e) => setBankAccountId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-xs"
                  >
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bankName} (${b.currentBalance.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">
                    Método de Pago
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-xs"
                  >
                    <option value="transferencia">Transferencia Bancaria</option>
                    <option value="cheque">Cheque</option>
                    <option value="efectivo">Efectivo / Caja</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">
                  N° Comprobante / Referencia Transferencia *
                </label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">
                  Observaciones
                </label>
                <input
                  type="text"
                  placeholder="Detalle del pago..."
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#e2e8f0]">
                <button type="button" onClick={() => setSelectedInvoice(null)} className="px-4 py-2 text-xs font-semibold text-[#434655]">
                  Cancelar
                </button>
                <button type="submit" className="px-5 py-2.5 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer">
                  Confirmar Pago & Descontar Saldo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
