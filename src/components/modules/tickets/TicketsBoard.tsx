"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { Ticket, TicketStatus } from "@/types";
import { Ticket as TicketIcon, Plus, Search, Eye } from "lucide-react";

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
    } catch (error) {
      window.dispatchEvent(new CustomEvent("inntel:error", { detail: error instanceof Error ? error.message : "No se pudo guardar." }));
    }
  };

  if (selected) return <TicketDetail key={selected} id={selected} onBack={() => setSelected(null)} />;

  return (
    <div className="w-full space-y-6 select-none">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1c30] tracking-tight flex items-center gap-2">
            <TicketIcon className="w-6 h-6 text-[#004ac6]" />
            Mesa de Ayuda Técnica NOC & Soporte
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-[#737686] absolute left-3 top-2.5" />
            <input
              aria-label="Buscar tickets por cliente o número"
              placeholder="Buscar por cliente o ticket..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg border border-[#cbd5e1] pl-9 pr-3 py-2 text-xs bg-white text-[#0b1c30] focus:outline-hidden focus:border-[#004ac6]"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-white text-xs font-semibold text-[#434655] rounded-lg px-3 py-2 border border-[#cbd5e1] focus:outline-hidden cursor-pointer"
          >
            <option value="todos">Todos los Estados</option>
            <option value="abierto">Abiertos</option>
            <option value="en_progreso">En Progreso</option>
            <option value="resuelto">Resueltos</option>
            <option value="cerrado">Cerrados</option>
          </select>

          <button
            onClick={onOpenNewModal}
            className="flex items-center gap-2 px-4 py-2 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Crear Ticket</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[#e2e8f0] bg-white shadow-lumina-card">
        <table className="w-full text-left text-xs">
          <caption className="sr-only">Tickets de soporte registrados</caption>
          <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-[11px] uppercase tracking-wider border-b border-[#e2e8f0]">
            <tr>
              <th scope="col" className="px-5 py-3.5">Ticket</th>
              <th scope="col" className="px-5 py-3.5">Incidencia</th>
              <th scope="col" className="px-5 py-3.5">Cliente / Nodo</th>
              <th scope="col" className="px-5 py-3.5">Asignado a</th>
              <th scope="col" className="px-5 py-3.5">Prioridad</th>
              <th scope="col" className="px-5 py-3.5">Estado</th>
              <th scope="col" className="px-5 py-3.5 text-right">Fecha de Solicitud</th>
              <th scope="col" className="px-5 py-3.5 text-center">Historial</th>
              <th scope="col" className="px-5 py-3.5 text-right">Acción</th>
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
              <tr key={t.id} className="hover:bg-[#f8f9ff] transition-colors">
                <th scope="row" className="px-5 py-3.5 font-mono font-bold">
                  <button onClick={() => setSelected(t.id)} className="text-[#004ac6] hover:underline cursor-pointer">
                    {t.ticketNumber}
                  </button>
                </th>
                <td className="max-w-sm px-5 py-3.5">
                  <div className="font-bold text-[#0b1c30]">{t.title}</div>
                  <div className="mt-0.5 line-clamp-1 text-[11px] text-[#737686]">{t.description}</div>
                  {t.resolutionNotes && <div className="mt-0.5 line-clamp-1 text-[10px] font-semibold text-[#065f46]">✓ {t.resolutionNotes}</div>}
                </td>
                <td className="px-5 py-3.5">
                  <div className="font-bold text-[#0b1c30]">{t.clientName}</div>
                  {t.nodeName && <div className="mt-0.5 text-[11px] text-[#737686]">Nodo: {t.nodeName}</div>}
                </td>
                <td className="px-5 py-3.5 font-semibold text-[#004ac6]">{t.assignedToName || "NOC Central"}</td>
                <td className="px-5 py-3.5">
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
                <td className="px-5 py-3.5">
                  <select
                    value={t.status}
                    onChange={(e) => void handleStatusChange(t, e.target.value as TicketStatus)}
                    aria-label={`Estado del ticket ${t.ticketNumber}`}
                    className="rounded-lg border border-[#cbd5e1] bg-white px-2.5 py-1 text-xs font-bold text-[#0b1c30] cursor-pointer"
                  >
                    <option value="abierto">Abierto</option>
                    <option value="en_progreso">En Progreso</option>
                    <option value="resuelto">Resuelto</option>
                    <option value="cerrado">Cerrado</option>
                  </select>
                </td>
                <td className="px-5 py-3.5 text-right font-mono text-[11px] text-[#737686]">
                  {new Date(t.createdAt).toLocaleDateString("es-EC")}
                </td>
                <td className="px-5 py-3.5 text-center">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#f1f5f9] text-[#434655] font-bold text-[11px]">
                    {tickets.filter(other => other.clientId === t.clientId).length}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <button
                    onClick={() => setSelected(t.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#004ac6] bg-[#eff4ff] hover:bg-[#dce9ff] transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Ver</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
