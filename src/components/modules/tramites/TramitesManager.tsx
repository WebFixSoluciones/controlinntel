"use client";

import React, { useState, useMemo } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { RegulatoryTramite } from "@/types";
import { TramiteModal } from "./TramiteModal";
import {
  FileText,
  Plus,
  Search,
  Filter,
  SlidersHorizontal,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Trash2,
  Edit2,
  History,
  Tag,
  ArrowRight,
  ShieldAlert,
  ChevronRight,
  Calendar,
} from "lucide-react";

export function TramitesManager() {
  const { regulatoryTramites, deleteRegulatoryTramite } = useApp();
  const { showConfirm, showSuccess, showError } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tramiteToEdit, setTramiteToEdit] = useState<RegulatoryTramite | null>(null);
  const [selectedTramiteForHistory, setSelectedTramiteForHistory] = useState<RegulatoryTramite | null>(null);

  // Entities list for filter
  const entities = useMemo(() => {
    const set = new Set<string>();
    regulatoryTramites.forEach((t) => set.add(t.entity));
    return Array.from(set);
  }, [regulatoryTramites]);

  // Filtered Tramites
  const filteredTramites = useMemo(() => {
    return regulatoryTramites.filter((t) => {
      const matchesSearch =
        searchTerm.trim() === "" ||
        t.documentNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.assignedTo.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === "all" || t.dynamicStatus === statusFilter;
      const matchesEntity = entityFilter === "all" || t.entity === entityFilter;

      return matchesSearch && matchesStatus && matchesEntity;
    });
  }, [regulatoryTramites, searchTerm, statusFilter, entityFilter]);

  const handleDelete = (id: string, docNum: string) => {
    showConfirm(
      "¿Eliminar Trámite?",
      `¿Confirmas la eliminación del trámite ${docNum}? Esta acción no se puede deshacer.`,
      async () => {
        try {
          await deleteRegulatoryTramite(id);
          showSuccess("Trámite Eliminado", "El expediente fue retirado del registro.");
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
          label: "INGRESADO",
          bg: "bg-blue-50 text-blue-700 border-blue-200",
        };
      case "en_revision":
        return {
          label: "EN REVISIÓN",
          bg: "bg-amber-50 text-amber-700 border-amber-200",
        };
      case "observado":
        return {
          label: "OBSERVADO",
          bg: "bg-rose-50 text-rose-700 border-rose-200",
        };
      case "subsanado":
        return {
          label: "SUBSANADO",
          bg: "bg-purple-50 text-purple-700 border-purple-200",
        };
      case "aprobado":
        return {
          label: "APROBADO",
          bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
        };
      case "finalizado":
        return {
          label: "FINALIZADO",
          bg: "bg-slate-100 text-slate-700 border-slate-300",
        };
      case "archivado":
        return {
          label: "ARCHIVADO",
          bg: "bg-gray-100 text-gray-500 border-gray-300",
        };
      default:
        return {
          label: (status as string).toUpperCase(),
          bg: "bg-slate-50 text-slate-700 border-slate-200",
        };
    }
  };

  const getPriorityBadge = (priority: RegulatoryTramite["priority"]) => {
    if (priority === "urgente") {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
          <AlertTriangle className="w-2.5 h-2.5" />
          <span>Urgente</span>
        </span>
      );
    }
    if (priority === "alta") {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
          Alta
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
        Normal
      </span>
    );
  };

  // Metrics
  const totalCount = regulatoryTramites.length;
  const inReviewCount = regulatoryTramites.filter(
    (t) => t.dynamicStatus === "en_revision" || t.dynamicStatus === "observado"
  ).length;
  const approvedCount = regulatoryTramites.filter(
    (t) => t.dynamicStatus === "aprobado" || t.dynamicStatus === "finalizado"
  ).length;

  return (
    <div className="space-y-6 select-none">
      {/* Top Header & Metrics */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#0b1c30] tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-[#004ac6]" />
            <span>Módulo de Seguimiento de Trámites</span>
          </h1>
          <p className="text-xs text-[#737686] mt-0.5">
            Control de oficios, providencias, solicitudes regulatorias y estados dinámicos
          </p>
        </div>

        <button
          onClick={() => {
            setTramiteToEdit(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Trámite</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-[#e2e8f0] shadow-lumina-card flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#737686] uppercase tracking-wider block">
              Total de Trámites
            </span>
            <span className="text-2xl font-bold text-[#0b1c30] mt-1 block">
              {totalCount}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#eff4ff] text-[#004ac6] flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-[#e2e8f0] shadow-lumina-card flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#737686] uppercase tracking-wider block">
              En Revisión / Observados
            </span>
            <span className="text-2xl font-bold text-amber-600 mt-1 block">
              {inReviewCount}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-[#e2e8f0] shadow-lumina-card flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#737686] uppercase tracking-wider block">
              Aprobados / Concluidos
            </span>
            <span className="text-2xl font-bold text-emerald-600 mt-1 block">
              {approvedCount}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="p-4 bg-white rounded-2xl border border-[#e2e8f0] shadow-lumina-card flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#737686] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por No. Documento, Asunto, Código o Responsable..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white text-xs text-[#0b1c30] rounded-xl pl-9 pr-3 py-2 border border-[#cbd5e1] focus:ring-1 focus:ring-[#004ac6]"
            />
          </div>

          <button
            onClick={() => {
              setSearchTerm("");
              setStatusFilter("all");
              setEntityFilter("all");
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#cbd5e1] text-xs font-semibold text-[#434655] hover:bg-[#f8f9ff] cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#737686]" />
            <span>Limpiar</span>
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white text-xs font-semibold text-[#434655] rounded-xl px-3 py-2 border border-[#cbd5e1] focus:ring-1 focus:ring-[#004ac6] cursor-pointer"
          >
            <option value="all">Todos los Estados</option>
            <option value="ingresado">Ingresado</option>
            <option value="en_revision">En Revisión</option>
            <option value="observado">Observado</option>
            <option value="subsanado">Subsanado</option>
            <option value="aprobado">Aprobado</option>
            <option value="finalizado">Finalizado</option>
            <option value="archivado">Archivado</option>
          </select>

          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="bg-white text-xs font-semibold text-[#434655] rounded-xl px-3 py-2 border border-[#cbd5e1] focus:ring-1 focus:ring-[#004ac6] cursor-pointer max-w-[200px] truncate"
          >
            <option value="all">Todas las Entidades</option>
            {entities.map((ent) => (
              <option key={ent} value={ent}>
                {ent}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-lumina-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[850px]">
            <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-[10px] uppercase tracking-wider border-b border-[#e2e8f0]">
              <tr>
                <th className="py-3 px-5">Código / Trámite</th>
                <th className="py-3 px-5">Documento (Oficio/Quipux)</th>
                <th className="py-3 px-5">Motivo o Asunto</th>
                <th className="py-3 px-4">Fecha</th>
                <th className="py-3 px-4">Responsable</th>
                <th className="py-3 px-3 text-center">Prioridad</th>
                <th className="py-3 px-4 text-center">Estado Dinámico</th>
                <th className="py-3 px-5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9] text-[#0b1c30]">
              {filteredTramites.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 italic">
                    No se encontraron trámites con los criterios seleccionados.
                  </td>
                </tr>
              ) : (
                filteredTramites.map((t) => {
                  const badge = getStatusBadge(t.dynamicStatus);

                  return (
                    <tr key={t.id} className="hover:bg-[#f8f9ff] transition-colors">
                      <td className="py-3.5 px-5">
                        <span className="font-mono font-bold text-[#004ac6] block">
                          {t.code}
                        </span>
                        <span className="text-[10px] text-slate-400 truncate max-w-[140px] block">
                          {t.entity}
                        </span>
                      </td>

                      <td className="py-3.5 px-5">
                        <div className="font-bold text-[#0b1c30]">{t.documentNumber}</div>
                      </td>

                      <td className="py-3.5 px-5 max-w-[280px]">
                        <p className="font-medium text-[#434655] line-clamp-2">
                          {t.reason}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-600 font-medium">
                        {t.submissionDate}
                      </td>

                      <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap font-medium">
                        {t.assignedTo}
                      </td>

                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        {getPriorityBadge(t.priority)}
                      </td>

                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold border ${badge.bg}`}
                        >
                          {badge.label}
                        </span>
                      </td>

                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => setSelectedTramiteForHistory(t)}
                            className="p-1.5 text-slate-500 hover:text-[#004ac6] hover:bg-[#eff4ff] rounded-lg transition-colors cursor-pointer"
                            title="Ver bitácora de seguimiento"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setTramiteToEdit(t);
                              setIsModalOpen(true);
                            }}
                            className="p-1.5 text-slate-500 hover:text-[#004ac6] hover:bg-[#eff4ff] rounded-lg transition-colors cursor-pointer"
                            title="Editar trámite"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(t.id, t.documentNumber)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar trámite"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* Modal Bitácora de Seguimiento */}
      {selectedTramiteForHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-lumina-dropdown border border-[#e2e8f0] overflow-hidden">
            <div className="p-4 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8f9ff]">
              <div>
                <h3 className="font-bold text-[#0b1c30] text-sm flex items-center gap-2">
                  <History className="w-4 h-4 text-[#004ac6]" />
                  <span>Bitácora: {selectedTramiteForHistory.code}</span>
                </h3>
                <p className="text-[11px] text-[#737686]">
                  {selectedTramiteForHistory.documentNumber}
                </p>
              </div>
              <button
                onClick={() => setSelectedTramiteForHistory(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 max-h-[60vh] overflow-y-auto space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="font-bold text-[#004ac6] block">Asunto:</span>
                <p className="text-slate-700 mt-0.5">{selectedTramiteForHistory.reason}</p>
              </div>

              <div className="space-y-2 pt-2">
                <h4 className="font-bold text-[#434655] text-xs uppercase tracking-wider">
                  Historial de Cambios de Estado
                </h4>

                {(!selectedTramiteForHistory.history || selectedTramiteForHistory.history.length === 0) ? (
                  <p className="text-slate-400 italic">No hay registros en la bitácora aún.</p>
                ) : (
                  selectedTramiteForHistory.history.map((h, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl border border-slate-200 bg-white space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#004ac6] uppercase text-[10px]">
                          {h.status.replace("_", " ")}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {h.date}
                        </span>
                      </div>
                      <p className="text-slate-700 text-xs font-medium">{h.note}</p>
                      <span className="text-[10px] text-slate-500 block">
                        Por: {h.author}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="p-3 border-t border-slate-100 bg-slate-50 text-right">
              <button
                onClick={() => setSelectedTramiteForHistory(null)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Crear / Editar Trámite */}
      <TramiteModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setTramiteToEdit(null);
        }}
        tramiteToEdit={tramiteToEdit}
      />
    </div>
  );
}
