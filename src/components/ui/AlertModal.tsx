"use client";

import React from "react";
import { AlertTriangle, CheckCircle2, XCircle, Info, X } from "lucide-react";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden transform animate-in zoom-in-95 duration-150">
        <div className="p-6 text-center space-y-3">
          {/* Icon Badge */}
          <div className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center shadow-md">
            {modal.type === "error" && (
              <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
                <XCircle className="w-8 h-8" />
              </div>
            )}
            {modal.type === "warning" && (
              <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8" />
              </div>
            )}
            {modal.type === "confirm" && (
              <div className="w-14 h-14 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8" />
              </div>
            )}
            {modal.type === "success" && (
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
            )}
            {modal.type === "info" && (
              <div className="w-14 h-14 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center">
                <Info className="w-8 h-8" />
              </div>
            )}
          </div>

          <h3 className="text-base font-black text-slate-900 tracking-tight">{modal.title}</h3>
          <p className="text-xs text-slate-600 leading-relaxed font-medium">{modal.message}</p>
        </div>

        {/* Buttons Footer */}
        <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-2.5">
          {(modal.type === "confirm" || modal.cancelText) && (
            <button
              onClick={handleCancel}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/70 transition-colors cursor-pointer"
            >
              {modal.cancelText || "Cancelar"}
            </button>
          )}

          <button
            onClick={handleConfirm}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm transition-all cursor-pointer ${
              modal.type === "error"
                ? "bg-rose-600 hover:bg-rose-700"
                : modal.type === "warning" || modal.type === "confirm"
                ? "bg-amber-600 hover:bg-amber-700"
                : "bg-sky-600 hover:bg-sky-700"
            }`}
          >
            {modal.confirmText || "Entendido"}
          </button>
        </div>
      </div>
    </div>
  );
}
