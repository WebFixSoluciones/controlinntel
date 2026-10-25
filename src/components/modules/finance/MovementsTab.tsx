"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import {
  Plus,
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  X,
} from "lucide-react";
import { formatFinanceCategory } from "./FinanceDashboard";

export function MovementsTab() {
  const { financialMovements, bankAccounts, addFinancialMovement } = useApp();
  const { showSuccess, showError } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"todos" | "ingreso" | "egreso">("todos");
  const [filterBank, setFilterBank] = useState("todos");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [type, setType] = useState<"ingreso" | "egreso">("egreso");
  const [amount, setAmount] = useState<number>(0);
  const [category, setCategory] = useState<string>("servicios_basicos");
  const [description, setDescription] = useState<string>("");
  const [bankAccountId, setBankAccountId] = useState<string>(bankAccounts[0]?.id || "");
  const [paymentMethod, setPaymentMethod] = useState<"transferencia" | "cheque" | "efectivo">("transferencia");
  const [referenceNumber, setReferenceNumber] = useState<string>("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (amount <= 0) {
      showError("Monto Inválido", "El monto debe ser mayor a $0.00.");
      return;
    }
    if (!description.trim()) {
      showError("Concepto Requerido", "Ingresa el concepto del movimiento.");
      return;
    }

    const bank = bankAccounts.find((b) => b.id === bankAccountId) || bankAccounts[0];
    if (!bank) {
      showError("Cuenta Requerida", "Selecciona una cuenta bancaria o caja.");
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
        "Movimiento Guardado",
        `${type === "ingreso" ? "Ingreso" : "Egreso"} de $${amount.toFixed(2)} registrado en ${bank.bankName}.`
      );

      setIsModalOpen(false);
      setAmount(0);
      setDescription("");
      setReferenceNumber("");
    } catch (err: any) {
      showError("Error", err?.message || "No se pudo guardar el movimiento.");
    }
  };

  const filteredMovements = financialMovements.filter((m) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      m.description.toLowerCase().includes(q) ||
      formatFinanceCategory(m.category).toLowerCase().includes(q) ||
      (m.referenceNumber && m.referenceNumber.toLowerCase().includes(q));

    const matchType = filterType === "todos" || m.type === filterType;
    const matchBank = filterBank === "todos" || m.bankAccountId === filterBank;

    return matchSearch && matchType && matchBank;
  });

  return (
    <div className="space-y-5">
      {/* Barra de Búsqueda y Filtros */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar concepto, referencia o categoría..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:border-[#004ac6]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
          >
            <option value="todos">Todos los Tipos</option>
            <option value="ingreso">Ingresos</option>
            <option value="egreso">Egresos</option>
          </select>

          <select
            value={filterBank}
            onChange={(e) => setFilterBank(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
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
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuevo Movimiento</span>
          </button>
        </div>
      </div>

      {/* Tabla de Movimientos */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold text-[11px]">
            <tr>
              <th className="py-3 px-4">Fecha</th>
              <th className="py-3 px-4 text-center">Tipo</th>
              <th className="py-3 px-4">Concepto</th>
              <th className="py-3 px-4">Categoría</th>
              <th className="py-3 px-4">Cuenta / Banco</th>
              <th className="py-3 px-4">Forma de Pago / Ref.</th>
              <th className="py-3 px-4 text-right">Monto ($)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredMovements.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-xs text-slate-400">
                  No se encontraron movimientos registrados.
                </td>
              </tr>
            ) : (
              filteredMovements.map((m) => {
                const isIngreso = m.type === "ingreso";

                return (
                  <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">{m.date}</td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                          isIngreso
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
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
                    <td className="py-3 px-4 font-semibold text-slate-900 max-w-sm truncate" title={m.description}>
                      {m.description}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {formatFinanceCategory(m.category)}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800 whitespace-nowrap">
                      {m.bankAccountName}
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      <span className="capitalize">{m.paymentMethod}</span>
                      {m.referenceNumber && (
                        <span className="font-mono text-[10px] ml-1.5 px-1.5 py-0.5 bg-slate-100 rounded text-slate-600">
                          {m.referenceNumber}
                        </span>
                      )}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono font-bold text-sm whitespace-nowrap ${
                        isIngreso ? "text-emerald-600" : "text-rose-600"
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

      {/* Modal Nuevo Movimiento */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Nuevo Movimiento</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Tipo *</label>
                  <select
                    value={type}
                    onChange={(e) => {
                      const nextType = e.target.value as "ingreso" | "egreso";
                      setType(nextType);
                      setCategory(nextType === "ingreso" ? "cobro_cliente" : "servicios_basicos");
                    }}
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                  >
                    <option value="egreso">Egreso (Salida)</option>
                    <option value="ingreso">Ingreso (Entrada)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Monto ($) *</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount || ""}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                    required
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Concepto *</label>
                <input
                  type="text"
                  placeholder="Ej: Pago de servicio eléctrico o cobro directo..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Cuenta / Banco *</label>
                  <select
                    value={bankAccountId}
                    onChange={(e) => setBankAccountId(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                  >
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bankName} (${b.currentBalance.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Categoría</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                  >
                    {type === "ingreso" ? (
                      <>
                        <option value="cobro_cliente">Cobro a Cliente</option>
                        <option value="ingreso_extraordinario">Otros Ingresos</option>
                      </>
                    ) : (
                      <>
                        <option value="servicios_basicos">Servicios Básicos</option>
                        <option value="enlace_transito">Internet y Enlaces</option>
                        <option value="alquiler_nodo">Alquiler de Nodos / Locales</option>
                        <option value="mantenimiento">Mantenimiento y Técnicos</option>
                        <option value="administrativos">Sueldos y Administrativos</option>
                        <option value="seguros">Seguros y Pólizas</option>
                        <option value="otro">Otros Gastos</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Forma de Pago</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="transferencia">Transferencia</option>
                    <option value="efectivo">Efectivo</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">N° Referencia</label>
                  <input
                    type="text"
                    placeholder="Ej: 001928"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
