"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  KeyRound,
  Radio,
  Ticket as TicketIcon,
  DollarSign,
  FileText,
  ChevronRight,
  LogOut,
  Settings,
  Crown,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard General", icon: LayoutDashboard },
  { href: "/clientes", label: "Clientes & Ficha 360°", icon: Users, badge: "M1" },
  { href: "/arcotel", label: "ARCOTEL & Pólizas", icon: ShieldCheck, badge: "M2" },
  { href: "/boveda", label: "Bóveda de Credenciales", icon: KeyRound, badge: "M2" },
  { href: "/red", label: "Infraestructura & Nodos", icon: Radio, badge: "M3" },
  { href: "/tickets", label: "Tickets & Soporte NOC", icon: TicketIcon, badge: "M4" },
  { href: "/finanzas", label: "Finanzas & Cobranzas", icon: DollarSign, badge: "M5" },
  { href: "/plantillas", label: "Plantillas Word/Excel", icon: FileText, badge: "M6" },
  { href: "/configuracion", label: "Configuración & Usuarios", icon: Settings, badge: "RBAC" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { currentUser, policies, tickets, logout } = useApp();
  const { showConfirm, showInfo } = useToast();

  const expiringPolicies = policies.filter((p) => p.status === "por_vencer").length;
  const openTickets = tickets.filter((t) => t.status === "abierto" || t.status === "en_progreso").length;

  const handleLogout = () => {
    showConfirm(
      "¿Cerrar Sesión?",
      `¿Estás seguro de que deseas salir del panel de INNTEL CORP (${currentUser.displayName})?`,
      () => {
        logout();
        showInfo("Sesión Cerrada", "Has salido del sistema de manera segura.");
      },
      "Cerrar Sesión"
    );
  };

  const isSuper = currentUser.role === "superadmin";

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 min-h-screen select-none">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-gradient-to-r from-white via-slate-50 to-white">
        <div className="w-11 h-11 relative flex-shrink-0 bg-white rounded-xl p-1 shadow-sm border border-slate-100 flex items-center justify-center overflow-hidden">
          <Image
            src="/logo-inntel.webp"
            alt="Logo INNTEL CORP"
            width={40}
            height={40}
            className="object-contain"
            priority
          />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="font-bold text-slate-900 text-sm tracking-tight truncate flex items-center gap-1.5">
            INNTEL CORP
            <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-100"></span>
          </span>
          <span className="text-[11px] font-medium text-sky-700 uppercase tracking-wider">
            ISP Telecom & Operaciones
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Módulos Principales
        </div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                isActive
                  ? "bg-sky-50 text-sky-700 shadow-sm border border-sky-100 font-bold"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon
                  className={`w-4 h-4 transition-colors ${
                    isActive ? "text-sky-600" : "text-slate-400 group-hover:text-slate-600"
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </div>

              <div className="flex items-center gap-1.5">
                {item.href === "/arcotel" && expiringPolicies > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                    {expiringPolicies}
                  </span>
                )}
                {item.href === "/tickets" && openTickets > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-sky-100 text-sky-800 border border-sky-200">
                    {openTickets}
                  </span>
                )}
                {item.badge && item.href !== "/arcotel" && item.href !== "/tickets" && (
                  <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold rounded bg-slate-100 text-slate-500 group-hover:bg-slate-200/80">
                    {item.badge}
                  </span>
                )}
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-sky-600" />}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* User Profile Footer */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/70">
        <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-8 h-8 rounded-lg text-white font-bold text-xs flex items-center justify-center shadow-xs flex-shrink-0 ${
                isSuper
                  ? "bg-gradient-to-br from-amber-500 to-amber-700 ring-2 ring-amber-200"
                  : "bg-gradient-to-br from-sky-600 to-purple-600"
              }`}
            >
              {isSuper ? <Crown className="w-4 h-4" /> : currentUser.displayName.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">{currentUser.displayName}</p>
              <span
                className={`inline-block px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider rounded ${
                  isSuper
                    ? "bg-amber-100 text-amber-900 border border-amber-300"
                    : "bg-sky-100 text-sky-800"
                }`}
              >
                {isSuper ? "Super Admin" : currentUser.role}
              </span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
