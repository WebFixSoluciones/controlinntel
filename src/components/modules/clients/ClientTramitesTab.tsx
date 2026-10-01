"use client";

import React, { useState, useMemo } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { Client, RegulatoryTramite } from "@/types";
import { TramiteModal } from "@/components/modules/tramites/TramiteModal";
import {
  FileText,
  Plus,
  Search,
  Filter,
  Calendar,
  Building2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Trash2,
  Edit2,
  History,
  X,
  CheckSquare,
  ShieldAlert,
  ChevronRight,
  FolderOpen,
} from "lucide-react";

interface ClientTramitesTabProps {
  client: Client;
}

export function ClientTramitesTab({ client }: ClientTramitesTabProps) {
  const { regulatoryTramites, deleteRegulatoryTramite, clientProjects } = useApp();
  const { showConfirm, showSuccess, showError } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tramiteToEdit, setTramiteToEdit] = useState<RegulatoryTramite | null>(null);
  const [selectedTramiteForHistory, setSelectedTramiteForHistory] = useState<RegulatoryTramite | null>(null);

  // Tramites pertenecientes a este cliente
  const clientTramites = useMemo(() => {
    return regulatoryTramites.filter(
      (t) =>
        t.clientId === client.id ||
        (t.clientName && t.clientName.toLowerCase() === client.businessName.toLowerCase())
    );
  }, [regulatoryTramites, client.id, client.businessName]);

  // Filtrado por búsqueda y estado
  const filteredTramites = useMemo(() => {
    return clientTramites.filter((t) => {
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch =
        term === "" ||
        t.documentNumber.toLowerCase().includes(term) ||
        t.code.toLowerCase().includes(term) ||
        t.reason.toLowerCase().includes(term) ||
        t.assignedTo.toLowerCase().includes(term) ||
        t.entity.toLowerCase().includes(term) ||
        (t.taskTitle && t.taskTitle.toLowerCase().includes(term)) ||
        (t.projectName && t.projectName.toLowerCase().includes(term));

      const matchesStatus = statusFilter === "all" || t.dynamicStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [clientTramites, searchTerm, statusFilter]);

  // Contadores / KPIs
  const stats = useMemo(() => {
    const total = clientTramites.length;
    const enRevision = clientTramites.filter(
      (t) => t.dynamicStatus === "en_revision" || t.dynamicStatus === "ingresado"
    ).length;
    const observados = clientTramites.filter((t) => t.dynamicStatus === "observado").length;
    const aprobados = clientTramites.filter(
      (t) => t.dynamicStatus === "aprobado" || t.dynamicStatus === "finalizado"
    ).length;
    return { total, enRevision, observados, aprobados };
  }, [clientTramites]);

  const handleDelete = (id: string, docNum: string) => {
    showConfirm(
      "¿Eliminar Trámite?",
      `¿Confirmas la eliminación del trámite ${docNum}? Esta acción retirará el registro del cliente.`,
      async () => {
        try {
          await deleteRegulatoryTramite(id);
          showSuccess("Trámite Eliminado", "El expediente fue retirado con éxito.");
        } catch {
          showError("Error", "No se pudo eliminar el trámite.");
        }
      },
      "Eliminar Trámite"
    );
  };

  const getStatusBadge = (status: RegulatoryTramite["dynamicStatus"]) => {
    switch (status) {
      case "ingresado":
        return {
          label: "1. INGRESADO",
          bg: "bg-blue-50 text-blue-700 border-blue-200",
        };
      case "en_revision":
        return {
          label: "2. EN REVISIÓN",
          bg: "bg-amber-50 text-amber-700 border-amber-200",
        };
      case "observado":
        return {
          label: "3. OBSERVADO",
          bg: "bg-rose-50 text-rose-700 border-rose-200",
        };
      case "subsanado":
        return {
          label: "4. SUBSANADO",
          bg: "bg-purple-50 text-purple-700 border-purple-200",
        };
      case "aprobado":
        return {
          label: "5. APROBADO",
          bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
        };
      case "finalizado":
        return {
          label: "6. FINALIZADO",
          bg: "bg-slate-100 text-slate-800 border-slate-300",
        };
      case "archivado":
        return {
          label: "7. ARCHIVADO",
          bg: "bg-slate-50 text-slate-500 border-slate-200",
        };
      default:
        return {
          label: status,
          bg: "bg-slate-100 text-slate-700 border-slate-200",
        };
    }
  };

  return (
    <div className="space-y-6 select-none animate-in fade-in duration-150">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-[#e2e8f0] shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-[#737686] uppercase tracking-wider block">
              Trámites del Cliente
            </span>
            <span className="text-2xl font-black text-[#0b1c30]">{stats.total}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#eff4ff] text-[#004ac6] flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#e2e8f0] shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-[#737686] uppercase tracking-wider block">
              En Trámite / Revisión
            </span>
            <span className="text-2xl font-black text-amber-600">{stats.enRevision}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#e2e8f0] shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-[#737686] uppercase tracking-wider block">
              Observados (Subsanar)
            </span>
            <span className="text-2xl font-black text-rose-600">{stats.observados}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#e2e8f0] shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-[#737686] uppercase tracking-wider block">
              Aprobados / Concluidos
            </span>
            <span className="text-2xl font-black text-emerald-600">{stats.aprobados}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Barra de Filtros y Acción de Nuevo Trámite */}
      <div className="bg-white p-4 rounded-2xl border border-[#e2e8f0] shadow-2xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-1 flex-col sm:flex-row items-center gap-3 w-full">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-[#737686] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por documento, Quipux, motivo, organismo o tarea vinculada..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#f8f9fc] border border-[#cbd5e1] rounded-xl pl-10 pr-4 py-2 text-xs font-medium text-[#0b1c30] placeholder-[#737686] focus:outline-none focus:border-[#004ac6] focus:bg-white transition-all"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-[#737686] shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#f8f9fc] border border-[#cbd5e1] rounded-xl px-3 py-2 text-xs font-semibold text-[#0b1c30] focus:outline-none focus:border-[#004ac6] transition-all cursor-pointer w-full sm:w-auto"
            >
              <option value="all">Todos los Estados</option>
              <option value="ingresado">1. Ingresado</option>
              <option value="en_revision">2. En Revisión</option>
              <option value="observado">3. Observado</option>
              <option value="subsanado">4. Subsanado</option>
              <option value="aprobado">5. Aprobado</option>
              <option value="finalizado">6. Finalizado</option>
              <option value="archivado">7. Archivado</option>
            </select>
          </div>
        </div>

        <button
          onClick={() => {
            setTramiteToEdit(null);
            setIsModalOpen(true);
          }}
          className="w-full md:w-auto px-4 py-2.5 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-xl text-xs font-bold shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Nuevo Trámite</span>
        </button>
      </div>

      {/* Tabla de Trámites */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#f8f9fc] border-b border-[#e2e8f0] text-[#737686] font-bold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4">Código / Documento</th>
                <th className="py-3 px-4">Motivo / Asunto</th>
                <th className="py-3 px-4">Organismo</th>
                <th className="py-3 px-4">Fecha Ingreso</th>
                <th className="py-3 px-4">Estado Dinámico</th>
                <th className="py-3 px-4">Prioridad</th>
                <th className="py-3 px-4">Tarea / Proyecto</th>
                <th className="py-3 px-4">Responsable</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {filteredTramites.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[#737686]">
                    <div className="max-w-xs mx-auto space-y-2">
                      <FolderOpen className="w-8 h-8 mx-auto text-[#cbd5e1]" />
                      <p className="font-bold text-[#0b1c30]">No hay trámites registrados para este cliente</p>
                      <p className="text-[11px]">
                        Puedes registrar un trámite regulatorio o institucional vinculándolo a una tarea de proyecto.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTramites.map((t) => {
                  const badge = getStatusBadge(t.dynamicStatus);
                  const hasTask = Boolean(t.taskId || t.taskTitle);

                  return (
                    <tr key={t.id} className="hover:bg-[#f8f9ff]/70 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-mono font-bold text-[#004ac6]">{t.documentNumber}</div>
                        <div className="text-[10px] text-[#737686]">{t.code}</div>
                      </td>

                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-semibold text-[#0b1c30] line-clamp-2" title={t.reason}>
                          {t.reason}
                        </div>
                        {t.notes && (
                          <div className="text-[10px] text-[#737686] truncate mt-0.5" title={t.notes}>
                            Nota: {t.notes}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-medium text-[#434655] inline-flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-[#737686]" />
                          <span className="truncate max-w-[140px]" title={t.entity}>
                            {t.entity.split("(")[0].trim()}
                          </span>
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-[#434655] font-medium">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-[#737686]" />
                          <span>{t.submissionDate}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider ${badge.bg}`}
                        >
                          {badge.label}
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            t.priority === "urgente"
                              ? "bg-rose-100 text-rose-800"
                              : t.priority === "alta"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {t.priority}
                        </span>
                      </td>

                      {/* Tarea / Proyecto Vinculado */}
                      <td className="py-3 px-4 max-w-[180px]">
                        {hasTask ? (
                          <div className="bg-[#eff4ff] border border-[#c3d3ff] rounded-lg p-1.5">
                            <div className="flex items-center gap-1 text-[11px] font-bold text-[#004ac6] truncate" title={t.taskTitle}>
                              <CheckSquare className="w-3 h-3 shrink-0" />
                              <span className="truncate">{t.taskTitle || "Tarea Asignada"}</span>
                            </div>
                            {t.projectName && (
                              <div className="text-[10px] text-[#737686] truncate pl-4" title={t.projectName}>
                                Proy: {t.projectName}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-[#737686] italic">General (Sin tarea)</span>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-[#434655] font-medium">
                        {t.assignedTo}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedTramiteForHistory(t)}
                            title="Ver Bitácora de Eventos"
                            className="p-1.5 text-[#004ac6] hover:bg-[#eff4ff] rounded-lg transition-colors cursor-pointer"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setTramiteToEdit(t);
                              setIsModalOpen(true);
                            }}
                            title="Editar Trámite"
                            className="p-1.5 text-[#434655] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(t.id, t.documentNumber)}
                            title="Eliminar Trámite"
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* Modal de Creación / Edición */}
      {isModalOpen && (
        <TramiteModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setTramiteToEdit(null);
          }}
          tramiteToEdit={tramiteToEdit}
          defaultClientId={client.id}
          defaultClientName={client.businessName}
        />
      )}

      {/* Modal / Bitácora de Historial */}
      {selectedTramiteForHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-lumina-dropdown border border-[#e2e8f0] overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8f9ff]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#eff4ff] text-[#004ac6] flex items-center justify-center">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-[#0b1c30] text-sm">
                    Bitácora: {selectedTramiteForHistory.documentNumber}
                  </h3>
                  <p className="text-[11px] text-[#737686]">
                    Historial de eventos y actualizaciones de estado
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTramiteForHistory(null)}
                className="p-1.5 rounded-lg text-[#737686] hover:text-[#0b1c30] hover:bg-[#eff4ff] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              <div className="bg-[#f8f9fc] p-3 rounded-xl border border-[#e2e8f0] space-y-1">
                <div className="font-bold text-[#0b1c30]">{selectedTramiteForHistory.reason}</div>
                <div className="text-[11px] text-[#737686]">
                  Entidad: <strong>{selectedTramiteForHistory.entity}</strong> | Responsable:{" "}
                  <strong>{selectedTramiteForHistory.assignedTo}</strong>
                </div>
                {selectedTramiteForHistory.taskTitle && (
                  <div className="text-[11px] text-[#004ac6] font-semibold flex items-center gap-1 pt-1">
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>Tarea vinculada: {selectedTramiteForHistory.taskTitle}</span>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h4 className="text-[11px] font-bold text-[#737686] uppercase tracking-wider">
                  Línea de Tiempo de Estados
                </h4>

                {(!selectedTramiteForHistory.history ||
                  selectedTramiteForHistory.history.length === 0) ? (
                  <p className="text-[#737686] italic text-center py-4">
                    Sin eventos registrados en la bitácora.
                  </p>
                ) : (
                  <div className="space-y-3 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-[#e2e8f0]">
                    {selectedTramiteForHistory.history.map((h, idx) => (
                      <div key={idx} className="relative flex items-start gap-3 pl-7">
                        <div className="absolute left-1.5 top-1 w-3.5 h-3.5 rounded-full bg-white border-2 border-[#004ac6]" />
                        <div className="bg-white border border-[#e2e8f0] rounded-xl p-3 shadow-2xs flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[#0b1c30] uppercase text-[10px] tracking-wider text-[#004ac6]">
                              {h.status.replace("_", " ")}
                            </span>
                            <span className="text-[10px] text-[#737686] font-mono">{h.date}</span>
                          </div>
                          <p className="text-slate-700 font-medium">{h.note}</p>
                          {h.author && (
                            <div className="text-[10px] text-[#737686]">
                              Registrado por: <strong>{h.author}</strong>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 border-t border-[#e2e8f0] flex justify-end bg-slate-50">
              <button
                onClick={() => setSelectedTramiteForHistory(null)}
                className="px-4 py-2 bg-white border border-[#cbd5e1] hover:bg-slate-100 rounded-xl text-xs font-bold text-[#434655] cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
