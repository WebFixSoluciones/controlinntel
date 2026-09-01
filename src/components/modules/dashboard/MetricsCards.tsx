"use client";

import React from "react";
import { useApp } from "@/lib/state";
import { Users, Banknote, Receipt, CreditCard, TrendingUp, TrendingDown } from "lucide-react";

export function MetricsCards() {
  const { clients, clientServices, expenses } = useApp();

  const activeClients = clients.filter((c) => c.status === "activo").length;
  const activeServices = clientServices.filter((s) => s.status === "activo");
  const mrr = activeServices.reduce((sum, s) => sum + s.customPrice, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const netUtility = mrr - totalExpenses;
  const isNetNegative = netUtility < 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 select-none">
      {/* 1. Clientes Activos */}
      <div className="p-5 rounded-2xl bg-white border border-[#e2e8f0] shadow-lumina-card flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-[#737686] uppercase tracking-wider">
            CLIENTES ACTIVOS
          </span>
          <div className="w-9 h-9 rounded-full bg-[#eff4ff] text-[#004ac6] flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-3">
          <span className="text-3xl font-black text-[#0b1c30] tracking-tight font-tnum">
            {activeClients}
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ecfdf5] text-[#065f46] flex items-center gap-1 border border-[#a7f3d0]">
            <TrendingUp className="w-3 h-3" /> +100%
          </span>
        </div>
      </div>

      {/* 2. Ingresos Mensuales */}
      <div className="p-5 rounded-2xl bg-white border border-[#e2e8f0] shadow-lumina-card flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-[#737686] uppercase tracking-wider">
            INGRESOS MENSUALES
          </span>
          <div className="w-9 h-9 rounded-full bg-[#eff4ff] text-[#004ac6] flex items-center justify-center">
            <Banknote className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-3">
          <span className="text-3xl font-black text-[#0b1c30] tracking-tight font-tnum">
            ${mrr.toLocaleString("es-EC", { minimumFractionDigits: 2 })}
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ecfdf5] text-[#065f46] flex items-center gap-1 border border-[#a7f3d0]">
            <TrendingUp className="w-3 h-3" /> +12%
          </span>
        </div>
      </div>

      {/* 3. Gastos */}
      <div className="p-5 rounded-2xl bg-white border border-[#e2e8f0] shadow-lumina-card flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-[#737686] uppercase tracking-wider">
            GASTOS
          </span>
          <div className="w-9 h-9 rounded-full bg-[#fef2f2] text-[#ef4444] flex items-center justify-center">
            <Receipt className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-3">
          <span className="text-3xl font-black text-[#0b1c30] tracking-tight font-tnum">
            ${totalExpenses.toLocaleString("es-EC", { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* 4. Utilidad Neta */}
      <div className="p-5 rounded-2xl bg-white border border-[#e2e8f0] shadow-lumina-card flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-[#737686] uppercase tracking-wider">
            UTILIDAD NETA
          </span>
          <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
            isNetNegative ? "bg-[#fef2f2] text-[#ef4444]" : "bg-[#ecfdf5] text-[#10B981]"
          }`}>
            <CreditCard className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-3">
          <span className={`text-3xl font-black tracking-tight font-tnum ${
            isNetNegative ? "text-[#ef4444]" : "text-[#10B981]"
          }`}>
            {isNetNegative ? "-" : ""}${Math.abs(netUtility).toLocaleString("es-EC", { minimumFractionDigits: 2 })}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
            isNetNegative
              ? "bg-[#fef2f2] text-[#991b1b] border-[#fecaca]"
              : "bg-[#ecfdf5] text-[#065f46] border-[#a7f3d0]"
          }`}>
            {isNetNegative ? "Negativa" : "+ Positiva"}
          </span>
        </div>
      </div>
    </div>
  );
}
