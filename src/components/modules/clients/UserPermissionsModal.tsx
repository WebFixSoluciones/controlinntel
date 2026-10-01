"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { DEFAULT_MODULE_PERMISSIONS_BY_ROLE } from "@/lib/permissions";
import {
  ShieldCheck,
  Check,
  X,
  ShoppingBag,
  DollarSign,
  Users,
  Receipt,
  Boxes,
  Network,
  Kanban,
  Ticket,
  Lock,
  FileText,
  Contact2,
  Settings,
} from "lucide-react";
import { SystemUser, UserModulePermissions, UserRole } from "@/types";

interface UserPermissionsModalProps {
  user: SystemUser | null;
  isOpen: boolean;
  onClose: () => void;
}

export function UserPermissionsModal({
  user,
  isOpen,
  onClose,
}: UserPermissionsModalProps) {
  const { updateUserModulePermissions, updateSystemUser } = useApp();
  const { showSuccess, showError } = useToast();

  const [role, setRole] = useState<UserRole>(user?.role || "tecnico");
  const [permissions, setPermissions] = useState<UserModulePermissions>(() => {
    if (user?.modulePermissions) return user.modulePermissions;
    return DEFAULT_MODULE_PERMISSIONS_BY_ROLE[user?.role || "tecnico"] || DEFAULT_MODULE_PERMISSIONS_BY_ROLE.tecnico;
  });

  if (!isOpen || !user) return null;

  // Change role and apply recommended defaults
  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    const defaults = DEFAULT_MODULE_PERMISSIONS_BY_ROLE[newRole];
    if (defaults) {
      setPermissions(JSON.parse(JSON.stringify(defaults)));
    }
  };

  // Toggle Module
  const handleToggleModule = (moduleKey: keyof UserModulePermissions) => {
    setPermissions((prev) => {
      const cur = prev[moduleKey];
      const newEnabled = !(cur as any)?.enabled;
      return {
        ...prev,
        [moduleKey]: {
          ...(cur as any),
          enabled: newEnabled,
        },
      };
    });
  };

  // Toggle Submodule
  const handleToggleSubmodule = (
    moduleKey: "compras" | "finanzas" | "personas" | "facturacion" | "inventarios" | "red" | "configuracion",
    submoduleKey: string
  ) => {
    setPermissions((prev) => {
      const mod = prev[moduleKey] as any;
      if (!mod || !mod.submodules) return prev;
      return {
        ...prev,
        [moduleKey]: {
          ...mod,
          submodules: {
            ...mod.submodules,
            [submoduleKey]: !mod.submodules[submoduleKey],
          },
        },
      };
    });
  };

  const handleSave = async () => {
    try {
      if (role !== user.role) {
        await updateSystemUser(user.uid, { role });
      }
      await updateUserModulePermissions(user.uid, permissions);
      showSuccess(
        "Permisos Actualizados",
        `Matriz de acceso para ${user.displayName} guardada exitosamente.`
      );
      onClose();
    } catch (err: any) {
      showError("Error al Guardar", err?.message || "No se pudo actualizar los permisos.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#e2e8f0] w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8f9ff]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#004ac6]/10 text-[#004ac6] rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#0b1c30]">
                Control de Permisos & Roles de Usuario
              </h2>
              <p className="text-xs text-[#737686]">
                {user.displayName} ({user.email}) • {user.department || "INNTEL CORP"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#737686] hover:bg-[#e2e8f0] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Base Role Selector */}
          <div className="p-4 bg-[#eff4ff] border border-[#bfdbfe] rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold text-[#004ac6] uppercase tracking-wider">
                Rol Base del Sistema
              </span>
              <p className="text-xs text-[#434655]">
                Al cambiar el rol se preconfiguran los módulos recomendados para su función.
              </p>
            </div>

            <select
              value={role}
              onChange={(e) => handleRoleChange(e.target.value as UserRole)}
              className="px-3 py-1.5 bg-white border border-[#004ac6]/30 rounded-lg text-xs font-bold text-[#004ac6] focus:outline-hidden"
            >
              <option value="superadmin">Superadmin (Acceso Total)</option>
              <option value="admin">Administrador General</option>
              <option value="finanzas">Finanzas & Contabilidad</option>
              <option value="tecnico">Técnico de Red & NOC</option>
              <option value="soporte">Soporte al Cliente</option>
              <option value="legal">Legal & ARCOTEL</option>
              <option value="consulta">Solo Consulta / Auditor</option>
            </select>
          </div>

          {/* Granular Matrix */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-[#434655] uppercase tracking-wider">
              Matriz Granular de Activación por Módulo y Submódulo
            </h3>

            {/* 1. Módulo Clientes */}
            <div className="p-4 rounded-xl border border-[#e2e8f0] bg-white space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#004ac6]" />
                  <div>
                    <span className="text-xs font-bold text-[#0b1c30]">Módulo Clientes (/clientes)</span>
                    <p className="text-[11px] text-[#737686]">Gestión de clientes, servicios contratados y ficha técnica 360°</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!permissions.abonados?.enabled}
                    onChange={() => handleToggleModule("abonados")}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-[#e2e8f0] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#cbd5e1] after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#004ac6]"></div>
                </label>
              </div>
            </div>

            {/* 2. Módulo Personas */}
            <div className="p-4 rounded-xl border border-[#e2e8f0] bg-white space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Contact2 className="w-4 h-4 text-[#004ac6]" />
                  <div>
                    <span className="text-xs font-bold text-[#0b1c30]">Módulo Personas (/personas)</span>
                    <p className="text-[11px] text-[#737686]">Directorio institucional de terceros y control de usuarios</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!permissions.personas?.enabled}
                    onChange={() => handleToggleModule("personas")}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-[#e2e8f0] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#cbd5e1] after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#004ac6]"></div>
                </label>
              </div>

              {permissions.personas?.enabled && permissions.personas.submodules && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-[#f1f5f9] text-xs">
                  {Object.entries(permissions.personas.submodules).map(([subKey, val]) => (
                    <label
                      key={subKey}
                      className="flex items-center gap-2 p-2 rounded-lg bg-[#f8f9ff] hover:bg-[#eff4ff] cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={val}
                        onChange={() => handleToggleSubmodule("personas", subKey)}
                        className="rounded border-[#cbd5e1] text-[#004ac6] focus:ring-[#004ac6]"
                      />
                      <span className="capitalize text-[#434655] font-medium text-[11px]">
                        {subKey === "proveedores" ? "Proveedores" : subKey === "usuarios_equipo" ? "Usuarios / Equipo" : subKey.replace(/_/g, " ")}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Módulo Compras */}
            <div className="p-4 rounded-xl border border-[#e2e8f0] bg-white space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-[#004ac6]" />
                  <span className="text-xs font-bold text-[#0b1c30]">Módulo Compras (/compras)</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!permissions.compras?.enabled}
                    onChange={() => handleToggleModule("compras")}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-[#e2e8f0] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#cbd5e1] after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#004ac6]"></div>
                </label>
              </div>

              {permissions.compras?.enabled && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-[#f1f5f9] text-xs">
                  {Object.entries(permissions.compras.submodules).map(([subKey, val]) => (
                    <label
                      key={subKey}
                      className="flex items-center gap-2 p-2 rounded-lg bg-[#f8f9ff] hover:bg-[#eff4ff] cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={val}
                        onChange={() => handleToggleSubmodule("compras", subKey)}
                        className="rounded border-[#cbd5e1] text-[#004ac6] focus:ring-[#004ac6]"
                      />
                      <span className="capitalize text-[#434655] font-medium text-[11px]">
                        {subKey.replace(/_/g, " ")}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* 4. Módulo Finanzas */}
            <div className="p-4 rounded-xl border border-[#e2e8f0] bg-white space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-[#004ac6]" />
                  <span className="text-xs font-bold text-[#0b1c30]">Módulo Finanzas (/finanzas)</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!permissions.finanzas?.enabled}
                    onChange={() => handleToggleModule("finanzas")}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-[#e2e8f0] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#cbd5e1] after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#004ac6]"></div>
                </label>
              </div>

              {permissions.finanzas?.enabled && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-[#f1f5f9] text-xs">
                  {Object.entries(permissions.finanzas.submodules).map(([subKey, val]) => (
                    <label
                      key={subKey}
                      className="flex items-center gap-2 p-2 rounded-lg bg-[#f8f9ff] hover:bg-[#eff4ff] cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={val}
                        onChange={() => handleToggleSubmodule("finanzas", subKey)}
                        className="rounded border-[#cbd5e1] text-[#004ac6] focus:ring-[#004ac6]"
                      />
                      <span className="capitalize text-[#434655] font-medium text-[11px]">
                        {subKey.replace(/_/g, " ")}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* 4. Módulo Facturación SRI */}
            <div className="p-4 rounded-xl border border-[#e2e8f0] bg-white space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-[#004ac6]" />
                  <span className="text-xs font-bold text-[#0b1c30]">Facturación SRI (/facturacion)</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!permissions.facturacion?.enabled}
                    onChange={() => handleToggleModule("facturacion")}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-[#e2e8f0] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#cbd5e1] after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#004ac6]"></div>
                </label>
              </div>

              {permissions.facturacion?.enabled && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-[#f1f5f9] text-xs">
                  {Object.entries(permissions.facturacion.submodules).map(([subKey, val]) => (
                    <label
                      key={subKey}
                      className="flex items-center gap-2 p-2 rounded-lg bg-[#f8f9ff] hover:bg-[#eff4ff] cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={val}
                        onChange={() => handleToggleSubmodule("facturacion", subKey)}
                        className="rounded border-[#cbd5e1] text-[#004ac6] focus:ring-[#004ac6]"
                      />
                      <span className="capitalize text-[#434655] font-medium text-[11px]">
                        {subKey.replace(/_/g, " ")}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* 5. Módulo Inventarios */}
            <div className="p-4 rounded-xl border border-[#e2e8f0] bg-white space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-[#004ac6]" />
                  <span className="text-xs font-bold text-[#0b1c30]">Inventarios (/inventarios)</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!permissions.inventarios?.enabled}
                    onChange={() => handleToggleModule("inventarios")}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-[#e2e8f0] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#cbd5e1] after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#004ac6]"></div>
                </label>
              </div>

              {permissions.inventarios?.enabled && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-[#f1f5f9] text-xs">
                  {Object.entries(permissions.inventarios.submodules).map(([subKey, val]) => (
                    <label
                      key={subKey}
                      className="flex items-center gap-2 p-2 rounded-lg bg-[#f8f9ff] hover:bg-[#eff4ff] cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={val}
                        onChange={() => handleToggleSubmodule("inventarios", subKey)}
                        className="rounded border-[#cbd5e1] text-[#004ac6] focus:ring-[#004ac6]"
                      />
                      <span className="capitalize text-[#434655] font-medium text-[11px]">
                        {subKey === "productos"
                          ? "Productos"
                          : subKey === "servicios"
                          ? "Servicios"
                          : subKey === "categorias"
                          ? "Categorías"
                          : subKey === "kardex"
                          ? "Kardex"
                          : subKey === "transferencias"
                          ? "Transferencias"
                          : subKey === "bodegas"
                          ? "Bodega"
                          : subKey === "ajustes"
                          ? "Ajustes"
                          : subKey.replace(/_/g, " ")}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* 6. Módulo Configuración */}
            <div className="p-4 rounded-xl border border-[#e2e8f0] bg-white space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-[#004ac6]" />
                  <span className="text-xs font-bold text-[#0b1c30]">Configuración (/configuracion)</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!permissions.configuracion?.enabled}
                    onChange={() => handleToggleModule("configuracion")}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-[#e2e8f0] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#cbd5e1] after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#004ac6]"></div>
                </label>
              </div>

              {permissions.configuracion?.enabled && permissions.configuracion.submodules && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-[#f1f5f9] text-xs">
                  {Object.entries(permissions.configuracion.submodules).map(([subKey, val]) => (
                    <label
                      key={subKey}
                      className="flex items-center gap-2 p-2 rounded-lg bg-[#f8f9ff] hover:bg-[#eff4ff] cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={val}
                        onChange={() => handleToggleSubmodule("configuracion", subKey)}
                        className="rounded border-[#cbd5e1] text-[#004ac6] focus:ring-[#004ac6]"
                      />
                      <span className="capitalize text-[#434655] font-medium text-[11px]">
                        {subKey === "sri" ? "Configuración SRI" : "General"}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Other Standalone Modules */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-xl border border-[#e2e8f0] bg-white flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-[#0b1c30]">
                  <Kanban className="w-4 h-4 text-[#004ac6]" />
                  <span>Proyectos</span>
                </div>
                <input
                  type="checkbox"
                  checked={!!permissions.proyectos?.enabled}
                  onChange={() => handleToggleModule("proyectos")}
                  className="rounded text-[#004ac6] focus:ring-[#004ac6]"
                />
              </div>

              <div className="p-3 rounded-xl border border-[#e2e8f0] bg-white flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-[#0b1c30]">
                  <Ticket className="w-4 h-4 text-[#004ac6]" />
                  <span>Tickets de Soporte</span>
                </div>
                <input
                  type="checkbox"
                  checked={!!permissions.tickets?.enabled}
                  onChange={() => handleToggleModule("tickets")}
                  className="rounded text-[#004ac6] focus:ring-[#004ac6]"
                />
              </div>

              <div className="p-3 rounded-xl border border-[#e2e8f0] bg-white flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-[#0b1c30]">
                  <ShieldCheck className="w-4 h-4 text-[#004ac6]" />
                  <span>ARCOTEL</span>
                </div>
                <input
                  type="checkbox"
                  checked={!!permissions.arcotel?.enabled}
                  onChange={() => handleToggleModule("arcotel")}
                  className="rounded text-[#004ac6] focus:ring-[#004ac6]"
                />
              </div>

              <div className="p-3 rounded-xl border border-[#e2e8f0] bg-white flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-[#0b1c30]">
                  <Lock className="w-4 h-4 text-[#004ac6]" />
                  <span>Bóveda de Credenciales</span>
                </div>
                <input
                  type="checkbox"
                  checked={!!permissions.boveda?.enabled}
                  onChange={() => handleToggleModule("boveda")}
                  className="rounded text-[#004ac6] focus:ring-[#004ac6]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#e2e8f0] flex justify-end gap-3 bg-[#f8f9ff]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[#434655]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Guardar Permisos & Matriz</span>
          </button>
        </div>
      </div>
    </div>
  );
}
