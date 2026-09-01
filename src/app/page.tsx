"use client";

import React from "react";
import { AppProvider } from "@/lib/state";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { QuickSearchModal } from "@/components/layout/QuickSearchModal";
import { GeminiAssistantWidget } from "@/components/modules/ai/GeminiAssistantWidget";
import { MetricsCards } from "@/components/modules/dashboard/MetricsCards";
import { FinancialChart } from "@/components/modules/dashboard/FinancialChart";
import { ExpirationsTimeline } from "@/components/modules/dashboard/ExpirationsTimeline";
import { RecentActivity } from "@/components/modules/dashboard/RecentActivity";

export default function DashboardPage() {
  return (
    <AppProvider>
      <div className="flex min-h-screen bg-slate-50 text-slate-900">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Header />
          <main className="p-6 space-y-6 flex-1 overflow-y-auto max-w-7xl w-full mx-auto">
            {/* Greeting */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                  Panel de Control Operativo & Regulatorio
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Supervisión en tiempo real de clientes, pólizas ARCOTEL, nodos MikroTik y cobranzas
                </p>
              </div>
            </div>

            {/* Metrics */}
            <MetricsCards />

            {/* Charts & Timeline */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <FinancialChart />
              <ExpirationsTimeline />
            </div>

            {/* Activity & Tickets */}
            <RecentActivity />
          </main>
          <QuickSearchModal />
          <GeminiAssistantWidget />
        </div>
      </div>
    </AppProvider>
  );
}
