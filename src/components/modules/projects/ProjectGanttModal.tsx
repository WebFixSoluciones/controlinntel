"use client";

import React, { useMemo } from "react";
import { Project, ClientProjectTask } from "@/types";
import {
  X,
  Calendar,
  Clock,
  User,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Radio,
  Layers,
  TrendingUp,
} from "lucide-react";

interface ProjectGanttModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
  tasks: ClientProjectTask[];
}

export function ProjectGanttModal({
  isOpen,
  onClose,
  project,
  tasks,
}: ProjectGanttModalProps) {
  if (!isOpen || !project) return null;

  // Filter tasks for this project
  const projectTasks = useMemo(() => {
    return tasks.filter((t) => t.projectId === project.id || (t.clientId === project.clientId && !t.projectId));
  }, [tasks, project.id, project.clientId]);

  // Calculate timeline range
  const { minDate, maxDate, totalDays } = useMemo(() => {
    const dates: number[] = [
      new Date(project.startDate).getTime() || Date.now(),
      new Date(project.endDate).getTime() || Date.now() + 86400000 * 30,
    ];

    projectTasks.forEach((t) => {
      if (t.startDate) dates.push(new Date(t.startDate).getTime());
      if (t.dueDate) dates.push(new Date(t.dueDate).getTime());
    });

    const min = Math.min(...dates);
    const max = Math.max(...dates);
    const days = Math.max(1, Math.round((max - min) / (1000 * 60 * 60 * 24)));
    return { minDate: min, maxDate: max, totalDays: days };
  }, [project, projectTasks]);

  // Position calculation helper (0% to 100%)
  const getBarPosition = (startStr?: string, dueStr?: string) => {
    const start = startStr ? new Date(startStr).getTime() : minDate;
    const due = dueStr ? new Date(dueStr).getTime() : maxDate;

    const clampedStart = Math.max(minDate, Math.min(maxDate, start));
    const clampedDue = Math.max(clampedStart, Math.min(maxDate, due));

    const leftPercent = ((clampedStart - minDate) / (maxDate - minDate || 1)) * 100;
    const widthPercent = Math.max(3, ((clampedDue - clampedStart) / (maxDate - minDate || 1)) * 100);

    return {
      left: `${Math.max(0, Math.min(97, leftPercent))}%`,
      width: `${Math.max(3, Math.min(100 - leftPercent, widthPercent))}%`,
    };
  };

  const completedCount = projectTasks.filter((t) => t.column === "terminado" || t.column === "completado" || t.column === "finalizado").length;
  const progressPercent = projectTasks.length > 0 ? Math.round((completedCount / projectTasks.length) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in select-none">
      <div className="bg-white rounded-3xl max-w-5xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-slate-50 via-white to-sky-50/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#004ac6]/10 text-[#004ac6] flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-blue-100 text-[#004ac6] border border-blue-200">
                  Diagrama Cronograma / Gantt
                </span>
                <span className="text-xs font-bold text-slate-500">
                  {project.type === "cliente" ? project.clientName : project.nodeName}
                </span>
              </div>
              <h3 className="font-extrabold text-sm text-slate-900 mt-0.5">{project.title}</h3>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right text-xs">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Avance de Tareas</span>
              <strong className="text-[#004ac6] font-mono text-sm">{completedCount}/{projectTasks.length} ({progressPercent}%)</strong>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Global Project Timeline Summary */}
        <div className="p-4 bg-slate-50 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <Clock className="w-4 h-4 text-[#004ac6]" />
            <span>Ventana Global del Proyecto:</span>
            <strong className="font-mono text-slate-900">{project.startDate}</strong>
            <span className="text-slate-400">→</span>
            <strong className="font-mono text-slate-900">{project.endDate}</strong>
            <span className="text-slate-500 font-bold">({totalDays} días de duración)</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500">Presupuesto:</span>
            <span className="font-mono font-bold text-slate-800">${project.estimatedBudget.toFixed(2)}</span>
            <span className="text-slate-300">|</span>
            <span className="text-[11px] font-bold text-slate-500">Costo Ejecutado:</span>
            <span className="font-mono font-bold text-sky-700">${project.executedCost.toFixed(2)}</span>
          </div>
        </div>

        {/* Gantt Chart Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* Global Project Bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#004ac6]" />
                Cronograma Global del Proyecto
              </span>
              <span className="font-mono text-[11px] text-slate-500">
                {new Date(minDate).toLocaleDateString("es-EC")} - {new Date(maxDate).toLocaleDateString("es-EC")}
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-xl h-6 relative overflow-hidden border border-slate-200/80 p-0.5">
              <div
                className="h-full bg-gradient-to-r from-[#004ac6] to-sky-500 rounded-lg text-white text-[10px] font-extrabold flex items-center px-3 shadow-xs truncate"
                style={{
                  ...getBarPosition(project.startDate, project.endDate),
                  minWidth: "120px",
                }}
              >
                Duración del Proyecto ({totalDays}d)
              </div>
            </div>
          </div>

          {/* Tasks Timeline Header */}
          <div className="pt-3 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-800 mb-2">Desglose de Tareas & Hitos Técnicos:</h4>

            {projectTasks.length === 0 ? (
              <div className="py-12 text-center bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
                <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-600">No hay tareas creadas en este proyecto.</p>
                <p className="text-[11px] text-slate-400">Ingresa al Canvas del proyecto para asignar tareas y plazos.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {projectTasks.map((t) => {
                  const isDone = t.column === "terminado" || t.column === "completado" || t.column === "finalizado";
                  const barStyle = isDone
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
                    : t.priority === "urgente"
                    ? "bg-gradient-to-r from-rose-500 to-rose-600 text-white"
                    : t.priority === "alta"
                    ? "bg-gradient-to-r from-amber-500 to-amber-600 text-white"
                    : "bg-gradient-to-r from-[#004ac6] to-blue-500 text-white";

                  const pos = getBarPosition(t.startDate, t.dueDate);

                  return (
                    <div key={t.id} className="p-3 bg-white rounded-xl border border-slate-200/90 shadow-2xs space-y-2 hover:border-slate-300 transition-all">
                      <div className="flex flex-wrap items-center justify-between text-xs gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isDone ? "bg-emerald-500" : "bg-sky-500"
                            }`}
                          />
                          <strong className="text-slate-900">{t.title}</strong>
                          <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-slate-100 text-slate-600 border border-slate-200 uppercase">
                            {t.column.replace("_", " ")}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3 text-slate-400" />
                            {t.assignedTo || "Sin asignar"}
                          </span>
                          <span>
                            {t.startDate || "Inicio"} → <strong className="text-slate-800">{t.dueDate}</strong>
                          </span>
                        </div>
                      </div>

                      {/* Bar inside timeline track */}
                      <div className="w-full bg-slate-100 rounded-lg h-5 relative overflow-hidden border border-slate-200/60 p-0.5">
                        <div
                          className={`h-full rounded-md text-[9px] font-bold flex items-center px-2 shadow-2xs truncate ${barStyle}`}
                          style={{
                            left: pos.left,
                            width: pos.width,
                            position: "absolute",
                            minWidth: "60px",
                          }}
                        >
                          <span className="truncate">{t.startDate ? `${t.startDate} - ${t.dueDate}` : t.dueDate}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-end bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors"
          >
            Cerrar Diagrama
          </button>
        </div>
      </div>
    </div>
  );
}
