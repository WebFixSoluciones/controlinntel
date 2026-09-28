"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { canAccessSubmodule } from "@/lib/permissions";
import {
  FileText,
  PlusCircle,
  Layers,
  ArrowUpRight,
  Percent,
  ShoppingBag,
} from "lucide-react";
import { PurchaseHistoryTab } from "./PurchaseHistoryTab";
import { RegisterPurchaseModal } from "./RegisterPurchaseModal";
import { SupplierCreditNotesTab } from "./SupplierCreditNotesTab";
import { SupplierDebitNotesTab } from "./SupplierDebitNotesTab";
import { PurchaseWithholdingsTab } from "./PurchaseWithholdingsTab";
import { PurchaseInvoice } from "@/types";

export type PurchasesSubmoduleTab =
  | "historial_compras"
  | "notas_credito"
  | "notas_debito"
  | "retenciones";

export function PurchasesManager() {
  const { currentUser, purchaseInvoices } = useApp();

  const [activeTab, setActiveTab] = useState<PurchasesSubmoduleTab>("historial_compras");
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [contextInvoice, setContextInvoice] = useState<PurchaseInvoice | null>(null);

  // Submodule permission guards
  const canHistorial = canAccessSubmodule(currentUser, "compras", "historial_compras");
  const canRegistrar = canAccessSubmodule(currentUser, "compras", "registrar_compra");
  const canNC = canAccessSubmodule(currentUser, "compras", "notas_credito");
  const canND = canAccessSubmodule(currentUser, "compras", "notas_debito");
  const canRet = canAccessSubmodule(currentUser, "compras", "retenciones");

  const pendingCxPCount = purchaseInvoices.filter(
    (inv) => inv.paymentStatus === "pendiente" || inv.paymentStatus === "abono_parcial"
  ).length;

  return (
    <div className="space-y-6">
      {/* Header and Submodule Navigation Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1c30] tracking-tight flex items-center gap-2.5">
            <ShoppingBag className="w-7 h-7 text-[#004ac6]" />
            Módulo de Compras & Proveedores
          </h1>
          <p className="text-xs text-[#737686] mt-0.5">
            Gestión documental, tributaria SRI e ingreso físico de mercancía a bodegas
          </p>
        </div>

        {/* Submodules Navigation Bar (Matching Screenshot Structure) */}
        <div className="flex items-center gap-1.5 p-1.5 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs overflow-x-auto select-none">
          {canHistorial && (
            <button
              onClick={() => setActiveTab("historial_compras")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === "historial_compras"
                  ? "bg-[#004ac6] text-white shadow-xs"
                  : "text-[#434655] hover:text-[#004ac6] hover:bg-[#f8f9ff]"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Historial de Compras</span>
              {pendingCxPCount > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    activeTab === "historial_compras"
                      ? "bg-white/20 text-white"
                      : "bg-[#fffbeb] text-[#b45309] border border-[#fde68a]"
                  }`}
                  title={`${pendingCxPCount} compras pendientes de pago`}
                >
                  {pendingCxPCount}
                </span>
              )}
            </button>
          )}

          {canRegistrar && (
            <button
              onClick={() => setIsRegisterModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer bg-[#eff4ff] text-[#004ac6] hover:bg-[#dce9ff]"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Registrar Compra</span>
            </button>
          )}

          {canNC && (
            <button
              onClick={() => setActiveTab("notas_credito")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === "notas_credito"
                  ? "bg-[#004ac6] text-white shadow-xs"
                  : "text-[#434655] hover:text-[#004ac6] hover:bg-[#f8f9ff]"
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Notas de Crédito Recibidas</span>
            </button>
          )}

          {canND && (
            <button
              onClick={() => setActiveTab("notas_debito")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === "notas_debito"
                  ? "bg-[#004ac6] text-white shadow-xs"
                  : "text-[#434655] hover:text-[#004ac6] hover:bg-[#f8f9ff]"
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>Notas de Débito Recibidas</span>
            </button>
          )}

          {canRet && (
            <button
              onClick={() => setActiveTab("retenciones")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === "retenciones"
                  ? "bg-[#004ac6] text-white shadow-xs"
                  : "text-[#434655] hover:text-[#004ac6] hover:bg-[#f8f9ff]"
              }`}
            >
              <Percent className="w-4 h-4" />
              <span>Retenciones de Compras</span>
            </button>
          )}
        </div>
      </div>

      {/* Submodule View Content */}
      <div className="w-full">
        {activeTab === "historial_compras" && (
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

        {activeTab === "notas_credito" && (
          <SupplierCreditNotesTab
            initialInvoice={contextInvoice}
            onClearInitialInvoice={() => setContextInvoice(null)}
          />
        )}

        {activeTab === "notas_debito" && <SupplierDebitNotesTab />}

        {activeTab === "retenciones" && (
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
