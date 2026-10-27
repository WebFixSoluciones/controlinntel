"use client";

import React, { Suspense } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { QuickSearchModal } from "@/components/layout/QuickSearchModal";
import { PurchasesManager } from "@/components/modules/purchases/PurchasesManager";

export default function ComprasPage() {
  return (
    <div className="flex min-h-screen bg-[#f8f9ff] text-[#0b1c30]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="p-6 md:p-8 space-y-8 flex-1 overflow-y-auto w-full min-w-0">
          <Suspense fallback={<div className="p-8 text-center text-xs text-[#737686]">Cargando compras...</div>}>
            <PurchasesManager />
          </Suspense>
        </main>
      </div>

      <QuickSearchModal />
    </div>
  );
}
