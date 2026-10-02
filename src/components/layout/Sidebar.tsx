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
  ClipboardList,
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
  {
    href: "/clientes",
    label: "Clientes",
    icon: Users,
    moduleKey: "abonados",
    submodules: [
      { key: "listado", label: "Listado de Clientes", href: "/clientes", submoduleKey: "listado" },
    ],
  },
  {
    href: "/facturacion",
    label: "Ventas",
    icon: Receipt,
    moduleKey: "facturacion",
    submodules: [
      { key: "facturas", label: "Historial de Ventas", href: "/facturacion?sub=facturas", submoduleKey: "facturas" },
      { key: "nueva_venta", label: "Registrar Venta", href: "/facturacion?sub=nueva_venta", submoduleKey: "facturas" },
      { key: "cotizaciones", label: "Cotizaciones", href: "/facturacion?sub=cotizaciones", submoduleKey: "cotizaciones" },
      { key: "notas_credito", label: "Notas de Crédito", href: "/facturacion?sub=notas_credito", submoduleKey: "notas_credito" },
      { key: "retenciones", label: "Retenciones de Venta", href: "/facturacion?sub=retenciones", submoduleKey: "retenciones" },
      { key: "guias_remision", label: "Guías de Remisión", href: "/facturacion?sub=guias_remision", submoduleKey: "guias_remision" },
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
      { key: "productos", label: "Productos", href: "/inventarios?sub=productos", submoduleKey: "productos" },
      { key: "servicios", label: "Servicios", href: "/inventarios?sub=servicios", submoduleKey: "servicios" },
      { key: "categorias", label: "Categorías", href: "/inventarios?sub=categorias", submoduleKey: "categorias" },
      { key: "kardex", label: "Kardex", href: "/inventarios?sub=kardex", submoduleKey: "kardex" },
      { key: "transferencias", label: "Transferencias", href: "/inventarios?sub=transferencias", submoduleKey: "transferencias" },
      { key: "bodegas", label: "Bodega", href: "/inventarios?sub=bodegas", submoduleKey: "bodegas" },
      { key: "ajustes", label: "Ajustes", href: "/inventarios?sub=ajustes", submoduleKey: "ajustes" },
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
  {
    href: "/configuracion",
    label: "Configuración",
    icon: Settings,
    moduleKey: "configuracion",
    submodules: [
      { key: "general", label: "General", href: "/configuracion?sub=general", submoduleKey: "general" },
      { key: "sri", label: "Configuración SRI", href: "/configuracion?sub=sri", submoduleKey: "sri" },
    ],
  },
];

function SidebarContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeSubParam = searchParams.get("sub");

  const {
    currentUser,
    logout,
  } = useApp();
  const { showConfirm, showInfo } = useToast();

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
            pathname === item.href ||
            (item.href === "/clientes" && pathname === "/abonados") ||
            (item.href === "/abonados" && pathname === "/clientes");

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
                    if (item.href === "/clientes" || item.href === "/abonados") {
                      window.dispatchEvent(new CustomEvent("inntel:reset-client-selection"));
                      router.push("/clientes");
                    } else if (!isCurrentRoute && accessibleSubmodules[0]) {
                      router.push(accessibleSubmodules[0].href);
                    }
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer group border-l-4 ${
                    isCurrentRoute
                      ? "bg-[#eff4ff] text-[#004ac6] font-bold border-[#004ac6] shadow-2xs"
                      : "border-transparent text-[#434655] hover:bg-[#f8f9ff] hover:text-[#004ac6]"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`w-4 h-4 transition-colors ${
                        isCurrentRoute ? "text-[#004ac6]" : "text-[#737686] group-hover:text-[#004ac6]"
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>

                  <div className="flex items-center">
                    {isOpen ? (
                      <ChevronUp
                        className={`w-3.5 h-3.5 transition-colors ${
                          isCurrentRoute ? "text-[#004ac6]" : "text-[#737686] group-hover:text-[#004ac6]"
                        }`}
                      />
                    ) : (
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-colors ${
                          isCurrentRoute ? "text-[#004ac6]" : "text-[#737686] group-hover:text-[#004ac6]"
                        }`}
                      />
                    )}
                  </div>
                </button>
              ) : (
                // Single Module Link (No Submodules)
                <Link
                  href={item.href}
                  onClick={() => {
                    if (item.href === "/clientes" || item.href === "/abonados") {
                      window.dispatchEvent(new CustomEvent("inntel:reset-client-selection"));
                    }
                  }}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group border-l-4 ${
                    isCurrentRoute
                      ? "bg-[#eff4ff] text-[#004ac6] font-bold border-[#004ac6] shadow-2xs"
                      : "border-transparent text-[#434655] hover:bg-[#f8f9ff] hover:text-[#004ac6]"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`w-4 h-4 transition-colors ${
                        isCurrentRoute ? "text-[#004ac6]" : "text-[#737686] group-hover:text-[#004ac6]"
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
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
                        onClick={() => {
                          if (sub.href === "/clientes" || sub.href.startsWith("/clientes") || sub.href.startsWith("/abonados")) {
                            window.dispatchEvent(new CustomEvent("inntel:reset-client-selection"));
                          }
                        }}
                        className={`block px-3 py-1.5 rounded-lg text-xs transition-all ${
                          isSubActive
                            ? "bg-[#eff4ff] text-[#004ac6] font-bold shadow-2xs border-l-2 border-[#004ac6]"
                            : "text-[#434655] hover:text-[#004ac6] hover:bg-[#f8f9ff]"
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
