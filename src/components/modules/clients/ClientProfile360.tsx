"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { Client } from "@/types";
import { can, tabPermissions } from "@/lib/permissions";
import { ClientProjectKanban } from "./ClientProjectKanban";
import { ClientQuotesManager } from "./ClientQuotesManager";
import { ClientVaultTab } from "./ClientVaultTab";
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
  Globe,
  Key,
  Eye,
  EyeOff,
  ShieldAlert,
  ArrowLeft,
  Server,
  AlertCircle,
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
  const {
    clientServices,
    monthlyCharges,
    tickets,
    clientProjects,
    clientQuotes,
    clientVaultItems,
    clientContracts,
    nodes,
    currentUser,
    markChargeAsPaid,
  } = useApp();
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
        } catch (error) {
          window.dispatchEvent(
            new CustomEvent("inntel:error", {
              detail: error instanceof Error ? error.message : "No se pudo guardar.",
            })
          );
        }
      },
      "Registrar Pago"
    );
  };

  const allTabs: { id: ProfileTab; label: string; icon: any; count?: number; permission: string }[] = [
    { id: "fiscal", label: "Identificación", icon: User, permission: "manage_clients" },
    { id: "red", label: "Red & IP", icon: Radio, count: services.length, permission: "manage_network" },
    { id: "boveda", label: "Bóveda", icon: KeyRound, count: vaultItems.length, permission: "manage_vault" },
    { id: "contratos", label: "Contratos", icon: ShieldCheck, count: contracts.length, permission: "manage_policies" },
    { id: "cotizaciones", label: "Cotizaciones", icon: FileSpreadsheet, count: quotes.length, permission: "manage_finance" },
    { id: "finanzas", label: "Cobros", icon: DollarSign, count: charges.length, permission: "manage_finance" },
    { id: "tickets", label: "Tickets", icon: TicketIcon, count: clientTickets.length, permission: "manage_tickets" },
    { id: "proyectos", label: "Obras", icon: Kanban, count: projects.length, permission: "manage_network" },
    { id: "dossier", label: "Informe 360°", icon: Printer, permission: "manage_clients" },
  ];

  // RBAC Filter: Only render tabs the active user has explicit permission for (PDF Page 9 & 10)
  const authorizedTabs = allTabs.filter((t) => can(currentUser, t.permission));
  const currentTabAllowed = authorizedTabs.some((t) => t.id === activeTab);

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
        {/* Hub Header (Sin montos ni valores en cumplimiento de privacidad) */}
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
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation Ribbon - Granular RBAC Permissions (PDF Page 9 & 10) */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-slate-200 bg-slate-100/90 overflow-x-auto scrollbar-thin">
          {authorizedTabs.map((tab) => {
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
          {!currentTabAllowed && (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <ShieldAlert className="w-10 h-10 text-amber-500 mx-auto" />
              <h3 className="font-bold text-slate-900 text-sm">Pestaña Restringida</h3>
              <p className="text-xs text-slate-500">
                Tu perfil de usuario ({currentUser.role}) no tiene permisos para ver esta sección.
              </p>
            </div>
          )}

          {/* TAB 1: IDENTIFICACION */}
          {currentTabAllowed && activeTab === "fiscal" && (
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
                        {copiedField === "Email" ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
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
                        {copiedField === "Teléfono" ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </span>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block">Sector / Zona</label>
                    <span className="font-medium text-slate-800">{client.sector || "Sector Matriz"}</span>
                  </div>

                  <div className="col-span-full">
                    <label className="text-[10px] text-slate-400 font-bold block">Dirección</label>
                    <span className="font-medium text-slate-800">{client.address}</span>
                  </div>
                </div>
              </div>

              {/* Tarjeta de Persona de Contacto (PDF Página 2) */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
                  Datos de Contacto de una Persona
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block">Nombre</label>
                    <span className="font-bold text-slate-900">{client.contactName || "No registrado"}</span>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block">Cargo</label>
                    <span className="font-medium text-slate-800">{client.contactRole || "No especificado"}</span>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block">Teléfono</label>
                    <span className="font-medium text-slate-800">{client.contactPhone || client.phone}</span>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block">Dirección</label>
                    <span className="font-medium text-slate-800">{client.contactAddress || client.address}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: RED & IP -> DESPLIEGUE DE NODOS E INFRAESTRUCTURA (PDF Página 2 & 6) */}
          {currentTabAllowed && activeTab === "red" && (
            <div className="space-y-5">
              {services.length === 0 ? (
                <div className="py-12 text-center bg-white rounded-2xl border border-dashed border-slate-200 shadow-xs">
                  <Radio className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-bold text-slate-600 text-xs">Sin servicios de red activos asignados</p>
                </div>
              ) : (
                services.map((srv) => {
                  const assignedNode = nodes.find((n) => n.id === srv.nodeId || n.name === srv.nodeName);
                  const carriers = assignedNode?.providers || [];
                  const systems = assignedNode?.services || [];

                  return (
                    <div key={srv.id} className="space-y-4">
                      {/* Tarjeta del Nodo Asignado */}
                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#004ac6] to-indigo-900 text-white flex items-center justify-center font-bold shadow-xs">
                              <Radio className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-slate-900 text-sm">
                                  {assignedNode ? assignedNode.name : srv.nodeName || "POP Asignado"}
                                </h4>
                                {assignedNode && (
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                      assignedNode.status === "online"
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                        : "bg-amber-50 text-amber-700 border border-amber-200"
                                    }`}
                                  >
                                    {assignedNode.status === "online" ? "En Línea" : assignedNode.status}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                {assignedNode ? assignedNode.address : "Ubicación física del POP"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {assignedNode?.mikrotikIp && (
                              <span className="font-mono text-xs font-bold text-[#004ac6] bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                                MikroTik Core: {assignedNode.mikrotikIp}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Proveedores Multi-Carrier del Nodo */}
                        {carriers.length > 0 && (
                          <div className="space-y-2">
                            <h5 className="font-bold text-[#004ac6] text-xs uppercase tracking-wider flex items-center gap-1.5">
                              <Globe className="w-3.5 h-3.5" />
                              Proveedores Upstream del Nodo (Multi-Carrier)
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                              {carriers.map((c, cIdx) => (
                                <div
                                  key={c.id || cIdx}
                                  className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1"
                                >
                                  <div className="flex items-center justify-between font-bold text-slate-900">
                                    <span>{c.providerName}</span>
                                    <span className="font-mono text-[10px] bg-white px-1.5 py-0.2 rounded border border-slate-200 text-[#004ac6]">
                                      {c.capacityMbps} Mbps
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-slate-500 space-y-0.5">
                                    {c.circuitId && (
                                      <div>
                                        ID Circuito: <span className="font-mono font-bold text-slate-700">{c.circuitId}</span>
                                      </div>
                                    )}
                                    {c.ipv4Subnet && (
                                      <div>
                                        IPv4: <span className="font-mono text-slate-700">{c.ipv4Subnet}</span>
                                      </div>
                                    )}
                                    {c.ipv6Prefix && (
                                      <div>
                                        IPv6: <span className="font-mono text-slate-700">{c.ipv6Prefix}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Sistemas y Credenciales del Nodo */}
                        {systems.length > 0 && (
                          <div className="space-y-2">
                            <h5 className="font-bold text-[#004ac6] text-xs uppercase tracking-wider flex items-center gap-1.5">
                              <Key className="w-3.5 h-3.5" />
                              Equipos y Sistemas en este POP
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                              {systems.map((s, sIdx) => (
                                <div
                                  key={s.id || sIdx}
                                  className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1"
                                >
                                  <div className="font-bold text-slate-900 truncate">{s.systemName}</div>
                                  <div className="font-mono text-[11px] text-[#004ac6] truncate flex items-center justify-between">
                                    <span>{s.linkOrIp}</span>
                                    <button
                                      onClick={() => handleCopy(s.linkOrIp, "IP/Link")}
                                      className="p-0.5 text-slate-400 hover:text-[#004ac6]"
                                    >
                                      <Copy className="w-3 h-3" />
                                    </button>
                                  </div>
                                  {s.notes && <div className="text-[10px] text-slate-400 italic">{s.notes}</div>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Parámetros de Enlace del Cliente (Sin mostrar precios) */}
                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                        <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wider border-b border-slate-100 pb-2">
                          Parámetros del Enlace del Abonado
                        </h5>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                            <label className="text-[10px] text-slate-400 font-bold block">Plan Homologado</label>
                            <span className="font-bold text-slate-800">{srv.planName}</span>
                          </div>

                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                            <label className="text-[10px] text-slate-400 font-bold block">Dirección IPv4</label>
                            <span className="font-mono font-bold text-sky-700">{srv.ipv4Address || "CGNAT"}</span>
                          </div>

                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                            <label className="text-[10px] text-slate-400 font-bold block">Usuario PPPoE</label>
                            <span className="font-mono font-medium text-slate-800">{srv.pppoeUser || "No asignado"}</span>
                          </div>

                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                            <label className="text-[10px] text-slate-400 font-bold block">Fecha Instalación</label>
                            <span className="font-medium text-slate-800">{srv.installationDate}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 3: BOVEDA DE CLAVES */}
          {currentTabAllowed && activeTab === "boveda" && <ClientVaultTab client={client} />}

          {/* TAB 4: CONTRATOS & ARCOTEL */}
          {currentTabAllowed && activeTab === "contratos" && <ClientContractTab client={client} />}

          {/* TAB 5: COTIZACIONES & ORDENES */}
          {currentTabAllowed && activeTab === "cotizaciones" && <ClientQuotesManager client={client} />}

          {/* TAB 6: FINANZAS & COBROS */}
          {currentTabAllowed && activeTab === "finanzas" && (
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
                          <td className="py-3 px-4 font-semibold">
                            {c.month}/{c.year}
                          </td>
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
          {currentTabAllowed && activeTab === "tickets" && (
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
          {currentTabAllowed && activeTab === "proyectos" && <ClientProjectKanban client={client} />}

          {/* TAB 9: DOSSIER TECNICO INTEGRAL */}
          {currentTabAllowed && activeTab === "dossier" && <ClientDossierTab client={client} />}
        </div>
      </div>
    </div>
  );
}
