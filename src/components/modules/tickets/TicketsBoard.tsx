"use client";

import React, { useState, useMemo } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { Ticket, TicketStatus, TicketDepartment } from "@/types";
import {
  Plus,
  Search,
  Eye,
  MessageSquare,
  Lock,
  Headphones,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { TicketDetail } from "./TicketDetail";

interface TicketsBoardProps {
  onOpenNewModal: () => void;
}

export function TicketsBoard({ onOpenNewModal }: TicketsBoardProps) {
  const { tickets, updateTicketStatus } = useApp();
  const { showSuccess, showInfo } = useToast();

  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  // Filters
  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [filterDepartment, setFilterDepartment] = useState<string>("todos");
  const [filterPriority, setFilterPriority] = useState<string>("todas");
  const [filterAssignee, setFilterAssignee] = useState<string>("todos");

  // Status counts for WHMCS-style tabs
  const statusCounts = useMemo(() => {
    return {
      todos: tickets.length,
      abiertos: tickets.filter((t) => t.status === "abierto").length,
      en_progreso: tickets.filter((t) => t.status === "en_progreso").length,
      respondido: tickets.filter((t) => t.status === "respondido").length,
      en_espera: tickets.filter((t) => t.status === "en_espera").length,
      resueltos: tickets.filter((t) => t.status === "resuelto" || t.status === "cerrado").length,
    };
  }, [tickets]);

  // Distinct assignees
  const distinctAssignees = useMemo(() => {
    const set = new Set<string>();
    tickets.forEach((t) => {
      if (t.assignedToName) set.add(t.assignedToName);
    });
    return Array.from(set);
  }, [tickets]);

  // Filtered tickets
  const filtered = useMemo(() => {
    return tickets
      .filter((t) => {
        // Status filter
        if (filterStatus === "abiertos" && t.status !== "abierto") return false;
        if (filterStatus === "en_progreso" && t.status !== "en_progreso") return false;
        if (filterStatus === "respondido" && t.status !== "respondido") return false;
        if (filterStatus === "en_espera" && t.status !== "en_espera") return false;
        if (filterStatus === "resueltos" && t.status !== "resuelto" && t.status !== "cerrado") return false;
        if (filterStatus !== "todos" && !["abiertos", "en_progreso", "respondido", "en_espera", "resueltos"].includes(filterStatus)) {
          if (t.status !== filterStatus) return false;
        }

        // Department filter
        if (filterDepartment !== "todos") {
          const dept = t.department || "soporte_tecnico";
          if (dept !== filterDepartment) return false;
        }

        // Priority filter
        if (filterPriority !== "todas" && t.priority !== filterPriority) return false;

        // Assignee filter
        if (filterAssignee !== "todos" && t.assignedToName !== filterAssignee) return false;

        // Search text
        if (query.trim()) {
          const q = query.toLowerCase();
          const matches =
            t.ticketNumber.toLowerCase().includes(q) ||
            t.clientName.toLowerCase().includes(q) ||
            t.title.toLowerCase().includes(q) ||
            (t.description && t.description.toLowerCase().includes(q)) ||
            (t.nodeName && t.nodeName.toLowerCase().includes(q));
          if (!matches) return false;
        }

        return true;
      })
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [tickets, query, filterStatus, filterDepartment, filterPriority, filterAssignee]);

  const handleStatusChange = async (t: Ticket, newStatus: TicketStatus) => {
    try {
      await updateTicketStatus(t.id, newStatus);
      if (newStatus === "resuelto") {
        showSuccess("Ticket Resuelto", `Incidencia ${t.ticketNumber} marcada como resuelta.`);
      } else {
        showInfo("Estado Actualizado", `Ticket ${t.ticketNumber} cambiado a '${newStatus.toUpperCase()}'.`);
      }
    } catch (error: any) {
      showSuccess("Error", error?.message || "No se pudo actualizar.");
    }
  };

  // If a ticket is selected, show the WHMCS-style assistance screen
  if (selectedTicketId) {
    return <TicketDetail key={selectedTicketId} id={selectedTicketId} onBack={() => setSelectedTicketId(null)} />;
  }

  return (
    <div className="w-full space-y-6 select-none animate-in fade-in duration-200">
      {/* 1. WHMCS Filter and Action Bar */}
      <div className="bg-white rounded-2xl p-4 border border-[#e2e8f0] shadow-2xs space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Status Tabs (WHMCS Style) */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#f8f9ff] rounded-xl border border-[#e2e8f0]">
            <button
              onClick={() => setFilterStatus("todos")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterStatus === "todos"
                  ? "bg-white text-[#004ac6] shadow-xs"
                  : "text-[#434655] hover:text-[#0b1c30]"
              }`}
            >
              Todos ({statusCounts.todos})
            </button>
            <button
              onClick={() => setFilterStatus("abiertos")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterStatus === "abiertos"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "text-[#434655] hover:text-rose-700"
              }`}
            >
              Abiertos ({statusCounts.abiertos})
            </button>
            <button
              onClick={() => setFilterStatus("en_progreso")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterStatus === "en_progreso"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-[#434655] hover:text-blue-700"
              }`}
            >
              En Progreso ({statusCounts.en_progreso})
            </button>
            <button
              onClick={() => setFilterStatus("respondido")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterStatus === "respondido"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "text-[#434655] hover:text-purple-700"
              }`}
            >
              Respondidos ({statusCounts.respondido})
            </button>
            <button
              onClick={() => setFilterStatus("en_espera")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterStatus === "en_espera"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "text-[#434655] hover:text-amber-700"
              }`}
            >
              En Espera ({statusCounts.en_espera})
            </button>
            <button
              onClick={() => setFilterStatus("resueltos")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterStatus === "resueltos"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-[#434655] hover:text-emerald-700"
              }`}
            >
              Resueltos ({statusCounts.resueltos})
            </button>
          </div>

          <button
            onClick={onOpenNewModal}
            className="flex items-center gap-2 px-4 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Abrir Ticket</span>
          </button>
        </div>

        {/* Filter Inputs Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-[#737686] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por ticket #, cliente o falla..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-[#e2e8f0] bg-[#f8f9ff] text-[#0b1c30] placeholder-[#737686] focus:bg-white focus:outline-hidden focus:border-[#004ac6] transition-all"
            />
          </div>

          {/* Department Filter */}
          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            className="w-full text-xs px-3 py-2 rounded-xl border border-[#e2e8f0] bg-[#f8f9ff] text-[#434655] focus:bg-white focus:outline-hidden focus:border-[#004ac6] transition-all font-medium"
          >
            <option value="todos">Todos los Departamentos</option>
            <option value="soporte_tecnico">Soporte Técnico NOC</option>
            <option value="facturacion">Facturación & Cobranzas</option>
            <option value="noc_redes">NOC / Planta Externa</option>
            <option value="ventas">Ventas & Comercial</option>
          </select>

          {/* Priority Filter */}
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="w-full text-xs px-3 py-2 rounded-xl border border-[#e2e8f0] bg-[#f8f9ff] text-[#434655] focus:bg-white focus:outline-hidden focus:border-[#004ac6] transition-all font-medium"
          >
            <option value="todas">Todas las Prioridades SLA</option>
            <option value="critica">Crítica (SLA Inmediato)</option>
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </select>

          {/* Assignee Filter */}
          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="w-full text-xs px-3 py-2 rounded-xl border border-[#e2e8f0] bg-[#f8f9ff] text-[#434655] focus:bg-white focus:outline-hidden focus:border-[#004ac6] transition-all font-medium"
          >
            <option value="todos">Todos los Asignados</option>
            {distinctAssignees.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. Tickets Table */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#f8f9ff] text-[#434655] border-b border-[#e2e8f0]">
              <tr>
                <th className="py-3 px-4 font-bold">N° Ticket</th>
                <th className="py-3 px-4 font-bold">Incidencia / Asunto</th>
                <th className="py-3 px-4 font-bold">Cliente</th>
                <th className="py-3 px-4 font-bold">Departamento</th>
                <th className="py-3 px-4 font-bold">Asignado a</th>
                <th className="py-3 px-4 font-bold text-center">Prioridad SLA</th>
                <th className="py-3 px-4 font-bold text-center">Estado</th>
                <th className="py-3 px-4 font-bold text-right">Fecha de Solicitud</th>
                <th className="py-3 px-4 font-bold text-center">Asistencia</th>
                <th className="py-3 px-4 font-bold text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0] text-[#0b1c30]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-xs text-[#737686]">
                    <Headphones className="w-10 h-10 mx-auto mb-2 text-[#cbd5e1]" />
                    <p className="font-semibold text-[#434655]">No se encontraron tickets de soporte</p>
                    <p className="text-[11px] text-[#737686] mt-0.5">
                      Ajusta los filtros de búsqueda o haz clic en "Abrir Ticket" para registrar una nueva solicitud.
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((t) => {
                  const msgCount = (t.messages || []).length;
                  const internalCount = (t.messages || []).filter((m) => m.isInternal).length;

                  return (
                    <tr key={t.id} className="hover:bg-[#f8f9ff] transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#004ac6] whitespace-nowrap">
                        <button
                          onClick={() => setSelectedTicketId(t.id)}
                          className="hover:underline cursor-pointer"
                        >
                          {t.ticketNumber}
                        </button>
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <button
                          onClick={() => setSelectedTicketId(t.id)}
                          className="font-bold text-[#0b1c30] text-left hover:text-[#004ac6] line-clamp-1 cursor-pointer block"
                        >
                          {t.title}
                        </button>
                        <div className="text-[11px] text-[#737686] line-clamp-1">{t.description}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[#0b1c30] line-clamp-1">{t.clientName}</div>
                        {t.nodeName && <div className="text-[10px] text-[#737686] line-clamp-1">{t.nodeName}</div>}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-[#f1f5f9] text-[#434655] text-[10px] font-semibold">
                          {t.department === "facturacion"
                            ? "Facturación"
                            : t.department === "noc_redes"
                            ? "NOC / Redes"
                            : t.department === "ventas"
                            ? "Ventas"
                            : "Soporte Técnico"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#434655] font-medium whitespace-nowrap">
                        {t.assignedToName || "NOC Central"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            t.priority === "critica"
                              ? "bg-rose-100 text-rose-800 border border-rose-200"
                              : t.priority === "alta"
                              ? "bg-amber-100 text-amber-800 border border-amber-200"
                              : "bg-[#eff4ff] text-[#004ac6] border border-[#bfdbfe]"
                          }`}
                        >
                          {t.priority}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <select
                          value={t.status}
                          onChange={(e) => void handleStatusChange(t, e.target.value as TicketStatus)}
                          aria-label={`Estado del ticket ${t.ticketNumber}`}
                          className={`rounded-lg border px-2.5 py-1 text-xs font-bold cursor-pointer transition-colors ${
                            t.status === "abierto"
                              ? "bg-rose-50 border-rose-200 text-rose-700"
                              : t.status === "en_progreso"
                              ? "bg-blue-50 border-blue-200 text-blue-700"
                              : t.status === "respondido"
                              ? "bg-purple-50 border-purple-200 text-purple-700"
                              : t.status === "en_espera"
                              ? "bg-amber-50 border-amber-200 text-amber-700"
                              : "bg-emerald-50 border-emerald-200 text-emerald-700"
                          }`}
                        >
                          <option value="abierto">Abierto</option>
                          <option value="en_progreso">En Progreso</option>
                          <option value="respondido">Respondido</option>
                          <option value="en_espera">En Espera</option>
                          <option value="resuelto">Resuelto</option>
                          <option value="cerrado">Cerrado</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[11px] text-[#737686] whitespace-nowrap">
                        {new Date(t.createdAt).toLocaleDateString("es-EC")}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5 text-xs text-[#737686]">
                          <span
                            className="flex items-center gap-0.5 text-[11px] font-bold text-[#434655]"
                            title="Total de respuestas en el ticket"
                          >
                            <MessageSquare className="w-3 h-3 text-[#737686]" />
                            {msgCount}
                          </span>
                          {internalCount > 0 && (
                            <span
                              className="flex items-center gap-0.5 text-[10px] font-bold text-amber-700 bg-amber-100 px-1 rounded-md"
                              title="Notas internas privadas"
                            >
                              <Lock className="w-2.5 h-2.5" />
                              {internalCount}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => setSelectedTicketId(t.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-[#004ac6] bg-[#eff4ff] hover:bg-[#dce9ff] transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Ver Asistencia</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
