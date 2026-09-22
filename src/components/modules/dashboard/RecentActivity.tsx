"use client";

import React from "react";
import Link from "next/link";
import { useApp } from "@/lib/state";
import { Ticket as TicketIcon, Activity, Clock, ShieldCheck, ArrowRight } from "lucide-react";

export function TicketsRecientesCard() {
  const { tickets } = useApp();

  const displayTickets = tickets.slice(0, 4);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "abierto":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-100 text-red-800 border border-red-200">Abierto</span>;
      case "en_progreso":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-200">En Progreso</span>;
      case "resuelto":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">Resuelto</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">{status}</span>;
    }
  };

  return (
    <div className="p-6 rounded-2xl bg-white border border-[#e2e8f0] shadow-lumina-card flex flex-col justify-between select-none">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-[#f1f5f9]">
          <h3 className="font-bold text-sm text-[#0b1c30] flex items-center gap-2">
            <TicketIcon className="w-4 h-4 text-[#004ac6]" />
            Tickets Recientes de Soporte
          </h3>
          <Link href="/tickets" className="text-xs font-bold text-[#004ac6] hover:text-[#2563eb] flex items-center gap-1">
            <span>Ver todos</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="mt-3 space-y-2.5">
          {displayTickets.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-4 text-center">No hay tickets recientes.</p>
          ) : (
            displayTickets.map((t) => (
              <div
                key={t.id}
                className="p-3 rounded-xl bg-[#f8f9ff] border border-[#e2e8f0] flex items-center justify-between gap-3 text-xs hover:border-[#cbd5e1] transition-all"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold text-[#004ac6]">{t.ticketNumber}</span>
                    <span className="font-bold text-[#0b1c30] truncate block">{t.title}</span>
                  </div>
                  <span className="text-[11px] text-[#737686] truncate block mt-0.5">
                    {t.clientName} {t.assignedToName ? `• ${t.assignedToName}` : ""}
                  </span>
                </div>
                <div className="shrink-0">{getStatusBadge(t.status)}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export function AuditActivityTable() {
  const { auditLogs } = useApp();

  const displayLogs = auditLogs.slice(0, 6);

  const formatActionBadge = (action: string) => {
    if (action.includes("CREATE")) return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (action.includes("UPDATE")) return "bg-blue-50 text-[#004ac6] border-blue-200";
    if (action.includes("DELETE")) return "bg-rose-50 text-rose-700 border-rose-200";
    if (action.includes("AUTH") || action.includes("LOGIN")) return "bg-indigo-50 text-indigo-700 border-indigo-200";
    return "bg-slate-50 text-slate-700 border-slate-200";
  };

  return (
    <div className="rounded-2xl bg-white border border-[#e2e8f0] shadow-lumina-card overflow-hidden select-none">
      <div className="p-5 border-b border-[#e2e8f0] flex items-center justify-between bg-white">
        <h3 className="font-bold text-sm text-[#0b1c30] flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#004ac6]" />
          Actividad Reciente & Auditoría Forense
        </h3>
        <span className="text-[11px] text-[#737686] font-medium flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          Registro Inmutable de Seguridad
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs min-w-[800px]">
          <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-[11px] uppercase tracking-wider border-b border-[#e2e8f0]">
            <tr>
              <th className="py-3.5 px-6">Usuario / Operador</th>
              <th className="py-3.5 px-6">Acción Registrada</th>
              <th className="py-3.5 px-6">Recurso / Detalle</th>
              <th className="py-3.5 px-6 text-right">Fecha & Hora</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9] text-[#434655] font-medium">
            {displayLogs.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-slate-400 italic">
                  Sin registros de auditoría aún.
                </td>
              </tr>
            ) : (
              displayLogs.map((log) => {
                const initials = (log.userEmail || log.userId || "OP").slice(0, 2).toUpperCase();

                return (
                  <tr key={log.id} className="hover:bg-[#f8f9ff] transition-colors">
                    <td className="py-3.5 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#004ac6] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                          {initials}
                        </div>
                        <div>
                          <p className="font-bold text-[#0b1c30]">{log.userEmail || "Sistema"}</p>
                          <span className="text-[10px] text-[#737686] capitalize">{log.userRole || "Operador"}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-6">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${formatActionBadge(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3.5 px-6">
                      <p className="font-semibold text-[#0b1c30] truncate max-w-md">{log.resource}</p>
                      {log.details && <span className="text-[10px] text-[#737686] truncate max-w-md block">{log.details}</span>}
                    </td>
                    <td className="py-3.5 px-6 text-right font-mono text-[#737686] text-[11px] whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString("es-EC")}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RecentActivity() {
  return (
    <div className="space-y-6">
      <AuditActivityTable />
    </div>
  );
}
