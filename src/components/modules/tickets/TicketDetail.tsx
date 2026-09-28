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

// Canned Responses / Predefined ISP Replies (WHMCS Style)
const CANNED_RESPONSES = [
  {
    title: "Reinicio Eléctrico de ONT / Router",
    body: "Estimado cliente, para restablecer los parámetros de sesión y refrescar la tabla ARP de su router, por favor desconecte el adaptador de corriente de la ONT durante 30 segundos y vuelva a encenderlo. Esperaremos 3 minutos para validar la reconexión con nuestra cabecera OLT.",
  },
  {
    title: "Verificación de Potencia Óptica Normal",
    body: "Estimado abonado, hemos verificado desde el OLT los niveles de potencia óptica de su enlace, registrando valores dentro del rango estándar (-19 dBm a -23 dBm). Por favor confirme si en su equipo ONT la luz 'PON' se encuentra encendida en color verde fijo o si parpadea la luz 'LOS'.",
  },
  {
    title: "Despacho de Cuadrilla Técnica en Terreno",
    body: "Estimado abonado, se ha derivado su caso al departamento de Planta Externa con orden de trabajo prioritaria. Una cuadrilla técnica se trasladará a su domicilio para verificar la acometida de fibra óptica y el conector SC/APC. Nos comunicaremos previamente al número de contacto registrado.",
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
      <div className="bg-white rounded-2xl border border-[#e2e8f0] p-12 text-center shadow-2xs">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
        <h3 className="font-bold text-[#0b1c30]">Ticket no encontrado</h3>
        <p className="text-xs text-[#737686] mt-1 mb-4">
          La incidencia solicitada no existe o fue retirada del sistema.
        </p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-[#004ac6] text-white rounded-xl text-xs font-bold cursor-pointer"
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
            `NOTA DEL SISTEMA: Se escaló incidencia a orden de trabajo en cuadrilla de campo (Proyectos ISP) con prioridad ${ticket.priority.toUpperCase()}. Asignado a: ${ticket.assignedToName || "NOC Planta Externa"}.`,
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
    <div className="space-y-6 select-none animate-in fade-in duration-200">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs">
        <div className="flex items-start md:items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl border border-[#e2e8f0] bg-[#f8f9ff] hover:bg-[#eff4ff] text-[#004ac6] transition-colors cursor-pointer"
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

      {/* 2. Main Two-Column Layout (70% - 30%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================= */}
        {/* LEFT COLUMN: Assistance Thread & Reply Box (8 cols)        */}
        {/* ========================================================= */}
        <div className="lg:col-span-8 space-y-6">
          {/* WHMCS Reply Box */}
          <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
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

            {/* Note banner when in private note mode */}
            {replyMode === "note" && (
              <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-[11px] font-semibold flex items-center gap-2">
                <Lock className="w-3.5 h-3.5" />
                <span>
                  Esta nota técnica es <strong>PRIVADA</strong>: visible únicamente para administradores y técnicos NOC.
                </span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmitReply} className="p-4 space-y-3">
              <textarea
                rows={5}
                required
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                placeholder={
                  replyMode === "reply"
                    ? "Escribe la respuesta formal para el cliente/abonado..."
                    : "Escribe una nota interna para la cuadrilla (detalles de mufa, niveles de potencia, causas del corte)..."
                }
                className={`w-full p-3 rounded-xl border text-xs focus:outline-hidden transition-colors ${
                  replyMode === "note"
                    ? "bg-amber-50/40 border-amber-200 focus:border-amber-400 text-amber-950 placeholder-amber-700/50"
                    : "bg-[#f8f9ff] border-[#e2e8f0] focus:border-[#004ac6] text-[#0b1c30] placeholder-[#737686]"
                }`}
              />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#434655]">Actualizar Estado:</span>
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

          {/* Conversation History Thread */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-xs text-[#0b1c30] uppercase tracking-wider flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#004ac6]" />
                <span>Historial de Asistencia ({allMessages.length + 1})</span>
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
                  Todos ({allMessages.length + 1})
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
                  Notas Internas ({internalCount})
                </button>
              </div>
            </div>

            {/* Initial Client Request Message Card */}
            {(threadFilter === "todos" || threadFilter === "publicos") && (
              <div className="bg-white rounded-2xl border border-[#e2e8f0] p-4 shadow-2xs space-y-2">
                <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-[#f1f5f9] text-[#434655] flex items-center justify-center font-bold text-xs">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-xs text-[#0b1c30]">{ticket.clientName}</span>
                      <span className="ml-2 px-2 py-0.2 rounded-full text-[9px] font-bold bg-[#f1f5f9] text-[#434655]">
                        Abonado / Solicitud Inicial
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
                    className={`rounded-2xl p-4 transition-all shadow-2xs space-y-2 border ${
                      isInternal
                        ? "bg-amber-50/80 border-amber-200/90 text-amber-950"
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
                            className={`ml-2 px-2 py-0.2 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                              isInternal
                                ? "bg-amber-200 text-amber-900"
                                : isStaff
                                ? "bg-[#eff4ff] text-[#004ac6] border border-[#bfdbfe]"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {isInternal ? "Nota Interna Privada" : isStaff ? "Agente de Soporte" : "Cliente"}
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
              <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-4 shadow-2xs space-y-1 text-emerald-900">
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
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: Ticket Properties & Subscriber Dossier (4c) */}
        {/* ========================================================= */}
        <div className="lg:col-span-4 space-y-4">
          {/* Card 1: Ficha del Abonado */}
          <div className="bg-white rounded-2xl border border-[#e2e8f0] p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-2">
              <h4 className="font-bold text-xs text-[#0b1c30] flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-[#004ac6]" />
                <span>Ficha del Abonado</span>
              </h4>
              <Link
                href={`/abonados?id=${ticket.clientId}`}
                className="text-[11px] text-[#004ac6] hover:underline font-bold flex items-center gap-0.5"
              >
                <span>Ficha 360°</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <span className="text-[10px] text-[#737686] block">Razón Social:</span>
                <strong className="text-[#0b1c30]">{ticket.clientName}</strong>
              </div>

              {client?.identificationNumber && (
                <div>
                  <span className="text-[10px] text-[#737686] block">RUC / Cédula:</span>
                  <span className="font-mono font-semibold text-[#434655]">
                    {client.identificationNumber}
                  </span>
                </div>
              )}

              {(ticket.clientPhone || client?.phone) && (
                <div className="flex items-center gap-1.5 text-[#434655]">
                  <Phone className="w-3.5 h-3.5 text-[#737686]" />
                  <span>{ticket.clientPhone || client?.phone}</span>
                </div>
              )}

              {(ticket.clientEmail || client?.email) && (
                <div className="flex items-center gap-1.5 text-[#434655] truncate">
                  <Mail className="w-3.5 h-3.5 text-[#737686]" />
                  <span className="truncate">{ticket.clientEmail || client?.email}</span>
                </div>
              )}

              {(ticket.clientAddress || client?.address) && (
                <div className="flex items-start gap-1.5 text-[#434655]">
                  <MapPin className="w-3.5 h-3.5 text-[#737686] shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{ticket.clientAddress || client?.address}</span>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Servicio & Parámetros Técnicos */}
          <div className="bg-white rounded-2xl border border-[#e2e8f0] p-4 shadow-2xs space-y-3">
            <h4 className="font-bold text-xs text-[#0b1c30] flex items-center gap-1.5 border-b border-[#f1f5f9] pb-2">
              <Wifi className="w-4 h-4 text-[#004ac6]" />
              <span>Servicio Afectado</span>
            </h4>

            <div className="space-y-2 text-xs">
              <div>
                <span className="text-[10px] text-[#737686] block">Plan Contratado:</span>
                <strong className="text-[#004ac6]">{ticket.serviceName || service?.planName || "Internet Fibra Óptica"}</strong>
              </div>

              {ticket.nodeName && (
                <div>
                  <span className="text-[10px] text-[#737686] block">Nodo / POP:</span>
                  <span className="font-medium text-[#434655]">{ticket.nodeName}</span>
                </div>
              )}

              {service?.ipv4Address && (
                <div>
                  <span className="text-[10px] text-[#737686] block">IP Asignada:</span>
                  <span className="font-mono text-xs font-bold text-[#0b1c30]">{service.ipv4Address}</span>
                </div>
              )}

              {service?.ontSerialNumber && (
                <div>
                  <span className="text-[10px] text-[#737686] block">Serial ONT / Router:</span>
                  <span className="font-mono text-[11px] text-[#737686]">{service.ontSerialNumber}</span>
                </div>
              )}
            </div>
          </div>

          {/* Card 3: Propiedades del Ticket (Controles WHMCS) */}
          <div className="bg-white rounded-2xl border border-[#e2e8f0] p-4 shadow-2xs space-y-3">
            <h4 className="font-bold text-xs text-[#0b1c30] flex items-center gap-1.5 border-b border-[#f1f5f9] pb-2">
              <Layers className="w-4 h-4 text-[#004ac6]" />
              <span>Propiedades del Ticket</span>
            </h4>

            <div className="space-y-3 text-xs">
              {/* Department */}
              <div>
                <label className="text-[11px] font-bold text-[#434655] block mb-1">Departamento:</label>
                <select
                  value={ticket.department || "soporte_tecnico"}
                  onChange={(e) => handleUpdateProperty("department", e.target.value as TicketDepartment)}
                  className="w-full bg-[#f8f9ff] border border-[#cbd5e1] rounded-xl px-3 py-1.5 font-medium text-[#0b1c30] focus:outline-hidden"
                >
                  <option value="soporte_tecnico">Soporte Técnico NOC</option>
                  <option value="facturacion">Facturación & Cobranzas</option>
                  <option value="noc_redes">NOC / Planta Externa</option>
                  <option value="ventas">Ventas & Comercial</option>
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="text-[11px] font-bold text-[#434655] block mb-1">Prioridad SLA:</label>
                <select
                  value={ticket.priority}
                  onChange={(e) => handleUpdateProperty("priority", e.target.value as TicketPriority)}
                  className="w-full bg-[#f8f9ff] border border-[#cbd5e1] rounded-xl px-3 py-1.5 font-bold text-[#0b1c30] focus:outline-hidden"
                >
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                  <option value="critica">Crítica (SLA Inmediato)</option>
                </select>
              </div>

              {/* Assigned Staff */}
              <div>
                <label className="text-[11px] font-bold text-[#434655] block mb-1">Técnico Asignado:</label>
                <select
                  value={ticket.assignedToName || ""}
                  onChange={(e) => handleUpdateProperty("assignedToName", e.target.value)}
                  className="w-full bg-[#f8f9ff] border border-[#cbd5e1] rounded-xl px-3 py-1.5 font-medium text-[#0b1c30] focus:outline-hidden"
                >
                  {systemUsers.map((u) => (
                    <option key={u.uid} value={u.displayName}>
                      {u.displayName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Current Status */}
              <div>
                <label className="text-[11px] font-bold text-[#434655] block mb-1">Estado de Asistencia:</label>
                <select
                  value={ticket.status}
                  onChange={(e) => handleChangeStatus(e.target.value as TicketStatus)}
                  className="w-full bg-[#f8f9ff] border border-[#cbd5e1] rounded-xl px-3 py-1.5 font-bold text-[#0b1c30] focus:outline-hidden"
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

          {/* Card 4: Historial de Incidencias del Cliente */}
          <div className="bg-white rounded-2xl border border-[#e2e8f0] p-4 shadow-2xs space-y-3">
            <h4 className="font-bold text-xs text-[#0b1c30] flex items-center gap-1.5 border-b border-[#f1f5f9] pb-2">
              <Clock className="w-4 h-4 text-[#737686]" />
              <span>Otros Tickets del Cliente ({otherTickets.length})</span>
            </h4>

            {otherTickets.length === 0 ? (
              <p className="text-[11px] text-[#737686] italic">
                No hay otros tickets registrados para este cliente.
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {otherTickets.slice(0, 4).map((ot) => (
                  <div
                    key={ot.id}
                    className="p-2 rounded-xl bg-[#f8f9ff] border border-[#e2e8f0] space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-[#004ac6] text-[11px]">{ot.ticketNumber}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold uppercase ${
                          ot.status === "resuelto" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {ot.status}
                      </span>
                    </div>
                    <div className="font-medium text-[#0b1c30] line-clamp-1 text-[11px]">{ot.title}</div>
                    <div className="text-[10px] text-[#737686]">
                      {new Date(ot.createdAt).toLocaleDateString("es-EC")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
