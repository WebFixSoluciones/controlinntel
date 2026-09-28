"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useApp } from "@/lib/state";
import { canAccessSubmodule } from "@/lib/permissions";
import { PurchaseHistoryTab } from "./PurchaseHistoryTab";
import { NewPurchaseView } from "./NewPurchaseView";
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const subParam = (searchParams.get("sub") as PurchasesSubmoduleTab) || "historial_compras";

  const { currentUser } = useApp();

  const [activeTab, setActiveTab] = useState<PurchasesSubmoduleTab>(subParam);
  const [contextInvoice, setContextInvoice] = useState<PurchaseInvoice | null>(null);

  useEffect(() => {
    if (subParam) {
      setActiveTab(subParam);
    }
  }, [subParam]);

  // Submodule permission guards
  const canHistorial = canAccessSubmodule(currentUser, "compras", "historial_compras");
  const canNC = canAccessSubmodule(currentUser, "compras", "notas_credito");
  const canND = canAccessSubmodule(currentUser, "compras", "notas_debito");
  const canRet = canAccessSubmodule(currentUser, "compras", "retenciones");

  if (activeTab === "registrar_compra") {
    return (
      <NewPurchaseView
        onBack={() => {
          setActiveTab("historial_compras");
          router.push("/compras?sub=historial_compras");
        }}
        onSuccess={() => {
          setActiveTab("historial_compras");
          router.push("/compras?sub=historial_compras");
        }}
      />
    );
  }

  return (
    <div className="space-y-6 select-none">
      {/* Submodule View Content */}
      <div className="w-full">
        {activeTab === "historial_compras" && canHistorial && (
          <PurchaseHistoryTab
            onOpenNewPurchase={() => {
              setActiveTab("registrar_compra");
              router.push("/compras?sub=registrar_compra");
            }}
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
    </div>
  );
}
