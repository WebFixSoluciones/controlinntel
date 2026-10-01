"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { Project, ProjectStatus } from "@/types";
import { DEFAULT_PROJECT_COLUMNS } from "@/lib/mock-data";
import {
  X,
  Briefcase,
  Building2,
  Radio,
  Calendar,
  DollarSign,
  Clock,
  Layers,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectToEdit?: Project | null;
  defaultClientId?: string;
  defaultClientName?: string;
}

export function ProjectModal({
  isOpen,
  onClose,
  projectToEdit,
  defaultClientId,
  defaultClientName,
}: ProjectModalProps) {
  const { clients, nodes, addProject, updateProject } = useApp();
  const { showSuccess, showError } = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"cliente" | "infraestructura_interna">("cliente");
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [nodeId, setNodeId] = useState("");
  const [nodeName, setNodeName] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 86400000 * 30).toISOString().split("T")[0]
  );
  const [estimatedBudget, setEstimatedBudget] = useState<number>(0);
  const [executedCost, setExecutedCost] = useState<number>(0);
  const [status, setStatus] = useState<ProjectStatus>("inicio");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (projectToEdit) {
      setTitle(projectToEdit.title || "");
      setDescription(projectToEdit.description || "");
      setType(projectToEdit.type || "cliente");
      setClientId(projectToEdit.clientId || "");
      setClientName(projectToEdit.clientName || "");
      setNodeId(projectToEdit.nodeId || "");
      setNodeName(projectToEdit.nodeName || "");
      setStartDate(projectToEdit.startDate || new Date().toISOString().split("T")[0]);
      setEndDate(projectToEdit.endDate || new Date(Date.now() + 86400000 * 30).toISOString().split("T")[0]);
      setEstimatedBudget(projectToEdit.estimatedBudget || 0);
      setExecutedCost(projectToEdit.executedCost || 0);
      setStatus(projectToEdit.status || "inicio");
    } else {
      // New project default values
      setTitle("");
      setDescription("");
      setType("cliente");
      const cId = defaultClientId || (clients[0]?.id || "");
      const cName = defaultClientName || (clients.find((c) => c.id === cId)?.businessName || "");
      setClientId(cId);
      setClientName(cName);
      setNodeId(nodes[0]?.id || "");
      setNodeName(nodes[0]?.name || "");
      setStartDate(new Date().toISOString().split("T")[0]);
      setEndDate(new Date(Date.now() + 86400000 * 30).toISOString().split("T")[0]);
      setEstimatedBudget(0);
      setExecutedCost(0);
      setStatus("inicio");
    }
  }, [isOpen, projectToEdit, defaultClientId, defaultClientName, clients, nodes]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showError("Campo Obligatorio", "Por favor ingresa un nombre para el proyecto.");
      return;
    }

    if (type === "cliente" && !clientId) {
      showError("Campo Obligatorio", "Por favor selecciona el cliente asignado al proyecto.");
      return;
    }

    if (type === "infraestructura_interna" && !nodeId) {
      showError("Campo Obligatorio", "Por favor selecciona el nodo o POP de infraestructura.");
      return;
    }

    setBusy(true);
    try {
      if (projectToEdit) {
        await updateProject(projectToEdit.id, {
          title: title.trim(),
          description: description.trim(),
          type,
          clientId: type === "cliente" ? clientId : undefined,
          clientName: type === "cliente" ? clientName : undefined,
          nodeId: type === "infraestructura_interna" ? nodeId : undefined,
          nodeName: type === "infraestructura_interna" ? nodeName : undefined,
          startDate,
          endDate,
          estimatedBudget: Number(estimatedBudget) || 0,
          executedCost: Number(executedCost) || 0,
          status,
        });
        showSuccess("Proyecto Actualizado", `El proyecto "${title}" ha sido modificado.`);
      } else {
        await addProject({
          title: title.trim(),
          description: description.trim(),
          type,
          clientId: type === "cliente" ? clientId : undefined,
          clientName: type === "cliente" ? clientName : undefined,
          nodeId: type === "infraestructura_interna" ? nodeId : undefined,
          nodeName: type === "infraestructura_interna" ? nodeName : undefined,
          startDate,
          endDate,
          estimatedBudget: Number(estimatedBudget) || 0,
          executedCost: Number(executedCost) || 0,
          status,
          columns: DEFAULT_PROJECT_COLUMNS,
          isDeleted: false,
        });
        showSuccess("Proyecto Creado", `Proyecto "${title}" inicializado con su Canvas de trabajo.`);
      }
      onClose();
    } catch {
      showError("Error", "No se pudo guardar el proyecto.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in select-none">
      <div className="bg-white rounded-3xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 via-white to-sky-50/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#004ac6]/10 text-[#004ac6] flex items-center justify-center">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-[#0b1c30]">
                {projectToEdit ? "Editar Proyecto" : "Nuevo Proyecto"}
              </h3>
              <p className="text-[11px] text-slate-500">
                Gestión estructurada estilo Notion: canvas, presupuesto, fechas y tareas
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Nombre del Proyecto */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nombre del Proyecto <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ej: Despliegue Enlace Dedicado 1Gbps / Tendido Troncal Fibra Óptica"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-[#004ac6] transition-all font-semibold text-slate-900"
            />
          </div>

          {/* Vinculación: Cliente vs Infraestructura */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-slate-700">
              Tipo de Vinculación <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType("cliente")}
                className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  type === "cliente"
                    ? "bg-white border-[#004ac6] text-[#004ac6] shadow-2xs"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-white"
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Cliente Corporativo</span>
              </button>

              <button
                type="button"
                onClick={() => setType("infraestructura_interna")}
                className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  type === "infraestructura_interna"
                    ? "bg-white border-[#004ac6] text-[#004ac6] shadow-2xs"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-white"
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>POP / Infraestructura</span>
              </button>
            </div>
          </div>

          {/* Selector de Cliente o Nodo */}
          {type === "cliente" ? (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Cliente Asignado <span className="text-rose-500">*</span>
              </label>
              <select
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value);
                  const c = clients.find((cl) => cl.id === e.target.value);
                  if (c) setClientName(c.businessName);
                }}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-hidden focus:border-[#004ac6]"
              >
                <option value="">-- Seleccionar Cliente --</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.businessName} ({c.identificationNumber})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                POP / Nodo de Red Asignado <span className="text-rose-500">*</span>
              </label>
              <select
                value={nodeId}
                onChange={(e) => {
                  setNodeId(e.target.value);
                  const n = nodes.find((nd) => nd.id === e.target.value);
                  if (n) setNodeName(n.name);
                }}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-hidden focus:border-[#004ac6]"
              >
                <option value="">-- Seleccionar Nodo / POP --</option>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name} - {n.address}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Fechas de Inicio y Fin (Cronograma Global) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#004ac6]" />
                <span>Fecha de Inicio</span>
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-hidden focus:border-[#004ac6]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Fecha de Fin / Plazo</span>
              </label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-hidden focus:border-[#004ac6]"
              />
            </div>
          </div>

          {/* Presupuesto y Estado Inicial */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                <span>Presupuesto Estimado ($ USD)</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={estimatedBudget || ""}
                onChange={(e) => setEstimatedBudget(parseFloat(e.target.value) || 0)}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 font-mono focus:outline-hidden focus:border-[#004ac6]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-purple-600" />
                <span>Estado del Proyecto</span>
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white font-bold text-slate-800 focus:outline-hidden focus:border-[#004ac6]"
              >
                <option value="inicio">Inicio / Planificación</option>
                <option value="en_proceso">En Proceso / Ejecución</option>
                <option value="revision">En Revisión / QA</option>
                <option value="terminado">Terminado / Finalizado</option>
                <option value="en_pausa">En Pausa</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
          </div>

          {/* Descripción / Alcance */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Descripción & Alcance del Proyecto
            </label>
            <textarea
              rows={3}
              placeholder="Detalla los objetivos, especificaciones técnicas, metrajes o condiciones del proyecto..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-[#004ac6] transition-all resize-none text-slate-800"
            />
          </div>

          {/* Información del Canvas por Defecto */}
          {!projectToEdit && (
            <div className="p-3 bg-sky-50/70 border border-sky-200/80 rounded-xl flex items-center gap-2 text-[11px] text-sky-900">
              <CheckCircle2 className="w-4 h-4 text-[#004ac6] shrink-0" />
              <span>
                Este proyecto se creará con su propio <strong>Canvas personalizable</strong> configurado con los 4 estados estándar: <em>Inicio, En Proceso, Revisión y Terminado</em>.
              </span>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-5 py-2 bg-[#004ac6] hover:bg-[#003ca0] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-all disabled:opacity-50"
            >
              {busy ? "Guardando..." : projectToEdit ? "Guardar Cambios" : "Crear Proyecto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
