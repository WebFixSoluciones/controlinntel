"use client";

import { createSearchMatcher } from "@/lib/search";

import React, { useState, useMemo } from "react";
import { canManageTicketDepartments, canRoleAction } from "@/lib/permissions";
import { departmentLabel, DEFAULT_TICKET_DEPARTMENT } from "@/lib/ticket-departments";
import { TicketDepartmentsModal } from "./TicketDepartmentsModal";
import { api } from "@/lib/api-client";
import { isClosedTicketStatus } from "@/lib/ticket-status";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { ActionIconButton } from "@/components/ui/ActionIconButton";
import { TableColumns } from "@/components/ui/TableColumns";
import { Ticket, TicketPriority, TicketStatus } from "@/types";
import {
  Plus,
  Search,
  MessageSquare,
  Lock,
  Headphones,
  ListChecks,
  Building2,
} from "lucide-react";
import { TicketDetail } from "./TicketDetail";
import { TicketSubjectsModal } from "./TicketSubjectsModal";
import { Badge } from "@/components/ui/Badge";
import { badgeTone } from "@/lib/badge-tone";

interface TicketsBoardProps {
  onOpenNewModal: () => void;
}

const statusFilters = [
  { value: "todos", label: "Todos" },
  { value: "abiertos", label: "Abiertos" },
  { value: "en_progreso", label: "En progreso" },
  { value: "respondido", label: "Respondidos" },
  { value: "en_espera", label: "En espera" },
  { value: "resueltos", label: "Resueltos" },
];

const priorityLabels: Record<TicketPriority, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

export function TicketsBoard({ onOpenNewModal }: TicketsBoardProps) {
  const { tickets, updateTicketStatus, ticketDepartments, currentUser, refresh } = useApp();
  const { showSuccess, showInfo, showError, showConfirm } = useToast();

  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [numbering, setNumbering] = useState(false);
  const [departmentsOpen, setDepartmentsOpen] = useState(false);
  const [isSubjectsOpen, setIsSubjectsOpen] = useState(false);

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
    const matches = createSearchMatcher(query);
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
          const dept = t.department || DEFAULT_TICKET_DEPARTMENT;
          if (dept !== filterDepartment) return false;
        }

        // Priority filter
        if (filterPriority !== "todas" && t.priority !== filterPriority) return false;

        // Assignee filter
        if (filterAssignee !== "todos" && t.assignedToName !== filterAssignee) return false;

        return matches(t.ticketNumber, t.previousTicketNumber, t.clientName, t.title, t.description, t.nodeName);
      })
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [tickets, query, filterStatus, filterDepartment, filterPriority, filterAssignee]);

  const numberPreviousTickets = () => {
    showConfirm("Numerar tickets anteriores", "Se asignarán números TK consecutivos y podrás seguir buscando por el número anterior.",
      async () => {
        setNumbering(true);
        try {
          let updated = 0;
          let remaining = 0;
          do {
            const result = await api<{ updated: number; remaining: number }>("/api/tickets/numeracion", {});
            updated += result.updated;
            remaining = result.remaining;
          } while (remaining > 0);
          await refresh();
          showSuccess("Numeración actualizada", `${updated} tickets anteriores numerados.`);
        } catch (error) {
          showError("Numeración de tickets", error instanceof Error ? error.message : "No se pudo completar la numeración.");
        } finally {
          setNumbering(false);
        }
      }, "Numerar tickets");
  };

  const handleStatusChange = async (t: Ticket, newStatus: TicketStatus) => {
    try {
      await updateTicketStatus(t.id, newStatus);
      showInfo("Estado actualizado", `Ticket ${t.ticketNumber} cambiado a '${newStatus.toUpperCase()}'.`);
    } catch (error) {
      showError("Error", error instanceof Error ? error.message : "No se pudo actualizar.");
    }
  };

  // If a ticket is selected, show the WHMCS-style assistance screen
  if (selectedTicketId) {
    return <TicketDetail key={selectedTicketId} id={selectedTicketId} onBack={() => setSelectedTicketId(null)} />;
  }

  return (
    <div className="min-w-0 space-y-3">
      <div className="ui-toolbar flex flex-col items-stretch">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-0.5 rounded-lg border border-slate-200 bg-[#f8f9ff] p-0.5" role="group" aria-label="Filtrar tickets por estado">
            {statusFilters.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilterStatus(value)}
                aria-pressed={filterStatus === value}
                className="soft-nav-item px-2 py-1 text-[11px] font-semibold"
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {currentUser.role === "superadmin" && tickets.some(ticket => !/^TK-\d{3,}$/.test(ticket.ticketNumber)) &&
              <button type="button" disabled={numbering} onClick={numberPreviousTickets}
                className="min-h-7 whitespace-nowrap border border-slate-200 bg-white px-2 text-[11px] font-semibold text-[#004ac6] hover:bg-blue-50 disabled:opacity-40">
                {numbering ? "Numerando…" : "Numerar anteriores"}
              </button>}
            {canManageTicketDepartments(currentUser) && <button type="button" onClick={() => setDepartmentsOpen(true)}
              className="inline-flex min-h-7 items-center gap-1.5 whitespace-nowrap border border-slate-200 bg-white px-2 text-[11px] font-semibold text-[#004ac6] hover:bg-blue-50">
              <Building2 className="size-3.5" aria-hidden="true" /> Departamentos
            </button>}
            <button
              type="button"
              onClick={() => setIsSubjectsOpen(true)}
              disabled={!canRoleAction(currentUser,"tickets","canManageSubjects")}
              className="inline-flex min-h-7 items-center gap-1.5 whitespace-nowrap border border-slate-200 bg-white px-2 text-[11px] font-semibold text-[#004ac6] hover:bg-blue-50 disabled:opacity-40"
              title="Configurar los asuntos disponibles al crear tickets"
            >
              <ListChecks className="size-3.5" aria-hidden="true" />
              <span>Asuntos</span>
            </button>
            <button
              type="button"
              onClick={onOpenNewModal}
              disabled={!canRoleAction(currentUser,"tickets","canCreateTicket")}
              className="inline-flex min-h-7 items-center gap-1.5 whitespace-nowrap bg-[#004ac6] px-2 text-[11px] font-semibold text-white hover:bg-[#003da6] disabled:opacity-40"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              <span>Abrir ticket</span>
            </button>
          </div>
        </div>
        {departmentsOpen && <TicketDepartmentsModal onClose={() => setDepartmentsOpen(false)} />}
        <TicketSubjectsModal isOpen={isSubjectsOpen} onClose={() => setIsSubjectsOpen(false)} />

        {/* Filter Inputs Bar */}
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
          {/* Search Box */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <input
              type="text"
              aria-label="Buscar tickets"
              placeholder="Buscar por ticket #, cliente o falla..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="ui-cell-control w-full !pl-7"
            />
          </div>

          {/* Department Filter */}
          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            aria-label="Filtrar tickets por departamento"
            className="ui-cell-control w-full"
          >
            <option value="todos">Todos los departamentos</option>
            {ticketDepartments.map(row => <option key={row.id} value={row.id}>{row.name}{row.active ? "" : " (inactivo)"}</option>)}
          </select>

          {/* Priority Filter */}
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            aria-label="Filtrar tickets por prioridad SLA"
            className="ui-cell-control w-full"
          >
            <option value="todas">Todas las prioridades SLA</option>
            <option value="critica">{priorityLabels.critica} (SLA inmediato)</option>
            <option value="alta">{priorityLabels.alta}</option>
            <option value="media">{priorityLabels.media}</option>
            <option value="baja">{priorityLabels.baja}</option>
          </select>

          {/* Assignee Filter */}
          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            aria-label="Filtrar tickets por asignado"
            className="ui-cell-control w-full"
          >
            <option value="todos">Todos los asignados</option>
            {distinctAssignees.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. Tickets Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="ui-table-scroll" role="region" aria-label="Lista de tickets" tabIndex={0}>
          <table className="table-fixed w-full border-collapse text-left min-w-[56rem]">
            <TableColumns weights={{ number: 10, issue: 21, client: 17, department: 12, assignee: 12, priority: 8, status: 12, date: 9, visits: 8 }} actionIcons={1} />
            <thead className="bg-[#f8f9ff] text-[#004ac6] border-b border-[#e2e8f0]">
              <tr>
                <th scope="col">N.º de ticket</th>
                <th scope="col">Incidencia / asunto</th>
                <th scope="col">Cliente</th>
                <th scope="col">Departamento</th>
                <th scope="col">Asignado a</th>
                <th scope="col" className="text-center">Prioridad SLA</th>
                <th scope="col">Estado</th>
                <th scope="col" className="text-right">Fecha</th>
                <th scope="col" className="text-center">Asistencia</th>
                <th scope="col" className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="!py-8 text-center">
                    <Headphones className="mx-auto mb-1 size-5 text-slate-400" aria-hidden="true" />
                    <p>No se encontraron tickets de soporte</p>
                    <p className="ui-cell-meta mt-1">
                      Ajusta los filtros de búsqueda o haz clic en «Abrir ticket» para registrar una nueva solicitud.
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((t) => {
                  const msgCount = (t.messages || []).length;
                  const internalCount = (t.messages || []).filter((m) => m.isInternal).length;
                  const department = departmentLabel(ticketDepartments, t.department);
                  const assignee = t.assignedToName || "NOC central";

                  return (
                    <tr key={t.id} className="hover:bg-[#f8f9ff]">
                      <td className="tabular-nums">
                        <button
                          type="button"
                          onClick={() => setSelectedTicketId(t.id)}
                          className="text-left hover:underline [overflow-wrap:anywhere]"
                        >
                          {t.ticketNumber}
                        </button>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => setSelectedTicketId(t.id)}
                          title={t.title}
                          className="block max-w-full truncate text-left hover:underline"
                        >
                          {t.title}
                        </button>
                        <div className="ui-cell-meta truncate" title={t.description}>{t.description}</div>
                      </td>
                      <td>
                        <div className="ui-emphasis truncate" title={t.clientName}>{t.clientName}</div>
                        {t.nodeName && <div className="ui-cell-meta truncate" title={t.nodeName}>{t.nodeName}</div>}
                      </td>
                      <td>
                        <span className="block truncate" title={department}>{department}</span>
                      </td>
                      <td>
                        <span className="block truncate" title={assignee}>{assignee}</span>
                      </td>
                      <td className="text-center">
                        <Badge>{priorityLabels[t.priority] || t.priority}</Badge>
                      </td>
                      <td>
                        <select
                          value={t.status}
                          data-badge-tone={badgeTone(t.status)}
                          onChange={(e) => void handleStatusChange(t, e.target.value as TicketStatus)}
                          aria-label={`Estado del ticket ${t.ticketNumber}`}
                          className="ui-cell-control w-full"
                        >
                          <option value="abierto">Abierto</option>
                          <option value="en_progreso">En progreso</option>
                          <option value="respondido">Respondido</option>
                          <option value="en_espera">En espera</option>
                          {isClosedTicketStatus(t.status) && <option value={t.status} disabled>{t.status === "resuelto" ? "Resuelto" : "Cerrado"}</option>}
                        </select>
                      </td>
                      <td className="whitespace-nowrap text-right tabular-nums">
                        {new Date(t.createdAt).toLocaleDateString("es-EC")}
                      </td>
                      <td className="text-center">
                        <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 tabular-nums">
                          <span
                            className="inline-flex items-center gap-0.5"
                            title="Total de respuestas en el ticket"
                          >
                            <MessageSquare className="size-3" aria-hidden="true" />
                            <span className="sr-only">Respuestas</span>
                            {msgCount}
                          </span>
                          {internalCount > 0 && (
                            <span
                              className="ui-cell-meta inline-flex items-center gap-0.5"
                              title="Notas internas privadas"
                            >
                              <Lock className="size-2.5" aria-hidden="true" />
                              <span className="sr-only">Notas internas</span>
                              {internalCount}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="text-right">
                        <div className="ui-table-actions">
                          <ActionIconButton
                            action="view"
                            onClick={() => setSelectedTicketId(t.id)}
                            title="Ver asistencia"
                            label={`Ver asistencia del ticket ${t.ticketNumber}`}
                          />
                        </div>
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
