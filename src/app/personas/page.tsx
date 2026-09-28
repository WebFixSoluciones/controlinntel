"use client";

import React, { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { QuickSearchModal } from "@/components/layout/QuickSearchModal";
import { SuppliersManager } from "@/components/modules/clients/SuppliersManager";
import { UsersManager } from "@/components/modules/clients/UsersManager";
import { useApp } from "@/lib/state";
import { canAccessModule, canAccessSubmodule } from "@/lib/permissions";
import { Contact2, Building2, UserCheck, ShieldAlert } from "lucide-react";

export type PersonasSubmoduleTab = "proveedores" | "usuarios_equipo";

export default function PersonasPage() {
  const { currentUser, suppliers, systemUsers } = useApp();

  const canAccessPersonas = canAccessModule(currentUser, "personas");
  const canProveedores = canAccessSubmodule(currentUser, "personas", "proveedores");
  const canUsuarios = canAccessSubmodule(currentUser, "personas", "usuarios_equipo");

  const [activeTab, setActiveTab] = useState<PersonasSubmoduleTab>("proveedores");

  // If user doesn't have access to proveedores but has access to usuarios_equipo, default to it
  useEffect(() => {
    if (!canProveedores && canUsuarios) {
      setActiveTab("usuarios_equipo");
    } else if (canProveedores) {
      setActiveTab("proveedores");
    }
  }, [canProveedores, canUsuarios]);

  return (
    <div className="flex min-h-screen bg-[#f8f9ff] text-[#0b1c30]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="p-6 md:p-8 space-y-6 flex-1 overflow-y-auto w-full min-w-0">
          {!canAccessPersonas ? (
            <div className="p-8 bg-white border border-[#e2e8f0] rounded-2xl text-center max-w-lg mx-auto my-12 space-y-3">
              <div className="w-12 h-12 bg-[#fee2e2] text-[#dc2626] rounded-full flex items-center justify-center mx-auto">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h2 className="text-base font-bold text-[#0b1c30]">Acceso Restringido</h2>
              <p className="text-xs text-[#737686]">
                Tu rol actual no tiene autorización para acceder al Módulo de Personas.
              </p>
            </div>
          ) : (
            <>
              {/* Header & Submodule Tabs Bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-[#0b1c30] tracking-tight flex items-center gap-2.5">
                    <Contact2 className="w-7 h-7 text-[#004ac6]" />
                    Módulo de Personas
                  </h1>
                  <p className="text-xs text-[#737686] mt-0.5">
                    Directorio institucional de Proveedores y Administración del Equipo de Usuarios
                  </p>
                </div>

                {/* 2 Submodules Tab Selector */}
                <div className="flex items-center gap-1.5 p-1.5 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs overflow-x-auto select-none">
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

              {/* Submodule Content */}
              <div className="w-full">
                {activeTab === "proveedores" && canProveedores && <SuppliersManager />}
                {activeTab === "usuarios_equipo" && canUsuarios && <UsersManager />}
              </div>
            </>
          )}
        </main>

        {/* Institutional Footer */}
        <footer className="px-8 py-4 bg-white border-t border-[#e2e8f0] flex flex-wrap items-center justify-between gap-3 text-xs text-[#737686] select-none">
          <a
            href="https://www.inntelcorp.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#004ac6] font-medium transition-colors"
          >
            &copy; 2026 INNTEL CORP S.A. • Módulo de Personas • www.inntelcorp.com
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
    </div>
  );
}
