"use client";

import React from "react";
import { useApp } from "@/lib/state";
import { UserRole } from "@/types";
import { Search, Bell, Shield, RotateCcw } from "lucide-react";

export function Header() {
  const { currentUser, setUserRole, policies, tickets, setIsSearchOpen, resetDataToDefaults } = useApp();

  const urgentCount = policies.filter((p) => p.status === "por_vencer").length;
  const criticalTickets = tickets.filter((t) => t.priority === "alta" || t.priority === "critica").length;

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs select-none">
      {/* Search Bar Trigger */}
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <button
          onClick={() => setIsSearchOpen(true)}
          className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 text-slate-400 text-xs transition-all group cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <Search className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
            <span>Buscar cliente por RUC/Cédula, Nodo, Póliza o Ticket...</span>
          </div>
          <kbd className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-white rounded-md border border-slate-200 text-slate-500 shadow-2xs">
            Ctrl + K
          </kbd>
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Role Switcher */}
        <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
          <Shield className="w-3.5 h-3.5 text-slate-500 ml-1.5" />
          <span className="text-[11px] font-bold text-slate-600">Vista Rol:</span>
          <select
            value={currentUser.role}
            onChange={(e) => setUserRole(e.target.value as UserRole)}
            className="bg-white text-xs font-semibold text-slate-800 rounded-lg px-2 py-1 border border-slate-200 outline-hidden focus:ring-2 focus:ring-sky-500 cursor-pointer"
          >
            <option value="admin">Administrador (Full)</option>
            <option value="finanzas">Finanzas & Pre-SRI</option>
            <option value="tecnico">Técnico & MikroTik</option>
            <option value="soporte">Soporte Helpdesk</option>
            <option value="consulta">Solo Consulta</option>
          </select>
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setIsSearchOpen(true)}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all relative border border-transparent hover:border-slate-200 cursor-pointer"
            title="Notificaciones regulatorias y operativas"
          >
            <Bell className="w-4 h-4" />
            {(urgentCount > 0 || criticalTickets > 0) && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white animate-pulse" />
            )}
          </button>
        </div>

        {/* Reset */}
        <button
          onClick={() => {
            if (confirm("¿Deseas reiniciar los datos a los valores predeterminados de INNTEL CORP?")) {
              resetDataToDefaults();
            }
          }}
          className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all border border-transparent hover:border-rose-100 cursor-pointer"
          title="Reiniciar datos de prueba"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
