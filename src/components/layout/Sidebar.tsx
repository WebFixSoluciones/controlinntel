"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useApp } from "@/lib/state";
import { canAccessRoute, canAccessSubmodule } from "@/lib/permissions";
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
  LogOut,
  Settings,
  Contact2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { UserModulePermissions } from "@/types";

interface NavSubItem {
  key: string;
  label: string;
  href: string;
  submoduleKey: string;
}

interface NavItem {
  href: string;
  label: string;
  icon: any;
  moduleKey?: keyof UserModulePermissions;
  submodules?: NavSubItem[];
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/abonados", label: "Abonados", icon: Users },
  {
    href: "/facturacion",
    label: "Facturación SRI",
    icon: Receipt,
    moduleKey: "facturacion",
    submodules: [
      { key: "facturas", label: "Facturas Emitidas", href: "/facturacion?sub=facturas", submoduleKey: "facturas" },
      { key: "nueva_venta", label: "Registrar Venta", href: "/facturacion?sub=nueva_venta", submoduleKey: "facturas" },
      { key: "cotizaciones", label: "Cotizaciones", href: "/facturacion?sub=cotizaciones", submoduleKey: "cotizaciones" },
      { key: "notas_credito", label: "Notas de Crédito", href: "/facturacion?sub=notas_credito", submoduleKey: "notas_credito" },
      { key: "retenciones", label: "Retenciones de Venta", href: "/facturacion?sub=retenciones", submoduleKey: "retenciones" },
      { key: "guias_remision", label: "Guías de Remisión", href: "/facturacion?sub=guias_remision", submoduleKey: "guias_remision" },
      { key: "configuracion_sri", label: "Configuración SRI", href: "/facturacion?sub=configuracion_sri", submoduleKey: "configuracion_sri" },
    ],
  },
  {
    href: "/compras",
    label: "Compras",
    icon: ShoppingBag,
    moduleKey: "compras",
    submodules: [
      { key: "historial_compras", label: "Historial de Compras", href: "/compras?sub=historial_compras", submoduleKey: "historial_compras" },
      { key: "registrar_compra", label: "Registrar Compra", href: "/compras?sub=registrar_compra", submoduleKey: "registrar_compra" },
      { key: "notas_credito", label: "Notas de Crédito Recibidas", href: "/compras?sub=notas_credito", submoduleKey: "notas_credito" },
      { key: "notas_debito", label: "Notas de Débito Recibidas", href: "/compras?sub=notas_debito", submoduleKey: "notas_debito" },
      { key: "retenciones", label: "Retenciones de Compras", href: "/compras?sub=retenciones", submoduleKey: "retenciones" },
    ],
  },
  {
    href: "/inventarios",
    label: "Inventarios",
    icon: Boxes,
    moduleKey: "inventarios",
    submodules: [
      { key: "productos", label: "Productos & Materiales", href: "/inventarios?sub=productos", submoduleKey: "productos" },
      { key: "bodegas", label: "Bodegas & Almacenes", href: "/inventarios?sub=bodegas", submoduleKey: "bodegas" },
      { key: "kardex", label: "Kardex & Movimientos", href: "/inventarios?sub=kardex", submoduleKey: "kardex" },
      { key: "transferencias", label: "Transferencias Internas", href: "/inventarios?sub=transferencias", submoduleKey: "transferencias" },
      { key: "ajustes", label: "Ajustes de Inventario", href: "/inventarios?sub=ajustes", submoduleKey: "ajustes" },
    ],
  },
  {
    href: "/finanzas",
    label: "Finanzas",
    icon: DollarSign,
    moduleKey: "finanzas",
    submodules: [
      { key: "movimientos", label: "Movimientos", href: "/finanzas?sub=movimientos", submoduleKey: "movimientos" },
      { key: "bancos", label: "Bancos", href: "/finanzas?sub=bancos", submoduleKey: "bancos" },
      { key: "cuentas_por_cobrar", label: "Cuentas por Cobrar", href: "/finanzas?sub=cuentas_por_cobrar", submoduleKey: "cuentas_por_cobrar" },
      { key: "cuentas_por_pagar", label: "Cuentas por Pagar", href: "/finanzas?sub=cuentas_por_pagar", submoduleKey: "cuentas_por_pagar" },
      { key: "reportes", label: "Reportes", href: "/finanzas?sub=reportes", submoduleKey: "reportes" },
    ],
  },
  { href: "/proyectos", label: "Proyectos", icon: Kanban },
  { href: "/tickets", label: "Soporte", icon: TicketIcon },
  { href: "/arcotel", label: "ARCOTEL", icon: ShieldCheck },
  { href: "/boveda", label: "Credenciales", icon: KeyRound },
  { href: "/plantillas", label: "Plantillas", icon: FileText },
  {
    href: "/personas",
    label: "Personas",
    icon: Contact2,
    moduleKey: "personas",
    submodules: [
      { key: "proveedores", label: "Proveedores", href: "/personas?sub=proveedores", submoduleKey: "proveedores" },
      { key: "usuarios_equipo", label: "Usuarios / Equipo", href: "/personas?sub=usuarios_equipo", submoduleKey: "usuarios_equipo" },
    ],
  },
  { href: "/configuracion", label: "Configuración", icon: Settings },
];

function SidebarContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeSubParam = searchParams.get("sub");

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

  // Manage open accordions
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    NAV_ITEMS.forEach((item) => {
      if (item.submodules && (pathname === item.href || pathname.startsWith(item.href + "/"))) {
        initial[item.href] = true;
      }
    });
    return initial;
  });

  // Keep accordion open when navigating to a route
  useEffect(() => {
    NAV_ITEMS.forEach((item) => {
      if (item.submodules && (pathname === item.href || pathname.startsWith(item.href + "/"))) {
        setOpenAccordions((prev) => ({ ...prev, [item.href]: true }));
      }
    });
  }, [pathname]);

  const toggleAccordion = (href: string) => {
    setOpenAccordions((prev) => ({ ...prev, [href]: !prev[href] }));
  };

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
          const isCurrentRoute =
            pathname === item.href || (item.href === "/abonados" && pathname === "/clientes");

          // Filter accessible submodules
          const accessibleSubmodules = item.submodules
            ? item.submodules.filter((sub) =>
                item.moduleKey ? canAccessSubmodule(currentUser, item.moduleKey, sub.submoduleKey) : true
              )
            : undefined;

          // If module has submodules defined, but user has access to none, hide module
          if (item.submodules && (!accessibleSubmodules || accessibleSubmodules.length === 0)) {
            return null;
          }

          const hasSubmodules = accessibleSubmodules && accessibleSubmodules.length > 0;
          const isOpen = !!openAccordions[item.href];

          return (
            <div key={item.href} className="space-y-0.5">
              {hasSubmodules ? (
                // Accordion Header with Toggle
                <button
                  type="button"
                  onClick={() => {
                    toggleAccordion(item.href);
                    if (!isCurrentRoute && accessibleSubmodules[0]) {
                      router.push(accessibleSubmodules[0].href);
                    }
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer group ${
                    isCurrentRoute
                      ? "bg-[#bbf7d0] text-[#064e3b] font-bold border-r-4 border-[#059669] shadow-2xs"
                      : "text-[#334155] hover:bg-[#f8f9ff] hover:text-[#0b1c30]"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`w-4 h-4 transition-colors ${
                        isCurrentRoute ? "text-[#064e3b]" : "text-[#64748b] group-hover:text-[#0b1c30]"
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {item.href === "/compras" && pendingPurchases > 0 && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[#fffbeb] text-[#b45309] border border-[#fde68a]">
                        {pendingPurchases}
                      </span>
                    )}
                    {item.href === "/facturacion" && pendingQuotes > 0 && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[#fef3c7] text-[#b45309] border border-[#fde68a]">
                        {pendingQuotes}
                      </span>
                    )}
                    {isOpen ? (
                      <ChevronUp className="w-3.5 h-3.5 text-current opacity-70" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-[#64748b] opacity-70" />
                    )}
                  </div>
                </button>
              ) : (
                // Single Module Link (No Submodules)
                <Link
                  href={item.href}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                    isCurrentRoute
                      ? "bg-[#bbf7d0] text-[#064e3b] font-bold border-r-4 border-[#059669] shadow-2xs"
                      : "text-[#334155] hover:bg-[#f8f9ff] hover:text-[#0b1c30]"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`w-4 h-4 transition-colors ${
                        isCurrentRoute ? "text-[#064e3b]" : "text-[#64748b] group-hover:text-[#0b1c30]"
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
                  </div>
                </Link>
              )}

              {/* Submodules Accordion Menu with Connecting Left Guide Line */}
              {hasSubmodules && isOpen && (
                <div className="border-l-2 border-[#cbd5e1] ml-6 pl-2.5 my-1 space-y-1 animate-in fade-in duration-150">
                  {accessibleSubmodules.map((sub) => {
                    const isSubActive =
                      isCurrentRoute &&
                      (activeSubParam === sub.key || (!activeSubParam && sub.key === accessibleSubmodules[0]?.key));

                    return (
                      <Link
                        key={sub.key}
                        href={sub.href}
                        className={`block px-3 py-1.5 rounded-xl text-xs transition-all ${
                          isSubActive
                            ? "bg-[#bbf7d0] text-[#064e3b] font-bold shadow-2xs"
                            : "text-[#334155] hover:text-[#0b1c30] hover:bg-[#f1f5f9]"
                        }`}
                      >
                        {sub.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
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

export function Sidebar() {
  return (
    <Suspense fallback={<aside className="w-64 bg-white border-r border-[#e2e8f0] min-h-screen" />}>
      <SidebarContent />
    </Suspense>
  );
}
