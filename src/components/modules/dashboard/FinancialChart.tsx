"use client";

import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

const MONTHLY_DATA = [
  { mes: "Mar", ingresos: 22400, egresos: 7100, utilidad: 15300 },
  { mes: "Abr", ingresos: 23800, egresos: 7400, utilidad: 16400 },
  { mes: "May", ingresos: 25100, egresos: 8000, utilidad: 17100 },
  { mes: "Jun", ingresos: 26500, egresos: 8200, utilidad: 18300 },
  { mes: "Jul", ingresos: 27800, egresos: 8500, utilidad: 19300 },
  { mes: "Ago", ingresos: 28450, egresos: 8920, utilidad: 19530 },
];

export function FinancialChart() {
  return (
    <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col select-none">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <h3 className="font-bold text-slate-900 text-sm">Flujo Financiero Operativo (USD)</h3>
          <p className="text-[11px] text-slate-400">Comparativa mensual de Ingresos (MRR), Gastos (OPEX) y Utilidad Neta</p>
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
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={MONTHLY_DATA} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
            <XAxis dataKey="mes" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748B" }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748B" }} tickFormatter={(val) => `$${val / 1000}k`} />
            <Tooltip
              contentStyle={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", fontSize: "11px" }}
              formatter={(value: any) => [`$${Number(value).toLocaleString("es-EC")} USD`, ""]}
            />
            <Bar dataKey="ingresos" name="Ingresos" fill="#0284C7" radius={[4, 4, 0, 0]} />
            <Bar dataKey="utilidad" name="Utilidad Neta" fill="#7A4499" radius={[4, 4, 0, 0]} />
            <Bar dataKey="egresos" name="Gastos" fill="#FB7185" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
