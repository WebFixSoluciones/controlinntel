"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { validateMonetaryAmount } from "@/lib/validation-engine";
import { Receipt, Plus, Check, X } from "lucide-react";

export function ExpensesManager() {
  const { expenses, addExpense } = useApp();
  const { showError, showSuccess } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [supplierName, setSupplierName] = useState("");
  const [amount, setAmount] = useState(150);
  const [category, setCategory] = useState<any>("enlace_transito");
  const [description, setDescription] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    try {

    e.preventDefault();

    if (!supplierName || supplierName.trim().length < 3) {
      showError("Proveedor Requerido", "Ingresa la razón social o beneficiario del gasto.");
      return;
    }

    const amountVal = validateMonetaryAmount(amount, "Valor del gasto");
    if (!amountVal.isValid) {
      showError("Monto Inválido", amountVal.error || "El monto debe ser mayor a cero.");
      return;
    }

    await addExpense({
      supplierName,
      amount: Number(amount),
      category,
      description,
      expenseDate: new Date().toISOString().split("T")[0],
      paymentMethod: "transferencia",
    });

    showSuccess("Gasto Registrado", `Efectivo/Transferencia por $${Number(amount).toFixed(2)} USD para ${supplierName} asentado.`);
    setIsModalOpen(false);
    setSupplierName("");
    setDescription("");
  
    } catch (error) { window.dispatchEvent(new CustomEvent("inntel:error", { detail: error instanceof Error ? error.message : "No se pudo guardar." })); }
  };

  const [filterQuery, setFilterQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("todas");

  const filteredExpenses = expenses.filter((e) => {
    const matchesText =
      e.supplierName.toLowerCase().includes(filterQuery.toLowerCase()) ||
      e.description.toLowerCase().includes(filterQuery.toLowerCase());
    const matchesCat = categoryFilter === "todas" || e.category === categoryFilter;
    return matchesText && matchesCat;
  });

  const totalOpex = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="w-full space-y-6 select-none">
      {/* Header & KPI */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1c30] tracking-tight flex items-center gap-2">
            <Receipt className="w-6 h-6 text-[#712ae2]" />
            Control de Gastos Operativos & OPEX
          </h1>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#712ae2] hover:bg-[#8a4cfc] text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Gasto OPEX</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="p-5 rounded-2xl bg-white border border-[#e2e8f0] shadow-lumina-card">
          <span className="text-[11px] font-bold text-[#737686] uppercase tracking-wider block">Total Egresos OPEX</span>
          <span className="text-2xl font-black text-[#ef4444] mt-1 block font-tnum">${totalOpex.toFixed(2)} USD</span>
          <span className="text-[11px] text-[#737686]">{filteredExpenses.length} egresos contabilizados</span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#e2e8f0] shadow-lumina-card">
          <span className="text-[11px] font-bold text-[#737686] uppercase tracking-wider block">Tránsito IP & Conectividad</span>
          <span className="text-2xl font-black text-[#0b1c30] mt-1 block font-tnum">
            ${expenses.filter((e) => e.category === "enlace_transito").reduce((s, e) => s + e.amount, 0).toFixed(2)} USD
          </span>
          <span className="text-[11px] text-[#737686]">Enlaces dedicados BGP / Carriers</span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#e2e8f0] shadow-lumina-card">
          <span className="text-[11px] font-bold text-[#737686] uppercase tracking-wider block">Infraestructura & Nodos</span>
          <span className="text-2xl font-black text-[#0b1c30] mt-1 block font-tnum">
            ${expenses.filter((e) => e.category === "alquiler_nodo" || e.category === "mantenimiento").reduce((s, e) => s + e.amount, 0).toFixed(2)} USD
          </span>
          <span className="text-[11px] text-[#737686]">Arriendos de torres y mantenimiento</span>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-lumina-card overflow-hidden">
        {/* Search & Filters */}
        <div className="p-4 border-b border-[#e2e8f0] flex flex-wrap items-center justify-between gap-3 bg-white">
          <div className="relative flex-1 max-w-sm">
            <input
              type="text"
              placeholder="Buscar por proveedor o detalle..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="w-full bg-white text-xs text-[#0b1c30] rounded-lg px-3 py-2 border border-[#cbd5e1] focus:outline-hidden focus:border-[#712ae2]"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-white text-xs font-medium text-[#434655] rounded-lg px-3 py-2 border border-[#cbd5e1] focus:outline-hidden cursor-pointer"
            >
              <option value="todas">Todas las Categorías</option>
              <option value="enlace_transito">Tránsito IP</option>
              <option value="alquiler_nodo">Alquiler Torre / Nodo</option>
              <option value="fibra_equipos">Fibra & Equipos</option>
              <option value="mantenimiento">Mantenimiento</option>
            </select>
          </div>
        </div>

        {/* Expenses Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f8f9ff] text-[#712ae2] font-bold text-[11px] uppercase tracking-wider border-b border-[#e2e8f0]">
              <tr>
                <th className="py-3.5 px-5">Fecha</th>
                <th className="py-3.5 px-5">Proveedor / Beneficiario</th>
                <th className="py-3.5 px-5">Categoría</th>
                <th className="py-3.5 px-5">Descripción / Concepto</th>
                <th className="py-3.5 px-5 text-center">Método de Pago</th>
                <th className="py-3.5 px-5 text-right font-tnum">Monto ($ USD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9] font-medium text-[#434655]">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-[#737686] italic">
                    No se encontraron gastos registrados con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-[#f8f9ff] transition-colors">
                    <td className="py-3.5 px-5 font-mono text-[11px] text-[#737686]">{exp.expenseDate}</td>
                    <td className="py-3.5 px-5 font-bold text-[#0b1c30]">{exp.supplierName}</td>
                    <td className="py-3.5 px-5">
                      <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase bg-[#eff4ff] border border-[#dce9ff] text-[#004ac6]">
                        {exp.category.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-[#434655] max-w-sm">{exp.description}</td>
                    <td className="py-3.5 px-5 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {exp.paymentMethod || "Transferencia"}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right font-mono font-bold text-[#ef4444] text-sm">
                      ${exp.amount.toFixed(2)} USD
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-lumina-dropdown border border-[#e2e8f0] overflow-hidden">
            <div className="p-4 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8f9ff]">
              <h3 className="font-bold text-[#0b1c30] text-sm">Registrar Gasto de Operación</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 rounded-lg text-[#737686] hover:text-[#0b1c30] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-4 space-y-3 text-xs">
              <div>
                <label className="font-bold text-[#434655] block mb-1">Proveedor / Beneficiario *</label>
                <input
                  type="text"
                  required
                  placeholder="Telconet / Torrecuador / OptiCom"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 font-semibold text-[#0b1c30]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#434655] block mb-1">Categoría</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 text-[#0b1c30]"
                  >
                    <option value="enlace_transito">Tránsito IP</option>
                    <option value="alquiler_nodo">Alquiler Torre/Nodo</option>
                    <option value="fibra_equipos">Fibra & Equipos</option>
                    <option value="mantenimiento">Mantenimiento</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-[#434655] block mb-1">Valor ($ USD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 font-bold text-[#ef4444]"
                  />
                </div>
              </div>
              <div>
                <label className="font-bold text-[#434655] block mb-1">Descripción</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detalle del comprobante..."
                  className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 text-[#0b1c30]"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2 border-t border-[#e2e8f0]">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-[#737686] hover:bg-[#f8f9ff] rounded-lg font-bold cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 bg-[#712ae2] hover:bg-[#8a4cfc] text-white rounded-lg font-bold cursor-pointer shadow-xs">
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
