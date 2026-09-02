"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AppProvider } from "@/lib/state";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { QuickSearchModal } from "@/components/layout/QuickSearchModal";
import { GeminiAssistantWidget } from "@/components/modules/ai/GeminiAssistantWidget";
import { MetricsCards } from "@/components/modules/dashboard/MetricsCards";
import { FinancialChart } from "@/components/modules/dashboard/FinancialChart";
import { ExpirationsTimeline } from "@/components/modules/dashboard/ExpirationsTimeline";
import { TicketsRecientesCard, AuditActivityTable } from "@/components/modules/dashboard/RecentActivity";
import { ClientModal } from "@/components/modules/clients/ClientModal";
import { UploadCloud, Receipt, Plus } from "lucide-react";

export default function DashboardPage() {
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);

  return (
    <AppProvider>
      <div className="flex min-h-screen bg-[#f8f9ff] text-[#0b1c30]">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Header />
          <main className="p-8 space-y-8 flex-1 overflow-y-auto max-w-7xl w-full mx-auto">
            {/* Header matching Screenshot 2 */}
            <div className="flex flex-wrap items-center justify-between gap-4 select-none">
              <div>
                <h1 className="text-2xl font-bold text-[#0b1c30] tracking-tight">
                  Dashboard Operativo
                </h1>
                <p className="text-xs text-[#737686] mt-0.5">
                  Resumen general y métricas clave de la operación.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <Link
                  href="/plantillas"
                  className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-[#f8f9ff] text-[#0b1c30] rounded-lg border border-[#cbd5e1] text-xs font-bold transition-all shadow-2xs cursor-pointer"
                >
                  <UploadCloud className="w-4 h-4 text-[#737686]" />
                  <span>Cargar Documento</span>
                </Link>

                <Link
                  href="/finanzas"
                  className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-[#f8f9ff] text-[#0b1c30] rounded-lg border border-[#cbd5e1] text-xs font-bold transition-all shadow-2xs cursor-pointer"
                >
                  <Receipt className="w-4 h-4 text-[#737686]" />
                  <span>Registrar Gasto</span>
                </Link>

                <button
                  onClick={() => setIsNewClientModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nuevo Cliente</span>
                </button>
              </div>
            </div>

            {/* Metrics Row (4 Cards) */}
            <MetricsCards />

            {/* Middle Section (Grid 12 Cols: FinancialChart 8 Cols, Alertas & Tickets 4 Cols) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8">
                <FinancialChart />
              </div>
              <div className="lg:col-span-4 space-y-6">
                <ExpirationsTimeline />
                <TicketsRecientesCard />
              </div>
            </div>

            {/* Bottom Section: Actividad Reciente (Auditoría) */}
            <AuditActivityTable />
          </main>

          {/* Institutional Footer */}
          <footer className="px-8 py-4 bg-white border-t border-[#e2e8f0] flex flex-wrap items-center justify-between gap-3 text-xs text-[#737686] select-none">
            <span>&copy; 2024 INNTEL CORP. Powered by WebFix</span>
            <div className="flex items-center gap-4">
              <a href="#" className="hover:text-[#004ac6] transition-colors">Soporte</a>
              <a href="#" className="hover:text-[#004ac6] transition-colors">Privacidad</a>
              <a href="#" className="hover:text-[#004ac6] transition-colors">Términos</a>
            </div>
          </footer>

          <ClientModal
            isOpen={isNewClientModalOpen}
            onClose={() => setIsNewClientModalOpen(false)}
          />

          <QuickSearchModal />
          <GeminiAssistantWidget />
        </div>
      </div>
    </AppProvider>
  );
}
