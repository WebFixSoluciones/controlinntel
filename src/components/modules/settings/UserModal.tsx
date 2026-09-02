"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { SystemUser, UserRole, SystemPermission } from "@/types";
import { validateEmail } from "@/lib/validation-engine";
import {
  X,
  UserPlus,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Mail,
  User,
  Phone,
  Building,
  Check,
  Eye,
  EyeOff,
} from "lucide-react";

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  userToEdit: SystemUser | null;
}

const ALL_PERMISSIONS: { id: SystemPermission; label: string; desc: string }[] = [
  { id: "all", label: "Control Total del Sistema", desc: "Acceso irrestricto a todas las funciones (Super Admin)" },
  { id: "manage_users", label: "Gestión de Usuarios & Roles", desc: "Crear, editar, activar y eliminar operadores del sistema" },
  { id: "manage_vault", label: "Bóveda de Contraseñas (AES-256)", desc: "Acceso a claves de SIETEL, QUIPUX y Routers MikroTik" },
  { id: "manage_clients", label: "Gestión de Clientes & Ficha 360°", desc: "Crear abonados, asignar planes, IPs y editar fichas" },
  { id: "manage_network", label: "Infraestructura & MikroTik", desc: "Supervisar POPs, RouterOS, pools CGNAT e IPv6" },
  { id: "manage_tickets", label: "Mesa de Ayuda & Tickets NOC", desc: "Crear incidencias, asignar cuadrillas y resolver fallas" },
  { id: "manage_finance", label: "Finanzas & Órdenes de Pedido", desc: "Emisión Día 1, cotizaciones y seguimiento de cobros" },
  { id: "manage_policies", label: "Regulatorio ARCOTEL & Pólizas", desc: "Control de vigencias y descarga de oficios formales" },
  { id: "export_reports", label: "Exportación de Plantillas & Excel", desc: "Descarga de contratos Word y reportes de red en Excel" },
];

export function UserModal({ isOpen, onClose, userToEdit }: UserModalProps) {
  const { addSystemUser, updateSystemUser, currentUser } = useApp();
  const { showError, showSuccess } = useToast();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<UserRole>("tecnico");
  const [department, setDepartment] = useState("Operaciones NOC");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"activo" | "inactivo">("activo");
  const [permissions, setPermissions] = useState<SystemPermission[]>(["manage_tickets"]);

  useEffect(() => {
    if (userToEdit) {
      setDisplayName(userToEdit.displayName);
      setEmail(userToEdit.email);
      setPassword(userToEdit.passwordHash || "");
      setRole(userToEdit.role);
      setDepartment(userToEdit.department || "");
      setPhone(userToEdit.phone || "");
      setStatus(userToEdit.status);
      setPermissions(userToEdit.permissions || []);
    } else {
      setDisplayName("");
      setEmail("");
      setPassword("");
      setRole("tecnico");
      setDepartment("Operaciones NOC");
      setPhone("+593 ");
      setStatus("activo");
      setPermissions(["manage_tickets"]);
    }
  }, [userToEdit, isOpen]);

  if (!isOpen) return null;

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    if (newRole === "superadmin") {
      setPermissions(["all", "manage_users", "manage_vault", "manage_clients", "manage_network", "manage_tickets", "manage_finance", "manage_policies", "export_reports"]);
      setDepartment("Presidencia / Gerencia General");
    } else if (newRole === "admin") {
      setPermissions(["manage_vault", "manage_clients", "manage_network", "manage_tickets", "manage_finance", "manage_policies", "export_reports"]);
      setDepartment("Gerencia Operativa");
    } else if (newRole === "finanzas") {
      setPermissions(["manage_finance", "manage_clients", "export_reports"]);
      setDepartment("Contabilidad & Cobranzas");
    } else if (newRole === "tecnico") {
      setPermissions(["manage_network", "manage_tickets", "manage_clients"]);
      setDepartment("Ingeniería NOC & MikroTik");
    } else if (newRole === "soporte") {
      setPermissions(["manage_tickets"]);
      setDepartment("Mesa de Ayuda NOC");
    } else if (newRole === "legal") {
      setPermissions(["manage_policies", "export_reports"]);
      setDepartment("Asesoría Jurídica & ARCOTEL");
    } else {
      setPermissions(["export_reports"]);
      setDepartment("Auditoría / Consulta");
    }
  };

  const handleTogglePermission = (permId: SystemPermission) => {
    if (permId === "all") {
      if (permissions.includes("all")) {
        setPermissions([]);
      } else {
        setPermissions(ALL_PERMISSIONS.map((p) => p.id));
      }
      return;
    }

    if (permissions.includes(permId)) {
      setPermissions(permissions.filter((p) => p !== permId && p !== "all"));
    } else {
      setPermissions([...permissions, permId]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!displayName || displayName.trim().length < 3) {
      showError("Nombre Incompleto", "Ingresa el nombre y apellido completo del operador.");
      return;
    }

    const emailVal = validateEmail(email);
    if (!emailVal.isValid) {
      showError("Correo Inválido", emailVal.error || "Ingresa un correo electrónico corporativo válido.");
      return;
    }

    if (!userToEdit && (!password || password.length < 6)) {
      showError("Contraseña Insegura", "La contraseña de acceso debe contener al menos 6 caracteres.");
      return;
    }

    // Protection: Only Super Admin can promote/create superadmins
    if (role === "superadmin" && currentUser.role !== "superadmin") {
      showError("Permiso Denegado", "Solo un Super Administrador puede asignar el rol de Super Admin.");
      return;
    }

    if (userToEdit) {
      updateSystemUser(userToEdit.uid, {
        displayName,
        email: email.trim().toLowerCase(),
        role,
        department,
        phone,
        status,
        permissions,
        ...(password ? { passwordHash: password } : {}),
      });
      showSuccess("Operador Actualizado", `Los datos y permisos de ${displayName} han sido actualizados.`);
    } else {
      addSystemUser({
        displayName,
        email: email.trim().toLowerCase(),
        passwordHash: password,
        role,
        department,
        phone,
        status,
        permissions,
      });
      showSuccess("Operador Creado", `El usuario ${displayName} (${email}) ya puede ingresar al sistema.`);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shadow-xs">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                {userToEdit ? "Editar Operador & Permisos" : "Registrar Nuevo Usuario / Operador"}
              </h3>
              <p className="text-[11px] text-slate-400">
                Control de acceso RBAC, roles departamentales y credenciales
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Names and Email */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Nombre Completo *</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  placeholder="Ing. Carlos Mendoza"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 font-semibold text-slate-900 focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Correo Electrónico (Login) *</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  placeholder="operador@inntelcorp.ec"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 font-semibold text-slate-900 focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>
          </div>

          {/* Password & Role */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                {userToEdit ? "Nueva Contraseña (dejar vacío para no cambiar)" : "Contraseña de Acceso *"}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type={showPassword ? "text" : "password"}
                  required={!userToEdit}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-9 py-2 font-mono text-slate-900 focus:ring-2 focus:ring-sky-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Rol / Perfil del Sistema *</label>
              <select
                value={role}
                onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800 focus:ring-2 focus:ring-sky-500"
              >
                <option value="superadmin">👑 Super Administrador (Control Total)</option>
                <option value="admin">🛡️ Administrador General</option>
                <option value="finanzas">💰 Finanzas & Cobranzas</option>
                <option value="tecnico">📡 Ingeniería NOC & MikroTik</option>
                <option value="soporte">🎧 Soporte Helpdesk & Cuadrillas</option>
                <option value="legal">⚖️ Asesoría Jurídica & ARCOTEL</option>
                <option value="consulta">👁️ Solo Consulta / Auditor</option>
              </select>
            </div>
          </div>

          {/* Department & Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Departamento / Cargo</label>
              <div className="relative">
                <Building className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Gerencia NOC / Operaciones"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Estado de la Cuenta</label>
              <div className="flex items-center gap-3 pt-1">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="userStatus"
                    value="activo"
                    checked={status === "activo"}
                    onChange={() => setStatus("activo")}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-bold text-emerald-700">Activo (Habilitado)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="userStatus"
                    value="inactivo"
                    checked={status === "inactivo"}
                    onChange={() => setStatus("inactivo")}
                    className="text-rose-600 focus:ring-rose-500"
                  />
                  <span className="font-bold text-rose-600">Inactivo (Bloqueado)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Granular Permission Matrix */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-sky-600" /> Matriz Granular de Permisos (RBAC)
              </span>
              <span className="text-[10px] text-slate-400">Selecciona los módulos autorizados</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
              {ALL_PERMISSIONS.map((perm) => {
                const isChecked = permissions.includes("all") || permissions.includes(perm.id);

                return (
                  <label
                    key={perm.id}
                    className={`flex items-start gap-2 p-2 rounded-xl transition-colors cursor-pointer border ${
                      isChecked
                        ? "bg-white border-sky-200 shadow-2xs"
                        : "bg-transparent border-transparent hover:bg-white/60"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleTogglePermission(perm.id)}
                      className="mt-0.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                    />
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 text-[11px] truncate">{perm.label}</p>
                      <p className="text-[10px] text-slate-400 leading-tight">{perm.desc}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Footer Action */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl font-bold shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              {userToEdit ? "Guardar Cambios" : "Crear Usuario"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
