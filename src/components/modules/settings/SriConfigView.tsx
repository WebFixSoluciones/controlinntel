"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { SriCompanyConfig } from "@/types";
import {
  Building2,
  CheckCircle2,
  Save,
  ShieldCheck,
  FileCode2,
  Info,
  Server,
  Mail,
  Phone,
  MapPin,
  FileCheck,
} from "lucide-react";

export function SriConfigView() {
  const { sriCompanyConfig, updateSriConfig } = useApp();
  const { showSuccess, showError } = useToast();

  const [form, setForm] = useState<SriCompanyConfig>(() => ({
    id: sriCompanyConfig?.id || "sri-config-inntel",
    ruc: sriCompanyConfig?.ruc || "1792458921001",
    razonSocial: sriCompanyConfig?.razonSocial || "INNTEL CORP S.A.",
    nombreComercial: sriCompanyConfig?.nombreComercial || "INNTEL CORP - SOLUCIONES INTEGRALES",
    direccionMatriz: sriCompanyConfig?.direccionMatriz || "Av. Amazonas N45-12 y Gaspar de Villarroel, Quito, Ecuador",
    direccionEstablecimiento: sriCompanyConfig?.direccionEstablecimiento || "Av. Amazonas N45-12 y Gaspar de Villarroel, Quito, Ecuador",
    establecimiento: sriCompanyConfig?.establecimiento || "001",
    puntoEmision: sriCompanyConfig?.puntoEmision || "001",
    obligadoContabilidad: sriCompanyConfig?.obligadoContabilidad ?? true,
    tipoContribuyente: sriCompanyConfig?.tipoContribuyente || "general",
    ambiente: sriCompanyConfig?.ambiente || "1",
    emailNotificaciones: sriCompanyConfig?.emailNotificaciones || "facturacion@inntelcorp.com",
    telefonoContacto: sriCompanyConfig?.telefonoContacto || "+593 2 394 5000",
    resolucionAgenteRetencion: sriCompanyConfig?.resolucionAgenteRetencion || "",
    contribuyenteEspecial: sriCompanyConfig?.contribuyenteEspecial || "",
  }));

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (sriCompanyConfig) {
      setForm(sriCompanyConfig);
    }
  }, [sriCompanyConfig]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await updateSriConfig(form);
      showSuccess(
        "Configuración SRI Guardada",
        "Los parámetros del emisor tributario fueron actualizados exitosamente."
      );
    } catch (err: any) {
      showError(
        "Error al Guardar",
        err?.message || "No se pudo actualizar la configuración del SRI."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Top Action Bar with Minimalist Status & Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs select-none">
        <div className="flex items-center gap-3">
          <span
            className={`text-xs font-bold px-3 py-1 rounded-full border ${
              form.ambiente === "2"
                ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                : "bg-amber-50 text-amber-700 border-amber-300"
            }`}
          >
            {form.ambiente === "2" ? "SRI PRODUCCIÓN (Oficial)" : "SRI PRUEBAS (Homologación)"}
          </span>
          <span className="text-xs text-slate-500 font-medium hidden md:inline">
            RUC: <strong className="font-mono text-slate-800">{form.ruc}</strong> • Serie:{" "}
            <strong className="font-mono text-slate-800">{form.establecimiento}-{form.puntoEmision}</strong>
          </span>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#004ac6] hover:bg-[#003da6] disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
        >
          <Save className="w-4 h-4" />
          <span>{isSubmitting ? "Guardando..." : "Guardar Configuración SRI"}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sección 1: Parámetros del Emisor y Ambiente SRI */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <Server className="w-4 h-4 text-[#004ac6]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Ambiente & Puntos de Emisión SRI
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ambiente de Facturación Electrónica *
              </label>
              <select
                value={form.ambiente}
                onChange={(e) => setForm({ ...form, ambiente: e.target.value as any })}
                className="w-full text-xs font-semibold rounded-xl border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
              >
                <option value="1">1 - Pruebas / Homologación SRI (Pruebas del Sistema)</option>
                <option value="2">2 - Producción Oficial SRI (Validez Tributaria Legal)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Establecimiento (3 dígitos) *
              </label>
              <input
                type="text"
                required
                maxLength={3}
                value={form.establecimiento}
                onChange={(e) => setForm({ ...form, establecimiento: e.target.value })}
                className="w-full text-xs font-mono font-bold rounded-xl border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
                placeholder="001"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Punto de Emisión (3 dígitos) *
              </label>
              <input
                type="text"
                required
                maxLength={3}
                value={form.puntoEmision}
                onChange={(e) => setForm({ ...form, puntoEmision: e.target.value })}
                className="w-full text-xs font-mono font-bold rounded-xl border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
                placeholder="001"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tipo de Contribuyente *
              </label>
              <select
                value={form.tipoContribuyente}
                onChange={(e) => setForm({ ...form, tipoContribuyente: e.target.value as any })}
                className="w-full text-xs font-semibold rounded-xl border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
              >
                <option value="general">Régimen General</option>
                <option value="rimpe_emprendedor">RIMPE Emprendedor</option>
                <option value="rimpe_popular">RIMPE Negocio Popular</option>
              </select>
            </div>

            <div className="flex items-center gap-3 pt-5">
              <input
                type="checkbox"
                id="obligadoContabilidad"
                checked={form.obligadoContabilidad}
                onChange={(e) => setForm({ ...form, obligadoContabilidad: e.target.checked })}
                className="w-4 h-4 rounded-md text-[#004ac6] border-slate-300 focus:ring-[#004ac6]"
              />
              <label htmlFor="obligadoContabilidad" className="text-xs font-bold text-slate-800 cursor-pointer">
                Obligado a Llevar Contabilidad
              </label>
            </div>
          </div>
        </div>

        {/* Sección 2: Identificación Tributaria & Razón Social */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <Building2 className="w-4 h-4 text-[#004ac6]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Identificación Fiscal del Emisor
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                R.U.C. del Emisor *
              </label>
              <input
                type="text"
                required
                maxLength={13}
                value={form.ruc}
                onChange={(e) => setForm({ ...form, ruc: e.target.value })}
                className="w-full text-xs font-mono font-bold rounded-xl border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
                placeholder="1792458921001"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Razón Social (según Ficha RUC) *
              </label>
              <input
                type="text"
                required
                value={form.razonSocial}
                onChange={(e) => setForm({ ...form, razonSocial: e.target.value })}
                className="w-full text-xs font-semibold rounded-xl border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nombre Comercial
              </label>
              <input
                type="text"
                value={form.nombreComercial}
                onChange={(e) => setForm({ ...form, nombreComercial: e.target.value })}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Sección 3: Domicilio Tributario */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <MapPin className="w-4 h-4 text-[#004ac6]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Dirección & Domicilio Tributario
            </h2>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Dirección Matriz (como consta en el SRI) *
              </label>
              <input
                type="text"
                required
                value={form.direccionMatriz}
                onChange={(e) => setForm({ ...form, direccionMatriz: e.target.value })}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Dirección Sucursal / Establecimiento {form.establecimiento} *
              </label>
              <input
                type="text"
                required
                value={form.direccionEstablecimiento}
                onChange={(e) => setForm({ ...form, direccionEstablecimiento: e.target.value })}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Sección 4: Notificaciones y Resoluciones */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <FileCheck className="w-4 h-4 text-[#004ac6]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Notificaciones & Resoluciones Especiales
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email para Envío de RIDE / XML
              </label>
              <input
                type="email"
                value={form.emailNotificaciones || ""}
                onChange={(e) => setForm({ ...form, emailNotificaciones: e.target.value })}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
                placeholder="facturacion@empresa.com"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Teléfono de Contacto
              </label>
              <input
                type="text"
                value={form.telefonoContacto || ""}
                onChange={(e) => setForm({ ...form, telefonoContacto: e.target.value })}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
                placeholder="+593 2 000 0000"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Resolución Agente de Retención
              </label>
              <input
                type="text"
                value={form.resolucionAgenteRetencion || ""}
                onChange={(e) => setForm({ ...form, resolucionAgenteRetencion: e.target.value })}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
                placeholder="Ej. NAC-DNCRASC20-00000001"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Contribuyente Especial (No. Resolución)
              </label>
              <input
                type="text"
                value={form.contribuyenteEspecial || ""}
                onChange={(e) => setForm({ ...form, contribuyenteEspecial: e.target.value })}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
                placeholder="Opcional"
              />
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
