"use client";

import React from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import {
  BarChart3,
  DollarSign,
  PieChart,
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
  Building2,
} from "lucide-react";
import { formatFinanceCategory } from "./FinanceDashboard";

export function FinancialReportsTab() {
  const { financialMovements, bankAccounts } = useApp();
  const { showSuccess } = useToast();

  const totalIngresos = financialMovements
    .filter((m) => m.type === "ingreso")
    .reduce((sum, m) => sum + m.amount, 0);

  const totalEgresos = financialMovements
    .filter((m) => m.type === "egreso")
    .reduce((sum, m) => sum + m.amount, 0);

  const flujoNeto = totalIngresos - totalEgresos;

  const expensesByCategory: Record<string, number> = {};
  financialMovements
    .filter((m) => m.type === "egreso")
    .forEach((m) => {
      const cat = m.category || "otro";
      expensesByCategory[cat] = (expensesByCategory[cat] || 0) + m.amount;
    });

  const handleExportCsv = () => {
    const headers = ["Fecha", "Tipo", "Categoria", "Concepto", "Cuenta Bancaria", "Forma de Pago", "Monto USD"];
    const rows = financialMovements.map((m) => [
      m.date,
      m.type,
      `"${formatFinanceCategory(m.category)}"`,
      `"${m.description.replace(/"/g, '""')}"`,
      `"${m.bankAccountName}"`,
      m.paymentMethod,
      m.amount.toFixed(2),
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Reporte_Financiero_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showSuccess("Reporte Descargado", "Archivo CSV exportado.");
  };

  return (
    <div className="space-y-5">
      {/* Encabezado y Exportar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-[#004ac6]" />
          <h2 className="text-sm font-bold text-slate-900">Resumen Financiero</h2>
        </div>

        <button
          onClick={handleExportCsv}
          className="flex items-center gap-2 px-3.5 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Exportar CSV / Excel</span>
        </button>
      </div>

      {/* 3 Tarjetas de Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Ingresos vs Egresos */}
        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <h3 className="text-xs font-bold text-slate-700 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-[#004ac6]" />
            Ingresos vs Egresos
          </h3>

          <div className="space-y-3 pt-1">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-emerald-600 font-medium flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" /> Ingresos
                </span>
                <span className="font-mono font-bold text-emerald-600">${totalIngresos.toFixed(2)}</span>
              </div>
              <div className="w-full bg-emerald-50 h-2 rounded-full overflow-hidden">
                <div className="bg-emerald-600 h-full rounded-full" style={{ width: "100%" }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-rose-600 font-medium flex items-center gap-1">
                  <TrendingDown className="w-3.5 h-3.5" /> Egresos
                </span>
                <span className="font-mono font-bold text-rose-600">${totalEgresos.toFixed(2)}</span>
              </div>
              <div className="w-full bg-rose-50 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-rose-600 h-full rounded-full"
                  style={{ width: `${totalIngresos > 0 ? Math.min(100, (totalEgresos / totalIngresos) * 100) : 100}%` }}
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-900">Saldo Neto:</span>
              <span className={`text-base font-mono font-bold ${flujoNeto >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {flujoNeto >= 0 ? "+" : "-"}${Math.abs(flujoNeto).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Gastos por Categoría */}
        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <h3 className="text-xs font-bold text-slate-700 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-[#004ac6]" />
            Gastos por Categoría
          </h3>

          <div className="space-y-2 pt-1 text-xs">
            {Object.keys(expensesByCategory).length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No hay gastos registrados.</p>
            ) : (
              Object.entries(expensesByCategory).map(([cat, val]) => {
                const pct = totalEgresos > 0 ? ((val / totalEgresos) * 100).toFixed(1) : 0;
                return (
                  <div key={cat} className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-700 truncate max-w-[150px]">{formatFinanceCategory(cat)}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 font-mono text-[11px]">{pct}%</span>
                      <span className="font-mono font-bold text-slate-900">${val.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Saldos en Bancos */}
        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <h3 className="text-xs font-bold text-slate-700 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#004ac6]" />
            Saldos en Bancos
          </h3>

          <div className="space-y-2 pt-1 text-xs">
            {bankAccounts.map((b) => (
              <div key={b.id} className="flex items-center justify-between py-1 border-b border-slate-100">
                <div>
                  <div className="font-bold text-slate-900">{b.bankName}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{b.accountNumber}</div>
                </div>
                <div className="font-mono font-bold text-[#004ac6] text-sm">
                  ${b.currentBalance.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
