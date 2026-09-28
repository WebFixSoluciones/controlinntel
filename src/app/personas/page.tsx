"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { QuickSearchModal } from "@/components/layout/QuickSearchModal";
import { SuppliersManager } from "@/components/modules/clients/SuppliersManager";
import { UsersManager } from "@/components/modules/clients/UsersManager";
import { useApp } from "@/lib/state";
import { canAccessModule, canAccessSubmodule } from "@/lib/permissions";
import { ShieldAlert } from "lucide-react";

export type PersonasSubmoduleTab = "proveedores" | "usuarios_equipo";

function PersonasContent() {
  const { currentUser, suppliers, systemUsers } = useApp();
  const searchParams = useSearchParams();

  const canAccessPersonas = canAccessModule(currentUser, "personas");
  const canProveedores = canAccessSubmodule(currentUser, "personas", "proveedores");
  const canUsuarios = canAccessSubmodule(currentUser, "personas", "usuarios_equipo");

  // Determine active view based on query param or first permitted submodule
  const subParam = searchParams.get("sub") as PersonasSubmoduleTab | null;
  let activeTab: PersonasSubmoduleTab = "proveedores";

  if (subParam === "usuarios_equipo" && canUsuarios) {
    activeTab = "usuarios_equipo";
  } else if (subParam === "proveedores" && canProveedores) {
    activeTab = "proveedores";
  } else if (!canProveedores && canUsuarios) {
    activeTab = "usuarios_equipo";
  }

  if (!canAccessPersonas) {
    return (
      <div className="p-8 bg-white border border-[#e2e8f0] rounded-2xl text-center max-w-lg mx-auto my-12 space-y-3">
        <div className="w-12 h-12 bg-[#fee2e2] text-[#dc2626] rounded-full flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-[#0b1c30]">Acceso Restringido</h2>
        <p className="text-xs text-[#737686]">
          Tu rol actual no tiene autorización para acceder al Módulo de Personas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Clean Header: Title & Count Badge (No Tabs on Screen) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1c30] tracking-tight flex items-center gap-2.5">
            {activeTab === "proveedores" ? "Directorio de Proveedores" : "Usuarios del Sistema & Permisos"}
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#f1f5f9] text-[#475569] border border-[#e2e8f0]">
              {activeTab === "proveedores" ? suppliers.length : systemUsers.length}
            </span>
          </h1>
          <p className="text-xs text-[#737686] mt-0.5">
            {activeTab === "proveedores"
              ? "Registro de carriers, proveedores de fibra, hardware e infraestructura de telecomunicaciones"
              : "Administración del equipo de colaboradores, asignación de roles y control de acceso RBAC"}
          </p>
        </div>
      </div>

      {/* Submodule View Content */}
      <div className="w-full">
        {activeTab === "proveedores" && canProveedores && <SuppliersManager />}
        {activeTab === "usuarios_equipo" && canUsuarios && <UsersManager />}
      </div>
    </div>
  );
}

export default function PersonasPage() {
  return (
    <div className="flex min-h-screen bg-[#f8f9ff] text-[#0b1c30]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="p-6 md:p-8 space-y-6 flex-1 overflow-y-auto w-full min-w-0">
          <Suspense fallback={<div className="p-8 text-center text-xs text-[#737686]">Cargando módulo...</div>}>
            <PersonasContent />
          </Suspense>
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
