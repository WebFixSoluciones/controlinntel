"use client";

import React from "react";
import { AlertTriangle, CheckCircle2, XCircle, Info } from "lucide-react";

export interface AlertModalState {
  isOpen: boolean;
  type: "warning" | "error" | "success" | "info" | "confirm";
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface AlertModalProps {
  modal: AlertModalState;
  onClose: () => void;
}

export function AlertModal({ modal, onClose }: AlertModalProps) {
  if (!modal.isOpen) return null;

  const handleConfirm = () => {
    if (modal.onConfirm) modal.onConfirm();
    onClose();
  };

  const handleCancel = () => {
    if (modal.onCancel) modal.onCancel();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lumina-dropdown border border-[#e2e8f0] overflow-hidden transform animate-in zoom-in-95 duration-150">
        <div className="p-6 text-center space-y-3">
          {/* Icon Badge */}
          <div className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center shadow-xs">
            {modal.type === "error" && (
              <div className="w-14 h-14 rounded-2xl bg-[#fef2f2] text-[#ef4444] border border-[#fecaca] flex items-center justify-center">
                <XCircle className="w-8 h-8" />
              </div>
            )}
            {modal.type === "warning" && (
              <div className="w-14 h-14 rounded-2xl bg-[#fffbeb] text-[#f59e0b] border border-[#fde68a] flex items-center justify-center">
                <AlertTriangle className="w-8 h-8" />
              </div>
            )}
            {modal.type === "confirm" && (
              <div className="w-14 h-14 rounded-2xl bg-[#eff4ff] text-[#004ac6] border border-[#dce9ff] flex items-center justify-center">
                <AlertTriangle className="w-8 h-8" />
              </div>
            )}
            {modal.type === "success" && (
              <div className="w-14 h-14 rounded-2xl bg-[#ecfdf5] text-[#10B981] border border-[#a7f3d0] flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
            )}
            {modal.type === "info" && (
              <div className="w-14 h-14 rounded-2xl bg-[#eff4ff] text-[#004ac6] border border-[#dce9ff] flex items-center justify-center">
                <Info className="w-8 h-8" />
              </div>
            )}
          </div>

          <h3 className="text-base font-bold text-[#0b1c30] tracking-tight">{modal.title}</h3>
          <p className="text-xs text-[#434655] leading-relaxed font-medium">{modal.message}</p>
        </div>

        {/* Buttons Footer */}
        <div className="p-4 bg-[#f8f9ff] border-t border-[#e2e8f0] flex items-center justify-end gap-2.5">
          {(modal.type === "confirm" || modal.cancelText) && (
            <button
              onClick={handleCancel}
              className="px-4 py-2 rounded-lg text-xs font-bold text-[#737686] hover:bg-[#e5eeff] transition-colors cursor-pointer"
            >
              {modal.cancelText || "Cancelar"}
            </button>
          )}

          <button
            onClick={handleConfirm}
            className={`px-5 py-2.5 rounded-lg text-xs font-bold text-white shadow-xs transition-all cursor-pointer ${
              modal.type === "error"
                ? "bg-[#ef4444] hover:bg-rose-700"
                : modal.type === "warning"
                ? "bg-[#f59e0b] hover:bg-amber-600"
                : "bg-[#004ac6] hover:bg-[#2563eb]"
            }`}
          >
            {modal.confirmText || "Entendido"}
          </button>
        </div>
      </div>
    </div>
  );
}
