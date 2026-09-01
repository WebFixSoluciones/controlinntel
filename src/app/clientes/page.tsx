"use client";

import React, { useState } from "react";
import { AppProvider } from "@/lib/state";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { QuickSearchModal } from "@/components/layout/QuickSearchModal";
import { GeminiAssistantWidget } from "@/components/modules/ai/GeminiAssistantWidget";
import { ClientsTable } from "@/components/modules/clients/ClientsTable";
import { ClientModal } from "@/components/modules/clients/ClientModal";
import { ClientProfile360 } from "@/components/modules/clients/ClientProfile360";
import { Client } from "@/types";

export default function ClientesPage() {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  return (
    <AppProvider>
      <div className="flex min-h-screen bg-slate-50 text-slate-900">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Header />
          <main className="p-6 space-y-6 flex-1 overflow-y-auto max-w-7xl w-full mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                  Gestión de Abonados & Ficha Consolidada 360°
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Registro de personas naturales y jurídicas con validación de RUC, tarifas personalizadas e indicador SRI
                </p>
              </div>
            </div>

            <ClientsTable
              onSelectClient={(client) => setSelectedClient(client)}
              onOpenNewModal={() => setIsNewModalOpen(true)}
            />
          </main>

          <ClientModal
            isOpen={isNewModalOpen}
            onClose={() => setIsNewModalOpen(false)}
          />

          <ClientProfile360
            client={selectedClient}
            onClose={() => setSelectedClient(null)}
          />

          <QuickSearchModal />
          <GeminiAssistantWidget />
        </div>
      </div>
    </AppProvider>
  );
}
