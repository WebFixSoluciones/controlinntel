"use client";

import React from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import {
  BarChart3,
  Download,
  Calendar,
  DollarSign,
  PieChart,
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
  Building2,
} from "lucide-react";

export function FinancialReportsTab() {
  const { financialMovements, monthlyCharges, purchaseInvoices, bankAccounts } = useApp();
  const { showSuccess } = useToast();

  const totalIngresos = financialMovements
    .filter((m) => m.type === "ingreso")
    .reduce((sum, m) => sum + m.amount, 0);

  const totalEgresos = financialMovements
    .filter((m) => m.type === "egreso")
    .reduce((sum, m) => sum + m.amount, 0);

  const flujoNeto = totalIngresos - totalEgresos;

  // Breakdown of expenses by category
  const expensesByCategory: Record<string, number> = {};
  financialMovements
    .filter((m) => m.type === "egreso")
    .forEach((m) => {
      const cat = m.category || "otros";
      expensesByCategory[cat] = (expensesByCategory[cat] || 0) + m.amount;
    });

  // Export CSV
  const handleExportCsv = () => {
    const headers = ["Fecha", "Tipo", "Categoria", "Descripcion", "Cuenta Bancaria", "Metodo", "Monto USD"];
    const rows = financialMovements.map((m) => [
      m.date,
      m.type,
      m.category,
      `"${m.description.replace(/"/g, '""')}"`,
      `"${m.bankAccountName}"`,
      m.paymentMethod,
      m.amount.toFixed(2),
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Reporte_Financiero_INNTEL_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showSuccess("Reporte Descargado", "Archivo CSV generado y exportado exitosamente.");
  };

  return (
    <div className="space-y-6 select-none">
      {/* Header and Export Action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs">
        <div>
          <h2 className="text-base font-bold text-[#0b1c30] flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#004ac6]" />
            Reportes Financieros & Balance Ejecutivo
          </h2>
          <p className="text-xs text-[#737686]">
            Auditoría de ingresos, gastos OPEX, costos de compras y disponibilidad bancaria.
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          className="flex items-center gap-2 px-4 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Exportar a CSV / Excel</span>
        </button>
      </div>

      {/* Financial Health Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Income vs Expenses Card */}
        <div className="p-5 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs space-y-4">
          <h3 className="text-xs font-bold text-[#434655] uppercase tracking-wider flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-[#004ac6]" />
            Flujo Neto Consolidado
          </h3>

          <div className="space-y-3 pt-2">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[#059669] font-medium flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" /> Total Ingresos
                </span>
                <span className="font-mono font-bold text-[#059669]">${totalIngresos.toFixed(2)}</span>
              </div>
              <div className="w-full bg-[#ecfdf5] h-2 rounded-full overflow-hidden">
                <div className="bg-[#059669] h-full rounded-full" style={{ width: "100%" }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[#dc2626] font-medium flex items-center gap-1">
                  <TrendingDown className="w-3.5 h-3.5" /> Total Egresos
                </span>
                <span className="font-mono font-bold text-[#dc2626]">${totalEgresos.toFixed(2)}</span>
              </div>
              <div className="w-full bg-[#fef2f2] h-2 rounded-full overflow-hidden">
                <div
                  className="bg-[#dc2626] h-full rounded-full"
                  style={{ width: `${totalIngresos > 0 ? Math.min(100, (totalEgresos / totalIngresos) * 100) : 100}%` }}
                />
              </div>
            </div>

            <div className="pt-3 border-t border-[#e2e8f0] flex justify-between items-center">
              <span className="text-xs font-bold text-[#0b1c30]">Margen Operativo:</span>
              <span className={`text-base font-mono font-bold ${flujoNeto >= 0 ? "text-[#059669]" : "text-[#dc2626]"}`}>
                {flujoNeto >= 0 ? "+" : "-"}${Math.abs(flujoNeto).toFixed(2)} USD
              </span>
            </div>
          </div>
        </div>

        {/* Expenses by Category */}
        <div className="p-5 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs space-y-4">
          <h3 className="text-xs font-bold text-[#434655] uppercase tracking-wider flex items-center gap-2">
            <PieChart className="w-4 h-4 text-[#004ac6]" />
            Distribución de Egresos
          </h3>

          <div className="space-y-2 pt-1 text-xs">
            {Object.keys(expensesByCategory).length === 0 ? (
              <p className="text-xs text-[#737686] py-6 text-center">No hay egresos registrados.</p>
            ) : (
              Object.entries(expensesByCategory).map(([cat, val]) => {
                const pct = totalEgresos > 0 ? ((val / totalEgresos) * 100).toFixed(1) : 0;
                return (
                  <div key={cat} className="flex items-center justify-between py-1 border-b border-[#f1f5f9]">
                    <span className="capitalize text-[#434655] truncate max-w-[140px]">{cat.replace(/_/g, " ")}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[#737686] font-mono text-[11px]">{pct}%</span>
                      <span className="font-mono font-bold text-[#0b1c30]">${val.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Cash & Bank Balances */}
        <div className="p-5 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs space-y-4">
          <h3 className="text-xs font-bold text-[#434655] uppercase tracking-wider flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#004ac6]" />
            Liquidez Disponible por Banco
          </h3>

          <div className="space-y-2 pt-1 text-xs">
            {bankAccounts.map((b) => (
              <div key={b.id} className="flex items-center justify-between py-1 border-b border-[#f1f5f9]">
                <div>
                  <div className="font-bold text-[#0b1c30]">{b.bankName}</div>
                  <div className="text-[10px] text-[#737686] font-mono">{b.accountNumber}</div>
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
