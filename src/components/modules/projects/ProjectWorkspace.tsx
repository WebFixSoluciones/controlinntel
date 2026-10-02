"use client";

import React, { useState, useMemo } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import {
  Project,
  ProjectCustomColumn,
  ClientProjectTask,
  ProjectStatus,
} from "@/types";
import { ProjectTaskModal } from "./ProjectTaskModal";
import { ProjectGanttModal } from "./ProjectGanttModal";
import {
  ArrowLeft,
  Kanban,
  ListTodo,
  Calendar,
  TrendingUp,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  Radio,
  User,
  DollarSign,
  CheckSquare,
  MessageSquare,
  Edit2,
  Trash2,
  X,
  ChevronDown,
  Layers,
  Settings2,
  Briefcase,
  ExternalLink,
  FileText,
} from "lucide-react";

export const COLUMN_COLORS: Record<
  string,
  { bg: string; border: string; text: string; badge: string; dot: string; lightBg: string }
> = {
  slate: {
    bg: "bg-slate-100/90",
    border: "border-slate-300",
    text: "text-slate-800",
    badge: "bg-slate-100 text-slate-700 border-slate-300",
    dot: "bg-slate-500",
    lightBg: "bg-slate-50/70",
  },
  blue: {
    bg: "bg-blue-50/90",
    border: "border-blue-300",
    text: "text-blue-800",
    badge: "bg-blue-100 text-blue-800 border-blue-300",
    dot: "bg-blue-600",
    lightBg: "bg-blue-50/30",
  },
  amber: {
    bg: "bg-amber-50/90",
    border: "border-amber-300",
    text: "text-amber-800",
    badge: "bg-amber-100 text-amber-800 border-amber-300",
    dot: "bg-amber-600",
    lightBg: "bg-amber-50/30",
  },
  emerald: {
    bg: "bg-emerald-50/90",
    border: "border-emerald-300",
    text: "text-emerald-800",
    badge: "bg-emerald-100 text-emerald-800 border-emerald-300",
    dot: "bg-emerald-600",
    lightBg: "bg-emerald-50/30",
  },
  purple: {
    bg: "bg-purple-50/90",
    border: "border-purple-300",
    text: "text-purple-800",
    badge: "bg-purple-100 text-purple-800 border-purple-300",
    dot: "bg-purple-600",
    lightBg: "bg-purple-50/30",
  },
  rose: {
    bg: "bg-rose-50/90",
    border: "border-rose-300",
    text: "text-rose-800",
    badge: "bg-rose-100 text-rose-800 border-rose-300",
    dot: "bg-rose-600",
    lightBg: "bg-rose-50/30",
  },
  indigo: {
    bg: "bg-indigo-50/90",
    border: "border-indigo-300",
    text: "text-indigo-800",
    badge: "bg-indigo-100 text-indigo-800 border-indigo-300",
    dot: "bg-indigo-600",
    lightBg: "bg-indigo-50/30",
  },
};

const getColStyle = (color?: string) => {
  return COLUMN_COLORS[color || "slate"] || COLUMN_COLORS.slate;
};

interface ProjectWorkspaceProps {
  project: Project;
  onBack: () => void;
  onEditProject: (project: Project) => void;
}

export function ProjectWorkspace({
  project,
  onBack,
  onEditProject,
}: ProjectWorkspaceProps) {
  const {
    clientProjects,
    regulatoryTramites,
    updateProject,
    updateProjectColumns,
    moveProjectTaskColumn,
    deleteClientProjectTask,
  } = useApp();
  const { showSuccess, showConfirm, showError } = useToast();

  // Internal view tabs: kanban, list, gantt
  const [activeTab, setActiveTab] = useState<"kanban" | "list" | "gantt">("kanban");
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("todas");

  // Drag and drop state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);

  // Task Modal state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<ClientProjectTask | null>(null);
  const [defaultColumnForNewTask, setDefaultColumnForNewTask] = useState<string | undefined>(undefined);

  // Gantt Modal state (full view)
  const [isGanttModalOpen, setIsGanttModalOpen] = useState(false);

  // Column creation modal / state
  const [isAddColumnModalOpen, setIsAddColumnModalOpen] = useState(false);
  const [newColumnLabel, setNewColumnLabel] = useState("");
  const [newColumnColor, setNewColumnColor] = useState<ProjectCustomColumn["color"]>("blue");

  // Filter tasks belonging strictly to this project
  const projectTasks = useMemo(() => {
    return clientProjects.filter(
      (t) => t.projectId === project.id || (!t.projectId && t.clientId === project.clientId)
    );
  }, [clientProjects, project.id, project.clientId]);

  // Tasks filtered by search & priority
  const filteredTasks = useMemo(() => {
    return projectTasks.filter((t) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchDesc = (t.description || "").toLowerCase().includes(q);
        const matchAssignee = (t.assignedTo || "").toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchAssignee) return false;
      }
      if (priorityFilter !== "todas" && t.priority !== priorityFilter) {
        return false;
      }
      return true;
    });
  }, [projectTasks, searchQuery, priorityFilter]);

  // Project progress statistics
  const progressStats = useMemo(() => {
    const total = projectTasks.length;
    if (total === 0) return { total: 0, completed: 0, percent: 0, pending: 0 };
    const lastColId = project.columns[project.columns.length - 1]?.id;
    const completed = projectTasks.filter(
      (t) =>
        t.column === lastColId ||
        t.column === "terminado" ||
        t.column === "completado" ||
        t.column === "finalizado"
    ).length;
    const percent = Math.round((completed / total) * 100);
    return { total, completed, percent, pending: total - completed };
  }, [projectTasks, project.columns]);

  // Financial summary
  const financialStats = useMemo(() => {
    const budget = project.estimatedBudget || 0;
    const executed = projectTasks.reduce((acc, t) => acc + (t.executedCost || 0), project.executedCost || 0);
    const balance = budget - executed;
    const percent = budget > 0 ? Math.min(100, Math.round((executed / budget) * 100)) : 0;
    return { budget, executed, balance, percent };
  }, [project, projectTasks]);

  // Handle Drag & Drop
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("text/plain", taskId);
    setDraggedTaskId(taskId);
  };

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    if (dragOverColumnId !== colId) {
      setDragOverColumnId(colId);
    }
  };

  const handleDragLeave = () => {
    setDragOverColumnId(null);
  };

  const handleDrop = async (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain") || draggedTaskId;
    setDragOverColumnId(null);
    setDraggedTaskId(null);

    if (taskId) {
      const currentTask = projectTasks.find((t) => t.id === taskId);
      if (currentTask && currentTask.column !== colId) {
        await moveProjectTaskColumn(taskId, colId);
        showSuccess("Tarea Movida", `La tarea ha cambiado de fase.`);
      }
    }
  };

  // Open modal to create task
  const handleOpenCreateTask = (columnId?: string) => {
    setTaskToEdit(null);
    setDefaultColumnForNewTask(columnId || project.columns[0]?.id || "inicio");
    setIsTaskModalOpen(true);
  };

  // Open modal to edit task
  const handleOpenEditTask = (task: ClientProjectTask) => {
    setTaskToEdit(task);
    setDefaultColumnForNewTask(task.column);
    setIsTaskModalOpen(true);
  };

  // Delete task
  const handleDeleteTask = (taskId: string, title: string) => {
    showConfirm(
      "¿Eliminar Tarea?",
      `¿Estás seguro de que deseas eliminar permanentemente la tarea "${title}"?`,
      async () => {
        try {
          await deleteClientProjectTask(taskId);
          showSuccess("Tarea Eliminada", "La tarea ha sido retirada del proyecto.");
        } catch {
          showError("Error", "No se pudo eliminar la tarea.");
        }
      },
      "Eliminar Tarea"
    );
  };

  // Add new column to this project
  const handleAddColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColumnLabel.trim()) return;

    const newColId = "col-" + Date.now();
    const newCol: ProjectCustomColumn = {
      id: newColId,
      label: newColumnLabel.trim(),
      color: newColumnColor,
    };

    const updatedCols = [...project.columns, newCol];
    await updateProjectColumns(project.id, updatedCols);
    showSuccess("Columna Creada", `Columna "${newCol.label}" añadida al canvas.`);
    setNewColumnLabel("");
    setIsAddColumnModalOpen(false);
  };

  // Delete column
  const handleDeleteColumn = (colId: string, colLabel: string) => {
    if (project.columns.length <= 1) {
      showError("Acción no permitida", "El proyecto debe conservar al menos una columna.");
      return;
    }

    const tasksInCol = projectTasks.filter((t) => t.column === colId);
    showConfirm(
      `¿Eliminar Columna "${colLabel}"?`,
      tasksInCol.length > 0
        ? `Esta columna contiene ${tasksInCol.length} tarea(s). Al eliminarla, las tareas se moverán a la primera columna disponible. ¿Deseas continuar?`
        : `¿Confirmas que deseas eliminar esta columna?`,
      async () => {
        const remainingCols = project.columns.filter((c) => c.id !== colId);
        const fallbackColId = remainingCols[0]?.id || "inicio";

        // Reassign tasks
        for (const t of tasksInCol) {
          await moveProjectTaskColumn(t.id, fallbackColId);
        }

        await updateProjectColumns(project.id, remainingCols);
        showSuccess("Columna Eliminada", `La columna ha sido retirada.`);
      },
      "Eliminar Columna"
    );
  };

  // Quick project status update
  const handleStatusChange = async (newStatus: ProjectStatus) => {
    await updateProject(project.id, { status: newStatus });
    showSuccess("Estado Actualizado", `El proyecto ahora está en estado "${newStatus}".`);
  };

  // Color mapping for project status badge
  const statusStyles: Record<ProjectStatus, { bg: string; text: string; border: string; label: string }> = {
    inicio: { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-300", label: "Inicio / Planeado" },
    en_proceso: { bg: "bg-blue-100", text: "text-blue-800", border: "border-blue-300", label: "En Proceso" },
    revision: { bg: "bg-amber-100", text: "text-amber-800", border: "border-amber-300", label: "En Revisión" },
    terminado: { bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-300", label: "Terminado" },
    en_pausa: { bg: "bg-purple-100", text: "text-purple-800", border: "border-purple-300", label: "En Pausa" },
    cancelado: { bg: "bg-rose-100", text: "text-rose-800", border: "border-rose-300", label: "Cancelado" },
  };

  return (
    <div className="space-y-6">
      {/* Top Header / Project Info Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Navigation Breadcrumb Bar */}
        <div className="px-6 py-3.5 bg-slate-50/80 border-b border-slate-200/70 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-[#004ac6] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a la Tabla de Proyectos</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">ID: {project.id}</span>
            <span className="text-slate-300">·</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-medium">Estado:</span>
              <select
                value={project.status}
                onChange={(e) => handleStatusChange(e.target.value as ProjectStatus)}
                className={`text-xs font-bold px-2.5 py-1 rounded-lg border cursor-pointer focus:outline-hidden ${
                  statusStyles[project.status]?.bg || "bg-slate-100"
                } ${statusStyles[project.status]?.text || "text-slate-800"} ${
                  statusStyles[project.status]?.border || "border-slate-300"
                }`}
              >
                <option value="inicio">Inicio / Planeado</option>
                <option value="en_proceso">En Proceso</option>
                <option value="revision">En Revisión</option>
                <option value="terminado">Terminado</option>
                <option value="en_pausa">En Pausa</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
          </div>
        </div>

        {/* Project Details Banner */}
        <div className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#004ac6] to-sky-500 text-white flex items-center justify-center shadow-md">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                    {project.title}
                  </h1>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-0.5">
                    {project.type === "cliente" ? (
                      <span className="inline-flex items-center gap-1 font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                        <Building2 className="w-3.5 h-3.5 text-[#004ac6]" />
                        {project.clientName || "Cliente Asignado"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                        <Radio className="w-3.5 h-3.5 text-[#004ac6]" />
                        {project.nodeName || "POP / Infraestructura"}
                      </span>
                    )}
                    <span className="text-slate-300">·</span>
                    <span className="inline-flex items-center gap-1 text-slate-600">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {project.startDate} al {project.endDate}
                    </span>
                  </div>
                </div>
              </div>
              {project.description && (
                <p className="text-xs text-slate-600 max-w-3xl leading-relaxed pt-1">
                  {project.description}
                </p>
              )}
            </div>

            {/* Actions & Summary widgets */}
            <div className="flex flex-wrap items-center gap-3 self-start lg:self-center">
              <button
                onClick={() => setIsGanttModalOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer shadow-2xs"
              >
                <Calendar className="w-4 h-4 text-[#004ac6]" />
                <span>Ver Diagrama Gantt</span>
              </button>

              <button
                onClick={() => onEditProject(project)}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer shadow-2xs"
              >
                <Edit2 className="w-4 h-4 text-slate-500" />
                <span>Editar Proyecto</span>
              </button>

              <button
                onClick={() => handleOpenCreateTask()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#004ac6] text-white text-xs font-bold hover:bg-[#003da6] transition-all cursor-pointer shadow-md shadow-blue-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>Nueva Tarea</span>
              </button>
            </div>
          </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Avance Global</div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-xl font-black text-slate-900">{progressStats.percent}%</span>
                  <span className="text-xs font-medium text-slate-500">
                    ({progressStats.completed}/{progressStats.total} tareas)
                  </span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-2">
                  <div
                    className="bg-[#004ac6] h-full transition-all duration-500"
                    style={{ width: `${progressStats.percent}%` }}
                  />
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tareas Pendientes</div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-xl font-black text-amber-600">{progressStats.pending}</span>
                  <span className="text-xs font-medium text-slate-500">por resolver</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-2">En curso y revisión</div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Presupuesto Estimado</div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-xl font-black text-slate-900">
                    ${financialStats.budget.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-2">Fondos aprobados</div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Costo Ejecutado</div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span
                    className={`text-xl font-black ${
                      financialStats.executed > financialStats.budget && financialStats.budget > 0
                        ? "text-rose-600"
                        : "text-emerald-700"
                    }`}
                  >
                    ${financialStats.executed.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                  {financialStats.budget > 0 && (
                    <span className="text-xs font-medium text-slate-500">
                      ({financialStats.percent}%)
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 mt-2">
                  Saldo: ${financialStats.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
        </div>

        {/* View Switcher Bar */}
        <div className="px-6 border-t border-slate-200/80 bg-slate-50/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("kanban")}
              className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === "kanban"
                  ? "border-[#004ac6] text-[#004ac6] bg-white rounded-t-lg"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Kanban className="w-4 h-4" />
              <span>Canva Notion (Tablero)</span>
            </button>

            <button
              onClick={() => setActiveTab("list")}
              className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === "list"
                  ? "border-[#004ac6] text-[#004ac6] bg-white rounded-t-lg"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <ListTodo className="w-4 h-4" />
              <span>Lista de Tareas</span>
            </button>

            <button
              onClick={() => setActiveTab("gantt")}
              className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === "gantt"
                  ? "border-[#004ac6] text-[#004ac6] bg-white rounded-t-lg"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Cronograma de Fechas</span>
            </button>
          </div>

          {/* Quick filter by priority */}
          <div className="hidden md:flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar en tareas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:border-[#004ac6] w-48 transition-all"
              />
            </div>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-medium focus:outline-hidden"
            >
              <option value="todas">Prioridad: Todas</option>
              <option value="urgente">Urgente</option>
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </select>
          </div>
        </div>
      </div>

      {/* VIEW 1: CANVA NOTION (TABLERO KANBAN) */}
      {activeTab === "kanban" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <Kanban className="w-4 h-4 text-[#004ac6]" />
              <span>Tablero Personalizado del Proyecto</span>
              <span className="text-slate-400 font-normal">
                (Arrastra y suelta las tareas entre las columnas para cambiar su fase)
              </span>
            </div>

            <button
              onClick={() => setIsAddColumnModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-slate-300 text-xs font-bold text-slate-600 hover:text-[#004ac6] hover:border-[#004ac6] hover:bg-white transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Añadir Columna</span>
            </button>
          </div>

          {/* Kanban Columns Row */}
          <div className="flex gap-4 overflow-x-auto pb-4 pt-1 items-start min-h-[550px]">
            {project.columns.map((column) => {
              const colStyle = getColStyle(column.color);
              const columnTasks = filteredTasks.filter((t) => t.column === column.id);
              const isDragOver = dragOverColumnId === column.id;

              return (
                <div
                  key={column.id}
                  onDragOver={(e) => handleDragOver(e, column.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, column.id)}
                  className={`flex-shrink-0 w-80 rounded-2xl border transition-all duration-150 flex flex-col max-h-[78vh] ${
                    isDragOver
                      ? "ring-2 ring-[#004ac6] bg-blue-50/40 border-blue-400"
                      : "bg-slate-50/70 border-slate-200/90"
                  }`}
                >
                  {/* Column Header */}
                  <div className="p-3.5 border-b border-slate-200/80 flex items-center justify-between bg-white rounded-t-2xl">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2.5 h-2.5 rounded-full ${colStyle.dot}`} />
                      <h3 className="text-xs font-extrabold text-slate-900 truncate">
                        {column.label}
                      </h3>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {columnTasks.length}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenCreateTask(column.id)}
                        title="Añadir tarea a esta columna"
                        className="p-1 text-slate-400 hover:text-[#004ac6] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      {project.columns.length > 1 && (
                        <button
                          onClick={() => handleDeleteColumn(column.id, column.label)}
                          title="Eliminar columna"
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Tasks Cards List */}
                  <div className="p-3 space-y-3 overflow-y-auto flex-1">
                    {columnTasks.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl bg-white/40">
                        Sin tareas en esta fase
                      </div>
                    ) : (
                      columnTasks.map((task) => {
                        const completedSubtasks = task.checklist?.filter((c) => c.done).length || 0;
                        const totalSubtasks = task.checklist?.length || 0;

                        const priorityBadges: Record<string, { bg: string; text: string }> = {
                          urgente: { bg: "bg-rose-100 text-rose-700", text: "Urgente" },
                          alta: { bg: "bg-amber-100 text-amber-800", text: "Alta" },
                          media: { bg: "bg-blue-100 text-blue-700", text: "Media" },
                          baja: { bg: "bg-slate-100 text-slate-700", text: "Baja" },
                        };

                        const taskTramites = regulatoryTramites.filter(
                          (t) => (task.tramiteIds || []).includes(t.id) || t.taskId === task.id
                        );

                        return (
                          <div
                            key={task.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, task.id)}
                            onClick={() => handleOpenEditTask(task)}
                            className="p-3.5 bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all cursor-pointer group space-y-2.5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                                  priorityBadges[task.priority]?.bg || "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {priorityBadges[task.priority]?.text || task.priority}
                              </span>

                              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenEditTask(task);
                                  }}
                                  className="p-1 text-slate-400 hover:text-[#004ac6] hover:bg-slate-100 rounded-md"
                                  title="Editar tarea"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteTask(task.id, task.title);
                                  }}
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md"
                                  title="Eliminar tarea"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {taskTramites.length > 0 && (
                              <div className="flex items-center gap-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  <FileText className="w-3 h-3 text-indigo-600" />
                                  <span>{taskTramites.length} {taskTramites.length === 1 ? "Trámite" : "Trámites"}</span>
                                </span>
                              </div>
                            )}

                            <h4 className="text-xs font-bold text-slate-900 group-hover:text-[#004ac6] transition-colors leading-snug line-clamp-2">
                              {task.title}
                            </h4>

                            {task.description && (
                              <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                                {task.description}
                              </p>
                            )}

                            {/* Subtasks Progress */}
                            {totalSubtasks > 0 && (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold">
                                  <span className="flex items-center gap-1">
                                    <CheckSquare className="w-3 h-3 text-slate-400" />
                                    Checklist
                                  </span>
                                  <span>
                                    {completedSubtasks}/{totalSubtasks}
                                  </span>
                                </div>
                                <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                                  <div
                                    className="bg-emerald-500 h-full transition-all"
                                    style={{ width: `${(completedSubtasks / totalSubtasks) * 100}%` }}
                                  />
                                </div>
                              </div>
                            )}

                            {/* Card Footer: Assignee, Due Date & Notes Count */}
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                              <span className="inline-flex items-center gap-1 truncate max-w-[130px] font-medium">
                                <User className="w-3 h-3 text-slate-400" />
                                <span className="truncate">{task.assignedTo || "NOC"}</span>
                              </span>

                              <div className="flex items-center gap-2">
                                {(task.notesThread?.length || 0) > 0 && (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 font-bold">
                                    <MessageSquare className="w-3 h-3" />
                                    {task.notesThread?.length}
                                  </span>
                                )}

                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded-md border border-slate-200">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  {task.dueDate.slice(5)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Add task button at bottom of column */}
                  <div className="p-2 border-t border-slate-200/80 bg-white/60 rounded-b-2xl">
                    <button
                      onClick={() => handleOpenCreateTask(column.id)}
                      className="w-full py-2 px-3 text-xs font-bold text-slate-600 hover:text-[#004ac6] hover:bg-blue-50/50 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Añadir tarea</span>
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Quick Button to Add New Column */}
            <div className="flex-shrink-0 w-72">
              <button
                onClick={() => setIsAddColumnModalOpen(true)}
                className="w-full py-6 px-4 rounded-2xl border-2 border-dashed border-slate-300 hover:border-[#004ac6] hover:bg-blue-50/40 text-slate-500 hover:text-[#004ac6] font-bold text-xs flex flex-col items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <span>+ Añadir Nueva Columna</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: LISTA DE TAREAS (TABLA NOTION) */}
      {activeTab === "list" && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/60">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <ListTodo className="w-4 h-4 text-[#004ac6]" />
              <span>Tareas Registradas</span>
            </h3>

            <button
              onClick={() => handleOpenCreateTask()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#004ac6] text-white text-xs font-bold hover:bg-[#003da6] transition-all cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nueva Tarea</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Tarea / Título</th>
                  <th className="py-3 px-4">Fase / Columna</th>
                  <th className="py-3 px-4">Prioridad</th>
                  <th className="py-3 px-4">Asignado</th>
                  <th className="py-3 px-4">Fecha Límite</th>
                  <th className="py-3 px-4">Trámites</th>
                  <th className="py-3 px-4">Checklist</th>
                  <th className="py-3 px-4">Presupuesto / Costo</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-xs text-slate-400">
                      No se encontraron tareas registradas en este proyecto.
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((task) => {
                    const currentCol = project.columns.find((c) => c.id === task.column);
                    const colStyle = getColStyle(currentCol?.color);
                    const completedSubtasks = task.checklist?.filter((c) => c.done).length || 0;
                    const totalSubtasks = task.checklist?.length || 0;
                    const taskTramites = regulatoryTramites.filter(
                      (t) => (task.tramiteIds || []).includes(t.id) || t.taskId === task.id
                    );

                    return (
                      <tr key={task.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 hover:text-[#004ac6] cursor-pointer" onClick={() => handleOpenEditTask(task)}>
                            {task.title}
                          </div>
                          {task.description && (
                            <div className="text-[11px] text-slate-400 truncate max-w-xs">
                              {task.description}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <select
                            value={task.column}
                            onChange={async (e) => {
                              await moveProjectTaskColumn(task.id, e.target.value);
                              showSuccess("Fase Cambiada", "Tarea movida correctamente.");
                            }}
                            className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border cursor-pointer focus:outline-hidden ${colStyle.badge}`}
                          >
                            {project.columns.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                              task.priority === "urgente"
                                ? "bg-rose-100 text-rose-700"
                                : task.priority === "alta"
                                ? "bg-amber-100 text-amber-800"
                                : task.priority === "media"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {task.priority}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1.5 text-slate-700">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            {task.assignedTo || "Cuadrilla NOC"}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1.5 text-slate-600 font-mono text-[11px]">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {task.dueDate}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          {taskTramites.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-1 max-w-[140px]">
                              {taskTramites.map((trm) => (
                                <span
                                  key={trm.id}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200"
                                  title={`${trm.documentNumber}: ${trm.reason}`}
                                >
                                  <FileText className="w-3 h-3 text-indigo-600 shrink-0" />
                                  <span className="font-mono truncate">{trm.documentNumber}</span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          {totalSubtasks > 0 ? (
                            <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                              {completedSubtasks}/{totalSubtasks} ({Math.round((completedSubtasks / totalSubtasks) * 100)}%)
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">-</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-slate-700 font-mono text-[11px]">
                          ${task.executedCost || 0} / ${task.estimatedBudget || 0}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEditTask(task)}
                              title="Editar tarea"
                              className="p-1.5 text-slate-400 hover:text-[#004ac6] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteTask(task.id, task.title)}
                              title="Eliminar tarea"
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
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
      )}

      {/* VIEW 3: CRONOGRAMA DE FECHAS (EMBEDDED GANTT) */}
      {activeTab === "gantt" && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#004ac6]" />
                <span>Cronograma y Duración de Tareas</span>
              </h3>
              <p className="text-xs text-slate-500">
                Visualización temporal del proyecto ({project.startDate} al {project.endDate})
              </p>
            </div>

            <button
              onClick={() => setIsGanttModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#004ac6]" />
              <span>Ver en Pantalla Completa</span>
            </button>
          </div>

          {/* Timeline visualization */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            {/* Global Project Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#004ac6]" />
                  Duración Total del Proyecto
                </span>
                <span className="font-mono text-slate-500">{project.startDate} — {project.endDate}</span>
              </div>
              <div className="w-full bg-blue-100/70 h-3 rounded-full overflow-hidden">
                <div
                  className="bg-[#004ac6] h-full rounded-full transition-all duration-500"
                  style={{ width: `${progressStats.percent}%` }}
                />
              </div>
            </div>

            {/* Tasks Timeline Bars */}
            <div className="space-y-3 pt-4">
              <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Desglose por Tarea
              </h4>

              {projectTasks.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No hay tareas registradas en el cronograma.
                </div>
              ) : (
                projectTasks.map((t) => {
                  const isDone =
                    t.column === "terminado" ||
                    t.column === "completado" ||
                    t.column === "finalizado";

                  return (
                    <div
                      key={t.id}
                      onClick={() => handleOpenEditTask(t)}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 hover:border-slate-300 transition-all cursor-pointer space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isDone ? "bg-emerald-500" : "bg-blue-500"
                            }`}
                          />
                          <span>{t.title}</span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            ({t.assignedTo || "NOC"})
                          </span>
                        </div>
                        <span className="font-mono text-[11px] text-slate-500">
                          {t.startDate || project.startDate} $\rightarrow$ {t.dueDate}
                        </span>
                      </div>

                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isDone ? "bg-emerald-500 w-full" : "bg-blue-500 w-2/3"
                          }`}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: AÑADIR NUEVA COLUMNA */}
      {isAddColumnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in select-none">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Kanban className="w-4 h-4 text-[#004ac6]" />
                <span>Añadir Columna al Canva</span>
              </h3>
              <button
                onClick={() => setIsAddColumnModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddColumn} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nombre de la Columna / Fase <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Pruebas de Calidad, Tendido, etc."
                  value={newColumnLabel}
                  onChange={(e) => setNewColumnLabel(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-[#004ac6]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Color Identificador
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(
                    ["blue", "slate", "amber", "emerald", "purple", "rose", "indigo"] as ProjectCustomColumn["color"][]
                  ).map((colorKey) => {
                    const st = COLUMN_COLORS[colorKey];
                    return (
                      <button
                        type="button"
                        key={colorKey}
                        onClick={() => setNewColumnColor(colorKey)}
                        className={`px-2 py-1.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          newColumnColor === colorKey
                            ? "ring-2 ring-[#004ac6] border-[#004ac6]"
                            : "border-slate-200 hover:bg-slate-50"
                        } ${st.bg} ${st.text}`}
                      >
                        <span className={`w-2 h-2 rounded-full ${st.dot}`} />
                        <span className="capitalize">{colorKey}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddColumnModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#004ac6] hover:bg-[#003da6] transition-colors shadow-xs"
                >
                  Crear Columna
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Modal */}
      <ProjectTaskModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setTaskToEdit(null);
        }}
        taskToEdit={taskToEdit}
        defaultProjectId={project.id}
        defaultProjectName={project.title}
        defaultClientId={project.clientId}
        defaultClientName={project.clientName}
        availableColumns={project.columns}
        defaultColumn={defaultColumnForNewTask}
      />

      {/* Gantt Full Modal */}
      <ProjectGanttModal
        isOpen={isGanttModalOpen}
        onClose={() => setIsGanttModalOpen(false)}
        project={project}
        tasks={projectTasks}
      />
    </div>
  );
}
