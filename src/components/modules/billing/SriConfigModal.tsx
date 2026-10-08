"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Settings,
  Building2,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Server,
  Key,
  Upload,
  RefreshCw,
  Trash2,
  FileCode2,
  Eye,
  EyeOff,
} from "lucide-react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { SriCompanyConfig } from "@/types";
import { formatearSecuencialSRI } from "@/lib/sri-service";

interface SriConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SriConfigModal({ isOpen, onClose }: SriConfigModalProps) {
  const { sriCompanyConfig, updateSriConfig } = useApp();
  const { showSuccess, showError } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<SriCompanyConfig>({
    id: "sri-config-inntel",
    ruc: "1792458921001",
    razonSocial: "INNTEL CORP S.A.",
    nombreComercial: "INNTEL CORP - SOLUCIONES INTEGRALES",
    direccionMatriz: "Av. Amazonas N45-12 y Gaspar de Villarroel, Quito, Ecuador",
    direccionEstablecimiento: "Av. Amazonas N45-12 y Gaspar de Villarroel, Quito, Ecuador",
    establecimiento: "010",
    puntoEmision: "001",
    obligadoContabilidad: true,
    tipoContribuyente: "general",
    ambiente: "1",
    emailNotificaciones: "facturacion@inntelcorp.com",
    telefonoContacto: "+593 2 394 5000",
    certificadoNombre: "",
    certificadoVencimiento: "",
    certificadoEmisor: "Security Data S.A. / Banco Central del Ecuador",
    certificadoClave: "",
    certificadoCargado: false,
    certificadoBase64: "",
    secuencialFactura: 1,
    secuencialNotaCredito: 1,
    secuencialNotaDebito: 1,
    secuencialRetencion: 1,
    secuencialGuiaRemision: 1,
    secuencialCotizacion: 1,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);
  const [showCertPassword, setShowCertPassword] = useState(false);

  useEffect(() => {
    if (isOpen && sriCompanyConfig) {
      setForm((prev) => ({
        ...prev,
        ...sriCompanyConfig,
        establecimiento: sriCompanyConfig.establecimiento || "010",
        puntoEmision: sriCompanyConfig.puntoEmision || "001",
        certificadoCargado: Boolean(sriCompanyConfig.certificadoCargado && sriCompanyConfig.certificadoNombre),
      }));
      setSuccessMsg(false);
    }
  }, [isOpen, sriCompanyConfig]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "p12" && ext !== "pfx") {
      showError("Formato No Soportado", "Selecciona un archivo con extensión .p12 o .pfx.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const base64Data = loadEvent.target?.result as string;
      setForm((prev) => ({
        ...prev,
        certificadoNombre: file.name,
        certificadoCargado: true,
        certificadoBase64: base64Data,
        certificadoTamano: file.size,
        certificadoFechaCarga: new Date().toISOString(),
      }));
      showSuccess(
        "Firma Cargada",
        `Archivo "${file.name}" cargado (${(file.size / 1024).toFixed(1)} KB). Ingresa la contraseña de la firma.`
      );
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveCertificate = () => {
    setForm((prev) => ({
      ...prev,
      certificadoNombre: "",
      certificadoCargado: false,
      certificadoBase64: "",
      certificadoTamano: undefined,
      certificadoFechaCarga: undefined,
      certificadoClave: "",
      certificadoVencimiento: "",
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    showSuccess("Firma Retirada", "El archivo de firma electrónica ha sido removido.");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const finalEstablecimiento = String(form.establecimiento || "010").replace(/\D/g, "").padStart(3, "0").slice(-3);
      const finalPuntoEmision = String(form.puntoEmision || "001").replace(/\D/g, "").padStart(3, "0").slice(-3);

      const payload: SriCompanyConfig = {
        ...form,
        establecimiento: finalEstablecimiento,
        puntoEmision: finalPuntoEmision,
        secuencialFactura: Math.max(1, Number(form.secuencialFactura) || 1),
        secuencialNotaCredito: Math.max(1, Number(form.secuencialNotaCredito) || 1),
        secuencialNotaDebito: Math.max(1, Number(form.secuencialNotaDebito) || 1),
        secuencialRetencion: Math.max(1, Number(form.secuencialRetencion) || 1),
        secuencialGuiaRemision: Math.max(1, Number(form.secuencialGuiaRemision) || 1),
        secuencialCotizacion: Math.max(1, Number(form.secuencialCotizacion) || 1),
      };

      await updateSriConfig(payload);
      setSuccessMsg(true);
      setTimeout(() => {
        setSuccessMsg(false);
        onClose();
      }, 1000);
    } catch (e: any) {
      showError("Error al Guardar", e?.message || "No se pudo actualizar la configuración SRI.");
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
                Configuración del Emisor SRI & Secuencias
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {successMsg && (
            <div className="p-3.5 rounded-[6px] bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>Configuración SRI y secuencias guardadas con éxito.</span>
            </div>
          )}

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".p12,.pfx"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* 1. SECCIÓN DE FIRMA ELECTRÓNICA */}
          <div className="p-4 bg-slate-50 rounded-[6px] border border-slate-200 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <Key className="w-4 h-4 text-[#004ac6]" />
                <span>Certificado de Firma Electrónica (.p12 / .pfx)</span>
              </div>
              {form.certificadoCargado && form.certificadoNombre ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-[4px] bg-emerald-50 text-emerald-700 border border-emerald-200">
                  FIRMA VINCULADA
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-[4px] bg-amber-50 text-amber-700 border border-amber-200">
                  SIN FIRMA CARGADA
                </span>
              )}
            </div>

            {!form.certificadoCargado || !form.certificadoNombre ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-6 border-2 border-dashed border-[#bfdbfe] hover:border-[#004ac6] bg-white rounded-[6px] text-center cursor-pointer transition-all space-y-2"
              >
                <Upload className="w-6 h-6 text-[#004ac6] mx-auto" />
                <p className="font-bold text-slate-800">
                  Haz clic para seleccionar tu archivo de firma electrónica (.p12 o .pfx)
                </p>
                <p className="text-[11px] text-slate-500">
                  Emitido por Security Data, Banco Central, ANFAC, etc.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-2.5 bg-white rounded-[6px] border border-slate-200">
                  <div className="flex items-center gap-2 font-mono text-slate-800">
                    <FileCode2 className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold">{form.certificadoNombre}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-[4px] text-[11px] font-semibold text-slate-700 transition cursor-pointer"
                    >
                      Reemplazar
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveCertificate}
                      className="px-2 py-1 bg-rose-50 hover:bg-rose-100 rounded-[4px] text-[11px] font-semibold text-rose-700 transition cursor-pointer"
                    >
                      Quitar
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Contraseña de la Firma *:
                    </label>
                    <div className="relative">
                      <input
                        type={showCertPassword ? "text" : "password"}
                        required
                        value={form.certificadoClave || ""}
                        onChange={(e) => setForm({ ...form, certificadoClave: e.target.value })}
                        className="w-full rounded-[6px] border border-slate-300 p-2 pr-8 bg-white font-mono"
                        placeholder="Contraseña del P12"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCertPassword(!showCertPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        {showCertPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Fecha de Vencimiento:
                    </label>
                    <input
                      type="date"
                      value={form.certificadoVencimiento || ""}
                      onChange={(e) => setForm({ ...form, certificadoVencimiento: e.target.value })}
                      className="w-full rounded-[6px] border border-slate-300 p-2 bg-white font-mono font-semibold"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 2. SUCURSAL, PUNTO DE EMISIÓN & SERIE */}
          <div className="p-4 bg-slate-50 rounded-[6px] border border-slate-200 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="font-bold text-slate-800">Sucursal (Establecimiento) & Punto de Emisión</span>
              <span className="font-mono font-bold text-[#004ac6] bg-blue-50 px-2 py-0.5 rounded-[4px] border border-blue-200">
                Serie: {String(form.establecimiento || "010").padStart(3, "0")}-{String(form.puntoEmision || "001").padStart(3, "0")}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Establecimiento (Sucursal 10 o 11) *:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    maxLength={3}
                    value={form.establecimiento}
                    onChange={(e) => setForm({ ...form, establecimiento: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                    className="w-20 text-center font-mono font-bold rounded-[6px] border border-slate-300 p-2 bg-white text-[#004ac6]"
                  />
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, establecimiento: "010" })}
                    className={`px-2 py-1.5 rounded-[4px] text-[11px] font-bold border ${form.establecimiento === "010" ? "bg-[#004ac6] text-white border-[#004ac6]" : "bg-white text-slate-700 border-slate-300"}`}
                  >
                    010 (Sucursal 10)
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, establecimiento: "011" })}
                    className={`px-2 py-1.5 rounded-[4px] text-[11px] font-bold border ${form.establecimiento === "011" ? "bg-[#004ac6] text-white border-[#004ac6]" : "bg-white text-slate-700 border-slate-300"}`}
                  >
                    011 (Sucursal 11)
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Punto de Emisión (Recomendado 001) *:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    maxLength={3}
                    value={form.puntoEmision}
                    onChange={(e) => setForm({ ...form, puntoEmision: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                    className="w-20 text-center font-mono font-bold rounded-[6px] border border-slate-300 p-2 bg-white text-[#004ac6]"
                  />
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, puntoEmision: "001" })}
                    className={`px-2 py-1.5 rounded-[4px] text-[11px] font-bold border ${form.puntoEmision === "001" ? "bg-[#004ac6] text-white border-[#004ac6]" : "bg-white text-slate-700 border-slate-300"}`}
                  >
                    001 (Punto Principal)
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, puntoEmision: "002" })}
                    className={`px-2 py-1.5 rounded-[4px] text-[11px] font-bold border ${form.puntoEmision === "002" ? "bg-[#004ac6] text-white border-[#004ac6]" : "bg-white text-slate-700 border-slate-300"}`}
                  >
                    002 (Web)
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 3. CONTROL DE SECUENCIAS NUMÉRICAS */}
          <div className="p-4 bg-slate-50 rounded-[6px] border border-slate-200 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="font-bold text-slate-800">Secuencias Numéricas de Comprobantes SRI</span>
              <span className="text-[11px] text-slate-500">Consecutivos a generar</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-2.5 bg-white rounded-[6px] border border-slate-200">
                <span className="font-bold text-slate-800 block text-[11px]">Facturas (01)</span>
                <input
                  type="number"
                  min="1"
                  value={form.secuencialFactura ?? 1}
                  onChange={(e) => setForm({ ...form, secuencialFactura: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="w-full text-xs font-mono font-bold rounded-[4px] border border-slate-300 p-1.5 my-1"
                />
                <span className="font-mono text-[10px] text-[#004ac6] block">
                  {formatearSecuencialSRI(form.secuencialFactura || 1, form.establecimiento || "010", form.puntoEmision || "001")}
                </span>
              </div>

              <div className="p-2.5 bg-white rounded-[6px] border border-slate-200">
                <span className="font-bold text-slate-800 block text-[11px]">Notas de Crédito (04)</span>
                <input
                  type="number"
                  min="1"
                  value={form.secuencialNotaCredito ?? 1}
                  onChange={(e) => setForm({ ...form, secuencialNotaCredito: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="w-full text-xs font-mono font-bold rounded-[4px] border border-slate-300 p-1.5 my-1"
                />
                <span className="font-mono text-[10px] text-[#004ac6] block">
                  {formatearSecuencialSRI(form.secuencialNotaCredito || 1, form.establecimiento || "010", form.puntoEmision || "001")}
                </span>
              </div>

              <div className="p-2.5 bg-white rounded-[6px] border border-slate-200">
                <span className="font-bold text-slate-800 block text-[11px]">Retenciones (07)</span>
                <input
                  type="number"
                  min="1"
                  value={form.secuencialRetencion ?? 1}
                  onChange={(e) => setForm({ ...form, secuencialRetencion: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="w-full text-xs font-mono font-bold rounded-[4px] border border-slate-300 p-1.5 my-1"
                />
                <span className="font-mono text-[10px] text-[#004ac6] block">
                  {formatearSecuencialSRI(form.secuencialRetencion || 1, form.establecimiento || "010", form.puntoEmision || "001")}
                </span>
              </div>
            </div>
          </div>

          {/* 4. DATOS GENERALES TRIBUTARIOS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-slate-700 block mb-1">R.U.C. del Emisor *:</label>
              <input
                type="text"
                required
                value={form.ruc}
                onChange={(e) => setForm({ ...form, ruc: e.target.value })}
                className="w-full text-xs font-mono font-bold rounded-[6px] border border-slate-300 p-2.5 bg-white"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Ambiente SRI *:</label>
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
              <label className="font-bold text-slate-700 block mb-1">Razón Social *:</label>
              <input
                type="text"
                required
                value={form.razonSocial}
                onChange={(e) => setForm({ ...form, razonSocial: e.target.value })}
                className="w-full text-xs font-semibold rounded-[6px] border border-slate-300 p-2.5 bg-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="font-bold text-slate-700 block mb-1">Dirección Matriz *:</label>
              <input
                type="text"
                required
                value={form.direccionMatriz}
                onChange={(e) => setForm({ ...form, direccionMatriz: e.target.value })}
                className="w-full text-xs rounded-[6px] border border-slate-300 p-2.5 bg-white"
              />
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
              <span>{isSubmitting ? "Guardando..." : "Guardar Configuración SRI"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
