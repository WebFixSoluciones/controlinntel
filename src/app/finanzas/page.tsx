"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { QuickSearchModal } from "@/components/layout/QuickSearchModal";
import { GeminiAssistantWidget } from "@/components/modules/ai/GeminiAssistantWidget";
import { FinanceDashboard } from "@/components/modules/finance/FinanceDashboard";
import { ExpensesManager } from "@/components/modules/finance/ExpensesManager";
import { DollarSign, Receipt } from "lucide-react";

export default function FinanzasPage() {
  const [activeTab, setActiveTab] = useState<"ingresos" | "gastos">("ingresos");

  return (
    <div className="flex min-h-screen bg-[#f8f9ff] text-[#0b1c30]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="p-6 md:p-8 space-y-6 flex-1 overflow-y-auto w-full min-w-0">
          {/* Module Tab Selector */}
          <div className="flex items-center gap-2 p-1.5 bg-white rounded-xl border border-[#e2e8f0] shadow-2xs w-fit select-none">
            <button
              onClick={() => setActiveTab("ingresos")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "ingresos"
                  ? "bg-[#004ac6] text-white shadow-xs"
                  : "text-[#434655] hover:text-[#004ac6] hover:bg-[#f8f9ff]"
              }`}
            >
              <DollarSign className="w-4 h-4" />
              <span>Ingresos, Cobranzas & Facturas</span>
            </button>
            <button
              onClick={() => setActiveTab("gastos")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "gastos"
                  ? "bg-[#712ae2] text-white shadow-xs"
                  : "text-[#434655] hover:text-[#712ae2] hover:bg-[#f8f9ff]"
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Gastos Operativos & OPEX</span>
            </button>
          </div>

          {activeTab === "ingresos" ? (
            <FinanceDashboard onOpenNewExpense={() => setActiveTab("gastos")} />
          ) : (
            <ExpensesManager />
          )}
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

        <QuickSearchModal />
        <GeminiAssistantWidget />
      </div>
    </div>
  );
}
