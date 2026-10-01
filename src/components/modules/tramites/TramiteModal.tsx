"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { RegulatoryTramite } from "@/types";
import { X, Check, FileText, Building2, User, Calendar, AlertCircle, CheckSquare } from "lucide-react";

interface TramiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  tramiteToEdit?: RegulatoryTramite | null;
  defaultClientId?: string;
  defaultClientName?: string;
  defaultTaskId?: string;
  defaultTaskTitle?: string;
  defaultProjectId?: string;
  defaultProjectName?: string;
  onSaved?: (tramite: RegulatoryTramite) => void;
}

const ENTITY_OPTIONS = [
  "ARCOTEL (Agencia de Regulación y Control de las Telecomunicaciones)",
  "SRI (Servicio de Rentas Internas)",
  "MINTEL (Ministerio de Telecomunicaciones)",
  "Cuerpo de Bomberos",
  "Municipio / GAD Cantonal",
  "Registro Mercantil",
  "Superintendencia de Compañías",
  "Proveedor Portador de Tránsito",
  "Otro Organismo Regulatorio",
];

export function TramiteModal({
  isOpen,
  onClose,
  tramiteToEdit,
  defaultClientId,
  defaultClientName,
  defaultTaskId,
  defaultTaskTitle,
  defaultProjectId,
  defaultProjectName,
  onSaved,
}: TramiteModalProps) {
  const {
    clients,
    clientProjects,
    projects,
    addRegulatoryTramite,
    updateRegulatoryTramite,
    updateClientProjectTask,
    systemUsers,
    currentUser,
  } = useApp();
  const { showSuccess, showError } = useToast();

  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [taskId, setTaskId] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [projectName, setProjectName] = useState("");

  const [documentNumber, setDocumentNumber] = useState("");
  const [reason, setReason] = useState("");
  const [submissionDate, setSubmissionDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [entity, setEntity] = useState(ENTITY_OPTIONS[0]);
  const [dynamicStatus, setDynamicStatus] = useState<RegulatoryTramite["dynamicStatus"]>("ingresado");
  const [assignedTo, setAssignedTo] = useState(currentUser.displayName || "Ing. Santiago Morales");
  const [priority, setPriority] = useState<RegulatoryTramite["priority"]>("normal");
  const [notes, setNotes] = useState("");
  const [statusUpdateNote, setStatusUpdateNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (tramiteToEdit) {
      setClientId(tramiteToEdit.clientId || defaultClientId || "");
      setClientName(tramiteToEdit.clientName || defaultClientName || "");
      setTaskId(tramiteToEdit.taskId || defaultTaskId || "");
      setTaskTitle(tramiteToEdit.taskTitle || defaultTaskTitle || "");
      setProjectId(tramiteToEdit.projectId || defaultProjectId || "");
      setProjectName(tramiteToEdit.projectName || defaultProjectName || "");

      setDocumentNumber(tramiteToEdit.documentNumber);
      setReason(tramiteToEdit.reason);
      setSubmissionDate(tramiteToEdit.submissionDate);
      setEntity(tramiteToEdit.entity);
      setDynamicStatus(tramiteToEdit.dynamicStatus);
      setAssignedTo(tramiteToEdit.assignedTo);
      setPriority(tramiteToEdit.priority);
      setNotes(tramiteToEdit.notes || "");
      setStatusUpdateNote("");
    } else {
      const cId = defaultClientId || (clients[0]?.id || "");
      const cName = defaultClientName || (clients.find((c) => c.id === cId)?.businessName || "");
      setClientId(cId);
      setClientName(cName);
      setTaskId(defaultTaskId || "");
      setTaskTitle(defaultTaskTitle || "");
      setProjectId(defaultProjectId || "");
      setProjectName(defaultProjectName || "");

      setDocumentNumber("");
      setReason("");
      setSubmissionDate(new Date().toISOString().split("T")[0]);
      setEntity(ENTITY_OPTIONS[0]);
      setDynamicStatus("ingresado");
      setAssignedTo(currentUser.displayName || "Ing. Santiago Morales");
      setPriority("normal");
      setNotes("");
      setStatusUpdateNote("");
    }
  }, [
    tramiteToEdit,
    defaultClientId,
    defaultClientName,
    defaultTaskId,
    defaultTaskTitle,
    defaultProjectId,
    defaultProjectName,
    clients,
    currentUser,
  ]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentNumber.trim()) {
      showError("Documento Requerido", "Ingresa el número o código de documento.");
      return;
    }
    if (!reason.trim()) {
      showError("Motivo Requerido", "Ingresa el motivo o asunto del trámite.");
      return;
    }

    setBusy(true);
    try {
      if (tramiteToEdit) {
        let updatedHistory = tramiteToEdit.history || [];
        if (statusUpdateNote.trim() || dynamicStatus !== tramiteToEdit.dynamicStatus) {
          updatedHistory = [
            ...updatedHistory,
            {
              date: new Date().toISOString().split("T")[0],
              status: dynamicStatus,
              note: statusUpdateNote.trim() || `Estado cambiado a ${dynamicStatus.toUpperCase()}`,
              author: currentUser.displayName,
            },
          ];
        }

        const updatedTramite: RegulatoryTramite = {
          ...tramiteToEdit,
          clientId: clientId || undefined,
          clientName: clientName || undefined,
          taskId: taskId || undefined,
          taskTitle: taskTitle || undefined,
          projectId: projectId || undefined,
          projectName: projectName || undefined,
          documentNumber: documentNumber.trim(),
          reason: reason.trim(),
          submissionDate,
          entity,
          dynamicStatus,
          assignedTo,
          priority,
          notes: notes.trim() || undefined,
          history: updatedHistory,
        };

        await updateRegulatoryTramite(tramiteToEdit.id, updatedTramite);

        // Si se vinculó a una tarea, aseguramos que la tarea tenga este trámite registrado
        if (taskId) {
          const targetTask = clientProjects.find((t) => t.id === taskId);
          if (targetTask && !(targetTask.tramiteIds || []).includes(tramiteToEdit.id)) {
            await updateClientProjectTask(taskId, {
              tramiteIds: [...(targetTask.tramiteIds || []), tramiteToEdit.id],
            });
          }
        }

        showSuccess("Trámite Actualizado", `Trámite ${documentNumber} actualizado.`);
        onSaved?.(updatedTramite);
      } else {
        const nextCode = `TRM-2026-${Math.floor(100 + Math.random() * 900)}`;
        const created = await addRegulatoryTramite({
          code: nextCode,
          clientId: clientId || undefined,
          clientName: clientName || undefined,
          taskId: taskId || undefined,
          taskTitle: taskTitle || undefined,
          projectId: projectId || undefined,
          projectName: projectName || undefined,
          documentNumber: documentNumber.trim(),
          reason: reason.trim(),
          submissionDate,
          entity,
          dynamicStatus,
          assignedTo,
          priority,
          notes: notes.trim() || undefined,
          history: [
            {
              date: submissionDate,
              status: dynamicStatus,
              note: notes.trim() || "Ingreso inicial del trámite",
              author: currentUser.displayName,
            },
          ],
        });

        if (taskId && created?.id) {
          const targetTask = clientProjects.find((t) => t.id === taskId);
          if (targetTask && !(targetTask.tramiteIds || []).includes(created.id)) {
            await updateClientProjectTask(taskId, {
              tramiteIds: [...(targetTask.tramiteIds || []), created.id],
            });
          }
        }

        showSuccess("Trámite Creado", `Trámite ${documentNumber} registrado exitosamente.`);
        if (created) {
          onSaved?.(created);
        }
      }
      onClose();
    } catch (err: any) {
      showError("Error", err?.message || "No se pudo guardar el trámite.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-lumina-dropdown border border-[#e2e8f0] overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8f9ff]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#eff4ff] text-[#004ac6] flex items-center justify-center shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-[#0b1c30] text-sm">
                {tramiteToEdit ? `Modificar Trámite: ${tramiteToEdit.code}` : "Registrar Nuevo Trámite"}
              </h3>
              <p className="text-[11px] text-[#737686]">
                Seguimiento regulatorio e institucional con estados dinámicos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#737686] hover:text-[#0b1c30] hover:bg-[#eff4ff] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto text-xs">
          {/* Vinculación: Cliente y Tarea / Proyecto */}
          <div className="bg-[#f8f9fc] border border-[#e2e8f0] rounded-xl p-3.5 space-y-3">
            <div className="text-[11px] font-bold text-[#004ac6] uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              <span>Vinculación de Cliente y Tarea de Proyecto</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-[#434655] block mb-1">
                  Cliente Titular *
                </label>
                {defaultClientId ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-white border border-[#cbd5e1] rounded-xl text-[#0b1c30] font-semibold">
                    <Building2 className="w-4 h-4 text-[#004ac6]" />
                    <span className="truncate">{clientName || defaultClientName}</span>
                    <span className="ml-auto text-[10px] font-bold text-[#004ac6] bg-[#eff4ff] px-2 py-0.5 rounded-full">Ficha Actual</span>
                  </div>
                ) : (
                  <select
                    value={clientId}
                    onChange={(e) => {
                      const selId = e.target.value;
                      setClientId(selId);
                      const cl = clients.find((c) => c.id === selId);
                      setClientName(cl?.businessName || "");
                      setTaskId("");
                      setTaskTitle("");
                      setProjectId("");
                      setProjectName("");
                    }}
                    className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 font-semibold text-[#0b1c30] focus:ring-1 focus:ring-[#004ac6]"
                  >
                    <option value="">-- Seleccionar Cliente --</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.businessName} ({c.identificationNumber})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="font-bold text-[#434655] block mb-1">
                  Tarea / Proyecto Vinculado
                </label>
                <select
                  value={taskId}
                  onChange={(e) => {
                    const selTaskId = e.target.value;
                    setTaskId(selTaskId);
                    if (!selTaskId) {
                      setTaskTitle("");
                      setProjectId("");
                      setProjectName("");
                    } else {
                      const t = clientProjects.find((cp) => cp.id === selTaskId);
                      if (t) {
                        setTaskTitle(t.title);
                        setProjectId(t.projectId || "");
                        setProjectName(t.projectName || "");
                      }
                    }
                  }}
                  className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 font-semibold text-[#0b1c30] focus:ring-1 focus:ring-[#004ac6]"
                >
                  <option value="">-- Ninguna (Trámite General de Cliente) --</option>
                  {clientProjects
                    .filter((t) => !clientId || t.clientId === clientId)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.projectName ? `[${t.projectName}] ` : ""}{t.title}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            {taskTitle && (
              <div className="text-[11px] text-[#004ac6] flex items-center gap-1.5 bg-[#eff4ff] px-2.5 py-1.5 rounded-lg border border-[#c3d3ff]">
                <CheckSquare className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Asociado a Tarea: <strong>{taskTitle}</strong>
                  {projectName ? ` (Proyecto: ${projectName})` : ""}
                </span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-[#434655] block mb-1">
                Número de Documento / Oficio / Quipux *
              </label>
              <input
                type="text"
                required
                placeholder="Ej: OFICIO-ARCOTEL-2026-0914-O"
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 font-mono font-bold text-[#0b1c30] focus:ring-1 focus:ring-[#004ac6]"
              />
            </div>

            <div>
              <label className="font-bold text-[#434655] block mb-1">
                Fecha del Trámite / Ingreso *
              </label>
              <input
                type="date"
                required
                value={submissionDate}
                onChange={(e) => setSubmissionDate(e.target.value)}
                className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 font-semibold text-[#0b1c30] focus:ring-1 focus:ring-[#004ac6]"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-[#434655] block mb-1">
              Motivo o Asunto del Trámite *
            </label>
            <textarea
              required
              rows={2}
              placeholder="Describa el objeto de la gestión (ej. Solicitud de renovación de título habilitante para prestación de servicio de valor agregado)..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-[#0b1c30] focus:ring-1 focus:ring-[#004ac6]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-[#434655] block mb-1">
                Entidad u Organismo *
              </label>
              <select
                value={entity}
                onChange={(e) => setEntity(e.target.value)}
                className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 font-semibold text-[#0b1c30] focus:ring-1 focus:ring-[#004ac6]"
              >
                {ENTITY_OPTIONS.map((ent) => (
                  <option key={ent} value={ent}>
                    {ent}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-[#434655] block mb-1">
                Estado Dinámico del Trámite *
              </label>
              <select
                value={dynamicStatus}
                onChange={(e) => setDynamicStatus(e.target.value as any)}
                className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 font-bold text-[#004ac6] focus:ring-1 focus:ring-[#004ac6]"
              >
                <option value="ingresado">1. INGRESADO (Ventanilla / Quipux)</option>
                <option value="en_revision">2. EN REVISIÓN TÉCNICA</option>
                <option value="observado">3. OBSERVADO (Requiere Subsanación)</option>
                <option value="subsanado">4. SUBSANADO</option>
                <option value="aprobado">5. APROBADO / FAVORABLE</option>
                <option value="finalizado">6. FINALIZADO / CONCLUIDO</option>
                <option value="archivado">7. ARCHIVADO</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-[#434655] block mb-1">
                Responsable Asignado *
              </label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 font-semibold text-[#0b1c30] focus:ring-1 focus:ring-[#004ac6]"
              >
                {systemUsers.map((u) => (
                  <option key={u.uid} value={u.displayName}>
                    {u.displayName} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-[#434655] block mb-1">
                Prioridad
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 font-semibold text-[#0b1c30] focus:ring-1 focus:ring-[#004ac6]"
              >
                <option value="normal">Normal</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente (Término Perentorio)</option>
              </select>
            </div>
          </div>

          {tramiteToEdit ? (
            <div>
              <label className="font-bold text-[#434655] block mb-1">
                Agregar Nota de Seguimiento a la Bitácora
              </label>
              <input
                type="text"
                placeholder="Ej. Oficio de respuesta entregado el 25/09..."
                value={statusUpdateNote}
                onChange={(e) => setStatusUpdateNote(e.target.value)}
                className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-[#0b1c30] focus:ring-1 focus:ring-[#004ac6]"
              />
            </div>
          ) : (
            <div>
              <label className="font-bold text-[#434655] block mb-1">
                Observaciones Generales
              </label>
              <input
                type="text"
                placeholder="Observaciones adicionales o enlace al archivo..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-[#0b1c30] focus:ring-1 focus:ring-[#004ac6]"
              />
            </div>
          )}

          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-[#e2e8f0]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-[#737686] hover:bg-slate-100 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-5 py-2 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{busy ? "Guardando..." : tramiteToEdit ? "Guardar Cambios" : "Crear Trámite"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
