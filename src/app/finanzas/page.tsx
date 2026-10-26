"use client";

import React, { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { QuickSearchModal } from "@/components/layout/QuickSearchModal";
import { useApp } from "@/lib/state";
import { canAccessModule, canAccessSubmodule } from "@/lib/permissions";
import {
  ShieldAlert,
  TrendingUp,
  ArrowRightLeft,
  Building2,
  Receipt,
  CreditCard,
  BarChart3,
} from "lucide-react";
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

const FINANCE_TABS: {
  id: FinanceSubmoduleTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  submoduleKey: string;
  href: string;
}[] = [
  {
    id: "cobranzas_opex",
    label: "Cobranzas y Gastos",
    icon: TrendingUp,
    submoduleKey: "movimientos",
    href: "/finanzas?sub=cobranzas_opex",
  },
  {
    id: "movimientos",
    label: "Movimientos",
    icon: ArrowRightLeft,
    submoduleKey: "movimientos",
    href: "/finanzas?sub=movimientos",
  },
  {
    id: "bancos",
    label: "Bancos",
    icon: Building2,
    submoduleKey: "bancos",
    href: "/finanzas?sub=bancos",
  },
  {
    id: "cuentas_por_cobrar",
    label: "Por Cobrar",
    icon: Receipt,
    submoduleKey: "cuentas_por_cobrar",
    href: "/finanzas?sub=cuentas_por_cobrar",
  },
  {
    id: "cuentas_por_pagar",
    label: "Por Pagar",
    icon: CreditCard,
    submoduleKey: "cuentas_por_pagar",
    href: "/finanzas?sub=cuentas_por_pagar",
  },
  {
    id: "reportes",
    label: "Reportes",
    icon: BarChart3,
    submoduleKey: "reportes",
    href: "/finanzas?sub=reportes",
  },
];

function FinanzasContent() {
  const { currentUser, purchaseInvoices, monthlyCharges } = useApp();
  const searchParams = useSearchParams();
  const router = useRouter();

  const canAccessFinanzas = canAccessModule(currentUser, "finanzas");
  const canMovimientos = canAccessSubmodule(currentUser, "finanzas", "movimientos");
  const canBancos = canAccessSubmodule(currentUser, "finanzas", "bancos");
  const canCxC = canAccessSubmodule(currentUser, "finanzas", "cuentas_por_cobrar");
  const canCxP = canAccessSubmodule(currentUser, "finanzas", "cuentas_por_pagar");
  const canReportes = canAccessSubmodule(currentUser, "finanzas", "reportes");

  const rawSubParam = searchParams.get("sub");
  const subParam = (rawSubParam as FinanceSubmoduleTab) || "cobranzas_opex";
  const [activeTab, setActiveTab] = useState<FinanceSubmoduleTab>(subParam);

  useEffect(() => {
    if (subParam) {
      setActiveTab(subParam);
    }
  }, [subParam]);

  useEffect(() => {
    const handleReset = (event: any) => {
      const detail = event?.detail;
      if (detail?.href?.startsWith("/finanzas") || detail?.key) {
        if (detail?.key) {
          setActiveTab(detail.key as FinanceSubmoduleTab);
        } else {
          setActiveTab("cobranzas_opex");
        }
      }
    };
    window.addEventListener("inntel:reset-submodule-view", handleReset);
    return () => {
      window.removeEventListener("inntel:reset-submodule-view", handleReset);
    };
  }, []);

  let resolvedTab: FinanceSubmoduleTab = activeTab;
  if (resolvedTab === "movimientos" && !canMovimientos) {
    if (canBancos) resolvedTab = "bancos";
    else if (canCxC) resolvedTab = "cuentas_por_cobrar";
    else if (canCxP) resolvedTab = "cuentas_por_pagar";
    else if (canReportes) resolvedTab = "reportes";
  }

  const pendingCxPCount = purchaseInvoices.filter(
    (inv) => inv.paymentStatus === "pendiente" || inv.paymentStatus === "abono_parcial"
  ).length;

  const pendingCxCCount = monthlyCharges.filter(
    (c) => c.status === "pendiente"
  ).length;

  if (!canAccessFinanzas) {
    return (
      <div className="p-8 bg-white border border-[#e2e8f0] rounded-xl text-center max-w-lg mx-auto my-12 space-y-3">
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

  const visibleTabs = FINANCE_TABS.filter((tab) => {
    if (tab.id === "cobranzas_opex") return true;
    return canAccessSubmodule(currentUser, "finanzas", tab.submoduleKey);
  });

  return (
    <div className="space-y-6">
      {/* Submodule Navigation Ribbon */}
      <div className="flex items-center gap-1.5 pb-2 border-b border-[#e2e8f0] overflow-x-auto scrollbar-thin">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            resolvedTab === tab.id ||
            (tab.id === "cobranzas_opex" && resolvedTab === "general");

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                router.push(tab.href);
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? "bg-[#004ac6] text-white shadow-xs"
                  : "bg-white text-[#434655] hover:bg-[#f8f9ff] hover:text-[#004ac6] border border-[#e2e8f0]"
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? "text-white" : "text-[#737686]"}`} />
              <span>{tab.label}</span>
              {tab.id === "cuentas_por_cobrar" && pendingCxCCount > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${
                    isActive
                      ? "bg-white text-[#004ac6]"
                      : "bg-[#fffbeb] text-[#b45309] border border-[#fde68a]"
                  }`}
                >
                  {pendingCxCCount}
                </span>
              )}
              {tab.id === "cuentas_por_pagar" && pendingCxPCount > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${
                    isActive
                      ? "bg-white text-[#004ac6]"
                      : "bg-[#fffbeb] text-[#b45309] border border-[#fde68a]"
                  }`}
                >
                  {pendingCxPCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Submodule View Content */}
      <div className="w-full">
        {(resolvedTab === "cobranzas_opex" || resolvedTab === "general") && <FinanceDashboard />}
        {resolvedTab === "movimientos" && (canMovimientos ? <MovementsTab /> : (
          <div className="p-8 bg-white border border-[#e2e8f0] rounded-xl text-center space-y-2">
            <ShieldAlert className="w-8 h-8 text-amber-500 mx-auto" />
            <h3 className="text-sm font-bold text-[#0b1c30]">Submódulo de Movimientos Restringido</h3>
            <p className="text-xs text-[#737686]">Tu perfil no cuenta con permisos para ver los movimientos detallados.</p>
          </div>
        ))}
        {resolvedTab === "bancos" && (canBancos ? <BankAccountsTab /> : (
          <div className="p-8 bg-white border border-[#e2e8f0] rounded-xl text-center space-y-2">
            <ShieldAlert className="w-8 h-8 text-amber-500 mx-auto" />
            <h3 className="text-sm font-bold text-[#0b1c30]">Submódulo de Bancos Restringido</h3>
            <p className="text-xs text-[#737686]">Tu perfil no cuenta con permisos para gestionar cuentas bancarias.</p>
          </div>
        ))}
        {resolvedTab === "cuentas_por_cobrar" && (canCxC ? <AccountsReceivableTab /> : (
          <div className="p-8 bg-white border border-[#e2e8f0] rounded-xl text-center space-y-2">
            <ShieldAlert className="w-8 h-8 text-amber-500 mx-auto" />
            <h3 className="text-sm font-bold text-[#0b1c30]">Submódulo de Cuentas por Cobrar Restringido</h3>
            <p className="text-xs text-[#737686]">Tu perfil no cuenta con permisos para consultar cuentas por cobrar.</p>
          </div>
        ))}
        {resolvedTab === "cuentas_por_pagar" && (canCxP ? <AccountsPayableTab /> : (
          <div className="p-8 bg-white border border-[#e2e8f0] rounded-xl text-center space-y-2">
            <ShieldAlert className="w-8 h-8 text-amber-500 mx-auto" />
            <h3 className="text-sm font-bold text-[#0b1c30]">Submódulo de Cuentas por Pagar Restringido</h3>
            <p className="text-xs text-[#737686]">Tu perfil no cuenta con permisos para consultar cuentas por pagar.</p>
          </div>
        ))}
        {resolvedTab === "reportes" && (canReportes ? <FinancialReportsTab /> : (
          <div className="p-8 bg-white border border-[#e2e8f0] rounded-xl text-center space-y-2">
            <ShieldAlert className="w-8 h-8 text-amber-500 mx-auto" />
            <h3 className="text-sm font-bold text-[#0b1c30]">Submódulo de Reportes Restringido</h3>
            <p className="text-xs text-[#737686]">Tu perfil no cuenta con permisos para ver reportes financieros.</p>
          </div>
        ))}
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
        <footer className="px-8 py-4 bg-white border-t border-[#e2e8f0] flex flex-wrap items-center justify-between gap-3 text-xs text-[#737686]">
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
