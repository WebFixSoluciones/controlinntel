"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import {
  Client,
  ClientProjectTask,
  ProjectBoardFlow,
  ProjectKanbanColumn,
  ProjectChecklistItem,
} from "@/types";
import {
  ProjectTaskModal,
  ISP_FLOW_COLUMNS,
  GENERAL_FLOW_COLUMNS,
} from "@/components/modules/projects/ProjectTaskModal";
import {
  Calendar,
  Clock,
  User,
  CheckSquare,
  Square,
  MessageSquare,
  Send,
  AlertTriangle,
  CheckCircle2,
  Kanban,
  ListTodo,
  Plus,
  Search,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Bell,
  DollarSign,
  TrendingUp,
  Layers,
  ShieldAlert,
  Briefcase,
  FileText,
} from "lucide-react";

interface ClientTasksTabProps {
  client: Client;
}

export function ClientTasksTab({ client }: ClientTasksTabProps) {
  const {
    projects,
    clientProjects,
    regulatoryTramites,
    currentUser,
    systemUsers,
    addClientProjectTask,
    updateClientProjectTask,
    moveProjectTaskColumn,
    addProjectTaskNote,
    deleteClientProjectTask,
  } = useApp();

  const { showSuccess, showConfirm, showError } = useToast();

  // View state
  const [viewMode, setViewMode] = useState<"cronograma" | "kanban">("cronograma");
  const [activeFlow, setActiveFlow] = useState<ProjectBoardFlow>("isp_tecnico");

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("todas");
  const [statusFilter, setStatusFilter] = useState<string>("todas");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("todos");
  const [projectFilter, setProjectFilter] = useState<string>("todos");

  // Projects of this client
  const clientProjectsList = useMemo(() => {
    return projects.filter((p) => !p.isDeleted && p.clientId === client.id);
  }, [projects, client.id]);

  // Expanded comments accordion state
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [newCommentInputs, setNewCommentInputs] = useState<Record<string, string>>({});
  const [submittingCommentId, setSubmittingCommentId] = useState<string | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<ClientProjectTask | null>(null);
  const [modalDefaultCol, setModalDefaultCol] = useState<ProjectKanbanColumn | undefined>(undefined);

  // Drag and drop for Kanban view
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ProjectKanbanColumn | null>(null);

  // Filter tasks belonging strictly to this client
  const clientTasks = useMemo(() => {
    return clientProjects.filter((t) => t.clientId === client.id);
  }, [clientProjects, client.id]);

  // Current user identifiers
  const currentUserName = (currentUser.displayName || "").trim().toLowerCase();
  const currentUserId = (currentUser.uid || "").trim().toLowerCase();

  // Check if a task is assigned to current user
  const isAssignedToCurrentUser = useCallback((task: ClientProjectTask) => {
    if (!currentUserName && !currentUserId) return false;
    if (task.assignedToId && task.assignedToId.toLowerCase() === currentUserId) return true;
    const taskAssignee = (task.assignedTo || "").trim().toLowerCase();
    return taskAssignee.includes(currentUserName) || (currentUserName && currentUserName.includes(taskAssignee));
  }, [currentUserName, currentUserId]);

  // Helper: Is task pending
  const isTaskPending = (task: ClientProjectTask) => {
    return task.column !== "completado" && task.column !== "finalizado";
  };

  // Notification calculations for this client
  const pendingTasksTotal = useMemo(() => {
    return clientTasks.filter(isTaskPending);
  }, [clientTasks]);

  const myPendingTasks = useMemo(() => {
    return pendingTasksTotal.filter(isAssignedToCurrentUser);
  }, [pendingTasksTotal, isAssignedToCurrentUser]);

  const completedTasksCount = useMemo(() => {
    return clientTasks.filter((t) => !isTaskPending(t)).length;
  }, [clientTasks]);

  // Financial calculations
  const totalBudget = useMemo(() => {
    return clientTasks.reduce((acc, t) => acc + (t.estimatedBudget || 0), 0);
  }, [clientTasks]);

  const executedCost = useMemo(() => {
    return clientTasks.reduce((acc, t) => acc + (t.executedCost || 0), 0);
  }, [clientTasks]);

  // Columns definition based on active flow
  const currentColumns = activeFlow === "isp_tecnico" ? ISP_FLOW_COLUMNS : GENERAL_FLOW_COLUMNS;

  // Filtered tasks for presentation
  const filteredTasks = useMemo(() => {
    return clientTasks.filter((t) => {
      // Flow match (Kanban or general)
      const flow = t.boardFlow || "isp_tecnico";
      if (viewMode === "kanban" && flow !== activeFlow) return false;

      // Text query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchDesc = (t.description || "").toLowerCase().includes(q);
        const matchAssignee = (t.assignedTo || "").toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchAssignee) return false;
      }

      // Priority
      if (priorityFilter !== "todas" && t.priority !== priorityFilter) {
        return false;
      }

      // Status
      if (statusFilter === "pendientes" && !isTaskPending(t)) return false;
      if (statusFilter === "completadas" && isTaskPending(t)) return false;
      if (statusFilter === "en_progreso" && (t.column === "por_iniciar" || t.column === "factibilidad" || !isTaskPending(t))) return false;

      // Assignee
      if (assigneeFilter === "mis_tareas") {
        if (!isAssignedToCurrentUser(t)) return false;
      } else if (assigneeFilter !== "todos") {
        if ((t.assignedTo || "").toLowerCase() !== assigneeFilter.toLowerCase()) return false;
      }

      // Project filter
      if (projectFilter !== "todos" && t.projectId !== projectFilter) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      // Sorting: Pending first, then by dueDate asc
      const aPending = isTaskPending(a);
      const bPending = isTaskPending(b);
      if (aPending && !bPending) return -1;
      if (!aPending && bPending) return 1;

      // Urgent priority first
      const priorityWeights: Record<string, number> = { urgente: 4, alta: 3, media: 2, baja: 1 };
      const aWeight = priorityWeights[a.priority] || 0;
      const bWeight = priorityWeights[b.priority] || 0;
      if (aWeight !== bWeight) return bWeight - aWeight;

      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  }, [
    clientTasks,
    viewMode,
    activeFlow,
    searchQuery,
    priorityFilter,
    statusFilter,
    assigneeFilter,
    projectFilter,
    isAssignedToCurrentUser,
  ]);

  // Relative deadline calculator
  const getDeadlineInfo = (dueDateStr: string, isCompleted: boolean) => {
    if (isCompleted) {
      return {
        label: "Completada",
        color: "text-emerald-700 bg-emerald-50 border-emerald-200",
        badge: "Completada a tiempo",
        isOverdue: false,
      };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [y, m, d] = dueDateStr.split("-").map(Number);
    const due = new Date(y, (m || 1) - 1, d || 1);
    due.setHours(0, 0, 0, 0);

    const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        label: `Vencida hace ${Math.abs(diffDays)} ${Math.abs(diffDays) === 1 ? "día" : "días"}`,
        color: "text-rose-700 bg-rose-50 border-rose-200 font-bold animate-pulse",
        badge: "Vencida",
        isOverdue: true,
      };
    }
    if (diffDays === 0) {
      return {
        label: "Vence Hoy",
        color: "text-amber-800 bg-amber-50 border-amber-200 font-bold",
        badge: "Para Hoy",
        isOverdue: false,
      };
    }
    if (diffDays === 1) {
      return {
        label: "Vence Mañana",
        color: "text-amber-700 bg-amber-50/80 border-amber-200 font-medium",
        badge: "Próxima",
        isOverdue: false,
      };
    }
    return {
      label: `Plazo: en ${diffDays} días`,
      color: "text-slate-600 bg-slate-100 border-slate-200",
      badge: `${diffDays} días`,
      isOverdue: false,
    };
  };

  // Toggle checklist item done
  const handleToggleChecklist = async (task: ClientProjectTask, itemId: string) => {
    const updatedChecklist = (task.checklist || []).map((item) =>
      item.id === itemId ? { ...item, done: !item.done } : item
    );
    try {
      await updateClientProjectTask(task.id, { checklist: updatedChecklist });
    } catch {
      showError("Error", "No se pudo actualizar el estado de la subtarea.");
    }
  };

  // Add a follow-up comment
  const handleAddComment = async (taskId: string) => {
    const text = (newCommentInputs[taskId] || "").trim();
    if (!text) return;

    setSubmittingCommentId(taskId);
    try {
      await addProjectTaskNote(taskId, text);
      setNewCommentInputs((prev) => ({ ...prev, [taskId]: "" }));
      // Ensure comments section stays expanded
      setExpandedComments((prev) => ({ ...prev, [taskId]: true }));
      showSuccess("Comentario Registrado", "Comentario de control y seguimiento añadido a la tarea.");
    } catch {
      showError("Error", "No se pudo guardar el comentario.");
    } finally {
      setSubmittingCommentId(null);
    }
  };

  // Quick phase change from list view
  const handleQuickPhaseChange = async (taskId: string, newCol: ProjectKanbanColumn) => {
    try {
      await moveProjectTaskColumn(taskId, newCol);
      showSuccess("Fase Actualizada", "El estado de la tarea ha sido modificado.");
    } catch {
      showError("Error", "No se pudo cambiar de estado.");
    }
  };

  // Delete task
  const handleDeleteTask = (task: ClientProjectTask) => {
    showConfirm(
      "¿Eliminar Tarea del Cliente?",
      `¿Deseas remover la tarea "${task.title}" del cronograma de este cliente? Esta acción también se reflejará en el módulo de Proyectos.`,
      async () => {
        try {
          await deleteClientProjectTask(task.id);
          showSuccess("Tarea Eliminada", "La tarea ha sido retirada del cronograma.");
        } catch {
          showError("Error", "No se pudo eliminar la tarea.");
        }
      },
      "Eliminar Tarea"
    );
  };

  // Drag and drop for Kanban view
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedTaskId(id);
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, colId: ProjectKanbanColumn) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverColumn !== colId) setDragOverColumn(colId);
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
        showSuccess("Fase Actualizada", "Tarea reubicada en el tablero.");
      } catch {
        // Handled
      }
      setDraggedTaskId(null);
    }
  };

  const handleShiftColumn = async (task: ClientProjectTask, direction: "prev" | "next") => {
    const currentIndex = currentColumns.findIndex((c) => c.id === task.column);
    if (direction === "next" && currentIndex < currentColumns.length - 1) {
      await moveProjectTaskColumn(task.id, currentColumns[currentIndex + 1].id);
    } else if (direction === "prev" && currentIndex > 0) {
      await moveProjectTaskColumn(task.id, currentColumns[currentIndex - 1].id);
    }
  };

  return (
    <div className="space-y-4 select-none">
      {/* ========================================================= */}
      {/* 1. NOTIFICACIÓN EN EL ENCABEZADO DE TAREAS PENDIENTES     */}
      {/* ========================================================= */}
      {myPendingTasks.length > 0 ? (
        <div className="p-4 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-l-4 border-amber-500 rounded-2xl bg-white shadow-2xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                  Notificación de Equipo
                </span>
                <span className="text-xs font-bold text-slate-800">
                  {currentUser.displayName || "Técnico Asignado"}
                </span>
              </div>
              <p className="text-xs text-slate-700 mt-0.5">
                Tienes <strong className="text-amber-800 font-extrabold">{myPendingTasks.length} {myPendingTasks.length === 1 ? "tarea pendiente" : "tareas pendientes"}</strong> asignadas a tu cargo para este cliente en el cronograma de Proyectos.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setAssigneeFilter("mis_tareas");
                setStatusFilter("pendientes");
              }}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              Ver Solo Mis Tareas
            </button>
            {(assigneeFilter === "mis_tareas" || statusFilter === "pendientes") && (
              <button
                onClick={() => {
                  setAssigneeFilter("todos");
                  setStatusFilter("todas");
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                Limpiar Filtro
              </button>
            )}
          </div>
        </div>
      ) : pendingTasksTotal.length > 0 ? (
        <div className="p-3.5 px-4 bg-sky-50/80 border border-sky-200 rounded-2xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-[#004ac6] shrink-0" />
            <p className="text-xs text-slate-700">
              El equipo de trabajo tiene <strong className="text-[#004ac6] font-bold">{pendingTasksTotal.length} {pendingTasksTotal.length === 1 ? "tarea pendiente" : "tareas pendientes"}</strong> programadas para este cliente.
            </p>
          </div>
          <span className="text-[11px] font-bold text-slate-500">
            {completedTasksCount} completadas
          </span>
        </div>
      ) : clientTasks.length > 0 ? (
        <div className="p-3.5 px-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl flex items-center gap-2.5 text-emerald-800 text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Todas las tareas de este cliente han sido completadas satisfactoriamente al 100%.</span>
        </div>
      ) : null}

      {/* ========================================================= */}
      {/* 2. HEADER KPIS & ACTION BUTTONS                           */}
      {/* ========================================================= */}
      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#004ac6]/10 text-[#004ac6] flex items-center justify-center">
              <ListTodo className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-xs">
                Gestor de Tareas & Cronograma del Cliente
              </h4>
              <p className="text-[11px] text-slate-500">
                Tareas técnicas y de despliegue sincronizadas en tiempo real con el Módulo de Proyectos
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* View Switcher: Cronograma vs Kanban */}
            <div className="flex items-center p-0.5 bg-slate-200/70 rounded-lg text-xs font-bold">
              <button
                type="button"
                onClick={() => setViewMode("cronograma")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] transition-all cursor-pointer ${
                  viewMode === "cronograma"
                    ? "bg-white text-[#004ac6] shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Cronograma & Lista</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode("kanban")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] transition-all cursor-pointer ${
                  viewMode === "kanban"
                    ? "bg-white text-[#004ac6] shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Kanban className="w-3.5 h-3.5" />
                <span>Tablero Kanban</span>
              </button>
            </div>

            {/* Flow Switcher (only relevant for kanban or to categorize) */}
            <div className="flex items-center p-0.5 bg-slate-200/70 rounded-lg text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveFlow("isp_tecnico")}
                className={`px-2.5 py-1.5 rounded-md text-[11px] transition-all cursor-pointer ${
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
                className={`px-2.5 py-1.5 rounded-md text-[11px] transition-all cursor-pointer ${
                  activeFlow === "general"
                    ? "bg-white text-[#004ac6] shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                General
              </button>
            </div>

            {/* Create Task Button */}
            <button
              onClick={() => {
                setTaskToEdit(null);
                setModalDefaultCol(activeFlow === "isp_tecnico" ? "factibilidad" : "por_iniciar");
                setIsModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#004ac6] hover:bg-[#003ca0] text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nueva Tarea</span>
            </button>
          </div>
        </div>

        {/* Mini KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-2 border-t border-slate-200/60">
          <div className="bg-white p-2.5 rounded-xl border border-slate-200/70">
            <span className="text-[10px] font-bold uppercase text-slate-400">Total Tareas</span>
            <p className="text-xs font-extrabold text-slate-900 mt-0.5">{clientTasks.length}</p>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-slate-200/70">
            <span className="text-[10px] font-bold uppercase text-amber-600">Pendientes</span>
            <p className="text-xs font-extrabold text-amber-700 mt-0.5">{pendingTasksTotal.length}</p>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-slate-200/70">
            <span className="text-[10px] font-bold uppercase text-emerald-600">Completadas</span>
            <p className="text-xs font-extrabold text-emerald-700 mt-0.5">{completedTasksCount}</p>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-slate-200/70">
            <span className="text-[10px] font-bold uppercase text-slate-400">Presupuesto Obra</span>
            <p className="text-xs font-extrabold text-slate-900 mt-0.5">${totalBudget.toFixed(2)}</p>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-slate-200/70">
            <span className="text-[10px] font-bold uppercase text-slate-400">Costo Ejecutado</span>
            <p className="text-xs font-extrabold text-sky-700 mt-0.5">${executedCost.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. FILTERS & SEARCH TOOLBAR                               */}
      {/* ========================================================= */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 ${clientProjectsList.length > 0 ? "lg:grid-cols-5" : ""} gap-2.5 p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs`}>
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por título, descripción..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-[#004ac6] transition-all"
          />
        </div>

        {/* Project Filter */}
        {clientProjectsList.length > 0 && (
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-medium focus:bg-white focus:outline-hidden focus:border-[#004ac6]"
          >
            <option value="todos">Todos los Proyectos</option>
            {clientProjectsList.map((p) => (
              <option key={p.id} value={p.id}>
                📁 {p.title}
              </option>
            ))}
          </select>
        )}

        {/* Priority Filter */}
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-medium focus:bg-white focus:outline-hidden focus:border-[#004ac6]"
        >
          <option value="todas">Todas las Prioridades</option>
          <option value="urgente">Prioridad: Urgente</option>
          <option value="alta">Prioridad: Alta</option>
          <option value="media">Prioridad: Media</option>
          <option value="baja">Prioridad: Baja</option>
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-medium focus:bg-white focus:outline-hidden focus:border-[#004ac6]"
        >
          <option value="todas">Todos los Estados</option>
          <option value="pendientes">Solo Pendientes</option>
          <option value="en_progreso">En Progreso / Ejecución</option>
          <option value="completadas">Solo Completadas</option>
        </select>

        {/* Assignee Filter */}
        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-medium focus:bg-white focus:outline-hidden focus:border-[#004ac6]"
        >
          <option value="todos">Todo el Equipo de Trabajo</option>
          <option value="mis_tareas">Solo Mis Tareas Asignadas</option>
          {systemUsers.map((u) => (
            <option key={u.uid} value={u.displayName}>
              {u.displayName} ({u.role})
            </option>
          ))}
        </select>
      </div>

      {/* ========================================================= */}
      {/* 4. VISTA 1: CRONOGRAMA & LISTADO CON CONTROL Y SEGUIMIENTO*/}
      {/* ========================================================= */}
      {viewMode === "cronograma" && (
        <div className="space-y-3">
          {filteredTasks.length === 0 ? (
            <div className="py-12 text-center bg-white rounded-2xl border border-dashed border-slate-200 p-6 space-y-2">
              <ListTodo className="w-9 h-9 text-slate-300 mx-auto" />
              <h5 className="font-bold text-xs text-slate-700">No se encontraron tareas registradas</h5>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                {searchQuery || priorityFilter !== "todas" || statusFilter !== "todas" || assigneeFilter !== "todos"
                  ? "No hay tareas que coincidan con los filtros aplicados."
                  : "Este cliente aún no tiene tareas en el gestor de proyectos. Haz clic en 'Nueva Tarea' para crear una orden de trabajo."}
              </p>
              <button
                onClick={() => {
                  setTaskToEdit(null);
                  setIsModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 mt-2 bg-[#004ac6] text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Registrar Primera Tarea</span>
              </button>
            </div>
          ) : (
            filteredTasks.map((task) => {
              const isCompleted = !isTaskPending(task);
              const deadline = getDeadlineInfo(task.dueDate, isCompleted);
              const myTask = isAssignedToCurrentUser(task);
              const isCommentsOpen = !!expandedComments[task.id];
              const notes = task.notesThread || [];
              const totalChecklist = task.checklist ? task.checklist.length : 0;
              const completedChecklist = task.checklist ? task.checklist.filter((c) => c.done).length : 0;
              const checklistPercent = totalChecklist > 0 ? Math.round((completedChecklist / totalChecklist) * 100) : 0;

              // Trámites vinculados a esta tarea
              const taskTramites = regulatoryTramites.filter(
                (t) => (task.tramiteIds || []).includes(t.id) || t.taskId === task.id
              );

              // Priority pill style
              const priorityStyles: Record<string, { bg: string; text: string; border: string; dot: string }> = {
                urgente: { bg: "bg-rose-50", text: "text-rose-800", border: "border-rose-200", dot: "bg-rose-500 animate-ping" },
                alta: { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200", dot: "bg-amber-500" },
                media: { bg: "bg-sky-50", text: "text-sky-800", border: "border-sky-200", dot: "bg-sky-500" },
                baja: { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200", dot: "bg-slate-400" },
              };
              const pStyle = priorityStyles[task.priority] || priorityStyles.media;

              // Phase definition
              const taskColDef = currentColumns.find((c) => c.id === task.column);

              return (
                <div
                  key={task.id}
                  className={`bg-white rounded-2xl border transition-all shadow-2xs hover:shadow-xs overflow-hidden ${
                    myTask && !isCompleted
                      ? "border-amber-300 ring-1 ring-amber-200"
                      : isCompleted
                      ? "border-slate-200 bg-slate-50/40 opacity-90"
                      : "border-slate-200"
                  }`}
                >
                  {/* Card Header: Priority, Title, Deadline & Actions */}
                  <div className="p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Priority Pill */}
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${pStyle.bg} ${pStyle.text} ${pStyle.border}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${pStyle.dot}`} />
                          Prioridad: {task.priority}
                        </span>

                        {/* Deadline / Cronograma Semáforo */}
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${deadline.color}`}
                        >
                          <Calendar className="w-3 h-3" />
                          <span>{deadline.label}</span>
                        </span>

                        {/* Is assigned to logged user */}
                        {myTask && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#004ac6] text-white">
                            <User className="w-3 h-3" />
                            A tu cargo
                          </span>
                        )}

                        {/* Project Badge */}
                        {task.projectName && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-[#004ac6] border border-blue-200">
                            <Briefcase className="w-3 h-3" />
                            <span>{task.projectName}</span>
                          </span>
                        )}

                        {/* Trámites Vinculados Badge */}
                        {taskTramites.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <FileText className="w-3 h-3" />
                            <span>{taskTramites.length} {taskTramites.length === 1 ? "Trámite" : "Trámites"}</span>
                          </span>
                        )}
                      </div>

                      {/* Top Action Buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setTaskToEdit(task);
                            setIsModalOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-[#004ac6] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Editar Tarea Completa"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTask(task)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Eliminar Tarea"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Task Title & Description */}
                    <div>
                      <h4
                        onClick={() => {
                          setTaskToEdit(task);
                          setIsModalOpen(true);
                        }}
                        className="text-sm font-bold text-slate-900 hover:text-[#004ac6] transition-colors cursor-pointer"
                      >
                        {task.title}
                      </h4>
                      {task.description && (
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                          {task.description}
                        </p>
                      )}
                    </div>

                    {/* Technical Meta Grid: Fechas de Inicio y Fin, Responsable, Estado de Fase */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50/80 rounded-xl border border-slate-200/70 text-xs">
                      {/* Fechas / Cronograma */}
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">
                          Cronograma Fechas
                        </span>
                        <div className="flex items-center gap-1 text-slate-700 font-medium">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{task.startDate || "Inicio"}</span>
                          <span className="text-slate-400">→</span>
                          <strong className={deadline.isOverdue ? "text-rose-600" : "text-slate-900"}>
                            {task.dueDate}
                          </strong>
                        </div>
                      </div>

                      {/* Equipo a Cargo */}
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">
                          Equipo / Responsable
                        </span>
                        <div className="flex items-center gap-1.5 text-slate-800 font-semibold truncate">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{task.assignedTo || "Sin asignar"}</span>
                        </div>
                      </div>

                      {/* Estado / Fase Selector */}
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">
                          Estado de la Tarea
                        </span>
                        <select
                          value={task.column}
                          onChange={(e) => handleQuickPhaseChange(task.id, e.target.value as ProjectKanbanColumn)}
                          className="w-full text-[11px] font-bold px-2 py-1 rounded-lg border border-slate-300 bg-white text-slate-800 cursor-pointer focus:outline-hidden focus:border-[#004ac6]"
                        >
                          {currentColumns.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Trámites Regulatorios / Institucionales Vinculados */}
                    {taskTramites.length > 0 && (
                      <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-bold text-indigo-900">
                          <span className="flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Trámites Regulatorios / Institucionales Vinculados</span>
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {taskTramites.map((trm) => (
                            <div
                              key={trm.id}
                              className="bg-white p-2.5 rounded-lg border border-indigo-100 flex items-center justify-between gap-2 shadow-2xs text-[11px]"
                            >
                              <div className="min-w-0">
                                <span className="font-mono font-bold text-[#004ac6] block truncate">
                                  {trm.documentNumber}
                                </span>
                                <span className="text-[10px] text-slate-600 truncate block font-medium">
                                  {trm.reason}
                                </span>
                                <span className="text-[9px] text-slate-400 block">
                                  {trm.entity.split("(")[0].trim()} • {trm.submissionDate}
                                </span>
                              </div>
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 uppercase shrink-0">
                                {trm.dynamicStatus.replace("_", " ")}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Subtareas Checklist (si existen) */}
                    {totalChecklist > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-xs text-slate-600 font-bold">
                          <span className="flex items-center gap-1">
                            <CheckSquare className="w-3.5 h-3.5 text-[#004ac6]" />
                            Subtareas Verificadas
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                          {task.checklist.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleToggleChecklist(task, item.id)}
                              className="flex items-start gap-2 p-1.5 rounded-lg hover:bg-slate-50 text-left transition-colors cursor-pointer group"
                            >
                              {item.done ? (
                                <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-300 group-hover:text-slate-400 shrink-0 mt-0.5" />
                              )}
                              <span
                                className={`text-[11px] leading-snug ${
                                  item.done ? "line-through text-slate-400" : "text-slate-700"
                                }`}
                              >
                                {item.text}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ========================================================= */}
                  {/* COMUNICACIÓN & SEGUIMIENTO: HISTORIAL DE NOTAS & BITÁCORA */}
                  {/* ========================================================= */}
                  <div className="border-t border-slate-100 bg-[#f8f9ff]/50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedComments((prev) => ({ ...prev, [task.id]: !prev[task.id] }))
                        }
                        className="flex items-center gap-1.5 text-xs font-bold text-[#004ac6] hover:text-[#003ca0] transition-colors cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Comentarios de Control & Seguimiento</span>
                        {isCommentsOpen ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {notes.length > 0 && !isCommentsOpen && (
                        <span className="text-[11px] text-slate-500 italic truncate max-w-xs">
                          Último: {notes[0].content}
                        </span>
                      )}
                    </div>

                    {/* Comments Thread Accordion */}
                    {isCommentsOpen && (
                      <div className="space-y-3 pt-1">
                        {notes.length === 0 ? (
                          <p className="text-[11px] text-slate-400 italic">
                            Sin notas de seguimiento registradas. Agrega un comentario a continuación.
                          </p>
                        ) : (
                          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                            {notes.map((note) => (
                              <div
                                key={note.id}
                                className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1"
                              >
                                <div className="flex items-center justify-between text-[10px]">
                                  <div className="flex items-center gap-1.5">
                                    <strong className="text-slate-800">{note.authorName}</strong>
                                    {note.authorRole && (
                                      <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-bold uppercase text-[9px]">
                                        {note.authorRole}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-slate-400 font-mono">
                                    {note.createdAt ? new Date(note.createdAt).toLocaleString("es-EC", { dateStyle: "short", timeStyle: "short" }) : ""}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                                  {note.content}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Direct Comment Input */}
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="text"
                            placeholder="Escribe un comentario de control y seguimiento..."
                            value={newCommentInputs[task.id] || ""}
                            onChange={(e) =>
                              setNewCommentInputs((prev) => ({ ...prev, [task.id]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleAddComment(task.id);
                              }
                            }}
                            className="flex-1 text-xs px-3 py-2 bg-white rounded-xl border border-slate-300 focus:outline-hidden focus:border-[#004ac6] transition-all"
                          />
                          <button
                            type="button"
                            disabled={submittingCommentId === task.id || !(newCommentInputs[task.id] || "").trim()}
                            onClick={() => handleAddComment(task.id)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-[#004ac6] hover:bg-[#003ca0] text-white rounded-xl text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Enviar</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. VISTA 2: TABLERO KANBAN (DRAG & DROP)                  */}
      {/* ========================================================= */}
      {viewMode === "kanban" && (
        <div className={`grid grid-cols-1 ${activeFlow === "isp_tecnico" ? "md:grid-cols-3 lg:grid-cols-6" : "md:grid-cols-2 lg:grid-cols-4"} gap-3 overflow-x-auto pb-2 min-h-[420px]`}>
          {currentColumns.map((col) => {
            const colTasks = filteredTasks.filter((t) => t.column === col.id);
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
                      onClick={() => {
                        setTaskToEdit(null);
                        setModalDefaultCol(col.id);
                        setIsModalOpen(true);
                      }}
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
                      const notesCount = task.notesThread ? task.notesThread.length : 0;
                      const taskTramites = regulatoryTramites.filter(
                        (t) => (task.tramiteIds || []).includes(t.id) || t.taskId === task.id
                      );

                      return (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task.id)}
                          className="p-3 bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all cursor-grab active:cursor-grabbing space-y-2 group"
                        >
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
                                onClick={() => {
                                  setTaskToEdit(task);
                                  setIsModalOpen(true);
                                }}
                                className="text-slate-400 hover:text-[#004ac6] p-0.5 rounded cursor-pointer"
                                title="Editar Tarea"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteTask(task)}
                                className="text-slate-400 hover:text-rose-600 p-0.5 rounded cursor-pointer"
                                title="Eliminar Tarea"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          <div>
                            {task.projectName && (
                              <div className="text-[10px] font-bold text-[#004ac6] flex items-center gap-1 mb-1">
                                <Briefcase className="w-3 h-3 text-[#004ac6]" />
                                <span className="truncate">{task.projectName}</span>
                              </div>
                            )}

                            {taskTramites.length > 0 && (
                              <div className="flex items-center gap-1 mb-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  <FileText className="w-3 h-3" />
                                  <span>{taskTramites.length} {taskTramites.length === 1 ? "Trámite" : "Trámites"}</span>
                                </span>
                              </div>
                            )}
                            <h5
                              onClick={() => {
                                setTaskToEdit(task);
                                setIsModalOpen(true);
                              }}
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

                          {/* Checklist */}
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

                          {/* Footer */}
                          <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                            <span className="flex items-center gap-1 truncate max-w-[55%]">
                              <User className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">{task.assignedTo || "Equipo NOC"}</span>
                            </span>

                            <div className="flex items-center gap-1.5">
                              {notesCount > 0 && (
                                <span className="flex items-center gap-0.5 text-slate-500 font-bold">
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
      )}

      {/* Task Modal for Creation and Detailed Editing */}
      <ProjectTaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        taskToEdit={taskToEdit}
        defaultFlow={activeFlow}
        defaultColumn={modalDefaultCol}
        defaultClientId={client.id}
        defaultClientName={client.businessName}
        defaultProjectId={projectFilter !== "todos" ? projectFilter : undefined}
      />
    </div>
  );
}
