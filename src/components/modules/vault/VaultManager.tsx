"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { SecureVault } from "./SecureVault";
import {
  KeyRound,
  ShieldCheck,
  Search,
  Users,
  Lock,
  ArrowLeft,
  RotateCcw,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";

export function VaultManager() {
  const { clients, clientVaultItems, vault } = useApp();
  const [activeTab, setActiveTab] = useState<"clientes" | "sistema">("clientes");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  const getClientVaultItems = (id: string) => clientVaultItems.filter((v) => v.clientId === id);

  const filteredClients = clients.filter((c) => {
    const items = getClientVaultItems(c.id);
    const servicesText = items.map((i) => `${i.serviceName} ${i.notes || ""}`).join(" ");
    const searchTarget = `${c.businessName} ${c.identificationNumber} ${servicesText}`.toLowerCase();
    return !query.trim() || searchTarget.includes(query.trim().toLowerCase());
  });

  return (
    <div className="w-full space-y-6 select-none">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#004ac6] to-[#1e293b] flex items-center justify-center text-white shadow-xs">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#0b1c30] tracking-tight">
              Bóveda de Credenciales & Accesos Cifrados
            </h1>
          </div>
        </div>
      </div>

      {/* Navigation Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-[#e2e8f0] pb-2">
        <button
          onClick={() => {
            setActiveTab("clientes");
            setSelectedClientId(null);
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "clientes"
              ? "bg-[#004ac6] text-white shadow-xs"
              : "bg-white text-[#434655] hover:bg-[#f8f9ff] border border-[#e2e8f0]"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Credenciales de Abonados</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeTab === "clientes" ? "bg-white/20 text-white" : "bg-slate-100 text-[#434655]"
            }`}
          >
            {clientVaultItems.length}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab("sistema");
            setSelectedClientId(null);
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "sistema"
              ? "bg-[#004ac6] text-white shadow-xs"
              : "bg-white text-[#434655] hover:bg-[#f8f9ff] border border-[#e2e8f0]"
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Accesos Internos del Sistema (NOC Core)</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeTab === "sistema" ? "bg-white/20 text-white" : "bg-slate-100 text-[#434655]"
            }`}
          >
            {vault.length}
          </span>
        </button>
      </div>

      {/* TAB 1: CLIENTES */}
      {activeTab === "clientes" && (
        <div className="space-y-4">
          {selectedClientId && selectedClient ? (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Breadcrumb Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 px-6 rounded-2xl border border-[#e2e8f0] shadow-2xs">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedClientId(null)}
                    className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Volver al Listado de Abonados</span>
                  </button>
                  <span className="text-slate-300">/</span>
                  <span className="text-xs font-bold text-[#0b1c30]">{selectedClient.businessName}</span>
                  <span className="font-mono text-[10px] bg-slate-100 px-2 py-0.5 rounded border text-slate-600">
                    {selectedClient.identificationNumber}
                  </span>
                </div>
              </div>

              {/* Embedded SecureVault for selected client */}
              <SecureVault key={selectedClientId} clientId={selectedClientId} />
            </div>
          ) : (
            <>
              {/* Search Toolbar */}
              <div className="bg-white rounded-2xl border border-[#e2e8f0] p-4 shadow-lumina-card flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[280px] max-w-md">
                  <Search className="w-4 h-4 text-[#737686] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Buscar abonado, RUC, o servicio con credencial..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full bg-white text-xs text-[#0b1c30] rounded-xl pl-9 pr-3 py-2 border border-[#cbd5e1] focus:outline-hidden focus:border-[#004ac6] focus:ring-1 focus:ring-[#004ac6]"
                  />
                </div>

                {query && (
                  <button
                    onClick={() => setQuery("")}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#cbd5e1] text-xs font-semibold text-[#434655] hover:bg-[#f8f9ff] cursor-pointer transition-all"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#737686]" />
                    <span>Limpiar</span>
                  </button>
                )}
              </div>

              {/* Clients Table Card */}
              <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-lumina-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[850px]">
                    <caption className="sr-only">Bóveda de credenciales agrupadas por cliente</caption>
                    <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-[11px] uppercase tracking-wider border-b border-[#e2e8f0]">
                      <tr>
                        <th className="py-3.5 px-5">Abonado / Razón Social</th>
                        <th className="py-3.5 px-5 text-center">Credenciales Almacenadas</th>
                        <th className="py-3.5 px-5">Servicios & Destinos</th>
                        <th className="py-3.5 px-5 text-center">Protección Criptográfica</th>
                        <th className="py-3.5 px-5 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f1f5f9] text-[#0b1c30]">
                      {filteredClients.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-xs text-[#737686]">
                            <KeyRound className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            <p className="font-bold text-slate-600">No se encontraron abonados con los criterios ingresados.</p>
                          </td>
                        </tr>
                      ) : (
                        filteredClients.map((client) => {
                          const items = getClientVaultItems(client.id);
                          const hasItems = items.length > 0;

                          return (
                            <tr key={client.id} className="hover:bg-[#f8f9ff] transition-colors">
                              <td className="py-4 px-5">
                                <div className="font-bold text-[#0b1c30] text-sm">{client.businessName}</div>
                                <div className="text-[10px] text-[#737686] font-mono mt-0.5">
                                  {client.identificationType}: {client.identificationNumber}
                                </div>
                              </td>
                              <td className="py-4 px-5 text-center">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold font-mono ${
                                    hasItems
                                      ? "bg-blue-50 text-[#004ac6] border border-blue-200"
                                      : "bg-slate-100 text-slate-400 border border-slate-200"
                                  }`}
                                >
                                  <Lock className="w-3 h-3" />
                                  <span>{items.length} {items.length === 1 ? "clave" : "claves"}</span>
                                </span>
                              </td>
                              <td className="py-4 px-5">
                                {hasItems ? (
                                  <div className="flex flex-wrap gap-1.5 max-w-md">
                                    {items.map((item) => (
                                      <span
                                        key={item.id}
                                        className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200"
                                      >
                                        {item.serviceName}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 italic text-[11px]">Sin accesos registrados aún</span>
                                )}
                              </td>
                              <td className="py-4 px-5 text-center">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                  AES-256 GCM
                                </span>
                              </td>
                              <td className="py-4 px-5 text-right">
                                <button
                                  onClick={() => setSelectedClientId(client.id)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
                                >
                                  <KeyRound className="w-3.5 h-3.5" />
                                  <span>Administrar Bóveda</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="p-3 px-5 border-t border-[#e2e8f0] bg-[#f8f9ff] flex items-center justify-between text-xs text-[#737686]">
                  <span>
                    Abonados con claves gestionadas: <strong className="text-[#0b1c30]">{clients.length}</strong>
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 2: SISTEMA */}
      {activeTab === "sistema" && (
        <div className="space-y-4">
          <SecureVault key="system-vault" />
        </div>
      )}
    </div>
  );
}
