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

  const handleCreate = (e: React.FormEvent) => {
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

    addExpense({
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
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4 select-none">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Receipt className="w-4 h-4 text-purple-600" />
            Registro de Gastos Operativos (OPEX)
          </h3>
          <p className="text-xs text-slate-400">Control de arriendos de torres, tránsito Telconet/CenturyLink y compras de fibra</p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Registrar Gasto</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {expenses.map((exp) => (
          <div key={exp.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex flex-col justify-between">
            <div>
              <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase bg-white border border-slate-200 text-slate-700">
                {exp.category.replace("_", " ")}
              </span>
              <h4 className="font-bold text-slate-900 text-sm mt-2">{exp.supplierName}</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">{exp.description}</p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between">
              <span className="text-[10px] text-slate-400">{exp.expenseDate}</span>
              <span className="font-bold font-mono text-slate-900 text-sm">${exp.amount.toFixed(2)} USD</span>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-bold text-slate-900 text-sm">Registrar Gasto de Operación</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-4 space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Proveedor / Beneficiario *</label>
                <input
                  type="text"
                  required
                  placeholder="Telconet / Torrecuador / OptiCom"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Categoría</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  >
                    <option value="enlace_transito">Tránsito IP</option>
                    <option value="alquiler_nodo">Alquiler Torre/Nodo</option>
                    <option value="fibra_equipos">Fibra & Equipos</option>
                    <option value="mantenimiento">Mantenimiento</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Valor ($ USD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold"
                  />
                </div>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Descripción</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detalle del comprobante..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 font-bold cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold cursor-pointer">
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
