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
  ISP_FLOW_COLUMNS,
  GENERAL_FLOW_COLUMNS,
} from "@/components/modules/projects/ProjectTaskModal";
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

  const [activeFlow, setActiveFlow] = useState<ProjectBoardFlow>("isp_tecnico");
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

  // Tasks filtered by flow
  const currentFlowTasks = useMemo(() => {
    return clientTasks.filter((t) => {
      const flow = t.boardFlow || "isp_tecnico";
      return flow === activeFlow;
    });
  }, [clientTasks, activeFlow]);

  // Active columns based on current flow
  const currentColumns = activeFlow === "isp_tecnico" ? ISP_FLOW_COLUMNS : GENERAL_FLOW_COLUMNS;

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
    setModalDefaultCol(colId || (activeFlow === "isp_tecnico" ? "factibilidad" : "por_iniciar"));
    setIsModalOpen(true);
  };

  const handleOpenEdit = (task: ClientProjectTask) => {
    setTaskToEdit(task);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-4 select-none">
      {/* 1. Header & Summary KPIs */}
      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#004ac6]/10 text-[#004ac6] flex items-center justify-center">
              <Kanban className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-xs">
                Seguimiento de Obras & Despliegue de Enlace
              </h4>
              <p className="text-[11px] text-slate-500">
                Tablero Kanban individual sincronizado con el Módulo General de Proyectos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Flow Switcher */}
            <div className="flex items-center p-0.5 bg-slate-200/70 rounded-lg text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveFlow("isp_tecnico")}
                className={`px-2.5 py-1 rounded-md text-[11px] transition-all cursor-pointer ${
                  activeFlow === "isp_tecnico"
                    ? "bg-white text-[#004ac6] shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Flujo ISP
              </button>
              <button
                type="button"
                onClick={() => setActiveFlow("general")}
                className={`px-2.5 py-1 rounded-md text-[11px] transition-all cursor-pointer ${
                  activeFlow === "general"
                    ? "bg-white text-[#004ac6] shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Flujo General
              </button>
            </div>

            <button
              onClick={() => handleOpenCreate()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#004ac6] hover:bg-[#003ca0] text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nueva Fase / Tarea</span>
            </button>
          </div>
        </div>

        {/* Financial Mini-KPIs for this client */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-200/60">
          <div className="bg-white p-2.5 rounded-xl border border-slate-200/70 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400">Presupuesto Obra</span>
              <p className="text-xs font-extrabold text-slate-900">${clientTotalBudget.toFixed(2)}</p>
            </div>
            <DollarSign className="w-4 h-4 text-blue-500" />
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-slate-200/70 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400">Costo Ejecutado</span>
              <p className="text-xs font-extrabold text-slate-900">${clientExecutedCost.toFixed(2)}</p>
            </div>
            <TrendingUp className="w-4 h-4 text-sky-500" />
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-slate-200/70 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400">Balance Restante</span>
              <p className={`text-xs font-extrabold ${isOverBudget ? "text-rose-600" : "text-emerald-700"}`}>
                ${clientRemainingBalance.toFixed(2)}
              </p>
            </div>
            {isOverBudget ? (
              <TrendingDown className="w-4 h-4 text-rose-500" />
            ) : (
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            )}
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-slate-200/70 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400">Fases Entregadas</span>
              <p className="text-xs font-extrabold text-slate-900">{completedTasksCount} / {totalTasksCount}</p>
            </div>
            <CheckCircle2 className="w-4 h-4 text-purple-500" />
          </div>
        </div>
      </div>

      {/* 2. Kanban Board Columns Grid */}
      <div className={`grid grid-cols-1 ${activeFlow === "isp_tecnico" ? "md:grid-cols-3 lg:grid-cols-6" : "md:grid-cols-2 lg:grid-cols-4"} gap-3 overflow-x-auto pb-2 min-h-[420px]`}>
        {currentColumns.map((col) => {
          const colTasks = currentFlowTasks.filter((t) => t.column === col.id);
          const isDragTarget = dragOverColumn === col.id;

          return (
            <div
              key={col.id}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.id)}
              className={`rounded-2xl border flex flex-col p-2.5 transition-all ${
                isDragTarget
                  ? "bg-blue-50/80 border-[#004ac6] ring-2 ring-[#004ac6]/30 shadow-md"
                  : "bg-slate-50/80 border-slate-200/90 hover:border-slate-300"
              }`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 mb-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                  <span className="font-bold text-slate-800 text-[11px] truncate" title={col.label}>
                    {col.shortLabel}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold bg-white text-slate-600 px-1.5 py-0.2 rounded-full border border-slate-200">
                    {colTasks.length}
                  </span>
                  <button
                    onClick={() => handleOpenCreate(col.id)}
                    className="p-0.5 text-slate-400 hover:text-[#004ac6] rounded transition-colors cursor-pointer"
                    title={`Añadir tarea a ${col.shortLabel}`}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Tasks List */}
              <div className="space-y-2 flex-1 overflow-y-auto">
                {colTasks.length === 0 ? (
                  <div className="h-24 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-xl text-[10px] text-slate-400 italic">
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
                        className="p-3 bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all cursor-grab active:cursor-grabbing space-y-2 group"
                      >
                        {/* Priority & Actions */}
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded ${
                              task.priority === "urgente"
                                ? "bg-rose-100 text-rose-800 border border-rose-200"
                                : task.priority === "alta"
                                ? "bg-amber-100 text-amber-800 border border-amber-200"
                                : "bg-sky-100 text-sky-800 border border-sky-200"
                            }`}
                          >
                            {task.priority}
                          </span>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleOpenEdit(task)}
                              className="text-slate-400 hover:text-[#004ac6] p-0.5 rounded cursor-pointer"
                              title="Editar Ficha"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteTask(task)}
                              className="text-slate-400 hover:text-rose-600 p-0.5 rounded cursor-pointer"
                              title="Eliminar tarea"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Title & Desc */}
                        <div>
                          <h5
                            onClick={() => handleOpenEdit(task)}
                            className="font-bold text-xs text-slate-900 leading-snug hover:text-[#004ac6] cursor-pointer transition-colors"
                          >
                            {task.title}
                          </h5>
                          {task.description && (
                            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                              {task.description}
                            </p>
                          )}
                        </div>

                        {/* Checklist Progress */}
                        {totalChecklist > 0 && (
                          <div className="space-y-1 pt-1 border-t border-slate-100 text-[10px]">
                            <div className="flex items-center justify-between text-slate-500 font-bold">
                              <span className="flex items-center gap-1">
                                <CheckSquare className="w-3 h-3 text-slate-400" />
                                Subtareas
                              </span>
                              <span>
                                {completedChecklist}/{totalChecklist} ({checklistPercent}%)
                              </span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
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
                          <div className="flex items-center justify-between p-1 rounded-md bg-slate-50 border border-slate-200/70 text-[10px]">
                            <span className="text-slate-500 font-semibold flex items-center gap-0.5">
                              <DollarSign className="w-3 h-3 text-slate-400" />
                              Costo / Presup.
                            </span>
                            <span className={`font-bold ${isTaskOverBudget ? "text-rose-600" : "text-slate-800"}`}>
                              ${task.executedCost || 0} / ${task.estimatedBudget || 0}
                            </span>
                          </div>
                        )}

                        {/* Metadata Footer */}
                        <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                          <span className="flex items-center gap-1 truncate max-w-[55%]">
                            <User className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{task.assignedTo || "Cuadrilla NOC"}</span>
                          </span>

                          <div className="flex items-center gap-1.5">
                            {notesCount > 0 && (
                              <span className="flex items-center gap-0.5 text-slate-500 font-bold" title={`${notesCount} notas`}>
                                <MessageSquare className="w-3 h-3 text-slate-400" />
                                {notesCount}
                              </span>
                            )}
                            <span className={`flex items-center gap-0.5 ${isTaskOverdue ? "text-rose-600 font-bold" : "text-slate-500"}`}>
                              <Clock className="w-3 h-3 shrink-0" />
                              <span>{task.dueDate.split("-").slice(1).join("/")}</span>
                            </span>
                          </div>
                        </div>

                        {/* Shift Controls */}
                        <div className="pt-1 flex items-center justify-between border-t border-slate-100/60 opacity-60 hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => handleShiftColumn(task, "prev")}
                            disabled={currentColumns.findIndex((c) => c.id === task.column) === 0}
                            className="p-1 rounded bg-slate-50 hover:bg-slate-100 text-slate-500 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
                            title="Mover a etapa anterior"
                          >
                            <ChevronLeft className="w-3 h-3" />
                          </button>

                          <span className="text-[9px] text-slate-400">Mover</span>

                          <button
                            type="button"
                            onClick={() => handleShiftColumn(task, "next")}
                            disabled={currentColumns.findIndex((c) => c.id === task.column) === currentColumns.length - 1}
                            className="p-1 rounded bg-slate-50 hover:bg-slate-100 text-slate-500 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
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
        defaultFlow={activeFlow}
        defaultColumn={modalDefaultCol}
        defaultClientId={client.id}
        defaultClientName={client.businessName}
      />
    </div>
  );
}
