"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import {
  ClientProjectTask,
  ProjectBoardFlow,
  ProjectKanbanColumn,
  ProjectChecklistItem,
  ProjectNoteItem,
} from "@/types";
import {
  X,
  Kanban,
  Building2,
  Radio,
  Calendar,
  DollarSign,
  CheckSquare,
  MessageSquare,
  Plus,
  Trash2,
  Clock,
  User,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Layers,
  Send,
} from "lucide-react";

export const ISP_FLOW_COLUMNS: { id: ProjectKanbanColumn; label: string; shortLabel: string; color: string; badge: string; dot: string }[] = [
  { id: "factibilidad", label: "1. Factibilidad Técnica", shortLabel: "Factibilidad", color: "border-slate-300 bg-slate-50 text-slate-800", badge: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-400" },
  { id: "tendido_fibra", label: "2. Tendido de Fibra", shortLabel: "Tendido Fibra", color: "border-sky-300 bg-sky-50 text-sky-800", badge: "bg-sky-100 text-sky-700 border-sky-200", dot: "bg-sky-500" },
  { id: "fusion_splitters", label: "3. Fusión & Splitters", shortLabel: "Fusión / Mufas", color: "border-indigo-300 bg-indigo-50 text-indigo-800", badge: "bg-indigo-100 text-indigo-700 border-indigo-200", dot: "bg-indigo-500" },
  { id: "instalacion_ont", label: "4. Instalación de ONT", shortLabel: "Instalación ONT", color: "border-purple-300 bg-purple-50 text-purple-800", badge: "bg-purple-100 text-purple-700 border-purple-200", dot: "bg-purple-500" },
  { id: "pruebas_homologacion", label: "5. Pruebas & Homologación", shortLabel: "Pruebas SLA", color: "border-amber-300 bg-amber-50 text-amber-800", badge: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  { id: "completado", label: "6. Entregado & Operativo", shortLabel: "Operativo", color: "border-emerald-300 bg-emerald-50 text-emerald-800", badge: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
];

export const GENERAL_FLOW_COLUMNS: { id: ProjectKanbanColumn; label: string; shortLabel: string; color: string; badge: string; dot: string }[] = [
  { id: "por_iniciar", label: "1. Por Iniciar", shortLabel: "Por Iniciar", color: "border-slate-300 bg-slate-50 text-slate-800", badge: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-400" },
  { id: "en_progreso", label: "2. En Progreso", shortLabel: "En Progreso", color: "border-blue-300 bg-blue-50 text-blue-800", badge: "bg-blue-100 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  { id: "en_pausa", label: "3. En Pausa / Revisión", shortLabel: "En Pausa", color: "border-amber-300 bg-amber-50 text-amber-800", badge: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  { id: "finalizado", label: "4. Finalizado", shortLabel: "Finalizado", color: "border-emerald-300 bg-emerald-50 text-emerald-800", badge: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
];

interface ProjectTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskToEdit?: ClientProjectTask | null;
  defaultFlow?: ProjectBoardFlow;
  defaultColumn?: ProjectKanbanColumn;
  defaultClientId?: string;
  defaultClientName?: string;
}

export function ProjectTaskModal({
  isOpen,
  onClose,
  taskToEdit,
  defaultFlow = "isp_tecnico",
  defaultColumn,
  defaultClientId,
  defaultClientName,
}: ProjectTaskModalProps) {
  const {
    clients,
    nodes,
    systemUsers,
    currentUser,
    addClientProjectTask,
    updateClientProjectTask,
    addProjectTaskNote,
  } = useApp();
  const { showSuccess, showError } = useToast();

  const [activeTab, setActiveTab] = useState<"general" | "presupuesto" | "checklist" | "bitacora">("general");

  // Form states
  const [projectType, setProjectType] = useState<"cliente" | "infraestructura_interna">("cliente");
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [nodeId, setNodeId] = useState("");
  const [nodeName, setNodeName] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [boardFlow, setBoardFlow] = useState<ProjectBoardFlow>(defaultFlow);
  const [column, setColumn] = useState<ProjectKanbanColumn>("factibilidad");
  const [priority, setPriority] = useState<ClientProjectTask["priority"]>("media");
  const [assignedTo, setAssignedTo] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 86400000 * 7).toISOString().split("T")[0]);

  // Financial fields
  const [estimatedBudget, setEstimatedBudget] = useState<number>(0);
  const [executedCost, setExecutedCost] = useState<number>(0);

  // Checklists
  const [checklist, setChecklist] = useState<ProjectChecklistItem[]>([]);
  const [newChecklistText, setNewChecklistText] = useState("");

  // Notes Thread
  const [notesThread, setNotesThread] = useState<ProjectNoteItem[]>([]);
  const [newNoteContent, setNewNoteContent] = useState("");

  // Synchronize on open or change
  useEffect(() => {
    if (!isOpen) return;

    if (taskToEdit) {
      setProjectType(taskToEdit.type || (taskToEdit.nodeId ? "infraestructura_interna" : "cliente"));
      setClientId(taskToEdit.clientId || "");
      setClientName(taskToEdit.clientName || "");
      setNodeId(taskToEdit.nodeId || "");
      setNodeName(taskToEdit.nodeName || "");

      setTitle(taskToEdit.title || "");
      setDescription(taskToEdit.description || "");
      const flow = taskToEdit.boardFlow || "isp_tecnico";
      setBoardFlow(flow);
      setColumn(taskToEdit.column);
      setPriority(taskToEdit.priority || "media");
      setAssignedTo(taskToEdit.assignedTo || "");
      setAssignedToId(taskToEdit.assignedToId || "");
      setStartDate(taskToEdit.startDate || taskToEdit.createdAt.split("T")[0]);
      setDueDate(taskToEdit.dueDate || new Date(Date.now() + 86400000 * 7).toISOString().split("T")[0]);

      setEstimatedBudget(taskToEdit.estimatedBudget || 0);
      setExecutedCost(taskToEdit.executedCost || 0);
      setChecklist(taskToEdit.checklist ? [...taskToEdit.checklist] : []);
      setNotesThread(taskToEdit.notesThread ? [...taskToEdit.notesThread] : []);
    } else {
      // New task default values
      const initialFlow = defaultFlow;
      setBoardFlow(initialFlow);
      if (defaultClientId) {
        setProjectType("cliente");
        setClientId(defaultClientId);
        setClientName(defaultClientName || clients.find((c) => c.id === defaultClientId)?.businessName || "");
      } else {
        setProjectType("cliente");
        const firstClient = clients[0];
        if (firstClient) {
          setClientId(firstClient.id);
          setClientName(firstClient.businessName);
        }
      }

      if (nodes.length > 0) {
        setNodeId(nodes[0].id);
        setNodeName(nodes[0].name);
      }

      setTitle("");
      setDescription("");
      const initialCol = defaultColumn || (initialFlow === "isp_tecnico" ? "factibilidad" : "por_iniciar");
      setColumn(initialCol);
      setPriority("media");

      const defaultUser = systemUsers.find((u) => u.role === "tecnico") || systemUsers[0];
      setAssignedTo(defaultUser ? defaultUser.displayName : "Cuadrilla NOC");
      setAssignedToId(defaultUser ? defaultUser.uid : "");

      setStartDate(new Date().toISOString().split("T")[0]);
      setDueDate(new Date(Date.now() + 86400000 * 7).toISOString().split("T")[0]);
      setEstimatedBudget(0);
      setExecutedCost(0);
      setChecklist([]);
      setNotesThread([]);
    }
    setActiveTab("general");
    setNewChecklistText("");
    setNewNoteContent("");
  }, [isOpen, taskToEdit, defaultFlow, defaultColumn, defaultClientId, defaultClientName, clients, nodes, systemUsers]);

  if (!isOpen) return null;

  // Handle flow switch and adapt column
  const handleFlowSwitch = (newFlow: ProjectBoardFlow) => {
    setBoardFlow(newFlow);
    if (newFlow === "isp_tecnico") {
      if (!ISP_FLOW_COLUMNS.some((c) => c.id === column)) {
        setColumn("factibilidad");
      }
    } else {
      if (!GENERAL_FLOW_COLUMNS.some((c) => c.id === column)) {
        setColumn("por_iniciar");
      }
    }
  };

  // Checklist actions
  const handleAddChecklistItem = () => {
    const trimmed = newChecklistText.trim();
    if (!trimmed) return;
    const newItem: ProjectChecklistItem = {
      id: "chk-" + Date.now(),
      text: trimmed,
      done: false,
    };
    setChecklist([...checklist, newItem]);
    setNewChecklistText("");
  };

  const handleToggleChecklistItem = (chkId: string) => {
    setChecklist(
      checklist.map((c) => (c.id === chkId ? { ...c, done: !c.done } : c))
    );
  };

  const handleRemoveChecklistItem = (chkId: string) => {
    setChecklist(checklist.filter((c) => c.id !== chkId));
  };

  // Notes Thread actions
  const handleAddNoteImmediate = async () => {
    const trimmed = newNoteContent.trim();
    if (!trimmed) return;

    const newNote: ProjectNoteItem = {
      id: "nt-" + Date.now(),
      authorName: currentUser.displayName || "Usuario NOC",
      authorRole: currentUser.role ? currentUser.role.toUpperCase() : "STAFF",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    setNotesThread([newNote, ...notesThread]);
    setNewNoteContent("");

    if (taskToEdit) {
      await addProjectTaskNote(taskToEdit.id, trimmed);
    }
  };

  // Calculations
  const completedChecklistCount = checklist.filter((c) => c.done).length;
  const checklistProgress = checklist.length > 0 ? Math.round((completedChecklistCount / checklist.length) * 100) : 0;

  const budgetRemaining = (Number(estimatedBudget) || 0) - (Number(executedCost) || 0);
  const budgetUsagePercent = estimatedBudget > 0 ? Math.min(100, Math.round((executedCost / estimatedBudget) * 100)) : 0;
  const isOverBudget = executedCost > estimatedBudget && estimatedBudget > 0;

  // Save handler
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showError("Campo Obligatorio", "Por favor ingresa el título del proyecto o tarea.");
      setActiveTab("general");
      return;
    }

    try {
      const selectedClient = projectType === "cliente" ? clients.find((c) => c.id === clientId) : undefined;
      const selectedNode = projectType === "infraestructura_interna" ? nodes.find((n) => n.id === nodeId) : undefined;

      const taskDataPayload = {
        type: projectType,
        clientId: projectType === "cliente" ? clientId : undefined,
        clientName: projectType === "cliente" ? (selectedClient?.businessName || clientName || "Cliente No Asignado") : undefined,
        nodeId: projectType === "infraestructura_interna" ? nodeId : undefined,
        nodeName: projectType === "infraestructura_interna" ? (selectedNode?.name || nodeName || "POP / Nodo Interno") : undefined,
        title: title.trim(),
        description: description.trim(),
        boardFlow,
        column,
        priority,
        assignedTo: assignedTo.trim() || "Cuadrilla NOC",
        assignedToId: assignedToId || undefined,
        startDate,
        dueDate,
        estimatedBudget: Number(estimatedBudget) || 0,
        executedCost: Number(executedCost) || 0,
        checklist,
        notesThread,
      };

      if (taskToEdit) {
        await updateClientProjectTask(taskToEdit.id, taskDataPayload);
        showSuccess("Proyecto Actualizado", `Los cambios en "${title}" se han guardado.`);
      } else {
        await addClientProjectTask(taskDataPayload);
        showSuccess("Proyecto Creado", `"${title}" ha sido incorporado al tablero Kanban.`);
      }
      onClose();
    } catch (err) {
      showError("Error al Guardar", err instanceof Error ? err.message : "No se pudo procesar la solicitud.");
    }
  };

  const columnsList = boardFlow === "isp_tecnico" ? ISP_FLOW_COLUMNS : GENERAL_FLOW_COLUMNS;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#004ac6]/10 text-[#004ac6] flex items-center justify-center">
              <Kanban className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-tight">
                {taskToEdit ? "Ficha de Proyecto / Tarea" : "Nuevo Proyecto & Control de Obra"}
              </h3>
              <p className="text-xs text-slate-500">
                {taskToEdit ? `ID: ${taskToEdit.id} · Flujo: ${boardFlow === "isp_tecnico" ? "Técnico ISP" : "General"}` : "Gestión integral de despliegue, costos y bitácora"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-slate-100 bg-white">
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === "general"
                ? "border-[#004ac6] text-[#004ac6]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Datos & Asignación</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("presupuesto")}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === "presupuesto"
                ? "border-[#004ac6] text-[#004ac6]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Presupuesto & Costos</span>
            {estimatedBudget > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${isOverBudget ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                ${executedCost} / ${estimatedBudget}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("checklist")}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === "checklist"
                ? "border-[#004ac6] text-[#004ac6]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>Checklist</span>
            {checklist.length > 0 && (
              <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-full font-bold">
                {completedChecklistCount}/{checklist.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("bitacora")}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === "bitacora"
                ? "border-[#004ac6] text-[#004ac6]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Bitácora</span>
            {notesThread.length > 0 && (
              <span className="text-[10px] bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded-full font-bold">
                {notesThread.length}
              </span>
            )}
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* TAB 1: DATOS & ASIGNACIÓN */}
          {activeTab === "general" && (
            <div className="space-y-4">
              {/* Type and Workflow Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                    Vinculación del Proyecto
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setProjectType("cliente")}
                      className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        projectType === "cliente"
                          ? "bg-white border-[#004ac6] text-[#004ac6] shadow-2xs"
                          : "bg-transparent border-slate-200 text-slate-600 hover:bg-white"
                      }`}
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span>Abonado / Cliente</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setProjectType("infraestructura_interna")}
                      className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        projectType === "infraestructura_interna"
                          ? "bg-white border-[#004ac6] text-[#004ac6] shadow-2xs"
                          : "bg-transparent border-slate-200 text-slate-600 hover:bg-white"
                      }`}
                    >
                      <Radio className="w-3.5 h-3.5" />
                      <span>POP / Infraestructura</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                    Flujo de Tablero Kanban
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleFlowSwitch("isp_tecnico")}
                      className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        boardFlow === "isp_tecnico"
                          ? "bg-white border-[#004ac6] text-[#004ac6] shadow-2xs"
                          : "bg-transparent border-slate-200 text-slate-600 hover:bg-white"
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Flujo ISP (6 Fases)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleFlowSwitch("general")}
                      className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        boardFlow === "general"
                          ? "bg-white border-[#004ac6] text-[#004ac6] shadow-2xs"
                          : "bg-transparent border-slate-200 text-slate-600 hover:bg-white"
                      }`}
                    >
                      <Kanban className="w-3.5 h-3.5" />
                      <span>General (4 Fases)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Target Entity Selector */}
              {projectType === "cliente" ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cliente / Abonado Asignado <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={clientId}
                    onChange={(e) => {
                      setClientId(e.target.value);
                      const c = clients.find((cl) => cl.id === e.target.value);
                      if (c) setClientName(c.businessName);
                    }}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-[#004ac6] focus:ring-1 focus:ring-[#004ac6] transition-all"
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.businessName} ({c.identification})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nodo / POP de Infraestructura <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={nodeId}
                    onChange={(e) => {
                      setNodeId(e.target.value);
                      const n = nodes.find((no) => no.id === e.target.value);
                      if (n) setNodeName(n.name);
                    }}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-[#004ac6] focus:ring-1 focus:ring-[#004ac6] transition-all"
                  >
                    {nodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name} ({n.location}) · {n.routerModel || "Carrier Router"}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Title & Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nombre del Proyecto / Tarea de Obra <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Tendido e interconexión troncal 10G o Fusión splitter 1:8"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-[#004ac6] focus:ring-1 focus:ring-[#004ac6] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Descripción Detallada & Especificaciones
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalles técnicos, alcances, metrajes de fibra, atenuaciones esperadas o requerimientos especiales..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-[#004ac6] focus:ring-1 focus:ring-[#004ac6] transition-all"
                />
              </div>

              {/* Column, Priority, Assignee */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Fase / Columna Inicial
                  </label>
                  <select
                    value={column}
                    onChange={(e) => setColumn(e.target.value as ProjectKanbanColumn)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-[#004ac6] focus:ring-1 focus:ring-[#004ac6] transition-all"
                  >
                    {columnsList.map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Prioridad
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as ClientProjectTask["priority"])}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-[#004ac6] focus:ring-1 focus:ring-[#004ac6] transition-all"
                  >
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Técnico / Responsable
                  </label>
                  <select
                    value={assignedToId}
                    onChange={(e) => {
                      setAssignedToId(e.target.value);
                      const u = systemUsers.find((usr) => usr.uid === e.target.value);
                      if (u) setAssignedTo(u.displayName);
                    }}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-[#004ac6] focus:ring-1 focus:ring-[#004ac6] transition-all"
                  >
                    {systemUsers.map((u) => (
                      <option key={u.uid} value={u.uid}>
                        {u.displayName} ({u.role.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Fecha de Inicio Planificada
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full text-xs px-3 py-2 pl-9 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-[#004ac6] focus:ring-1 focus:ring-[#004ac6] transition-all"
                    />
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Fecha Límite / Entrega
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full text-xs px-3 py-2 pl-9 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-[#004ac6] focus:ring-1 focus:ring-[#004ac6] transition-all"
                    />
                    <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PRESUPUESTO & COSTOS */}
          {activeTab === "presupuesto" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                  <label className="block text-xs font-bold text-slate-800">
                    Presupuesto Planificado ($ USD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-sm font-bold text-slate-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={estimatedBudget}
                      onChange={(e) => setEstimatedBudget(parseFloat(e.target.value) || 0)}
                      className="w-full text-sm font-bold pl-7 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:border-[#004ac6]"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500">Monto total estimado para materiales, mano de obra y viáticos.</p>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                  <label className="block text-xs font-bold text-slate-800">
                    Costo Real Ejecutado ($ USD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-sm font-bold text-slate-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={executedCost}
                      onChange={(e) => setExecutedCost(parseFloat(e.target.value) || 0)}
                      className="w-full text-sm font-bold pl-7 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:border-[#004ac6]"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500">Gasto real acumulado hasta la fecha en esta obra.</p>
                </div>
              </div>

              {/* Financial Balance Summary Card */}
              <div className={`p-4 rounded-xl border transition-all ${isOverBudget ? "bg-rose-50 border-rose-200" : "bg-emerald-50/70 border-emerald-200"}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {isOverBudget ? (
                      <TrendingDown className="w-5 h-5 text-rose-600" />
                    ) : (
                      <TrendingUp className="w-5 h-5 text-emerald-600" />
                    )}
                    <span className="text-xs font-bold text-slate-800">
                      Balance Presupuestario
                    </span>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isOverBudget ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                    {isOverBudget ? "Sobrecosto Detectado" : "Dentro de Presupuesto"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-200/60 text-center">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500">Presupuesto</span>
                    <p className="text-sm font-extrabold text-slate-900">${estimatedBudget.toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500">Ejecutado</span>
                    <p className="text-sm font-extrabold text-slate-900">${executedCost.toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500">Margen Restante</span>
                    <p className={`text-sm font-extrabold ${budgetRemaining < 0 ? "text-rose-600" : "text-emerald-700"}`}>
                      ${budgetRemaining.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-1">
                    <span>Consumo del Presupuesto</span>
                    <span>{budgetUsagePercent}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        isOverBudget ? "bg-rose-600" : budgetUsagePercent > 80 ? "bg-amber-500" : "bg-emerald-500"
                      }`}
                      style={{ width: `${budgetUsagePercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CHECKLIST DE SUBTAREAS */}
          {activeTab === "checklist" && (
            <div className="space-y-4">
              {/* Progress bar */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Progreso de Verificación
                  </span>
                  <span>
                    {completedChecklistCount} de {checklist.length} ({checklistProgress}%)
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-2 rounded-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${checklistProgress}%` }}
                  />
                </div>
              </div>

              {/* Add checklist input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Agregar nuevo ítem de verificación o hito..."
                  value={newChecklistText}
                  onChange={(e) => setNewChecklistText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddChecklistItem();
                    }
                  }}
                  className="flex-1 text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-[#004ac6]"
                />
                <button
                  type="button"
                  onClick={handleAddChecklistItem}
                  className="px-3.5 py-2 bg-[#004ac6] hover:bg-[#003ca0] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Añadir</span>
                </button>
              </div>

              {/* Items List */}
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {checklist.length === 0 ? (
                  <div className="py-8 text-center border-2 border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
                    No hay subtareas registradas. Agrega una arriba.
                  </div>
                ) : (
                  checklist.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-slate-200/80 bg-white hover:bg-slate-50 transition-colors"
                    >
                      <label className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.done}
                          onChange={() => handleToggleChecklistItem(item.id)}
                          className="w-4 h-4 rounded-sm border-slate-300 text-[#004ac6] focus:ring-[#004ac6]"
                        />
                        <span className={`text-xs font-medium truncate ${item.done ? "line-through text-slate-400" : "text-slate-800"}`}>
                          {item.text}
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={() => handleRemoveChecklistItem(item.id)}
                        className="text-slate-300 hover:text-rose-600 p-1 rounded-sm transition-colors cursor-pointer"
                        title="Eliminar ítem"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 4: BITÁCORA DE NOTAS */}
          {activeTab === "bitacora" && (
            <div className="space-y-4">
              {/* New note input */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                <label className="block text-xs font-bold text-slate-800">
                  Agregar Nota / Reporte de Cuadrilla
                </label>
                <div className="flex gap-2">
                  <textarea
                    rows={2}
                    placeholder="Escribe novedades de campo, contingencias climáticas, mediciones ópticas..."
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    className="flex-1 text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-[#004ac6]"
                  />
                  <button
                    type="button"
                    onClick={handleAddNoteImmediate}
                    disabled={!newNoteContent.trim()}
                    className="px-4 py-2 bg-[#004ac6] disabled:bg-slate-300 hover:bg-[#003ca0] text-white rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                    <span>Publicar</span>
                  </button>
                </div>
              </div>

              {/* Notes Timeline */}
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {notesThread.length === 0 ? (
                  <div className="py-8 text-center border-2 border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
                    No hay comentarios ni registros en la bitácora aún.
                  </div>
                ) : (
                  notesThread.map((note) => (
                    <div key={note.id} className="p-3 bg-white rounded-xl border border-slate-200/90 shadow-2xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-[10px] font-bold">
                            {note.authorName.charAt(0)}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-800">{note.authorName}</span>
                            {note.authorRole && (
                              <span className="ml-1.5 text-[9px] uppercase px-1.5 py-0.2 rounded font-bold bg-slate-100 text-slate-600">
                                {note.authorRole}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {new Date(note.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 whitespace-pre-wrap pl-8">
                        {note.content}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold bg-[#004ac6] hover:bg-[#003ca0] text-white rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
            >
              <Kanban className="w-4 h-4" />
              <span>{taskToEdit ? "Guardar Cambios" : "Crear Proyecto / Tarea"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
