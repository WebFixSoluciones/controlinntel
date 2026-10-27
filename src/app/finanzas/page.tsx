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
import { ExpensesManager } from "@/components/modules/finance/ExpensesManager";
import { FinanceErrorBoundary } from "@/components/modules/finance/FinanceErrorBoundary";

export type FinanceSubmoduleTab =
  | "cobranzas"
  | "anticipos"
  | "cobranzas_opex"
  | "gastos"
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
    id: "cobranzas",
    label: "Cobranzas",
    icon: TrendingUp,
    submoduleKey: "cobranzas",
    href: "/finanzas?sub=cobranzas",
  },
  {
    id: "anticipos",
    label: "Anticipos",
    icon: CreditCard,
    submoduleKey: "anticipos",
    href: "/finanzas?sub=anticipos",
  },
  {
    id: "gastos",
    label: "Gastos",
    icon: Receipt,
    submoduleKey: "gastos",
    href: "/finanzas?sub=gastos",
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
  const canCobranzas = canAccessSubmodule(currentUser, "finanzas", "cobranzas");
  const canAnticipos = canAccessSubmodule(currentUser, "finanzas", "anticipos") || canCobranzas;
  const canGastos = canAccessSubmodule(currentUser, "finanzas", "gastos");
  const canMovimientos = canAccessSubmodule(currentUser, "finanzas", "movimientos");
  const canBancos = canAccessSubmodule(currentUser, "finanzas", "bancos");
  const canCxC = canAccessSubmodule(currentUser, "finanzas", "cuentas_por_cobrar");
  const canCxP = canAccessSubmodule(currentUser, "finanzas", "cuentas_por_pagar");
  const canReportes = canAccessSubmodule(currentUser, "finanzas", "reportes");

  const rawSubParam = searchParams.get("sub");
  const normalizedParam: FinanceSubmoduleTab =
    rawSubParam === "cobranzas_opex" ? "cobranzas" : ((rawSubParam as FinanceSubmoduleTab) || "cobranzas");
  const [activeTab, setActiveTab] = useState<FinanceSubmoduleTab>(normalizedParam);

  useEffect(() => {
    if (rawSubParam) {
      setActiveTab(rawSubParam === "cobranzas_opex" ? "cobranzas" : (rawSubParam as FinanceSubmoduleTab));
    }
  }, [rawSubParam]);

  useEffect(() => {
    const handleReset = (event: any) => {
      const detail = event?.detail;
      if (detail?.href?.startsWith("/finanzas") || detail?.key) {
        if (detail?.key) {
          setActiveTab(detail.key as FinanceSubmoduleTab);
        } else {
          setActiveTab("cobranzas");
        }
      }
    };
    window.addEventListener("inntel:reset-submodule-view", handleReset);
    return () => {
      window.removeEventListener("inntel:reset-submodule-view", handleReset);
    };
  }, []);

  let resolvedTab: FinanceSubmoduleTab = activeTab;
  if (resolvedTab === "cobranzas_opex") resolvedTab = "cobranzas";
  if (resolvedTab === "cobranzas" && !canCobranzas) {
    if (canGastos) resolvedTab = "gastos";
    else if (canMovimientos) resolvedTab = "movimientos";
    else if (canBancos) resolvedTab = "bancos";
    else if (canCxC) resolvedTab = "cuentas_por_cobrar";
    else if (canCxP) resolvedTab = "cuentas_por_pagar";
    else if (canReportes) resolvedTab = "reportes";
  } else if (resolvedTab === "gastos" && !canGastos) {
    if (canCobranzas) resolvedTab = "cobranzas";
    else if (canMovimientos) resolvedTab = "movimientos";
  } else if (resolvedTab === "movimientos" && !canMovimientos) {
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

  return (
    <div className="w-full">
      {/* Submodule View Content */}
      <div className="w-full">
        <FinanceErrorBoundary key={resolvedTab}>
          {(resolvedTab === "cobranzas" || resolvedTab === "general") && (
            canCobranzas ? <FinanceDashboard activeTabProp="comprobantes" /> : (
              <div className="p-8 bg-white border border-[#e2e8f0] rounded-xl text-center space-y-2">
                <ShieldAlert className="w-8 h-8 text-amber-500 mx-auto" />
                <h3 className="text-sm font-bold text-[#0b1c30]">Submódulo de Cobranzas Restringido</h3>
                <p className="text-xs text-[#737686]">Tu perfil no cuenta con permisos para gestionar cobranzas.</p>
              </div>
            )
          )}
          {resolvedTab === "anticipos" && (
            canAnticipos ? <FinanceDashboard activeTabProp="anticipos" /> : (
              <div className="p-8 bg-white border border-[#e2e8f0] rounded-xl text-center space-y-2">
                <ShieldAlert className="w-8 h-8 text-amber-500 mx-auto" />
                <h3 className="text-sm font-bold text-[#0b1c30]">Submódulo de Anticipos Restringido</h3>
                <p className="text-xs text-[#737686]">Tu perfil no cuenta con permisos para gestionar anticipos.</p>
              </div>
            )
          )}
          {resolvedTab === "gastos" && (
            canGastos ? <ExpensesManager /> : (
              <div className="p-8 bg-white border border-[#e2e8f0] rounded-xl text-center space-y-2">
                <ShieldAlert className="w-8 h-8 text-amber-500 mx-auto" />
                <h3 className="text-sm font-bold text-[#0b1c30]">Submódulo de Gastos Restringido</h3>
                <p className="text-xs text-[#737686]">Tu perfil no cuenta con permisos para ver ni registrar gastos.</p>
              </div>
            )
          )}
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
        </FinanceErrorBoundary>
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
      </div>

      <QuickSearchModal />
    </div>
  );
}
