"use client";

import React, { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { Search, Bell, HelpCircle, RotateCcw } from "lucide-react";

function getPageTitle(pathname: string, subParam: string | null): string {
  if (pathname === "/") return "Dashboard";
  if (pathname === "/abonados" || pathname === "/clientes") return "Abonados";

  if (pathname === "/compras") {
    switch (subParam) {
      case "registrar_compra":
        return "Registrar Compra";
      case "notas_credito":
        return "Notas de Crédito Recibidas";
      case "notas_debito":
        return "Notas de Débito Recibidas";
      case "retenciones":
        return "Retenciones de Compras";
      default:
        return "Historial de Compras";
    }
  }

  if (pathname === "/facturacion") {
    switch (subParam) {
      case "nueva_venta":
        return "Registrar Venta";
      case "cotizaciones":
        return "Cotizaciones";
      case "notas_credito":
        return "Notas de Crédito";
      case "retenciones":
        return "Retenciones de Venta";
      case "guias_remision":
        return "Guías de Remisión";
      default:
        return "Facturas Emitidas";
    }
  }

  if (pathname === "/finanzas") {
    switch (subParam) {
      case "bancos":
        return "Bancos & Cajas";
      case "cuentas_por_cobrar":
        return "Cuentas por Cobrar";
      case "cuentas_por_pagar":
        return "Cuentas por Pagar";
      case "reportes":
        return "Reportes Financieros";
      default:
        return "Movimientos de Tesorería";
    }
  }

  if (pathname === "/inventarios") {
    switch (subParam) {
      case "servicios":
        return "Servicios";
      case "categorias":
      case "clasificacion":
        return "Categorías";
      case "kardex":
        return "Kardex";
      case "transferencias":
        return "Transferencias";
      case "bodegas":
      case "bodega":
        return "Bodega";
      case "ajustes":
        return "Ajustes";
      default:
        return "Productos";
    }
  }

  if (pathname === "/personas") {
    switch (subParam) {
      case "usuarios_equipo":
        return "Usuarios / Equipo";
      default:
        return "Proveedores";
    }
  }

  if (pathname === "/configuracion") {
    switch (subParam) {
      case "sri":
        return "Configuración SRI";
      case "planes":
        return "Planes de Servicio";
      default:
        return "Configuración General";
    }
  }

  if (pathname === "/proyectos") return "Proyectos";
  if (pathname === "/tickets") return "Soporte";
  if (pathname === "/arcotel") return "ARCOTEL";
  if (pathname === "/boveda") return "Credenciales";
  if (pathname === "/plantillas") return "Plantillas";

  return "INNTEL CORP";
}

function HeaderContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const subParam = searchParams.get("sub");
  const pageTitle = getPageTitle(pathname, subParam);

  const { currentUser, policies, tickets, setIsSearchOpen, resetDataToDefaults } = useApp();
  const { showConfirm, showInfo, showSuccess } = useToast();

  const urgentCount = policies.filter((p) => p.status === "por_vencer").length;
  const criticalTickets = tickets.filter((t) => t.priority === "alta" || t.priority === "critica").length;

  return (
    <header className="h-16 bg-white border-b border-[#e2e8f0] px-8 flex items-center justify-between sticky top-0 z-30 select-none">
      {/* Minimalist Top Module / Submodule Title */}
      <div className="flex items-center gap-3 min-w-0">
        <h1 className="text-base font-bold text-[#0b1c30] tracking-tight truncate">
          {pageTitle}
        </h1>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2">
        {/* Search Icon Button (directly to the left of Notifications) */}
        <button
          onClick={() => setIsSearchOpen(true)}
          className="p-2 rounded-lg text-[#434655] hover:text-[#004ac6] hover:bg-[#eff4ff] transition-all cursor-pointer"
          title="Buscar en todo el sistema (Ctrl + K)"
        >
          <Search className="w-4 h-4" />
        </button>

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
          onClick={() =>
            showInfo(
              "Centro de Ayuda INNTEL CORP",
              "Plataforma Integral de Gestión Operativa, ISP y Facturación Electrónica SRI. Para soporte o incidencias contacta a soporte@inntelcorp.com."
            )
          }
          className="p-2 rounded-lg text-[#434655] hover:text-[#004ac6] hover:bg-[#eff4ff] transition-all cursor-pointer"
          title="Ayuda y Documentación"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* Reset Data */}
        <button
          onClick={() => {
            showConfirm(
              "Reiniciar Base de Datos",
              "¿Deseas restaurar todos los registros de prueba a los valores predeterminados del sistema?",
              () => {
                resetDataToDefaults();
                showSuccess("Sistema Restaurado", "Los datos operativos fueron restaurados correctamente.");
              },
              "Restaurar Datos"
            );
          }}
          className="p-2 rounded-lg text-[#737686] hover:text-[#ef4444] hover:bg-red-50 transition-all cursor-pointer"
          title="Reiniciar datos del sistema"
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
            <p className="text-[10px] text-[#737686] leading-none capitalize">{currentUser.role}</p>
          </div>
        </div>
      </div>
    </header>
  );
}

export function Header() {
  return (
    <Suspense fallback={<header className="h-16 bg-white border-b border-[#e2e8f0] px-8 flex items-center justify-between" />}>
      <HeaderContent />
    </Suspense>
  );
}
