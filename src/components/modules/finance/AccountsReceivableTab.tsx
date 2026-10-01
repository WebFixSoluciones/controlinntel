"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import {
  Users,
  Search,
  CheckCircle,
  Clock,
  AlertTriangle,
  DollarSign,
  Calendar,
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
  const [paymentMethod, setPaymentMethod] = useState<string>("transferencia");
  const [paymentRef, setPaymentRef] = useState<string>("");

  const handleOpenCobroModal = (charge: MonthlyCharge) => {
    setSelectedCharge(charge);
    setPaymentAmount(charge.balanceRemaining !== undefined ? charge.balanceRemaining : charge.total);
    setPaymentRef(`DEP-${Date.now().toString().slice(-6)}`);
  };

  const handleConfirmCobro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCharge) return;

    if (paymentAmount <= 0) {
      showError("Monto Inválido", "El monto a cobrar debe ser mayor a 0.");
      return;
    }

    try {
      const currentBalance =
        selectedCharge.balanceRemaining !== undefined
          ? selectedCharge.balanceRemaining
          : selectedCharge.total;

      const newRemaining = Math.max(0, currentBalance - paymentAmount);

      await markChargeAsPaid(
        selectedCharge.id,
        paymentMethod,
        paymentRef.trim() || undefined,
        paymentAmount,
        newRemaining
      );

      showSuccess(
        "Cobro Registrado",
        `Se asentó el cobro de $${paymentAmount.toFixed(2)} para ${selectedCharge.clientName}.`
      );

      setSelectedCharge(null);
    } catch (err: any) {
      showError("Error al Cobrar", err?.message || "No se pudo registrar la cobranza.");
    }
  };

  const filteredCharges = monthlyCharges.filter((c) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      c.clientName.toLowerCase().includes(q) ||
      c.clientRuc.includes(q) ||
      c.invoiceNumber.includes(q);

    const matchStatus =
      filterStatus === "todos" ||
      (filterStatus === "pendiente" && c.status === "pendiente") ||
      (filterStatus === "pagado" && c.status === "pagado");

    return matchSearch && matchStatus;
  });

  const totalFacturado = monthlyCharges.reduce((sum, c) => sum + c.total, 0);
  const totalCobrado = monthlyCharges
    .filter((c) => c.status === "pagado")
    .reduce((sum, c) => sum + c.total, 0);
  const totalPorCobrar = monthlyCharges
    .filter((c) => c.status === "pendiente")
    .reduce((sum, c) => sum + (c.balanceRemaining !== undefined ? c.balanceRemaining : c.total), 0);

  return (
    <div className="space-y-6 select-none">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs">
          <div className="flex items-center justify-between text-[#737686] text-xs font-semibold">
            <span>Cartera Total por Cobrar</span>
            <div className="p-2 bg-[#fffbeb] text-[#b45309] rounded-xl">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-[#b45309]">
            ${totalPorCobrar.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="mt-1 text-[11px] text-[#b45309]">Valores pendientes de clientes</p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs">
          <div className="flex items-center justify-between text-[#737686] text-xs font-semibold">
            <span>Recaudación Confirmada</span>
            <div className="p-2 bg-[#ecfdf5] text-[#059669] rounded-xl">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-[#059669]">
            ${totalCobrado.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="mt-1 text-[11px] text-[#059669]">Ingresado a bancos y caja</p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs">
          <div className="flex items-center justify-between text-[#737686] text-xs font-semibold">
            <span>Total Facturación Emitida</span>
            <div className="p-2 bg-[#eff4ff] text-[#004ac6] rounded-xl">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-[#004ac6]">
            ${totalFacturado.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="mt-1 text-[11px] text-[#737686]">{monthlyCharges.length} facturas generadas</p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs">
          <div className="flex items-center justify-between text-[#737686] text-xs font-semibold">
            <span>Efectividad de Cobro</span>
            <div className="p-2 bg-[#eff4ff] text-[#004ac6] rounded-xl">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-[#0b1c30]">
            {totalFacturado > 0 ? ((totalCobrado / totalFacturado) * 100).toFixed(1) : "0"}%
          </div>
          <p className="mt-1 text-[11px] text-[#737686]">Índice de recaudación comercial</p>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-[#737686] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por cliente, RUC o N° Factura..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#f8f9ff] border border-[#e2e8f0] rounded-xl text-xs text-[#0b1c30] placeholder-[#737686] focus:outline-hidden focus:border-[#004ac6]"
          />
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 bg-[#f8f9ff] border border-[#e2e8f0] rounded-xl text-xs font-medium text-[#434655]"
        >
          <option value="todos">Todos los Estados</option>
          <option value="pendiente">Pendientes de Cobro</option>
          <option value="pagado">Cobrados</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-[#f8f9ff] text-[#434655] border-b border-[#e2e8f0]">
            <tr>
              <th className="py-3 px-4 font-bold">N° Factura</th>
              <th className="py-3 px-4 font-bold">Cliente</th>
              <th className="py-3 px-4 font-bold">Concepto / Plan</th>
              <th className="py-3 px-4 font-bold text-center">Periodo</th>
              <th className="py-3 px-4 font-bold text-right">Total</th>
              <th className="py-3 px-4 font-bold text-right">Saldo Pendiente</th>
              <th className="py-3 px-4 font-bold text-center">Estado</th>
              <th className="py-3 px-4 font-bold text-center">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e2e8f0]">
            {filteredCharges.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-xs text-[#737686]">
                  No se encontraron cuentas por cobrar con los filtros seleccionados.
                </td>
              </tr>
            ) : (
              filteredCharges.map((c) => {
                const isPaid = c.status === "pagado";
                const balance = c.balanceRemaining !== undefined ? c.balanceRemaining : c.total;

                return (
                  <tr key={c.id} className="hover:bg-[#f8f9ff]/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-[#004ac6]">{c.invoiceNumber}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#0b1c30]">{c.clientName}</div>
                      <div className="text-[11px] font-mono text-[#737686]">{c.clientRuc}</div>
                    </td>
                    <td className="py-3 px-4 text-[#434655]">{c.serviceDescription}</td>
                    <td className="py-3 px-4 text-center text-[#737686]">
                      {c.month}/{c.year}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-[#434655]">
                      ${c.total.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-[#0b1c30]">
                      ${balance.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isPaid
                            ? "bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0]"
                            : "bg-[#fffbeb] text-[#b45309] border border-[#fde68a]"
                        }`}
                      >
                        {isPaid ? "Cobrado" : "Pendiente"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {!isPaid ? (
                        <button
                          onClick={() => handleOpenCobroModal(c)}
                          className="px-3 py-1 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
                        >
                          Cobrar
                        </button>
                      ) : (
                        <span className="text-[#059669] text-xs font-medium">Liquidado</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#e2e8f0] w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8f9ff]">
              <div>
                <h3 className="text-base font-bold text-[#0b1c30]">Registrar Cobro de Cliente</h3>
                <p className="text-xs text-[#737686]">{selectedCharge.clientName}</p>
              </div>
              <button onClick={() => setSelectedCharge(null)} className="p-1.5 rounded-lg text-[#737686] hover:bg-[#e2e8f0]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmCobro} className="p-6 space-y-4">
              <div className="p-3 bg-[#eff4ff] rounded-xl border border-[#bfdbfe] text-xs space-y-1">
                <div className="flex justify-between text-[#434655]">
                  <span>Total Facturado:</span>
                  <span className="font-mono font-bold">${selectedCharge.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[#004ac6] font-bold">
                  <span>Saldo Pendiente:</span>
                  <span className="font-mono">
                    ${(selectedCharge.balanceRemaining !== undefined ? selectedCharge.balanceRemaining : selectedCharge.total).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">
                  Monto a Cobrar ($ USD) *
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  value={paymentAmount || ""}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  required
                  className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-xs font-mono font-bold text-[#059669]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">
                    Método de Pago
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-xs"
                  >
                    <option value="transferencia">Transferencia Bancaria</option>
                    <option value="deposito">Depósito Bancario</option>
                    <option value="efectivo">Efectivo / Caja</option>
                    <option value="tarjeta">Tarjeta Débito / Crédito</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">
                    N° Depósito / Referencia
                  </label>
                  <input
                    type="text"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#e2e8f0]">
                <button type="button" onClick={() => setSelectedCharge(null)} className="px-4 py-2 text-xs font-semibold text-[#434655]">
                  Cancelar
                </button>
                <button type="submit" className="px-5 py-2.5 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer">
                  Confirmar Cobro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
