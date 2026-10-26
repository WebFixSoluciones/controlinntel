"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { safeNumber, safeFloat } from "@/lib/print-service";
import {
  Search,
  CheckCircle,
  Clock,
  DollarSign,
  X,
} from "lucide-react";
import { MonthlyCharge } from "@/types";

export function AccountsReceivableTab() {
  const { monthlyCharges, markChargeAsPaid, bankAccounts } = useApp();
  const { showSuccess, showError } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");

  const [selectedCharge, setSelectedCharge] = useState<MonthlyCharge | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [bankAccountId, setBankAccountId] = useState<string>(bankAccounts[0]?.id || "");
  const [paymentMethod, setPaymentMethod] = useState<string>("Transferencia Bancaria");
  const [paymentRef, setPaymentRef] = useState<string>("");

  const handleOpenCobroModal = (charge: MonthlyCharge) => {
    setSelectedCharge(charge);
    setPaymentAmount(charge.balanceRemaining !== undefined ? charge.balanceRemaining : charge.total);
    setBankAccountId(bankAccounts.find((b) => b.status === "activa")?.id || bankAccounts[0]?.id || "");
    setPaymentRef(`REF-${Date.now().toString().slice(-6)}`);
  };

  const handleConfirmCobro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCharge) return;

    if (paymentAmount <= 0) {
      showError("Monto Inválido", "El monto a cobrar debe ser mayor a $0.00.");
      return;
    }

    try {
      const currentBalance =
        selectedCharge.balanceRemaining !== undefined
          ? selectedCharge.balanceRemaining
          : selectedCharge.total;

      const newRemaining = Math.max(0, parseFloat((currentBalance - paymentAmount).toFixed(2)));

      await markChargeAsPaid(
        selectedCharge.id,
        paymentMethod,
        paymentRef.trim() || undefined,
        paymentAmount,
        newRemaining,
        bankAccountId
      );

      showSuccess(
        "Cobro Guardado",
        `Se registró $${paymentAmount.toFixed(2)} para ${selectedCharge.clientName}.`
      );

      setSelectedCharge(null);
    } catch (err: any) {
      showError("Error", err?.message || "No se pudo guardar el cobro.");
    }
  };

  const filteredCharges = (monthlyCharges || []).filter((c) => {
    if (!c) return false;
    const q = (searchQuery || "").toLowerCase();
    const name = (c.clientName || "").toLowerCase();
    const ruc = String(c.clientRuc || "");
    const inv = (c.invoiceNumber || "").toLowerCase();

    const matchSearch = name.includes(q) || ruc.includes(q) || inv.includes(q);

    const matchStatus =
      filterStatus === "todos" ||
      (filterStatus === "pendiente" && c.status !== "pagado") ||
      (filterStatus === "pagado" && c.status === "pagado");

    return matchSearch && matchStatus;
  });

  const totalFacturado = (monthlyCharges || []).reduce((sum, c) => sum + (safeFloat(c.total) || 0), 0);
  const totalCobrado = (monthlyCharges || [])
    .filter((c) => c && (c.status === "pagado" || safeFloat(c.paidAmount) > 0))
    .reduce((sum, c) => sum + (safeFloat(c.paidAmount) || (c.status === "pagado" ? safeFloat(c.total) : 0)), 0);
  const totalPorCobrar = Math.max(0, totalFacturado - totalCobrado);

  return (
    <div className="space-y-5">
      {/* 3 Tarjetas Directas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-xl border border-[#e2e8f0] shadow-2xs">
          <div className="flex items-center justify-between text-slate-600 text-xs font-semibold">
            <span>Total por Cobrar</span>
            <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1.5 text-xl font-bold font-mono text-amber-600">
            ${safeNumber(totalPorCobrar)}
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-[#e2e8f0] shadow-2xs">
          <div className="flex items-center justify-between text-slate-600 text-xs font-semibold">
            <span>Total Cobrado</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1.5 text-xl font-bold font-mono text-emerald-600">
            ${safeNumber(totalCobrado)}
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-[#e2e8f0] shadow-2xs">
          <div className="flex items-center justify-between text-slate-600 text-xs font-semibold">
            <span>Total Emitido</span>
            <div className="p-1.5 bg-blue-50 text-[#004ac6] rounded-lg">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1.5 text-xl font-bold font-mono text-[#004ac6]">
            ${safeNumber(totalFacturado)}
          </div>
        </div>
      </div>

      {/* Búsqueda y Filtro */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-white rounded-xl border border-[#e2e8f0] shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar cliente, RUC o N° comprobante..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-[#f8f9ff] border border-[#e2e8f0] rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:border-[#004ac6]"
          />
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-1.5 bg-[#f8f9ff] border border-[#e2e8f0] rounded-lg text-xs font-semibold text-slate-700 focus:bg-white focus:outline-hidden focus:border-[#004ac6] cursor-pointer"
        >
          <option value="todos">Todos los Estados</option>
          <option value="pendiente">Pendientes</option>
          <option value="pagado">Cobrados</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
        <table className="table-fixed w-full text-left text-xs border-collapse">
          <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-xs uppercase tracking-wider border-b border-[#e2e8f0]">
            <tr>
              <th className="w-2/12 py-3 px-4">Comprobante</th>
              <th className="w-3/12 py-3 px-4">Cliente</th>
              <th className="w-2/12 py-3 px-4">Servicio</th>
              <th className="w-1/12 py-3 px-4 text-center">Periodo</th>
              <th className="w-1/12 py-3 px-4 text-right">Total</th>
              <th className="w-1/12 py-3 px-4 text-right">Saldo</th>
              <th className="w-1/12 py-3 px-4 text-center">Estado</th>
              <th className="w-1/12 py-3 px-4 text-center">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9]">
            {filteredCharges.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-10 text-center text-xs text-slate-400">
                  No se encontraron cuentas por cobrar.
                </td>
              </tr>
            ) : (
              filteredCharges.map((c) => {
                const isPaid = c.status === "pagado";
                const balance = c.balanceRemaining !== undefined ? c.balanceRemaining : isPaid ? 0 : c.total;

                return (
                  <tr key={c.id} className="hover:bg-[#f8f9ff] transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-[#004ac6]">{c.invoiceNumber}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 truncate">{c.clientName}</div>
                      <div className="text-[11px] font-mono text-slate-500">{c.clientRuc}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 truncate">{c.serviceDescription}</td>
                    <td className="py-3 px-4 text-center text-slate-500 font-mono">
                      {c.month}/{c.year}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700">
                      ${safeNumber(c.total)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      ${safeNumber(balance)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                          isPaid
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {isPaid ? "Cobrado" : "Pendiente"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {!isPaid ? (
                        <button
                          onClick={() => handleOpenCobroModal(c)}
                          className="px-3 py-1 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer"
                        >
                          Cobrar
                        </button>
                      ) : (
                        <span className="text-emerald-600 text-xs font-medium">Pagado</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Registrar Cobro */}
      {selectedCharge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Registrar Cobro</h3>
                <p className="text-xs text-slate-500">{selectedCharge.clientName}</p>
              </div>
              <button
                onClick={() => setSelectedCharge(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmCobro} className="p-5 space-y-3.5 text-xs">
              <div className="p-3 bg-blue-50/70 rounded-lg border border-blue-200/80 flex justify-between">
                <span className="text-slate-600">Saldo Pendiente:</span>
                <span className="font-mono font-bold text-[#004ac6]">
                  ${(selectedCharge.balanceRemaining !== undefined ? selectedCharge.balanceRemaining : selectedCharge.total).toFixed(2)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Monto a Cobrar ($) *
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={paymentAmount || ""}
                    onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                    required
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-emerald-700"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Cuenta / Banco Destino *
                  </label>
                  <select
                    value={bankAccountId}
                    onChange={(e) => setBankAccountId(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs"
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
                  <label className="font-bold text-slate-700 block mb-1">
                    Forma de Pago
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                    <option value="Depósito Bancario">Depósito Bancario</option>
                    <option value="Efectivo">Efectivo</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Tarjeta">Tarjeta</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    N° Referencia
                  </label>
                  <input
                    type="text"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setSelectedCharge(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                >
                  Guardar Cobro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
