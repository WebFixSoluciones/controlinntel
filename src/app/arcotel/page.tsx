"use client";

import React, { useState } from "react";
import { AppProvider } from "@/lib/state";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { QuickSearchModal } from "@/components/layout/QuickSearchModal";
import { GeminiAssistantWidget } from "@/components/modules/ai/GeminiAssistantWidget";
import { PoliciesList } from "@/components/modules/arcotel/PoliciesList";
import { PolicyModal } from "@/components/modules/arcotel/PolicyModal";

export default function ArcotelPage() {
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  return (
    <AppProvider>
      <div className="flex min-h-screen bg-slate-50 text-slate-900">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Header />
          <main className="p-6 space-y-6 flex-1 overflow-y-auto max-w-7xl w-full mx-auto">
            <PoliciesList onOpenNewModal={() => setIsNewModalOpen(true)} />
          </main>
          <PolicyModal isOpen={isNewModalOpen} onClose={() => setIsNewModalOpen(false)} />
          <QuickSearchModal />
          <GeminiAssistantWidget />
        </div>
      </div>
    </AppProvider>
  );
}
