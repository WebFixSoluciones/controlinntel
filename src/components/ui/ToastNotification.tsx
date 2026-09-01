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
        const isInfo = toast.type === "info";

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-2xl shadow-2xl border flex items-start gap-3.5 backdrop-blur-md transition-all duration-300 animate-in slide-in-from-top-4 fade-in ${
              isError
                ? "bg-white/95 border-rose-200 ring-2 ring-rose-100 text-slate-800"
                : isWarning
                ? "bg-white/95 border-amber-200 ring-2 ring-amber-100 text-slate-800"
                : isSuccess
                ? "bg-white/95 border-emerald-200 ring-2 ring-emerald-100 text-slate-800"
                : "bg-white/95 border-sky-200 ring-2 ring-sky-100 text-slate-800"
            }`}
          >
            <div
              className={`p-2 rounded-xl flex-shrink-0 flex items-center justify-center ${
                isError
                  ? "bg-rose-100 text-rose-600"
                  : isWarning
                  ? "bg-amber-100 text-amber-600"
                  : isSuccess
                  ? "bg-emerald-100 text-emerald-600"
                  : "bg-sky-100 text-sky-600"
              }`}
            >
              {isError && <XCircle className="w-5 h-5 animate-pulse" />}
              {isWarning && <AlertTriangle className="w-5 h-5 animate-bounce" />}
              {isSuccess && <CheckCircle2 className="w-5 h-5" />}
              {isInfo && <Info className="w-5 h-5" />}
            </div>

            <div className="flex-1 min-w-0">
              <h4
                className={`text-xs font-bold leading-tight ${
                  isError
                    ? "text-rose-700"
                    : isWarning
                    ? "text-amber-800"
                    : isSuccess
                    ? "text-emerald-800"
                    : "text-sky-800"
                }`}
              >
                {toast.title}
              </h4>
              <p className="text-[11px] text-slate-600 mt-1 leading-relaxed break-words font-medium">
                {toast.message}
              </p>
            </div>

            <button
              onClick={() => onDismiss(toast.id)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors flex-shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
