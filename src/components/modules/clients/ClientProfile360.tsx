"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { Client } from "@/types";
import {
  X,
  Building2,
  Edit,
  Download,
  Phone,
  Mail,
  Copy,
  Check,
  AlertTriangle,
  ArrowRight,
  Router,
  Eye,
  EyeOff,
  User,
  ShieldCheck,
  CreditCard,
  Clock,
  Radio,
  FileText,
  DollarSign,
  Ticket as TicketIcon,
  ShoppingCart,
} from "lucide-react";
import { generateAdhesionContractDocx, triggerBrowserDownload } from "@/lib/doc-generator";

interface ClientProfile360Props {
  client: Client | null;
  onClose: () => void;
  onEdit?: () => void;
}

export function ClientProfile360({ client, onClose, onEdit }: ClientProfile360Props) {
  const { clientServices, monthlyCharges, tickets, policies, nodes } = useApp();
  const { showSuccess, showError } = useToast();
  const [activeTab, setActiveTab] = useState<
    "general" | "plan" | "arcotel" | "tecnica" | "tickets" | "pagos" | "pedidos"
  >("general");
  const [isIpRevealed, setIsIpRevealed] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!client) return null;

  const services = clientServices.filter((s) => s.clientId === client.id);
  const mainService = services[0];
  const charges = monthlyCharges.filter((c) => c.clientId === client.id);
  const clientTickets = tickets.filter((t) => t.clientId === client.id);
  const node = nodes.find((n) => n.id === mainService?.nodeId);

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    showSuccess("Copiado al Portapapeles", `${fieldName}: ${text}`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleDownloadReport = async () => {
    try {
      const blob = await generateAdhesionContractDocx(client, mainService);
      triggerBrowserDownload(blob, `Ficha_Tecnica_360_${client.identificationNumber}.docx`);
      showSuccess("Reporte Descargado", `Expediente de ${client.businessName} descargado.`);
    } catch (e) {
      showError("Error", "No se pudo generar el reporte.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 sm:p-6 animate-in fade-in duration-150 select-none overflow-y-auto">
      <div className="w-full max-w-5xl bg-[#f8f9ff] rounded-2xl shadow-2xl border border-[#e2e8f0] overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Breadcrumb & Close Bar */}
        <div className="px-6 py-3 bg-white border-b border-[#e2e8f0] flex items-center justify-between text-xs text-[#737686]">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="hover:text-[#004ac6] font-medium transition-colors cursor-pointer"
            >
              Clientes
            </button>
            <span>&rsaquo;</span>
            <span className="font-bold text-[#0b1c30] uppercase truncate max-w-md">
              {client.businessName}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#737686] hover:text-[#0b1c30] hover:bg-[#f1f5f9] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Header Card matching Screenshot 1 */}
          <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6 shadow-lumina-card flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-14 h-14 rounded-xl bg-[#eff4ff] text-[#004ac6] border border-[#dce9ff] flex items-center justify-center flex-shrink-0 shadow-2xs">
                <Building2 className="w-7 h-7" />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-xl font-bold text-[#0b1c30] tracking-tight uppercase">
                    {client.businessName}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#ecfdf5] text-[#065f46] border border-[#a7f3d0]">
                    Activo
                  </span>
                </div>

                <p className="text-xs text-[#737686] font-mono mt-1 flex items-center gap-1.5 font-medium">
                  <Building2 className="w-3.5 h-3.5 text-[#737686]" />
                  {client.identificationType}: {client.identificationNumber}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={onEdit}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#cbd5e1] text-[#004ac6] hover:bg-[#eff4ff] text-xs font-bold transition-all cursor-pointer shadow-2xs"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Editar</span>
              </button>

              <button
                onClick={handleDownloadReport}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#004ac6] hover:bg-[#2563eb] text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar Reporte</span>
              </button>
            </div>
          </div>

          {/* Tab Navigation matching Screenshot 1 */}
          <div className="border-b border-[#e2e8f0] flex gap-8 text-xs font-semibold overflow-x-auto no-scrollbar">
            {[
              { id: "general", label: "Información General" },
              { id: "plan", label: "Plan & Paquete" },
              { id: "arcotel", label: "ARCOTEL & Documentos" },
              { id: "tecnica", label: "Área Técnica" },
              { id: "tickets", label: `Tickets (${clientTickets.length})` },
              { id: "pagos", label: "Pagos" },
              { id: "pedidos", label: "Pedidos" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`pb-3 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === tab.id
                    ? "border-b-2 border-[#004ac6] text-[#004ac6] font-bold"
                    : "text-[#737686] hover:text-[#0b1c30]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB 1: INFORMACIÓN GENERAL matching Screenshot 1 */}
          {activeTab === "general" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column (5 Cols): Información Principal & Ejecutivo Asignado */}
              <div className="lg:col-span-5 space-y-6">
                {/* Información Principal Card */}
                <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6 shadow-lumina-card space-y-4">
                  <h3 className="font-bold text-sm text-[#0b1c30] flex items-center gap-2">
                    <User className="w-4 h-4 text-[#737686]" />
                    Información Principal
                  </h3>

                  <div className="space-y-3 text-xs divide-y divide-[#f1f5f9]">
                    <div className="pt-2">
                      <span className="text-[#737686] font-semibold block text-[11px]">
                        Representante Legal
                      </span>
                      <span className="font-bold text-[#0b1c30] text-xs mt-0.5 block">
                        {client.legalRepresentative || "Carlos Mendoza Ribera"}
                      </span>
                    </div>

                    <div className="pt-3 flex items-center justify-between">
                      <div>
                        <span className="text-[#737686] font-semibold block text-[11px]">
                          Teléfono Principal
                        </span>
                        <span className="font-semibold text-[#0b1c30] text-xs mt-0.5 block font-mono">
                          {client.phone}
                        </span>
                      </div>
                      <button
                        onClick={() => handleCopy(client.phone, "Teléfono")}
                        className="p-1.5 text-[#737686] hover:text-[#004ac6] hover:bg-[#eff4ff] rounded-md transition-colors cursor-pointer"
                        title="Copiar teléfono"
                      >
                        {copiedField === "Teléfono" ? (
                          <Check className="w-3.5 h-3.5 text-[#10B981]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    <div className="pt-3 flex items-center justify-between">
                      <div className="min-w-0 pr-2">
                        <span className="text-[#737686] font-semibold block text-[11px]">
                          Correo Electrónico
                        </span>
                        <span className="font-semibold text-[#0b1c30] text-xs mt-0.5 block truncate">
                          {client.email}
                        </span>
                      </div>
                      <button
                        onClick={() => handleCopy(client.email, "Correo")}
                        className="p-1.5 text-[#737686] hover:text-[#004ac6] hover:bg-[#eff4ff] rounded-md transition-colors cursor-pointer flex-shrink-0"
                        title="Copiar email"
                      >
                        {copiedField === "Correo" ? (
                          <Check className="w-3.5 h-3.5 text-[#10B981]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    <div className="pt-3">
                      <span className="text-[#737686] font-semibold block text-[11px]">
                        Dirección Fiscal
                      </span>
                      <span className="font-medium text-[#434655] text-xs mt-0.5 block leading-relaxed">
                        {client.address}, {client.sector || "Quito, Pichincha"}.
                      </span>
                    </div>
                  </div>
                </div>

                {/* Ejecutivo Asignado Card */}
                <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5 shadow-lumina-card">
                  <span className="text-xs font-bold text-[#0b1c30] block mb-3">
                    Ejecutivo Asignado
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#004ac6] to-[#712ae2] text-white font-bold text-sm flex items-center justify-center shadow-xs flex-shrink-0">
                      AT
                    </div>
                    <div>
                      <p className="font-bold text-xs text-[#0b1c30]">Ana Paula Torres</p>
                      <p className="text-[11px] text-[#737686]">KAM Corporativo</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column (7 Cols): Saldo, Alertas y Detalles de Conexión */}
              <div className="lg:col-span-7 space-y-6">
                {/* Top Row: Saldo Pendiente + Aviso de Vencimiento */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Saldo Pendiente */}
                  <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5 shadow-lumina-card flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-[#737686] uppercase tracking-wider">
                          SALDO PENDIENTE
                        </span>
                        <div className="w-8 h-8 rounded-lg bg-[#eff4ff] text-[#004ac6] flex items-center justify-center">
                          <CreditCard className="w-4 h-4" />
                        </div>
                      </div>

                      <div className="mt-2 text-2xl font-black text-[#0b1c30] font-tnum">
                        ${(mainService?.customPrice || 1450).toLocaleString("es-EC", {
                          minimumFractionDigits: 2,
                        })}
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-[#f1f5f9] text-[11px] text-[#737686] flex items-center gap-1.5 font-medium">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Último pago: 12/Oct/2023 - $1,200.00</span>
                    </div>
                  </div>

                  {/* Aviso de Vencimiento */}
                  <div className="bg-white rounded-2xl border border-amber-300 ring-1 ring-amber-100 p-5 shadow-lumina-card flex flex-col justify-between border-l-4 border-l-amber-500">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-[#0b1c30] uppercase tracking-wider">
                          AVISO DE VENCIMIENTO
                        </span>
                        <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                      </div>

                      <p className="mt-2 text-xs font-bold text-[#0b1c30]">
                        Póliza de Responsabilidad Civil
                      </p>
                      <p className="text-xs text-[#737686] mt-0.5 font-medium">
                        Vence en 15 días (30/Nov/2023).
                      </p>
                    </div>

                    <button
                      onClick={() => setActiveTab("arcotel")}
                      className="mt-3 pt-3 border-t border-amber-100 text-xs font-bold text-[#004ac6] hover:text-[#2563eb] flex items-center gap-1 cursor-pointer"
                    >
                      <span>Gestionar Documento</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Detalles de Conexión (Área Técnica) Card */}
                <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6 shadow-lumina-card space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#f1f5f9]">
                    <h3 className="font-bold text-sm text-[#0b1c30] flex items-center gap-2">
                      <Router className="w-4 h-4 text-[#004ac6]" />
                      Detalles de Conexión (Área Técnica)
                    </h3>
                    <button
                      onClick={() => setActiveTab("tecnica")}
                      className="text-xs font-bold text-[#004ac6] hover:underline cursor-pointer"
                    >
                      Ver Tab Completo
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    {/* Nodo */}
                    <div>
                      <span className="text-[#737686] font-semibold block text-[11px] mb-1">
                        Nodo de Conexión
                      </span>
                      <div className="p-2.5 rounded-lg bg-[#f8f9ff] border border-[#e2e8f0] flex items-center gap-2 font-bold text-[#0b1c30]">
                        <Radio className="w-3.5 h-3.5 text-[#004ac6]" />
                        <span>{node?.name || "POP Central Matriz"}</span>
                      </div>
                    </div>

                    {/* Ancho de Banda */}
                    <div>
                      <span className="text-[#737686] font-semibold block text-[11px] mb-1">
                        Ancho de Banda Contratado
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 p-2 rounded-lg bg-[#f8f9ff] border border-[#e2e8f0] text-center font-bold text-[#0b1c30]">
                          {mainService?.downloadMbps || 100} Mbps <span className="text-[10px] text-[#737686]">DL</span>
                        </div>
                        <div className="flex-1 p-2 rounded-lg bg-[#f8f9ff] border border-[#e2e8f0] text-center font-bold text-[#0b1c30]">
                          {mainService?.uploadMbps || 100} Mbps <span className="text-[10px] text-[#737686]">UL</span>
                        </div>
                      </div>
                    </div>

                    {/* IP Pública */}
                    <div>
                      <span className="text-[#737686] font-semibold block text-[11px] mb-1">
                        Dirección IP Pública
                      </span>
                      <div className="p-2.5 rounded-lg bg-[#f8f9ff] border border-[#e2e8f0] flex items-center justify-between font-mono font-bold text-[#0b1c30]">
                        <span>
                          {isIpRevealed ? mainService?.ipv4Address || "190.15.142.88" : "•••••••••••••"}
                        </span>
                        <button
                          onClick={() => setIsIpRevealed(!isIpRevealed)}
                          className="text-[#737686] hover:text-[#004ac6] cursor-pointer"
                        >
                          {isIpRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Equipo Cliente CPE */}
                    <div>
                      <span className="text-[#737686] font-semibold block text-[11px] mb-1">
                        Equipo Cliente (CPE)
                      </span>
                      <div className="p-2.5 rounded-lg bg-[#f8f9ff] border border-[#e2e8f0] font-semibold text-[#0b1c30] truncate">
                        MikroTik CCR1009 (RouterOS v7.11)
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PLAN & PAQUETE */}
          {activeTab === "plan" && (
            <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6 shadow-lumina-card space-y-4">
              <h3 className="font-bold text-sm text-[#0b1c30]">Planes y Servicios Activos</h3>
              {services.map((srv) => (
                <div
                  key={srv.id}
                  className="p-4 rounded-xl border border-[#dce9ff] bg-[#eff4ff]/60 flex flex-wrap items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base text-[#0b1c30]">{srv.planName}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ecfdf5] text-[#065f46]">
                        {srv.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-[#434655] mt-1">
                      Velocidad: <strong>{srv.downloadMbps}M / {srv.uploadMbps}M</strong> • Tarifa pactada:{" "}
                      <strong className="text-[#004ac6]">${srv.customPrice.toFixed(2)}/mes</strong>
                    </p>
                    <p className="text-xs text-[#737686] mt-0.5 font-mono">
                      IPv4: {srv.ipv4Address} • PPPoE: {srv.pppoeUser}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] text-[#737686] block">Corte de Facturación</span>
                    <span className="font-bold text-sm text-[#0b1c30]">Día {srv.cutoffDay} de cada mes</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: ARCOTEL & DOCUMENTOS */}
          {activeTab === "arcotel" && (
            <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6 shadow-lumina-card space-y-4">
              <h3 className="font-bold text-sm text-[#0b1c30]">Documentación Homologada ARCOTEL</h3>
              <div className="p-4 rounded-xl border border-[#e2e8f0] bg-[#f8f9ff] flex items-center justify-between">
                <div>
                  <p className="font-bold text-xs text-[#0b1c30]">
                    Contrato de Adhesión para Servicio de Internet (SAI)
                  </p>
                  <p className="text-[11px] text-[#737686]">
                    Modelo oficial según Resolución ARCOTEL con cláusulas de SLA y datos del abonado
                  </p>
                </div>
                <button
                  onClick={handleDownloadReport}
                  className="px-3.5 py-1.5 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  Descargar (.docx)
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: ÁREA TÉCNICA */}
          {activeTab === "tecnica" && (
            <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6 shadow-lumina-card space-y-4">
              <h3 className="font-bold text-sm text-[#0b1c30]">Parámetros de Red & Conexión MikroTik</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-[#f8f9ff] border border-[#e2e8f0] space-y-2">
                  <span className="font-bold text-[#0b1c30] block">Enlace Troncal y Concentrador</span>
                  <p><span className="text-[#737686]">Nodo POP:</span> <strong>{node?.name || "POP Central"}</strong></p>
                  <p><span className="text-[#737686]">RouterOS IP:</span> <strong className="font-mono">{node?.mikrotikIp || "10.50.1.1"}</strong></p>
                  <p><span className="text-[#737686]">VLAN de Servicio:</span> <strong>VLAN-104 (GPON)</strong></p>
                </div>
                <div className="p-4 rounded-xl bg-[#f8f9ff] border border-[#e2e8f0] space-y-2">
                  <span className="font-bold text-[#0b1c30] block">Credenciales de Acceso PPPoE</span>
                  <p><span className="text-[#737686]">Usuario PPPoE:</span> <strong className="font-mono">{mainService?.pppoeUser || "andina_vip"}</strong></p>
                  <p><span className="text-[#737686]">IPv4 Fija Asignada:</span> <strong className="font-mono text-[#004ac6]">{mainService?.ipv4Address || "190.15.142.88"}</strong></p>
                  <p><span className="text-[#737686]">Estado de Enlace:</span> <strong className="text-[#10B981]">ONLINE (0% Packet Loss)</strong></p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: TICKETS */}
          {activeTab === "tickets" && (
            <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6 shadow-lumina-card space-y-3">
              <h3 className="font-bold text-sm text-[#0b1c30]">Historial de Incidencias & Soporte NOC</h3>
              {clientTickets.length === 0 ? (
                <p className="text-xs text-[#737686] italic py-6 text-center">No registra tickets de soporte abiertos.</p>
              ) : (
                clientTickets.map((t) => (
                  <div key={t.id} className="p-3.5 rounded-xl border border-[#e2e8f0] bg-[#f8f9ff] flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-[#0b1c30]">{t.ticketNumber}: {t.title}</span>
                      <p className="text-[11px] text-[#737686] mt-0.5">{t.description}</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-[#cbd5e1] font-bold text-[#0b1c30]">
                      {t.status.toUpperCase()}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 6: PAGOS */}
          {activeTab === "pagos" && (
            <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6 shadow-lumina-card space-y-3">
              <h3 className="font-bold text-sm text-[#0b1c30]">Historial de Pagos y Cobranzas</h3>
              {charges.length === 0 ? (
                <p className="text-xs text-[#737686] italic py-6 text-center">No registra cobros generados aún.</p>
              ) : (
                charges.map((c) => (
                  <div key={c.id} className="p-3.5 rounded-xl border border-[#e2e8f0] bg-[#f8f9ff] flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-[#0b1c30]">{c.serviceDescription}</p>
                      <p className="text-[11px] text-[#737686]">Factura No. {c.invoiceNumber} • Periodo: {c.month}/{c.year}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-[#0b1c30] block font-tnum">${c.total.toFixed(2)} USD</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ecfdf5] text-[#065f46]">
                        {c.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 7: PEDIDOS */}
          {activeTab === "pedidos" && (
            <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6 shadow-lumina-card space-y-3">
              <h3 className="font-bold text-sm text-[#0b1c30]">Órdenes de Pedido</h3>
              <div className="p-4 rounded-xl border border-[#e2e8f0] bg-[#f8f9ff] text-xs flex items-center justify-between">
                <div>
                  <p className="font-bold text-[#0b1c30]">Orden de Pedido OP-2026-081</p>
                  <p className="text-[11px] text-[#737686]">Instalación de Fibra Óptica Dedicada 500M</p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#eff4ff] text-[#004ac6]">
                  ENTREGADO / ACTIVO
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
