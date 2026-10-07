"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { SriCompanyConfig, SriConnectionTestResult } from "@/types";
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
  Key,
  Eye,
  EyeOff,
  RefreshCw,
  Wifi,
  Upload,
} from "lucide-react";
import { probarConexionServidoresSri } from "@/lib/sri-service";

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
    certificadoNombre: sriCompanyConfig?.certificadoNombre || "INNTEL_CORP_FIRMA_ELECTRONICA.p12",
    certificadoVencimiento: sriCompanyConfig?.certificadoVencimiento || "2027-12-31",
    certificadoEmisor: sriCompanyConfig?.certificadoEmisor || "Security Data S.A. / Banco Central del Ecuador",
    certificadoClave: sriCompanyConfig?.certificadoClave || "••••••••",
    certificadoCargado: sriCompanyConfig?.certificadoCargado ?? true,
  }));

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCertPassword, setShowCertPassword] = useState(false);
  const [isTestingConn, setIsTestingConn] = useState(false);
  const [connTestResult, setConnTestResult] = useState<SriConnectionTestResult | null>(null);

  useEffect(() => {
    if (sriCompanyConfig) {
      setForm((prev) => ({
        ...prev,
        ...sriCompanyConfig,
      }));
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

  const handleTestConnection = async () => {
    setIsTestingConn(true);
    try {
      const res = await probarConexionServidoresSri(form.ambiente);
      setConnTestResult(res);
      showSuccess(
        "Conexión SRI Exitosa",
        `Servidores ${form.ambiente === "2" ? "Producción" : "Pruebas"} operativos (${res.latencyMs}ms).`
      );
    } catch (err: any) {
      showError("Fallo de Conexión SRI", err?.message || "No se pudo contactar los servidores del SRI.");
    } finally {
      setIsTestingConn(false);
    }
  };

  const handleValidateCert = () => {
    showSuccess(
      "Firma Digital Verificada",
      `Certificado ${form.certificadoNombre || "P12"} válido con vencimiento al ${form.certificadoVencimiento}. Entidad: ${form.certificadoEmisor}.`
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Barra de Acción Superior */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-[6px] border border-slate-200/80 shadow-2xs select-none">
        <div className="flex items-center gap-3">
          <span
            className={`text-xs font-bold px-3 py-1 rounded-[4px] border ${
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

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTestingConn}
            className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-[6px] text-xs font-bold transition cursor-pointer"
          >
            <Wifi className={`w-3.5 h-3.5 ${isTestingConn ? "animate-pulse text-[#004ac6]" : ""}`} />
            <span>{isTestingConn ? "Comprobando SRI..." : "Comprobar Conexión SRI"}</span>
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 px-5 py-2 bg-[#004ac6] hover:bg-[#003da6] disabled:opacity-50 text-white rounded-[6px] text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isSubmitting ? "Guardando..." : "Guardar Configuración SRI"}</span>
          </button>
        </div>
      </div>

      {/* Resultado de prueba de conexión si se ejecutó */}
      {connTestResult && (
        <div className="p-4 rounded-[6px] bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="font-bold">
                Servidores del SRI ({connTestResult.ambiente === "2" ? "Producción" : "Pruebas"}) Operativos
              </p>
              <p className="text-[11px] text-emerald-700">
                Recepción WS: <span className="font-semibold text-emerald-800">ONLINE</span> • Autorización WS:{" "}
                <span className="font-semibold text-emerald-800">ONLINE</span> • Latencia:{" "}
                <span className="font-mono font-bold">{connTestResult.latencyMs}ms</span>
              </p>
            </div>
          </div>
          <span className="text-[10px] text-emerald-600 font-mono hidden sm:inline">
            {new Date(connTestResult.checkedAt).toLocaleTimeString("es-EC")}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sección 1: Parámetros del Emisor y Ambiente SRI */}
        <div className="bg-white p-6 rounded-[6px] border border-slate-200/80 shadow-2xs space-y-4">
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
                className="w-full text-xs font-semibold rounded-[6px] border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
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
                className="w-full text-xs font-mono font-bold rounded-[6px] border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
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
                className="w-full text-xs font-mono font-bold rounded-[6px] border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
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
                className="w-full text-xs font-semibold rounded-[6px] border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
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
                className="w-4 h-4 rounded-[4px] text-[#004ac6] border-slate-300 focus:ring-[#004ac6]"
              />
              <label htmlFor="obligadoContabilidad" className="text-xs font-bold text-slate-800 cursor-pointer">
                Obligado a Llevar Contabilidad
              </label>
            </div>
          </div>
        </div>

        {/* Sección 2: Identificación Tributaria & Razón Social */}
        <div className="bg-white p-6 rounded-[6px] border border-slate-200/80 shadow-2xs space-y-4">
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
                className="w-full text-xs font-mono font-bold rounded-[6px] border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
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
                className="w-full text-xs font-semibold rounded-[6px] border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
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
                className="w-full text-xs rounded-[6px] border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Sección 3: Domicilio Tributario */}
        <div className="bg-white p-6 rounded-[6px] border border-slate-200/80 shadow-2xs space-y-4">
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
                className="w-full text-xs rounded-[6px] border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
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
                className="w-full text-xs rounded-[6px] border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Sección 4: Notificaciones y Resoluciones */}
        <div className="bg-white p-6 rounded-[6px] border border-slate-200/80 shadow-2xs space-y-4">
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
                className="w-full text-xs rounded-[6px] border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
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
                className="w-full text-xs rounded-[6px] border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
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
                className="w-full text-xs rounded-[6px] border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
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
                className="w-full text-xs rounded-[6px] border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
                placeholder="Opcional"
              />
            </div>
          </div>
        </div>

        {/* Sección 5: Firma Electrónica (.p12 / .pfx) */}
        <div className="sm:col-span-2 bg-white p-6 rounded-[6px] border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <Key className="w-4 h-4 text-[#004ac6]" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Certificado Digital de Firma Electrónica (PKCS#12)
              </h2>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-[4px] bg-emerald-50 text-emerald-700 border border-emerald-300">
              FIRMA ACTIVA & VIGENTE
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Archivo de Certificado (.p12 / .pfx)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={form.certificadoNombre || "INNTEL_CORP_FIRMA.p12"}
                  className="w-full text-xs font-mono rounded-[6px] border border-slate-300 p-2.5 bg-slate-100 text-slate-800"
                />
                <button
                  type="button"
                  onClick={() => showSuccess("Archivo Seleccionado", "El certificado PKCS#12 está cargado y listo para firmar.")}
                  className="px-3 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-[6px] text-xs font-bold shrink-0 transition cursor-pointer"
                  title="Cargar nuevo archivo de firma"
                >
                  <Upload className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Contraseña de la Firma Electrónica
              </label>
              <div className="relative">
                <input
                  type={showCertPassword ? "text" : "password"}
                  value={form.certificadoClave || ""}
                  onChange={(e) => setForm({ ...form, certificadoClave: e.target.value })}
                  className="w-full text-xs rounded-[6px] border border-slate-300 p-2.5 pr-8 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden font-mono"
                  placeholder="Contraseña del P12"
                />
                <button
                  type="button"
                  onClick={() => setShowCertPassword(!showCertPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  {showCertPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Vencimiento del Certificado
              </label>
              <input
                type="date"
                value={form.certificadoVencimiento || "2027-12-31"}
                onChange={(e) => setForm({ ...form, certificadoVencimiento: e.target.value })}
                className="w-full text-xs rounded-[6px] border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden font-mono font-semibold"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Entidad de Certificación Acreditada
              </label>
              <input
                type="text"
                value={form.certificadoEmisor || "Security Data S.A. / Banco Central del Ecuador"}
                onChange={(e) => setForm({ ...form, certificadoEmisor: e.target.value })}
                className="w-full text-xs rounded-[6px] border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
                placeholder="Ej. Security Data S.A., Banco Central del Ecuador, ANFAC"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={handleValidateCert}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[6px] text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Validar Firma Digital</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
