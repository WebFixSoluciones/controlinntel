"use client";

import React from "react";
import { useApp } from "@/lib/state";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export function FinancialChart() {
  const { monthlyCharges, expenses } = useApp();

  const currentIngresos = monthlyCharges.reduce((sum, c) => sum + c.total, 0);
  const currentGastos = expenses.reduce((sum, e) => sum + e.amount, 0);
  const currentUtilidad = currentIngresos - currentGastos;

  const chartData = [
    {
      mes: "Sep 2026",
      ingresos: currentIngresos,
      egresos: currentGastos,
      utilidad: currentUtilidad > 0 ? currentUtilidad : 0,
    },
  ];

  return (
    <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col select-none">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <h3 className="font-bold text-slate-900 text-sm">Flujo Financiero Operativo (USD)</h3>
          <p className="text-[11px] text-slate-400">Comparativa mensual de Ingresos (MRR), Gastos (OPEX) y Utilidad Neta en vivo</p>
        </div>
        <div className="flex items-center gap-3 text-xs font-bold">
          <span className="flex items-center gap-1.5 text-sky-600">
            <span className="w-2.5 h-2.5 rounded-sm bg-sky-600"></span> Ingresos
          </span>
          <span className="flex items-center gap-1.5 text-purple-600">
            <span className="w-2.5 h-2.5 rounded-sm bg-purple-600"></span> Utilidad
          </span>
          <span className="flex items-center gap-1.5 text-rose-500">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-400"></span> Gastos
          </span>
        </div>
      </div>

      <div className="h-64 mt-4 w-full">
        {currentIngresos === 0 && currentGastos === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            <p className="text-xs font-bold text-slate-500">Sin movimientos financieros registrados</p>
            <p className="text-[11px] text-slate-400 mt-1">Los gráficos se generarán automáticamente conforme registres cobros y gastos.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              <XAxis dataKey="mes" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748B" }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748B" }} tickFormatter={(val) => `$${val}`} />
              <Tooltip
                contentStyle={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", fontSize: "11px" }}
                formatter={(value: any) => [`$${Number(value).toLocaleString("es-EC", { minimumFractionDigits: 2 })} USD`, ""]}
              />
              <Bar dataKey="ingresos" name="Ingresos" fill="#0284C7" radius={[4, 4, 0, 0]} />
              <Bar dataKey="utilidad" name="Utilidad Neta" fill="#7A4499" radius={[4, 4, 0, 0]} />
              <Bar dataKey="egresos" name="Gastos" fill="#FB7185" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
