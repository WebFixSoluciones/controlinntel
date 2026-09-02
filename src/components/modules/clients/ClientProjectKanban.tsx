"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { Client, ClientProjectTask, ProjectKanbanColumn } from "@/types";
import {
  Kanban,
  Plus,
  Clock,
  User,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Trash2,
  X,
  Calendar,
  Layers,
  ArrowRight,
} from "lucide-react";

interface ClientProjectKanbanProps {
  client: Client;
}

const KANBAN_COLUMNS: { id: ProjectKanbanColumn; label: string; color: string; dotColor: string }[] = [
  { id: "factibilidad", label: "1. Factibilidad Técnica", color: "bg-slate-100 text-slate-700 border-slate-200", dotColor: "bg-slate-400" },
  { id: "tendido_fibra", label: "2. Tendido de Fibra", color: "bg-sky-50 text-sky-700 border-sky-200", dotColor: "bg-sky-500" },
  { id: "fusion_splitters", label: "3. Fusión & Splitters", color: "bg-indigo-50 text-indigo-700 border-indigo-200", dotColor: "bg-indigo-500" },
  { id: "instalacion_ont", label: "4. Instalación de ONT", color: "bg-purple-50 text-purple-700 border-purple-200", dotColor: "bg-purple-500" },
  { id: "pruebas_homologacion", label: "5. Pruebas & Homologación", color: "bg-amber-50 text-amber-700 border-amber-200", dotColor: "bg-amber-500" },
  { id: "completado", label: "6. Entregado & Operativo", color: "bg-emerald-50 text-emerald-700 border-emerald-200", dotColor: "bg-emerald-500" },
];

export function ClientProjectKanban({ client }: ClientProjectKanbanProps) {
  const { clientProjects, addClientProjectTask, updateClientProjectTask, moveProjectTaskColumn, deleteClientProjectTask } = useApp();
  const { showSuccess, showConfirm } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newColumn, setNewColumn] = useState<ProjectKanbanColumn>("factibilidad");
  const [newPriority, setNewPriority] = useState<ClientProjectTask["priority"]>("media");
  const [newAssigned, setNewAssigned] = useState("Cuadrilla NOC Central");
  const [newDueDate, setNewDueDate] = useState(new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0]);
  const [newChecklistText, setNewChecklistText] = useState("");
  const [checklistItems, setChecklistItems] = useState<{ id: string; text: string; done: boolean }[]>([]);

  // Drag and drop state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const clientTasks = clientProjects.filter((t) => t.clientId === client.id);

  const handleAddChecklist = () => {
    if (!newChecklistText.trim()) return;
    setChecklistItems([
      ...checklistItems,
      { id: "chk-" + Date.now(), text: newChecklistText.trim(), done: false },
    ]);
    setNewChecklistText("");
  };

  const handleRemoveChecklist = (id: string) => {
    setChecklistItems(checklistItems.filter((i) => i.id !== id));
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    addClientProjectTask({
      clientId: client.id,
      clientName: client.businessName,
      title: newTitle.trim(),
      description: newDesc.trim(),
      column: newColumn,
      priority: newPriority,
      assignedTo: newAssigned,
      dueDate: newDueDate,
      checklist: checklistItems,
    });

    showSuccess("Tarea Registrada", `Fase agregada a la columna de ${newColumn}.`);
    setIsModalOpen(false);
    setNewTitle("");
    setNewDesc("");
    setChecklistItems([]);
  };

  const handleToggleChecklist = (task: ClientProjectTask, chkId: string) => {
    const updatedChecklist = task.checklist.map((c) =>
      c.id === chkId ? { ...c, done: !c.done } : c
    );
    updateClientProjectTask(task.id, { checklist: updatedChecklist });
  };

  const handleDeleteTask = (task: ClientProjectTask) => {
    showConfirm(
      "¿Eliminar Tarea del Tablero?",
      `¿Deseas remover la tarjeta "${task.title}" del seguimiento de obra?`,
      () => {
        deleteClientProjectTask(task.id);
        showSuccess("Tarea Eliminada", "La tarjeta ha sido removida del tablero.");
      },
      "Eliminar"
    );
  };

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedTaskId(id);
    e.dataTransfer.setData("text/plain", id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetCol: ProjectKanbanColumn) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || draggedTaskId;
    if (id) {
      moveProjectTaskColumn(id, targetCol);
      setDraggedTaskId(null);
    }
  };

  const handleShiftColumn = (task: ClientProjectTask, direction: "prev" | "next") => {
    const currentIndex = KANBAN_COLUMNS.findIndex((c) => c.id === task.column);
    if (direction === "next" && currentIndex < KANBAN_COLUMNS.length - 1) {
      moveProjectTaskColumn(task.id, KANBAN_COLUMNS[currentIndex + 1].id);
    } else if (direction === "prev" && currentIndex > 0) {
      moveProjectTaskColumn(task.id, KANBAN_COLUMNS[currentIndex - 1].id);
    }
  };

  return (
    <div className="space-y-4 select-none">
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
        <div>
          <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
            <Kanban className="w-4 h-4 text-sky-600" />
            Tablero de Despliegue de Obra & Proyectos (Tipo Trello)
          </h4>
          <p className="text-[11px] text-slate-400">
            Arrastra y suelta las tarjetas entre fases técnicas o utiliza los controles de avance rápido
          </p>
        </div>

        <button
          onClick={() => {
            setChecklistItems([]);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nueva Etapa / Tarea</span>
        </button>
      </div>

      {/* Kanban Board Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 overflow-x-auto pb-2 min-h-[420px]">
        {KANBAN_COLUMNS.map((col) => {
          const colTasks = clientTasks.filter((t) => t.column === col.id);

          return (
            <div
              key={col.id}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.id)}
              className="bg-slate-50/80 rounded-2xl border border-slate-200/90 flex flex-col p-2.5 transition-colors hover:border-sky-300"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 mb-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                  <span className="font-bold text-slate-800 text-[11px] truncate" title={col.label}>
                    {col.label}
                  </span>
                </div>
                <span className="text-[10px] font-bold bg-white text-slate-600 px-1.5 py-0.2 rounded-full border border-slate-200">
                  {colTasks.length}
                </span>
              </div>

              {/* Tasks List */}
              <div className="space-y-2 flex-1 overflow-y-auto">
                {colTasks.length === 0 ? (
                  <div className="h-24 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-xl text-[10px] text-slate-400 italic">
                    Soltar aquí
                  </div>
                ) : (
                  colTasks.map((task) => {
                    const completedChecklist = task.checklist.filter((c) => c.done).length;
                    const totalChecklist = task.checklist.length;

                    return (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        className="p-3 bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all cursor-grab active:cursor-grabbing space-y-2 group"
                      >
                        {/* Priority & Delete */}
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

                          <button
                            onClick={() => handleDeleteTask(task)}
                            className="text-slate-300 hover:text-rose-600 p-0.5 rounded cursor-pointer"
                            title="Eliminar tarea"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Title & Desc */}
                        <div>
                          <h5 className="font-bold text-xs text-slate-900 leading-snug">{task.title}</h5>
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
                              <span>Checklist Técnico</span>
                              <span>
                                {completedChecklist}/{totalChecklist}
                              </span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                              <div
                                className="bg-emerald-500 h-1 transition-all"
                                style={{ width: `${(completedChecklist / totalChecklist) * 100}%` }}
                              />
                            </div>
                            <div className="space-y-0.5 mt-1 max-h-20 overflow-y-auto">
                              {task.checklist.map((c) => (
                                <label
                                  key={c.id}
                                  className="flex items-center gap-1.5 text-slate-600 cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={c.done}
                                    onChange={() => handleToggleChecklist(task, c.id)}
                                    className="rounded border-slate-300 text-sky-600"
                                  />
                                  <span className={`truncate ${c.done ? "line-through text-slate-400" : ""}`}>
                                    {c.text}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Assignee & Due Date */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                          <span className="flex items-center gap-1 truncate max-w-[90px]" title={task.assignedTo}>
                            <User className="w-3 h-3" /> {task.assignedTo.split(" ")[0]}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {task.dueDate}
                          </span>
                        </div>

                        {/* Shift Controls */}
                        <div className="pt-1 flex items-center justify-between">
                          <button
                            onClick={() => handleShiftColumn(task, "prev")}
                            disabled={col.id === "factibilidad"}
                            className="p-1 rounded bg-slate-50 hover:bg-slate-100 text-slate-500 disabled:opacity-30 cursor-pointer"
                            title="Mover a etapa anterior"
                          >
                            <ChevronLeft className="w-3 h-3" />
                          </button>

                          <button
                            onClick={() => handleShiftColumn(task, "next")}
                            disabled={col.id === "completado"}
                            className="p-1 rounded bg-slate-50 hover:bg-slate-100 text-slate-500 disabled:opacity-30 cursor-pointer"
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

      {/* New Task Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Kanban className="w-4 h-4 text-sky-600" />
                Nueva Tarea / Fase de Obra
              </h4>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="p-5 overflow-y-auto space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Título de la Fase *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Fusión de Splitter 1:8 en Caja NAP 04"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-semibold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Descripción / Instrucciones Técnicas</label>
                <textarea
                  rows={2}
                  placeholder="Detalles sobre atenuación esperada, bobina de fibra a utilizar y herrajes..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Fase / Columna</label>
                  <select
                    value={newColumn}
                    onChange={(e) => setNewColumn(e.target.value as ProjectKanbanColumn)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-bold"
                  >
                    {KANBAN_COLUMNS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Prioridad</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as ClientProjectTask["priority"])}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-bold"
                  >
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Fecha Límite</label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Cuadrilla / Responsable</label>
                <input
                  type="text"
                  placeholder="Ing. Carlos Benítez / Cuadrilla 2"
                  value={newAssigned}
                  onChange={(e) => setNewAssigned(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>

              {/* Checklist Builder */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <label className="font-bold text-slate-700 block">Checklist Técnico de Validación</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Añadir ítem (Ej: Medición de potencia -19 dBm)"
                    value={newChecklistText}
                    onChange={(e) => setNewChecklistText(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5"
                  />
                  <button
                    type="button"
                    onClick={handleAddChecklist}
                    className="px-3 py-1.5 bg-slate-900 text-white font-bold rounded-xl cursor-pointer"
                  >
                    Añadir
                  </button>
                </div>

                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {checklistItems.map((chk) => (
                    <div
                      key={chk.id}
                      className="flex items-center justify-between p-2 bg-slate-50 rounded-xl text-slate-700"
                    >
                      <span className="truncate">{chk.text}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveChecklist(chk.id)}
                        className="text-slate-400 hover:text-rose-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 font-bold text-slate-600 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold shadow-sm cursor-pointer"
                >
                  Guardar Tarjeta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
