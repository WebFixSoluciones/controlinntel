"use client";

import React, { useState, useMemo } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import {
  Client,
  ClientProjectTask,
  ProjectBoardFlow,
  ProjectKanbanColumn,
} from "@/types";
import {
  ProjectTaskModal,
  GENERAL_FLOW_COLUMNS,
} from "@/components/modules/projects/ProjectTaskModal";

const normalizeColumn = (col?: string): ProjectKanbanColumn => {
  if (!col) return "por_iniciar";
  if (col === "completado" || col === "finalizado" || col === "terminado") return "finalizado";
  if (col === "factibilidad") return "por_iniciar";
  if (col === "tendido_fibra" || col === "fusion_splitters" || col === "instalacion_ont" || col === "en_progreso" || col === "en_proceso") return "en_progreso";
  if (col === "pruebas_homologacion" || col === "revision" || col === "en_pausa") return "en_pausa";
  return (col as ProjectKanbanColumn);
};
import {
  Kanban,
  Plus,
  Clock,
  User,
  CheckSquare,
  MessageSquare,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Trash2,
  Edit2,
  ChevronLeft,
  ChevronRight,
  Layers,
  CheckCircle2,
} from "lucide-react";

interface ClientProjectKanbanProps {
  client: Client;
}

export function ClientProjectKanban({ client }: ClientProjectKanbanProps) {
  const {
    clientProjects,
    moveProjectTaskColumn,
    deleteClientProjectTask,
  } = useApp();
  const { showSuccess, showConfirm } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<ClientProjectTask | null>(null);
  const [modalDefaultCol, setModalDefaultCol] = useState<ProjectKanbanColumn | undefined>(undefined);

  // Drag and drop state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ProjectKanbanColumn | null>(null);

  // Filter tasks belonging to this client
  const clientTasks = useMemo(() => {
    return clientProjects.filter((t) => t.clientId === client.id);
  }, [clientProjects, client.id]);

  const currentFlowTasks = clientTasks;

  // Active columns (Flujo General estándar)
  const currentColumns = GENERAL_FLOW_COLUMNS;

  // Financial calculations for this client
  const clientTotalBudget = useMemo(() => {
    return clientTasks.reduce((acc, t) => acc + (t.estimatedBudget || 0), 0);
  }, [clientTasks]);

  const clientExecutedCost = useMemo(() => {
    return clientTasks.reduce((acc, t) => acc + (t.executedCost || 0), 0);
  }, [clientTasks]);

  const clientRemainingBalance = clientTotalBudget - clientExecutedCost;
  const isOverBudget = clientRemainingBalance < 0;

  const totalTasksCount = clientTasks.length;
  const completedTasksCount = clientTasks.filter(
    (t) => t.column === "completado" || t.column === "finalizado"
  ).length;

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedTaskId(id);
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, colId: ProjectKanbanColumn) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverColumn !== colId) {
      setDragOverColumn(colId);
    }
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, targetCol: ProjectKanbanColumn) => {
    e.preventDefault();
    setDragOverColumn(null);
    const id = e.dataTransfer.getData("text/plain") || draggedTaskId;
    if (id) {
      try {
        await moveProjectTaskColumn(id, targetCol);
        showSuccess("Fase Actualizada", "Proyecto reubicado exitosamente.");
      } catch (err) {
        // Error handling
      }
      setDraggedTaskId(null);
    }
  };

  // Shift column handlers
  const handleShiftColumn = async (task: ClientProjectTask, direction: "prev" | "next") => {
    const currentIndex = currentColumns.findIndex((c) => c.id === task.column);
    if (direction === "next" && currentIndex < currentColumns.length - 1) {
      await moveProjectTaskColumn(task.id, currentColumns[currentIndex + 1].id);
    } else if (direction === "prev" && currentIndex > 0) {
      await moveProjectTaskColumn(task.id, currentColumns[currentIndex - 1].id);
    }
  };

  // Delete task handler
  const handleDeleteTask = (task: ClientProjectTask) => {
    showConfirm(
      "¿Eliminar Tarea del Tablero?",
      `¿Deseas remover la tarjeta "${task.title}" del seguimiento de obra del cliente?`,
      async () => {
        try {
          await deleteClientProjectTask(task.id);
          showSuccess("Tarea Eliminada", "La tarjeta ha sido removida del tablero.");
        } catch (err) {
          // Error handling
        }
      },
      "Eliminar"
    );
  };

  // Open modal handlers
  const handleOpenCreate = (colId?: ProjectKanbanColumn) => {
    setTaskToEdit(null);
    setModalDefaultCol(colId || "por_iniciar");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (task: ClientProjectTask) => {
    setTaskToEdit(task);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* 1. Header & Summary KPIs */}
      <div className="p-4 bg-white rounded-xl border border-[#e2e8f0] shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#eff4ff] text-[#004ac6] border border-[#dce9ff] flex items-center justify-center">
              <Kanban className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-[#0b1c30] text-xs">
                Seguimiento de Obras & Despliegue de Enlace
              </h4>
              <p className="text-xs text-[#64748b]">
                Tablero Kanban individual sincronizado con el Módulo General de Proyectos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleOpenCreate()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#004ac6] hover:bg-[#003ca0] text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nueva Tarea</span>
            </button>
          </div>
        </div>

        {/* Financial Mini-KPIs for this client */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[#f1f5f9]">
          <div className="bg-[#f8f9ff] p-3 rounded-lg border border-[#e2e8f0] flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">Presupuesto Obra</span>
              <p className="text-sm font-bold text-[#0b1c30]">${clientTotalBudget.toFixed(2)}</p>
            </div>
            <DollarSign className="w-4 h-4 text-[#004ac6]" />
          </div>

          <div className="bg-[#f8f9ff] p-3 rounded-lg border border-[#e2e8f0] flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">Costo Ejecutado</span>
              <p className="text-sm font-bold text-[#0b1c30]">${clientExecutedCost.toFixed(2)}</p>
            </div>
            <TrendingUp className="w-4 h-4 text-sky-500" />
          </div>

          <div className="bg-[#f8f9ff] p-3 rounded-lg border border-[#e2e8f0] flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">Balance Restante</span>
              <p className={`text-sm font-bold ${isOverBudget ? "text-rose-600" : "text-emerald-700"}`}>
                ${clientRemainingBalance.toFixed(2)}
              </p>
            </div>
            {isOverBudget ? (
              <TrendingDown className="w-4 h-4 text-rose-500" />
            ) : (
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            )}
          </div>

          <div className="bg-[#f8f9ff] p-3 rounded-lg border border-[#e2e8f0] flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">Fases Entregadas</span>
              <p className="text-sm font-bold text-[#0b1c30]">{completedTasksCount} / {totalTasksCount}</p>
            </div>
            <CheckCircle2 className="w-4 h-4 text-purple-500" />
          </div>
        </div>
      </div>

      {/* 2. Kanban Board Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5 overflow-x-auto pb-2 min-h-[420px]">
        {currentColumns.map((col) => {
          const colTasks = currentFlowTasks.filter((t) => normalizeColumn(t.column) === col.id);
          const isDragTarget = dragOverColumn === col.id;

          return (
            <div
              key={col.id}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.id)}
              className={`rounded-xl border flex flex-col p-3 transition-all ${
                isDragTarget
                  ? "bg-blue-50/80 border-[#004ac6] ring-2 ring-[#004ac6]/30 shadow-xs"
                  : "bg-[#f8f9fa] border-[#e2e8f0] hover:border-slate-300"
              }`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-2.5 border-b border-[#e2e8f0] mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                  <span className="font-bold text-[#0b1c30] text-xs uppercase tracking-wider truncate" title={col.label}>
                    {col.shortLabel}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold bg-[#e2e8f0] text-[#475569] px-2 py-0.5 rounded-md">
                    {colTasks.length}
                  </span>
                  <button
                    onClick={() => handleOpenCreate(col.id)}
                    className="p-1 text-[#64748b] hover:text-[#004ac6] hover:bg-[#eff4ff] rounded-md transition-colors cursor-pointer"
                    title={`Añadir tarea a ${col.shortLabel}`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Tasks List */}
              <div className="space-y-2.5 flex-1 overflow-y-auto">
                {colTasks.length === 0 ? (
                  <div className="h-24 flex items-center justify-center border border-dashed border-[#cbd5e1] rounded-lg text-xs text-[#94a3b8] bg-white/60 font-medium">
                    Soltar aquí
                  </div>
                ) : (
                  colTasks.map((task) => {
                    const completedChecklist = task.checklist ? task.checklist.filter((c) => c.done).length : 0;
                    const totalChecklist = task.checklist ? task.checklist.length : 0;
                    const checklistPercent = totalChecklist > 0 ? Math.round((completedChecklist / totalChecklist) * 100) : 0;
                    const isTaskOverdue = new Date(task.dueDate).getTime() < Date.now() && task.column !== "completado" && task.column !== "finalizado";
                    const isTaskOverBudget = (task.executedCost || 0) > (task.estimatedBudget || 0) && (task.estimatedBudget || 0) > 0;
                    const notesCount = task.notesThread ? task.notesThread.length : 0;

                    return (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        className="p-3.5 bg-white rounded-lg border border-[#e2e8f0] shadow-2xs hover:shadow-xs hover:border-[#cbd5e1] transition-all cursor-grab active:cursor-grabbing space-y-2.5 group"
                      >
                        {/* Top: Date Left & Priority Right */}
                        <div className="flex items-center justify-between">
                          <span className={`flex items-center gap-1 text-xs font-semibold ${isTaskOverdue ? "text-rose-600" : "text-[#878a99]"}`}>
                            <Clock className="w-3.5 h-3.5 shrink-0" />
                            <span>{task.dueDate.split("-").slice(1).join("/")}</span>
                          </span>

                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${
                                task.priority === "urgente"
                                  ? "bg-rose-50 text-rose-700 border-rose-200"
                                  : task.priority === "alta"
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : task.priority === "baja"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-[#eff4ff] text-[#004ac6] border-[#dce9ff]"
                              }`}
                            >
                              {task.priority}
                            </span>

                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleOpenEdit(task)}
                                className="text-[#64748b] hover:text-[#004ac6] p-1 rounded hover:bg-[#eff4ff] cursor-pointer"
                                title="Editar Ficha"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteTask(task)}
                                className="text-[#64748b] hover:text-rose-600 p-1 rounded hover:bg-rose-50 cursor-pointer"
                                title="Eliminar tarea"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Title & Desc */}
                        <div>
                          <h5
                            onClick={() => handleOpenEdit(task)}
                            className="font-bold text-xs sm:text-sm text-[#0b1c30] leading-snug hover:text-[#004ac6] cursor-pointer transition-colors"
                          >
                            {task.title}
                          </h5>
                          {task.description && (
                            <p className="text-xs text-[#64748b] mt-1 line-clamp-2 leading-relaxed">
                              {task.description}
                            </p>
                          )}
                        </div>

                        {/* Checklist Progress */}
                        {totalChecklist > 0 && (
                          <div className="space-y-1.5 pt-1.5 border-t border-[#f1f5f9] text-xs">
                            <div className="flex items-center justify-between text-[#64748b] font-medium text-[11px]">
                              <span className="flex items-center gap-1">
                                <CheckSquare className="w-3 h-3 text-[#94a3b8]" />
                                Subtareas
                              </span>
                              <span className="font-semibold">
                                {completedChecklist}/{totalChecklist} ({checklistPercent}%)
                              </span>
                            </div>
                            <div className="w-full bg-[#f1f5f9] rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-1.5 rounded-full transition-all duration-300 ${
                                  checklistPercent === 100 ? "bg-emerald-500" : "bg-[#004ac6]"
                                }`}
                                style={{ width: `${checklistPercent}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Financial Pill */}
                        {(task.estimatedBudget !== undefined || task.executedCost !== undefined) && (
                          <div className="flex items-center justify-between p-1.5 rounded-md bg-[#f8f9ff] border border-[#e2e8f0] text-xs">
                            <span className="text-[#64748b] font-semibold text-[11px] flex items-center gap-0.5">
                              <DollarSign className="w-3 h-3 text-[#94a3b8]" />
                              Costo / Presup.
                            </span>
                            <span className={`font-mono font-bold text-xs ${isTaskOverBudget ? "text-rose-600" : "text-[#0b1c30]"}`}>
                              ${task.executedCost || 0} / ${task.estimatedBudget || 0}
                            </span>
                          </div>
                        )}

                        {/* Metadata Footer: Assignee & Notes */}
                        <div className="pt-2 border-t border-[#f1f5f9] flex items-center justify-between text-xs text-[#64748b]">
                          <span className="flex items-center gap-1.5 truncate max-w-[60%]">
                            <div className="w-5 h-5 rounded-full bg-[#eff4ff] text-[#004ac6] border border-[#dce9ff] font-bold text-[10px] flex items-center justify-center shrink-0">
                              {(task.assignedTo || "N").charAt(0).toUpperCase()}
                            </div>
                            <span className="truncate font-semibold text-[#475569]">{task.assignedTo || "Cuadrilla NOC"}</span>
                          </span>

                          <div className="flex items-center gap-2">
                            {notesCount > 0 && (
                              <span className="flex items-center gap-1 text-[#64748b] font-semibold text-xs" title={`${notesCount} notas`}>
                                <MessageSquare className="w-3 h-3 text-[#94a3b8]" />
                                {notesCount}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Shift Controls */}
                        <div className="pt-1.5 flex items-center justify-between border-t border-[#f1f5f9] opacity-70 hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => handleShiftColumn(task, "prev")}
                            disabled={currentColumns.findIndex((c) => c.id === task.column) === 0}
                            className="p-1 rounded-md bg-[#f8f9ff] hover:bg-slate-100 border border-[#e2e8f0] text-[#64748b] disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
                            title="Mover a etapa anterior"
                          >
                            <ChevronLeft className="w-3 h-3" />
                          </button>

                          <span className="text-[10px] font-semibold text-[#94a3b8] uppercase tracking-wider">Mover</span>

                          <button
                            type="button"
                            onClick={() => handleShiftColumn(task, "next")}
                            disabled={currentColumns.findIndex((c) => c.id === task.column) === currentColumns.length - 1}
                            className="p-1 rounded-md bg-[#f8f9ff] hover:bg-slate-100 border border-[#e2e8f0] text-[#64748b] disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
                            title="Avanzar a siguiente etapa"
                          >
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Project Task Modal for Create and Edit */}
      <ProjectTaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        taskToEdit={taskToEdit}
        defaultFlow="general"
        defaultColumn={modalDefaultCol}
        defaultClientId={client.id}
        defaultClientName={client.businessName}
      />
    </div>
  );
}
