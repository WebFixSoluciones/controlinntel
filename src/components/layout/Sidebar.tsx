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
  Landmark,
  Wrench,
  Ticket as TicketIcon,
  Banknote,
  Receipt,
  ShoppingCart,
  FileText,
  BarChart3,
  Bot,
  Settings,
  LogOut,
  Building2,
} from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();
  const { currentUser, policies, tickets, logout, setIsSearchOpen } = useApp();
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

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/clientes", label: "Clientes", icon: Users },
    { href: "/arcotel", label: "ARCOTEL", icon: Landmark, badge: expiringPolicies > 0 ? expiringPolicies : undefined, badgeColor: "bg-amber-100 text-amber-800" },
    { href: "/red", label: "Técnica", icon: Wrench },
    { href: "/tickets", label: "Tickets", icon: TicketIcon, badge: openTickets > 0 ? openTickets : undefined, badgeColor: "bg-blue-100 text-blue-800" },
    { href: "/finanzas", label: "Finanzas", icon: Banknote },
    { href: "/finanzas", label: "Gastos", icon: Receipt },
    { href: "/finanzas", label: "Pedidos", icon: ShoppingCart },
    { href: "/plantillas", label: "Plantillas", icon: FileText },
    { href: "/", label: "Reportes", icon: BarChart3 },
    { href: "/boveda", label: "IA & Bóveda", icon: Bot },
  ];

  return (
    <aside className="w-[260px] bg-white border-r border-[#e2e8f0] flex flex-col flex-shrink-0 min-h-screen select-none z-20">
      {/* Brand Header */}
      <div className="h-16 px-5 border-b border-[#e2e8f0] flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#2563eb] text-white flex items-center justify-center shadow-xs flex-shrink-0">
          <Building2 className="w-5 h-5" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="font-bold text-[#004ac6] text-sm tracking-tight truncate uppercase">
            INNTEL CORP
          </span>
          <span className="text-[11px] text-[#737686] font-medium leading-none mt-0.5">
            SaaS ERP System
          </span>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item, idx) => {
          const Icon = item.icon;
          // Determine if active: for duplicates like /finanzas, only highlight the first exact or matching label
          const isActive =
            item.href === "/"
              ? pathname === "/" && item.label === "Dashboard"
              : item.href === "/finanzas"
              ? pathname === "/finanzas" && item.label === "Finanzas"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={`${item.label}-${idx}`}
              href={item.href}
              className={`flex items-center justify-between px-5 py-2.5 text-xs transition-all ${
                isActive
                  ? "bg-[#eff4ff] text-[#004ac6] font-semibold border-l-4 border-[#004ac6] rounded-r-xl"
                  : "text-[#434655] hover:bg-[#eff4ff] hover:text-[#004ac6] font-medium border-l-4 border-transparent"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Icon
                  className={`w-4 h-4 transition-colors ${
                    isActive ? "text-[#004ac6]" : "text-[#737686]"
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </div>

              {item.badge && (
                <span
                  className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${item.badgeColor}`}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Configuration & User */}
      <div className="p-3 border-t border-[#e2e8f0] space-y-2">
        <button
          onClick={() => setIsSearchOpen(true)}
          className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-[#434655] hover:bg-[#eff4ff] hover:text-[#004ac6] rounded-xl transition-all cursor-pointer"
        >
          <Settings className="w-4 h-4 text-[#737686]" />
          <span>Configuración</span>
        </button>

        {/* User Card */}
        <div className="flex items-center justify-between p-2 rounded-xl bg-[#f8f9ff] border border-[#e2e8f0]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-[#004ac6] text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
              {currentUser.displayName.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#0b1c30] truncate">{currentUser.displayName}</p>
              <span className="text-[10px] text-[#737686] font-medium block truncate">
                {currentUser.role.toUpperCase()}
              </span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="p-1.5 rounded-lg text-[#737686] hover:text-[#ef4444] hover:bg-red-50 transition-colors cursor-pointer"
            title="Cerrar sesión"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
