"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { QuickSearchModal } from "@/components/layout/QuickSearchModal";
import { GeminiAssistantWidget } from "@/components/modules/ai/GeminiAssistantWidget";
import { useApp } from "@/lib/state";
import { canAccessSubmodule } from "@/lib/permissions";
import {
  TrendingUp,
  Building2,
  Users,
  CreditCard,
  BarChart3,
  DollarSign,
} from "lucide-react";
import { MovementsTab } from "@/components/modules/finance/MovementsTab";
import { BankAccountsTab } from "@/components/modules/finance/BankAccountsTab";
import { AccountsReceivableTab } from "@/components/modules/finance/AccountsReceivableTab";
import { AccountsPayableTab } from "@/components/modules/finance/AccountsPayableTab";
import { FinancialReportsTab } from "@/components/modules/finance/FinancialReportsTab";

export type FinanceSubmoduleTab =
  | "movimientos"
  | "bancos"
  | "cuentas_por_cobrar"
  | "cuentas_por_pagar"
  | "reportes";

export default function FinanzasPage() {
  const { currentUser, purchaseInvoices, monthlyCharges } = useApp();
  const [activeTab, setActiveTab] = useState<FinanceSubmoduleTab>("movimientos");

  // Granular Submodule Permissions
  const canMovimientos = canAccessSubmodule(currentUser, "finanzas", "movimientos");
  const canBancos = canAccessSubmodule(currentUser, "finanzas", "bancos");
  const canCxC = canAccessSubmodule(currentUser, "finanzas", "cuentas_por_cobrar");
  const canCxP = canAccessSubmodule(currentUser, "finanzas", "cuentas_por_pagar");
  const canReportes = canAccessSubmodule(currentUser, "finanzas", "reportes");

  const pendingCxPCount = purchaseInvoices.filter(
    (inv) => inv.paymentStatus === "pendiente" || inv.paymentStatus === "abono_parcial"
  ).length;

  const pendingCxCCount = monthlyCharges.filter(
    (c) => c.status === "pendiente"
  ).length;

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
                <DollarSign className="w-7 h-7 text-[#004ac6]" />
                Módulo Financiero & Tesorería
              </h1>
              <p className="text-xs text-[#737686] mt-0.5">
                Gestión de liquidez, cuentas bancarias, recaudación y compromisos comerciales
              </p>
            </div>

            {/* 5 Submodules Tab Selector */}
            <div className="flex items-center gap-1.5 p-1.5 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs overflow-x-auto select-none">
              {canMovimientos && (
                <button
                  onClick={() => setActiveTab("movimientos")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    activeTab === "movimientos"
                      ? "bg-[#004ac6] text-white shadow-xs"
                      : "text-[#434655] hover:text-[#004ac6] hover:bg-[#f8f9ff]"
                  }`}
                >
                  <TrendingUp className="w-4 h-4" />
                  <span>Movimientos</span>
                </button>
              )}

              {canBancos && (
                <button
                  onClick={() => setActiveTab("bancos")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    activeTab === "bancos"
                      ? "bg-[#004ac6] text-white shadow-xs"
                      : "text-[#434655] hover:text-[#004ac6] hover:bg-[#f8f9ff]"
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  <span>Bancos</span>
                </button>
              )}

              {canCxC && (
                <button
                  onClick={() => setActiveTab("cuentas_por_cobrar")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    activeTab === "cuentas_por_cobrar"
                      ? "bg-[#004ac6] text-white shadow-xs"
                      : "text-[#434655] hover:text-[#004ac6] hover:bg-[#f8f9ff]"
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Cuentas por Cobrar</span>
                  {pendingCxCCount > 0 && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        activeTab === "cuentas_por_cobrar"
                          ? "bg-white/20 text-white"
                          : "bg-[#fffbeb] text-[#b45309] border border-[#fde68a]"
                      }`}
                    >
                      {pendingCxCCount}
                    </span>
                  )}
                </button>
              )}

              {canCxP && (
                <button
                  onClick={() => setActiveTab("cuentas_por_pagar")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    activeTab === "cuentas_por_pagar"
                      ? "bg-[#004ac6] text-white shadow-xs"
                      : "text-[#434655] hover:text-[#004ac6] hover:bg-[#f8f9ff]"
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Cuentas por Pagar</span>
                  {pendingCxPCount > 0 && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        activeTab === "cuentas_por_pagar"
                          ? "bg-white/20 text-white"
                          : "bg-[#fffbeb] text-[#b45309] border border-[#fde68a]"
                      }`}
                    >
                      {pendingCxPCount}
                    </span>
                  )}
                </button>
              )}

              {canReportes && (
                <button
                  onClick={() => setActiveTab("reportes")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    activeTab === "reportes"
                      ? "bg-[#004ac6] text-white shadow-xs"
                      : "text-[#434655] hover:text-[#004ac6] hover:bg-[#f8f9ff]"
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Reportes</span>
                </button>
              )}
            </div>
          </div>

          {/* Submodule View Content */}
          <div className="w-full">
            {activeTab === "movimientos" && <MovementsTab />}
            {activeTab === "bancos" && <BankAccountsTab />}
            {activeTab === "cuentas_por_cobrar" && <AccountsReceivableTab />}
            {activeTab === "cuentas_por_pagar" && <AccountsPayableTab />}
            {activeTab === "reportes" && <FinancialReportsTab />}
          </div>
        </main>

        {/* Institutional Footer */}
        <footer className="px-8 py-4 bg-white border-t border-[#e2e8f0] flex flex-wrap items-center justify-between gap-3 text-xs text-[#737686] select-none">
          <a
            href="https://www.inntelcorp.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#004ac6] font-medium transition-colors"
          >
            &copy; 2026 INNTEL CORP S.A. • Finanzas & Tesorería • www.inntelcorp.com
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
