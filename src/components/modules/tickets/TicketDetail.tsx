"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import {
  Ticket,
  TicketStatus,
  TicketPriority,
  TicketDepartment,
  TicketMessage,
} from "@/types";
import {
  ArrowLeft,
  Send,
  Lock,
  MessageSquare,
  User,
  ShieldAlert,
  Building2,
  Phone,
  Mail,
  MapPin,
  Wifi,
  ExternalLink,
  CheckCircle2,
  Clock,
  RotateCcw,
  Sparkles,
  Layers,
  Calendar,
  AlertTriangle,
  Radio,
  Share2,
} from "lucide-react";

interface TicketDetailProps {
  id: string;
  onBack: () => void;
}

// Respuestas predefinidas de soporte técnico
const CANNED_RESPONSES = [
  {
    title: "Reinicio Eléctrico de ONT / Router",
    body: "Estimado cliente, para restablecer los parámetros de sesión y refrescar la tabla ARP de su router, por favor desconecte el adaptador de corriente de la ONT durante 30 segundos y vuelva a encenderlo. Esperaremos 3 minutos para validar la reconexión con nuestra cabecera OLT.",
  },
  {
    title: "Verificación de Potencia Óptica Normal",
    body: "Estimado cliente, hemos verificado desde el OLT los niveles de potencia óptica de su enlace, registrando valores dentro del rango estándar (-19 dBm a -23 dBm). Por favor confirme si en su equipo ONT la luz 'PON' se encuentra encendida en color verde fijo o si parpadea la luz 'LOS'.",
  },
  {
    title: "Despacho de Cuadrilla Técnica en Terreno",
    body: "Estimado cliente, se ha derivado su caso al departamento de Planta Externa con orden de trabajo prioritaria. Una cuadrilla técnica se trasladará a su domicilio para verificar la acometida de fibra óptica y el conector SC/APC. Nos comunicaremos previamente al número de contacto registrado.",
  },
  {
    title: "Interrupción de Servicio por Falla Masiva",
    body: "Le informamos que se ha detectado una afectación general en la troncal de fibra óptica de su sector. Personal de emergencia NOC ya se encuentra en sitio realizando empalmes de reposición. El tiempo estimado de normalización es de 1 a 2 horas. Agradecemos su comprensión.",
  },
  {
    title: "Configuración de Red WiFi / Contraseña",
    body: "Hemos verificado la configuración de radiofrecuencia (2.4 GHz y 5 GHz) de su router inalámbrico. Se han optimizado los canales de transmisión para evitar interferencias vecinales. Por favor verifique si el inconveniente de lentitud persiste.",
  },
  {
    title: "Confirmación de Servicio y Cierre",
    body: "Estimado cliente, validamos que su enlace se encuentra 100% operativo con tráfico bidireccional continuo y latencia nominal óptima. Procedemos al cierre del presente ticket de asistencia técnica. Gracias por confiar en INNTEL CORP.",
  },
];

export function TicketDetail({ id, onBack }: TicketDetailProps) {
  const {
    tickets,
    clients,
    clientServices,
    systemUsers,
    replyToTicket,
    updateTicketStatus,
    updateTicketDetails,
    addClientProjectTask,
  } = useApp();
  const { showSuccess, showError, showConfirm } = useToast();

  const ticket = tickets.find((t) => t.id === id);
  const client = clients.find((c) => c.id === ticket?.clientId);
  const service = clientServices.find((s) => s.clientId === ticket?.clientId);

  // Assistance / Reply Box State
  const [replyMode, setReplyMode] = useState<"reply" | "note">("reply");
  const [replyBody, setReplyBody] = useState("");
  const [replyStatus, setReplyStatus] = useState<TicketStatus>(
    ticket?.status === "abierto" ? "respondido" : ticket?.status || "en_progreso"
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Thread filter
  const [threadFilter, setThreadFilter] = useState<"todos" | "publicos" | "internos">("todos");

  // Other tickets for this client
  const otherTickets = useMemo(() => {
    if (!ticket) return [];
    return tickets.filter((t) => t.clientId === ticket.clientId && t.id !== ticket.id);
  }, [tickets, ticket]);

  if (!ticket) {
    return (
      <div className="bg-white rounded-xl border border-[#e2e8f0] p-12 text-center shadow-2xs">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
        <h3 className="font-bold text-[#0b1c30]">Ticket no encontrado</h3>
        <p className="text-xs text-[#737686] mt-1 mb-4">
          La incidencia solicitada no existe o fue retirada del sistema.
        </p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-[#004ac6] text-white rounded-lg text-xs font-bold cursor-pointer"
        >
          Volver a Tickets
        </button>
      </div>
    );
  }

  // Handle Reply or Internal Note submission
  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyBody.trim()) {
      showError("Campo Vacío", "Por favor redacta un mensaje o nota antes de enviar.");
      return;
    }

    setIsSubmitting(true);
    try {
      const isInternal = replyMode === "note";
      await replyToTicket(ticket.id, replyBody.trim(), isInternal, replyStatus);

      if (isInternal) {
        showSuccess("Nota Interna Guardada", "La nota técnica privada se registró en el expediente.");
      } else {
        showSuccess("Respuesta Enviada", "La asistencia fue registrada en el historial del ticket.");
      }

      setReplyBody("");
    } catch (err: any) {
      showError("Error al Guardar", err?.message || "No se pudo procesar la respuesta.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Action: Escalate to Technical Field Squad (Project Task)
  const handleEscalateToProject = () => {
    showConfirm(
      "¿Escalar a Cuadrilla Técnica de Campo?",
      `Se creará una orden de trabajo técnica en el tablero de Proyectos vinculada al cliente "${ticket.clientName}" y al ticket ${ticket.ticketNumber}.`,
      async () => {
        try {
          await addClientProjectTask({
            clientId: ticket.clientId,
            clientName: ticket.clientName,
            title: `[${ticket.ticketNumber}] ${ticket.title}`,
            description: `Escalado desde Soporte Asistido.\nReporte: ${ticket.description}\nPrioridad: ${ticket.priority.toUpperCase()}`,
            column: "factibilidad",
            priority: ticket.priority === "critica" ? "urgente" : ticket.priority,
            assignedTo: ticket.assignedToName || "Cuadrilla NOC Planta Externa",
            boardFlow: "isp_tecnico",
            startDate: new Date().toISOString(),
            dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            checklist: [
              { id: "chk-1", text: "Inspección de acometida y splitter óptico", done: false },
              { id: "chk-2", text: "Medición de potencia dBm con Power Meter", done: false },
              { id: "chk-3", text: "Prueba de navegación y firma de acta técnica", done: false },
            ],
          });

          // Add automated internal note to ticket
          await replyToTicket(
            ticket.id,
            `NOTA DEL SISTEMA: Se escaló incidencia a orden de trabajo en cuadrilla de campo (Proyectos) con prioridad ${ticket.priority.toUpperCase()}. Asignado a: ${ticket.assignedToName || "NOC Planta Externa"}.`,
            true,
            "en_progreso"
          );

          showSuccess("Incidencia Escalada", "Se generó la tarea de cuadrilla en Proyectos.");
        } catch (err: any) {
          showError("Error al Escalar", err?.message);
        }
      },
      "Escalar a Cuadrilla"
    );
  };

  // Quick Status Change
  const handleChangeStatus = async (newStatus: TicketStatus) => {
    try {
      await updateTicketStatus(ticket.id, newStatus);
      showSuccess("Estado Actualizado", `El ticket ${ticket.ticketNumber} ahora está "${newStatus.toUpperCase()}".`);
    } catch (err: any) {
      showError("Error", err?.message);
    }
  };

  // Property updates
  const handleUpdateProperty = async (field: keyof Ticket, value: any) => {
    try {
      await updateTicketDetails(ticket.id, { [field]: value });
      showSuccess("Ticket Actualizado", `Se guardó el cambio de ${field}.`);
    } catch (err: any) {
      showError("Error", err?.message);
    }
  };

  // Canned response selection
  const handleSelectCanned = (body: string) => {
    setReplyBody((prev) => (prev ? prev + "\n\n" + body : body));
  };

  // Filter messages
  const allMessages = ticket.messages || [];
  const filteredMessages = allMessages.filter((m) => {
    if (threadFilter === "publicos") return !m.isInternal;
    if (threadFilter === "internos") return !!m.isInternal;
    return true;
  });

  const internalCount = allMessages.filter((m) => m.isInternal).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-white rounded-xl border border-[#e2e8f0] shadow-2xs">
        <div className="flex items-start md:items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg border border-[#e2e8f0] bg-[#f8f9ff] hover:bg-[#eff4ff] text-[#004ac6] transition-colors cursor-pointer"
            title="Volver a la lista de tickets"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-black text-[#004ac6] bg-[#eff4ff] px-2.5 py-0.5 rounded-lg border border-[#bfdbfe]">
                {ticket.ticketNumber}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  ticket.status === "abierto"
                    ? "bg-rose-50 text-rose-700 border border-rose-200"
                    : ticket.status === "en_progreso"
                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                    : ticket.status === "respondido"
                    ? "bg-purple-50 text-purple-700 border border-purple-200"
                    : ticket.status === "en_espera"
                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                }`}
              >
                {ticket.status.replace(/_/g, " ")}
              </span>

              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                  ticket.priority === "critica"
                    ? "bg-rose-100 text-rose-800"
                    : ticket.priority === "alta"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                SLA: {ticket.priority}
              </span>
            </div>

            <h2 className="text-base font-bold text-[#0b1c30] mt-1 line-clamp-1">
              {ticket.title}
            </h2>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {client?.phone && (
            <a
              href={`https://wa.me/${client.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                `Estimado cliente ${client.businessName}, le contactamos de INNTEL CORP respecto al ticket ${ticket.ticketNumber} (${ticket.title}).`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-colors cursor-pointer"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </a>
          )}

          <button
            onClick={handleEscalateToProject}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-sky-200 bg-sky-50 hover:bg-sky-100 text-[#004ac6] text-xs font-bold transition-colors cursor-pointer"
            title="Crear tarea de cuadrilla en Proyectos"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Escalar a Cuadrilla</span>
          </button>

          {ticket.status !== "resuelto" && ticket.status !== "cerrado" ? (
            <button
              onClick={() => handleChangeStatus("resuelto")}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-2xs cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Resolver Ticket</span>
            </button>
          ) : (
            <button
              onClick={() => handleChangeStatus("abierto")}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-[#434655] text-xs font-bold transition-colors shadow-2xs cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reabrir Ticket</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Main Two-Column Layout (70% - 30%) - Clean Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================= */}
        {/* LEFT COLUMN: Assistance Thread & Foot Reply Box (8 cols)   */}
        {/* ========================================================= */}
        <div className="lg:col-span-8 space-y-5">
          {/* Conversation History Thread */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-xs text-[#0b1c30] uppercase tracking-wider flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#004ac6]" />
                <span>Historial de Asistencia</span>
              </h3>

              <div className="flex items-center gap-1 p-1 bg-[#f8f9ff] rounded-xl border border-[#e2e8f0] text-xs">
                <button
                  onClick={() => setThreadFilter("todos")}
                  className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-colors ${
                    threadFilter === "todos"
                      ? "bg-[#004ac6] text-white"
                      : "text-[#737686] hover:text-[#0b1c30]"
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setThreadFilter("publicos")}
                  className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-colors ${
                    threadFilter === "publicos"
                      ? "bg-[#004ac6] text-white"
                      : "text-[#737686] hover:text-[#0b1c30]"
                  }`}
                >
                  Respuestas Cliente
                </button>
                <button
                  onClick={() => setThreadFilter("internos")}
                  className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-colors ${
                    threadFilter === "internos"
                      ? "bg-amber-600 text-white"
                      : "text-[#737686] hover:text-[#0b1c30]"
                  }`}
                >
                  Notas Internas
                </button>
              </div>
            </div>

            {/* Initial Client Request Message Card */}
            {(threadFilter === "todos" || threadFilter === "publicos") && (
              <div className="bg-white rounded-xl border border-[#e2e8f0] p-4 shadow-2xs space-y-2">
                <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-[#f1f5f9] text-[#434655] flex items-center justify-center font-bold text-xs">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-xs text-[#0b1c30]">{ticket.clientName}</span>
                      <span className="ml-2 px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#f1f5f9] text-[#434655]">
                        Cliente / Solicitud Inicial
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] text-[#737686] font-mono">
                    {new Date(ticket.createdAt).toLocaleString("es-EC")}
                  </span>
                </div>
                <p className="text-xs text-[#434655] whitespace-pre-wrap leading-relaxed pt-1">
                  {ticket.description}
                </p>
              </div>
            )}

            {/* Messages Stream */}
            <div className="space-y-3.5">
              {filteredMessages.map((m) => {
                const isInternal = !!m.isInternal;
                const isStaff = m.authorRole === "staff" || m.authorRole === "admin" || m.authorRole === "tecnico";

                return (
                  <div
                    key={m.id}
                    className={`rounded-xl p-4 transition-all shadow-2xs space-y-2 border ${
                      isInternal
                        ? "bg-amber-50/70 border-amber-200/80 text-amber-950"
                        : isStaff
                        ? "bg-[#f8f9ff] border-[#bfdbfe]/80 text-[#0b1c30]"
                        : "bg-white border-[#e2e8f0] text-[#0b1c30]"
                    }`}
                  >
                    <div className="flex items-center justify-between border-b pb-2 border-inherit/40">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                            isInternal
                              ? "bg-amber-200 text-amber-900"
                              : isStaff
                              ? "bg-[#004ac6] text-white"
                              : "bg-[#f1f5f9] text-[#434655]"
                          }`}
                        >
                          {isInternal ? <Lock className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                        </div>

                        <div>
                          <span className="font-bold text-xs">{m.authorName}</span>
                          <span
                            className={`ml-2 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                              isInternal
                                ? "bg-amber-200 text-amber-900"
                                : isStaff
                                ? "bg-[#eff4ff] text-[#004ac6] border border-[#bfdbfe]"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {isInternal ? "Nota Interna" : isStaff ? "Agente de Soporte" : "Cliente"}
                          </span>
                        </div>
                      </div>

                      <span className="text-[11px] text-[#737686] font-mono">
                        {new Date(m.createdAt).toLocaleString("es-EC")}
                      </span>
                    </div>

                    <p className="text-xs whitespace-pre-wrap leading-relaxed pt-1">{m.body}</p>
                  </div>
                );
              })}
            </div>

            {/* Resolution Note if ticket is resolved */}
            {ticket.resolutionNotes && (
              <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4 shadow-2xs space-y-1 text-emerald-900">
                <div className="flex items-center gap-2 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Nota de Resolución & Cierre Técnico</span>
                </div>
                <p className="text-xs pt-1 leading-relaxed">{ticket.resolutionNotes}</p>
                {ticket.resolvedAt && (
                  <span className="text-[10px] text-emerald-700 font-mono block pt-1">
                    Cerrado el: {new Date(ticket.resolvedAt).toLocaleString("es-EC")}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Clean Workspace Foot Reply Box */}
          <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
            {/* Box Tabs: Reply vs Internal Note */}
            <div className="flex items-center justify-between border-b border-[#e2e8f0] bg-[#f8f9ff] px-4 py-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setReplyMode("reply")}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    replyMode === "reply"
                      ? "bg-white text-[#004ac6] border border-[#bfdbfe] shadow-2xs"
                      : "text-[#737686] hover:text-[#0b1c30]"
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Responder al Cliente</span>
                </button>

                <button
                  type="button"
                  onClick={() => setReplyMode("note")}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    replyMode === "note"
                      ? "bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs"
                      : "text-[#737686] hover:text-[#0b1c30]"
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Nota Interna Privada</span>
                </button>
              </div>

              {/* Predefined Canned Responses */}
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#004ac6]" />
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleSelectCanned(e.target.value);
                      e.target.value = "";
                    }
                  }}
                  className="px-2.5 py-1 bg-white border border-[#cbd5e1] rounded-lg text-xs font-semibold text-[#434655] focus:outline-hidden cursor-pointer"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Respuestas Rápidas (Canned)...
                  </option>
                  {CANNED_RESPONSES.map((r, idx) => (
                    <option key={idx} value={r.body}>
                      {r.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitReply} className="p-4 space-y-3">
              <textarea
                rows={4}
                required
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    if (!isSubmitting && replyBody.trim()) {
                      handleSubmitReply(e as any);
                    }
                  }
                }}
                placeholder={
                  replyMode === "reply"
                    ? "Escribe la respuesta formal para el cliente... (Ctrl + Enter para enviar)"
                    : "Escribe una nota interna para la cuadrilla y soporte NOC... (Ctrl + Enter para guardar)"
                }
                className={`w-full p-3 rounded-xl border text-xs focus:outline-hidden transition-colors ${
                  replyMode === "note"
                    ? "bg-amber-50/40 border-amber-200 focus:border-amber-400 text-amber-950 placeholder-amber-700/50"
                    : "bg-[#f8f9ff] border-[#e2e8f0] focus:border-[#004ac6] text-[#0b1c30] placeholder-[#737686]"
                }`}
              />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#434655]">Estado:</span>
                  <select
                    value={replyStatus}
                    onChange={(e) => setReplyStatus(e.target.value as TicketStatus)}
                    className="px-3 py-1.5 bg-white border border-[#cbd5e1] rounded-xl text-xs font-semibold text-[#0b1c30] focus:outline-hidden cursor-pointer"
                  >
                    <option value="respondido">Respondido</option>
                    <option value="en_progreso">En Progreso</option>
                    <option value="en_espera">En Espera</option>
                    <option value="resuelto">Resuelto</option>
                    <option value="cerrado">Cerrado</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !replyBody.trim()}
                  className={`flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white shadow-xs transition-all cursor-pointer disabled:opacity-50 ${
                    replyMode === "note"
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-[#004ac6] hover:bg-[#003da6]"
                  }`}
                >
                  {replyMode === "note" ? <Lock className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                  <span>{isSubmitting ? "Guardando..." : replyMode === "note" ? "Guardar Nota Interna" : "Enviar Respuesta"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: Unified Context Panel (Single Card, 4 cols)  */}
        {/* ========================================================= */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-5 shadow-2xs divide-y divide-[#f1f5f9] space-y-4">
            {/* Header del Panel */}
            <div className="flex items-center justify-between pb-3">
              <h4 className="font-bold text-xs text-[#0b1c30] flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#004ac6]" />
                <span>Información del Caso</span>
              </h4>
              <Link
                href={`/clientes?id=${ticket.clientId}`}
                className="text-[11px] text-[#004ac6] hover:underline font-bold flex items-center gap-1"
              >
                <span>Ficha 360°</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>

            {/* Bloque 1: Cliente & Contacto */}
            <div className="pt-3 space-y-2 text-xs">
              <div className="font-bold text-sm text-[#0b1c30] leading-snug">
                {ticket.clientName}
              </div>
              {client?.identificationNumber && (
                <div className="text-[11px] text-[#737686] font-mono">
                  RUC / CI: <span className="font-bold text-[#434655]">{client.identificationNumber}</span>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3 pt-1 text-[#434655]">
                {(ticket.clientPhone || client?.phone) && (
                  <a
                    href={`tel:${ticket.clientPhone || client?.phone}`}
                    className="flex items-center gap-1.5 hover:text-[#004ac6] transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5 text-[#004ac6]" />
                    <span>{ticket.clientPhone || client?.phone}</span>
                  </a>
                )}
                {(ticket.clientEmail || client?.email) && (
                  <a
                    href={`mailto:${ticket.clientEmail || client?.email}`}
                    className="flex items-center gap-1.5 hover:text-[#004ac6] transition-colors truncate max-w-[200px]"
                    title={ticket.clientEmail || client?.email}
                  >
                    <Mail className="w-3.5 h-3.5 text-[#004ac6]" />
                    <span className="truncate">{ticket.clientEmail || client?.email}</span>
                  </a>
                )}
              </div>
              {(ticket.clientAddress || client?.address) && (
                <div className="flex items-start gap-1.5 text-[11px] text-[#737686] pt-1">
                  <MapPin className="w-3.5 h-3.5 text-[#737686] shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{ticket.clientAddress || client?.address}</span>
                </div>
              )}
            </div>

            {/* Bloque 2: Parámetros del Servicio */}
            <div className="pt-3 space-y-2.5 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-xs text-[#0b1c30]">
                <Wifi className="w-3.5 h-3.5 text-[#004ac6]" />
                <span>Servicio Afectado</span>
              </div>
              <div className="bg-[#f8f9ff] p-3 rounded-xl border border-[#e2e8f0] space-y-1.5">
                <div className="font-bold text-[#004ac6]">
                  {ticket.serviceName || service?.planName || "Internet Fibra Óptica"}
                </div>
                {service?.ipv4Address && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#737686]">IP Asignada:</span>
                    <span className="font-mono font-bold text-[#0b1c30] bg-white px-2 py-0.5 rounded-md border border-[#cbd5e1]">
                      {service.ipv4Address}
                    </span>
                  </div>
                )}
                {ticket.nodeName && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#737686]">POP / Nodo:</span>
                    <span className="font-medium text-[#434655]">{ticket.nodeName}</span>
                  </div>
                )}
                {service?.ontSerialNumber && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#737686]">ONT / Serial:</span>
                    <span className="font-mono text-[#737686]">{service.ontSerialNumber}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Bloque 3: Propiedades y Asignación */}
            <div className="pt-3 space-y-3 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-xs text-[#0b1c30]">
                <Layers className="w-3.5 h-3.5 text-[#004ac6]" />
                <span>Gestión y SLA</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-[#737686] block mb-1">Departamento:</label>
                  <select
                    value={ticket.department || "soporte_tecnico"}
                    onChange={(e) => handleUpdateProperty("department", e.target.value as TicketDepartment)}
                    className="w-full bg-[#f8f9ff] border border-[#cbd5e1] rounded-xl px-2.5 py-1.5 font-medium text-[#0b1c30] focus:outline-hidden text-xs"
                  >
                    <option value="soporte_tecnico">Soporte NOC</option>
                    <option value="facturacion">Facturación</option>
                    <option value="noc_redes">Planta Externa</option>
                    <option value="ventas">Comercial</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#737686] block mb-1">Prioridad:</label>
                  <select
                    value={ticket.priority}
                    onChange={(e) => handleUpdateProperty("priority", e.target.value as TicketPriority)}
                    className="w-full bg-[#f8f9ff] border border-[#cbd5e1] rounded-xl px-2.5 py-1.5 font-bold text-[#0b1c30] focus:outline-hidden text-xs"
                  >
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                    <option value="critica">Crítica (SLA)</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-[#737686] block mb-1">Técnico Asignado:</label>
                  <select
                    value={ticket.assignedToName || ""}
                    onChange={(e) => handleUpdateProperty("assignedToName", e.target.value)}
                    className="w-full bg-[#f8f9ff] border border-[#cbd5e1] rounded-xl px-3 py-1.5 font-medium text-[#0b1c30] focus:outline-hidden text-xs"
                  >
                    {systemUsers.map((u) => (
                      <option key={u.uid} value={u.displayName}>
                        {u.displayName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-[#737686] block mb-1">Estado del Ticket:</label>
                  <select
                    value={ticket.status}
                    onChange={(e) => handleChangeStatus(e.target.value as TicketStatus)}
                    className="w-full bg-[#f8f9ff] border border-[#cbd5e1] rounded-xl px-3 py-1.5 font-bold text-[#0b1c30] focus:outline-hidden text-xs"
                  >
                    <option value="abierto">Abierto</option>
                    <option value="en_progreso">En Progreso</option>
                    <option value="respondido">Respondido</option>
                    <option value="en_espera">En Espera</option>
                    <option value="resuelto">Resuelto</option>
                    <option value="cerrado">Cerrado</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Bloque 4: Otros Tickets del Cliente */}
            <div className="pt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between text-[11px] font-bold text-[#737686]">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#737686]" />
                  <span>Tickets Recientes</span>
                </span>
                <span>{otherTickets.length}</span>
              </div>
              {otherTickets.length === 0 ? (
                <p className="text-[11px] text-[#737686] italic">Sin otros tickets registrados.</p>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {otherTickets.slice(0, 3).map((ot) => (
                    <div
                      key={ot.id}
                      className="p-2 rounded-xl bg-[#f8f9ff] border border-[#e2e8f0] flex items-center justify-between text-xs"
                    >
                      <span className="font-mono font-bold text-[#004ac6] text-[11px]">{ot.ticketNumber}</span>
                      <span className="text-[10px] font-bold text-[#737686] capitalize">{ot.status.replace(/_/g, " ")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
