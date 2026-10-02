"use client";

import React, { useState, useMemo } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { TicketPriority, TicketDepartment } from "@/types";
import { X, Headphones, Building2, Wifi, ShieldAlert, UserCheck } from "lucide-react";

interface TicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialClientId?: string;
}

const ISP_FAULT_TOPICS = [
  { topic: "Corte de fibra óptica / Enlace caído", category: "corte_fibra" as const, defaultDept: "noc_redes" as TicketDepartment },
  { topic: "Atenuación alta de potencia óptica (dBm fuera de rango)", category: "atenuacion_alta" as const, defaultDept: "soporte_tecnico" as TicketDepartment },
  { topic: "Pérdida de sincronismo ONT / Falla de aprovisionamiento", category: "corte_fibra" as const, defaultDept: "soporte_tecnico" as TicketDepartment },
  { topic: "Lentitud en horario pico / Saturación de enlace", category: "configuracion_ip" as const, defaultDept: "noc_redes" as TicketDepartment },
  { topic: "Problemas de enrutamiento BGP / IP pública no responde", category: "configuracion_ip" as const, defaultDept: "noc_redes" as TicketDepartment },
  { topic: "Consulta de saldo / Facturación no acreditada", category: "facturacion" as const, defaultDept: "facturacion" as TicketDepartment },
  { topic: "Cambio de contraseña WiFi / Configuración LAN router", category: "otro" as const, defaultDept: "soporte_tecnico" as TicketDepartment },
  { topic: "Reubicación física de acometida / Cambio de splitter", category: "corte_fibra" as const, defaultDept: "noc_redes" as TicketDepartment },
  { topic: "Solicitud de cambio de plan / Upgrade de ancho de banda", category: "otro" as const, defaultDept: "ventas" as TicketDepartment },
  { topic: "Otro motivo técnico (personalizado)", category: "otro" as const, defaultDept: "soporte_tecnico" as TicketDepartment },
];

export function TicketModal({ isOpen, onClose, initialClientId }: TicketModalProps) {
  const { addTicket, clients, clientServices, systemUsers } = useApp();
  const { showError, showSuccess } = useToast();

  const [clientId, setClientId] = useState(() => initialClientId || clients[0]?.id || "");
  const [selectedTopic, setSelectedTopic] = useState(ISP_FAULT_TOPICS[0].topic);
  const [customTitle, setCustomTitle] = useState("");
  const [department, setDepartment] = useState<TicketDepartment>("soporte_tecnico");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("media");
  const [assignedToName, setAssignedToName] = useState(
    systemUsers.find((u) => u.role === "tecnico" || u.role === "soporte" || u.role === "admin")?.displayName ||
    systemUsers[0]?.displayName ||
    "Ing. Santiago Morales"
  );

  const selectedClient = useMemo(() => clients.find((c) => c.id === clientId), [clients, clientId]);
  const availableServices = useMemo(() => clientServices.filter((s) => s.clientId === clientId), [clientServices, clientId]);

  // Sync selected service when client changes
  React.useEffect(() => {
    if (availableServices.length > 0) {
      setSelectedServiceId(availableServices[0].id);
    } else {
      setSelectedServiceId("");
    }
  }, [availableServices]);

  if (!isOpen) return null;

  const currentTopicConfig = ISP_FAULT_TOPICS.find((t) => t.topic === selectedTopic);
  const effectiveTitle = selectedTopic === "Otro motivo técnico (personalizado)" ? customTitle : selectedTopic;

  const handleTopicChange = (topic: string) => {
    setSelectedTopic(topic);
    const found = ISP_FAULT_TOPICS.find((t) => t.topic === topic);
    if (found) {
      setDepartment(found.defaultDept);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    try {
      e.preventDefault();

      if (!clientId) {
        showError("Cliente No Seleccionado", "Debes vincular el ticket a un cliente registrado.");
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

      const client = selectedClient;
      const service = availableServices.find((s) => s.id === selectedServiceId);
      const assignedUser = systemUsers.find((u) => u.displayName === assignedToName);

      await addTicket({
        clientId,
        clientName: client?.businessName || "Cliente Desconocido",
        clientEmail: client?.email,
        clientPhone: client?.phone,
        clientAddress: client?.address,
        serviceId: service?.id,
        serviceName: service ? `${service.planName} (${service.ipv4Address})` : undefined,
        nodeName: service?.nodeName,
        department,
        title: effectiveTitle,
        description,
        priority,
        status: "abierto",
        assignedToId: assignedUser?.uid,
        assignedToName,
        category: currentTopicConfig?.category || "otro",
      });

      showSuccess("Ticket WHMCS Generado", `Incidencia creada exitosamente y asignada al departamento correspondiente.`);
      onClose();
    } catch (error) {
      window.dispatchEvent(new CustomEvent("inntel:error", { detail: error instanceof Error ? error.message : "No se pudo guardar." }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-lumina-dropdown border border-[#e2e8f0] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header WHMCS Style */}
        <div className="p-4 border-b border-[#e2e8f0] flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#004ac6] flex items-center justify-center text-white shadow-xs">
              <Headphones className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-[#0b1c30] text-sm">Abrir Ticket de Soporte Técnico</h3>
              <p className="text-[11px] text-[#737686]">Flujo de mesa de ayuda ISP y atención de clientes</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-[#737686] hover:text-[#0b1c30] hover:bg-slate-200/60 cursor-pointer transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
          {/* Cliente & Servicio Contratado */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80">
            <div>
              <label className="font-bold text-[#434655] flex items-center gap-1.5 mb-1">
                <Building2 className="w-3.5 h-3.5 text-[#004ac6]" />
                Cliente Afectado *
              </label>
              {initialClientId ? (
                <div className="w-full bg-slate-100 border border-slate-300 rounded-lg px-3 py-2 font-bold text-slate-800">
                  {selectedClient?.businessName || "Cliente Asignado"}
                </div>
              ) : (
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 font-semibold text-[#0b1c30] focus:border-[#004ac6] focus:outline-none"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.businessName} ({c.identificationNumber})
                    </option>
                  ))}
                </select>
              )}
              {selectedClient && (
                <div className="mt-1 text-[11px] text-slate-500 flex gap-2">
                  <span>Tel: {selectedClient.phone || "S/N"}</span>
                  <span>•</span>
                  <span>Email: {selectedClient.email || "S/N"}</span>
                </div>
              )}
            </div>

            <div>
              <label className="font-bold text-[#434655] flex items-center gap-1.5 mb-1">
                <Wifi className="w-3.5 h-3.5 text-[#004ac6]" />
                Servicio / Plan Afectado
              </label>
              <select
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(e.target.value)}
                className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 font-semibold text-[#0b1c30] focus:border-[#004ac6] focus:outline-none"
              >
                {availableServices.length > 0 ? (
                  availableServices.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.planName} - IP: {s.ipv4Address} ({s.nodeName || "Nodo Principal"})
                    </option>
                  ))
                ) : (
                  <option value="">(Sin servicios activos registrados)</option>
                )}
              </select>
            </div>
          </div>

          {/* Departamento WHMCS & Prioridad SLA */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="font-bold text-[#434655] block mb-1">Departamento Destino *</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value as TicketDepartment)}
                className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 font-semibold text-[#0b1c30] focus:border-[#004ac6] focus:outline-none"
              >
                <option value="soporte_tecnico">Soporte Técnico NOC</option>
                <option value="noc_redes">NOC / Planta Externa</option>
                <option value="facturacion">Facturación & Cobranzas</option>
                <option value="ventas">Ventas & Nuevos Servicios</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-[#434655] flex items-center gap-1 mb-1">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                Prioridad / SLA
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 font-bold text-[#0b1c30] focus:border-[#004ac6] focus:outline-none"
              >
                <option value="baja">Baja (Respuesta 48h)</option>
                <option value="media">Media (Respuesta 24h)</option>
                <option value="alta">Alta (Respuesta 8h)</option>
                <option value="critica">Crítica (SLA Inmediato / Cuadrilla)</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-[#434655] flex items-center gap-1 mb-1">
                <UserCheck className="w-3.5 h-3.5 text-[#004ac6]" />
                Asignado a *
              </label>
              <select
                value={assignedToName}
                onChange={(e) => setAssignedToName(e.target.value)}
                className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 font-semibold text-[#0b1c30] focus:border-[#004ac6] focus:outline-none"
              >
                {systemUsers.map((u) => (
                  <option key={u.uid} value={u.displayName}>
                    {u.displayName} ({u.role.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Motivo Predefinido / Asunto */}
          <div>
            <label className="font-bold text-[#434655] block mb-1">Motivo / Asunto *</label>
            <select
              value={selectedTopic}
              onChange={(e) => handleTopicChange(e.target.value)}
              className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 font-semibold text-[#0b1c30] focus:border-[#004ac6] focus:outline-none"
            >
              {ISP_FAULT_TOPICS.map((item) => (
                <option key={item.topic} value={item.topic}>
                  {item.topic}
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
                className="w-full mt-2 bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 font-semibold text-[#0b1c30] focus:border-[#004ac6] focus:outline-none"
              />
            )}
          </div>

          {/* Detalle del Problema */}
          <div>
            <label className="font-bold text-[#434655] block mb-1">Descripción / Mensaje Inicial *</label>
            <textarea
              rows={4}
              required
              placeholder="Detalla la situación reportada por el cliente o detectada por monitoreo (niveles de señal, atenuación en dBm, alarma de corte, etc.)..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 text-[#0b1c30] focus:border-[#004ac6] focus:outline-none resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 flex justify-end gap-2 border-t border-[#e2e8f0]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-[#737686] hover:bg-[#f8f9ff] rounded-lg font-bold cursor-pointer transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-lg font-bold shadow-xs cursor-pointer transition-colors"
            >
              Generar Ticket
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
