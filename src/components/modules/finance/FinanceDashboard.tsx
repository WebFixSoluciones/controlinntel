"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { DollarSign, FileSpreadsheet, Plus, CheckCircle2, Download, Calendar } from "lucide-react";
import { generateBillingBatchExcel, triggerBrowserDownload } from "@/lib/doc-generator";

interface FinanceDashboardProps {
  onOpenNewExpense?: () => void;
}

export function FinanceDashboard({ onOpenNewExpense }: FinanceDashboardProps) {
  const { monthlyCharges, markChargeAsPaid, generateMonthlyBillingBatch, clients, expenses } = useApp();
  const { showSuccess, showError, showConfirm } = useToast();
  const [selectedMonth, setSelectedMonth] = useState(9);
  const [selectedYear, setSelectedYear] = useState(2026);

  const currentCharges = monthlyCharges.filter(
    (c) => c.month === selectedMonth && c.year === selectedYear
  );

  const totalBilled = currentCharges.reduce((sum, c) => sum + c.total, 0);
  const totalPaid = currentCharges.filter((c) => c.status === "pagado").reduce((sum, c) => sum + c.total, 0);
  const totalPending = totalBilled - totalPaid;
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  const handleExportBatch = async () => {
    if (currentCharges.length === 0) {
      showError("Sin Registros", "No hay comprobantes para este periodo. Emite el lote primero.");
      return;
    }
    try {
      const blob = await generateBillingBatchExcel(currentCharges);
      triggerBrowserDownload(blob, `Lote_Cobranzas_PreFacturas_${selectedMonth}_${selectedYear}.xlsx`);
      showSuccess("Lote Exportado", `Archivo Excel con ${currentCharges.length} órdenes de pedido generado exitosamente.`);
    } catch (e) {
      showError("Error de Exportación", "Ocurrió un problema al construir el archivo Excel de cobranzas.");
    }
  };

  const handleGenerateBatch = () => {
    showConfirm(
      "¿Emitir Cobros / Órdenes del Día 1?",
      `Se generarán las órdenes de pedido y pre-facturas correspondientes a ${clients.length} clientes activos para el periodo ${selectedMonth}/${selectedYear}. ¿Continuar?`,
      () => {
        generateMonthlyBillingBatch(selectedMonth, selectedYear);
        showSuccess("Lote Emitido", `Cobros del Día 1 generados para ${clients.length} abonados.`);
      },
      "Generar Lote"
    );
  };

  const handleMarkPaid = (charge: any) => {
    markChargeAsPaid(charge.id, "Transferencia Bancaria");
    showSuccess("Pago Registrado", `Pre-Factura ${charge.invoiceNumber} por $${charge.total.toFixed(2)} USD marcada como pagada.`);
  };

  return (
    <div className="space-y-6 select-none">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1c30] tracking-tight flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-[#004ac6]" />
            Control Financiero, Cobranzas & Órdenes de Pedido
          </h1>
          <p className="text-xs text-[#737686] mt-0.5">
            Generación automática de cobros Día 1, pre-facturas no oficiales y seguimiento de recaudación mensual
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleGenerateBatch}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <Calendar className="w-4 h-4" />
            <span>Emitir Cobros Día 1</span>
          </button>

          <button
            onClick={handleExportBatch}
            className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-[#f8f9ff] text-[#0b1c30] border border-[#cbd5e1] rounded-lg text-xs font-bold shadow-2xs transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#10B981]" />
            <span>Exportar Lote Excel</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-5 rounded-2xl bg-white border border-[#e2e8f0] shadow-lumina-card">
          <span className="text-[11px] font-bold text-[#737686] uppercase tracking-wider block">Total Emitido</span>
          <span className="text-2xl font-black text-[#0b1c30] mt-1 block font-tnum">${totalBilled.toFixed(2)} USD</span>
          <span className="text-[11px] text-[#737686]">{currentCharges.length} pre-facturas del periodo</span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#e2e8f0] shadow-lumina-card">
          <span className="text-[11px] font-bold text-[#737686] uppercase tracking-wider block">Cobrado / Recaudado</span>
          <span className="text-2xl font-black text-[#10B981] mt-1 block font-tnum">${totalPaid.toFixed(2)} USD</span>
          <span className="text-[11px] text-[#059669] font-bold">
            {totalBilled > 0 ? `${Math.round((totalPaid / totalBilled) * 100)}% de efectividad` : "0%"}
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#e2e8f0] shadow-lumina-card">
          <span className="text-[11px] font-bold text-[#737686] uppercase tracking-wider block">Cartera Pendiente</span>
          <span className="text-2xl font-black text-[#f59e0b] mt-1 block font-tnum">${totalPending.toFixed(2)} USD</span>
          <span className="text-[11px] text-amber-600 font-bold">Pendiente de acreditación</span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#e2e8f0] shadow-lumina-card">
          <span className="text-[11px] font-bold text-[#737686] uppercase tracking-wider block">Gastos Registrados</span>
          <span className="text-2xl font-black text-[#ef4444] mt-1 block font-tnum">${totalExpenses.toFixed(2)} USD</span>
          <span className="text-[11px] text-[#737686]">Nodos, fibra y tránsito</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-lumina-card overflow-hidden">
        <div className="p-4 border-b border-[#e2e8f0] flex items-center justify-between bg-white">
          <h3 className="font-bold text-[#0b1c30] text-sm">Detalle de Órdenes de Pedido & Pre-Facturas Emitidas</h3>
          <span className="text-xs font-semibold text-[#737686]">Periodo {selectedMonth}/{selectedYear}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-[11px] uppercase tracking-wider border-b border-[#e2e8f0]">
              <tr>
                <th className="py-3.5 px-5">Cliente / Identificación</th>
                <th className="py-3.5 px-5">Concepto del Servicio</th>
                <th className="py-3.5 px-5 font-tnum">Subtotal (15% IVA)</th>
                <th className="py-3.5 px-5 font-tnum">IVA 15%</th>
                <th className="py-3.5 px-5 font-tnum">Total Cotizado</th>
                <th className="py-3.5 px-5 text-center">Estado</th>
                <th className="py-3.5 px-5 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9] font-medium text-[#434655]">
              {currentCharges.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#737686] italic">
                    No se han generado cobros para este mes. Presiona "Emitir Cobros Día 1".
                  </td>
                </tr>
              ) : (
                currentCharges.map((c) => (
                  <tr key={c.id} className="hover:bg-[#f8f9ff] transition-colors">
                    <td className="py-3.5 px-5">
                      <p className="font-bold text-[#0b1c30]">{c.clientName}</p>
                      <span className="font-mono text-[11px] text-[#737686]">{c.clientRuc}</span>
                    </td>
                    <td className="py-3.5 px-5 text-[#434655]">{c.serviceDescription}</td>
                    <td className="py-3.5 px-5 font-mono">${c.subtotal.toFixed(2)}</td>
                    <td className="py-3.5 px-5 font-mono">${c.ivaAmount.toFixed(2)}</td>
                    <td className="py-3.5 px-5 font-mono font-bold text-[#0b1c30]">${c.total.toFixed(2)}</td>
                    <td className="py-3.5 px-5 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          c.status === "pagado"
                            ? "bg-[#ecfdf5] text-[#065f46] border border-[#a7f3d0]"
                            : "bg-[#fffbeb] text-[#92400e] border border-[#fde68a]"
                        }`}
                      >
                        {c.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      {c.status === "pendiente" ? (
                        <button
                          onClick={() => handleMarkPaid(c)}
                          className="px-3 py-1 bg-[#10B981] hover:bg-[#059669] text-white rounded-lg text-[11px] font-bold shadow-2xs cursor-pointer"
                        >
                          Marcar Pagado
                        </button>
                      ) : (
                        <span className="text-[11px] text-[#737686] font-medium">{c.paymentDate}</span>
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
