"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { QuickSearchModal } from "@/components/layout/QuickSearchModal";
import { GeminiAssistantWidget } from "@/components/modules/ai/GeminiAssistantWidget";
import { ClientsTable } from "@/components/modules/clients/ClientsTable";
import { ClientProfile360 } from "@/components/modules/clients/ClientProfile360";
import { ClientModal } from "@/components/modules/clients/ClientModal";
import { SuppliersManager } from "@/components/modules/clients/SuppliersManager";
import { UsersManager } from "@/components/modules/clients/UsersManager";
import { useApp } from "@/lib/state";
import { canAccessSubmodule } from "@/lib/permissions";
import { Users, Building2, UserCheck } from "lucide-react";
import { Client } from "@/types";

export type PersonasSubmoduleTab = "clientes" | "proveedores" | "usuarios_equipo";

export default function ClientsPage() {
  const { currentUser, clients, suppliers, systemUsers } = useApp();
  const [activeTab, setActiveTab] = useState<PersonasSubmoduleTab>("clientes");

  // Client sub-navigation state
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);

  const canClientes = canAccessSubmodule(currentUser, "personas", "clientes");
  const canProveedores = canAccessSubmodule(currentUser, "personas", "proveedores");
  const canUsuarios = canAccessSubmodule(currentUser, "personas", "usuarios_equipo");

  const handleEdit = (client: Client) => {
    setClientToEdit(client);
    setIsNewModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsNewModalOpen(false);
    setClientToEdit(null);
  };

  return (
    <div className="flex min-h-screen bg-[#f8f9ff] text-[#0b1c30]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="p-6 md:p-8 space-y-6 flex-1 overflow-y-auto w-full min-w-0">
          {/* Header & Submodule Tabs Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[#0b1c30] tracking-tight flex items-center gap-2.5">
                <Users className="w-7 h-7 text-[#004ac6]" />
                Módulo de Personas & Terceros
              </h1>
              <p className="text-xs text-[#737686] mt-0.5">
                Directorio unificado de Clientes / Abonados, Proveedores y Equipo de Usuarios
              </p>
            </div>

            {/* 3 Submodules Tab Selector */}
            <div className="flex items-center gap-1.5 p-1.5 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs overflow-x-auto select-none">
              {canClientes && (
                <button
                  onClick={() => {
                    setActiveTab("clientes");
                    setSelectedClient(null);
                  }}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    activeTab === "clientes"
                      ? "bg-[#004ac6] text-white shadow-xs"
                      : "text-[#434655] hover:text-[#004ac6] hover:bg-[#f8f9ff]"
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Clientes (Abonados)</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      activeTab === "clientes"
                        ? "bg-white/20 text-white"
                        : "bg-[#eff4ff] text-[#004ac6]"
                    }`}
                  >
                    {clients.length}
                  </span>
                </button>
              )}

              {canProveedores && (
                <button
                  onClick={() => setActiveTab("proveedores")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    activeTab === "proveedores"
                      ? "bg-[#004ac6] text-white shadow-xs"
                      : "text-[#434655] hover:text-[#004ac6] hover:bg-[#f8f9ff]"
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  <span>Proveedores</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      activeTab === "proveedores"
                        ? "bg-white/20 text-white"
                        : "bg-[#eff4ff] text-[#004ac6]"
                    }`}
                  >
                    {suppliers.length}
                  </span>
                </button>
              )}

              {canUsuarios && (
                <button
                  onClick={() => setActiveTab("usuarios_equipo")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    activeTab === "usuarios_equipo"
                      ? "bg-[#004ac6] text-white shadow-xs"
                      : "text-[#434655] hover:text-[#004ac6] hover:bg-[#f8f9ff]"
                  }`}
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Usuarios / Equipo</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      activeTab === "usuarios_equipo"
                        ? "bg-white/20 text-white"
                        : "bg-[#eff4ff] text-[#004ac6]"
                    }`}
                  >
                    {systemUsers.length}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Submodule View Content */}
          <div className="w-full">
            {activeTab === "clientes" && (
              selectedClient ? (
                <ClientProfile360
                  client={selectedClient}
                  onClose={() => setSelectedClient(null)}
                  onEdit={() => handleEdit(selectedClient)}
                />
              ) : (
                <ClientsTable
                  onSelectClient={(c) => setSelectedClient(c)}
                  onOpenNewModal={() => {
                    setClientToEdit(null);
                    setIsNewModalOpen(true);
                  }}
                  onEditClient={handleEdit}
                />
              )
            )}

            {activeTab === "proveedores" && <SuppliersManager />}

            {activeTab === "usuarios_equipo" && <UsersManager />}
          </div>

          <ClientModal
            isOpen={isNewModalOpen}
            onClose={handleCloseModal}
            clientToEdit={clientToEdit}
          />
        </main>

        {/* Institutional Footer */}
        <footer className="px-8 py-4 bg-white border-t border-[#e2e8f0] flex flex-wrap items-center justify-between gap-3 text-xs text-[#737686] select-none">
          <a
            href="https://www.inntelcorp.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#004ac6] font-medium transition-colors"
          >
            &copy; 2026 INNTEL CORP S.A. • Directorio de Personas • www.inntelcorp.com
          </a>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-[#004ac6] transition-colors">
              Soporte
            </a>
            <a href="#" className="hover:text-[#004ac6] transition-colors">
              Privacidad
            </a>
            <a href="#" className="hover:text-[#004ac6] transition-colors">
              Términos
            </a>
          </div>
        </footer>
      </div>

      <QuickSearchModal />
      <GeminiAssistantWidget />
    </div>
  );
}
