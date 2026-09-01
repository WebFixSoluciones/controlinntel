"use client";

import React from "react";
import Link from "next/link";
import { useApp } from "@/lib/state";
import { Ticket, History, ArrowRight } from "lucide-react";

export function RecentActivity() {
  const { tickets, auditLogs } = useApp();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 select-none">
      {/* Tickets Recientes */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Ticket className="w-4 h-4 text-sky-600" />
            Tickets de Soporte Técnico NOC
          </h3>
          <Link href="/tickets" className="text-xs font-bold text-sky-600 hover:underline flex items-center gap-1">
            Ver Todos <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="mt-3 space-y-2 flex-1">
          {tickets.slice(0, 3).map((t) => (
            <div key={t.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-slate-800">{t.ticketNumber}</span>
                  <span className={`px-2 py-0.2 text-[9px] font-bold uppercase rounded-full ${
                    t.priority === "alta" ? "bg-rose-100 text-rose-800" : "bg-sky-100 text-sky-800"
                  }`}>
                    {t.priority}
                  </span>
                </div>
                <p className="text-xs text-slate-600 font-medium truncate max-w-xs mt-0.5">{t.title}</p>
                <p className="text-[10px] text-slate-400">{t.clientName}</p>
              </div>
              <span className="text-[11px] font-bold text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                {t.status.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Bitácora de Auditoría */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <History className="w-4 h-4 text-purple-600" />
            Pista de Auditoría Reciente
          </h3>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Inmutable</span>
        </div>
        <div className="mt-3 space-y-2 flex-1 overflow-y-auto max-h-48">
          {auditLogs.length === 0 ? (
            <p className="text-xs text-slate-400 italic p-4 text-center">No hay registros recientes aún. Realiza acciones en el sistema.</p>
          ) : (
            auditLogs.slice(0, 4).map((log) => (
              <div key={log.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-800 text-[11px]">{log.action}</span>
                  <p className="text-[11px] text-slate-500 truncate max-w-xs">{log.resource}</p>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
