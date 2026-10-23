"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import {
  ShieldCheck,
  Plus,
  UserCheck,
  UserX,
  Search,
  Pencil,
  Trash2,
  Users as UsersIcon,
} from "lucide-react";
import { SystemUser, UserModulePermissions } from "@/types";
import { UserFormView } from "./UserFormView";

export function UsersManager() {
  const {
    systemUsers,
    addSystemUser,
    updateSystemUser,
    deleteSystemUser,
    toggleUserStatus,
    currentUser,
  } = useApp();
  const { showSuccess, showError, showConfirm } = useToast();

  const [viewMode, setViewMode] = useState<"list" | "form">("list");
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Listen to navigation reset
  useEffect(() => {
    const handleReset = (event: any) => {
      const detail = event?.detail;
      if (detail?.href === "/personas" || detail?.key === "usuarios_equipo") {
        setViewMode("list");
        setSelectedUser(null);
      }
    };
    window.addEventListener("inntel:reset-submodule-view", handleReset);
    return () => {
      window.removeEventListener("inntel:reset-submodule-view", handleReset);
    };
  }, []);

  const handleOpenCreate = () => {
    setSelectedUser(null);
    setViewMode("form");
  };

  const handleOpenEdit = (u: SystemUser) => {
    setSelectedUser(u);
    setViewMode("form");
  };

  const handleSaveUser = async (
    userData: Partial<SystemUser>,
    permissions: UserModulePermissions
  ) => {
    try {
      if (selectedUser) {
        await updateSystemUser(selectedUser.uid, {
          ...userData,
          modulePermissions: permissions,
        });
        showSuccess(
          "Colaborador Actualizado",
          `Datos y permisos de ${userData.displayName || selectedUser.displayName} actualizados correctamente.`
        );
      } else {
        await addSystemUser({
          email: userData.email || "",
          displayName: userData.displayName || "",
          role: userData.role || "tecnico",
          department: userData.department || "Operaciones & Red",
          status: userData.status || "activo",
          passwordHash: userData.passwordHash || "123456",
          phone: userData.phone,
          permissions: ["all"],
          modulePermissions: permissions,
        });
        showSuccess(
          "Colaborador Creado",
          `Usuario ${userData.displayName} incorporado al equipo con rol ${userData.role}.`
        );
      }
      setViewMode("list");
      setSelectedUser(null);
    } catch (err: any) {
      showError("Error al Guardar", err?.message || "No se pudo guardar la información del colaborador.");
      throw err;
    }
  };

  const handleDeleteUser = (u: SystemUser) => {
    if (u.uid === currentUser.uid || u.role === "superadmin") {
      showError("Acción Bloqueada", "No puedes eliminar la cuenta principal de Administrador.");
      return;
    }

    showConfirm(
      "Eliminar Usuario Definitivamente",
      `¿Estás seguro de eliminar la cuenta de ${u.displayName} (${u.email})? Esta acción la borrará del sistema.`,
      async () => {
        try {
          const ok = await deleteSystemUser(u.uid);
          if (ok) {
            showSuccess("Usuario Eliminado", `La cuenta de ${u.displayName} ha sido eliminada.`);
          } else {
            showError("No Permitido", "No se puede eliminar al único superadministrador del sistema.");
          }
        } catch (err: any) {
          showError("Error al Eliminar", err?.message || "No se pudo eliminar el usuario.");
        }
      }
    );
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
          showSuccess(
            "Estado Actualizado",
            `El usuario ${u.displayName} ahora está ${u.status === "activo" ? "inactivo" : "activo"}.`
          );
        } catch (err: any) {
          showError("Error", err?.message || "No se pudo cambiar el estado.");
        }
      }
    );
  };

  // Render Full Screen Form
  if (viewMode === "form") {
    return (
      <UserFormView
        user={selectedUser}
        onSave={handleSaveUser}
        onCancel={() => {
          setViewMode("list");
          setSelectedUser(null);
        }}
      />
    );
  }

  const safeUsers = Array.isArray(systemUsers) ? systemUsers.filter(Boolean) : [];
  const filteredUsers = safeUsers.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (u.displayName || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.department || "").toLowerCase().includes(q) ||
      (u.role || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 select-none animate-in fade-in duration-150">
      {/* Unified Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-[#737686] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar colaborador por nombre, email o rol..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#f8f9ff] border border-[#e2e8f0] rounded-xl text-xs text-[#0b1c30] placeholder-[#737686] focus:outline-hidden focus:border-[#004ac6] transition-colors"
          />
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer whitespace-nowrap w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Usuario</span>
        </button>
      </div>

      {/* Table of Users */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-lumina-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[850px]">
            <caption className="sr-only">Directorio de Colaboradores y Usuarios</caption>
            <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-[11px] uppercase tracking-wider border-b border-[#e2e8f0]">
              <tr>
                <th scope="col" className="py-3.5 px-5">Usuario</th>
                <th scope="col" className="py-3.5 px-5">Rol</th>
                <th scope="col" className="py-3.5 px-5">Área</th>
                <th scope="col" className="py-3.5 px-5 text-center">Estado</th>
                <th scope="col" className="py-3.5 px-5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9] text-[#0b1c30]">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-xs text-[#737686]">
                    <UsersIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-bold text-slate-600">No se encontraron colaboradores con los criterios ingresados.</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isActive = u.status === "activo";

                  return (
                    <tr key={u.uid} className="hover:bg-[#f8f9ff] transition-colors">
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#004ac6]/10 text-[#004ac6] font-bold flex items-center justify-center text-xs">
                            {(u.displayName || "U").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-[#0b1c30] text-sm flex items-center gap-1.5">
                              <span>{u.displayName || "Sin Nombre"}</span>
                              {u.uid === currentUser?.uid && (
                                <span className="text-[10px] px-2 py-0.5 bg-[#eff4ff] text-[#004ac6] font-bold rounded-full border border-blue-200">
                                  Tú
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[#737686] font-mono mt-0.5">{u.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-5">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#eff4ff] text-[#004ac6] border border-[#bfdbfe] capitalize">
                          {u.role === "superadmin" ? "Superadmin" : u.role}
                        </span>
                      </td>

                      <td className="py-4 px-5 text-[#434655]">
                        <span className="font-medium text-xs">{u.department || "General"}</span>
                      </td>

                      <td className="py-4 px-5 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isActive
                              ? "bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0]"
                              : "bg-[#fef2f2] text-[#dc2626] border border-[#fecaca]"
                          }`}
                        >
                          {isActive ? "Activo" : "Suspendido"}
                        </span>
                      </td>

                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(u)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#eff4ff] hover:bg-[#dbeafe] text-[#004ac6] rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                            title="Editar usuario y matriz de permisos"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Permisos</span>
                          </button>

                          {u.uid !== currentUser?.uid && u.role !== "superadmin" && (
                            <>
                              <button
                                onClick={() => handleToggleStatus(u)}
                                className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                                  isActive
                                    ? "text-amber-600 hover:bg-amber-50"
                                    : "text-[#059669] hover:bg-[#ecfdf5]"
                                }`}
                                title={isActive ? "Suspender acceso" : "Reactivar acceso"}
                              >
                                {isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                              </button>

                              <button
                                onClick={() => handleDeleteUser(u)}
                                className="p-1.5 rounded-lg text-[#dc2626] hover:bg-[#fef2f2] transition-colors cursor-pointer"
                                title="Eliminar colaborador"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Institutional Table Footer */}
        <div className="p-3 px-5 border-t border-[#e2e8f0] bg-[#f8f9ff] flex items-center justify-between text-xs text-[#737686]">
          <span>
            Total colaboradores: <strong className="text-[#0b1c30]">{safeUsers.length}</strong>
            {filteredUsers.length !== safeUsers.length && (
              <span className="ml-1 text-[#004ac6]">({filteredUsers.length} mostrados)</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
