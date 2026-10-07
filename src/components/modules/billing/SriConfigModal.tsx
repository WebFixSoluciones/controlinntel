"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Settings,
  Building2,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Server,
  Key,
} from "lucide-react";
import { useApp } from "@/lib/state";
import { SriCompanyConfig } from "@/types";

interface SriConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SriConfigModal({ isOpen, onClose }: SriConfigModalProps) {
  const { sriCompanyConfig, updateSriConfig } = useApp();

  const [form, setForm] = useState<SriCompanyConfig>({
    id: "sri-config-inntel",
    ruc: "1792458921001",
    razonSocial: "INNTEL CORP S.A.",
    nombreComercial: "INNTEL CORP - SOLUCIONES INTEGRALES",
    direccionMatriz: "Av. Amazonas N45-12 y Gaspar de Villarroel, Quito, Ecuador",
    direccionEstablecimiento: "Av. Amazonas N45-12 y Gaspar de Villarroel, Quito, Ecuador",
    establecimiento: "001",
    puntoEmision: "001",
    obligadoContabilidad: true,
    tipoContribuyente: "general",
    ambiente: "1",
    emailNotificaciones: "facturacion@inntelcorp.com",
    telefonoContacto: "+593 2 394 5000",
    certificadoNombre: "INNTEL_CORP_FIRMA_ELECTRONICA.p12",
    certificadoVencimiento: "2027-12-31",
    certificadoEmisor: "Security Data S.A. / Banco Central del Ecuador",
    certificadoClave: "••••••••",
    certificadoCargado: true,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);

  useEffect(() => {
    if (isOpen && sriCompanyConfig) {
      setForm((prev) => ({
        ...prev,
        ...sriCompanyConfig,
      }));
      setSuccessMsg(false);
    }
  }, [isOpen, sriCompanyConfig]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await updateSriConfig(form);
      setSuccessMsg(true);
      setTimeout(() => {
        setSuccessMsg(false);
        onClose();
      }, 1000);
    } catch (e) {
      console.error("Error al actualizar configuración SRI:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-[6px] shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[6px] bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400">
              <Settings className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Parámetros Tributarios
              </span>
              <h2 className="text-base font-black text-white">
                Configuración del Emisor SRI
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-[6px] text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {successMsg && (
            <div className="p-3.5 rounded-[6px] bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>Configuración SRI guardada con éxito.</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                R.U.C. del Emisor *:
              </label>
              <input
                type="text"
                required
                value={form.ruc}
                onChange={(e) => setForm({ ...form, ruc: e.target.value })}
                className="w-full text-xs font-mono font-bold rounded-[6px] border border-slate-300 p-2.5 bg-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Ambiente de Facturación *:
              </label>
              <select
                value={form.ambiente}
                onChange={(e) => setForm({ ...form, ambiente: e.target.value as any })}
                className="w-full text-xs font-semibold rounded-[6px] border border-slate-300 p-2.5 bg-white"
              >
                <option value="1">1 - Pruebas / Homologación SRI</option>
                <option value="2">2 - Producción Oficial SRI</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Razón Social *:
              </label>
              <input
                type="text"
                required
                value={form.razonSocial}
                onChange={(e) => setForm({ ...form, razonSocial: e.target.value })}
                className="w-full text-xs font-semibold rounded-[6px] border border-slate-300 p-2.5 bg-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Nombre Comercial:
              </label>
              <input
                type="text"
                value={form.nombreComercial}
                onChange={(e) => setForm({ ...form, nombreComercial: e.target.value })}
                className="w-full text-xs rounded-[6px] border border-slate-300 p-2.5 bg-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Establecimiento (3 dígitos) *:
              </label>
              <input
                type="text"
                required
                maxLength={3}
                value={form.establecimiento}
                onChange={(e) => setForm({ ...form, establecimiento: e.target.value })}
                className="w-full text-xs font-mono font-bold rounded-[6px] border border-slate-300 p-2.5 bg-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Punto de Emisión (3 dígitos) *:
              </label>
              <input
                type="text"
                required
                maxLength={3}
                value={form.puntoEmision}
                onChange={(e) => setForm({ ...form, puntoEmision: e.target.value })}
                className="w-full text-xs font-mono font-bold rounded-[6px] border border-slate-300 p-2.5 bg-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Dirección Matriz *:
              </label>
              <input
                type="text"
                required
                value={form.direccionMatriz}
                onChange={(e) => setForm({ ...form, direccionMatriz: e.target.value })}
                className="w-full text-xs rounded-[6px] border border-slate-300 p-2.5 bg-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Dirección Sucursal / Punto de Emisión *:
              </label>
              <input
                type="text"
                required
                value={form.direccionEstablecimiento}
                onChange={(e) => setForm({ ...form, direccionEstablecimiento: e.target.value })}
                className="w-full text-xs rounded-[6px] border border-slate-300 p-2.5 bg-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Email para Notificaciones:
              </label>
              <input
                type="email"
                value={form.emailNotificaciones || ""}
                onChange={(e) => setForm({ ...form, emailNotificaciones: e.target.value })}
                className="w-full text-xs rounded-[6px] border border-slate-300 p-2.5 bg-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Teléfono de Contacto:
              </label>
              <input
                type="text"
                value={form.telefonoContacto || ""}
                onChange={(e) => setForm({ ...form, telefonoContacto: e.target.value })}
                className="w-full text-xs rounded-[6px] border border-slate-300 p-2.5 bg-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Tipo Contribuyente:
              </label>
              <select
                value={form.tipoContribuyente}
                onChange={(e) => setForm({ ...form, tipoContribuyente: e.target.value as any })}
                className="w-full text-xs font-semibold rounded-[6px] border border-slate-300 p-2.5 bg-white"
              >
                <option value="general">Régimen General</option>
                <option value="rimpe_emprendedor">RIMPE Emprendedor</option>
                <option value="rimpe_popular">RIMPE Negocio Popular</option>
              </select>
            </div>

            <div className="flex items-center gap-3 pt-6">
              <input
                type="checkbox"
                id="obligadoContabilidadModal"
                checked={form.obligadoContabilidad}
                onChange={(e) => setForm({ ...form, obligadoContabilidad: e.target.checked })}
                className="w-4 h-4 rounded-[4px] text-[#004ac6] border-slate-300"
              />
              <label htmlFor="obligadoContabilidadModal" className="text-xs font-bold text-slate-800 cursor-pointer">
                Obligado a Llevar Contabilidad
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-[6px] text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              Cerrar
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-[6px] bg-[#004ac6] hover:bg-[#003ca3] disabled:opacity-50 text-white text-xs font-bold shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Guardar Configuración SRI</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
