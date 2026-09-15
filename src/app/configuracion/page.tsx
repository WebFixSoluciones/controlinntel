"use client";

import React from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { QuickSearchModal } from "@/components/layout/QuickSearchModal";
import { GeminiAssistantWidget } from "@/components/modules/ai/GeminiAssistantWidget";
import { UserManager } from "@/components/modules/settings/UserManager";
import { PlansManager } from "@/components/modules/settings/RecordManager";

export default function ConfiguracionPage() {
  return (
    <div className="flex min-h-screen bg-[#f8f9ff] text-[#0b1c30]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="p-8 space-y-6 flex-1 overflow-y-auto max-w-7xl w-full mx-auto">
          <UserManager />
          <PlansManager />
        </main>
        <QuickSearchModal />
        <GeminiAssistantWidget />
      </div>
    </div>
  );
}
