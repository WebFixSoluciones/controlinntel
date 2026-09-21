"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { Ticket, TicketStatus } from "@/types";
import { Ticket as TicketIcon, Plus } from "lucide-react";

import { TicketDetail } from "./TicketDetail";

interface TicketsBoardProps {
  onOpenNewModal: () => void;
}

export function TicketsBoard({ onOpenNewModal }: TicketsBoardProps) {
  const { tickets, updateTicketStatus } = useApp();
  const { showSuccess, showInfo } = useToast();
  const [filterStatus, setFilterStatus] = useState<string>("todos");

  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const filtered = tickets.filter(t => (filterStatus === "todos" || t.status === filterStatus) && `${t.ticketNumber} ${t.clientName} ${t.title}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a,b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  const handleStatusChange = async (t: Ticket, newStatus: TicketStatus) => {
    try {

    await updateTicketStatus(t.id, newStatus);
    if (newStatus === "resuelto") {
      showSuccess("Ticket Resuelto", `Incidencia ${t.ticketNumber} marcada como resuelta.`);
    } else {
      showInfo("Estado Actualizado", `Ticket ${t.ticketNumber} cambiado a '${newStatus.toUpperCase()}'.`);
    }
  
    } catch (error) { window.dispatchEvent(new CustomEvent("inntel:error", { detail: error instanceof Error ? error.message : "No se pudo guardar." })); }
};

  if (selected) return <TicketDetail key={selected} id={selected} onBack={() => setSelected(null)} />;
  return (
    <div className="space-y-6 select-none">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1c30] tracking-tight flex items-center gap-2">
            <TicketIcon className="w-6 h-6 text-[#004ac6]" />
            Mesa de Ayuda Técnica NOC & Soporte
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input aria-label="Buscar tickets por cliente o número" placeholder="Cliente o número de ticket" value={query} onChange={e => setQuery(e.target.value)} className="rounded-lg border p-2 text-xs" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-white text-xs font-semibold text-[#434655] rounded-lg px-3 py-2 border border-[#cbd5e1] focus:outline-hidden cursor-pointer"
          >
            <option value="todos">Todos los Estados</option>
            <option value="abierto">Abiertos</option>
            <option value="en_progreso">En Progreso</option>
            <option value="resuelto">Resueltos</option><option value="cerrado">Cerrados</option>
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

      <div className="overflow-x-auto rounded-2xl border border-[#e2e8f0] bg-white shadow-lumina-card">
        <table className="min-w-[1250px] w-full text-left text-xs">
          <caption className="sr-only">Tickets de soporte registrados</caption>
          <thead className="bg-[#f8f9ff] text-[10px] uppercase tracking-wide text-[#737686]">
            <tr>
              <th scope="col" className="px-5 py-3 font-bold">Ticket</th>
              <th scope="col" className="px-5 py-3 font-bold">Incidencia</th>
              <th scope="col" className="px-5 py-3 font-bold">Cliente / Nodo</th>
              <th scope="col" className="px-5 py-3 font-bold">Asignado a</th>
              <th scope="col" className="px-5 py-3 font-bold">Prioridad</th>
              <th scope="col" className="px-5 py-3 font-bold">Estado</th>
              <th scope="col" className="px-5 py-3 text-right font-bold">Fecha de solicitud</th>
              <th scope="col" className="px-5 py-3">N.º soportes del cliente</th>
              <th scope="col" className="px-5 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9] text-[#0b1c30]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-5 py-10 text-center text-xs italic text-[#737686]">
                  No hay tickets que coincidan con el filtro seleccionado.
                </td>
              </tr>
            ) : filtered.map((t) => (
              <tr key={t.id} className="hover:bg-[#f8f9ff]">
                <th scope="row" className="px-5 py-4 font-mono font-bold"><button onClick={() => setSelected(t.id)} className="text-blue-700 underline">{t.ticketNumber}</button></th>
                <td className="max-w-sm px-5 py-4">
                  <div className="font-bold">{t.title}</div>
                  <div className="mt-0.5 line-clamp-2 text-[11px] text-[#737686]">{t.description}</div>
                  {t.resolutionNotes && <div className="mt-1 line-clamp-1 text-[10px] font-semibold text-[#065f46]">✓ {t.resolutionNotes}</div>}
                </td>
                <td className="px-5 py-4">
                  <div className="font-bold">{t.clientName}</div>
                  {t.nodeName && <div className="mt-0.5 text-[11px] text-[#737686]">Nodo: {t.nodeName}</div>}
                </td>
                <td className="px-5 py-4 font-semibold text-[#004ac6]">{t.assignedToName || "NOC Central"}</td>
                <td className="px-5 py-4">
                  <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                    t.priority === "critica"
                      ? "border-[#fecaca] bg-[#fef2f2] text-[#991b1b]"
                      : t.priority === "alta"
                      ? "border-[#fde68a] bg-[#fffbeb] text-[#92400e]"
                      : "border-[#dce9ff] bg-[#eff4ff] text-[#004ac6]"
                  }`}>
                    {t.priority}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <select
                    value={t.status}
                    onChange={(e) => void handleStatusChange(t, e.target.value as TicketStatus)}
                    aria-label={`Estado del ticket ${t.ticketNumber}`}
                    className="rounded-lg border border-[#cbd5e1] bg-[#f8f9ff] px-2.5 py-1 text-xs font-bold text-[#0b1c30]"
                  >
                    <option value="abierto">Abierto</option>
                    <option value="en_progreso">En Progreso</option>
                    <option value="resuelto">Resuelto</option>
                    <option value="cerrado">Cerrado</option>
                  </select>
                </td>
                <td className="px-5 py-4 text-right font-mono text-[10px] text-[#737686]">
                  {new Date(t.createdAt).toLocaleString("es-EC")}
                </td>
                <td className="px-5 py-4 tabular-nums">{tickets.filter(other => other.clientId === t.clientId).length}</td>
                <td className="px-5 py-4"><button onClick={() => setSelected(t.id)} className="text-blue-700 underline">Ver ticket</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
