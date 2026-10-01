"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import {
  X,
  User,
  Mail,
  Phone,
  Building,
  ShieldCheck,
  CheckCircle2,
  Save,
  KeyRound,
} from "lucide-react";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { currentUser, updateSystemUser } = useApp();
  const { showSuccess, showError } = useToast();

  const [displayName, setDisplayName] = useState(currentUser?.displayName || "");
  const [email, setEmail] = useState(currentUser?.email || "");
  const [phone, setPhone] = useState(currentUser?.phone || "");
  const [department, setDepartment] = useState(currentUser?.department || "");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen && currentUser) {
      setDisplayName(currentUser.displayName || "");
      setEmail(currentUser.email || "");
      setPhone(currentUser.phone || "");
      setDepartment(currentUser.department || "");
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      showError("Error de Validación", "El nombre completo es requerido.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      showError("Error de Validación", "Por favor ingresa un correo electrónico válido.");
      return;
    }

    setIsSaving(true);
    try {
      await updateSystemUser(currentUser.uid, {
        displayName: displayName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        department: department.trim(),
      });
      showSuccess("Perfil Actualizado", "Los datos de tu perfil han sido guardados exitosamente.");
      onClose();
    } catch (err: any) {
      showError("Error", err?.message || "No se pudo actualizar el perfil.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 select-none">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#004ac6]/10 text-[#004ac6] flex items-center justify-center shadow-xs">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Gestor de Perfil</h2>
              <p className="text-xs text-slate-500">Administra tu información de cuenta y contacto</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* User Card Banner */}
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-[#eff4ff] to-[#f8faff] border border-[#bfdbfe]/60">
            <div className="w-14 h-14 rounded-2xl bg-[#004ac6] text-white font-bold text-xl flex items-center justify-center shadow-md shrink-0">
              {displayName.charAt(0).toUpperCase() || currentUser.displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 truncate">
                  {displayName || currentUser.displayName}
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Activo
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate">{email || currentUser.email}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#004ac6]/10 text-[#004ac6] capitalize">
                  <ShieldCheck className="w-3 h-3" />
                  {currentUser.role}
                </span>
                {department && (
                  <span className="text-[11px] text-slate-500">
                    • {department}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Datos Personales
            </h4>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Nombre Completo *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Ej. Juan Pérez"
                  required
                  className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-[#004ac6] focus:border-transparent outline-hidden transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Correo Electrónico *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@inntelcorp.com"
                  required
                  className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-[#004ac6] focus:border-transparent outline-hidden transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Teléfono / Móvil
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+593 9..."
                    className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-[#004ac6] focus:border-transparent outline-hidden transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Departamento / Área
                </label>
                <div className="relative">
                  <Building className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Ej. Operaciones NOC"
                    className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-[#004ac6] focus:border-transparent outline-hidden transition"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Readonly Security Info */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <KeyRound className="w-4 h-4 text-slate-500" />
              <span>Seguridad & Credenciales</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Tu rol asignado es <strong className="text-slate-800 capitalize">{currentUser.role}</strong>. Para cambiar permisos de sistema o restablecer contraseñas maestras, contacta a un Super Administrador en la sección de Configuración de Usuarios.
            </p>
            <div className="text-[10px] font-mono text-slate-400">
              UID: {currentUser.uid}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#004ac6] hover:bg-[#003ca3] disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
            >
              {isSaving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Guardar Cambios</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
