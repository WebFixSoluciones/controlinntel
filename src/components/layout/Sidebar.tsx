"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useApp } from "@/lib/state";
import { canAccessRoute } from "@/lib/permissions";
import { useToast } from "@/lib/toast-context";
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  KeyRound,
  Kanban,
  Boxes,
  Receipt,
  ShoppingBag,
  Ticket as TicketIcon,
  DollarSign,
  FileText,
  ChevronRight,
  LogOut,
  Settings,
  Contact2,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/abonados", label: "Abonados", icon: Users },
  { href: "/facturacion", label: "Facturación SRI", icon: Receipt },
  { href: "/compras", label: "Compras", icon: ShoppingBag },
  { href: "/inventarios", label: "Inventarios", icon: Boxes },
  { href: "/finanzas", label: "Finanzas", icon: DollarSign },
  { href: "/proyectos", label: "Proyectos", icon: Kanban },
  { href: "/tickets", label: "Soporte", icon: TicketIcon },
  { href: "/arcotel", label: "ARCOTEL", icon: ShieldCheck },
  { href: "/boveda", label: "Credenciales", icon: KeyRound },
  { href: "/plantillas", label: "Plantillas", icon: FileText },
  { href: "/personas", label: "Personas", icon: Contact2 },
  { href: "/configuracion", label: "Configuración", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const {
    currentUser,
    clientContracts,
    tickets,
    clientProjects,
    inventoryProducts,
    billingQuotes,
    purchaseInvoices,
    logout,
  } = useApp();
  const { showConfirm, showInfo } = useToast();

  const expiringPolicies = clientContracts.filter((p) => p.status === "por_renovar").length;
  const openTickets = tickets.filter((t) => t.status === "abierto" || t.status === "en_progreso").length;
  const activeProjects = clientProjects.filter((p) => p.column !== "completado" && p.column !== "finalizado").length;
  const lowStockItems = inventoryProducts.filter((p) => p.tracksStock && p.status === "activo" && p.stock <= p.minStock).length;
  const pendingQuotes = billingQuotes.filter((q) => q.status === "enviada" || q.status === "aprobada").length;
  const pendingPurchases = purchaseInvoices.filter((i) => i.paymentStatus === "pendiente" || i.paymentStatus === "abono_parcial").length;

  const handleLogout = () => {
    showConfirm(
      "¿Cerrar Sesión?",
      `¿Estás seguro de que deseas salir del panel (${currentUser.displayName})?`,
      () => {
        logout();
        showInfo("Sesión Cerrada", "Has salido del sistema de manera segura.");
      }
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
        {NAV_ITEMS.filter((item) => canAccessRoute(currentUser, item.href)).map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href === "/abonados" && pathname === "/clientes");

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
                {item.href === "/compras" && pendingPurchases > 0 && (
                  <span
                    className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[#fffbeb] text-[#b45309] border border-[#fde68a]"
                    title={`${pendingPurchases} compras pendientes de pago en CxP`}
                  >
                    {pendingPurchases}
                  </span>
                )}
                {item.href === "/facturacion" && pendingQuotes > 0 && (
                  <span
                    className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[#fef3c7] text-[#b45309] border border-[#fde68a]"
                    title={`${pendingQuotes} cotizaciones pendientes`}
                  >
                    {pendingQuotes}
                  </span>
                )}
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
                {item.href === "/inventarios" && lowStockItems > 0 && (
                  <span
                    className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[#fef3c7] text-[#b45309] border border-[#fde68a]"
                    title={`${lowStockItems} productos con stock bajo`}
                  >
                    {lowStockItems}
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

      {/* User Info & Logout Button */}
      <div className="p-3 border-t border-[#e2e8f0] bg-white">
        <div className="flex items-center justify-between p-2 rounded-xl bg-[#f8f9ff] border border-[#e2e8f0]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#004ac6]/10 text-[#004ac6] font-bold flex items-center justify-center text-xs shrink-0">
              {currentUser.displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#0b1c30] truncate">
                {currentUser.displayName}
              </div>
              <div className="text-[10px] text-[#737686] capitalize truncate">
                {currentUser.role}
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="p-1.5 text-[#737686] hover:text-[#dc2626] hover:bg-[#fef2f2] rounded-lg transition-colors cursor-pointer"
            title="Cerrar Sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
