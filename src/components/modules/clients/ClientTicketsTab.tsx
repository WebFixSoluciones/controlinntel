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

  const displayedTickets = filterMode === "abiertos" ? openTickets : clientTickets;

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
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
            Crítica
          </span>
        );
      case "alta":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
            Alta
          </span>
        );
      case "media":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200">
            Media
          </span>
        );
      case "baja":
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-50 text-slate-600 border border-slate-200">
            Baja
          </span>
        );
    }
  };

  const getStatusBadge = (status: TicketStatus) => {
    switch (status) {
      case "abierto":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-sky-50 text-sky-700 border border-sky-200">
            Abierto
          </span>
        );
      case "en_progreso":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200">
            En Progreso
          </span>
        );
      case "respondido":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
            Respondido
          </span>
        );
      case "en_espera":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-50 text-purple-700 border border-purple-200">
            En Espera
          </span>
        );
      case "respuesta_cliente":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
            Respuesta Cliente
          </span>
        );
      case "resuelto":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
            Resuelto
          </span>
        );
      case "cerrado":
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200">
            Cerrado
          </span>
        );
    }
  };

  // If a ticket is selected for detail view
  if (selectedTicketId) {
    return (
      <div className="bg-white rounded-2xl p-2 sm:p-4 border border-slate-200 shadow-xs animate-in fade-in">
        <TicketDetail id={selectedTicketId} onBack={() => setSelectedTicketId(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-4 select-none">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#004ac6] flex items-center justify-center shadow-xs">
            <TicketIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-slate-900">Tickets de Soporte</h3>
              <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-sky-50 text-sky-700 border border-sky-200">
                {openTickets.length} Abierto{openTickets.length === 1 ? "" : "s"}
              </span>
            </div>
            <span className="text-[11px] text-slate-500">
              Incidencias y solicitudes técnicas asignadas a este cliente
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter selector */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setFilterMode("abiertos")}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                filterMode === "abiertos"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Abiertos ({openTickets.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("todos")}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                filterMode === "todos"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Todos ({clientTickets.length})
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Ticket</span>
          </button>
        </div>
      </div>

      {/* Tickets Table */}
      {displayedTickets.length === 0 ? (
        <div className="py-12 text-center bg-white rounded-2xl border border-dashed border-slate-200">
          <TicketIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="font-bold text-slate-700 text-xs">
            {filterMode === "abiertos"
              ? "No hay tickets abiertos para este cliente"
              : "Sin incidencias registradas para este cliente"}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {filterMode === "abiertos"
              ? "Todas las incidencias técnicas y requerimientos han sido atendidos y resueltos."
              : "Puedes registrar un nuevo ticket de soporte en caso de requerimiento técnico."}
          </p>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Abrir Ticket</span>
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-700 uppercase tracking-wider text-[10px] font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">N° Ticket</th>
                  <th className="py-3 px-4">Asunto / Incidencia Técnica</th>
                  <th className="py-3 px-4 text-center">Prioridad / SLA</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4">Fecha Reporte</th>
                  <th className="py-3 px-4">Asignado a</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedTickets.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* N° Ticket */}
                    <td className="py-3.5 px-4 font-mono font-bold text-sky-700 whitespace-nowrap">
                      {t.ticketNumber}
                    </td>

                    {/* Asunto / Incidencia */}
                    <td className="py-3.5 px-4 min-w-[240px]">
                      <span className="font-bold text-slate-900 block">{t.title}</span>
                      <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-400 capitalize">
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
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-medium">{t.assignedToName || "NOC Central"}</span>
                      </div>
                    </td>

                    {/* Acciones */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
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
        </div>
      )}

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
