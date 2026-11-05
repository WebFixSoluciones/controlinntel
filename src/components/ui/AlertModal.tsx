"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, XCircle, Info, Loader2 } from "lucide-react";

export interface AlertModalState {
  isOpen: boolean;
  type: "warning" | "error" | "success" | "info" | "confirm";
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
}

interface AlertModalProps {
  modal: AlertModalState;
  onClose: () => void;
}

export function AlertModal({ modal, onClose }: AlertModalProps) {
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const executing = useRef(false);
  const titleId = useId();
  const messageId = useId();

  useEffect(() => { setActionError(""); }, [modal]);
  useEffect(() => {
    if (!modal.isOpen) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (executing.current) return;
      modal.onCancel?.();
      onClose();
    };
    document.addEventListener("keydown", escape, true);
    return () => document.removeEventListener("keydown", escape, true);
  }, [modal, onClose]);

  if (!modal.isOpen) return null;

  const handleConfirm = async () => {
    if (executing.current) return;
    executing.current = true;
    setActionError("");
    if (modal.onConfirm) {
      try {
        setLoading(true);
        const result = modal.onConfirm();
        if (result && typeof (result as Promise<unknown>).then === "function") {
          await result;
        }
        onClose();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "No se pudo completar la acción. Intenta nuevamente.");
      } finally {
        setLoading(false);
        executing.current = false;
      }
    } else {
      onClose();
      executing.current = false;
    }
  };

  const handleCancel = () => {
    if (executing.current) return;
    if (modal.onCancel) modal.onCancel();
    onClose();
  };

  return createPortal(
    <div role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={messageId} aria-busy={loading} className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lumina-dropdown border border-[#e2e8f0] overflow-hidden transform animate-in zoom-in-95 duration-150">
        <div className="p-6 text-center space-y-3">
          {/* Icon Badge */}
          <div className="mx-auto w-14 h-14 rounded-xl flex items-center justify-center shadow-xs">
            {modal.type === "error" && (
              <div className="w-14 h-14 rounded-xl bg-[#fef2f2] text-[#ef4444] border border-[#fecaca] flex items-center justify-center">
                <XCircle className="w-8 h-8" />
              </div>
            )}
            {modal.type === "warning" && (
              <div className="w-14 h-14 rounded-xl bg-[#fffbeb] text-[#f59e0b] border border-[#fde68a] flex items-center justify-center">
                <AlertTriangle className="w-8 h-8" />
              </div>
            )}
            {modal.type === "confirm" && (
              <div className="w-14 h-14 rounded-xl bg-[#eff4ff] text-[#004ac6] border border-[#dce9ff] flex items-center justify-center">
                <AlertTriangle className="w-8 h-8" />
              </div>
            )}
            {modal.type === "success" && (
              <div className="w-14 h-14 rounded-xl bg-[#ecfdf5] text-[#10B981] border border-[#a7f3d0] flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
            )}
            {modal.type === "info" && (
              <div className="w-14 h-14 rounded-xl bg-[#eff4ff] text-[#004ac6] border border-[#dce9ff] flex items-center justify-center">
                <Info className="w-8 h-8" />
              </div>
            )}
          </div>

          <h3 id={titleId} className="text-base font-bold text-[#0b1c30] tracking-tight">{modal.title}</h3>
          <p id={messageId} className="text-xs text-[#434655] leading-relaxed font-medium whitespace-pre-line">{modal.message}</p>
          {actionError && <p role="alert" className="text-xs text-rose-700">{actionError}</p>}
        </div>

        {/* Buttons Footer */}
        <div className="p-4 bg-[#f8f9ff] border-t border-[#e2e8f0] flex items-center justify-end gap-2.5">
          {(modal.type === "confirm" || modal.cancelText) && (
            <button
              type="button"
              data-dialog-autofocus
              onClick={handleCancel}
              disabled={loading}
              className="px-4 py-2 rounded-lg text-xs font-bold text-[#737686] hover:bg-[#e5eeff] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {modal.cancelText || "Cancelar"}
            </button>
          )}

          <button
            type="button"
            data-dialog-autofocus={modal.type !== "confirm" && !modal.cancelText ? "" : undefined}
            onClick={handleConfirm}
            disabled={loading}
            className={`px-5 py-2.5 rounded-lg text-xs font-bold text-white shadow-xs transition-all cursor-pointer flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ${
              modal.type === "error"
                ? "bg-[#ef4444] hover:bg-rose-700"
                : modal.type === "warning"
                ? "bg-[#f59e0b] hover:bg-amber-600"
                : "bg-[#004ac6] hover:bg-[#2563eb]"
            }`}
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {modal.confirmText || "Entendido"}
          </button>
        </div>
      </div>
    </div>, document.body,
  );
}
