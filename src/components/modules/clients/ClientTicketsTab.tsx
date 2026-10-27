"use client";

import React, { useState, useMemo } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { Client, Ticket, TicketStatus, TicketPriority } from "@/types";
import {
  Ticket as TicketIcon,
  Plus,
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
  User,
  X,
  ArrowLeft,
  Search,
} from "lucide-react";
import { TicketModal } from "../tickets/TicketModal";
import { TicketDetail } from "../tickets/TicketDetail";

interface ClientTicketsTabProps {
  client: Client;
}

export function ClientTicketsTab({ client }: ClientTicketsTabProps) {
  const { tickets, updateTicketStatus } = useApp();
  const { showSuccess, showError, showConfirm } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<"abiertos" | "todos">("abiertos");
  const [ticketSearch, setTicketSearch] = useState("");

  // Strictly filter tickets for this client
  const clientTickets = useMemo(() => {
    return (tickets || []).filter(
      (t) =>
        t.clientId === client.id ||
        (t.clientName && client.businessName && t.clientName.trim().toLowerCase() === client.businessName.trim().toLowerCase())
    );
  }, [tickets, client]);

  // Open tickets (excluding cerrado and resuelto)
  const openTickets = useMemo(() => {
    return clientTickets.filter((t) => t.status !== "cerrado" && t.status !== "resuelto");
  }, [clientTickets]);

  const displayedTickets = useMemo(() => {
    const base = filterMode === "abiertos" ? openTickets : clientTickets;
    if (!ticketSearch.trim()) return base;
    const q = ticketSearch.trim().toLowerCase();
    return base.filter(
      (t) =>
        t.ticketNumber.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        (t.assignedToName && t.assignedToName.toLowerCase().includes(q)) ||
        (t.category && t.category.toLowerCase().includes(q))
    );
  }, [filterMode, openTickets, clientTickets, ticketSearch]);

  const handleResolveTicket = (ticket: Ticket) => {
    showConfirm(
      "¿Resolver Incidencia?",
      `¿Deseas marcar el ticket ${ticket.ticketNumber} ("${ticket.title}") como resuelto?`,
      async () => {
        try {
          await updateTicketStatus(ticket.id, "resuelto", "Resuelto desde la ficha del cliente.");
          showSuccess("Ticket Resuelto", `El ticket ${ticket.ticketNumber} fue marcado como resuelto.`);
        } catch (error) {
          showError("Error", "No se pudo actualizar el estado del ticket.");
        }
      },
      "Marcar como Resuelto"
    );
  };

  const getPriorityBadge = (priority: TicketPriority) => {
    switch (priority) {
      case "critica":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
            Crítica
          </span>
        );
      case "alta":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
            Alta
          </span>
        );
      case "media":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200">
            Media
          </span>
        );
      case "baja":
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold uppercase bg-slate-50 text-slate-600 border border-slate-200">
            Baja
          </span>
        );
    }
  };

  const getStatusBadge = (status: TicketStatus) => {
    switch (status) {
      case "abierto":
        return (
          <span className="px-2.5 py-0.5 rounded-md text-xs font-bold uppercase bg-sky-50 text-sky-700 border border-sky-200">
            Abierto
          </span>
        );
      case "en_progreso":
        return (
          <span className="px-2.5 py-0.5 rounded-md text-xs font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200">
            En Progreso
          </span>
        );
      case "respondido":
        return (
          <span className="px-2.5 py-0.5 rounded-md text-xs font-bold uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
            Respondido
          </span>
        );
      case "en_espera":
        return (
          <span className="px-2.5 py-0.5 rounded-md text-xs font-bold uppercase bg-purple-50 text-purple-700 border border-purple-200">
            En Espera
          </span>
        );
      case "respuesta_cliente":
        return (
          <span className="px-2.5 py-0.5 rounded-md text-xs font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
            Respuesta Cliente
          </span>
        );
      case "resuelto":
        return (
          <span className="px-2.5 py-0.5 rounded-md text-xs font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
            Resuelto
          </span>
        );
      case "cerrado":
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-md text-xs font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200">
            Cerrado
          </span>
        );
    }
  };

  // If a ticket is selected for detail view
  if (selectedTicketId) {
    return (
      <div className="bg-white rounded-xl p-2 sm:p-4 border border-slate-200 shadow-xs animate-in fade-in">
        <TicketDetail id={selectedTicketId} onBack={() => setSelectedTicketId(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
        {/* Barra de búsqueda y filtros rápidos con botón Nuevo Ticket alineado a la derecha */}
        <div className="p-3 px-6 border-b border-[#e2e8f0] bg-white flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="w-3.5 h-3.5 text-[#64748b] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por ticket, asunto o técnico..."
              value={ticketSearch}
              onChange={(e) => setTicketSearch(e.target.value)}
              className="w-full text-xs pl-8 pr-8 py-1.5 rounded-lg border border-[#e2e8f0] bg-[#f8f9ff] text-[#0b1c30] placeholder-[#64748b] focus:bg-white focus:outline-hidden focus:border-[#004ac6] transition-colors"
            />
            {ticketSearch && (
              <button
                type="button"
                onClick={() => setTicketSearch("")}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                title="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs">
              {[
                { id: "abiertos", label: "Abiertos" },
                { id: "todos", label: "Todos" },
              ].map((tab) => {
                const isActive = filterMode === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilterMode(tab.id as any)}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                      isActive
                        ? "bg-[#004ac6] text-white shadow-2xs"
                        : "bg-[#f8f9ff] text-[#434655] hover:bg-slate-100 border border-[#e2e8f0]"
                    }`}
                  >
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <span className="h-4 w-px bg-slate-200 hidden sm:inline-block" aria-hidden="true" />

            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nuevo Ticket</span>
            </button>
          </div>
        </div>

        {/* Tabla o Estado Vacío */}
        {displayedTickets.length === 0 ? (
          <div className="py-12 text-center bg-white">
            <TicketIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-bold text-slate-700 text-xs">
              {clientTickets.length === 0
                ? "Sin incidencias registradas para este cliente"
                : filterMode === "abiertos"
                ? "No hay tickets abiertos para este cliente"
                : "No se encontraron tickets con los filtros aplicados"}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {filterMode === "abiertos" && clientTickets.length > 0
                ? "Todas las incidencias técnicas y requerimientos han sido atendidos y resueltos."
                : "Puedes registrar un nuevo ticket de soporte usando el botón de la barra."}
            </p>
            {ticketSearch && (
              <button
                type="button"
                onClick={() => setTicketSearch("")}
                className="mt-3 inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-[#004ac6] hover:underline cursor-pointer"
              >
                Restablecer búsqueda
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-fixed w-full text-left text-xs border-collapse">
              <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-xs uppercase tracking-wider border-b border-[#e2e8f0]">
                <tr>
                  <th className="py-3 px-4 w-[14%]">N° Ticket</th>
                  <th className="py-3 px-4 w-[32%]">Asunto / Incidencia Técnica</th>
                  <th className="py-3 px-4 w-[12%] text-center">Prioridad / SLA</th>
                  <th className="py-3 px-4 w-[12%] text-center">Estado</th>
                  <th className="py-3 px-4 w-[11%]">Fecha Reporte</th>
                  <th className="py-3 px-4 w-[11%]">Asignado a</th>
                  <th className="py-3 px-4 w-[8%] text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedTickets.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* N° Ticket */}
                    <td className="py-3.5 px-4 font-mono font-bold text-sky-700 whitespace-nowrap truncate">
                      {t.ticketNumber}
                    </td>

                    {/* Asunto / Incidencia */}
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-900 block truncate">{t.title}</span>
                      <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-400 capitalize truncate">
                        <span>{t.category ? t.category.replace("_", " ") : "Soporte"}</span>
                        {t.nodeName && <span>• {t.nodeName}</span>}
                        {t.serviceName && <span>• {t.serviceName}</span>}
                      </div>
                    </td>

                    {/* Prioridad / SLA */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      {getPriorityBadge(t.priority)}
                    </td>

                    {/* Estado */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      {getStatusBadge(t.status)}
                    </td>

                    {/* Fecha Reporte */}
                    <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap font-medium">
                      {t.createdAt.split("T")[0]}
                    </td>

                    {/* Asignado a */}
                    <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 truncate">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-medium truncate">{t.assignedToName || "NOC Central"}</span>
                      </div>
                    </td>

                    {/* Acciones */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {/* Ver / Gestionar Ticket */}
                        <button
                          type="button"
                          onClick={() => setSelectedTicketId(t.id)}
                          className="p-2 text-slate-500 hover:text-[#004ac6] hover:bg-blue-50 rounded-lg transition cursor-pointer"
                          title="Ver y Gestionar Ticket"
                          aria-label="Ver y Gestionar Ticket"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Resolver Ticket (si no está resuelto) */}
                        {t.status !== "resuelto" && t.status !== "cerrado" && (
                          <button
                            type="button"
                            onClick={() => handleResolveTicket(t)}
                            className="p-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                            title="Marcar Ticket como Resuelto"
                            aria-label="Marcar Ticket como Resuelto"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ticket Modal for this client */}
      {isModalOpen && (
        <TicketModal
          isOpen={true}
          onClose={() => setIsModalOpen(false)}
          initialClientId={client.id}
        />
      )}
    </div>
  );
}
