"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Plus,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  CreditCard,
  Building2,
} from "lucide-react";
import { FinancialMovement } from "@/types";

export function MovementsTab() {
  const { financialMovements, bankAccounts, addFinancialMovement } = useApp();
  const { showSuccess, showError } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"todos" | "ingreso" | "egreso">("todos");
  const [filterBank, setFilterBank] = useState("todos");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [type, setType] = useState<"ingreso" | "egreso">("egreso");
  const [amount, setAmount] = useState<number>(0);
  const [category, setCategory] = useState<string>("opex_servicios");
  const [description, setDescription] = useState<string>("");
  const [bankAccountId, setBankAccountId] = useState<string>(bankAccounts[0]?.id || "");
  const [paymentMethod, setPaymentMethod] = useState<"transferencia" | "cheque" | "efectivo">("transferencia");
  const [referenceNumber, setReferenceNumber] = useState<string>("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (amount <= 0) {
      showError("Monto Inválido", "El monto debe ser mayor a 0.");
      return;
    }
    if (!description.trim()) {
      showError("Descripción Requerida", "Ingresa el concepto del movimiento.");
      return;
    }

    const bank = bankAccounts.find((b) => b.id === bankAccountId) || bankAccounts[0];
    if (!bank) {
      showError("Cuenta Requerida", "Debes seleccionar una cuenta bancaria o caja.");
      return;
    }

    try {
      await addFinancialMovement({
        type,
        date: new Date().toISOString().slice(0, 10),
        amount: Number(amount),
        category,
        description: description.trim(),
        bankAccountId: bank.id,
        bankAccountName: bank.bankName,
        paymentMethod,
        referenceNumber: referenceNumber.trim() || undefined,
      });

      showSuccess(
        "Movimiento Registrado",
        `${type === "ingreso" ? "Ingreso" : "Egreso"} por $${amount.toFixed(2)} registrado en ${bank.bankName}.`
      );

      setIsModalOpen(false);
      setAmount(0);
      setDescription("");
      setReferenceNumber("");
    } catch (err: any) {
      showError("Error al Guardar", err?.message || "No se pudo registrar el movimiento.");
    }
  };

  const filteredMovements = financialMovements.filter((m) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      m.description.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q) ||
      (m.referenceNumber && m.referenceNumber.toLowerCase().includes(q));

    const matchType = filterType === "todos" || m.type === filterType;
    const matchBank = filterBank === "todos" || m.bankAccountId === filterBank;

    return matchSearch && matchType && matchBank;
  });

  const totalIngresos = financialMovements
    .filter((m) => m.type === "ingreso")
    .reduce((sum, m) => sum + m.amount, 0);

  const totalEgresos = financialMovements
    .filter((m) => m.type === "egreso")
    .reduce((sum, m) => sum + m.amount, 0);

  const flujoNeto = totalIngresos - totalEgresos;
  const totalBancos = bankAccounts.reduce((sum, b) => sum + b.currentBalance, 0);

  return (
    <div className="space-y-6 select-none">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs">
          <div className="flex items-center justify-between text-[#737686] text-xs font-semibold">
            <span>Total Ingresos Recaudados</span>
            <div className="p-2 bg-[#ecfdf5] text-[#059669] rounded-xl">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-[#059669]">
            ${totalIngresos.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="mt-1 text-[11px] text-[#737686]">Cobranzas y entradas a cuentas</p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs">
          <div className="flex items-center justify-between text-[#737686] text-xs font-semibold">
            <span>Total Egresos & OPEX</span>
            <div className="p-2 bg-[#fef2f2] text-[#dc2626] rounded-xl">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-[#dc2626]">
            ${totalEgresos.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="mt-1 text-[11px] text-[#737686]">Pagos a proveedores y gastos operativos</p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs">
          <div className="flex items-center justify-between text-[#737686] text-xs font-semibold">
            <span>Flujo Neto Operativo</span>
            <div className={`p-2 rounded-xl ${flujoNeto >= 0 ? "bg-[#ecfdf5] text-[#059669]" : "bg-[#fef2f2] text-[#dc2626]"}`}>
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className={`mt-2 text-2xl font-bold font-mono ${flujoNeto >= 0 ? "text-[#059669]" : "text-[#dc2626]"}`}>
            {flujoNeto < 0 ? "-" : ""}${Math.abs(flujoNeto).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="mt-1 text-[11px] text-[#737686]">Superávit / Déficit neto</p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs">
          <div className="flex items-center justify-between text-[#737686] text-xs font-semibold">
            <span>Saldo Consolidado en Bancos</span>
            <div className="p-2 bg-[#eff4ff] text-[#004ac6] rounded-xl">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-[#004ac6]">
            ${totalBancos.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="mt-1 text-[11px] text-[#737686]">En {bankAccounts.length} cuentas y cajas activas</p>
        </div>
      </div>

      {/* Filter and Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-[#737686] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por descripción, referencia o categoría..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#f8f9ff] border border-[#e2e8f0] rounded-xl text-xs text-[#0b1c30] placeholder-[#737686] focus:outline-hidden focus:border-[#004ac6]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="px-3 py-2 bg-[#f8f9ff] border border-[#e2e8f0] rounded-xl text-xs font-medium text-[#434655]"
          >
            <option value="todos">Todos los Tipos</option>
            <option value="ingreso">Solo Ingresos</option>
            <option value="egreso">Solo Egresos</option>
          </select>

          <select
            value={filterBank}
            onChange={(e) => setFilterBank(e.target.value)}
            className="px-3 py-2 bg-[#f8f9ff] border border-[#e2e8f0] rounded-xl text-xs font-medium text-[#434655]"
          >
            <option value="todos">Todas las Cuentas</option>
            {bankAccounts.map((b) => (
              <option key={b.id} value={b.id}>
                {b.bankName}
              </option>
            ))}
          </select>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Movimiento</span>
          </button>
        </div>
      </div>

      {/* Movements Table */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-[#f8f9ff] text-[#434655] border-b border-[#e2e8f0]">
            <tr>
              <th className="py-3 px-4 font-bold">Fecha</th>
              <th className="py-3 px-4 font-bold text-center">Tipo</th>
              <th className="py-3 px-4 font-bold">Descripción / Concepto</th>
              <th className="py-3 px-4 font-bold">Categoría</th>
              <th className="py-3 px-4 font-bold">Cuenta / Caja</th>
              <th className="py-3 px-4 font-bold">Método / Ref</th>
              <th className="py-3 px-4 font-bold text-right">Monto ($)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e2e8f0]">
            {filteredMovements.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-xs text-[#737686]">
                  No se encontraron movimientos financieros con los filtros aplicados.
                </td>
              </tr>
            ) : (
              filteredMovements.map((m) => {
                const isIngreso = m.type === "ingreso";

                return (
                  <tr key={m.id} className="hover:bg-[#f8f9ff]/60 transition-colors">
                    <td className="py-3 px-4 font-medium text-[#0b1c30] whitespace-nowrap">{m.date}</td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isIngreso
                            ? "bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0]"
                            : "bg-[#fef2f2] text-[#dc2626] border border-[#fecaca]"
                        }`}
                      >
                        {isIngreso ? (
                          <>
                            <ArrowDownLeft className="w-3 h-3" />
                            Ingreso
                          </>
                        ) : (
                          <>
                            <ArrowUpRight className="w-3 h-3" />
                            Egreso
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-[#0b1c30] max-w-sm truncate" title={m.description}>
                      {m.description}
                    </td>
                    <td className="py-3 px-4 text-[#434655] capitalize">
                      {m.category.replace(/_/g, " ")}
                    </td>
                    <td className="py-3 px-4 font-medium text-[#0b1c30] whitespace-nowrap">
                      {m.bankAccountName}
                    </td>
                    <td className="py-3 px-4 text-[#737686] whitespace-nowrap">
                      <span className="capitalize">{m.paymentMethod}</span>
                      {m.referenceNumber && (
                        <span className="font-mono text-[10px] ml-1.5 px-1 py-0.2 bg-[#f1f5f9] rounded text-[#434655]">
                          {m.referenceNumber}
                        </span>
                      )}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono font-bold text-sm whitespace-nowrap ${
                        isIngreso ? "text-[#059669]" : "text-[#dc2626]"
                      }`}
                    >
                      {isIngreso ? "+" : "-"}${m.amount.toFixed(2)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Nuevo Movimiento Manual */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#e2e8f0] w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8f9ff]">
              <div>
                <h3 className="text-base font-bold text-[#0b1c30]">Registrar Movimiento Financiero</h3>
                <p className="text-xs text-[#737686]">Asienta una entrada o salida directa de fondos</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 rounded-lg text-[#737686] hover:bg-[#e2e8f0]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">Tipo *</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-xs font-bold"
                  >
                    <option value="egreso">Egreso (Gasto / Salida)</option>
                    <option value="ingreso">Ingreso (Cobro / Entrada)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">Monto ($) *</label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={amount || ""}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                    required
                    className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">Descripción *</label>
                <input
                  type="text"
                  placeholder="ej. Mantenimiento de aire acondicionado Nodo Central"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">Cuenta Origen / Destino *</label>
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
                  <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">Categoría</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-xs"
                  >
                    <option value="opex_servicios">OPEX Servicios</option>
                    <option value="alquiler_nodo">Alquiler de Nodo / Torre</option>
                    <option value="enlace_transito">Tránsito IP / Upstream</option>
                    <option value="mantenimiento">Mantenimiento de Red</option>
                    <option value="seguros">Seguros y Fianzas</option>
                    <option value="ingreso_extraordinario">Ingreso Extraordinario</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">Método de Pago</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-xs"
                  >
                    <option value="transferencia">Transferencia Bancaria</option>
                    <option value="efectivo">Efectivo / Caja</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">N° Referencia</label>
                  <input
                    type="text"
                    placeholder="TRF-001928"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#e2e8f0]">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-xs font-semibold text-[#434655]">
                  Cancelar
                </button>
                <button type="submit" className="px-5 py-2.5 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer">
                  Guardar Movimiento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
