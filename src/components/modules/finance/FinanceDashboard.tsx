"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { DollarSign, FileSpreadsheet, Plus, CheckCircle2, Download, Calendar } from "lucide-react";
import { generateSriBillingBatchExcel, triggerBrowserDownload } from "@/lib/doc-generator";

interface FinanceDashboardProps {
  onOpenNewExpense: () => void;
}

export function FinanceDashboard({ onOpenNewExpense }: FinanceDashboardProps) {
  const { monthlyCharges, markChargeAsPaid, generateMonthlyBillingBatch, clients, expenses } = useApp();
  const { showSuccess, showError, showConfirm } = useToast();
  const [selectedMonth, setSelectedMonth] = useState(8);
  const [selectedYear, setSelectedYear] = useState(2026);

  const currentCharges = monthlyCharges.filter(
    (c) => c.month === selectedMonth && c.year === selectedYear
  );

  const totalBilled = currentCharges.reduce((sum, c) => sum + c.total, 0);
  const totalPaid = currentCharges.filter((c) => c.status === "pagado").reduce((sum, c) => sum + c.total, 0);
  const totalPending = totalBilled - totalPaid;
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  const handleExportSri = async () => {
    if (currentCharges.length === 0) {
      showError("Sin Registros", "No hay comprobantes para este periodo. Emite el lote primero.");
      return;
    }
    try {
      const blob = await generateSriBillingBatchExcel(currentCharges);
      triggerBrowserDownload(blob, `Lote_Facturacion_SRI_${selectedMonth}_${selectedYear}.xlsx`);
      showSuccess("Lote SRI Exportado", `Archivo Excel con ${currentCharges.length} facturas generado exitosamente.`);
    } catch (e) {
      showError("Error de Exportación", "Ocurrió un problema al construir el archivo Excel del SRI.");
    }
  };

  const handleGenerateBatch = () => {
    showConfirm(
      "¿Emitir Cobros Día 1?",
      `Se generarán las facturas recurrentes correspondientes a ${clients.length} clientes activos para el periodo ${selectedMonth}/${selectedYear}. ¿Continuar?`,
      () => {
        generateMonthlyBillingBatch(selectedMonth, selectedYear);
        showSuccess("Lote Emitido", `Cobros del Día 1 generados para ${clients.length} abonados.`);
      },
      "Generar Lote"
    );
  };

  const handleMarkPaid = (charge: any) => {
    markChargeAsPaid(charge.id, "Transferencia Bancaria");
    showSuccess("Pago Registrado", `Factura ${charge.invoiceNumber} por $${charge.total.toFixed(2)} USD marcada como pagada.`);
  };

  return (
    <div className="space-y-6 select-none">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            Control Financiero, Cobros Recurrentes & Pre-Facturación SRI
          </h2>
          <p className="text-xs text-slate-400">
            Generación automática de cobros Día 1 y lotes exportables compatibles con Facturación Electrónica SRI
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleGenerateBatch}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <Calendar className="w-4 h-4" />
            <span>Emitir Cobros Día 1</span>
          </button>

          <button
            onClick={handleExportSri}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Exportar Lote SRI (.xlsx)</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Facturado</span>
          <span className="text-xl font-black text-slate-900 mt-1 block">${totalBilled.toFixed(2)} USD</span>
          <span className="text-[11px] text-slate-400">{currentCharges.length} comprobantes del periodo</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cobrado / Recaudado</span>
          <span className="text-xl font-black text-emerald-700 mt-1 block">${totalPaid.toFixed(2)} USD</span>
          <span className="text-[11px] text-emerald-600 font-bold">
            {totalBilled > 0 ? `${Math.round((totalPaid / totalBilled) * 100)}% de efectividad` : "0%"}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cartera Pendiente</span>
          <span className="text-xl font-black text-amber-700 mt-1 block">${totalPending.toFixed(2)} USD</span>
          <span className="text-[11px] text-amber-600 font-bold">Pendiente de acreditación</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Gastos Registrados</span>
          <span className="text-xl font-black text-rose-700 mt-1 block">${totalExpenses.toFixed(2)} USD</span>
          <span className="text-[11px] text-slate-400">Nodos, fibra y tránsito</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="font-bold text-slate-900 text-sm">Detalle de Cobros Emitidos para SRI</h3>
          <span className="text-xs font-semibold text-slate-500">Periodo {selectedMonth}/{selectedYear}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Cliente / RUC</th>
                <th className="py-3 px-4">Concepto del Servicio</th>
                <th className="py-3 px-4">Subtotal (15% IVA)</th>
                <th className="py-3 px-4">IVA 15%</th>
                <th className="py-3 px-4">Total</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {currentCharges.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                    No se han generado cobros para este mes. Presiona "Emitir Cobros Día 1".
                  </td>
                </tr>
              ) : (
                currentCharges.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900">{c.clientName}</p>
                      <span className="font-mono text-[11px] text-slate-400">{c.clientRuc}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{c.serviceDescription}</td>
                    <td className="py-3 px-4 font-mono">${c.subtotal.toFixed(2)}</td>
                    <td className="py-3 px-4 font-mono">${c.ivaAmount.toFixed(2)}</td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">${c.total.toFixed(2)}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          c.status === "pagado" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {c.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {c.status === "pendiente" ? (
                        <button
                          onClick={() => handleMarkPaid(c)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold shadow-2xs cursor-pointer"
                        >
                          Marcar Pagado
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-medium">{c.paymentDate}</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
