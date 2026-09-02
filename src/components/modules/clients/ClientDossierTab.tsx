"use client";

import React from "react";
import Image from "next/image";
import { useApp } from "@/lib/state";
import { Client } from "@/types";
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

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4 select-none">
      {/* Header Print Button */}
      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200/80 print:hidden">
        <div>
          <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
            <FileText className="w-4 h-4 text-sky-600" />
            Dossier Consolidado & Ficha Técnica Integral 360°
          </h4>
          <p className="text-[11px] text-slate-400">
            Resumen ejecutivo que reúne datos legales, red, credenciales, contratos ARCOTEL, estado de obras y facturación
          </p>
        </div>

        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>Imprimir / Exportar Dossier PDF</span>
        </button>
      </div>

      {/* Printable Sheet */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-6 print:border-none print:shadow-none print:p-0">
        {/* Brand Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-xl border border-slate-200 p-1 flex items-center justify-center shadow-xs">
              <Image src="/logo-inntel.webp" alt="INNTEL CORP" width={40} height={40} className="object-contain" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">INNTEL CORP S.A.</h2>
              <p className="text-[11px] font-semibold text-sky-700 uppercase tracking-wider">
                Expediente Técnico del Abonado • Código SAI {client.id.toUpperCase()}
              </p>
            </div>
          </div>

          <div className="text-right text-xs">
            <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">
              {client.identificationType}: {client.identificationNumber}
            </span>
            <p className="text-[10px] text-slate-400 mt-1">Generado: {new Date().toLocaleDateString("es-EC")}</p>
          </div>
        </div>

        {/* Section 1: Legal Data */}
        <div className="space-y-2">
          <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 pb-1 border-b border-slate-100 uppercase tracking-wider text-[10px] text-slate-500">
            <User className="w-3.5 h-3.5 text-sky-600" /> 1. Datos Generales & Legales
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
            <div>
              <span className="text-[10px] text-slate-400 font-bold block">Razón Social / Nombre</span>
              <span className="font-bold text-slate-900">{client.businessName}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold block">Representante Legal</span>
              <span className="font-medium text-slate-800">{client.legalRepresentative || "N/A"}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold block">Correo de Contacto</span>
              <span className="font-medium text-slate-800">{client.email}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold block">Teléfono</span>
              <span className="font-medium text-slate-800">{client.phone}</span>
            </div>
            <div className="col-span-2">
              <span className="text-[10px] text-slate-400 font-bold block">Dirección de Instalación</span>
              <span className="font-medium text-slate-800">{client.address} ({client.sector || "Sector Central"})</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold block">Estado del Abonado</span>
              <span className="font-bold text-emerald-700 uppercase">{client.status}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold block">Tarifa Mensual Recurrente</span>
              <span className="font-bold text-slate-900 font-mono">${totalMonthlySpend.toFixed(2)} USD</span>
            </div>
          </div>
        </div>

        {/* Section 2: Technical Connectivity */}
        <div className="space-y-2">
          <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 pb-1 border-b border-slate-100 uppercase tracking-wider text-[10px] text-slate-500">
            <Radio className="w-3.5 h-3.5 text-indigo-600" /> 2. Conectividad Fibra Óptica & Parámetros MikroTik
          </h4>
          {services.length === 0 ? (
            <p className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-xl">Sin servicios asignados.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {services.map((srv) => (
                <div key={srv.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-900">{srv.planName}</span>
                    <span className="font-bold text-emerald-700 font-mono">${srv.customPrice.toFixed(2)}/mes</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                    <p><span className="text-slate-400">Nodo/POP:</span> <span className="font-semibold">{srv.nodeName}</span></p>
                    <p><span className="text-slate-400">Dirección IPv4:</span> <span className="font-mono font-bold text-sky-700">{srv.ipv4Address}</span></p>
                    <p><span className="text-slate-400">Usuario PPPoE:</span> <span className="font-mono">{srv.pppoeUser}</span></p>
                    <p><span className="text-slate-400">Velocidad:</span> <span className="font-semibold">{srv.downloadMbps}M / {srv.uploadMbps}M</span></p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 3: Summary Cards Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Contracts */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Contratos ARCOTEL ({contracts.length})
            </div>
            {contracts.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic">Sin contratos registrados</p>
            ) : (
              contracts.slice(0, 2).map((c) => (
                <div key={c.id} className="text-[11px] bg-white p-2 rounded-xl border border-slate-100">
                  <p className="font-bold text-slate-800">{c.contractNumber}</p>
                  <p className="text-slate-500">Vigente hasta: {c.expirationDate}</p>
                </div>
              ))
            )}
          </div>

          {/* Active Projects */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
              <Kanban className="w-4 h-4 text-sky-600" /> Despliegue & Obras ({projects.length})
            </div>
            {projects.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic">Sin proyectos en curso</p>
            ) : (
              projects.slice(0, 2).map((p) => (
                <div key={p.id} className="text-[11px] bg-white p-2 rounded-xl border border-slate-100">
                  <p className="font-bold text-slate-800 truncate">{p.title}</p>
                  <span className="text-[9px] font-bold uppercase px-1.5 rounded bg-sky-100 text-sky-800">
                    {p.column.replace("_", " ")}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Credentials */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
              <KeyRound className="w-4 h-4 text-purple-600" /> Claves & Accesos ({vaultItems.length})
            </div>
            {vaultItems.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic">Sin claves almacenadas</p>
            ) : (
              vaultItems.slice(0, 2).map((v) => (
                <div key={v.id} className="text-[11px] bg-white p-2 rounded-xl border border-slate-100 flex justify-between">
                  <span className="font-bold text-slate-800 truncate">{v.serviceName}</span>
                  <span className="font-mono text-slate-400">{v.username}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer Signature Box for Formal Dossier */}
        <div className="pt-6 border-t border-slate-200 grid grid-cols-2 gap-8 text-center text-xs">
          <div>
            <div className="border-b border-slate-300 w-48 mx-auto h-12" />
            <p className="font-bold text-slate-900 mt-2">{client.businessName}</p>
            <p className="text-[10px] text-slate-400">Firma del Abonado / Representante</p>
          </div>
          <div>
            <div className="border-b border-slate-300 w-48 mx-auto h-12" />
            <p className="font-bold text-slate-900 mt-2">INNTEL CORP S.A.</p>
            <p className="text-[10px] text-slate-400">Responsable Técnico & Homologación SAI</p>
          </div>
        </div>
      </div>
    </div>
  );
}
