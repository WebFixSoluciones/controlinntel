"use client";

import React from "react";
import { useApp } from "@/lib/state";
import { monthlyCashSummary } from "@/lib/commercial-core";
import { getEcuadorDate } from "@/lib/date-utils";
import { Users, Banknote, Receipt, CreditCard, TrendingUp } from "lucide-react";

export function MetricsCards() {
  const { clients, financialMovements } = useApp();

  const activeClients = clients.filter((c) => c.status === "activo").length;
  const cash = monthlyCashSummary(financialMovements, getEcuadorDate()).slice(-1)[0];
  const mrr = cash.ingresos;
  const totalExpenses = cash.egresos;
  const netUtility = mrr - totalExpenses;
  const isNetNegative = netUtility < 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Clientes Activos */}
      <div className="p-4 rounded-xl bg-white border border-[#e2e8f0] shadow-lumina-card flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-[#737686] uppercase tracking-wider">
            Clientes Activos
          </span>
          <div className="w-8 h-8 rounded-lg bg-[#eff4ff] text-[#004ac6] flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2.5">
          <span className="text-2xl font-black text-[#0b1c30] tracking-tight font-tnum">
            {activeClients}
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ecfdf5] text-[#065f46] flex items-center gap-1 border border-[#a7f3d0]">
            Actuales
          </span>
        </div>
      </div>

      {/* 2. Ingresos Mensuales */}
      <div className="p-4 rounded-xl bg-white border border-[#e2e8f0] shadow-lumina-card flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-[#737686] uppercase tracking-wider">
            Ingresos de caja del mes
          </span>
          <div className="w-8 h-8 rounded-lg bg-[#eff4ff] text-[#004ac6] flex items-center justify-center">
            <Banknote className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2.5">
          <span className="text-2xl font-black text-[#0b1c30] tracking-tight font-tnum">
            ${mrr.toLocaleString("es-EC", { minimumFractionDigits: 2 })}
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ecfdf5] text-[#065f46] flex items-center gap-1 border border-[#a7f3d0]">
            Confirmados
          </span>
        </div>
      </div>

      {/* 3. Gastos */}
      <div className="p-4 rounded-xl bg-white border border-[#e2e8f0] shadow-lumina-card flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-[#737686] uppercase tracking-wider">
            Egresos de caja del mes
          </span>
          <div className="w-8 h-8 rounded-lg bg-[#fef2f2] text-[#ef4444] flex items-center justify-center">
            <Receipt className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2.5">
          <span className="text-2xl font-black text-[#0b1c30] tracking-tight font-tnum">
            ${totalExpenses.toLocaleString("es-EC", { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* 4. Utilidad Neta */}
      <div className="p-4 rounded-xl bg-white border border-[#e2e8f0] shadow-lumina-card flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-[#737686] uppercase tracking-wider">
            Flujo neto del mes
          </span>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            isNetNegative ? "bg-[#fef2f2] text-[#ef4444]" : "bg-[#ecfdf5] text-[#10B981]"
          }`}>
            <CreditCard className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2.5">
          <span className={`text-2xl font-black tracking-tight font-tnum ${
            isNetNegative ? "text-[#ef4444]" : "text-[#10B981]"
          }`}>
            {isNetNegative ? "-" : ""}${Math.abs(netUtility).toLocaleString("es-EC", { minimumFractionDigits: 2 })}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
            isNetNegative
              ? "bg-[#fef2f2] text-[#991b1b] border-[#fecaca]"
              : "bg-[#ecfdf5] text-[#065f46] border-[#a7f3d0]"
          }`}>
            {isNetNegative ? "Negativa" : "Positiva"}
          </span>
        </div>
      </div>
    </div>
  );
}
