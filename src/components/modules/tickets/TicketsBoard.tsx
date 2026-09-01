"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { Ticket, TicketStatus } from "@/types";
import { Ticket as TicketIcon, Plus, CheckCircle2, Clock, AlertCircle } from "lucide-react";

interface TicketsBoardProps {
  onOpenNewModal: () => void;
}

export function TicketsBoard({ onOpenNewModal }: TicketsBoardProps) {
  const { tickets, updateTicketStatus } = useApp();
  const { showSuccess, showInfo } = useToast();
  const [filterStatus, setFilterStatus] = useState<string>("todos");

  const filtered = tickets.filter((t) => filterStatus === "todos" || t.status === filterStatus);

  const handleStatusChange = (t: Ticket, newStatus: TicketStatus) => {
    updateTicketStatus(t.id, newStatus);
    if (newStatus === "resuelto") {
      showSuccess("Ticket Resuelto", `Incidencia ${t.ticketNumber} marcada como resuelta satisfactoriamente.`);
    } else {
      showInfo("Estado Actualizado", `Ticket ${t.ticketNumber} cambiado a '${newStatus.toUpperCase()}'.`);
    }
  };

  return (
    <div className="space-y-6 select-none">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <TicketIcon className="w-5 h-5 text-sky-600" />
            Mesa de Ayuda Técnica NOC & Soporte al Cliente
          </h2>
          <p className="text-xs text-slate-400">
            Registro, asignación de cuadrillas y seguimiento de incidencias de fibra y enrutamiento
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-white text-xs font-semibold text-slate-700 rounded-xl px-3 py-2 border border-slate-200 focus:outline-hidden cursor-pointer"
          >
            <option value="todos">Todos los Estados</option>
            <option value="abierto">Abiertos</option>
            <option value="en_progreso">En Progreso</option>
            <option value="resuelto">Resueltos</option>
          </select>

          <button
            onClick={onOpenNewModal}
            className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Crear Ticket</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {filtered.map((t) => (
          <div
            key={t.id}
            className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-xs text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                  {t.ticketNumber}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    t.priority === "critica"
                      ? "bg-rose-100 text-rose-800"
                      : t.priority === "alta"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-sky-100 text-sky-800"
                  }`}
                >
                  {t.priority}
                </span>
              </div>

              <h3 className="font-bold text-sm text-slate-900 mt-3">{t.title}</h3>
              <p className="text-xs text-slate-500 mt-1">{t.description}</p>

              <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1 text-xs">
                <p><span className="text-slate-400">Cliente:</span> <span className="font-bold text-slate-800">{t.clientName}</span></p>
                <p><span className="text-slate-400">Asignado a:</span> <span className="font-bold text-sky-700">{t.assignedToName || "NOC Central"}</span></p>
                {t.nodeName && <p><span className="text-slate-400">Nodo:</span> {t.nodeName}</p>}
              </div>

              {t.resolutionNotes && (
                <p className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 p-2 rounded-lg mt-2">
                  ✓ {t.resolutionNotes}
                </p>
              )}
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
              <select
                value={t.status}
                onChange={(e) => handleStatusChange(t, e.target.value as TicketStatus)}
                className="bg-slate-50 text-xs font-bold text-slate-800 rounded-lg px-2.5 py-1 border border-slate-200 cursor-pointer"
              >
                <option value="abierto">Abierto</option>
                <option value="en_progreso">En Progreso</option>
                <option value="resuelto">Resuelto</option>
                <option value="cerrado">Cerrado</option>
              </select>

              <span className="text-[10px] text-slate-400 font-mono">
                {new Date(t.createdAt).toLocaleDateString("es-EC")}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
