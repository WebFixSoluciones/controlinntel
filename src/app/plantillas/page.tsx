"use client";

import React from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { QuickSearchModal } from "@/components/layout/QuickSearchModal";
import { GeminiAssistantWidget } from "@/components/modules/ai/GeminiAssistantWidget";
import { TemplateGenerator } from "@/components/modules/templates/TemplateGenerator";

export default function PlantillasPage() {
  return (
    <div className="flex min-h-screen bg-[#f8f9ff] text-[#0b1c30]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="p-6 md:p-8 space-y-6 flex-1 overflow-y-auto w-full min-w-0">
          <TemplateGenerator />
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
