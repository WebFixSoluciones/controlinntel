"use client";

import React from "react";
import { useApp } from "@/lib/state";
import { Users, DollarSign, ShieldAlert, Radio, TrendingUp, ArrowUpRight } from "lucide-react";

export function MetricsCards() {
  const { clients, clientServices, policies, nodes, expenses } = useApp();

  const activeClients = clients.filter((c) => c.status === "activo").length;
  const activeServices = clientServices.filter((s) => s.status === "activo");
  const mrr = activeServices.reduce((sum, s) => sum + s.customPrice, 0);

  const expiringPolicies = policies.filter((p) => p.status === "por_vencer" || p.status === "vencida").length;
  const onlineNodes = nodes.filter((n) => n.status === "online").length;
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const netUtility = mrr - totalExpenses;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 select-none">
      {/* MRR Mensual */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Ingresos Recurrentes (MRR)
          </span>
          <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-black text-slate-900 tracking-tight">
            ${mrr.toLocaleString("es-EC", { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[11px] font-bold text-emerald-600 flex items-center">
            <TrendingUp className="w-3 h-3 mr-0.5" /> +12.4%
          </span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          {activeServices.length} servicios activos de fibra óptica
        </p>
      </div>

      {/* Clientes Activos */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Abonados / Clientes
          </span>
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-black text-slate-900 tracking-tight">
            {activeClients}
          </span>
          <span className="text-xs font-semibold text-slate-500">Registrados</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          100% integrados con ficha técnica y facturación
        </p>
      </div>

      {/* Pólizas ARCOTEL */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Pólizas ARCOTEL
          </span>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
            expiringPolicies > 0 ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
          }`}>
            <ShieldAlert className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-black text-slate-900 tracking-tight">
            {expiringPolicies}
          </span>
          <span className={`text-xs font-bold ${expiringPolicies > 0 ? "text-amber-600" : "text-emerald-600"}`}>
            {expiringPolicies > 0 ? "Atención Requerida" : "Al Día"}
          </span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          Pólizas de fiel cumplimiento y responsabilidad civil
        </p>
      </div>

      {/* Infraestructura Nodos */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Nodos & MikroTik
          </span>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Radio className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-black text-slate-900 tracking-tight">
            {onlineNodes} / {nodes.length}
          </span>
          <span className="text-xs font-bold text-emerald-600">POPs Operativos</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          Monitoreo de Core Routers y enlaces troncales
        </p>
      </div>
    </div>
  );
}
