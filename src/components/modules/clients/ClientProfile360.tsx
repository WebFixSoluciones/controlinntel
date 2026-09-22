"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { Client } from "@/types";
import { ClientProjectKanban } from "./ClientProjectKanban";
import { ClientQuotesManager } from "./ClientQuotesManager";
import { ClientVaultTab } from "./ClientVaultTab";
import { ServiceEditor } from "../settings/RecordManager";
import { ClientContractTab } from "./ClientContractTab";
import { ClientDossierTab } from "./ClientDossierTab";
import {
  X,
  User,
  Radio,
  KeyRound,
  ShieldCheck,
  FileSpreadsheet,
  DollarSign,
  Ticket as TicketIcon,
  Kanban,
  Printer,
  Edit2,
  Download,
  Copy,
  Check,
  Clock,
  Plus,
  AlertTriangle,
  CheckCircle2,
  ShoppingCart,
  ArrowLeft,
} from "lucide-react";

interface ClientProfile360Props {
  client: Client | null;
  onClose: () => void;
  onEdit?: () => void;
}

type ProfileTab =
  | "fiscal"
  | "red"
  | "boveda"
  | "contratos"
  | "cotizaciones"
  | "finanzas"
  | "tickets"
  | "proyectos"
  | "dossier";

export function ClientProfile360({ client, onClose, onEdit }: ClientProfile360Props) {
  const { clientServices, monthlyCharges, tickets, clientProjects, clientQuotes, clientVaultItems, clientContracts, markChargeAsPaid } = useApp();
  const { showSuccess, showConfirm } = useToast();

  const [activeTab, setActiveTab] = useState<ProfileTab>("fiscal");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!client) return null;

  const services = clientServices.filter((s) => s.clientId === client.id);
  const charges = monthlyCharges.filter((c) => c.clientId === client.id);
  const clientTickets = tickets.filter((t) => t.clientId === client.id);
  const projects = clientProjects.filter((p) => p.clientId === client.id);
  const quotes = clientQuotes.filter((q) => q.clientId === client.id);
  const vaultItems = clientVaultItems.filter((v) => v.clientId === client.id);
  const contracts = clientContracts.filter((c) => c.clientId === client.id);

  const totalMonthlySpend = services.reduce((sum, s) => sum + s.customPrice, 0);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    showSuccess("Copiado", `${label} copiado al portapapeles.`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handlePayCharge = (chargeId: string) => {
    showConfirm(
      "¿Registrar Cobro?",
      "¿Confirmas el registro del pago para este comprobante?",
      async () => {
    try {

        await markChargeAsPaid(chargeId, "transferencia");
        showSuccess("Pago Registrado", "Comprobante marcado como PAGADO.");
      
    } catch (error) { window.dispatchEvent(new CustomEvent("inntel:error", { detail: error instanceof Error ? error.message : "No se pudo guardar." })); }
},
      "Registrar Pago"
    );
  };

  const tabs: { id: ProfileTab; label: string; icon: any; count?: number }[] = [
    { id: "fiscal", label: "Identificación", icon: User },
    { id: "red", label: "Red & IP", icon: Radio, count: services.length },
    { id: "boveda", label: "Bóveda", icon: KeyRound, count: vaultItems.length },
    { id: "contratos", label: "Contratos", icon: ShieldCheck, count: contracts.length },
    { id: "cotizaciones", label: "Cotizaciones", icon: FileSpreadsheet, count: quotes.length },
    { id: "finanzas", label: "Cobros", icon: DollarSign, count: charges.length },
    { id: "tickets", label: "Tickets", icon: TicketIcon, count: clientTickets.length },
    { id: "proyectos", label: "Obras", icon: Kanban, count: projects.length },
    { id: "dossier", label: "Informe 360°", icon: Printer },
  ];

  return (
    <div className="w-full space-y-4 animate-in fade-in duration-200 select-none">
      {/* Barra Superior de Navegación & Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 px-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver al Listado de Clientes</span>
          </button>
          <span className="text-slate-300">/</span>
          <span className="text-xs font-medium text-slate-500">Módulo Clientes</span>
          <span className="text-slate-300">/</span>
          <span className="text-xs font-bold text-slate-900 truncate max-w-sm">{client.businessName}</span>
        </div>

        <div className="flex items-center gap-2">
          {onEdit && (
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Editar Ficha</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>Cerrar Ficha</span>
          </button>
        </div>
      </div>

      {/* Contenedor Principal de la Ficha en Pantalla Completa */}
      <div className="w-full bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[calc(100vh-14rem)]">
        {/* Hub Header */}
        <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-sky-50/40 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-600 to-indigo-700 text-white flex items-center justify-center font-black text-xl shadow-sm">
              {client.businessName.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg font-black text-slate-900 tracking-tight">{client.businessName}</h1>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                    client.status === "activo"
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                      : "bg-rose-100 text-rose-800 border border-rose-200"
                  }`}
                >
                  {client.status}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1 font-medium">
                <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                  {client.identificationType}: {client.identificationNumber}
                </span>
                <span>•</span>
                <span>{client.address}</span>
                <span>•</span>
                <span className="text-emerald-700 font-bold font-mono">
                  ${totalMonthlySpend.toFixed(2)} USD/mes
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation Ribbon - Compact & High Contrast */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-slate-200 bg-slate-100/90 overflow-x-auto scrollbar-thin">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer select-none ${
                  isActive
                    ? "bg-[#004ac6] text-white shadow-sm border border-[#003da6]"
                    : "bg-white text-slate-700 hover:text-[#0b1c30] hover:bg-slate-50 border border-slate-300 shadow-2xs"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-white" : "text-slate-600"}`} />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold font-mono ${
                      isActive
                        ? "bg-white/25 text-white border border-white/30"
                        : "bg-slate-100 text-slate-800 border border-slate-300"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content Body */}
        <div className="p-6 flex-1 overflow-y-auto bg-slate-50/40">
          {/* TAB 1: FISCAL & LEGAL */}
          {activeTab === "fiscal" && (
            <div className="space-y-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
                  Datos de Identificación & Contacto Oficial
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block">Razón Social / Abonado</label>
                    <span className="font-bold text-slate-900 text-sm">{client.businessName}</span>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block">Documento de Identificación</label>
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {client.identificationType} {client.identificationNumber}
                    </span>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block">Representante Legal</label>
                    <span className="font-medium text-slate-800">{client.legalRepresentative || "No aplica"}</span>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block">Correo Electrónico</label>
                    <span className="font-medium text-slate-800 flex items-center justify-between">
                      {client.email}
                      <button
                        onClick={() => handleCopy(client.email, "Email")}
                        className="p-1 text-slate-400 hover:text-sky-600 cursor-pointer"
                      >
                        {copiedField === "Email" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </span>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block">Teléfono / WhatsApp</label>
                    <span className="font-medium text-slate-800 flex items-center justify-between">
                      {client.phone}
                      <button
                        onClick={() => handleCopy(client.phone, "Teléfono")}
                        className="p-1 text-slate-400 hover:text-sky-600 cursor-pointer"
                      >
                        {copiedField === "Teléfono" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </span>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block">Sector / Zona</label>
                    <span className="font-medium text-slate-800">{client.sector || "Sector Matriz"}</span>
                  </div>

                  <div className="col-span-full">
                    <label className="text-[10px] text-slate-400 font-bold block">Dirección de Instalación</label>
                    <span className="font-medium text-slate-800">{client.address}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: RED & MIKROTIK */}
          {activeTab === "red" && <ServiceEditor clientId={client.id} />}
          {activeTab === "red" && (
            <div className="space-y-4">
              {services.length === 0 ? (
                <div className="py-12 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                  <Radio className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-bold text-slate-600 text-xs">Sin servicios de red activos</p>
                </div>
              ) : (
                services.map((srv) => (
                  <div key={srv.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{srv.planName}</h4>
                        <p className="text-[11px] text-slate-400">
                          Instalado el {srv.installationDate} • Nodo: <span className="font-bold text-slate-700">{srv.nodeName}</span>
                        </p>
                      </div>
                      <span className="font-mono text-base font-black text-emerald-700">${srv.customPrice.toFixed(2)} USD/mes</span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <label className="text-[10px] text-slate-400 font-bold block">Velocidad</label>
                        <span className="font-bold text-slate-800">{srv.downloadMbps} Mbps Bajada / {srv.uploadMbps} Mbps Subida</span>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <label className="text-[10px] text-slate-400 font-bold block">Dirección IPv4</label>
                        <span className="font-mono font-bold text-sky-700">{srv.ipv4Address}</span>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <label className="text-[10px] text-slate-400 font-bold block">Usuario PPPoE</label>
                        <span className="font-mono font-medium text-slate-800">{srv.pppoeUser}</span>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <label className="text-[10px] text-slate-400 font-bold block">Corte Mensual</label>
                        <span className="font-bold text-slate-800">Día {srv.cutoffDay} de cada mes</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: BOVEDA DE CLAVES */}
          {activeTab === "boveda" && <ClientVaultTab client={client} />}

          {/* TAB 4: CONTRATOS & ARCOTEL */}
          {activeTab === "contratos" && <ClientContractTab client={client} />}

          {/* TAB 5: COTIZACIONES & ORDENES */}
          {activeTab === "cotizaciones" && <ClientQuotesManager client={client} />}

          {/* TAB 6: FINANZAS & COBROS */}
          {activeTab === "finanzas" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
                <div>
                  <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    Historial de Cobros & Pre-Facturas Internas
                  </h4>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Comprobante</th>
                      <th className="py-3 px-4">Periodo</th>
                      <th className="py-3 px-4">Descripción</th>
                      <th className="py-3 px-4">Total</th>
                      <th className="py-3 px-4">Estado</th>
                      <th className="py-3 px-4 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {charges.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                          Sin cobros registrados para este abonado.
                        </td>
                      </tr>
                    ) : (
                      charges.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50/70">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">{c.invoiceNumber}</td>
                          <td className="py-3 px-4 font-semibold">{c.month}/{c.year}</td>
                          <td className="py-3 px-4 text-slate-600">{c.serviceDescription}</td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">${c.total.toFixed(2)}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                c.status === "pagado"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {c.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {c.status === "pendiente" && (
                              <button
                                onClick={() => handlePayCharge(c.id)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                              >
                                Cobrar
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 7: TICKETS NOC */}
          {activeTab === "tickets" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
                <div>
                  <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                    <TicketIcon className="w-4 h-4 text-sky-600" />
                    Incidencias Técnicas & Tickets de Soporte
                  </h4>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {clientTickets.length === 0 ? (
                  <div className="col-span-full py-10 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                    <TicketIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-bold text-slate-600 text-xs">Sin incidencias técnicas registradas</p>
                  </div>
                ) : (
                  clientTickets.map((t) => (
                    <div key={t.id} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-mono text-xs font-bold text-sky-700">{t.ticketNumber}</span>
                        <span
                          className={`px-2 py-0.2 rounded-full text-[10px] font-bold uppercase ${
                            t.status === "resuelto"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {t.status.replace("_", " ")}
                        </span>
                      </div>
                      <h5 className="font-bold text-xs text-slate-900">{t.title}</h5>
                      <p className="text-[11px] text-slate-500">{t.description}</p>
                      <div className="pt-2 border-t border-slate-100 flex justify-between text-[10px] text-slate-400">
                        <span>SLA: {t.priority.toUpperCase()}</span>
                        <span>{t.createdAt.split("T")[0]}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 8: PROYECTOS / KANBAN TRELLO */}
          {activeTab === "proyectos" && <ClientProjectKanban client={client} />}

          {/* TAB 9: DOSSIER TECNICO INTEGRAL */}
          {activeTab === "dossier" && <ClientDossierTab client={client} />}
        </div>
      </div>
    </div>
  );
}
