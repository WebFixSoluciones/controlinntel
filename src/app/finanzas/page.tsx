"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { QuickSearchModal } from "@/components/layout/QuickSearchModal";
import { useApp } from "@/lib/state";
import { canAccessModule, canAccessSubmodule } from "@/lib/permissions";
import { ShieldAlert } from "lucide-react";
import { MovementsTab } from "@/components/modules/finance/MovementsTab";
import { BankAccountsTab } from "@/components/modules/finance/BankAccountsTab";
import { AccountsReceivableTab } from "@/components/modules/finance/AccountsReceivableTab";
import { AccountsPayableTab } from "@/components/modules/finance/AccountsPayableTab";
import { FinancialReportsTab } from "@/components/modules/finance/FinancialReportsTab";

import { FinanceDashboard } from "@/components/modules/finance/FinanceDashboard";

export type FinanceSubmoduleTab =
  | "cobranzas_opex"
  | "general"
  | "movimientos"
  | "bancos"
  | "cuentas_por_cobrar"
  | "cuentas_por_pagar"
  | "reportes";

function FinanzasContent() {
  const { currentUser, purchaseInvoices, monthlyCharges } = useApp();
  const searchParams = useSearchParams();

  const canAccessFinanzas = canAccessModule(currentUser, "finanzas");
  const canMovimientos = canAccessSubmodule(currentUser, "finanzas", "movimientos");
  const canBancos = canAccessSubmodule(currentUser, "finanzas", "bancos");
  const canCxC = canAccessSubmodule(currentUser, "finanzas", "cuentas_por_cobrar");
  const canCxP = canAccessSubmodule(currentUser, "finanzas", "cuentas_por_pagar");
  const canReportes = canAccessSubmodule(currentUser, "finanzas", "reportes");

  const rawSubParam = searchParams.get("sub");
  const subParam = (rawSubParam as FinanceSubmoduleTab) || "cobranzas_opex";
  let activeTab: FinanceSubmoduleTab = subParam;

  if (activeTab === "movimientos" && !canMovimientos) {
    if (canBancos) activeTab = "bancos";
    else if (canCxC) activeTab = "cuentas_por_cobrar";
    else if (canCxP) activeTab = "cuentas_por_pagar";
    else if (canReportes) activeTab = "reportes";
  }

  const pendingCxPCount = purchaseInvoices.filter(
    (inv) => inv.paymentStatus === "pendiente" || inv.paymentStatus === "abono_parcial"
  ).length;

  const pendingCxCCount = monthlyCharges.filter(
    (c) => c.status === "pendiente"
  ).length;

  if (!canAccessFinanzas) {
    return (
      <div className="p-8 bg-white border border-[#e2e8f0] rounded-2xl text-center max-w-lg mx-auto my-12 space-y-3">
        <div className="w-12 h-12 bg-[#fee2e2] text-[#dc2626] rounded-full flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-[#0b1c30]">Acceso Restringido</h2>
        <p className="text-xs text-[#737686]">
          Tu rol actual no tiene autorización para acceder al Módulo de Finanzas.
        </p>
      </div>
    );
  }

  const getSubmoduleMeta = () => {
    switch (activeTab) {
      case "bancos":
        return {
          title: "Bancos & Cuentas de Tesorería",
          description: "Administración de cuentas bancarias institucionales, saldos y fondos fijos",
          badge: null,
        };
      case "cuentas_por_cobrar":
        return {
          title: "Cuentas por Cobrar (CxC)",
          description: "Seguimiento de facturas y cobros emitidos a clientes con valores pendientes",
          badge: pendingCxCCount,
        };
      case "cuentas_por_pagar":
        return {
          title: "Cuentas por Pagar (CxP)",
          description: "Obligaciones mercantiles y liquidación de facturas con proveedores",
          badge: pendingCxPCount,
        };
      case "reportes":
        return {
          title: "Reportes Financieros",
          description: "Balances, estados de cuenta analíticos y reportes de recaudación",
          badge: null,
        };
      default:
        return {
          title: "Movimientos de Tesorería",
          description: "Flujo de caja, ingresos, egresos y conciliación bancaria operativa",
          badge: null,
        };
    }
  };

  const currentMeta = getSubmoduleMeta();

  return (
    <div className="space-y-6">
      {/* Status Bar without redundant description */}
      {currentMeta.badge !== null && currentMeta.badge > 0 && activeTab !== "cobranzas_opex" && activeTab !== "general" && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#434655]">Comprobantes Pendientes:</span>
          <span className="px-2.5 py-0.5 rounded-[6px] text-xs font-bold bg-[#fffbeb] text-[#b45309] border border-[#fde68a]">
            {currentMeta.badge}
          </span>
        </div>
      )}

      {/* Submodule View Content */}
      <div className="w-full">
        {(activeTab === "cobranzas_opex" || activeTab === "general") && <FinanceDashboard />}
        {activeTab === "movimientos" && canMovimientos && <MovementsTab />}
        {activeTab === "bancos" && canBancos && <BankAccountsTab />}
        {activeTab === "cuentas_por_cobrar" && canCxC && <AccountsReceivableTab />}
        {activeTab === "cuentas_por_pagar" && canCxP && <AccountsPayableTab />}
        {activeTab === "reportes" && canReportes && <FinancialReportsTab />}
      </div>
    </div>
  );
}

export default function FinanzasPage() {
  return (
    <div className="flex min-h-screen bg-[#f8f9ff] text-[#0b1c30]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="p-6 md:p-8 space-y-6 flex-1 overflow-y-auto w-full min-w-0">
          <Suspense fallback={<div className="p-8 text-center text-xs text-[#737686]">Cargando finanzas...</div>}>
            <FinanzasContent />
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
            &copy; 2026 INNTEL CORP S.A. • Módulo Financiero & Tesorería • www.inntelcorp.com
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
