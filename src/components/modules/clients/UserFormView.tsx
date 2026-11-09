"use client";
import { BackButton } from "@/components/ui/BackButton";

import React, { useState } from "react";
import { Save, Shield, ShieldAlert, ShieldCheck, Lock, Eye, EyeOff, Boxes, Receipt, Users, ShoppingBag, DollarSign, Network, Kanban, Ticket, FileText, Radio, Settings, ChevronDown, ChevronUp, Check, RotateCcw, AlertCircle, Loader2 } from "lucide-react";
import { SystemUser, UserRole, UserModulePermissions } from "@/types";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import {
  DEFAULT_MODULE_PERMISSIONS_BY_ROLE,
  canPerformAction,
  editableModulePermissions,
  DEFAULT_INVENTORY_ACTIONS,
  DEFAULT_BILLING_ACTIONS,
  DEFAULT_CLIENT_ACTIONS,
  DEFAULT_PURCHASE_ACTIONS,
  DEFAULT_FINANCE_ACTIONS,
  DEFAULT_NETWORK_ACTIONS,
  DEFAULT_VAULT_ACTIONS,
} from "@/lib/permissions";

interface UserFormViewProps {
  user: SystemUser | null;
  onSave: (userData: Partial<SystemUser>, permissions: UserModulePermissions) => Promise<void>;
  onCancel: () => void;
}

export function UserFormView({ user, onSave, onCancel }: UserFormViewProps) {
  const { currentUser, userRoleTemplates, saveRecord } = useApp();
  const { showSuccess } = useToast();
  const [templateName, setTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  // Form State
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState(user?.phone || "");
  const [department, setDepartment] = useState(user?.department || "Operaciones & Red");
  const [role, setRole] = useState<UserRole>(user?.role || "tecnico");
  const [status, setStatus] = useState<"activo" | "inactivo">(user?.status || "activo");

  // Permissions State
  const [permissions, setPermissions] = useState<UserModulePermissions>(() => {
    const selectedRole = user?.role || "tecnico";
    const profile = { ...user, uid: user?.uid || "", email: user?.email || "", displayName: user?.displayName || "",
      role: selectedRole, status: "activo" as const };
    return editableModulePermissions(profile);
  });

  // Accordion open/close state
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({
    inventarios: true,
    facturacion: true,
    clientes: false,
    compras: false,
    finanzas: false,
    red: false,
    boveda: false,
    otros: false,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const toggleAccordion = (key: string) => {
    setOpenAccordions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Preset loader
  const handleApplyRolePreset = (selectedRole: UserRole) => {
    const preset = DEFAULT_MODULE_PERMISSIONS_BY_ROLE[selectedRole];
    if (preset) {
      setPermissions({
        ...preset,
        dashboard: { enabled: selectedRole !== "tecnico" },
        visibility: { canViewServicePrices: selectedRole !== "tecnico", canViewProductPrices: selectedRole !== "tecnico", canViewFinancialAmounts: selectedRole !== "tecnico" },
      });
    }
  };

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    handleApplyRolePreset(newRole);
  };

  async function saveRoleTemplate() {
    if (role === "superadmin" || templateName.trim().length < 2 || savingTemplate) return;
    setSavingTemplate(true);
    setErrorMessage("");
    try {
      await saveRecord("userRoleTemplates", { name: templateName.trim(), baseRole: role, modulePermissions: permissions }, `role-${crypto.randomUUID()}`);
      showSuccess("Plantilla guardada", "Puedes aplicarla al crear o editar otro usuario.");
      setTemplateName("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo guardar la plantilla.");
    } finally {
      setSavingTemplate(false);
    }
  }

  // Toggle Module
  const handleToggleModule = (modKey: keyof UserModulePermissions) => {
    setPermissions((prev) => {
      const cur = (prev[modKey] as any) || { enabled: false };
      return {
        ...prev,
        [modKey]: {
          ...cur,
          enabled: !cur.enabled,
        },
      };
    });
  };

  // Toggle Submodule
  const handleToggleSubmodule = (modKey: keyof UserModulePermissions, subKey: string, defaultValue = false) => {
    setPermissions((prev) => {
      const cur = (prev[modKey] as any) || {};
      const currentSubs = cur.submodules || {};
      return {
        ...prev,
        [modKey]: {
          ...cur,
          submodules: {
            ...currentSubs,
            [subKey]: !(currentSubs[subKey] ?? defaultValue),
          },
        },
      };
    });
  };

  // Toggle Action
  const handleToggleAction = (modKey: keyof UserModulePermissions, actionKey: string) => {
    setPermissions((prev) => {
      const cur = (prev[modKey] as any) || {};
      const currentActions = cur.actions || {};
      return {
        ...prev,
        [modKey]: {
          ...cur,
          actions: {
            ...currentActions,
            [actionKey]: !currentActions[actionKey],
          },
        },
      };
    });
  };

  // Quick Bulk Controls
  const handleEnableAllModules = () => {
    setPermissions(JSON.parse(JSON.stringify(DEFAULT_MODULE_PERMISSIONS_BY_ROLE.superadmin)));
  };

  const handleDisableAllModules = () => {
    setPermissions(prev => ({
      ...Object.fromEntries(Object.entries(prev).map(([key, value]) =>
        [key, "enabled" in value ? { ...value, enabled: false } : value])),
      dashboard: { enabled: false },
      visibility: { canViewServicePrices: false, canViewProductPrices: false, canViewFinancialAmounts: false },
    }));
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!displayName.trim()) {
      setErrorMessage("El nombre completo del colaborador es obligatorio.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setErrorMessage("Ingresa un correo electrónico corporativo válido.");
      return;
    }
    if (!user && password.trim().length < 12) {
      setErrorMessage("La contraseña inicial debe tener al menos 12 caracteres.");
      return;
    }
    if (user && password.trim().length > 0 && password.trim().length < 12) {
      setErrorMessage("Si deseas actualizar la contraseña, debe tener al menos 12 caracteres.");
      return;
    }

    try {
      setIsSaving(true);
      const updates: Partial<SystemUser> = {
        displayName: displayName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        department: department.trim(),
        role: user?.role === "superadmin" ? "superadmin" : role,
        status,
      };

      if (password.trim().length >= 12) {
        updates.passwordHash = password.trim();
      }

      await onSave(updates, permissions);
    } catch (err: any) {
      setErrorMessage(err?.message || "Ocurrió un error al guardar los cambios.");
    } finally {
      setIsSaving(false);
    }
  };

  // Helper counts
  const countActiveModules = () => {
    const keys: (keyof UserModulePermissions)[] = [
      "dashboard",
      "inventarios",
      "facturacion",
      "personas",
      "ventas",
      "abonados",
      "compras",
      "finanzas",
      "red",
      "boveda",
      "proyectos",
      "tickets",
      "arcotel",
      "plantillas",
      "configuracion",
    ];
    return keys.filter((k) => (permissions[k] as any)?.enabled).length;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 px-6 rounded-xl border border-[#e2e8f0] shadow-2xs">
        <div className="flex items-center gap-3">
          <BackButton type="button" onClick={onCancel} disabled={isSaving} label="Volver" />
          <div className="h-5 w-px bg-[#e2e8f0]" />
          <h2 className="text-sm font-bold text-[#0b1c30]">
            {user ? user.displayName : "Nuevo Usuario"}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="px-4 py-2 bg-white hover:bg-[#f8f9ff] text-[#434655] border border-[#cbd5e1] rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Guardar</span>
              </>
            )}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (35%): User Personal Information */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-lumina-card space-y-4">
            <div className="border-b border-[#e2e8f0] pb-3">
              <h3 className="font-bold text-xs text-[#0b1c30] uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-[#004ac6]" />
                Datos del Colaborador
              </h3>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-bold text-[#434655] block mb-1">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Ing. Carlos Mendoza"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-[#f8f9ff] border border-[#cbd5e1] rounded-xl px-3 py-2 font-semibold text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:bg-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#434655] block mb-1">
                  Correo Electrónico Corporativo *
                </label>
                <input
                  type="email"
                  required
                  placeholder="carlos.mendoza@inntelcorp.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#f8f9ff] border border-[#cbd5e1] rounded-xl px-3 py-2 font-medium text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:bg-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#434655] block mb-1">
                  {user ? "Nueva Contraseña (opcional)" : "Contraseña de Acceso *"}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder={user ? "Dejar vacía para conservar" : "Mínimo 6 caracteres"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#f8f9ff] border border-[#cbd5e1] rounded-xl pl-3 pr-9 py-2 font-mono text-xs text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:bg-white focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-2.5 text-[#737686] hover:text-[#0b1c30]"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#434655] block mb-1">
                    Teléfono Celular
                  </label>
                  <input
                    type="text"
                    placeholder="0991234567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-[#f8f9ff] border border-[#cbd5e1] rounded-xl px-3 py-2 font-medium text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:bg-white focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#434655] block mb-1">
                    Estado de Cuenta
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full bg-[#f8f9ff] border border-[#cbd5e1] rounded-xl px-3 py-2 font-semibold text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:bg-white focus:outline-hidden"
                  >
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo / Suspendido</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#434655] block mb-1">
                  Departamento Operativo
                </label>
                <input
                  type="text"
                  placeholder="Ej: Operaciones & Red"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full bg-[#f8f9ff] border border-[#cbd5e1] rounded-xl px-3 py-2 font-medium text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:bg-white focus:outline-hidden"
                />
              </div>

              {/* Role Preset Selector */}
              <div className="pt-2 border-t border-[#e2e8f0]">
                <label className="text-[11px] font-bold text-[#434655] block mb-1">
                  Rol Principal & Plantilla de Permisos
                </label>
                <select
                  value={role}
                  disabled={user?.role === "superadmin"}
                  onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                  className="w-full bg-white border-2 border-[#004ac6]/30 text-[#004ac6] font-bold rounded-xl px-3 py-2 focus:ring-2 focus:ring-[#004ac6] focus:outline-hidden cursor-pointer"
                >
                  <option value="ventas">Ventas & Comercial</option>
                  <option value="tecnico">Técnico de Campo & Soporte</option>
                  <option value="finanzas">Finanzas & Cobranzas</option>
                  <option value="bodega">Bodega & Inventarios</option>
                  <option value="admin">Administrador General</option>
                  <option value="soporte">Mesa de Ayuda (Soporte)</option>
                  <option value="legal">Legal & Arcotel</option>
                  <option value="consulta">Solo Consulta / Auditor</option>
                  {user?.role === "superadmin" && <option value="superadmin">Superadmin (Acceso Total)</option>}
                </select>

                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11px] text-[#737686]">Plantilla sugerida</span>
                  <button
                    type="button"
                    onClick={() => handleApplyRolePreset(role)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#004ac6] hover:underline cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Recargar preset del rol</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Summary Box */}
          <div className="bg-[#f8f9ff] rounded-xl border border-[#e2e8f0] p-4 text-xs text-[#434655] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-[#737686]">Módulos Activos:</span>
              <span className="font-bold font-mono text-[#004ac6]">{countActiveModules()} / 13</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-[#737686]">Rol asignado:</span>
              <span className="font-bold text-[#0b1c30] capitalize">{role}</span>
            </div>
            <div className="text-[11px] text-[#737686] pt-1 border-t border-[#e2e8f0]">
              Cualquier permiso modificado en la columna derecha se guardará como personalización directa para este colaborador.
            </div>
          </div>
        </div>

        {/* Right Column (65%): Granular Permissions Matrix */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-4 px-5 shadow-lumina-card flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-bold text-xs text-[#0b1c30] uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#004ac6]" />
              Permisos
            </h3>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleEnableAllModules}
                className="px-2.5 py-1 bg-blue-50 text-[#004ac6] hover:bg-blue-100 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
              >
                Todos
              </button>
              <button
                type="button"
                onClick={handleDisableAllModules}
                className="px-2.5 py-1 bg-slate-100 text-[#737686] hover:bg-slate-200 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
              >
                Ninguno
              </button>
            </div>
          </div>

          <section className="rounded-xl border border-[#e2e8f0] bg-white p-4 px-5 space-y-3">
            {currentUser.role === "superadmin" && role !== "superadmin" && (
              <div className="space-y-2 border-b border-slate-200 pb-3 text-xs">
                <label className="block font-semibold">Aplicar plantilla de rol
                  <select className="mt-1 block w-full rounded-lg border border-slate-200 p-2" value="" onChange={event => {
                    const template = userRoleTemplates.find(row => row.id === event.target.value);
                    if (!template) return;
                    setRole(template.baseRole);
                    setPermissions(editableModulePermissions({ uid: "preview", email: "", displayName: "", role: template.baseRole, status: "activo", modulePermissions: template.modulePermissions }));
                  }}>
                    <option value="">Seleccionar una plantilla guardada</option>
                    {userRoleTemplates.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}
                  </select>
                </label>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="min-w-0 flex-1 basis-40 font-semibold">Nombre de la nueva plantilla
                    <input className="mt-1 block w-full rounded-lg border border-slate-200 p-2" maxLength={80}
                      value={templateName} onChange={event => setTemplateName(event.target.value)} />
                  </label>
                  <button type="button" disabled={savingTemplate || templateName.trim().length < 2} onClick={() => void saveRoleTemplate()}
                    className="rounded-lg border border-blue-200 px-3 py-2 font-semibold text-[#004ac6] disabled:opacity-50">Guardar como plantilla</button>
                </div>
              </div>
            )}
            <h3 className="font-bold text-xs text-[#0b1c30]">Pantallas y visibilidad de datos</h3>
            <label className="flex items-start gap-2 text-xs">
              <input type="checkbox" checked={permissions.plantillas?.actions?.canManageTemplates ?? (role === "admin" || role === "superadmin")}
                disabled={role === "superadmin" || !permissions.plantillas?.enabled}
                onChange={event => { const checked = event.target.checked; setPermissions(prev => ({ ...prev, plantillas: { enabled: prev.plantillas?.enabled ?? false, actions: { ...prev.plantillas?.actions, canManageTemplates: checked } } })); }} />
              <span><strong>Administrar plantillas y archivos</strong><span className="block text-slate-500">Crear, editar, reemplazar y retirar plantillas compartidas.</span></span>
            </label>
            <label className="flex items-start gap-2 text-xs">
              <input type="checkbox" checked={permissions.dashboard?.enabled ?? role !== "tecnico"}
                disabled={role === "superadmin"} onChange={() => handleToggleModule("dashboard")} />
              <span><strong>Ver Dashboard</strong><span className="block text-slate-500">Acceso a la pantalla de inicio.</span></span>
            </label>
            <label className="flex items-start gap-2 text-xs">
              <input type="checkbox" checked={permissions.visibility?.canViewServicePrices ?? role !== "tecnico"}
                disabled={role === "superadmin"} onChange={event => {
                  const canViewServicePrices = event.target.checked;
                  setPermissions(prev => ({ ...prev, visibility: { ...prev.visibility, canViewServicePrices } }));
                }} />
              <span><strong>Ver valores de servicios</strong><span className="block text-slate-500">Tarifas del catálogo y de los servicios contratados.</span></span>
            </label>
            {([ ["canViewFinancialAmounts", "Ver importes comerciales y financieros", "Permite acceder a Ventas, Compras, Finanzas, SRI e informes financieros."], ["canViewProductPrices", "Ver precios de productos", "Precios de venta del inventario; los costos se controlan por separado."] ] as const).map(([key, label, description]) => (
              <label key={key} className="flex items-start gap-2 text-xs">
                <input type="checkbox" checked={permissions.visibility?.[key] ?? role !== "tecnico"} disabled={role === "superadmin"}
                  onChange={event => { const checked = event.target.checked; setPermissions(prev => ({ ...prev, visibility: { ...prev.visibility, [key]: checked } })); }} />
                <span><strong>{label}</strong><span className="block text-slate-500">{description}</span></span>
              </label>
            ))}
            <label className="flex items-start gap-2 text-xs">
              <input type="checkbox" checked={permissions.tickets?.actions?.canManageDepartments ?? (role === "admin" || role === "superadmin")}
                disabled={role === "superadmin" || !permissions.tickets?.enabled} onChange={event => {
                  const canManageDepartments = event.target.checked;
                  setPermissions(prev => ({ ...prev, tickets: { enabled: prev.tickets?.enabled ?? false,
                    actions: { ...prev.tickets?.actions, canManageDepartments } } }));
                }} />
              <span><strong>Administrar departamentos de soporte</strong><span className="block text-slate-500">Crear, renombrar y desactivar departamentos.</span></span>
            </label>
          </section>

          <section aria-labelledby="personas-permissions-title" className="bg-white rounded-xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
            <div className="p-4 flex flex-wrap items-center justify-between gap-3 bg-[#f8f9ff] border-b border-[#e2e8f0]">
              <div className="flex items-center gap-3">
                <Users aria-hidden="true" className="size-5 text-[#004ac6]" />
                <div>
                  <h3 id="personas-permissions-title" className="text-xs font-bold text-[#0b1c30]">Personas</h3>
                  <p className="text-xs text-slate-500">Acceso al directorio de proveedores y usuarios.</p>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold">
                <input type="checkbox" checked={!!permissions.personas?.enabled} disabled={role === "superadmin"}
                  onChange={() => handleToggleModule("personas")} className="rounded text-[#004ac6] focus:ring-[#004ac6]" />
                Habilitar Personas
              </label>
            </div>
            <fieldset disabled={role === "superadmin" || !permissions.personas?.enabled} className="p-4 space-y-3 disabled:opacity-60">
              <legend className="sr-only">Submódulos de Personas</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {([
                  ["proveedores", "Proveedores"],
                  ["usuarios_equipo", "Usuarios / Equipo"],
                ] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 rounded-lg border border-[#e2e8f0] p-3">
                    <input type="checkbox" checked={!!permissions.personas?.submodules[key]}
                      onChange={() => handleToggleSubmodule("personas", key)} className="rounded text-[#004ac6] focus:ring-[#004ac6]" />
                    {label}
                  </label>
                ))}
              </div>
              <p className="text-xs text-slate-500">Desactivar Personas bloquea sus pantallas. La creación y modificación de cuentas sigue reservada al superadministrador.</p>
            </fieldset>
          </section>

          {/* Module 1: INVENTARIOS */}
          <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
            <div className="p-3.5 px-5 flex items-center justify-between bg-[#f8f9ff] border-b border-[#e2e8f0]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#004ac6] flex items-center justify-center">
                  <Boxes className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-[#0b1c30]">Inventarios</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${permissions.inventarios?.enabled ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-500"}`}>
                    {permissions.inventarios?.enabled ? "Activo" : "Inactivo"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!permissions.inventarios?.enabled}
                    onChange={() => handleToggleModule("inventarios")}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#004ac6]"></div>
                </label>
                <button
                  type="button"
                  onClick={() => toggleAccordion("inventarios")}
                  className="p-1 text-[#737686] hover:text-[#0b1c30] cursor-pointer"
                >
                  {openAccordions.inventarios ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {openAccordions.inventarios && permissions.inventarios?.enabled && (
              <div className="p-5 space-y-4 text-xs divide-y divide-[#f1f5f9]">
                {/* Submodules */}
                <div>
                  <span className="font-bold text-[#434655] text-[11px] uppercase tracking-wider block mb-2">
                    Submódulos Permitidos:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { key: "productos", label: "Productos" },
                      { key: "servicios", label: "Servicios" },
                      { key: "categorias", label: "Categorías" },
                      { key: "kardex", label: "Kardex Físico" },
                      { key: "transferencias", label: "Transferencias" },
                      { key: "bodegas", label: "Bodegas" },
                      { key: "ajustes", label: "Ajustes Stock" },
                    ].map((sub) => {
                      const checked = !!(permissions.inventarios?.submodules as any)?.[sub.key];
                      return (
                        <label
                          key={sub.key}
                          className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition-all ${
                            checked ? "bg-blue-50/50 border-blue-200 text-[#004ac6] font-semibold" : "bg-white border-[#e2e8f0] text-[#737686]"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleToggleSubmodule("inventarios", sub.key)}
                            className="rounded text-[#004ac6] focus:ring-[#004ac6]"
                          />
                          <span>{sub.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Granular Actions */}
                <div className="pt-3">
                  <span className="font-bold text-[#434655] text-[11px] uppercase tracking-wider block mb-2">
                    Acciones Internas de Operación:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {[
                      { key: "canCreateProduct", label: "Crear Producto", critical: false },
                      { key: "canCreateService", label: "Crear Servicio", critical: false },
                      { key: "canEditProduct", label: "Editar Ficha de Ítem", critical: false },
                      { key: "canChangePrices", label: "Modificar Precios de Venta", critical: true },
                      { key: "canViewCosts", label: "Ver Costos de Compra & Margen", critical: true },
                      { key: "canAdjustStock", label: "Ajustes Manuales de Stock / Merma", critical: true },
                      { key: "canTransferWarehouses", label: "Transferir entre Bodegas", critical: false },
                      { key: "canDeleteItems", label: "Eliminar Ítems del Catálogo", critical: true },
                    ].map((act) => {
                      const checked = !!permissions.inventarios?.actions?.[act.key as keyof typeof DEFAULT_INVENTORY_ACTIONS];
                      return (
                        <label
                          key={act.key}
                          className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                            checked ? "bg-white border-[#cbd5e1] text-[#0b1c30]" : "bg-slate-50 border-[#e2e8f0] text-slate-400"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleToggleAction("inventarios", act.key)}
                              className="rounded text-[#004ac6] focus:ring-[#004ac6]"
                            />
                            <span className="font-medium text-xs">{act.label}</span>
                          </div>
                          {act.critical && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <Lock className="w-2.5 h-2.5" />
                              Sensible
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          <section aria-labelledby="sales-permissions-title" className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden">
            <div className="p-4 flex flex-wrap items-center justify-between gap-3 bg-[#f8f9ff] border-b border-[#e2e8f0]">
              <h3 id="sales-permissions-title" className="text-xs font-bold text-[#0b1c30]">Ventas comerciales</h3>
              <label className="flex items-center gap-2 text-xs font-semibold">
                <input type="checkbox" checked={!!permissions.ventas?.enabled} disabled={role === "superadmin"}
                  onChange={() => handleToggleModule("ventas")} className="rounded text-[#004ac6]" />Habilitar Ventas
              </label>
            </div>
            <fieldset disabled={role === "superadmin" || !permissions.ventas?.enabled} className="p-4 space-y-4 disabled:opacity-60">
              <legend className="sr-only">Pantallas y funciones de Ventas</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {([ ["notas_venta", "Notas de venta"], ["nueva_venta", "Nueva venta"], ["cotizaciones", "Cotizaciones"], ["recurrentes", "Ventas recurrentes"] ] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2">
                    <input type="checkbox" checked={!!permissions.ventas?.submodules[key]} onChange={() => handleToggleSubmodule("ventas", key)} />{label}
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs border-t border-[#e2e8f0] pt-3">
                {([ ["canCreateInvoice", "Registrar ventas y emitir recurrencias"], ["canEditPrices", "Editar ventas y sus precios"], ["canCancelInvoices", "Eliminar notas de venta"], ["canCreateQuotes", "Crear y editar cotizaciones"], ["canApproveQuotes", "Convertir cotizaciones en ventas"] ] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2">
                    <input type="checkbox" checked={permissions.ventas?.actions?.[key] ?? (key === "canCancelInvoices" ? canPerformAction({ ...user, uid: user?.uid || "preview", email: user?.email || "", displayName: user?.displayName || "", role, status: "activo", modulePermissions: permissions }, "canDeleteInvoices") : permissions.facturacion?.actions?.[key] ?? DEFAULT_MODULE_PERMISSIONS_BY_ROLE[role].facturacion?.actions?.[key] ?? false)}
                      onChange={event => { const checked = event.target.checked; setPermissions(prev => ({ ...prev, ventas: { ...prev.ventas!, actions: { ...prev.ventas?.actions, [key]: checked } } })); }} />{label}
                  </label>
                ))}
              </div>
              <p className="text-xs text-slate-500">Estos permisos son independientes de Facturación SRI. El acceso requiere habilitar la visualización de importes comerciales y financieros.</p>
            </fieldset>
          </section>

          {/* Module 2: FACTURACIÓN & VENTAS */}
          <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
            <div className="p-3.5 px-5 flex items-center justify-between bg-[#f8f9ff] border-b border-[#e2e8f0]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#004ac6] flex items-center justify-center">
                  <Receipt className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-[#0b1c30]">Facturación SRI</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${permissions.facturacion?.enabled ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-500"}`}>
                    {permissions.facturacion?.enabled ? "Activo" : "Inactivo"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!permissions.facturacion?.enabled}
                    onChange={() => handleToggleModule("facturacion")}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#004ac6]"></div>
                </label>
                <button
                  type="button"
                  onClick={() => toggleAccordion("facturacion")}
                  className="p-1 text-[#737686] hover:text-[#0b1c30] cursor-pointer"
                >
                  {openAccordions.facturacion ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {openAccordions.facturacion && permissions.facturacion?.enabled && (
              <div className="p-5 space-y-4 text-xs divide-y divide-[#f1f5f9]">
                <div>
                  <span className="font-bold text-[#434655] text-[11px] uppercase tracking-wider block mb-2">
                    Submódulos Permitidos:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                    {[
                      { key: "facturas", label: "Facturas (01)" },
                      { key: "cotizaciones", label: "Cotizaciones" },
                      { key: "notas_credito", label: "Notas Crédito (04)" },
                      { key: "notas_debito", label: "Notas Débito (05)" },
                      { key: "retenciones", label: "Retenciones (07)" },
                      { key: "guias_remision", label: "Guías Remisión (06)" },
                    ].map((sub) => {
                      const checked = !!(permissions.facturacion?.submodules as any)?.[sub.key];
                      return (
                        <label
                          key={sub.key}
                          className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition-all ${
                            checked ? "bg-blue-50/50 border-blue-200 text-[#004ac6] font-semibold" : "bg-white border-[#e2e8f0] text-[#737686]"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleToggleSubmodule("facturacion", sub.key)}
                            className="rounded text-[#004ac6] focus:ring-[#004ac6]"
                          />
                          <span>{sub.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-3">
                  <span className="font-bold text-[#434655] text-[11px] uppercase tracking-wider block mb-2">
                    Acciones Internas de Facturación:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {[
                      { key: "canCreateInvoice", label: "Emitir Nueva Factura / Venta", critical: false },
                      { key: "canEditPrices", label: "Modificar Precio Unitario en Venta", critical: true },
                      { key: "canApplyDiscounts", label: "Aplicar Descuentos Manuales", critical: true },
                      { key: "canAuthorizeSri", label: "Firmar & Enviar Comprobante al SRI", critical: false },
                      { key: "canCancelInvoices", label: "Emitir Notas de Crédito / Anular Facturas", critical: true },
                      { key: "canCreateQuotes", label: "Crear y Enviar Cotizaciones", critical: false },
                      { key: "canApproveQuotes", label: "Aprobar y Facturar Cotizaciones", critical: false },
                      { key: "canViewSalesReports", label: "Ver Reportes de Facturación y Ventas", critical: false },
                    ].map((act) => {
                      const checked = !!permissions.facturacion?.actions?.[act.key as keyof typeof DEFAULT_BILLING_ACTIONS];
                      return (
                        <label
                          key={act.key}
                          className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                            checked ? "bg-white border-[#cbd5e1] text-[#0b1c30]" : "bg-slate-50 border-[#e2e8f0] text-slate-400"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleToggleAction("facturacion", act.key)}
                              className="rounded text-[#004ac6] focus:ring-[#004ac6]"
                            />
                            <span className="font-medium text-xs">{act.label}</span>
                          </div>
                          {act.critical && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <Lock className="w-2.5 h-2.5" />
                              Sensible
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Module 3: CLIENTES */}
          <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
            <div className="p-3.5 px-5 flex items-center justify-between bg-[#f8f9ff] border-b border-[#e2e8f0]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#004ac6] flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-[#0b1c30]">Clientes</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${permissions.abonados?.enabled !== false ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-500"}`}>
                    {permissions.abonados?.enabled !== false ? "Activo" : "Inactivo"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={permissions.abonados?.enabled !== false}
                    onChange={() => handleToggleModule("abonados")}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#004ac6]"></div>
                </label>
                <button
                  type="button"
                  onClick={() => toggleAccordion("clientes")}
                  className="p-1 text-[#737686] hover:text-[#0b1c30] cursor-pointer"
                >
                  {openAccordions.clientes ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {openAccordions.clientes && permissions.abonados?.enabled !== false && (
              <div className="p-5 text-xs">
                <p className="mb-2 font-bold text-[#434655]">Pestañas de la ficha 360°</p>
                <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {Object.entries({ fiscal: "Identificación", red: "Nodos", boveda: "Bóveda", contratos: "Servicios",
                    archivos: "Archivos", cotizaciones: "Cotizaciones", facturacion: "Facturación", finanzas: "Cobros",
                    tickets: "Tickets", proyectos: "Tareas", tramites: "Trámites", arcotel: "ARCOTEL", dossier: "Informes" }).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2">
                      <input type="checkbox" checked={permissions.abonados?.submodules?.[key] !== false}
                        onChange={() => handleToggleSubmodule("abonados", key, true)} />{label}
                    </label>
                  ))}
                </div>
                <span className="font-bold text-[#434655] text-[11px] uppercase tracking-wider block mb-2">
                  Acciones en Ficha de Clientes:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    { key: "canCreateClient", label: "Registrar Nuevo Cliente", critical: false },
                    { key: "canEditClient", label: "Editar Datos Fiscales / Contactos", critical: false },
                    { key: "canEditServicePrices", label: "Modificar Tarifa Mensual de Servicio", critical: true },
                    { key: "canUploadContracts", label: "Cargar Contratos y Documentos", critical: false },
                    { key: "canDeleteContracts", label: "Eliminar Archivos de Contrato", critical: true },
                    { key: "canDeleteClient", label: "Eliminar Cliente Definitivamente", critical: true },
                  ].map((act) => {
                    const checked = !!permissions.clientes?.actions?.[act.key as keyof typeof DEFAULT_CLIENT_ACTIONS];
                    return (
                      <label
                        key={act.key}
                        className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                          checked ? "bg-white border-[#cbd5e1] text-[#0b1c30]" : "bg-slate-50 border-[#e2e8f0] text-slate-400"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleToggleAction("clientes", act.key)}
                            className="rounded text-[#004ac6] focus:ring-[#004ac6]"
                          />
                          <span className="font-medium text-xs">{act.label}</span>
                        </div>
                        {act.critical && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Lock className="w-2.5 h-2.5" />
                            Sensible
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Module 4: COMPRAS & FINANZAS (Accordion conjunto) */}
          <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
            <div className="p-3.5 px-5 flex items-center justify-between bg-[#f8f9ff] border-b border-[#e2e8f0]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#004ac6] flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
                <span className="font-bold text-xs text-[#0b1c30]">Compras & Finanzas</span>
              </div>

              <button
                type="button"
                onClick={() => toggleAccordion("finanzas")}
                className="p-1 text-[#737686] hover:text-[#0b1c30] cursor-pointer"
              >
                {openAccordions.finanzas ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {openAccordions.finanzas && (
              <div className="p-5 space-y-4 text-xs divide-y divide-[#f1f5f9]">
                {/* Compras */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-[#0b1c30] text-xs">Módulo de Compras</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!permissions.compras?.enabled}
                        onChange={() => handleToggleModule("compras")}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#004ac6]"></div>
                    </label>
                  </div>
                  {permissions.compras?.enabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      {[
                        { key: "canCreateSupplier", label: "Crear / Editar Proveedores", critical: false },
                        { key: "canRegisterPurchase", label: "Registrar Facturas de Proveedor", critical: false },
                        { key: "canApprovePayments", label: "Autorizar Pagos a Proveedores", critical: true },
                        { key: "canEmitWithholding", label: "Emitir Retenciones SRI", critical: false },
                        { key: "canViewSupplierBank", label: "Ver Cuentas Bancarias de Proveedores", critical: false },
                      ].map((act) => {
                        const checked = !!permissions.compras?.actions?.[act.key as keyof typeof DEFAULT_PURCHASE_ACTIONS];
                        return (
                          <label key={act.key} className="flex items-center justify-between p-2 rounded-xl border border-[#e2e8f0] bg-white cursor-pointer">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => handleToggleAction("compras", act.key)}
                                className="rounded text-[#004ac6]"
                              />
                              <span className="text-xs">{act.label}</span>
                            </div>
                            {act.critical && (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1 rounded">🔒</span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Finanzas */}
                <div className="pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-[#0b1c30] text-xs">Módulo de Finanzas & Tesorería</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!permissions.finanzas?.enabled}
                        onChange={() => handleToggleModule("finanzas")}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#004ac6]"></div>
                    </label>
                  </div>
                  {permissions.finanzas?.enabled && (
                    <div className="space-y-3 mt-2">
                      <div>
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                          Submódulos Habilitados
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {[
                            { key: "cobranzas_opex", label: "Cobranzas & OPEX" },
                            { key: "movimientos", label: "Movimientos Tesorería" },
                            { key: "bancos", label: "Bancos & Cuentas" },
                            { key: "cuentas_por_cobrar", label: "Por Cobrar (CxC)" },
                            { key: "cuentas_por_pagar", label: "Por Pagar (CxP)" },
                            { key: "reportes", label: "Reportes Financieros" },
                          ].map((sub) => {
                            const checked =
                              (permissions.finanzas?.submodules as any)?.[sub.key] ?? true;
                            return (
                              <label
                                key={sub.key}
                                className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition-all ${
                                  checked
                                    ? "bg-blue-50/50 border-blue-200 text-[#004ac6] font-semibold"
                                    : "bg-white border-[#e2e8f0] text-[#737686]"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => handleToggleSubmodule("finanzas", sub.key)}
                                  className="rounded text-[#004ac6]"
                                />
                                <span className="text-xs">{sub.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                          Acciones Específicas
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {[
                            { key: "canViewBankBalances", label: "Ver Saldos de Cuentas Bancarias", critical: true },
                            { key: "canRegisterReceipts", label: "Registrar Cobranzas / Recibos", critical: false },
                            { key: "canRegisterExpenses", label: "Registrar Gastos Operativos", critical: false },
                            { key: "canCancelPayments", label: "Anular Movimientos Financieros", critical: true },
                            { key: "canExportReports", label: "Exportar Balances y Reportes", critical: false },
                          ].map((act) => {
                            const checked = !!permissions.finanzas?.actions?.[act.key as keyof typeof DEFAULT_FINANCE_ACTIONS];
                            return (
                              <label key={act.key} className="flex items-center justify-between p-2 rounded-xl border border-[#e2e8f0] bg-white cursor-pointer">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => handleToggleAction("finanzas", act.key)}
                                    className="rounded text-[#004ac6]"
                                  />
                                  <span className="text-xs">{act.label}</span>
                                </div>
                                {act.critical && (
                                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1 rounded">🔒</span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Module 5: BÓVEDA & REDES */}
          <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
            <div className="p-3.5 px-5 flex items-center justify-between bg-[#f8f9ff] border-b border-[#e2e8f0]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#004ac6] flex items-center justify-center">
                  <Lock className="w-4 h-4" />
                </div>
                <span className="font-bold text-xs text-[#0b1c30]">Credenciales</span>
              </div>

              <button
                type="button"
                onClick={() => toggleAccordion("boveda")}
                className="p-1 text-[#737686] hover:text-[#0b1c30] cursor-pointer"
              >
                {openAccordions.boveda ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {openAccordions.boveda && (
              <div className="p-5 space-y-4 text-xs divide-y divide-[#f1f5f9]">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-[#0b1c30] text-xs">Acceso a Bóveda Cifrada</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!permissions.boveda?.enabled}
                        onChange={() => handleToggleModule("boveda")}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#004ac6]"></div>
                    </label>
                  </div>
                  {permissions.boveda?.enabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      {[
                        { key: "canViewClientVault", label: "Ver Claves de Clientes", critical: false },
                        { key: "canViewInternalVault", label: "Ver Claves Internas del NOC", critical: true },
                        { key: "canRevealPasswords", label: "Revelar Contraseñas Ocultas", critical: true },
                        { key: "canDeleteCredentials", label: "Eliminar Credenciales", critical: true },
                      ].map((act) => {
                        const checked = !!permissions.boveda?.actions?.[act.key as keyof typeof DEFAULT_VAULT_ACTIONS];
                        return (
                          <label key={act.key} className="flex items-center justify-between p-2 rounded-xl border border-[#e2e8f0] bg-white cursor-pointer">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => handleToggleAction("boveda", act.key)}
                                className="rounded text-[#004ac6]"
                              />
                              <span className="text-xs">{act.label}</span>
                            </div>
                            {act.critical && (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1 rounded">🔒</span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Module 6: OTROS MÓDULOS */}
          <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
            <div className="p-3.5 px-5 flex items-center justify-between bg-[#f8f9ff] border-b border-[#e2e8f0]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#004ac6] flex items-center justify-center">
                  <Settings className="w-4 h-4" />
                </div>
                <span className="font-bold text-xs text-[#0b1c30]">Otros Módulos</span>
              </div>

              <button
                type="button"
                onClick={() => toggleAccordion("otros")}
                className="p-1 text-[#737686] hover:text-[#0b1c30] cursor-pointer"
              >
                {openAccordions.otros ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {openAccordions.otros && (
              <div className="p-5 text-xs grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {[
                  { key: "proyectos", label: "Proyectos & Kanban" },
                  { key: "tickets", label: "Tickets de Soporte" },
                  { key: "arcotel", label: "Pólizas Arcotel" },
                  { key: "plantillas", label: "Generador Plantillas" },
                  { key: "configuracion", label: "Configuración SRI" },
                ].map((mod) => {
                  const checked = !!(permissions[mod.key as keyof UserModulePermissions] as any)?.enabled;
                  return (
                    <label
                      key={mod.key}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                        checked ? "bg-blue-50/50 border-blue-200 text-[#004ac6] font-semibold" : "bg-white border-[#e2e8f0] text-[#737686]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleModule(mod.key as any)}
                        className="rounded text-[#004ac6]"
                      />
                      <span>{mod.label}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
