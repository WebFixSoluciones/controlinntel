"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { Client, ClientContactPerson, MonthlyCharge } from "@/types";
import { can, tabPermissions } from "@/lib/permissions";
import { printHtmlElement } from "@/lib/print-service";
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
import { ClientFilesTab } from "./ClientFilesTab";
import {
  User,
  Radio,
  KeyRound,
  ShieldCheck,
  Cloud,
  HardDrive,
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
  Search,
  X,
  UploadCloud,
  FileBarChart,
} from "lucide-react";

interface ClientProfile360Props {
  client: Client | null;
  onClose: () => void;
  onEdit?: () => void;
  initialTab?: ProfileTab;
  onTabChange?: (tab: ProfileTab) => void;
}

type ProfileTab =
  | "fiscal"
  | "red"
  | "boveda"
  | "contratos"
  | "archivos"
  | "cotizaciones"
  | "finanzas"
  | "tickets"
  | "proyectos"
  | "tramites"
  | "arcotel"
  | "dossier";

export function ClientProfile360({ client, onClose, onEdit, initialTab, onTabChange }: ClientProfile360Props) {
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
    sriCompanyConfig,
    bankAccounts,
  } = useApp();
  const { showSuccess, showError, showConfirm } = useToast();

  const [activeTab, setActiveTab] = useState<ProfileTab>(() => {
    if (initialTab) return initialTab;
    return "fiscal";
  });

  const handleTabChange = (tabId: ProfileTab) => {
    setActiveTab(tabId);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tabId);
      window.history.replaceState({}, "", url.toString());
    }
    onTabChange?.(tabId);
  };

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

  // Cobros & Finanzas state
  const [cobrosSearch, setCobrosSearch] = useState("");
  const [cobrosStatusFilter, setCobrosStatusFilter] = useState<"todos" | "pendiente" | "pagado">("todos");
  const [isAccountStatementOpen, setIsAccountStatementOpen] = useState(false);
  const [receiptCharge, setReceiptCharge] = useState<MonthlyCharge | null>(null);

  const accountStatementPrintRef = useRef<HTMLDivElement>(null);
  const receiptPrintRef = useRef<HTMLDivElement>(null);

  const filteredCharges = useMemo(() => {
    return charges.filter((c) => {
      const q = cobrosSearch.trim().toLowerCase();
      const matchSearch =
        !q ||
        (c.invoiceNumber && c.invoiceNumber.toLowerCase().includes(q)) ||
        (c.serviceDescription && c.serviceDescription.toLowerCase().includes(q)) ||
        `${c.month}/${c.year}`.includes(q);

      const matchStatus =
        cobrosStatusFilter === "todos" || c.status === cobrosStatusFilter;

      return matchSearch && matchStatus;
    });
  }, [charges, cobrosSearch, cobrosStatusFilter]);

  const cobrosCounts = useMemo(() => {
    return {
      todos: charges.length,
      pendiente: charges.filter((c) => c.status === "pendiente").length,
      pagado: charges.filter((c) => c.status === "pagado").length,
      totalPending: charges
        .filter((c) => c.status === "pendiente")
        .reduce((sum, c) => sum + (c.balanceRemaining ?? c.total), 0),
      totalPaid: charges
        .filter((c) => c.status === "pagado")
        .reduce((sum, c) => sum + (c.paidAmount ?? c.total), 0),
      grandTotal: charges.reduce((sum, c) => sum + c.total, 0),
    };
  }, [charges]);

  const handlePrintAccountStatement = () => {
    if (accountStatementPrintRef.current) {
      printHtmlElement(
        accountStatementPrintRef.current,
        `EstadoDeCuenta-${client?.identificationNumber || client?.id || "Cliente"}`,
        "a4"
      );
    } else {
      window.print();
    }
  };

  const handlePrintReceipt = () => {
    if (receiptPrintRef.current) {
      printHtmlElement(
        receiptPrintRef.current,
        `Recibo-${receiptCharge?.invoiceNumber || "Cobro"}`,
        "ticket"
      );
    } else {
      window.print();
    }
  };

  const handleExportCobranzaCsv = () => {
    if (!client || charges.length === 0) {
      showError("Sin datos", "No existen registros de cobro para exportar.");
      return;
    }

    const headers = [
      "Comprobante",
      "Periodo",
      "Descripcion",
      "Subtotal",
      "IVA",
      "Total",
      "Estado",
      "Fecha Pago",
      "Metodo Pago",
      "Referencia",
    ];

    const rows = charges.map((c) => [
      `"${c.invoiceNumber || ""}"`,
      `"${c.month}/${c.year}"`,
      `"${(c.serviceDescription || "").replace(/"/g, '""')}"`,
      c.subtotal ?? 0,
      c.ivaAmount ?? 0,
      c.total ?? 0,
      `"${c.status}"`,
      `"${c.paymentDate || ""}"`,
      `"${c.paymentMethod || ""}"`,
      `"${c.paymentReference || ""}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Cobranzas_${client.identificationNumber || client.id}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showSuccess("Informe Exportado", "Archivo CSV de cobranzas descargado exitosamente.");
  };
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
    { id: "archivos", label: "Archivos", icon: HardDrive, permission: "manage_clients" },
    { id: "cotizaciones", label: "Cotizaciones", icon: FileSpreadsheet, permission: "manage_finance" },
    { id: "finanzas", label: "Cobros", icon: DollarSign, permission: "manage_finance" },
    { id: "tickets", label: "Tickets", icon: TicketIcon, permission: "manage_tickets" },
    { id: "proyectos", label: "Tareas", icon: ListTodo, permission: "manage_network" },
    { id: "tramites", label: "Trámites", icon: FileText, permission: "manage_clients" },
    { id: "arcotel", label: "ARCOTEL", icon: ShieldAlert, permission: "manage_clients" },
    { id: "dossier", label: "Informes", icon: Printer, permission: "manage_clients" },
  ];

  // Regla de Negocio: Si el cliente NO tiene servicios contratados, solo se habilitan
  // "Identificación", "Servicios" y "Archivos" (para poder adjuntar contratos previos o cédula/RUC).
  // Una vez que el cliente tome un servicio, se desbloquean automáticamente todas las pestañas.
  const hasServices = services.some((s) => s.status !== "retirado");

  const eligibleTabs = allTabs.filter((t) => {
    if (!hasServices) {
      return t.id === "fiscal" || t.id === "contratos" || t.id === "archivos";
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

  // Pestañas visibles en la barra horizontal (Archivos e Informes se ubican como iconos en la barra superior)
  const ribbonTabs = authorizedTabs.filter((t) => t.id !== "archivos" && t.id !== "dossier");

  if (!client) return null;

  return (
    <div className="w-full animate-in fade-in duration-200">
      {/* Contenedor Principal de la Ficha */}
      <div className="w-full bg-white rounded-xl shadow-2xs border border-[#e2e8f0] overflow-hidden flex flex-col min-h-[calc(100vh-14rem)]">
        {/* Hub Header Elegante y Limpio con Estado, Título e Iconos de Acción */}
        <div className="p-4 px-6 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                client.status === "activo"
                  ? "bg-[#10b981]"
                  : client.status === "suspendido"
                  ? "bg-[#f59e0b]"
                  : "bg-[#ef4444]"
              }`}
              title={`Estado: ${client.status.toUpperCase()}`}
            />
            <h1 className="text-sm sm:text-base font-bold text-slate-800 tracking-normal uppercase">
              {client.businessName}
            </h1>
            <span className="h-3.5 w-px bg-slate-300" aria-hidden="true" />
            <span className="font-mono text-xs font-medium text-slate-600">
              RUC / CI: {client.identificationNumber}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {authorizedTabs.some((t) => t.id === "archivos") && (
              <button
                type="button"
                onClick={() => handleTabChange("archivos")}
                title="Cargar / Gestionar Archivos del Cliente"
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                  activeTab === "archivos"
                    ? "bg-[#004ac6] text-white border-2 border-[#004ac6] shadow-xs"
                    : "bg-white text-[#004ac6] border border-[#004ac6] hover:bg-[#eff4ff]"
                }`}
              >
                <UploadCloud className="w-4 h-4" />
              </button>
            )}

            {authorizedTabs.some((t) => t.id === "dossier") && (
              <button
                type="button"
                onClick={() => handleTabChange("dossier")}
                title="Informes y Reportes del Cliente"
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                  activeTab === "dossier"
                    ? "bg-[#004ac6] text-white border-2 border-[#004ac6] shadow-xs"
                    : "bg-white text-[#004ac6] border border-[#004ac6] hover:bg-[#eff4ff]"
                }`}
              >
                <FileBarChart className="w-4 h-4" />
              </button>
            )}

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
            {ribbonTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  title={tab.label}
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
              {/* Contenedor Unificado (Single Canvas, Cero Tarjetas Anidadas) */}
              <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-2xs p-6 space-y-6">
                {/* 1.1 Datos Generales y Fiscales */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-[#004ac6]" />
                      <h4 className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider">
                        Datos Fiscales y de Registro
                      </h4>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {client.sriValidated && (
                        <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                          <Check className="w-3 h-3" /> Validado SRI
                        </span>
                      )}
                      {client.tipoContribuyente && (
                        <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-[#eff4ff] text-[#004ac6] border border-[#dce9ff] uppercase">
                          Régimen: {client.tipoContribuyente.replace(/_/g, " ")}
                        </span>
                      )}
                      {client.obligadoContabilidad && (
                        <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          Obligado Contabilidad
                        </span>
                      )}
                      {client.agenteRetencion && (
                        <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Agente Retención
                        </span>
                      )}
                    </div>
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

          {/* TAB ARCHIVOS / MINI DRIVE DEL CLIENTE */}
          {currentTabAllowed && activeTab === "archivos" && <ClientFilesTab client={client} />}

          {/* TAB 5: COTIZACIONES & ORDENES */}
          {currentTabAllowed && activeTab === "cotizaciones" && <ClientQuotesManager client={client} />}

          {/* TAB 6: FINANZAS & COBROS */}
          {currentTabAllowed && activeTab === "finanzas" && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
                {/* Barra de Búsqueda, Filtros de Estado y Botones de Acción / Informes */}
                <div className="p-3 px-6 border-b border-[#e2e8f0] bg-white flex flex-wrap items-center justify-between gap-3">
                  <div className="relative flex-1 min-w-[200px] max-w-xs">
                    <Search className="w-3.5 h-3.5 text-[#64748b] absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Buscar por comprobante o descripción..."
                      value={cobrosSearch}
                      onChange={(e) => setCobrosSearch(e.target.value)}
                      className="w-full text-xs pl-8 pr-8 py-1.5 rounded-lg border border-[#e2e8f0] bg-[#f8f9ff] text-[#0b1c30] placeholder-[#64748b] focus:bg-white focus:outline-hidden focus:border-[#004ac6] transition-colors"
                    />
                    {cobrosSearch && (
                      <button
                        type="button"
                        onClick={() => setCobrosSearch("")}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        title="Limpiar búsqueda"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 text-xs">
                      {[
                        { id: "todos", label: "Todos", count: cobrosCounts.todos },
                        {
                          id: "pendiente",
                          label: "Pendientes",
                          count: cobrosCounts.pendiente,
                          isWarning: cobrosCounts.pendiente > 0,
                        },
                        { id: "pagado", label: "Pagados", count: cobrosCounts.pagado },
                      ].map((tab) => {
                        const isActive = cobrosStatusFilter === tab.id;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setCobrosStatusFilter(tab.id as any)}
                            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                              isActive
                                ? tab.isWarning
                                  ? "bg-amber-600 text-white shadow-xs"
                                  : "bg-[#004ac6] text-white shadow-2xs"
                                : tab.isWarning
                                ? "bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100"
                                : "bg-[#f8f9ff] text-[#434655] hover:bg-slate-100 border border-[#e2e8f0]"
                            }`}
                          >
                            <span>{tab.label}</span>
                            {tab.count > 0 && (
                              <span
                                className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                                  isActive
                                    ? "bg-white/20 text-white"
                                    : tab.isWarning
                                    ? "bg-amber-200 text-amber-900"
                                    : "bg-slate-200 text-slate-700"
                                }`}
                              >
                                {tab.count}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <span className="h-4 w-px bg-slate-200 hidden sm:inline-block" aria-hidden="true" />

                    {/* Botones de Acción e Informes */}
                    <button
                      type="button"
                      onClick={() => setIsAccountStatementOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                      title="Ver e Imprimir Estado de Cuenta Oficial del Cliente"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Estado de Cuenta</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleExportCobranzaCsv}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-[#0b1c30] border border-[#cbd5e1] rounded-lg text-xs font-semibold transition cursor-pointer shadow-2xs"
                      title="Exportar informe de comprobantes a formato CSV/Excel"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Informe Cobranzas</span>
                    </button>
                  </div>
                </div>

                {/* Tabla o Estado Vacío */}
                {filteredCharges.length === 0 ? (
                  <div className="py-12 text-center bg-white">
                    <DollarSign className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-bold text-slate-700 text-xs">
                      {charges.length === 0
                        ? "Sin cobros registrados para este cliente."
                        : "No se encontraron cobros con los filtros aplicados."}
                    </p>
                    {charges.length > 0 && (cobrosSearch || cobrosStatusFilter !== "todos") && (
                      <button
                        type="button"
                        onClick={() => {
                          setCobrosSearch("");
                          setCobrosStatusFilter("todos");
                        }}
                        className="mt-3 inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-[#004ac6] hover:underline cursor-pointer"
                      >
                        Restablecer filtros
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
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
                        {filteredCharges.map((c) => (
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
                              <div className="flex items-center justify-end gap-1.5">
                                {c.status === "pendiente" ? (
                                  <button
                                    onClick={() => handlePayCharge(c.id)}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer transition shadow-2xs"
                                  >
                                    Cobrar
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setReceiptCharge(c)}
                                    className="p-1.5 text-slate-500 hover:text-[#004ac6] hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                    title="Imprimir Comprobante de Cobro"
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
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

      {/* Modal: Estado de Cuenta Oficial Imprimible A4 */}
      {isAccountStatementOpen && client && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 px-6 bg-[#0b1c30] text-white flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <Printer className="w-4 h-4 text-[#eff4ff]" />
                <div>
                  <h3 className="font-bold text-sm text-white">Estado de Cuenta Oficial</h3>
                  <p className="text-[11px] text-slate-300">
                    {client.businessName} • {client.identificationNumber}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintAccountStatement}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir A4 / PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAccountStatementOpen(false)}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Printable Body */}
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
              <div
                ref={accountStatementPrintRef}
                className="bg-white p-8 rounded-xl border border-slate-200 shadow-2xs space-y-6 print:border-none print:shadow-none print:p-0"
              >
                {/* Header con Membrete */}
                <div className="flex items-center justify-between pb-5 border-b border-slate-200">
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-16 bg-white rounded-lg border border-slate-200 p-1 flex items-center justify-center shrink-0">
                      <img
                        src="/logo-inntel.webp"
                        alt={sriCompanyConfig?.razonSocial || "INNTEL CORP S.A."}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-slate-900">
                        {sriCompanyConfig?.nombreComercial || sriCompanyConfig?.razonSocial || "INNTEL CORP S.A."}
                      </h2>
                      <p className="text-xs font-bold text-[#004ac6] uppercase tracking-wider">
                        Estado de Cuenta Financiero del Cliente
                      </p>
                      <p className="text-[11px] text-slate-500">
                        RUC: {sriCompanyConfig?.ruc || "0993392437001"} • {sriCompanyConfig?.direccionMatriz || "Guayaquil, Ecuador"}
                      </p>
                    </div>
                  </div>

                  <div className="text-right text-xs">
                    <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                      Fecha: {new Date().toLocaleDateString("es-EC")}
                    </span>
                    <p className="text-[11px] text-slate-500 mt-1">Corte contable al día</p>
                  </div>
                </div>

                {/* Información del Cliente */}
                <div className="p-4 bg-[#f8f9ff] rounded-xl border border-[#e2e8f0] grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[11px] text-slate-500 block uppercase font-bold">Cliente / Razón Social</span>
                    <span className="font-bold text-slate-900 text-sm block">{client.businessName}</span>
                    <span className="text-[11px] text-slate-600 block mt-0.5">
                      {client.identificationType}: <strong className="font-mono">{client.identificationNumber}</strong>
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    <div>
                      <span className="text-[11px] text-slate-500 uppercase font-bold">Contacto: </span>
                      <span className="font-medium text-slate-800">{client.email || "No registrado"} • {client.phone || "No registrado"}</span>
                    </div>
                    {client.address && (
                      <div>
                        <span className="text-[11px] text-slate-500 uppercase font-bold">Dirección: </span>
                        <span className="font-medium text-slate-800">{client.address}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tarjetas de Resumen Financiero */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-left">
                    <span className="text-[11px] text-slate-500 uppercase font-bold block">Total Facturado</span>
                    <span className="text-lg font-mono font-black text-slate-900 mt-1 block">
                      ${cobrosCounts.grandTotal.toFixed(2)} USD
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">{charges.length} comprobante(s)</span>
                  </div>

                  <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 text-left">
                    <span className="text-[11px] text-emerald-800 uppercase font-bold block">Total Cobrado</span>
                    <span className="text-lg font-mono font-black text-emerald-700 mt-1 block">
                      ${cobrosCounts.totalPaid.toFixed(2)} USD
                    </span>
                    <span className="text-[10px] text-emerald-600 mt-0.5 block">{cobrosCounts.pagado} pagado(s)</span>
                  </div>

                  <div className={`p-4 rounded-xl text-left border ${
                    cobrosCounts.totalPending > 0
                      ? "bg-amber-50/80 border-amber-300"
                      : "bg-emerald-50/40 border-emerald-200"
                  }`}>
                    <span className={`text-[11px] uppercase font-bold block ${
                      cobrosCounts.totalPending > 0 ? "text-amber-900" : "text-emerald-800"
                    }`}>
                      Saldo Pendiente
                    </span>
                    <span className={`text-lg font-mono font-black mt-1 block ${
                      cobrosCounts.totalPending > 0 ? "text-amber-800" : "text-emerald-700"
                    }`}>
                      ${cobrosCounts.totalPending.toFixed(2)} USD
                    </span>
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      {cobrosCounts.totalPending > 0 ? `${cobrosCounts.pendiente} comprobante(s) por cobrar` : "Cuenta al día"}
                    </span>
                  </div>
                </div>

                {/* Tabla de Comprobantes */}
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-xs uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Comprobante</th>
                        <th className="py-2.5 px-3">Periodo</th>
                        <th className="py-2.5 px-3">Descripción</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                        <th className="py-2.5 px-3 text-center">Estado</th>
                        <th className="py-2.5 px-3 text-right">Saldo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {charges.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-400 italic">
                            Sin cobros registrados en el historial de este cliente.
                          </td>
                        </tr>
                      ) : (
                        charges.map((c) => {
                          const balance = c.status === "pagado" ? 0 : (c.balanceRemaining ?? c.total);
                          return (
                            <tr key={c.id}>
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                                {c.invoiceNumber}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600">
                                {c.month}/{c.year}
                              </td>
                              <td className="py-2.5 px-3 text-slate-700 max-w-xs truncate">
                                {c.serviceDescription}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                                ${c.total.toFixed(2)}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    c.status === "pagado"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-amber-100 text-amber-900"
                                  }`}
                                >
                                  {c.status}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                                ${balance.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Cuentas Bancarias para Depósito */}
                {bankAccounts && bankAccounts.length > 0 && (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    <span className="font-bold text-slate-800 block uppercase tracking-wider mb-2 text-[11px]">
                      Cuentas Bancarias Autorizadas para Pagos / Transferencias
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {bankAccounts.map((b) => (
                        <div key={b.id} className="p-2.5 bg-white rounded-lg border border-slate-200">
                          <span className="font-bold text-[#004ac6] block text-xs">{b.bankName}</span>
                          <span className="text-[11px] text-slate-600 block">Tipo: {b.accountType}</span>
                          <span className="font-mono font-bold text-slate-800 block text-xs">N° {b.accountNumber}</span>
                          <span className="text-[10px] text-slate-500 block truncate">Beneficiario: {sriCompanyConfig?.razonSocial || "INNTEL CORP S.A."}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Nota al Pie */}
                <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400">
                  <span>Control Inntel • Sistema Integral ISP & Telecomunicaciones</span>
                  <span>Documento generado con fines informativos y de cobranza comercial</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Recibo de Pago Individual Imprimible */}
      {receiptCharge && client && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 px-5 bg-[#0b1c30] text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-[#eff4ff]" />
                <h3 className="font-bold text-xs text-white">Recibo de Cobro Oficial</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintReceipt}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReceiptCharge(null)}
                  className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 bg-slate-50/50">
              <div
                ref={receiptPrintRef}
                className="bg-white p-6 rounded-xl border border-slate-200 space-y-4 text-xs font-mono"
              >
                <div className="text-center pb-3 border-b border-dashed border-slate-300 space-y-1">
                  <h4 className="font-black text-sm text-slate-900">{sriCompanyConfig?.razonSocial || "INNTEL CORP S.A."}</h4>
                  <p className="text-[10px] text-slate-500">RUC: {sriCompanyConfig?.ruc || "0993392437001"}</p>
                  <p className="text-[10px] font-bold text-[#004ac6]">COMPROBANTE DE PAGO REGISTRADO</p>
                </div>

                <div className="space-y-1.5 text-[11px] text-slate-700">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Comprobante:</span>
                    <span className="font-bold text-slate-900">{receiptCharge.invoiceNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Cliente:</span>
                    <span className="font-bold text-slate-900 text-right">{client.businessName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">RUC/CI:</span>
                    <span>{client.identificationNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Periodo:</span>
                    <span>{receiptCharge.month}/{receiptCharge.year}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Fecha Pago:</span>
                    <span>{receiptCharge.paymentDate || new Date().toISOString().slice(0, 10)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Método:</span>
                    <span className="uppercase">{receiptCharge.paymentMethod || "Transferencia"}</span>
                  </div>
                  {receiptCharge.paymentReference && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Referencia:</span>
                      <span>{receiptCharge.paymentReference}</span>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-dashed border-slate-300 space-y-1 text-slate-800">
                  <div className="flex justify-between">
                    <span>Concepto:</span>
                    <span className="text-right truncate max-w-[200px]">{receiptCharge.serviceDescription}</span>
                  </div>
                  <div className="flex justify-between text-sm font-black text-slate-900 pt-1">
                    <span>TOTAL PAGADO:</span>
                    <span>${receiptCharge.total.toFixed(2)} USD</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 text-center text-[10px] text-emerald-700 font-bold">
                  ✓ ESTADO: PAGADO / CONCILIADO
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
