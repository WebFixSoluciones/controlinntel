"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/lib/state";
import { canAccessSubmodule } from "@/lib/permissions";
import { Plus } from "lucide-react";
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

  const {
    currentUser,
    purchaseInvoices,
    supplierCreditNotes,
    supplierDebitNotes,
    purchaseWithholdings,
  } = useApp();

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
  const canRegistrar = canAccessSubmodule(currentUser, "compras", "registrar_compra");
  const canNC = canAccessSubmodule(currentUser, "compras", "notas_credito");
  const canND = canAccessSubmodule(currentUser, "compras", "notas_debito");
  const canRet = canAccessSubmodule(currentUser, "compras", "retenciones");

  const getSubmoduleTitle = () => {
    switch (activeTab) {
      case "notas_credito":
        return {
          title: "Notas de Crédito Recibidas",
          count: supplierCreditNotes.length,
          description: "Descuentos, devoluciones y correcciones fiscales emitidas por proveedores",
        };
      case "notas_debito":
        return {
          title: "Notas de Débito Recibidas",
          count: supplierDebitNotes.length,
          description: "Recargos por mora o ajustes de valor recibidos de proveedores",
        };
      case "retenciones":
        return {
          title: "Retenciones de Compras",
          count: purchaseWithholdings.length,
          description: "Comprobantes de retención en la fuente de IVA e Impuesto a la Renta SRI",
        };
      default:
        return {
          title: "Historial de Compras",
          count: purchaseInvoices.length,
          description: "Registro de facturas comerciales de proveedores e ingreso físico a bodegas",
        };
    }
  };

  const currentInfo = getSubmoduleTitle();

  return (
    <div className="space-y-6 select-none">
      {/* Submodule Clean Header matching Reference */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1c30] tracking-tight flex items-center gap-2.5">
            {currentInfo.title}
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#f1f5f9] text-[#475569] border border-[#e2e8f0]">
              {currentInfo.count}
            </span>
          </h1>
          <p className="text-xs text-[#737686] mt-0.5">
            {currentInfo.description}
          </p>
        </div>

        {canRegistrar && (
          <button
            onClick={() => setIsRegisterModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#0b1c30] hover:bg-[#1e293b] text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Compra</span>
          </button>
        )}
      </div>

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
