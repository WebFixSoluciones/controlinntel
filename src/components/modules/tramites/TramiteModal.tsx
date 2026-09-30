"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { RegulatoryTramite } from "@/types";
import { X, Check, FileText, Building2, User, Calendar, AlertCircle } from "lucide-react";

interface TramiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  tramiteToEdit?: RegulatoryTramite | null;
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

export function TramiteModal({ isOpen, onClose, tramiteToEdit }: TramiteModalProps) {
  const { addRegulatoryTramite, updateRegulatoryTramite, systemUsers, currentUser } = useApp();
  const { showSuccess, showError } = useToast();

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
  }, [tramiteToEdit, currentUser]);

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

        await updateRegulatoryTramite(tramiteToEdit.id, {
          documentNumber: documentNumber.trim(),
          reason: reason.trim(),
          submissionDate,
          entity,
          dynamicStatus,
          assignedTo,
          priority,
          notes: notes.trim() || undefined,
          history: updatedHistory,
        });

        showSuccess("Trámite Actualizado", `Trámite ${documentNumber} actualizado.`);
      } else {
        const nextCode = `TRM-2026-${Math.floor(100 + Math.random() * 900)}`;
        await addRegulatoryTramite({
          code: nextCode,
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

        showSuccess("Trámite Creado", `Trámite ${documentNumber} registrado exitosamente.`);
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
