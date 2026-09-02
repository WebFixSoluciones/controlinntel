"use client";

import React, { useState } from "react";
import { AppProvider } from "@/lib/state";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { QuickSearchModal } from "@/components/layout/QuickSearchModal";
import { GeminiAssistantWidget } from "@/components/modules/ai/GeminiAssistantWidget";
import { TicketsBoard } from "@/components/modules/tickets/TicketsBoard";
import { TicketModal } from "@/components/modules/tickets/TicketModal";

export default function TicketsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <AppProvider>
      <div className="flex min-h-screen bg-[#f8f9ff] text-[#0b1c30]">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Header />
          <main className="p-8 space-y-6 flex-1 overflow-y-auto max-w-7xl w-full mx-auto">
            <TicketsBoard onOpenNewModal={() => setIsModalOpen(true)} />
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

          <TicketModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
          <QuickSearchModal />
          <GeminiAssistantWidget />
        </div>
      </div>
    </AppProvider>
  );
}
