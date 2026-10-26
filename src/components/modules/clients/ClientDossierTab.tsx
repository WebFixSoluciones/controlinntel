"use client";

import React, { useRef } from "react";
import Image from "next/image";
import { useApp } from "@/lib/state";
import { Client } from "@/types";
import { ClientTabHeader } from "./ClientTabHeader";
import { printHtmlElement } from "@/lib/print-service";
import {
  Printer,
  FileText,
  User,
  Radio,
  KeyRound,
  ShieldCheck,
  DollarSign,
  Ticket,
  Kanban,
  CheckCircle2,
} from "lucide-react";

interface ClientDossierTabProps {
  client: Client;
}

export function ClientDossierTab({ client }: ClientDossierTabProps) {
  const { clientServices, clientProjects, clientQuotes, clientVaultItems, clientContracts, monthlyCharges, tickets } = useApp();

  const services = clientServices.filter((s) => s.clientId === client.id);
  const projects = clientProjects.filter((p) => p.clientId === client.id);
  const quotes = clientQuotes.filter((q) => q.clientId === client.id);
  const vaultItems = clientVaultItems.filter((v) => v.clientId === client.id);
  const contracts = clientContracts.filter((c) => c.clientId === client.id);
  const charges = monthlyCharges.filter((c) => c.clientId === client.id);
  const clientTickets = tickets.filter((t) => t.clientId === client.id);

  const totalMonthlySpend = services.reduce((sum, s) => sum + s.customPrice, 0);
  const dossierPrintRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (dossierPrintRef.current) {
      printHtmlElement(
        dossierPrintRef.current,
        `Expediente-${client.identificationNumber || client.id}`,
        "a4"
      );
    } else {
      window.print();
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Print Button */}
      <div className="print:hidden">
        <ClientTabHeader
          title="Informes"
          icon={Printer}
          actions={
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir / Exportar PDF</span>
            </button>
          }
        />
      </div>

      {/* Printable Sheet */}
      <div
        id="dossier-print-area"
        ref={dossierPrintRef}
        className="bg-white p-6 rounded-xl border border-[#e2e8f0] shadow-2xs space-y-6 print:border-none print:shadow-none print:p-0"
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#e2e8f0]">
          <div className="flex items-center gap-4">
            <div className="w-20 h-16 bg-white rounded-lg border border-[#e2e8f0] p-1.5 flex items-center justify-center shadow-2xs shrink-0">
              <img src="/logo-inntel.webp" alt="INNTEL CORP S.A." className="max-h-full max-w-full object-contain" />
            </div>
            <div>
              <h2 className="text-base font-black text-[#0b1c30]">INNTEL CORP S.A.</h2>
              <p className="text-xs font-bold text-[#004ac6] uppercase tracking-wider">
                Expediente Técnico del Cliente • Código SAI {client.id.toUpperCase()}
              </p>
            </div>
          </div>

          <div className="text-right text-xs">
            <span className="font-mono font-bold text-[#0b1c30] bg-[#f8f9ff] px-2.5 py-1 rounded-md border border-[#e2e8f0]">
              {client.identificationType}: {client.identificationNumber}
            </span>
            <p className="text-[11px] text-[#64748b] mt-1">Generado: {new Date().toLocaleDateString("es-EC")}</p>
          </div>
        </div>

        {/* Section 1: Legal Data */}
        <div className="space-y-2">
          <h4 className="font-bold text-[#0b1c30] text-xs flex items-center gap-1.5 pb-1 border-b border-[#f1f5f9] uppercase tracking-wider">
            <User className="w-3.5 h-3.5 text-[#004ac6]" /> 1. Datos Generales & Legales
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs bg-[#f8f9ff] p-4 rounded-lg border border-[#e2e8f0]">
            <div>
              <span className="text-xs font-semibold text-[#64748b] block mb-0.5">Razón Social / Nombre</span>
              <span className="font-bold text-[#0b1c30]">{client.businessName}</span>
            </div>
            <div>
              <span className="text-xs font-semibold text-[#64748b] block mb-0.5">Representante Legal</span>
              <span className="font-medium text-[#0b1c30]">{client.legalRepresentative || "N/A"}</span>
            </div>
            <div>
              <span className="text-xs font-semibold text-[#64748b] block mb-0.5">Correo de Contacto</span>
              <span className="font-medium text-[#0b1c30]">{client.email}</span>
            </div>
            <div>
              <span className="text-xs font-semibold text-[#64748b] block mb-0.5">Teléfono</span>
              <span className="font-medium text-[#0b1c30]">{client.phone}</span>
            </div>
            <div className="col-span-2">
              <span className="text-xs font-semibold text-[#64748b] block mb-0.5">Dirección de Instalación</span>
              <span className="font-medium text-[#0b1c30]">{client.address} ({client.sector || "Sector Central"})</span>
            </div>
            <div>
              <span className="text-xs font-semibold text-[#64748b] block mb-0.5">Estado del Cliente</span>
              <span className="font-bold text-emerald-700 uppercase">{client.status}</span>
            </div>
            <div>
              <span className="text-xs font-semibold text-[#64748b] block mb-0.5">Tarifa Mensual Recurrente</span>
              <span className="font-bold text-[#0b1c30] font-mono">${totalMonthlySpend.toFixed(2)} USD</span>
            </div>
          </div>
        </div>

        {/* Section 2: Technical Connectivity */}
        <div className="space-y-2">
          <h4 className="font-bold text-[#0b1c30] text-xs flex items-center gap-1.5 pb-1 border-b border-[#f1f5f9] uppercase tracking-wider">
            <Radio className="w-3.5 h-3.5 text-[#004ac6]" /> 2. Conectividad Fibra Óptica & Parámetros MikroTik
          </h4>
          {services.length === 0 ? (
            <p className="text-xs text-[#64748b] italic p-4 bg-[#f8f9ff] rounded-lg border border-[#e2e8f0]">Sin servicios asignados.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {services.map((srv) => (
                <div key={srv.id} className="p-4 bg-[#f8f9ff] rounded-lg border border-[#e2e8f0] text-xs space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-[#0b1c30] text-sm">{srv.planName}</span>
                    <span className="font-bold text-emerald-700 font-mono">${srv.customPrice.toFixed(2)}/mes</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-[#e2e8f0]">
                    <p><span className="text-[#64748b]">Nodo/POP:</span> <span className="font-semibold text-[#0b1c30]">{srv.nodeName}</span></p>
                    <p><span className="text-[#64748b]">Dirección IPv4:</span> <span className="font-mono font-bold text-[#004ac6]">{srv.ipv4Address}</span></p>
                    <p><span className="text-[#64748b]">Usuario PPPoE:</span> <span className="font-mono text-[#0b1c30]">{srv.pppoeUser}</span></p>
                    <p><span className="text-[#64748b]">Velocidad:</span> <span className="font-semibold text-[#0b1c30]">{srv.downloadMbps}M / {srv.uploadMbps}M</span></p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 3: Summary Cards Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Contracts */}
          <div className="p-4 bg-[#f8f9ff] rounded-lg border border-[#e2e8f0] text-xs space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-[#0b1c30] text-xs uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Contratos ARCOTEL
            </div>
            {contracts.length === 0 ? (
              <p className="text-xs text-[#64748b] italic">Sin contratos registrados</p>
            ) : (
              contracts.slice(0, 2).map((c) => (
                <div key={c.id} className="text-xs bg-white p-2.5 rounded-lg border border-[#e2e8f0]">
                  <p className="font-bold text-[#0b1c30]">{c.contractNumber}</p>
                  <p className="text-[#64748b]">Vigente hasta: {c.expirationDate}</p>
                </div>
              ))
            )}
          </div>

          {/* Active Projects */}
          <div className="p-4 bg-[#f8f9ff] rounded-lg border border-[#e2e8f0] text-xs space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-[#0b1c30] text-xs uppercase tracking-wider">
              <Kanban className="w-4 h-4 text-[#004ac6]" /> Despliegue & Obras
            </div>
            {projects.length === 0 ? (
              <p className="text-xs text-[#64748b] italic">Sin proyectos en curso</p>
            ) : (
              projects.slice(0, 2).map((p) => (
                <div key={p.id} className="text-xs bg-white p-2.5 rounded-lg border border-[#e2e8f0]">
                  <p className="font-bold text-[#0b1c30] truncate">{p.title}</p>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-[#eff4ff] text-[#004ac6] border border-[#dce9ff]">
                    {p.column.replace("_", " ")}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Credentials */}
          <div className="p-4 bg-[#f8f9ff] rounded-lg border border-[#e2e8f0] text-xs space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-[#0b1c30] text-xs uppercase tracking-wider">
              <KeyRound className="w-4 h-4 text-purple-600" /> Claves & Accesos
            </div>
            {vaultItems.length === 0 ? (
              <p className="text-xs text-[#64748b] italic">Sin claves almacenadas</p>
            ) : (
              vaultItems.slice(0, 2).map((v) => (
                <div key={v.id} className="text-xs bg-white p-2.5 rounded-lg border border-[#e2e8f0] flex justify-between">
                  <span className="font-bold text-[#0b1c30] truncate">{v.serviceName}</span>
                  <span className="font-mono text-[#64748b]">{v.username}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer Signature Box for Formal Dossier */}
        <div className="pt-6 border-t border-[#e2e8f0] grid grid-cols-2 gap-8 text-center text-xs">
          <div>
            <div className="border-b border-[#cbd5e1] w-48 mx-auto h-12" />
            <p className="font-bold text-[#0b1c30] mt-2">{client.businessName}</p>
            <p className="text-xs text-[#64748b]">Firma del Cliente / Representante</p>
          </div>
          <div>
            <div className="border-b border-[#cbd5e1] w-48 mx-auto h-12" />
            <p className="font-bold text-[#0b1c30] mt-2">INNTEL CORP S.A.</p>
            <p className="text-xs text-[#64748b]">Responsable Técnico & Homologación SAI</p>
          </div>
        </div>
      </div>
    </div>
  );
}
