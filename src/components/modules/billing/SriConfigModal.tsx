"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Settings,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Key,
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
    certificadoCargado: false,
    secuencialFactura: 1,
    secuencialNotaCredito: 1,
    secuencialNotaDebito: 1,
    secuencialRetencion: 1,
    secuencialGuiaRemision: 1,
    secuencialCotizacion: 1,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);

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

  const firmaActiva = Boolean(form.certificadoCargado && form.certificadoNombre);

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

      // Los secretos de firma se gestionan en Ajustes → Facturación Electrónica.
      delete payload.certificadoBase64;
      delete payload.certificadoClave;

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
      <div className="relative w-full max-w-3xl bg-white rounded-xl shadow-2xl border border-[#e2e8f0] overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#004ac6] text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-white shadow-xs">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">
                Configuración SRI
              </h2>
              <p className="text-xs text-blue-100">
                Parámetros de facturación electrónica, credenciales de firma y puntos de emisión
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {successMsg && (
            <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>Configuración SRI y secuencias guardadas con éxito.</span>
            </div>
          )}

          {/* 1. ESTADO DE LA FIRMA ELECTRÓNICA */}
          <div className="p-4 bg-[#f8f9ff] rounded-lg border border-[#e2e8f0] space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-[#e2e8f0]">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <Key className="w-4 h-4 text-[#004ac6]" />
                <span>Certificado de Firma Electrónica (.p12 / .pfx)</span>
              </div>
              {firmaActiva ? (
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                  FIRMA VINCULADA
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                  SIN FIRMA CARGADA
                </span>
              )}
            </div>

            {firmaActiva ? (
              <div className="flex items-start gap-2 text-[11px] text-slate-600">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-mono font-bold text-slate-800">{form.certificadoNombre}</p>
                  <p>
                    Vence:{" "}
                    <span className="font-mono font-semibold">
                      {form.certificadoVencimiento || "No registrado"}
                    </span>
                  </p>
                  {form.certificadoEmisor && <p>Emisor: {form.certificadoEmisor}</p>}
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 text-[11px] text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  No hay certificado cargado: las facturas no podrán firmarse ni enviarse al SRI.
                </p>
              </div>
            )}

            <p className="text-[10px] text-slate-500">
              El archivo .p12 y su contraseña se cargan en{" "}
              <strong>Ajustes → Facturación Electrónica</strong>. Se almacenan únicamente en el servidor
              y nunca viajan al navegador.
            </p>
          </div>

          {/* 2. SUCURSAL, PUNTO DE EMISIÓN & SERIE */}
          <div className="p-4 bg-[#f8f9ff] rounded-lg border border-[#e2e8f0] space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#e2e8f0]">
              <span className="font-bold text-slate-800">Sucursal (Establecimiento) & Punto de Emisión</span>
              <span className="font-mono font-bold text-[#004ac6] bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-200">
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
                    className="w-20 text-center font-mono font-bold rounded-lg border border-[#e2e8f0] p-2 bg-white text-[#004ac6]"
                  />
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, establecimiento: "010" })}
                    className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold border transition cursor-pointer ${form.establecimiento === "010" ? "bg-[#004ac6] text-white border-[#004ac6]" : "bg-white text-slate-700 border-[#e2e8f0] hover:bg-slate-50"}`}
                  >
                    010 (Sucursal 10)
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, establecimiento: "011" })}
                    className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold border transition cursor-pointer ${form.establecimiento === "011" ? "bg-[#004ac6] text-white border-[#004ac6]" : "bg-white text-slate-700 border-[#e2e8f0] hover:bg-slate-50"}`}
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
                    className="w-20 text-center font-mono font-bold rounded-lg border border-[#e2e8f0] p-2 bg-white text-[#004ac6]"
                  />
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, puntoEmision: "001" })}
                    className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold border transition cursor-pointer ${form.puntoEmision === "001" ? "bg-[#004ac6] text-white border-[#004ac6]" : "bg-white text-slate-700 border-[#e2e8f0] hover:bg-slate-50"}`}
                  >
                    001 (Punto Principal)
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, puntoEmision: "002" })}
                    className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold border transition cursor-pointer ${form.puntoEmision === "002" ? "bg-[#004ac6] text-white border-[#004ac6]" : "bg-white text-slate-700 border-[#e2e8f0] hover:bg-slate-50"}`}
                  >
                    002 (Web)
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 3. CONTROL DE SECUENCIAS NUMÉRICAS */}
          <div className="p-4 bg-[#f8f9ff] rounded-lg border border-[#e2e8f0] space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#e2e8f0]">
              <span className="font-bold text-slate-800">Secuencias Numéricas de Comprobantes SRI</span>
              <span className="text-[11px] text-slate-500">Consecutivos a generar</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-2.5 bg-white rounded-lg border border-[#e2e8f0]">
                <span className="font-bold text-slate-800 block text-[11px]">Facturas</span>
                <input
                  type="number"
                  min="1"
                  value={form.secuencialFactura ?? 1}
                  onChange={(e) => setForm({ ...form, secuencialFactura: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="w-full text-xs font-mono font-bold rounded-md border border-[#e2e8f0] p-1.5 my-1"
                />
                <span className="font-mono text-[10px] text-[#004ac6] block">
                  {formatearSecuencialSRI(form.secuencialFactura || 1, form.establecimiento || "010", form.puntoEmision || "001")}
                </span>
              </div>

              <div className="p-2.5 bg-white rounded-lg border border-[#e2e8f0]">
                <span className="font-bold text-slate-800 block text-[11px]">Notas de Crédito</span>
                <input
                  type="number"
                  min="1"
                  value={form.secuencialNotaCredito ?? 1}
                  onChange={(e) => setForm({ ...form, secuencialNotaCredito: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="w-full text-xs font-mono font-bold rounded-md border border-[#e2e8f0] p-1.5 my-1"
                />
                <span className="font-mono text-[10px] text-[#004ac6] block">
                  {formatearSecuencialSRI(form.secuencialNotaCredito || 1, form.establecimiento || "010", form.puntoEmision || "001")}
                </span>
              </div>

              <div className="p-2.5 bg-white rounded-lg border border-[#e2e8f0]">
                <span className="font-bold text-slate-800 block text-[11px]">Retenciones</span>
                <input
                  type="number"
                  min="1"
                  value={form.secuencialRetencion ?? 1}
                  onChange={(e) => setForm({ ...form, secuencialRetencion: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="w-full text-xs font-mono font-bold rounded-md border border-[#e2e8f0] p-1.5 my-1"
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
                className="w-full text-xs font-mono font-bold rounded-lg border border-[#e2e8f0] p-2.5 bg-white focus:outline-hidden focus:border-[#004ac6]"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Ambiente SRI *:</label>
              <select
                value={form.ambiente}
                onChange={(e) => setForm({ ...form, ambiente: e.target.value as any })}
                className="w-full text-xs font-semibold rounded-lg border border-[#e2e8f0] p-2.5 bg-white focus:outline-hidden focus:border-[#004ac6]"
              >
                <option value="1">Pruebas / Homologación SRI</option>
                <option value="2">Producción Oficial SRI</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="font-bold text-slate-700 block mb-1">Razón Social *:</label>
              <input
                type="text"
                required
                value={form.razonSocial}
                onChange={(e) => setForm({ ...form, razonSocial: e.target.value })}
                className="w-full text-xs font-semibold rounded-lg border border-[#e2e8f0] p-2.5 bg-white focus:outline-hidden focus:border-[#004ac6]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="font-bold text-slate-700 block mb-1">Dirección Matriz *:</label>
              <input
                type="text"
                required
                value={form.direccionMatriz}
                onChange={(e) => setForm({ ...form, direccionMatriz: e.target.value })}
                className="w-full text-xs rounded-lg border border-[#e2e8f0] p-2.5 bg-white focus:outline-hidden focus:border-[#004ac6]"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-[#e2e8f0] flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              Cerrar
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-lg bg-[#004ac6] hover:bg-[#003ca3] disabled:opacity-50 text-white text-xs font-bold shadow-md transition flex items-center gap-2 cursor-pointer"
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
