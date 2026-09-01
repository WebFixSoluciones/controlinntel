"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { Client } from "@/types";
import { X, User, Radio, FileText, DollarSign, Ticket as TicketIcon, Download } from "lucide-react";
import { generateAdhesionContractDocx, triggerBrowserDownload } from "@/lib/doc-generator";

interface ClientProfile360Props {
  client: Client | null;
  onClose: () => void;
}

export function ClientProfile360({ client, onClose }: ClientProfile360Props) {
  const { clientServices, monthlyCharges, tickets } = useApp();
  const [activeTab, setActiveTab] = useState<"fiscal" | "red" | "docs" | "finanzas" | "tickets">("fiscal");

  if (!client) return null;

  const services = clientServices.filter((s) => s.clientId === client.id);
  const charges = monthlyCharges.filter((c) => c.clientId === client.id);
  const clientTickets = tickets.filter((t) => t.clientId === client.id);

  const handleDownloadAdhesion = async () => {
    try {
      const blob = await generateAdhesionContractDocx(client, services[0]);
      triggerBrowserDownload(blob, `Contrato_Adhesion_ARCOTEL_${client.identificationNumber}.docx`);
    } catch (e) {
      alert("Error al generar contrato");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Profile */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-sky-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/10 flex items-center justify-center text-sky-300 font-black text-base shadow-xs">
              {client.businessName.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base tracking-tight">{client.businessName}</h2>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                  {client.status.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-sky-200 font-mono mt-0.5">
                {client.identificationType}: {client.identificationNumber} • {client.phone}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50/70 px-4 gap-1 text-xs font-bold">
          <button
            onClick={() => setActiveTab("fiscal")}
            className={`px-4 py-3 border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "fiscal"
                ? "border-sky-600 text-sky-700 bg-white"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <User className="w-4 h-4" /> 1. Datos Fiscales SRI
          </button>

          <button
            onClick={() => setActiveTab("red")}
            className={`px-4 py-3 border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "red"
                ? "border-sky-600 text-sky-700 bg-white"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <Radio className="w-4 h-4" /> 2. Red & MikroTik ({services.length})
          </button>

          <button
            onClick={() => setActiveTab("docs")}
            className={`px-4 py-3 border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "docs"
                ? "border-sky-600 text-sky-700 bg-white"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <FileText className="w-4 h-4" /> 3. Documentación ARCOTEL
          </button>

          <button
            onClick={() => setActiveTab("finanzas")}
            className={`px-4 py-3 border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "finanzas"
                ? "border-sky-600 text-sky-700 bg-white"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <DollarSign className="w-4 h-4" /> 4. Cobros & Facturas ({charges.length})
          </button>

          <button
            onClick={() => setActiveTab("tickets")}
            className={`px-4 py-3 border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "tickets"
                ? "border-sky-600 text-sky-700 bg-white"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <TicketIcon className="w-4 h-4" /> 5. Tickets ({clientTickets.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 text-xs space-y-4">
          {activeTab === "fiscal" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Información Legal
                </span>
                <p>
                  <span className="font-bold text-slate-700">Razón Social:</span> {client.businessName}
                </p>
                <p>
                  <span className="font-bold text-slate-700">Cédula / RUC:</span>{" "}
                  <span className="font-mono font-bold text-sky-700">{client.identificationNumber}</span>
                </p>
                <p>
                  <span className="font-bold text-slate-700">Representante Legal:</span>{" "}
                  {client.legalRepresentative || "N/A"}
                </p>
                <p>
                  <span className="font-bold text-slate-700">Condición SRI:</span>{" "}
                  {client.requiresSriBilling ? "Facturación Electrónica Activa" : "Exento"}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Contacto & Ubicación
                </span>
                <p>
                  <span className="font-bold text-slate-700">Dirección:</span> {client.address}
                </p>
                <p>
                  <span className="font-bold text-slate-700">Sector:</span> {client.sector || "Norte"}
                </p>
                <p>
                  <span className="font-bold text-slate-700">Teléfonos:</span> {client.phone}
                </p>
                <p>
                  <span className="font-bold text-slate-700">Email:</span> {client.email}
                </p>
              </div>
            </div>
          )}

          {activeTab === "red" && (
            <div className="space-y-3">
              {services.map((srv) => (
                <div key={srv.id} className="p-4 rounded-xl border border-sky-100 bg-sky-50/40 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{srv.planName}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {srv.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-slate-600">
                      Velocidad: <span className="font-bold">{srv.downloadMbps}M / {srv.uploadMbps}M</span> • Tarifa:{" "}
                      <span className="font-bold text-emerald-700">${srv.customPrice.toFixed(2)}/mes</span>
                    </p>
                    <p className="text-slate-500 text-[11px]">
                      Nodo: <span className="font-bold text-slate-700">{srv.nodeName}</span> • IPv4:{" "}
                      <span className="font-mono font-bold text-sky-700">{srv.ipv4Address}</span> • PPPoE:{" "}
                      <span className="font-mono text-slate-600">{srv.pppoeUser}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">Día de Corte</span>
                    <span className="font-bold text-base text-slate-800">{srv.cutoffDay} de cada mes</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "docs" && (
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900">Contrato de Adhesión para Servicio de Internet (SAI)</p>
                  <p className="text-[11px] text-slate-500">Modelo formal homologado por ARCOTEL con datos completos</p>
                </div>
                <button
                  onClick={handleDownloadAdhesion}
                  className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  Descargar Word (.docx)
                </button>
              </div>
            </div>
          )}

          {activeTab === "finanzas" && (
            <div className="space-y-2">
              {charges.map((c) => (
                <div key={c.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800">{c.serviceDescription}</span>
                    <p className="text-[11px] text-slate-500">
                      Periodo: {c.month}/{c.year} • Factura No: {c.invoiceNumber}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-slate-900 text-sm block">${c.total.toFixed(2)} USD</span>
                    <span className={`px-2 py-0.2 text-[9px] font-bold rounded-full ${
                      c.status === "pagado" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    }`}>
                      {c.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "tickets" && (
            <div className="space-y-2">
              {clientTickets.length === 0 ? (
                <p className="text-slate-400 italic text-center py-6">No registra tickets técnicos recientes.</p>
              ) : (
                clientTickets.map((t) => (
                  <div key={t.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800">{t.ticketNumber}: {t.title}</span>
                      <p className="text-[11px] text-slate-500">{t.description}</p>
                    </div>
                    <span className="text-[11px] font-bold text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                      {t.status.toUpperCase()}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
