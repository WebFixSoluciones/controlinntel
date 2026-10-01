"use client";

import React, { Suspense, useState, useRef, useEffect } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import {
  Search,
  Bell,
  HelpCircle,
  RotateCcw,
  User,
  Settings,
  LogOut,
  ChevronDown,
  Shield,
} from "lucide-react";
import { ProfileModal } from "./ProfileModal";

function getPageTitle(pathname: string, subParam: string | null): string {
  if (pathname === "/") return "Dashboard";
  if (pathname === "/abonados" || pathname === "/clientes") return "Clientes";

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
        return "Historial de Ventas";
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const subParam = searchParams.get("sub");
  const pageTitle = getPageTitle(pathname, subParam);

  const { currentUser, policies, tickets, setIsSearchOpen, resetDataToDefaults, logout } = useApp();
  const { showConfirm, showInfo, showSuccess } = useToast();

  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
    }
    if (isProfileDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isProfileDropdownOpen]);

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

        {/* User Profile Pill Avatar & Interactive Dropdown */}
        <div className="relative pl-2 border-l border-[#e2e8f0]" ref={dropdownRef}>
          <button
            onClick={() => setIsProfileDropdownOpen((prev) => !prev)}
            className="flex items-center gap-2 p-1 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer group"
            title="Opciones de cuenta y perfil"
          >
            <div className="w-8 h-8 rounded-full bg-[#004ac6] group-hover:bg-[#003ca3] text-white font-bold text-xs flex items-center justify-center shadow-xs transition-colors">
              {currentUser.displayName.charAt(0).toUpperCase()}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-bold text-[#0b1c30] leading-tight truncate">{currentUser.displayName}</p>
              <p className="text-[10px] text-[#737686] leading-none capitalize">{currentUser.role}</p>
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-transform ${
                isProfileDropdownOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* Profile Dropdown Menu */}
          {isProfileDropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              {/* User Identity Header */}
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
                <div className="w-10 h-10 rounded-full bg-[#004ac6] text-white font-bold text-sm flex items-center justify-center shadow-xs shrink-0">
                  {currentUser.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-900 truncate">{currentUser.displayName}</p>
                  <p className="text-[11px] text-slate-500 truncate">{currentUser.email}</p>
                  <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#eff4ff] text-[#004ac6] capitalize">
                    <Shield className="w-2.5 h-2.5" />
                    {currentUser.role}
                  </span>
                </div>
              </div>

              {/* Menu Links */}
              <div className="py-1">
                <button
                  onClick={() => {
                    setIsProfileDropdownOpen(false);
                    setIsProfileModalOpen(true);
                  }}
                  className="w-full px-4 py-2.5 text-left text-xs text-slate-700 hover:bg-slate-50 hover:text-[#004ac6] flex items-center gap-3 transition cursor-pointer group"
                >
                  <div className="w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-[#eff4ff] group-hover:text-[#004ac6] text-slate-500 flex items-center justify-center transition">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-semibold block text-slate-800 group-hover:text-[#004ac6]">Mi Perfil</span>
                    <span className="text-[10px] text-slate-400 block">Editar datos y teléfono</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setIsProfileDropdownOpen(false);
                    router.push("/configuracion");
                  }}
                  className="w-full px-4 py-2.5 text-left text-xs text-slate-700 hover:bg-slate-50 hover:text-[#004ac6] flex items-center gap-3 transition cursor-pointer group"
                >
                  <div className="w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-[#eff4ff] group-hover:text-[#004ac6] text-slate-500 flex items-center justify-center transition">
                    <Settings className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-semibold block text-slate-800 group-hover:text-[#004ac6]">Configuración</span>
                    <span className="text-[10px] text-slate-400 block">Parámetros del sistema y SRI</span>
                  </div>
                </button>
              </div>

              {/* Logout Option */}
              <div className="border-t border-slate-100 pt-1 mt-1">
                <button
                  onClick={() => {
                    setIsProfileDropdownOpen(false);
                    showConfirm(
                      "Cerrar Sesión",
                      "¿Estás seguro de que deseas salir del sistema?",
                      async () => {
                        await logout();
                        showSuccess("Sesión Finalizada", "Has salido del sistema de forma segura.");
                      },
                      "Cerrar Sesión"
                    );
                  }}
                  className="w-full px-4 py-2 text-left text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-3 transition cursor-pointer group"
                >
                  <div className="w-7 h-7 rounded-lg bg-rose-50 group-hover:bg-rose-100 text-rose-600 flex items-center justify-center transition">
                    <LogOut className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold block text-rose-600">Cerrar Sesión</span>
                    <span className="text-[10px] text-rose-400 block">Finalizar sesión actual</span>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Profile Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
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
