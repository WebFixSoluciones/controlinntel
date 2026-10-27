"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { QuickSearchModal } from "@/components/layout/QuickSearchModal";
import { TicketsBoard } from "@/components/modules/tickets/TicketsBoard";
import { TicketModal } from "@/components/modules/tickets/TicketModal";

export default function TicketsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#f8f9ff] text-[#0b1c30]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="p-6 md:p-8 space-y-6 flex-1 overflow-y-auto w-full min-w-0">
          <TicketsBoard onOpenNewModal={() => setIsModalOpen(true)} />
        </main>

        <TicketModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        <QuickSearchModal />
      </div>
    </div>
  );
}
