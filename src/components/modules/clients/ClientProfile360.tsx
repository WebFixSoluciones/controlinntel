"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { Client, ClientContactPerson } from "@/types";
import { can, tabPermissions } from "@/lib/permissions";
import { ClientTasksTab } from "./ClientTasksTab";
import { ClientQuotesManager } from "./ClientQuotesManager";
import { ClientVaultTab } from "./ClientVaultTab";
import { ClientContractTab } from "./ClientContractTab";
import { ClientDossierTab } from "./ClientDossierTab";
import { ClientNodesTab } from "./ClientNodesTab";
import { ClientTramitesTab } from "./ClientTramitesTab";
import { ClientArcotelTab } from "./ClientArcotelTab";
import { ClientTicketsTab } from "./ClientTicketsTab";
import { ClientContactsModal } from "./ClientContactsModal";
import { ClientTabHeader, ClientSectionHeader } from "./ClientTabHeader";
import {
  User,
  Radio,
  KeyRound,
  ShieldCheck,
  FileSpreadsheet,
  DollarSign,
  Ticket as TicketIcon,
  Kanban,
  ListTodo,
  FileText,
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
  Server,
  AlertCircle,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";

interface ClientProfile360Props {
  client: Client | null;
  onClose: () => void;
  onEdit?: () => void;
  initialTab?: ProfileTab;
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
  | "tramites"
  | "arcotel"
  | "dossier";

export function ClientProfile360({ client, onClose, onEdit, initialTab }: ClientProfile360Props) {
  const {
    clientServices,
    monthlyCharges,
    tickets,
    clientProjects,
    clientQuotes,
    clientVaultItems,
    clientContracts,
    nodes,
    regulatoryTramites,
    currentUser,
    markChargeAsPaid,
    deleteClient,
  } = useApp();
  const { showSuccess, showError, showConfirm } = useToast();

  const [activeTab, setActiveTab] = useState<ProfileTab>(() => {
    if (initialTab) return initialTab;
    return "fiscal";
  });

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isContactsModalOpen, setIsContactsModalOpen] = useState(false);

  const clientId = client?.id || "";
  const services = clientServices.filter((s) => s.clientId === clientId);
  const charges = monthlyCharges.filter((c) => c.clientId === clientId);
  const clientTickets = tickets.filter((t) => t.clientId === clientId);
  const projects = clientProjects.filter((p) => p.clientId === clientId);
  const quotes = clientQuotes.filter((q) => q.clientId === clientId);
  const vaultItems = clientVaultItems.filter((v) => v.clientId === clientId);
  const clientNodesList = nodes.filter((n) => n.clientId === clientId);

  const allContacts: ClientContactPerson[] =
    client?.contacts && client.contacts.length > 0
      ? client.contacts
      : client?.contactName && client.contactName.trim()
      ? [
          {
            id: "ct-legacy",
            name: client.contactName,
            role: client.contactRole || "Contacto Principal",
            phone: client.contactPhone || client.phone,
            address: client.contactAddress || "",
          },
        ]
      : [];

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

  const allTabs: { id: ProfileTab; label: string; icon: any; permission: string }[] = [
    { id: "fiscal", label: "Identificación", icon: User, permission: "manage_clients" },
    { id: "red", label: "Nodos", icon: Radio, permission: "manage_network" },
    { id: "boveda", label: "Bóveda", icon: KeyRound, permission: "manage_vault" },
    { id: "contratos", label: "Servicios", icon: ShieldCheck, permission: "manage_policies" },
    { id: "cotizaciones", label: "Cotizaciones", icon: FileSpreadsheet, permission: "manage_finance" },
    { id: "finanzas", label: "Cobros", icon: DollarSign, permission: "manage_finance" },
    { id: "tickets", label: "Tickets", icon: TicketIcon, permission: "manage_tickets" },
    { id: "proyectos", label: "Tareas", icon: ListTodo, permission: "manage_network" },
    { id: "tramites", label: "Trámites", icon: FileText, permission: "manage_clients" },
    { id: "arcotel", label: "ARCOTEL", icon: ShieldAlert, permission: "manage_clients" },
    { id: "dossier", label: "Informes", icon: Printer, permission: "manage_clients" },
  ];

  // Regla de Negocio: Si el cliente NO tiene servicios contratados, solo se habilitan
  // "Identificación" y "Servicios" (para poder asignarle servicios).
  // Una vez que el cliente tome un servicio, se desbloquean automáticamente todas las pestañas.
  const hasServices = services.some((s) => s.status !== "retirado");

  const eligibleTabs = allTabs.filter((t) => {
    if (!hasServices) {
      return t.id === "fiscal" || t.id === "contratos";
    }
    return true;
  });

  // RBAC Filter: Only render tabs the active user has explicit permission for (PDF Page 9 & 10)
  const authorizedTabs = eligibleTabs.filter((t) => can(currentUser, t.permission));
  const currentTabAllowed = authorizedTabs.some((t) => t.id === activeTab);

  // Asegurar que si la pestaña activa queda fuera de las permitidas, vuelva a Identificación o Servicios
  useEffect(() => {
    if (!authorizedTabs.some((t) => t.id === activeTab)) {
      if (authorizedTabs.some((t) => t.id === "fiscal")) {
        setActiveTab("fiscal");
      } else if (authorizedTabs[0]) {
        setActiveTab(authorizedTabs[0].id);
      }
    }
  }, [hasServices, activeTab, authorizedTabs]);

  if (!client) return null;

  return (
    <div className="w-full animate-in fade-in duration-200">
      {/* Contenedor Principal de la Ficha */}
      <div className="w-full bg-white rounded-xl shadow-2xs border border-[#e2e8f0] overflow-hidden flex flex-col min-h-[calc(100vh-14rem)]">
        {/* Hub Header Elegante y Limpio */}
        <div className="p-4 px-6 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-base font-semibold text-slate-800 tracking-normal">
              {client.businessName}
            </h1>
            <span className="h-3.5 w-px bg-slate-300" aria-hidden="true" />
            <span className="font-mono text-xs font-medium text-slate-600">
              RUC / CI: {client.identificationNumber}
            </span>
            <span className="h-3.5 w-px bg-slate-300" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              {client.status}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {(currentUser.role === "admin" ||
              currentUser.role === "superadmin" ||
              currentUser.permissions?.includes("all") ||
              currentUser.permissions?.includes("delete_clients") ||
              currentUser.modulePermissions?.clientes?.actions?.canDeleteClient) && (
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                title="Eliminar Cliente Definitivamente"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar Cliente</span>
              </button>
            )}
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Editar</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation Ribbon - Granular RBAC Permissions (PDF Page 9 & 10) */}
        <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-slate-200 bg-slate-100/90 overflow-x-auto scrollbar-thin">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {authorizedTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? "bg-[#004ac6] text-white shadow-sm border border-[#003da6]"
                      : "bg-white text-slate-700 hover:text-[#0b1c30] hover:bg-slate-50 border border-slate-300 shadow-2xs"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? "text-white" : "text-slate-600"}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {!hasServices && (
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-lg shrink-0">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Asigna un servicio en &quot;Servicios&quot; para habilitar Nodos, Bóveda, Cobros, Tickets y demás pestañas.</span>
            </div>
          )}
        </div>

        {/* Tab Content Body */}
        <div className="p-6 flex-1 overflow-y-auto bg-slate-50/40">
          {!currentTabAllowed && (
            <div className="p-8 text-center bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3">
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
              <ClientTabHeader
                title="Identificación"
                icon={User}
                badge={
                  <div className="flex flex-wrap items-center gap-1.5">
                    {client.sriValidated && (
                      <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Validado SRI
                      </span>
                    )}
                    {client.tipoContribuyente && (
                      <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-[#eff4ff] text-[#004ac6] border border-[#dce9ff] uppercase">
                        Régimen: {client.tipoContribuyente.replace(/_/g, " ")}
                      </span>
                    )}
                    {client.obligadoContabilidad && (
                      <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        Obligado Contabilidad
                      </span>
                    )}
                    {client.agenteRetencion && (
                      <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        Agente Retención
                      </span>
                    )}
                  </div>
                }
              />

              {/* Contenedor Unificado (Single Canvas, Cero Tarjetas Anidadas) */}
              <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-2xs p-6 space-y-6">
                {/* 1.1 Datos Generales y Fiscales */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <User className="w-4 h-4 text-[#004ac6]" />
                    <h4 className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider">
                      Datos Fiscales y de Registro
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 text-xs">
                    <div>
                      <label className="text-xs font-semibold text-[#64748b] block mb-1">Razón Social / Cliente</label>
                      <span className="font-bold text-[#0b1c30] text-sm block leading-snug">{client.businessName}</span>
                      {client.tradeName && client.tradeName !== client.businessName && (
                        <span className="block text-xs text-[#64748b] font-medium mt-1">
                          Nombre Comercial: <span className="text-[#0b1c30]">{client.tradeName}</span>
                        </span>
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-[#64748b] block mb-1">Documento de Identificación</label>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-[#f8f9ff] border border-[#e2e8f0]">
                        <span className="font-mono font-bold text-[#004ac6] text-sm">
                          <span className="text-xs text-[#64748b] font-semibold mr-1.5">{client.identificationType}:</span>
                          {String(client.identificationNumber || "").replace(/\s+/g, "").trim()}
                        </span>
                        <button
                          onClick={() =>
                            handleCopy(
                              String(client.identificationNumber || "").replace(/\s+/g, "").trim(),
                              "RUC/CI"
                            )
                          }
                          className="p-1 text-[#64748b] hover:text-[#004ac6] hover:bg-[#eff4ff] rounded-md transition-colors cursor-pointer"
                          title="Copiar RUC/CI sin espacios"
                        >
                          {copiedField === "RUC/CI" ? (
                            <Check className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-[#64748b] block mb-1">Representante Legal</label>
                      <span className="font-bold text-[#0b1c30] text-sm block">{client.legalRepresentative || "No aplica"}</span>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-[#64748b] block mb-1">Correo Electrónico</label>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-[#f8f9ff] border border-[#e2e8f0]">
                        <span className="font-medium text-[#0b1c30] text-xs truncate max-w-[200px]">
                          {String(client.email || "").replace(/\s+/g, "").trim()}
                        </span>
                        <button
                          onClick={() => handleCopy(String(client.email || "").replace(/\s+/g, "").trim(), "Email")}
                          className="p-1 text-[#64748b] hover:text-[#004ac6] hover:bg-[#eff4ff] rounded-md transition-colors cursor-pointer"
                          title="Copiar correo"
                        >
                          {copiedField === "Email" ? (
                            <Check className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-[#64748b] block mb-1">Teléfono / WhatsApp</label>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-[#f8f9ff] border border-[#e2e8f0]">
                        <span className="font-mono font-bold text-[#0b1c30] text-xs">
                          {client.phone}
                        </span>
                        <button
                          onClick={() => handleCopy(client.phone, "Teléfono")}
                          className="p-1 text-[#64748b] hover:text-[#004ac6] hover:bg-[#eff4ff] rounded-md transition-colors cursor-pointer"
                          title="Copiar teléfono"
                        >
                          {copiedField === "Teléfono" ? (
                            <Check className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-[#64748b] block mb-1">Sector / Jurisdicción</label>
                      <span className="font-bold text-[#0b1c30] text-sm block">{client.sector || "No especificado"}</span>
                    </div>

                    <div className="col-span-full">
                      <label className="text-xs font-semibold text-[#64748b] block mb-1">Dirección Fiscal</label>
                      <span className="font-bold text-[#0b1c30] text-sm block leading-relaxed">{client.address}</span>
                    </div>

                    {client.actividadEconomica && (
                      <div className="col-span-full pt-4 border-t border-[#f1f5f9]">
                        <label className="text-xs font-bold text-[#004ac6] uppercase tracking-wider block mb-1">
                          Actividad Económica Principal (SRI)
                        </label>
                        <p className="text-xs text-[#475569] font-medium leading-relaxed bg-[#f8f9ff] p-3 rounded-lg border border-[#e2e8f0]">
                          {client.actividadEconomica}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 1.2 Sección de Contactos Integrada (Sin tarjetas flotantes anidadas) */}
                <div className="pt-6 border-t border-[#f1f5f9]">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <UserPlus className="w-4 h-4 text-[#004ac6]" />
                      <h4 className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider">
                        Personas de Contacto
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsContactsModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#004ac6] bg-[#eff4ff] hover:bg-[#dce9ff] transition-colors cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Gestionar Contactos</span>
                    </button>
                  </div>

                  {allContacts.length === 0 ? (
                    <div className="text-center py-8 text-xs bg-[#f8f9ff] rounded-lg border border-[#e2e8f0] space-y-3">
                      <p className="text-[#64748b] font-medium">
                        No se han registrado personas de contacto para este cliente.
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsContactsModalOpen(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#004ac6] hover:bg-[#003da6] text-white text-xs font-bold transition shadow-xs cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Agregar Primer Contacto</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {allContacts.map((contact, idx) => (
                        <div
                          key={contact.id || idx}
                          className="p-4 bg-[#f8f9ff] rounded-lg border border-[#e2e8f0] space-y-2.5 text-xs hover:border-[#cbd5e1] transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="font-bold text-[#0b1c30] block text-sm">{contact.name}</span>
                              <span className="text-xs text-[#004ac6] font-semibold block">{contact.role || "Contacto"}</span>
                            </div>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white text-[#64748b] border border-[#e2e8f0]">
                              #{idx + 1}
                            </span>
                          </div>

                          <div className="space-y-1.5 text-xs pt-2 border-t border-[#e2e8f0]">
                            {contact.phone && (
                              <div className="flex items-center justify-between">
                                <span className="text-[#64748b]">Teléfono:</span>
                                <span className="font-mono font-bold text-[#0b1c30]">{contact.phone}</span>
                              </div>
                            )}
                            {contact.email && (
                              <div className="flex items-center justify-between">
                                <span className="text-[#64748b]">Email:</span>
                                <span className="font-medium text-[#0b1c30] truncate max-w-[180px]">{contact.email}</span>
                              </div>
                            )}
                            {contact.address && (
                              <div className="pt-1">
                                <span className="text-[#64748b] block text-[11px] mb-0.5">Dirección:</span>
                                <span className="font-medium text-[#0b1c30] block">{contact.address}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: NODOS DEL CLIENTE */}
          {currentTabAllowed && activeTab === "red" && <ClientNodesTab client={client} />}

          {/* TAB 3: BOVEDA DE CLAVES */}
          {currentTabAllowed && activeTab === "boveda" && <ClientVaultTab client={client} />}

          {/* TAB 4: CONTRATOS & ARCOTEL */}
          {currentTabAllowed && activeTab === "contratos" && <ClientContractTab client={client} />}

          {/* TAB 5: COTIZACIONES & ORDENES */}
          {currentTabAllowed && activeTab === "cotizaciones" && <ClientQuotesManager client={client} />}

          {/* TAB 6: FINANZAS & COBROS */}
          {currentTabAllowed && activeTab === "finanzas" && (
            <div className="space-y-4">
              <ClientTabHeader
                title="Cobros"
                icon={DollarSign}
                badge={
                  <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-[#eff4ff] text-[#004ac6] border border-[#dce9ff]">
                    {charges.length}
                  </span>
                }
              />

              <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
                <table className="table-fixed w-full text-left text-xs border-collapse">
                  <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-xs uppercase tracking-wider border-b border-[#e2e8f0]">
                    <tr>
                      <th className="py-3 px-4 w-[18%]">Comprobante</th>
                      <th className="py-3 px-4 w-[14%]">Periodo</th>
                      <th className="py-3 px-4 w-[36%]">Descripción</th>
                      <th className="py-3 px-4 w-[12%]">Total</th>
                      <th className="py-3 px-4 w-[10%] text-center">Estado</th>
                      <th className="py-3 px-4 w-[10%] text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {charges.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                          Sin cobros registrados para este cliente.
                        </td>
                      </tr>
                    ) : (
                      charges.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50/70">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900 truncate">{c.invoiceNumber}</td>
                          <td className="py-3 px-4 font-semibold">
                            {c.month}/{c.year}
                          </td>
                          <td className="py-3 px-4 text-slate-600 truncate">{c.serviceDescription}</td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">${c.total.toFixed(2)}</td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`px-2.5 py-0.5 rounded-md text-xs font-bold uppercase border ${
                                c.status === "pagado"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
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
          {currentTabAllowed && activeTab === "tickets" && <ClientTicketsTab client={client} />}

          {/* TAB 8: TAREAS / GESTOR DE CRONOGRAMA & SEGUIMIENTO */}
          {currentTabAllowed && activeTab === "proyectos" && <ClientTasksTab client={client} />}

          {/* TAB: TRAMITES INSTITUCIONALES & REGULATORIOS */}
          {currentTabAllowed && activeTab === "tramites" && <ClientTramitesTab client={client} />}

          {/* TAB: EXPEDIENTE REGULATORIO ARCOTEL */}
          {currentTabAllowed && activeTab === "arcotel" && <ClientArcotelTab client={client} />}

          {/* TAB 9: DOSSIER TECNICO INTEGRAL */}
          {currentTabAllowed && activeTab === "dossier" && <ClientDossierTab client={client} />}
        </div>
      </div>

      {/* Modal de Confirmación de Baja / Eliminación de Cliente */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-[#e2e8f0] w-full max-w-md overflow-hidden">
            <div className="p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto shadow-xs">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">¿Eliminar Cliente Definitivamente?</h3>
                <p className="text-xs text-slate-500">
                  Confirmas la eliminación permanente del cliente del sistema:
                </p>
                <p className="font-semibold text-slate-800 text-sm mt-1">{client.businessName}</p>
                <p className="font-mono text-slate-500 text-xs">RUC / CI: {client.identificationNumber}</p>
              </div>

              <div className="bg-amber-50 p-3.5 rounded-lg border border-amber-200 text-left text-xs text-amber-800 space-y-1">
                <span className="font-bold block">Advertencia de Eliminación:</span>
                <p className="text-[11px] leading-relaxed">
                  Esta acción eliminará la ficha completa del cliente y limpiará en cascada todos sus servicios activos, proyectos, credenciales y contratos vinculados.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isDeleting}
                  className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold rounded-lg text-xs transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setIsDeleting(true);
                    try {
                      await deleteClient(client.id);
                      showSuccess("Cliente Eliminado", `El cliente "${client.businessName}" ha sido eliminado exitosamente.`);
                      setShowDeleteModal(false);
                      onClose();
                    } catch (err: any) {
                      showError("Error al Eliminar", err?.message || "No se pudo eliminar el cliente.");
                    } finally {
                      setIsDeleting(false);
                    }
                  }}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isDeleting ? "Eliminando..." : "Sí, Eliminar Cliente"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dedicado Exclusivo para Gestión de Contactos */}
      {client && (
        <ClientContactsModal
          isOpen={isContactsModalOpen}
          onClose={() => setIsContactsModalOpen(false)}
          client={client}
        />
      )}
    </div>
  );
}
