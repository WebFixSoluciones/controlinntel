"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import {
  Users,
  ShieldCheck,
  Plus,
  KeyRound,
  UserCheck,
  UserX,
  Search,
  Lock,
  Mail,
  Building,
  X,
} from "lucide-react";
import { SystemUser, UserRole } from "@/types";
import { UserPermissionsModal } from "./UserPermissionsModal";

export function UsersManager() {
  const { systemUsers, addSystemUser, toggleUserStatus, currentUser } = useApp();
  const { showSuccess, showError, showConfirm } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserForPermissions, setSelectedUserForPermissions] = useState<SystemUser | null>(null);

  // New User State
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("tecnico");
  const [newDept, setNewDept] = useState("Operaciones & Red");
  const [newPassword, setNewPassword] = useState("");

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newEmail.includes("@")) {
      showError("Email Inválido", "Ingresa un correo corporativo válido.");
      return;
    }
    if (!newName.trim()) {
      showError("Nombre Requerido", "Ingresa el nombre completo del usuario.");
      return;
    }
    if (newPassword.length < 6) {
      showError("Contraseña Corta", "La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    try {
      await addSystemUser({
        email: newEmail.trim().toLowerCase(),
        displayName: newName.trim(),
        role: newRole,
        department: newDept.trim(),
        status: "activo",
        passwordHash: newPassword,
        permissions: ["all"],
      });

      showSuccess("Usuario Creado", `Usuario ${newName} registrado con rol ${newRole}.`);
      setIsAddUserModalOpen(false);
      setNewEmail("");
      setNewName("");
      setNewPassword("");
    } catch (err: any) {
      showError("Error al Crear", err?.message || "No se pudo registrar el usuario.");
    }
  };

  const handleToggleStatus = (u: SystemUser) => {
    if (u.uid === currentUser.uid) {
      showError("Acción Bloqueada", "No puedes desactivar tu propio usuario en sesión activa.");
      return;
    }

    showConfirm(
      u.status === "activo" ? "Suspender Usuario" : "Activar Usuario",
      `¿Deseas ${u.status === "activo" ? "suspender" : "activar"} el acceso de ${u.displayName}?`,
      async () => {
        try {
          await toggleUserStatus(u.uid);
          showSuccess("Estado Actualizado", `El usuario ${u.displayName} ahora está ${u.status === "activo" ? "inactivo" : "activo"}.`);
        } catch (err: any) {
          showError("Error", err?.message || "No se pudo cambiar el estado.");
        }
      }
    );
  };

  const filteredUsers = systemUsers.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      u.displayName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.department && u.department.toLowerCase().includes(q)) ||
      u.role.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 select-none">
      {/* Unified Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-[#737686] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar usuario por nombre, email o rol..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#f8f9ff] border border-[#e2e8f0] rounded-xl text-xs text-[#0b1c30] placeholder-[#737686] focus:outline-hidden focus:border-[#004ac6] transition-colors"
          />
        </div>

        <button
          onClick={() => setIsAddUserModalOpen(true)}
          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer whitespace-nowrap w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Añadir Colaborador</span>
        </button>
      </div>

      {/* Table of Users */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-[#f8f9ff] text-[#434655] border-b border-[#e2e8f0]">
            <tr>
              <th className="py-3 px-4 font-bold">Colaborador / Usuario</th>
              <th className="py-3 px-4 font-bold">Rol Principal</th>
              <th className="py-3 px-4 font-bold">Departamento</th>
              <th className="py-3 px-4 font-bold text-center">Estado</th>
              <th className="py-3 px-4 font-bold text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e2e8f0]">
            {filteredUsers.map((u) => {
              const isActive = u.status === "activo";

              return (
                <tr key={u.uid} className="hover:bg-[#f8f9ff]/60 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#004ac6]/10 text-[#004ac6] font-bold flex items-center justify-center text-xs">
                        {u.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-[#0b1c30] flex items-center gap-1.5">
                          <span>{u.displayName}</span>
                          {u.uid === currentUser.uid && (
                            <span className="text-[10px] px-1.5 py-0.2 bg-[#eff4ff] text-[#004ac6] font-bold rounded">
                              Tú
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#737686]">{u.email}</div>
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-4">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#eff4ff] text-[#004ac6] border border-[#bfdbfe] capitalize">
                      {u.role}
                    </span>
                  </td>

                  <td className="py-3 px-4 text-[#434655]">
                    {u.department || "General"}
                  </td>

                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isActive
                          ? "bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0]"
                          : "bg-[#fef2f2] text-[#dc2626] border border-[#fecaca]"
                      }`}
                    >
                      {isActive ? "Activo" : "Suspendido"}
                    </span>
                  </td>

                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setSelectedUserForPermissions(u)}
                        className="flex items-center gap-1 px-3 py-1 bg-[#eff4ff] hover:bg-[#dbeafe] text-[#004ac6] rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        title="Modificar permisos y visibilidad de submódulos"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Permisos & Módulos</span>
                      </button>

                      {u.uid !== currentUser.uid && (
                        <button
                          onClick={() => handleToggleStatus(u)}
                          className={`p-1.5 rounded-lg text-xs transition-colors ${
                            isActive
                              ? "text-[#dc2626] hover:bg-[#fef2f2]"
                              : "text-[#059669] hover:bg-[#ecfdf5]"
                          }`}
                          title={isActive ? "Suspender acceso" : "Reactivar acceso"}
                        >
                          {isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal Nuevo Usuario */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#e2e8f0] w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8f9ff]">
              <div>
                <h3 className="text-base font-bold text-[#0b1c30]">Añadir Nuevo Colaborador</h3>
                <p className="text-xs text-[#737686]">Crea un usuario para el equipo de INNTEL CORP</p>
              </div>
              <button onClick={() => setIsAddUserModalOpen(false)} className="p-1.5 rounded-lg text-[#737686] hover:bg-[#e2e8f0]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">Nombre Completo *</label>
                <input
                  type="text"
                  placeholder="ej. Ing. Carlos Mendoza"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">Correo Electrónico *</label>
                <input
                  type="email"
                  placeholder="carlos.mendoza@inntelcorp.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">Rol Inicial *</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg capitalize font-bold"
                  >
                    <option value="tecnico">Técnico NOC</option>
                    <option value="admin">Administrador</option>
                    <option value="finanzas">Finanzas</option>
                    <option value="soporte">Soporte</option>
                    <option value="legal">Legal</option>
                    <option value="consulta">Consulta</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">Departamento</label>
                  <input
                    type="text"
                    placeholder="ej. Redes & NOC"
                    value={newDept}
                    onChange={(e) => setNewDept(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">Contraseña Temporal *</label>
                <input
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#e2e8f0]">
                <button type="button" onClick={() => setIsAddUserModalOpen(false)} className="px-4 py-2 font-semibold text-[#434655]">
                  Cancelar
                </button>
                <button type="submit" className="px-5 py-2.5 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-xl font-bold shadow-xs cursor-pointer">
                  Crear Usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Permissions Modal */}
      {selectedUserForPermissions && (
        <UserPermissionsModal
          user={selectedUserForPermissions}
          isOpen={!!selectedUserForPermissions}
          onClose={() => setSelectedUserForPermissions(null)}
        />
      )}
    </div>
  );
}
