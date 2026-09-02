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

export function TicketModal({ isOpen, onClose }: TicketModalProps) {
  const { addTicket, clients } = useApp();
  const { showError, showSuccess } = useToast();

  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("media");
  const [assignedToName, setAssignedToName] = useState("Tec. Santiago Morales");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientId) {
      showError("Cliente No Seleccionado", "Debes vincular el ticket a un abonado registrado.");
      return;
    }

    if (!title || title.trim().length < 5) {
      showError("Asunto Incompleto", "Describe brevemente la falla (mínimo 5 caracteres).");
      return;
    }

    if (!description || description.trim().length < 10) {
      showError("Detalle Insuficiente", "Ingresa un reporte técnico más detallado para la cuadrilla (mínimo 10 caracteres).");
      return;
    }

    const client = clients.find((c) => c.id === clientId);

    addTicket({
      clientId,
      clientName: client?.businessName || "Cliente",
      title,
      description,
      priority,
      status: "abierto",
      assignedToName,
      category: "corte_fibra",
    });

    showSuccess("Ticket Creado", `Incidencia generada y notificada a ${assignedToName}.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-lumina-dropdown border border-[#e2e8f0] overflow-hidden">
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
            <label className="font-bold text-[#434655] block mb-1">Motivo / Asunto *</label>
            <input
              type="text"
              required
              placeholder="Atenuación alta en puerto GPON / Enlace caído"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 font-semibold text-[#0b1c30]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
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
              <label className="font-bold text-[#434655] block mb-1">Técnico / Responsable</label>
              <input
                type="text"
                value={assignedToName}
                onChange={(e) => setAssignedToName(e.target.value)}
                className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 font-semibold text-[#0b1c30]"
              />
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
