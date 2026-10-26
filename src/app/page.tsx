"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useApp } from "@/lib/state";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { QuickSearchModal } from "@/components/layout/QuickSearchModal";
import dynamic from "next/dynamic";
import { MetricsCards } from "@/components/modules/dashboard/MetricsCards";
import { RecentSalesCard } from "@/components/modules/dashboard/RecentSalesCard";
import { ExpirationsTimeline } from "@/components/modules/dashboard/ExpirationsTimeline";
import { TicketsRecientesCard } from "@/components/modules/dashboard/RecentActivity";
import { ClientModal } from "@/components/modules/clients/ClientModal";
import { Receipt, UserPlus, PackagePlus, ArrowDownLeft, ArrowUpRight } from "lucide-react";

const FinancialChart = dynamic(
  () => import("@/components/modules/dashboard/FinancialChart").then((m) => m.FinancialChart),
  {
    ssr: false,
    loading: () => (
      <div className="p-6 rounded-xl bg-white border border-[#e2e8f0] h-[340px] flex items-center justify-center animate-pulse">
        <div className="h-6 w-48 bg-slate-100 rounded-md" />
      </div>
    ),
  }
);

export default function DashboardPage() {
  const { currentUser } = useApp();
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  const cleanUserName = (currentUser?.displayName || "Administrador")
    .replace(/\s*General\s*INNTEL\s*CORP/gi, "")
    .replace(/\s*INNTEL\s*CORP/gi, "")
    .trim() || "Administrador";

  return (
    <div className="flex min-h-screen bg-[#f8f9ff] text-[#0b1c30]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="p-6 md:p-8 space-y-6 flex-1 overflow-y-auto w-full min-w-0">
          {/* Header con Bienvenida y Accesos Directos Minimalistas */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b border-[#e2e8f0]/60">
            <div>
              <h1 className="text-lg md:text-xl font-bold text-[#0b1c30] tracking-tight">
                Bienvenido, {cleanUserName}
              </h1>
            </div>

            {/* Accesos directos super minimalistas */}
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/ventas?sub=nueva_venta"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#eff4ff] text-[#334155] hover:text-[#004ac6] rounded-lg border border-[#e2e8f0] hover:border-[#bfdbfe] text-xs font-semibold transition-all shadow-2xs cursor-pointer group"
                title="Nueva Nota de Venta"
              >
                <Receipt className="w-3.5 h-3.5 text-[#004ac6] group-hover:scale-110 transition-transform" />
                <span>Venta</span>
              </Link>

              <button
                type="button"
                onClick={() => setIsNewClientModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#eff4ff] text-[#334155] hover:text-[#004ac6] rounded-lg border border-[#e2e8f0] hover:border-[#bfdbfe] text-xs font-semibold transition-all shadow-2xs cursor-pointer group"
                title="Registrar nuevo cliente"
              >
                <UserPlus className="w-3.5 h-3.5 text-[#004ac6] group-hover:scale-110 transition-transform" />
                <span>Cliente</span>
              </button>

              <Link
                href="/inventarios?sub=productos&action=nuevo"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#eff4ff] text-[#334155] hover:text-[#004ac6] rounded-lg border border-[#e2e8f0] hover:border-[#bfdbfe] text-xs font-semibold transition-all shadow-2xs cursor-pointer group"
                title="Nuevo producto"
              >
                <PackagePlus className="w-3.5 h-3.5 text-[#004ac6] group-hover:scale-110 transition-transform" />
                <span>Producto</span>
              </Link>

              <Link
                href="/finanzas?sub=cuentas_por_cobrar"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#eff4ff] text-[#334155] hover:text-[#004ac6] rounded-lg border border-[#e2e8f0] hover:border-[#bfdbfe] text-xs font-semibold transition-all shadow-2xs cursor-pointer group"
                title="Cuentas por Cobrar"
              >
                <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition-transform" />
                <span>Por Cobrar</span>
              </Link>

              <Link
                href="/finanzas?sub=cuentas_por_pagar"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#eff4ff] text-[#334155] hover:text-[#004ac6] rounded-lg border border-[#e2e8f0] hover:border-[#bfdbfe] text-xs font-semibold transition-all shadow-2xs cursor-pointer group"
                title="Cuentas por Pagar"
              >
                <ArrowUpRight className="w-3.5 h-3.5 text-amber-600 group-hover:scale-110 transition-transform" />
                <span>Por Pagar</span>
              </Link>
            </div>
          </div>

          {/* Metrics Row (4 Cards) */}
          <MetricsCards />

          {/* Middle Section (Grid 12 Cols: FinancialChart & RecentSales 8 Cols, Alertas & Tickets 4 Cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-8 space-y-5">
              <FinancialChart />
              <RecentSalesCard />
            </div>
            <div className="lg:col-span-4 space-y-5">
              <ExpirationsTimeline />
              <TicketsRecientesCard />
            </div>
          </div>
        </main>

        {/* Institutional Footer */}
        <footer className="px-8 py-4 bg-white border-t border-[#e2e8f0] flex flex-wrap items-center justify-between gap-3 text-xs text-[#737686]">
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
