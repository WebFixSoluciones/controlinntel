"use client";

import React, { useState } from "react";
import { useToast } from "@/lib/toast-context";
import { useApp } from "@/lib/state";
import {
  Building2,
  Globe,
  Mail,
  Phone,
  MapPin,
  Save,
  Clock,
  Coins,
  Shield,
  FileText,
} from "lucide-react";

export function GeneralSettingsView() {
  const { showSuccess, showError } = useToast();
  const { sriCompanyConfig, updateSriConfig } = useApp();

  const [companyName, setCompanyName] = useState(sriCompanyConfig?.razonSocial || "INNTEL CORP S.A.");
  const [tradeName, setTradeName] = useState(sriCompanyConfig?.nombreComercial || "INNTEL CORP - SOLUCIONES INTEGRALES");
  const [ruc, setRuc] = useState(sriCompanyConfig?.ruc || "1792458921001");
  const [representative, setRepresentative] = useState("Ing. Carlos Mendoza (Gerente General)");
  const [address, setAddress] = useState(sriCompanyConfig?.direccionMatriz || "Av. Amazonas N45-12 y Gaspar de Villarroel, Quito, Ecuador");
  const [email, setEmail] = useState(sriCompanyConfig?.emailNotificaciones || "contacto@inntelcorp.com");
  const [phone, setPhone] = useState(sriCompanyConfig?.telefonoContacto || "+593 2 394 5000");
  const [website, setWebsite] = useState("https://www.inntelcorp.com");
  const [currency, setCurrency] = useState("USD ($)");
  const [timeZone, setTimeZone] = useState("America/Guayaquil (UTC-5)");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await updateSriConfig({
        razonSocial: companyName,
        nombreComercial: tradeName,
        ruc,
        direccionMatriz: address,
        emailNotificaciones: email,
        telefonoContacto: phone,
      });
      showSuccess(
        "Configuración Guardada",
        "Los parámetros generales de la empresa fueron actualizados correctamente."
      );
    } catch (err: any) {
      showError("Error al Guardar", err?.message || "No se pudieron guardar los parámetros.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs select-none">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300">
            EMPRESA ACTIVA
          </span>
          <span className="text-xs text-slate-500 font-medium hidden md:inline">
            {companyName} • RUC {ruc}
          </span>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#004ac6] hover:bg-[#003da6] disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
        >
          <Save className="w-4 h-4" />
          <span>{isSubmitting ? "Guardando..." : "Guardar Cambios"}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Identidad Corporativa */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <Building2 className="w-4 h-4 text-[#004ac6]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Datos Institucionales de la Empresa
            </h2>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Razón Social *
              </label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full text-xs font-semibold rounded-xl border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nombre Comercial
              </label>
              <input
                type="text"
                value={tradeName}
                onChange={(e) => setTradeName(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  RUC Principal *
                </label>
                <input
                  type="text"
                  required
                  maxLength={13}
                  value={ruc}
                  onChange={(e) => setRuc(e.target.value)}
                  className="w-full text-xs font-mono font-bold rounded-xl border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Representante Legal
                </label>
                <input
                  type="text"
                  value={representative}
                  onChange={(e) => setRepresentative(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Contacto & Presencia Digital */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <Globe className="w-4 h-4 text-[#004ac6]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Canales de Contacto & Domicilio
            </h2>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Dirección Matriz *
              </label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Correo Institucional *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Teléfono Central
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Sitio Web Institucional
              </label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Preferencias del Sistema */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4 lg:col-span-2">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <Coins className="w-4 h-4 text-[#004ac6]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Moneda & Zona Horaria del Sistema
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Moneda Base de Transacciones
              </label>
              <input
                type="text"
                disabled
                value={currency}
                className="w-full text-xs font-semibold rounded-xl border border-slate-200 p-2.5 bg-slate-100 text-slate-600 cursor-not-allowed"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Fijada a Dólar de los Estados Unidos (USD) según normativa tributaria ecuatoriana.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Zona Horaria Legal
              </label>
              <input
                type="text"
                disabled
                value={timeZone}
                className="w-full text-xs font-semibold rounded-xl border border-slate-200 p-2.5 bg-slate-100 text-slate-600 cursor-not-allowed"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Hora Oficial de Ecuador Continental (UTC-5) para timbrado electrónico SRI.
              </span>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
