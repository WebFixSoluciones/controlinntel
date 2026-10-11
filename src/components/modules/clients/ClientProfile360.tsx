"use client";

import React, { useState, useMemo } from "react";
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
  | "tramites"
  | "arcotel"
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
    regulatoryTramites,
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
  const clientNodesList = nodes.filter((n) => n.clientId === client.id);

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

  // RBAC Filter: Only render tabs the active user has explicit permission for (PDF Page 9 & 10)
  const authorizedTabs = allTabs.filter((t) => can(currentUser, t.permission));
  const currentTabAllowed = authorizedTabs.some((t) => t.id === activeTab);

  return (
    <div className="w-full animate-in fade-in duration-200 select-none">
      {/* Contenedor Principal de la Ficha */}
      <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[calc(100vh-14rem)]">
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
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-slate-400">
                    Datos de Identificación & Catastro Tributario SRI
                  </h4>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {client.sriValidated && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Validado en Catastro SRI
                      </span>
                    )}
                    {client.tipoContribuyente && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-[#004ac6] border border-blue-200 uppercase">
                        Régimen: {client.tipoContribuyente.replace(/_/g, " ")}
                      </span>
                    )}
                    {client.obligadoContabilidad && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        Obligado a Contabilidad
                      </span>
                    )}
                    {client.agenteRetencion && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        Agente de Retención
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block">Razón Social / Cliente</label>
                    <span className="font-bold text-slate-900 text-sm">{client.businessName}</span>
                    {client.tradeName && client.tradeName !== client.businessName && (
                      <span className="block text-[11px] text-slate-500 font-medium mt-0.5">
                        Nombre Comercial: {client.tradeName}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block">Documento de Identificación</label>
                    <span className="font-mono font-bold text-slate-900 text-sm flex items-center justify-between">
                      <span>
                        {client.identificationType} {String(client.identificationNumber || "").replace(/\s+/g, "").trim()}
                      </span>
                      <button
                        onClick={() =>
                          handleCopy(
                            String(client.identificationNumber || "").replace(/\s+/g, "").trim(),
                            "RUC/CI"
                          )
                        }
                        className="p-1 text-slate-400 hover:text-sky-600 cursor-pointer"
                        title="Copiar RUC/CI sin espacios"
                      >
                        {copiedField === "RUC/CI" ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </span>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block">Representante Legal</label>
                    <span className="font-medium text-slate-800">{client.legalRepresentative || "No aplica"}</span>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block">Correo Electrónico</label>
                    <span className="font-medium text-slate-800 flex items-center justify-between">
                      {String(client.email || "").replace(/\s+/g, "").trim()}
                      <button
                        onClick={() => handleCopy(String(client.email || "").replace(/\s+/g, "").trim(), "Email")}
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
                    <label className="text-[10px] text-slate-400 font-bold block">Sector / Jurisdicción</label>
                    <span className="font-medium text-slate-800">{client.sector || "No especificado"}</span>
                  </div>

                  <div className="col-span-full">
                    <label className="text-[10px] text-slate-400 font-bold block">Dirección Fiscal</label>
                    <span className="font-medium text-slate-800">{client.address}</span>
                  </div>

                  {client.actividadEconomica && (
                    <div className="col-span-full pt-2 border-t border-slate-100">
                      <label className="text-[10px] text-[#004ac6] font-bold uppercase tracking-wider block">
                        Actividad Económica Principal (SRI)
                      </label>
                      <span className="font-medium text-slate-700 text-xs">{client.actividadEconomica}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Tarjeta de Personas de Contacto (Múltiples Contactos) */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <User className="w-4 h-4 text-[#004ac6]" />
                    <span>Datos de Personas de Contacto</span>
                  </h4>
                  {onEdit && (
                    <button
                      onClick={onEdit}
                      className="text-xs font-bold text-[#004ac6] hover:text-[#003da6] flex items-center gap-1 cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Gestionar Contactos</span>
                    </button>
                  )}
                </div>

                {allContacts.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400 italic bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                    No se han registrado personas de contacto. Haz clic en &quot;Editar Ficha&quot; para agregar contactos al cliente.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {allContacts.map((contact, idx) => (
                      <div
                        key={contact.id || idx}
                        className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2 text-xs hover:border-[#bfdbfe] transition"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-bold text-slate-900 block text-xs">{contact.name}</span>
                            <span className="text-[11px] text-[#004ac6] font-semibold block">{contact.role || "Contacto"}</span>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-slate-600 border border-slate-200">
                            #{idx + 1}
                          </span>
                        </div>

                        <div className="space-y-1 text-[11px] text-slate-600 pt-1.5 border-t border-slate-200/60">
                          {contact.phone && (
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">Teléfono:</span>
                              <span className="font-medium text-slate-800 font-mono">{contact.phone}</span>
                            </div>
                          )}
                          {contact.email && (
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">Email:</span>
                              <span className="font-medium text-slate-800 truncate max-w-[180px]">{contact.email}</span>
                            </div>
                          )}
                          {contact.address && (
                            <div className="pt-0.5">
                              <span className="text-slate-400 block text-[10px]">Dirección:</span>
                              <span className="font-medium text-slate-700 block">{contact.address}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
                          Sin cobros registrados para este cliente.
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
    </div>
  );
}
