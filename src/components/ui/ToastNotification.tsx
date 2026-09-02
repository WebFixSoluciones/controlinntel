"use client";

import React from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  duration?: number;
}

interface ToastNotificationProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export function ToastNotificationContainer({ toasts, onDismiss }: ToastNotificationProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-5 right-5 z-50 flex flex-col gap-2.5 max-w-md w-full pointer-events-none select-none">
      {toasts.map((toast) => {
        const isError = toast.type === "error";
        const isWarning = toast.type === "warning";
        const isSuccess = toast.type === "success";

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-2xl shadow-lumina-dropdown border flex items-start gap-3.5 backdrop-blur-md transition-all duration-300 animate-in slide-in-from-top-4 fade-in ${
              isError
                ? "bg-white/95 border-[#fecaca] text-[#0b1c30]"
                : isWarning
                ? "bg-white/95 border-[#fde68a] text-[#0b1c30]"
                : isSuccess
                ? "bg-white/95 border-[#a7f3d0] text-[#0b1c30]"
                : "bg-white/95 border-[#dce9ff] text-[#0b1c30]"
            }`}
          >
            <div
              className={`p-2 rounded-xl shrink-0 flex items-center justify-center ${
                isError
                  ? "bg-[#fef2f2] text-[#ef4444]"
                  : isWarning
                  ? "bg-[#fffbeb] text-[#f59e0b]"
                  : isSuccess
                  ? "bg-[#ecfdf5] text-[#10B981]"
                  : "bg-[#eff4ff] text-[#004ac6]"
              }`}
            >
              {isError && <XCircle className="w-5 h-5" />}
              {isWarning && <AlertTriangle className="w-5 h-5" />}
              {isSuccess && <CheckCircle2 className="w-5 h-5" />}
              {!isError && !isWarning && !isSuccess && <Info className="w-5 h-5" />}
            </div>

            <div className="flex-1 min-w-0">
              <h4
                className={`text-xs font-bold leading-tight ${
                  isError
                    ? "text-[#ef4444]"
                    : isWarning
                    ? "text-[#b45309]"
                    : isSuccess
                    ? "text-[#059669]"
                    : "text-[#004ac6]"
                }`}
              >
                {toast.title}
              </h4>
              <p className="text-[11px] text-[#434655] mt-1 leading-relaxed break-words font-medium">
                {toast.message}
              </p>
            </div>

            <button
              onClick={() => onDismiss(toast.id)}
              className="p-1 rounded-lg text-[#737686] hover:text-[#0b1c30] hover:bg-[#f8f9ff] transition-colors shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
