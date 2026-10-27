"use client";

import React from "react";
import { useApp } from "@/lib/state";
import { monthlyCashSummary } from "@/lib/commercial-core";
import { getEcuadorDate } from "@/lib/date-utils";
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

export function FinancialChart() {
  const { financialMovements } = useApp();
  const chartData = monthlyCashSummary(financialMovements, getEcuadorDate());

  return (
    <div className="p-5 rounded-xl bg-white border border-[#e2e8f0] shadow-2xs flex flex-col justify-between">
      <div className="flex items-center justify-between pb-3 border-b border-[#f1f5f9]">
        <h3 className="font-bold text-xs uppercase tracking-wider text-[#0b1c30]">
          Ingresos vs Egresos
        </h3>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5 font-semibold text-slate-700">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#2563eb]"></span> Ingresos
          </span>
          <span className="flex items-center gap-1.5 font-semibold text-slate-700">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#f87171]"></span> Egresos
          </span>
        </div>
      </div>

      <div className="h-56 mt-4 w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
    </div>
  );
}
