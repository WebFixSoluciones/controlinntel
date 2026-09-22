"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { SystemUser, UserRole } from "@/types";
import { UserModal } from "./UserModal";
import {
  Users,
  UserPlus,
  ShieldCheck,
  ShieldAlert,
  Search,
  KeyRound,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  Crown,
  Shield,
  Filter,
  Lock,
} from "lucide-react";

export function UserManager() {
  const { systemUsers, deleteSystemUser, toggleUserStatus, currentUser } = useApp();
  const { showSuccess, showError, showConfirm } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<SystemUser | null>(null);
  const [filterQuery, setFilterQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("todos");

  const totalUsers = systemUsers.length;
  const superAdminsCount = systemUsers.filter((u) => u.role === "superadmin").length;
  const activeCount = systemUsers.filter((u) => u.status === "activo").length;
  const inactiveCount = systemUsers.filter((u) => u.status === "inactivo").length;

  const filteredUsers = systemUsers.filter((u) => {
    const matchesText =
      u.displayName.toLowerCase().includes(filterQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(filterQuery.toLowerCase()) ||
      (u.department && u.department.toLowerCase().includes(filterQuery.toLowerCase()));
    const matchesRole = roleFilter === "todos" || u.role === roleFilter;
    return matchesText && matchesRole;
  });

  const handleOpenNew = () => {
    setUserToEdit(null);
    setIsModalOpen(true);
  };

  const handleEdit = (user: SystemUser) => {
    setUserToEdit(user);
    setIsModalOpen(true);
  };

  const handleDelete = (user: SystemUser) => {
    if (user.role === "superadmin" && superAdminsCount <= 1) {
      showError("Acción Bloqueada", "No es posible eliminar al único Super Administrador del sistema.");
      return;
    }

    if (user.uid === currentUser.uid) {
      showError("Acción Bloqueada", "No puedes eliminar tu propia cuenta en sesión activa.");
      return;
    }

    showConfirm(
      "¿Eliminar Usuario?",
      `¿Confirmas la revocación total del acceso para ${user.displayName} (${user.email})?`,
      async () => {
    try {

        const ok = await deleteSystemUser(user.uid);
        if (ok) {
          showSuccess("Usuario Eliminado", `La cuenta de ${user.displayName} ha sido removida del sistema.`);
        } else {
          showError("Error", "No se pudo eliminar el usuario.");
        }
      
    } catch (error) { window.dispatchEvent(new CustomEvent("inntel:error", { detail: error instanceof Error ? error.message : "No se pudo guardar." })); }
},
      "Eliminar Acceso"
    );
  };

  const handleToggleStatus = async (user: SystemUser) => {
    try {

    if (user.role === "superadmin" && user.status === "activo" && superAdminsCount <= 1) {
      showError("Acción Bloqueada", "No puedes desactivar al único Super Administrador del sistema.");
      return;
    }

    await toggleUserStatus(user.uid);
    const newStatus = user.status === "activo" ? "inactivo" : "activo";
    showSuccess(
      "Estado Actualizado",
      `Usuario ${user.displayName} marcado como ${newStatus.toUpperCase()}.`
    );
  
    } catch (error) { window.dispatchEvent(new CustomEvent("inntel:error", { detail: error instanceof Error ? error.message : "No se pudo guardar." })); }
};

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case "superadmin":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-gradient-to-r from-amber-100 to-amber-200 text-amber-900 border border-amber-300 shadow-2xs">
            <Crown className="w-3 h-3 text-amber-600" /> Super Admin
          </span>
        );
      case "admin":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-sky-100 text-sky-800 border border-sky-200">
            <Shield className="w-3 h-3 text-sky-600" /> Administrador
          </span>
        );
      case "finanzas":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
            Finanzas & Cobranzas
          </span>
        );
      case "tecnico":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-indigo-100 text-indigo-800 border border-indigo-200">
            Ingeniería NOC
          </span>
        );
      case "soporte":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-100 text-blue-800 border border-blue-200">
            Soporte Helpdesk
          </span>
        );
      case "legal":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-100 text-purple-800 border border-purple-200">
            Legal & ARCOTEL
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
            Consulta
          </span>
        );
    }
  };

  return (
    <div className="w-full space-y-6 select-none">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#0b1c30] tracking-tight flex items-center gap-2">
            <Crown className="w-6 h-6 text-amber-500" />
            Configuración del Sistema: Control de Usuarios & Permisos RBAC
          </h2>
        </div>

        <button
          onClick={handleOpenNew}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Nuevo Usuario / Operador</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-[#e2e8f0] shadow-lumina-card">
          <span className="text-[10px] font-bold text-[#737686] uppercase tracking-wider block">Total Usuarios</span>
          <span className="text-xl font-black text-[#0b1c30] mt-1 block">{totalUsers}</span>
          <span className="text-[11px] text-[#737686]">Operadores registrados</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#e2e8f0] shadow-lumina-card">
          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Super Administradores</span>
          <span className="text-xl font-black text-amber-700 mt-1 block">{superAdminsCount}</span>
          <span className="text-[11px] text-amber-600 font-bold">Control total del sistema</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#e2e8f0] shadow-lumina-card">
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Cuentas Activas</span>
          <span className="text-xl font-black text-emerald-700 mt-1 block">{activeCount}</span>
          <span className="text-[11px] text-emerald-600 font-bold">Habilitados para login</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#e2e8f0] shadow-lumina-card">
          <span className="text-[10px] font-bold text-[#737686] uppercase tracking-wider block">Bloqueados / Inactivos</span>
          <span className="text-xl font-black text-[#434655] mt-1 block">{inactiveCount}</span>
          <span className="text-[11px] text-[#737686]">Acceso suspendido</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#e2e8f0] shadow-lumina-card flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 max-w-lg">
          <Search className="w-4 h-4 text-[#737686] absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Buscar por nombre, correo o departamento..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full bg-white border border-[#cbd5e1] rounded-lg pl-9 pr-3 py-1.5 text-xs text-[#0b1c30] focus:outline-hidden focus:border-[#004ac6] font-medium"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-[#737686]" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-white text-xs font-semibold text-[#434655] rounded-lg px-3 py-1.5 border border-[#cbd5e1] focus:outline-hidden cursor-pointer"
          >
            <option value="todos">Todos los Roles</option>
            <option value="superadmin">Super Admin</option>
            <option value="admin">Administrador</option>
            <option value="finanzas">Finanzas & Cobranzas</option>
            <option value="tecnico">Ingeniería NOC</option>
            <option value="soporte">Soporte Helpdesk</option>
            <option value="legal">Legal & ARCOTEL</option>
            <option value="consulta">Solo Consulta</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-lumina-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-[11px] uppercase tracking-wider border-b border-[#e2e8f0]">
              <tr>
                <th className="py-3.5 px-5">Operador / Correo</th>
                <th className="py-3.5 px-5">Rol & Nivel</th>
                <th className="py-3.5 px-5">Departamento</th>
                <th className="py-3.5 px-5">Permisos Asignados</th>
                <th className="py-3.5 px-5">Estado</th>
                <th className="py-3.5 px-5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9] font-medium text-[#434655]">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#737686] italic">
                    No se encontraron usuarios con el criterio de búsqueda.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isSuper = u.role === "superadmin";

                  return (
                    <tr key={u.uid} className="hover:bg-[#f8f9ff] transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shadow-2xs ${
                              isSuper
                                ? "bg-gradient-to-br from-amber-400 to-amber-600 text-white ring-2 ring-amber-200"
                                : "bg-gradient-to-br from-sky-600 to-purple-600 text-white"
                            }`}
                          >
                            {u.displayName.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 flex items-center gap-1.5">
                              {u.displayName}
                              {u.uid === currentUser.uid && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-sky-100 text-sky-800">
                                  Tú
                                </span>
                              )}
                            </p>
                            <span className="font-mono text-[11px] text-slate-400">{u.email}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">{getRoleBadge(u.role)}</td>

                      <td className="py-3.5 px-4 text-slate-600 font-medium">
                        {u.department || "Operaciones Generales"}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {u.permissions?.includes("all") ? (
                            <span className="text-[9px] font-bold uppercase bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded">
                              Acceso Total
                            </span>
                          ) : (
                            <>
                              {u.permissions?.includes("manage_network") && (
                                <span className="text-[9px] font-bold bg-blue-50 text-[#004ac6] border border-blue-200 px-1.5 py-0.2 rounded">
                                  Nodos
                                </span>
                              )}
                              {u.permissions?.includes("manage_policies") && (
                                <span className="text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.2 rounded">
                                  Arcotel
                                </span>
                              )}
                              {u.permissions?.includes("manage_finance") && (
                                <span className="text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded">
                                  Cobros
                                </span>
                              )}
                              {u.permissions
                                ?.filter((p) => !["all", "manage_network", "manage_policies", "manage_finance"].includes(p))
                                .slice(0, 2)
                                .map((p) => (
                                  <span
                                    key={p}
                                    className="text-[9px] font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded"
                                  >
                                    {p.replace("manage_", "").replace("export_", "")}
                                  </span>
                                ))}
                            </>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => handleToggleStatus(u)}
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                            u.status === "activo"
                              ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                              : "bg-rose-100 text-rose-800 hover:bg-rose-200"
                          }`}
                          title="Haga clic para cambiar estado"
                        >
                          {u.status === "activo" ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> ACTIVO
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-rose-600" /> INACTIVO
                            </>
                          )}
                        </button>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleEdit(u)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors cursor-pointer"
                            title="Editar usuario y permisos"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDelete(u)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Eliminar usuario"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <UserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        userToEdit={userToEdit}
      />
    </div>
  );
}
