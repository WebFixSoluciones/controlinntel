"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { Ticket, TicketStatus } from "@/types";
import { Ticket as TicketIcon, Plus } from "lucide-react";

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
      showSuccess("Ticket Resuelto", `Incidencia ${t.ticketNumber} marcada como resuelta.`);
    } else {
      showInfo("Estado Actualizado", `Ticket ${t.ticketNumber} cambiado a '${newStatus.toUpperCase()}'.`);
    }
  };

  return (
    <div className="space-y-6 select-none">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1c30] tracking-tight flex items-center gap-2">
            <TicketIcon className="w-6 h-6 text-[#004ac6]" />
            Mesa de Ayuda Técnica NOC & Soporte
          </h1>
          <p className="text-xs text-[#737686] mt-0.5">
            Registro, asignación de cuadrillas y seguimiento de incidencias de fibra y enrutamiento
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-white text-xs font-semibold text-[#434655] rounded-lg px-3 py-2 border border-[#cbd5e1] focus:outline-hidden cursor-pointer"
          >
            <option value="todos">Todos los Estados</option>
            <option value="abierto">Abiertos</option>
            <option value="en_progreso">En Progreso</option>
            <option value="resuelto">Resueltos</option>
          </select>

          <button
            onClick={onOpenNewModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Crear Ticket</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {filtered.map((t) => (
          <div
            key={t.id}
            className="p-6 rounded-2xl bg-white border border-[#e2e8f0] shadow-lumina-card flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono font-semibold text-xs text-[#0b1c30] bg-[#f8f9ff] px-2.5 py-0.5 rounded-md border border-[#e2e8f0]">
                  {t.ticketNumber}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    t.priority === "critica"
                      ? "bg-[#fef2f2] text-[#991b1b] border border-[#fecaca]"
                      : t.priority === "alta"
                      ? "bg-[#fffbeb] text-[#92400e] border border-[#fde68a]"
                      : "bg-[#eff4ff] text-[#004ac6] border border-[#dce9ff]"
                  }`}
                >
                  {t.priority}
                </span>
              </div>

              <h3 className="font-bold text-base text-[#0b1c30] mt-3">{t.title}</h3>
              <p className="text-xs text-[#737686] mt-1">{t.description}</p>

              <div className="mt-4 p-3.5 rounded-xl bg-[#f8f9ff] border border-[#e2e8f0] space-y-1.5 text-xs">
                <p><span className="text-[#737686]">Cliente:</span> <span className="font-bold text-[#0b1c30]">{t.clientName}</span></p>
                <p><span className="text-[#737686]">Asignado a:</span> <span className="font-bold text-[#004ac6]">{t.assignedToName || "NOC Central"}</span></p>
                {t.nodeName && <p><span className="text-[#737686]">Nodo:</span> {t.nodeName}</p>}
              </div>

              {t.resolutionNotes && (
                <p className="text-[11px] text-[#065f46] bg-[#ecfdf5] border border-[#a7f3d0] p-2.5 rounded-lg mt-2">
                  ✓ {t.resolutionNotes}
                </p>
              )}
            </div>

            <div className="mt-5 pt-3 border-t border-[#f1f5f9] flex items-center justify-between">
              <select
                value={t.status}
                onChange={(e) => handleStatusChange(t, e.target.value as TicketStatus)}
                className="bg-[#f8f9ff] text-xs font-bold text-[#0b1c30] rounded-lg px-2.5 py-1 border border-[#cbd5e1] cursor-pointer"
              >
                <option value="abierto">Abierto</option>
                <option value="en_progreso">En Progreso</option>
                <option value="resuelto">Resuelto</option>
                <option value="cerrado">Cerrado</option>
              </select>

              <span className="text-[10px] text-[#737686] font-mono">
                {new Date(t.createdAt).toLocaleDateString("es-EC")}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
