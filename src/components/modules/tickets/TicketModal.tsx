"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { TicketPriority } from "@/types";
import { X, Check } from "lucide-react";

interface TicketModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TicketModal({ isOpen, onClose }: TicketModalProps) {
  const { addTicket, clients, nodes } = useApp();

  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("media");
  const [assignedToName, setAssignedToName] = useState("Tec. Santiago Morales");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="font-bold text-slate-900 text-sm">Nuevo Ticket de Soporte</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Cliente Afectado *</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.businessName} ({c.identificationNumber})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="font-bold text-slate-700 block mb-1">Motivo / Asunto *</label>
            <input
              type="text"
              required
              placeholder="Atenuación alta en puerto GPON / Enlace caído"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Prioridad SLA</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold"
              >
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
                <option value="critica">Crítica (SLA Inmediato)</option>
              </select>
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Técnico / Responsable</label>
              <input
                type="text"
                value={assignedToName}
                onChange={(e) => setAssignedToName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold"
              />
            </div>
          </div>
          <div>
            <label className="font-bold text-slate-700 block mb-1">Descripción de la Incidencia</label>
            <textarea
              rows={3}
              required
              placeholder="Detalle técnico de la falla reportada..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
            />
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 font-bold">Cancelar</button>
            <button type="submit" className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold shadow-sm">
              Crear Ticket
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
