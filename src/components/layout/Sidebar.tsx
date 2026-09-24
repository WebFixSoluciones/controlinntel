"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useApp } from "@/lib/state";
import { can, routePermissions } from "@/lib/permissions";
import { useToast } from "@/lib/toast-context";
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  KeyRound,
  Radio,
  Kanban,
  Ticket as TicketIcon,
  DollarSign,
  FileText,
  ChevronRight,
  LogOut,
  Settings,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/arcotel", label: "ARCOTEL", icon: ShieldCheck },
  { href: "/boveda", label: "Credenciales", icon: KeyRound },
  { href: "/red", label: "Nodos", icon: Radio },
  { href: "/proyectos", label: "Proyectos", icon: Kanban },
  { href: "/tickets", label: "Soporte", icon: TicketIcon },
  { href: "/finanzas", label: "Finanzas", icon: DollarSign },
  { href: "/plantillas", label: "Plantillas", icon: FileText },
  { href: "/configuracion", label: "Configuración", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { currentUser, clientContracts, tickets, clientProjects, logout } = useApp();
  const { showConfirm, showInfo } = useToast();

  const expiringPolicies = clientContracts.filter((p) => p.status === "por_renovar").length;
  const openTickets = tickets.filter((t) => t.status === "abierto" || t.status === "en_progreso").length;
  const activeProjects = clientProjects.filter((p) => p.column !== "completado" && p.column !== "finalizado").length;

  const handleLogout = () => {
    showConfirm(
      "¿Cerrar Sesión?",
      `¿Estás seguro de que deseas salir del panel (${currentUser.displayName})?`,
      () => {
        logout();
        showInfo("Sesión Cerrada", "Has salido del sistema de manera segura.");
      },
      "Cerrar Sesión"
    );
  };

  return (
    <aside className="w-64 bg-white border-r border-[#e2e8f0] flex flex-col shrink-0 min-h-screen select-none">
      {/* Brand Header: Logo Only */}
      <div className="h-16 border-b border-[#e2e8f0] flex items-center justify-center px-4 bg-white">
        <Link href="/" className="flex items-center justify-center">
          <Image
            src="/logo-inntel.webp"
            alt="INNTEL CORP"
            width={120}
            height={44}
            className="h-9 w-auto object-contain"
            priority
          />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#737686]">
          Módulos
        </div>
        {NAV_ITEMS.filter(item => !routePermissions[item.href] || can(currentUser, routePermissions[item.href])).map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-all group ${
                isActive
                  ? "bg-[#eff4ff] text-[#004ac6] border-l-4 border-[#004ac6] font-bold shadow-2xs"
                  : "text-[#434655] hover:bg-[#f8f9ff] hover:text-[#0b1c30]"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon
                  className={`w-4 h-4 transition-colors ${
                    isActive ? "text-[#004ac6]" : "text-[#737686] group-hover:text-[#0b1c30]"
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </div>

              <div className="flex items-center gap-1.5">
                {item.href === "/arcotel" && expiringPolicies > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[#fffbeb] text-[#92400e] border border-[#fde68a] animate-pulse">
                    {expiringPolicies}
                  </span>
                )}
                {item.href === "/proyectos" && activeProjects > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[#e0e7ff] text-[#3730a3] border border-[#c7d2fe]">
                    {activeProjects}
                  </span>
                )}
                {item.href === "/tickets" && openTickets > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[#eff4ff] text-[#004ac6] border border-[#dce9ff]">
                    {openTickets}
                  </span>
                )}
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-[#004ac6]" />}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Logout Footer */}
      <div className="p-3 border-t border-[#e2e8f0] bg-[#f8f9ff]">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white hover:bg-rose-50 border border-[#cbd5e1] text-[#434655] hover:text-[#ef4444] hover:border-rose-200 text-xs font-bold transition-all shadow-2xs cursor-pointer group"
        >
          <LogOut className="w-4 h-4 text-[#737686] group-hover:text-[#ef4444] transition-colors" />
          <span>Cerrar Sesión</span>
        </button>
        <a
          href="https://www.inntelcorp.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-[10px] text-[#737686] hover:text-[#004ac6] mt-2 font-medium transition-colors"
        >
          www.inntelcorp.com
        </a>
      </div>
    </aside>
  );
}
