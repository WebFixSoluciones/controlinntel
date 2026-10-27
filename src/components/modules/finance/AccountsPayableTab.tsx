"use client";
import { getEcuadorDate } from "@/lib/date-utils";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { safeNumber, safeFloat } from "@/lib/print-service";
import {
  CreditCard,
  Search,
  CheckCircle,
  AlertTriangle,
  X,
} from "lucide-react";
import { PurchaseInvoice } from "@/types";

export function AccountsPayableTab() {
  const {
    purchaseInvoices,
    bankAccounts,
    addSupplierPayment,
    supplierCredits,
    currentUser,
  } = useApp();
  const { showSuccess, showError } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterDueStatus, setFilterDueStatus] = useState("todos");

  // Modal de Pago
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [bankAccountId, setBankAccountId] = useState<string>(bankAccounts[0]?.id || "");
  const [paymentMethod, setPaymentMethod] = useState<"transferencia" | "cheque" | "efectivo">("transferencia");
  const [referenceNumber, setReferenceNumber] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(getEcuadorDate());
  const [supplierCreditId, setSupplierCreditId] = useState("");

  const todayStr = getEcuadorDate();

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
    setSupplierCreditId("");
    setPaymentAmount(inv.balanceRemaining);
    setBankAccountId(bankAccounts.find((b) => b.status === "activa")?.id || bankAccounts[0]?.id || "");
    setReferenceNumber(`REF-${Date.now().toString().slice(-6)}`);
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    if (paymentAmount <= 0) {
      showError("Monto Inválido", "El monto a pagar debe ser mayor a $0.00.");
      return;
    }
    if (paymentAmount > selectedInvoice.balanceRemaining + 0.01) {
      showError(
        "Monto Excedido",
        `El monto ($${paymentAmount.toFixed(2)}) supera el saldo pendiente ($${selectedInvoice.balanceRemaining.toFixed(2)}).`
      );
      return;
    }

    const bank = bankAccounts.find((b) => b.id === bankAccountId);
    if (!bank && !supplierCreditId) {
      showError("Cuenta Requerida", "Selecciona una cuenta bancaria.");
      return;
    }

    if (!supplierCreditId && bank && bank.currentBalance < paymentAmount) {
      showError(
        "Saldo Insuficiente",
        `La cuenta ${bank.bankName} dispone de $${bank.currentBalance.toFixed(2)}.`
      );
      return;
    }

    try {
      await addSupplierPayment({
        purchaseInvoiceId: selectedInvoice.id,
        supplierId: selectedInvoice.supplierId,
        supplierName: selectedInvoice.supplierName,
        date: paymentDate,
        amount: Number(paymentAmount),
        bankAccountId: supplierCreditId ? "" : bank!.id,
        bankAccountName: supplierCreditId ? "Saldo a favor del proveedor" : bank!.bankName,
        paymentMethod: supplierCreditId ? "saldo_favor" : paymentMethod,
        supplierCreditId: supplierCreditId || undefined,
        referenceNumber: referenceNumber.trim() || `REF-${Date.now().toString().slice(-6)}`,
        registeredBy: currentUser.displayName,
      });

      showSuccess(
        "Pago Guardado",
        `Pago de $${paymentAmount.toFixed(2)} registrado para ${selectedInvoice.supplierName}.`
      );

      setSelectedInvoice(null);
    } catch (err: any) {
      showError("Error", err?.message || "No se pudo guardar el pago.");
    }
  };

  const pendingInvoices = (purchaseInvoices || []).filter(
    (inv) => inv && (safeFloat(inv.balanceRemaining) > 0 || inv.paymentStatus !== "pagado")
  );

  const filteredInvoices = pendingInvoices.filter((inv) => {
    if (!inv) return false;
    const q = (searchQuery || "").toLowerCase();
    const supName = (inv.supplierName || "").toLowerCase();
    const supRuc = String(inv.supplierRuc || "");
    const docNum = (inv.documentNumber || "").toLowerCase();

    const matchSearch =
      supName.includes(q) ||
      supRuc.includes(q) ||
      docNum.includes(q);

    const dueInfo = getDueStatus(inv.dueDate);
    const matchDue =
      filterDueStatus === "todos" ||
      (filterDueStatus === "vencidas" && dueInfo.color === "red") ||
      (filterDueStatus === "por_vencer" && dueInfo.color === "yellow") ||
      (filterDueStatus === "al_dia" && dueInfo.color === "green");

    return matchSearch && matchDue;
  });

  const totalCxP = pendingInvoices.reduce((sum, inv) => sum + (safeFloat(inv.balanceRemaining) || 0), 0);
  const totalVencidas = pendingInvoices
    .filter((inv) => getDueStatus(inv.dueDate).color === "red")
    .reduce((sum, inv) => sum + (safeFloat(inv.balanceRemaining) || 0), 0);
  const totalPagadoHistorico = (purchaseInvoices || []).reduce((sum, inv) => sum + (safeFloat(inv.paidAmount) || 0), 0);

  return (
    <div className="space-y-5">
      {/* 3 Tarjetas Directas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-xl border border-[#e2e8f0] shadow-2xs">
          <div className="flex items-center justify-between text-slate-600 text-xs font-semibold">
            <span>Total por Pagar</span>
            <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1.5 text-xl font-bold font-mono text-amber-600">
            ${safeNumber(totalCxP)}
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-[#e2e8f0] shadow-2xs">
          <div className="flex items-center justify-between text-slate-600 text-xs font-semibold">
            <span>Vencido</span>
            <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1.5 text-xl font-bold font-mono text-rose-600">
            ${safeNumber(totalVencidas)}
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-[#e2e8f0] shadow-2xs">
          <div className="flex items-center justify-between text-slate-600 text-xs font-semibold">
            <span>Total Pagado</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1.5 text-xl font-bold font-mono text-emerald-600">
            ${safeNumber(totalPagadoHistorico)}
          </div>
        </div>
      </div>

      {/* Búsqueda y Filtro */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-white rounded-xl border border-[#e2e8f0] shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar proveedor, RUC o N° factura..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-[#f8f9ff] border border-[#e2e8f0] rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:border-[#004ac6]"
          />
        </div>

        <select
          value={filterDueStatus}
          onChange={(e) => setFilterDueStatus(e.target.value)}
          className="px-3 py-1.5 bg-[#f8f9ff] border border-[#e2e8f0] rounded-lg text-xs font-semibold text-slate-700 focus:bg-white focus:outline-hidden focus:border-[#004ac6] cursor-pointer"
        >
          <option value="todos">Todos los Estados</option>
          <option value="vencidas">Vencidas</option>
          <option value="por_vencer">Por Vencer</option>
          <option value="al_dia">Al Día</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
        <table className="table-fixed w-full text-left text-xs border-collapse">
          <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-xs uppercase tracking-wider border-b border-[#e2e8f0]">
            <tr>
              <th className="w-2/12 py-3 px-4">Factura</th>
              <th className="w-3/12 py-3 px-4">Proveedor</th>
              <th className="w-1/12 py-3 px-4">Fecha</th>
              <th className="w-1/12 py-3 px-4">Vencimiento</th>
              <th className="w-1/12 py-3 px-4 text-center">Estado</th>
              <th className="w-1/12 py-3 px-4 text-right">Total</th>
              <th className="w-1/12 py-3 px-4 text-right">Pagado</th>
              <th className="w-1/12 py-3 px-4 text-right">Saldo</th>
              <th className="w-1/12 py-3 px-4 text-center">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9]">
            {filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-10 text-center text-xs text-slate-400">
                  No hay cuentas por pagar pendientes.
                </td>
              </tr>
            ) : (
              filteredInvoices.map((inv) => {
                const dueInfo = getDueStatus(inv.dueDate);

                return (
                  <tr key={inv.id} className="hover:bg-[#f8f9ff] transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-[#004ac6] whitespace-nowrap">
                      {inv.documentNumber}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 truncate">{inv.supplierName}</div>
                      <div className="text-[11px] font-mono text-slate-500">{inv.supplierRuc}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{inv.date}</td>
                    <td className="py-3 px-4 font-medium text-slate-800 whitespace-nowrap">
                      {inv.dueDate || "Sin plazo"}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                          dueInfo.color === "red"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : dueInfo.color === "yellow"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }`}
                      >
                        {dueInfo.label}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700">
                      ${safeNumber(inv.total)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-600">
                      ${safeNumber(inv.paidAmount)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-amber-700">
                      ${safeNumber(inv.balanceRemaining)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleOpenPaymentModal(inv)}
                        className="px-3 py-1 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer"
                      >
                        Pagar
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Registrar Pago */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-5 py-3.5 border-b border-blue-900/20 flex items-center justify-between bg-[#004ac6] text-white">
              <div>
                <h3 className="text-sm font-bold text-white">Registrar Pago a Proveedor</h3>
                <p className="text-xs text-blue-100">{selectedInvoice.supplierName}</p>
              </div>
              <button aria-label="Cerrar"
                onClick={() => setSelectedInvoice(null)}
                className="p-1 rounded-md text-white/80 hover:text-white hover:bg-white/10 cursor-pointer transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitPayment} className="p-5 space-y-3.5 text-xs">
              <label className="block font-semibold">Origen del pago<select value={supplierCreditId} onChange={e=>{setSupplierCreditId(e.target.value);const credit=supplierCredits.find(c=>c.id===e.target.value);if(credit)setPaymentAmount(Math.min(credit.remaining,selectedInvoice.balanceRemaining));}} className="block w-full border rounded px-3 py-2 mt-1"><option value="">Salida de banco o caja</option>{supplierCredits.filter(c=>c.supplierId===selectedInvoice.supplierId&&c.remaining>0).map(c=><option key={c.id} value={c.id}>Saldo a favor · ${safeNumber(c.remaining)}</option>)}</select></label>
              <div className="p-3 bg-blue-50/70 rounded-lg border border-blue-200/80 flex justify-between">
                <span className="text-slate-600">Factura {selectedInvoice.documentNumber}</span>
                <span className="font-mono font-bold text-amber-700">
                  Saldo: ${safeNumber(selectedInvoice.balanceRemaining)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="accounts-payable-tab-field-1" className="font-bold text-slate-700 block mb-1">
                    Monto a Pagar ($) *
                  </label>
                  <input id="accounts-payable-tab-field-1"
                    type="number"
                    min="0.01"
                    max={selectedInvoice.balanceRemaining}
                    step="0.01"
                    value={paymentAmount || ""}
                    onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                    required
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-[#004ac6]"
                  />
                </div>

                <div>
                  <label htmlFor="accounts-payable-tab-field-2" className="font-bold text-slate-700 block mb-1">
                    Fecha *
                  </label>
                  <input id="accounts-payable-tab-field-2"
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    required
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="accounts-payable-tab-field-3" className="font-bold text-slate-700 block mb-1">
                    Cuenta Bancaria *
                  </label>
                  <select id="accounts-payable-tab-field-3"
                    value={bankAccountId}
                    onChange={(e) => setBankAccountId(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                  >
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bankName} (${safeNumber(b.currentBalance)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="accounts-payable-tab-field-4" className="font-bold text-slate-700 block mb-1">
                    Forma de Pago
                  </label>
                  <select id="accounts-payable-tab-field-4"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="transferencia">Transferencia</option>
                    <option value="cheque">Cheque</option>
                    <option value="efectivo">Efectivo</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="accounts-payable-tab-field-5" className="font-bold text-slate-700 block mb-1">
                  N° Referencia / Comprobante *
                </label>
                <input id="accounts-payable-tab-field-5"
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setSelectedInvoice(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                >
                  Guardar Pago
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
