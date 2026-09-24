"use client";

import React, { useState, useMemo } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import {
  ClientProjectTask,
  ProjectBoardFlow,
  ProjectKanbanColumn,
} from "@/types";
import {
  ProjectTaskModal,
  ISP_FLOW_COLUMNS,
  GENERAL_FLOW_COLUMNS,
} from "./ProjectTaskModal";
import {
  Kanban,
  Plus,
  Search,
  Filter,
  Layers,
  Building2,
  Radio,
  Clock,
  User,
  CheckSquare,
  MessageSquare,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Trash2,
  RefreshCw,
  CheckCircle2,
  Calendar,
} from "lucide-react";

export function ProjectsManager() {
  const {
    clientProjects,
    systemUsers,
    moveProjectTaskColumn,
    deleteClientProjectTask,
    updateClientProjectTask,
  } = useApp();
  const { showSuccess, showConfirm } = useToast();

  // Active Flow View
  const [activeFlow, setActiveFlow] = useState<ProjectBoardFlow>("isp_tecnico");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"todos" | "cliente" | "infraestructura_interna">("todos");
  const [priorityFilter, setPriorityFilter] = useState<string>("todas");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("todos");

  // Drag and drop state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ProjectKanbanColumn | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<ClientProjectTask | null>(null);
  const [modalDefaultCol, setModalDefaultCol] = useState<ProjectKanbanColumn | undefined>(undefined);

  // Active Columns based on Flow
  const currentColumns = activeFlow === "isp_tecnico" ? ISP_FLOW_COLUMNS : GENERAL_FLOW_COLUMNS;

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return clientProjects.filter((task) => {
      // 1. Flow filter (if task has an explicit boardFlow, match it; if not, default to isp_tecnico)
      const taskFlow = task.boardFlow || "isp_tecnico";
      if (taskFlow !== activeFlow) return false;

      // 2. Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(query);
        const matchesDesc = (task.description || "").toLowerCase().includes(query);
        const matchesClient = (task.clientName || "").toLowerCase().includes(query);
        const matchesNode = (task.nodeName || "").toLowerCase().includes(query);
        const matchesAssignee = (task.assignedTo || "").toLowerCase().includes(query);
        if (!matchesTitle && !matchesDesc && !matchesClient && !matchesNode && !matchesAssignee) {
          return false;
        }
      }

      // 3. Type filter
      if (typeFilter !== "todos") {
        const actualType = task.type || (task.nodeId ? "infraestructura_interna" : "cliente");
        if (actualType !== typeFilter) return false;
      }

      // 4. Priority filter
      if (priorityFilter !== "todas" && task.priority !== priorityFilter) {
        return false;
      }

      // 5. Assignee filter
      if (assigneeFilter !== "todos" && task.assignedTo !== assigneeFilter) {
        return false;
      }

      return true;
    });
  }, [clientProjects, activeFlow, searchQuery, typeFilter, priorityFilter, assigneeFilter]);

  // Executive KPIs calculations
  const totalPlannedBudget = useMemo(() => {
    return clientProjects.reduce((acc, t) => acc + (t.estimatedBudget || 0), 0);
  }, [clientProjects]);

  const totalExecutedCost = useMemo(() => {
    return clientProjects.reduce((acc, t) => acc + (t.executedCost || 0), 0);
  }, [clientProjects]);

  const remainingBalance = totalPlannedBudget - totalExecutedCost;
  const isBudgetDeficit = remainingBalance < 0;

  const totalTasksCount = clientProjects.length;
  const completedTasksCount = clientProjects.filter(
    (t) => t.column === "completado" || t.column === "finalizado"
  ).length;

  // Drag and Drop handlers
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
        // Fallback error
      }
      setDraggedTaskId(null);
    }
  };

  // Quick column shift buttons
  const handleShiftColumn = async (task: ClientProjectTask, direction: "prev" | "next") => {
    const currentIndex = currentColumns.findIndex((c) => c.id === task.column);
    if (direction === "next" && currentIndex < currentColumns.length - 1) {
      await moveProjectTaskColumn(task.id, currentColumns[currentIndex + 1].id);
    } else if (direction === "prev" && currentIndex > 0) {
      await moveProjectTaskColumn(task.id, currentColumns[currentIndex - 1].id);
    }
  };

  // Delete task with confirmation
  const handleDeleteTask = (task: ClientProjectTask) => {
    showConfirm(
      "¿Eliminar Proyecto / Tarea?",
      `¿Deseas remover definitivamente "${task.title}" del tablero? Esta acción no se puede deshacer.`,
      async () => {
        try {
          await deleteClientProjectTask(task.id);
          showSuccess("Proyecto Eliminado", "La tarjeta fue removida del tablero.");
        } catch (err) {
          // Error
        }
      },
      "Eliminar Proyecto"
    );
  };

  // Open modal in create mode
  const handleOpenCreateModal = (defaultCol?: ProjectKanbanColumn) => {
    setTaskToEdit(null);
    setModalDefaultCol(defaultCol || (activeFlow === "isp_tecnico" ? "factibilidad" : "por_iniciar"));
    setIsModalOpen(true);
  };

  // Open modal in edit mode
  const handleOpenEditModal = (task: ClientProjectTask) => {
    setTaskToEdit(task);
    setIsModalOpen(true);
  };

  // List of distinct assignees for filter
  const distinctAssignees = useMemo(() => {
    const set = new Set<string>();
    clientProjects.forEach((t) => {
      if (t.assignedTo) set.add(t.assignedTo);
    });
    return Array.from(set);
  }, [clientProjects]);

  return (
    <div className="space-y-6">
      {/* 1. Executive Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-lumina-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#004ac6]/10 text-[#004ac6] flex items-center justify-center shrink-0 shadow-2xs">
            <Kanban className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              Gestión de Proyectos & Control de Obras
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Tablero Trello para despliegue de última milla FTTH, obras de ingeniería y ampliación de red troncal.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => handleOpenCreateModal()}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#004ac6] hover:bg-[#003ca0] text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Proyecto / Tarea</span>
          </button>
        </div>
      </div>

      {/* 2. Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Presupuesto Total */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-lumina-card flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Presupuesto Planificado
            </span>
            <div className="text-xl font-extrabold text-slate-900 tracking-tight">
              ${totalPlannedBudget.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-slate-400">Total asignado en obras activas</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#004ac6] flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 2: Costo Ejecutado */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-lumina-card flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Costo Real Ejecutado
            </span>
            <div className="text-xl font-extrabold text-slate-900 tracking-tight">
              ${totalExecutedCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-slate-400">Gastos devengados en cuadrillas</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 3: Margen Restante */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-lumina-card flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Balance / Margen Restante
            </span>
            <div className={`text-xl font-extrabold tracking-tight ${isBudgetDeficit ? "text-rose-600" : "text-emerald-700"}`}>
              ${remainingBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className={`text-[10px] font-bold ${isBudgetDeficit ? "text-rose-500" : "text-emerald-600"}`}>
              {isBudgetDeficit ? "Sobrecosto en ejecución" : "Superávit financiero"}
            </span>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isBudgetDeficit ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>
            {isBudgetDeficit ? <TrendingDown className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
          </div>
        </div>

        {/* KPI 4: Obras Completadas */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-lumina-card flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Obras Totales / Entregadas
            </span>
            <div className="text-xl font-extrabold text-slate-900 tracking-tight">
              {completedTasksCount} / {totalTasksCount}
            </div>
            <span className="text-[10px] text-slate-400">
              {totalTasksCount > 0 ? `${Math.round((completedTasksCount / totalTasksCount) * 100)}% de entrega global` : "Sin obras registradas"}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 3. Filter & Flow Selector Toolbar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-lumina-card space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Flow Segmented Control */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/60">
            <button
              onClick={() => setActiveFlow("isp_tecnico")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeFlow === "isp_tecnico"
                  ? "bg-white text-[#004ac6] shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Flujo Técnico ISP (6 Fases)</span>
            </button>

            <button
              onClick={() => setActiveFlow("general")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeFlow === "general"
                  ? "bg-white text-[#004ac6] shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Flujo General (4 Fases)</span>
            </button>
          </div>

          {/* Quick Counter */}
          <span className="text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            Mostrando {filteredTasks.length} proyectos en este flujo
          </span>
        </div>

        {/* Filter Inputs Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por título, cliente, nodo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-hidden focus:border-[#004ac6] transition-all"
            />
          </div>

          {/* Filter by Type */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-hidden focus:border-[#004ac6] transition-all"
          >
            <option value="todos">Todos los Tipos</option>
            <option value="cliente">Solo Clientes / Abonados</option>
            <option value="infraestructura_interna">Solo Infraestructura (POPs / Nodos)</option>
          </select>

          {/* Filter by Priority */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-hidden focus:border-[#004ac6] transition-all"
          >
            <option value="todas">Todas las Prioridades</option>
            <option value="urgente">Urgente</option>
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </select>

          {/* Filter by Assignee */}
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-hidden focus:border-[#004ac6] transition-all"
          >
            <option value="todos">Todos los Responsables</option>
            {distinctAssignees.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 4. Kanban Board Grid */}
      <div className={`grid grid-cols-1 ${activeFlow === "isp_tecnico" ? "md:grid-cols-3 lg:grid-cols-6" : "md:grid-cols-2 lg:grid-cols-4"} gap-3.5 items-start overflow-x-auto pb-4 select-none`}>
        {currentColumns.map((col) => {
          const colTasks = filteredTasks.filter((t) => t.column === col.id);
          const isDragTarget = dragOverColumn === col.id;

          return (
            <div
              key={col.id}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.id)}
              className={`rounded-2xl border flex flex-col p-3 transition-all min-h-[500px] ${
                isDragTarget
                  ? "bg-blue-50/80 border-[#004ac6] ring-2 ring-[#004ac6]/30 shadow-md"
                  : "bg-slate-50/70 border-slate-200/80 hover:border-slate-300"
              }`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/80 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2.5 h-2.5 rounded-full ${col.dot}`} />
                  <span className="font-bold text-slate-800 text-xs truncate" title={col.label}>
                    {col.shortLabel}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold bg-white text-slate-700 px-2 py-0.5 rounded-full border border-slate-200 shadow-2xs">
                    {colTasks.length}
                  </span>
                  <button
                    onClick={() => handleOpenCreateModal(col.id)}
                    className="p-1 text-slate-400 hover:text-[#004ac6] hover:bg-white rounded-lg transition-colors cursor-pointer"
                    title={`Añadir tarea a ${col.shortLabel}`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Tasks List */}
              <div className="space-y-3 flex-1 overflow-y-auto">
                {colTasks.length === 0 ? (
                  <div className="h-32 flex flex-col items-center justify-center border-2 border-dashed border-slate-200/90 rounded-xl text-center p-3 text-slate-400">
                    <span className="text-[11px] font-medium">Soltar tarjeta aquí</span>
                    <button
                      onClick={() => handleOpenCreateModal(col.id)}
                      className="mt-1 text-[10px] font-bold text-[#004ac6] hover:underline cursor-pointer"
                    >
                      + Crear tarea
                    </button>
                  </div>
                ) : (
                  colTasks.map((task) => {
                    const checklistTotal = task.checklist ? task.checklist.length : 0;
                    const checklistDone = task.checklist ? task.checklist.filter((c) => c.done).length : 0;
                    const checklistPercent = checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 0;
                    const isTaskOverdue = new Date(task.dueDate).getTime() < Date.now() && task.column !== "completado" && task.column !== "finalizado";
                    const isTaskOverBudget = (task.executedCost || 0) > (task.estimatedBudget || 0) && (task.estimatedBudget || 0) > 0;
                    const notesCount = task.notesThread ? task.notesThread.length : 0;
                    const isInternal = task.type === "infraestructura_interna" || (!task.clientId && !!task.nodeId);

                    return (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-2xs hover:shadow-md transition-all cursor-grab active:cursor-grabbing space-y-2.5 group relative"
                      >
                        {/* Top Metadata Row: Priority & Type */}
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                              task.priority === "urgente"
                                ? "bg-rose-100 text-rose-800 border border-rose-200"
                                : task.priority === "alta"
                                ? "bg-amber-100 text-amber-800 border border-amber-200"
                                : task.priority === "media"
                                ? "bg-blue-100 text-blue-800 border border-blue-200"
                                : "bg-slate-100 text-slate-700 border border-slate-200"
                            }`}
                          >
                            {task.priority}
                          </span>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleOpenEditModal(task)}
                              className="p-1 text-slate-400 hover:text-[#004ac6] hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                              title="Editar Ficha"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteTask(task)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                              title="Eliminar Tarea"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Entity Linking Badge */}
                        <div className="flex items-center gap-1.5 text-[10px] font-bold truncate">
                          {isInternal ? (
                            <span className="flex items-center gap-1 text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100 truncate max-w-full">
                              <Radio className="w-3 h-3 shrink-0" />
                              <span className="truncate">{task.nodeName || "POP Interno"}</span>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-100 truncate max-w-full">
                              <Building2 className="w-3 h-3 shrink-0" />
                              <span className="truncate">{task.clientName || "Cliente Asignado"}</span>
                            </span>
                          )}
                        </div>

                        {/* Title and Short Description */}
                        <div>
                          <h4
                            onClick={() => handleOpenEditModal(task)}
                            className="font-bold text-xs text-slate-900 leading-snug hover:text-[#004ac6] transition-colors cursor-pointer"
                          >
                            {task.title}
                          </h4>
                          {task.description && (
                            <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-normal">
                              {task.description}
                            </p>
                          )}
                        </div>

                        {/* Checklist progress bar (if any checklist exists) */}
                        {checklistTotal > 0 && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-600">
                              <span className="flex items-center gap-1">
                                <CheckSquare className="w-3 h-3 text-slate-400" />
                                Subtareas
                              </span>
                              <span>
                                {checklistDone}/{checklistTotal} ({checklistPercent}%)
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

                        {/* Financial Pill (if budget or cost defined) */}
                        {(task.estimatedBudget !== undefined || task.executedCost !== undefined) && (
                          <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50 border border-slate-200/70 text-[10px]">
                            <span className="text-slate-500 font-semibold flex items-center gap-1">
                              <DollarSign className="w-3 h-3 text-slate-400" />
                              Costo / Presup.
                            </span>
                            <span className={`font-bold ${isTaskOverBudget ? "text-rose-600" : "text-slate-800"}`}>
                              ${task.executedCost || 0} / ${task.estimatedBudget || 0}
                            </span>
                          </div>
                        )}

                        {/* Card Footer: Assignee & Due Date */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                          <div className="flex items-center gap-1 truncate max-w-[55%]">
                            <User className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{task.assignedTo || "Cuadrilla NOC"}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            {notesCount > 0 && (
                              <span className="flex items-center gap-0.5 text-slate-500 font-bold" title={`${notesCount} notas registradas`}>
                                <MessageSquare className="w-3 h-3 text-slate-400" />
                                {notesCount}
                              </span>
                            )}
                            <div className={`flex items-center gap-1 font-semibold ${isTaskOverdue ? "text-rose-600 font-bold" : "text-slate-500"}`}>
                              <Clock className="w-3 h-3 shrink-0" />
                              <span>{task.dueDate.split("-").slice(1).join("/")}</span>
                            </div>
                          </div>
                        </div>

                        {/* Quick Column Shift Arrows */}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-100/60 opacity-60 hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => handleShiftColumn(task, "prev")}
                            disabled={currentColumns.findIndex((c) => c.id === task.column) === 0}
                            className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
                            title="Mover a etapa anterior"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>

                          <span className="text-[9px] text-slate-400 font-medium">Arrastrar o mover</span>

                          <button
                            type="button"
                            onClick={() => handleShiftColumn(task, "next")}
                            disabled={currentColumns.findIndex((c) => c.id === task.column) === currentColumns.length - 1}
                            className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
                            title="Mover a etapa siguiente"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
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

      {/* Project Task Modal */}
      <ProjectTaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        taskToEdit={taskToEdit}
        defaultFlow={activeFlow}
        defaultColumn={modalDefaultCol}
      />
    </div>
  );
}
