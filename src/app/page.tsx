"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useApp } from "@/lib/state";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { QuickSearchModal } from "@/components/layout/QuickSearchModal";
import { MetricsCards } from "@/components/modules/dashboard/MetricsCards";
import { FinancialChart } from "@/components/modules/dashboard/FinancialChart";
import { ExpirationsTimeline } from "@/components/modules/dashboard/ExpirationsTimeline";
import { TicketsRecientesCard } from "@/components/modules/dashboard/RecentActivity";
import { ClientModal } from "@/components/modules/clients/ClientModal";
import { Receipt, UserPlus, PackagePlus, ArrowDownLeft, ArrowUpRight } from "lucide-react";

export default function DashboardPage() {
  const { currentUser } = useApp();
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#f8f9ff] text-[#0b1c30]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="p-6 md:p-8 space-y-6 flex-1 overflow-y-auto w-full min-w-0">
          {/* Header con Bienvenida y Accesos Directos Minimalistas */}
          <div className="flex flex-wrap items-center justify-between gap-4 select-none pb-1 border-b border-[#e2e8f0]/60">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-[#0b1c30] tracking-tight">
                Bienvenido, {currentUser.displayName}
              </h1>
              <p className="text-xs text-[#737686] mt-0.5">
                Panel central de control y gestión operativa
              </p>
            </div>

            {/* Accesos directos super minimalistas */}
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/facturacion?sub=ventas&action=nueva_venta"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#eff4ff] text-[#334155] hover:text-[#004ac6] rounded-lg border border-[#e2e8f0] hover:border-[#bfdbfe] text-xs font-semibold transition-all shadow-2xs cursor-pointer group"
                title="Generar nueva venta en Facturación"
              >
                <Receipt className="w-3.5 h-3.5 text-[#004ac6] group-hover:scale-110 transition-transform" />
                <span>Generar Venta</span>
              </Link>

              <button
                type="button"
                onClick={() => setIsNewClientModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#eff4ff] text-[#334155] hover:text-[#004ac6] rounded-lg border border-[#e2e8f0] hover:border-[#bfdbfe] text-xs font-semibold transition-all shadow-2xs cursor-pointer group"
                title="Registrar nuevo cliente"
              >
                <UserPlus className="w-3.5 h-3.5 text-[#004ac6] group-hover:scale-110 transition-transform" />
                <span>Nuevo Cliente</span>
              </button>

              <Link
                href="/inventarios?sub=productos&action=nuevo"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#eff4ff] text-[#334155] hover:text-[#004ac6] rounded-lg border border-[#e2e8f0] hover:border-[#bfdbfe] text-xs font-semibold transition-all shadow-2xs cursor-pointer group"
                title="Crear nuevo producto en Inventarios"
              >
                <PackagePlus className="w-3.5 h-3.5 text-[#004ac6] group-hover:scale-110 transition-transform" />
                <span>Nuevo Producto</span>
              </Link>

              <Link
                href="/finanzas?sub=cxc"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#eff4ff] text-[#334155] hover:text-[#004ac6] rounded-lg border border-[#e2e8f0] hover:border-[#bfdbfe] text-xs font-semibold transition-all shadow-2xs cursor-pointer group"
                title="Cuentas por Cobrar (Finanzas)"
              >
                <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition-transform" />
                <span>Cuentas CXC</span>
              </Link>

              <Link
                href="/finanzas?sub=cxp"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#eff4ff] text-[#334155] hover:text-[#004ac6] rounded-lg border border-[#e2e8f0] hover:border-[#bfdbfe] text-xs font-semibold transition-all shadow-2xs cursor-pointer group"
                title="Cuentas por Pagar (Finanzas)"
              >
                <ArrowUpRight className="w-3.5 h-3.5 text-amber-600 group-hover:scale-110 transition-transform" />
                <span>Cuentas CXP</span>
              </Link>
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
        </main>

        {/* Institutional Footer */}
        <footer className="px-8 py-4 bg-white border-t border-[#e2e8f0] flex flex-wrap items-center justify-between gap-3 text-xs text-[#737686] select-none">
          <a href="https://www.inntelcorp.com/" target="_blank" rel="noopener noreferrer" className="hover:text-[#004ac6] font-medium transition-colors">&copy; 2026 INNTEL CORP S.A. • www.inntelcorp.com</a>
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
      </div>
    </div>
  );
}
