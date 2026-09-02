"use client";

import React from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { UserRole } from "@/types";
import { Search, Bell, HelpCircle, Shield, RotateCcw, LogOut } from "lucide-react";

export function Header() {
  const { currentUser, setUserRole, policies, tickets, setIsSearchOpen, resetDataToDefaults, logout } = useApp();
  const { showConfirm, showInfo } = useToast();

  const urgentCount = policies.filter((p) => p.status === "por_vencer").length;
  const criticalTickets = tickets.filter((t) => t.priority === "alta" || t.priority === "critica").length;

  const handleLogout = () => {
    showConfirm(
      "¿Cerrar Sesión?",
      `¿Deseas cerrar la sesión activa de ${currentUser.displayName}?`,
      () => {
        logout();
        showInfo("Sesión Cerrada", "Has salido del sistema.");
      },
      "Cerrar Sesión"
    );
  };

  return (
    <header className="h-16 bg-white border-b border-[#e2e8f0] px-8 flex items-center justify-between sticky top-0 z-30 select-none">
      {/* Search Bar Trigger matching Mockups */}
      <div className="flex items-center gap-4 flex-1 max-w-lg">
        <button
          onClick={() => setIsSearchOpen(true)}
          className="w-full flex items-center justify-between px-3.5 py-2 rounded-lg bg-white hover:bg-[#f8f9ff] border border-[#cbd5e1] text-[#737686] text-xs transition-all group cursor-pointer shadow-2xs"
        >
          <div className="flex items-center gap-2.5">
            <Search className="w-4 h-4 text-[#737686] group-hover:text-[#004ac6] transition-colors" />
            <span className="text-[#737686]">Buscar clientes, tickets, facturas...</span>
          </div>
          <kbd className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-[#f1f5f9] rounded border border-[#e2e8f0] text-[#737686]">
            Ctrl + K
          </kbd>
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Notifications Bell */}
        <div className="relative">
          <button
            onClick={() => setIsSearchOpen(true)}
            className="p-2 rounded-lg text-[#434655] hover:text-[#004ac6] hover:bg-[#eff4ff] transition-all relative cursor-pointer"
            title="Notificaciones regulatorias y operativas"
          >
            <Bell className="w-4 h-4" />
            {(urgentCount > 0 || criticalTickets > 0) && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#ef4444] ring-2 ring-white" />
            )}
          </button>
        </div>

        {/* Help Icon */}
        <button
          onClick={() => alert("Centro de Ayuda INNTEL CORP — Soporte técnico ISP & ARCOTEL")}
          className="p-2 rounded-lg text-[#434655] hover:text-[#004ac6] hover:bg-[#eff4ff] transition-all cursor-pointer"
          title="Ayuda y Documentación"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* Reset Data */}
        <button
          onClick={() => {
            if (confirm("¿Deseas reiniciar los datos de la plataforma al estado inicial?")) {
              resetDataToDefaults();
            }
          }}
          className="p-2 rounded-lg text-[#737686] hover:text-[#ef4444] hover:bg-red-50 transition-all cursor-pointer"
          title="Reiniciar datos de demo"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* User Profile Pill Avatar */}
        <div className="flex items-center gap-2 pl-2 border-l border-[#e2e8f0]">
          <div className="w-8 h-8 rounded-full bg-[#004ac6] text-white font-bold text-xs flex items-center justify-center shadow-xs">
            {currentUser.displayName.charAt(0)}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-bold text-[#0b1c30] leading-tight truncate">{currentUser.displayName}</p>
            <p className="text-[10px] text-[#737686] leading-none">{currentUser.role === "admin" ? "Admin" : currentUser.role}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
