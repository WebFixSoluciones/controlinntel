"use client";

import React from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import {
  X,
  Trash2,
  RotateCcw,
  AlertTriangle,
  Building2,
  Radio,
  Calendar,
  Layers,
} from "lucide-react";

interface ProjectTrashModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProjectTrashModal({ isOpen, onClose }: ProjectTrashModalProps) {
  const { projects, restoreProject, permanentDeleteProject } = useApp();
  const { showSuccess, showConfirm, showError } = useToast();

  if (!isOpen) return null;

  const deletedProjects = projects.filter((p) => p.isDeleted);

  const handleRestore = async (id: string, title: string) => {
    try {
      await restoreProject(id);
      showSuccess("Proyecto Restaurado", `El proyecto "${title}" ha sido recuperado.`);
    } catch {
      showError("Error", "No se pudo restaurar el proyecto.");
    }
  };

  const handlePermanentDelete = (id: string, title: string) => {
    showConfirm(
      "¿Eliminar Definitivamente?",
      `Esta acción es irreversible. Se eliminará el proyecto "${title}" y todas sus tareas asociadas. ¿Deseas continuar?`,
      async () => {
        try {
          await permanentDeleteProject(id);
          showSuccess("Proyecto Eliminado", `El proyecto "${title}" ha sido eliminado permanentemente.`);
        } catch {
          showError("Error", "No se pudo eliminar el proyecto.");
        }
      },
      "Eliminar para Siempre"
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in select-none">
      <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-rose-50 via-white to-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">Papelera de Proyectos</h3>
              <p className="text-[11px] text-slate-500">
                Proyectos descartados que puedes restaurar o eliminar definitivamente
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List of Deleted Projects */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3">
          {deletedProjects.length === 0 ? (
            <div className="py-12 text-center bg-slate-50/60 rounded-2xl border border-dashed border-slate-200 p-6 space-y-2">
              <Trash2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <h5 className="font-bold text-xs text-slate-700">La papelera está vacía</h5>
              <p className="text-[11px] text-slate-400">
                No hay proyectos eliminados en este momento.
              </p>
            </div>
          ) : (
            deletedProjects.map((p) => (
              <div
                key={p.id}
                className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:border-slate-300 flex flex-wrap items-center justify-between gap-3 transition-all"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <strong className="text-xs text-slate-900">{p.title}</strong>
                    <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-slate-100 text-slate-600 border border-slate-200 uppercase">
                      {p.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      {p.type === "cliente" ? <Building2 className="w-3 h-3 text-slate-400" /> : <Radio className="w-3 h-3 text-slate-400" />}
                      {p.type === "cliente" ? p.clientName : p.nodeName}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {p.startDate} → {p.endDate}
                    </span>
                    {p.deletedAt && (
                      <>
                        <span>•</span>
                        <span className="text-rose-600 font-mono">
                          Eliminado: {new Date(p.deletedAt).toLocaleDateString("es-EC")}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRestore(p.id, p.title)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#004ac6] rounded-xl text-xs font-bold transition-all cursor-pointer border border-blue-200"
                    title="Restaurar Proyecto"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restaurar</span>
                  </button>

                  <button
                    onClick={() => handlePermanentDelete(p.id, p.title)}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-semibold transition-all cursor-pointer border border-rose-200"
                    title="Eliminar Definitivamente"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Purgar</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50 text-xs text-slate-500">
          <span>{deletedProjects.length} proyectos en papelera</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
