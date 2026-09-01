"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { ToastItem, ToastNotificationContainer, ToastType } from "@/components/ui/ToastNotification";
import { AlertModal, AlertModalState } from "@/components/ui/AlertModal";

interface ToastContextType {
  showToast: (type: ToastType, title: string, message: string, duration?: number) => void;
  showSuccess: (title: string, message: string) => void;
  showError: (title: string, message: string) => void;
  showWarning: (title: string, message: string) => void;
  showInfo: (title: string, message: string) => void;
  showAlert: (options: Omit<AlertModalState, "isOpen">) => void;
  showConfirm: (title: string, message: string, onConfirm: () => void, confirmText?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [modal, setModal] = useState<AlertModalState>({
    isOpen: false,
    type: "info",
    title: "",
    message: "",
  });

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((type: ToastType, title: string, message: string, duration: number = 4500) => {
    const id = "toast-" + Date.now() + "-" + Math.random().toString(36).substring(2, 5);
    const newToast: ToastItem = { id, type, title, message, duration };

    setToasts((prev) => [newToast, ...prev]);

    if (duration > 0) {
      setTimeout(() => {
        dismissToast(id);
      }, duration);
    }
  }, [dismissToast]);

  const showSuccess = useCallback((title: string, message: string) => {
    showToast("success", title, message);
  }, [showToast]);

  const showError = useCallback((title: string, message: string) => {
    showToast("error", title, message, 6000);
  }, [showToast]);

  const showWarning = useCallback((title: string, message: string) => {
    showToast("warning", title, message, 5000);
  }, [showToast]);

  const showInfo = useCallback((title: string, message: string) => {
    showToast("info", title, message);
  }, [showToast]);

  const showAlert = useCallback((options: Omit<AlertModalState, "isOpen">) => {
    setModal({ ...options, isOpen: true });
  }, []);

  const showConfirm = useCallback((title: string, message: string, onConfirm: () => void, confirmText: string = "Confirmar") => {
    setModal({
      isOpen: true,
      type: "confirm",
      title,
      message,
      confirmText,
      cancelText: "Cancelar",
      onConfirm,
    });
  }, []);

  return (
    <ToastContext.Provider
      value={{
        showToast,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        showAlert,
        showConfirm,
      }}
    >
      {children}
      <ToastNotificationContainer toasts={toasts} onDismiss={dismissToast} />
      <AlertModal modal={modal} onClose={() => setModal((prev) => ({ ...prev, isOpen: false }))} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
