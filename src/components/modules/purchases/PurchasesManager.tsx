"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/lib/state";
import { canAccessSubmodule } from "@/lib/permissions";
import { PurchaseHistoryTab } from "./PurchaseHistoryTab";
import { RegisterPurchaseModal } from "./RegisterPurchaseModal";
import { SupplierCreditNotesTab } from "./SupplierCreditNotesTab";
import { SupplierDebitNotesTab } from "./SupplierDebitNotesTab";
import { PurchaseWithholdingsTab } from "./PurchaseWithholdingsTab";
import { PurchaseInvoice } from "@/types";

export type PurchasesSubmoduleTab =
  | "historial_compras"
  | "registrar_compra"
  | "notas_credito"
  | "notas_debito"
  | "retenciones";

export function PurchasesManager() {
  const searchParams = useSearchParams();
  const subParam = (searchParams.get("sub") as PurchasesSubmoduleTab) || "historial_compras";

  const { currentUser } = useApp();

  const [activeTab, setActiveTab] = useState<PurchasesSubmoduleTab>(subParam);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [contextInvoice, setContextInvoice] = useState<PurchaseInvoice | null>(null);

  useEffect(() => {
    if (subParam === "registrar_compra") {
      setIsRegisterModalOpen(true);
      setActiveTab("historial_compras");
    } else if (subParam) {
      setActiveTab(subParam);
    }
  }, [subParam]);

  // Submodule permission guards
  const canHistorial = canAccessSubmodule(currentUser, "compras", "historial_compras");
  const canNC = canAccessSubmodule(currentUser, "compras", "notas_credito");
  const canND = canAccessSubmodule(currentUser, "compras", "notas_debito");
  const canRet = canAccessSubmodule(currentUser, "compras", "retenciones");

  return (
    <div className="space-y-6 select-none">
      {/* Submodule View Content */}
      <div className="w-full">
        {activeTab === "historial_compras" && canHistorial && (
          <PurchaseHistoryTab
            onOpenNewPurchase={() => setIsRegisterModalOpen(true)}
            onOpenWithholdingForInvoice={(inv) => {
              setContextInvoice(inv);
              setActiveTab("retenciones");
            }}
            onOpenCreditNoteForInvoice={(inv) => {
              setContextInvoice(inv);
              setActiveTab("notas_credito");
            }}
          />
        )}

        {activeTab === "notas_credito" && canNC && (
          <SupplierCreditNotesTab
            initialInvoice={contextInvoice}
            onClearInitialInvoice={() => setContextInvoice(null)}
          />
        )}

        {activeTab === "notas_debito" && canND && <SupplierDebitNotesTab />}

        {activeTab === "retenciones" && canRet && (
          <PurchaseWithholdingsTab
            initialInvoice={contextInvoice}
            onClearInitialInvoice={() => setContextInvoice(null)}
          />
        )}
      </div>

      {/* Modal Nueva Compra */}
      <RegisterPurchaseModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        onSuccess={() => {
          setIsRegisterModalOpen(false);
          setActiveTab("historial_compras");
        }}
      />
    </div>
  );
}
