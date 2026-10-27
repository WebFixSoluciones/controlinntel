"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { QuickSearchModal } from "@/components/layout/QuickSearchModal";
import { GeneralSettingsView } from "@/components/modules/settings/GeneralSettingsView";
import { RecoveryPanel } from "@/components/modules/settings/RecoveryPanel";
import { SriConfigView } from "@/components/modules/settings/SriConfigView";
import { useApp } from "@/lib/state";
import { canAccessModule, canAccessSubmodule } from "@/lib/permissions";
import { ShieldAlert } from "lucide-react";

export type ConfigSubmoduleTab = "general" | "sri";

function ConfiguracionContent() {
  const { currentUser } = useApp();
  const searchParams = useSearchParams();

  const canAccessConfig = canAccessModule(currentUser, "configuracion");
  const canGeneral = canAccessSubmodule(currentUser, "configuracion", "general");
  const canSri = canAccessSubmodule(currentUser, "configuracion", "sri");

  const subParam = searchParams.get("sub") as ConfigSubmoduleTab | null;

  let activeTab: ConfigSubmoduleTab = "general";
  if (subParam === "sri" && canSri) {
    activeTab = "sri";
  } else if (subParam === "general" && canGeneral) {
    activeTab = "general";
  } else if (!canGeneral && canSri) {
    activeTab = "sri";
  }

  if (!canAccessConfig) {
    return (
      <div className="p-8 bg-white border border-[#e2e8f0] rounded-xl text-center max-w-lg mx-auto my-12 space-y-3">
        <div className="w-12 h-12 bg-[#fee2e2] text-[#dc2626] rounded-full flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-[#0b1c30]">Acceso Restringido</h2>
        <p className="text-xs text-[#737686]">
          Tu rol actual no tiene autorización para acceder al Módulo de Configuración.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {activeTab === "general" && canGeneral && <GeneralSettingsView />}
      {activeTab === "general" && canGeneral && <RecoveryPanel />}
      {activeTab === "sri" && canSri && <SriConfigView />}
    </div>
  );
}

export default function ConfiguracionPage() {
  return (
    <div className="flex min-h-screen bg-[#f8f9ff] text-[#0b1c30]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="p-6 md:p-8 space-y-6 flex-1 overflow-y-auto w-full min-w-0">
          <Suspense fallback={<div className="p-8 text-center text-xs text-[#737686]">Cargando configuración...</div>}>
            <ConfiguracionContent />
          </Suspense>
        </main>
        <QuickSearchModal />
      </div>
    </div>
  );
}
