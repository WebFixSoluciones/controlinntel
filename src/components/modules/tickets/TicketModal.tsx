"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { TicketPriority } from "@/types";
import { X, Check } from "lucide-react";

interface TicketModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ISP_FAULT_TOPICS = [
  "Corte de fibra óptica / Enlace caído",
  "Atenuación alta de potencia óptica (dBm fuera de rango)",
  "Pérdida de sincronismo ONT / Falla de aprovisionamiento",
  "Lentitud en horario pico / Saturación de enlace",
  "Problemas de enrutamiento BGP / IP pública no responde",
  "Cambio de contraseña WiFi / Configuración LAN router",
  "Reubicación física de acometida / Cambio de splitter",
  "Falla de alimentación eléctrica en OLT / Respaldo UPS",
  "Otro motivo técnico (personalizado)",
];

export function TicketModal({ isOpen, onClose }: TicketModalProps) {
  const { addTicket, clients, systemUsers } = useApp();
  const { showError, showSuccess } = useToast();

  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [selectedTopic, setSelectedTopic] = useState(ISP_FAULT_TOPICS[0]);
  const [customTitle, setCustomTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("media");
  const [assignedToName, setAssignedToName] = useState(
    systemUsers.find((u) => u.role === "tecnico" || u.role === "soporte" || u.role === "admin")?.displayName ||
    systemUsers[0]?.displayName ||
    "Ing. Santiago Morales"
  );

  if (!isOpen) return null;

  const effectiveTitle = selectedTopic === "Otro motivo técnico (personalizado)" ? customTitle : selectedTopic;

  const handleSubmit = async (e: React.FormEvent) => {
    try {
      e.preventDefault();

      if (!clientId) {
        showError("Cliente No Seleccionado", "Debes vincular el ticket a un abonado registrado.");
        return;
      }

      if (!effectiveTitle || effectiveTitle.trim().length < 5) {
        showError("Asunto Incompleto", "Describe brevemente la falla (mínimo 5 caracteres).");
        return;
      }

      if (!description || description.trim().length < 10) {
        showError("Detalle Insuficiente", "Ingresa un reporte técnico más detallado para la cuadrilla (mínimo 10 caracteres).");
        return;
      }

      const client = clients.find((c) => c.id === clientId);

      await addTicket({
        clientId,
        clientName: client?.businessName || "Cliente",
        title: effectiveTitle,
        description,
        priority,
        status: "abierto",
        assignedToName,
        category: "corte_fibra",
      });

      showSuccess("Ticket Creado", `Incidencia generada y notificada a ${assignedToName}.`);
      onClose();
    } catch (error) {
      window.dispatchEvent(new CustomEvent("inntel:error", { detail: error instanceof Error ? error.message : "No se pudo guardar." }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-lumina-dropdown border border-[#e2e8f0] overflow-hidden">
        <div className="p-4 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8f9ff]">
          <h3 className="font-bold text-[#0b1c30] text-sm">Nuevo Ticket de Soporte Técnico NOC</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-[#737686] hover:text-[#0b1c30] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
          <div>
            <label className="font-bold text-[#434655] block mb-1">Cliente Afectado *</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 font-semibold text-[#0b1c30]"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.businessName} ({c.identificationNumber})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-bold text-[#434655] block mb-1">Motivo / Asunto Predefinido *</label>
            <select
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 font-semibold text-[#0b1c30]"
            >
              {ISP_FAULT_TOPICS.map((topic) => (
                <option key={topic} value={topic}>
                  {topic}
                </option>
              ))}
            </select>

            {selectedTopic === "Otro motivo técnico (personalizado)" && (
              <input
                type="text"
                required
                placeholder="Escribe el motivo técnico específico..."
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                className="w-full mt-2 bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 font-semibold text-[#0b1c30]"
              />
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-[#434655] block mb-1">Prioridad SLA</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 font-bold text-[#0b1c30]"
              >
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
                <option value="critica">Crítica (SLA Inmediato)</option>
              </select>
            </div>
            <div>
              <label className="font-bold text-[#434655] block mb-1">Técnico / Responsable Asignado *</label>
              <select
                value={assignedToName}
                onChange={(e) => setAssignedToName(e.target.value)}
                className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 font-semibold text-[#0b1c30]"
              >
                {systemUsers.map((u) => (
                  <option key={u.uid} value={u.displayName}>
                    {u.displayName} ({u.role.toUpperCase()} {u.department ? `- ${u.department}` : ""})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="font-bold text-[#434655] block mb-1">Descripción Técnica</label>
            <textarea
              rows={3}
              required
              placeholder="Detalle técnico de la falla reportada (niveles de potencia óptica, alarmas)..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 text-[#0b1c30]"
            />
          </div>
          <div className="pt-2 flex justify-end gap-2 border-t border-[#e2e8f0]">
            <button type="button" onClick={onClose} className="px-4 py-2 text-[#737686] hover:bg-[#f8f9ff] rounded-lg font-bold cursor-pointer">
              Cancelar
            </button>
            <button type="submit" className="px-4 py-2 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-lg font-bold shadow-xs cursor-pointer">
              Crear Ticket
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
