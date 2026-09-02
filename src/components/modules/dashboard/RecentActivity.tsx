"use client";

import React from "react";
import Link from "next/link";
import { useApp } from "@/lib/state";
import { Ticket, ArrowRight, Activity } from "lucide-react";

export function TicketsRecientesCard() {
  const { tickets } = useApp();

  const mockTickets = [
    {
      id: "tk-1",
      title: "Caída de enlace GPON",
      client: "MEGARED S.A.",
      status: "En Progreso",
      dotColor: "bg-[#ef4444]",
    },
    {
      id: "tk-2",
      title: "Configuración OLT",
      client: "FASTNET LTDA.",
      status: "Resuelto",
      dotColor: "bg-[#f59e0b]",
    },
  ];

  return (
    <div className="p-6 rounded-2xl bg-white border border-[#e2e8f0] shadow-lumina-card flex flex-col justify-between select-none">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-[#f1f5f9]">
          <h3 className="font-bold text-sm text-[#0b1c30] flex items-center gap-2">
            <Ticket className="w-4 h-4 text-[#004ac6]" />
            Tickets Recientes
          </h3>
        </div>

        <div className="mt-3 space-y-3">
          {mockTickets.map((t) => (
            <div
              key={t.id}
              className="p-3 rounded-xl bg-[#f8f9ff] border border-[#e2e8f0] flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-start gap-2.5">
                <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${t.dotColor}`} />
                <div>
                  <span className="font-bold text-[#0b1c30] block">{t.title}</span>
                  <span className="text-[11px] text-[#737686] block">Cliente: {t.client}</span>
                </div>
              </div>

              <span className="px-2.5 py-1 rounded-md bg-white border border-[#cbd5e1] text-[10px] font-bold text-[#434655]">
                {t.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AuditActivityTable() {
  const { auditLogs } = useApp();

  const defaultLogs = [
    {
      id: "log-1",
      initials: "SM",
      avatarBg: "bg-[#2563eb] text-white",
      user: "Ing. Santiago Morales",
      role: "Super Admin",
      action: "Inicio de Sesión",
      actionBg: "bg-[#eff4ff] text-[#004ac6] border-[#dce9ff]",
      module: "Sistema Base",
      time: "Hoy, 08:30 AM",
    },
    {
      id: "log-2",
      initials: "AP",
      avatarBg: "bg-[#712ae2] text-white",
      user: "Ana Pérez (Contabilidad)",
      role: "Contador",
      action: "Registro de Gasto",
      actionBg: "bg-[#fffbeb] text-[#92400e] border-[#fde68a]",
      module: "Finanzas",
      time: "Ayer, 16:45 PM",
    },
    {
      id: "log-3",
      initials: "CR",
      avatarBg: "bg-[#059669] text-white",
      user: "Carlos Rivas (NOC)",
      role: "Ing. de Redes",
      action: "Sincronización OLT",
      actionBg: "bg-[#ecfdf5] text-[#065f46] border-[#a7f3d0]",
      module: "Red / Nodos",
      time: "Ayer, 14:20 PM",
    },
  ];

  return (
    <div className="rounded-2xl bg-white border border-[#e2e8f0] shadow-lumina-card overflow-hidden select-none">
      <div className="p-5 border-b border-[#e2e8f0] flex items-center justify-between">
        <h3 className="font-bold text-sm text-[#0b1c30]">
          Actividad Reciente (Auditoría)
        </h3>
        <span className="text-[11px] text-[#737686] font-medium">Registro Inmutable de Seguridad</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-[11px] uppercase tracking-wider border-b border-[#e2e8f0]">
            <tr>
              <th className="py-3 px-6">USUARIO</th>
              <th className="py-3 px-6">ACCIÓN</th>
              <th className="py-3 px-6">MÓDULO</th>
              <th className="py-3 px-6 text-right">FECHA/HORA</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9] text-[#434655] font-medium">
            {defaultLogs.map((log) => (
              <tr key={log.id} className="hover:bg-[#f8f9ff] transition-colors">
                <td className="py-3.5 px-6">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${log.avatarBg}`}>
                      {log.initials}
                    </div>
                    <div>
                      <p className="font-bold text-[#0b1c30]">{log.user}</p>
                      <span className="text-[10px] text-[#737686]">{log.role}</span>
                    </div>
                  </div>
                </td>
                <td className="py-3.5 px-6">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${log.actionBg}`}>
                    {log.action}
                  </span>
                </td>
                <td className="py-3.5 px-6 font-semibold text-[#0b1c30]">
                  {log.module}
                </td>
                <td className="py-3.5 px-6 text-right font-tnum text-[#737686] text-[11px]">
                  {log.time}
                </td>
              </tr>
            ))}
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
