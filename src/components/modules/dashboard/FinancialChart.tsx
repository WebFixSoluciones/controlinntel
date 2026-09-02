"use client";

import React from "react";
import { useApp } from "@/lib/state";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { MoreVertical } from "lucide-react";

export function FinancialChart() {
  const { monthlyCharges, expenses, clientServices } = useApp();

  const mrr = clientServices.filter((s) => s.status === "activo").reduce((sum, s) => sum + s.customPrice, 0);
  const currentIngresos = monthlyCharges.reduce((sum, c) => sum + c.total, 0) || mrr || 203;
  const currentGastos = expenses.reduce((sum, e) => sum + e.amount, 0) || 2920;

  const chartData = [
    { mes: "May", ingresos: 180, egresos: 1200, comparativo: 180 },
    { mes: "Jun", ingresos: 195, egresos: 1850, comparativo: 195 },
    { mes: "Jul", ingresos: 210, egresos: 2400, comparativo: 210 },
    { mes: "Ago", ingresos: 230, egresos: 2100, comparativo: 230 },
    { mes: "Sep", ingresos: currentIngresos, egresos: currentGastos, comparativo: currentIngresos },
  ];

  return (
    <div className="p-6 rounded-2xl bg-white border border-[#e2e8f0] shadow-lumina-card flex flex-col justify-between select-none">
      <div className="flex items-center justify-between pb-3 border-b border-[#f1f5f9]">
        <h3 className="font-bold text-sm text-[#0b1c30]">Ingresos vs Egresos</h3>
        <button className="p-1 rounded-lg text-[#737686] hover:text-[#0b1c30] hover:bg-[#f8f9ff] cursor-pointer">
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>

      <div className="h-64 mt-4 w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 15, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="mes" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#737686" }} />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "#737686" }}
              tickFormatter={(val) => `$${val}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#FFFFFF",
                borderRadius: "8px",
                border: "1px solid #E2E8F0",
                fontSize: "11px",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
              }}
              formatter={(value: any) => [
                `$${Number(value).toLocaleString("es-EC", { minimumFractionDigits: 2 })} USD`,
                "",
              ]}
            />
            <Bar dataKey="ingresos" name="Ingresos" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={20} />
            <Bar dataKey="egresos" name="Egresos" fill="#f87171" radius={[4, 4, 0, 0]} barSize={20} />
            <Line type="monotone" dataKey="comparativo" name="Comparativo" stroke="#2563eb" strokeWidth={2} dot={{ r: 3, fill: "#2563eb" }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 pt-3 border-t border-[#f1f5f9] flex items-center justify-between text-[11px] font-semibold text-[#737686]">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-[#0b1c30]">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#2563eb]"></span> Ingresos
          </span>
          <span className="flex items-center gap-1.5 text-[#0b1c30]">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#f87171]"></span> Egresos
          </span>
        </div>
        <span className="text-[10px] text-[#004ac6] bg-[#eff4ff] px-2 py-0.5 rounded font-bold">
          Gráfico Comparativo
        </span>
      </div>
    </div>
  );
}
