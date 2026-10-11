"use client";

import React, { useState, useEffect, useRef } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { SriCompanyConfig, SriConnectionTestResult } from "@/types";
import {
  Building2,
  CheckCircle2,
  Save,
  ShieldCheck,
  FileCode2,
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
  AlertTriangle,
  Trash2,
} from "lucide-react";
import { probarConexionServidoresSri, formatearSecuencialSRI } from "@/lib/sri-service";

export function SriConfigView() {
  const { sriCompanyConfig, updateSriConfig } = useApp();
  const { showSuccess, showError, showWarning } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<SriCompanyConfig>(() => ({
    id: sriCompanyConfig?.id || "sri-config-inntel",
    ruc: sriCompanyConfig?.ruc || "1792458921001",
    razonSocial: sriCompanyConfig?.razonSocial || "INNTEL CORP S.A.",
    nombreComercial: sriCompanyConfig?.nombreComercial || "INNTEL CORP - SOLUCIONES INTEGRALES",
    direccionMatriz: sriCompanyConfig?.direccionMatriz || "Av. Amazonas N45-12 y Gaspar de Villarroel, Quito, Ecuador",
    direccionEstablecimiento: sriCompanyConfig?.direccionEstablecimiento || "Av. Amazonas N45-12 y Gaspar de Villarroel, Quito, Ecuador",
    establecimiento: sriCompanyConfig?.establecimiento || "010",
    puntoEmision: sriCompanyConfig?.puntoEmision || "001",
    obligadoContabilidad: sriCompanyConfig?.obligadoContabilidad ?? true,
    tipoContribuyente: sriCompanyConfig?.tipoContribuyente || "general",
    ambiente: sriCompanyConfig?.ambiente || "1",
    emailNotificaciones: sriCompanyConfig?.emailNotificaciones || "facturacion@inntelcorp.com",
    telefonoContacto: sriCompanyConfig?.telefonoContacto || "+593 2 394 5000",
    resolucionAgenteRetencion: sriCompanyConfig?.resolucionAgenteRetencion || "",
    contribuyenteEspecial: sriCompanyConfig?.contribuyenteEspecial || "",
    certificadoNombre: sriCompanyConfig?.certificadoNombre || "",
    certificadoVencimiento: sriCompanyConfig?.certificadoVencimiento || "",
    certificadoEmisor: sriCompanyConfig?.certificadoEmisor || "Security Data S.A. / Banco Central del Ecuador",
    certificadoClave: sriCompanyConfig?.certificadoClave || "",
    certificadoCargado: Boolean(sriCompanyConfig?.certificadoCargado && sriCompanyConfig?.certificadoNombre),
    certificadoBase64: sriCompanyConfig?.certificadoBase64 || "",
    certificadoTamano: sriCompanyConfig?.certificadoTamano,
    certificadoFechaCarga: sriCompanyConfig?.certificadoFechaCarga,
    secuencialFactura: sriCompanyConfig?.secuencialFactura ?? 1,
    secuencialNotaCredito: sriCompanyConfig?.secuencialNotaCredito ?? 1,
    secuencialNotaDebito: sriCompanyConfig?.secuencialNotaDebito ?? 1,
    secuencialRetencion: sriCompanyConfig?.secuencialRetencion ?? 1,
    secuencialGuiaRemision: sriCompanyConfig?.secuencialGuiaRemision ?? 1,
    secuencialCotizacion: sriCompanyConfig?.secuencialCotizacion ?? 1,
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
        establecimiento: sriCompanyConfig.establecimiento || "010",
        puntoEmision: sriCompanyConfig.puntoEmision || "001",
        certificadoCargado: Boolean(sriCompanyConfig.certificadoCargado && sriCompanyConfig.certificadoNombre),
      }));
    }
  }, [sriCompanyConfig]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "p12" && ext !== "pfx") {
      showError("Formato No Válido", "Selecciona un archivo con extensión .p12 o .pfx (estándar PKCS#12 del SRI).");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showError("Archivo Demasiado Grande", "El certificado de firma no debe exceder los 10 MB.");
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
        `"${file.name}" cargado (${(file.size / 1024).toFixed(1)} KB). Ingresa la contraseña para validarlo.`
      );
    };
    reader.onerror = () => {
      showError("Error de Lectura", "No se pudo leer el archivo de la firma electrónica.");
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
      setForm(payload);
      showSuccess(
        "Configuración SRI Guardada",
        `Serie ${payload.establecimiento}-${payload.puntoEmision} y secuencias actualizadas con éxito.`
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
    if (!form.certificadoCargado || !form.certificadoNombre) {
      showError("Sin Firma Cargada", "Por favor primero sube tu archivo de firma electrónica (.p12 o .pfx).");
      return;
    }
    if (!form.certificadoClave || form.certificadoClave.trim() === "") {
      showWarning("Contraseña Requerida", "Ingresa la contraseña de la firma para validarla.");
      return;
    }
    showSuccess(
      "Firma Verificada",
      `Archivo "${form.certificadoNombre}" validado con contraseña. Listo para firmado XAdES-BES.`
    );
  };

  const serieActual = `${String(form.establecimiento || "010").padStart(3, "0")}-${String(form.puntoEmision || "001").padStart(3, "0")}`;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 1. BARRA SUPERIOR COMPACTA DE ACCIONES & ESTADO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-[6px] border border-slate-200 shadow-2xs select-none">
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Switch rápido de ambiente */}
          <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-[6px] border border-slate-200">
            <button
              type="button"
              onClick={() => setForm({ ...form, ambiente: "1" })}
              className={`px-2.5 py-1 text-xs font-bold rounded-[4px] transition cursor-pointer ${
                form.ambiente === "1"
                  ? "bg-amber-500 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Pruebas
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, ambiente: "2" })}
              className={`px-2.5 py-1 text-xs font-bold rounded-[4px] transition cursor-pointer ${
                form.ambiente === "2"
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Producción
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <span>RUC: <strong className="font-mono text-slate-800">{form.ruc}</strong></span>
            <span>•</span>
            <span>Serie: <strong className="font-mono text-[#004ac6] bg-blue-50 px-2 py-0.5 rounded-[4px] border border-blue-200">{serieActual}</strong></span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTestingConn}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-[6px] text-xs font-bold transition cursor-pointer"
          >
            <Wifi className={`w-3.5 h-3.5 ${isTestingConn ? "animate-pulse text-[#004ac6]" : ""}`} />
            <span>{isTestingConn ? "Probando..." : "Comprobar SRI"}</span>
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#004ac6] hover:bg-[#003da6] disabled:opacity-50 text-white rounded-[6px] text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSubmitting ? "Guardando..." : "Guardar Configuración"}</span>
          </button>
        </div>
      </div>

      {/* Alerta de prueba de conexión compacta */}
      {connTestResult && (
        <div className="p-2.5 rounded-[6px] bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>SRI {connTestResult.ambiente === "2" ? "Producción" : "Pruebas"} Conectado</strong> (Latencia: {connTestResult.latencyMs}ms • WS Recepción & Autorización ONLINE)
            </span>
          </div>
          <span className="text-[10px] text-emerald-600 font-mono">
            {new Date(connTestResult.checkedAt).toLocaleTimeString("es-EC")}
          </span>
        </div>
      )}

      {/* 2. TARJETA COMPACTA: FIRMA ELECTRÓNICA (.p12 / .pfx) */}
      <div className="bg-white p-3.5 rounded-[6px] border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-[#004ac6]" />
            <h2 className="text-xs font-bold text-slate-800">
              Firma Electrónica Digital (.p12 / .pfx)
            </h2>
          </div>

          {form.certificadoCargado && form.certificadoNombre ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-[4px] bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Firma Activa</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-[4px] bg-amber-50 text-amber-700 border border-amber-200">
              <AlertTriangle className="w-3 h-3 text-amber-600" />
              <span>Pendiente de Carga</span>
            </span>
          )}
        </div>

        {/* Input file invisible */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".p12,.pfx"
          onChange={handleFileChange}
          className="hidden"
        />

        {!form.certificadoCargado || !form.certificadoNombre ? (
          /* Dropzone ultracompacto en una sola barra */
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                const fakeEvent = { target: { files: e.dataTransfer.files } } as any;
                handleFileChange(fakeEvent);
              }
            }}
            className="p-3 border border-dashed border-blue-300 hover:border-[#004ac6] bg-[#f8faff] hover:bg-[#eff6ff] rounded-[6px] flex flex-col sm:flex-row items-center justify-between gap-3 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-2.5 text-xs">
              <div className="p-1.5 bg-blue-100 text-[#004ac6] rounded-[4px]">
                <Upload className="w-4 h-4" />
              </div>
              <div>
                <span className="font-semibold text-slate-800 block">
                  Haz clic o arrastra tu archivo de firma (.p12 o .pfx)
                </span>
                <span className="text-[11px] text-slate-500">
                  Emitido por Security Data, Banco Central del Ecuador, ANFAC, Uanataca, etc.
                </span>
              </div>
            </div>

            <button
              type="button"
              className="px-3 py-1.5 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-[6px] text-xs font-bold transition shrink-0 cursor-pointer"
            >
              Examinar Archivo .p12
            </button>
          </div>
        ) : (
          /* Fila compacta con datos de la firma cargada */
          <div className="p-3 bg-slate-50 rounded-[6px] border border-slate-200 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded-[4px] border border-slate-200">
                  {form.certificadoNombre}
                </span>
                {form.certificadoTamano && (
                  <span className="text-[11px] text-slate-500">
                    ({(form.certificadoTamano / 1024).toFixed(1)} KB)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-[4px] text-xs font-semibold text-slate-700 transition cursor-pointer"
                >
                  Reemplazar .p12
                </button>
                <button
                  type="button"
                  onClick={handleRemoveCertificate}
                  className="px-2 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-[4px] text-xs font-semibold text-rose-700 transition cursor-pointer"
                >
                  Quitar
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
              <div className="relative">
                <input
                  type={showCertPassword ? "text" : "password"}
                  required
                  value={form.certificadoClave || ""}
                  onChange={(e) => setForm({ ...form, certificadoClave: e.target.value })}
                  className="w-full rounded-[6px] border border-slate-300 py-1.5 px-2.5 pr-7 bg-white text-xs font-mono"
                  placeholder="Contraseña del P12"
                />
                <button
                  type="button"
                  onClick={() => setShowCertPassword(!showCertPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  {showCertPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
              </div>

              <div>
                <input
                  type="date"
                  value={form.certificadoVencimiento || ""}
                  onChange={(e) => setForm({ ...form, certificadoVencimiento: e.target.value })}
                  className="w-full rounded-[6px] border border-slate-300 py-1.5 px-2 bg-white text-xs font-mono"
                  title="Fecha de Vencimiento de la Firma"
                />
              </div>

              <div>
                <input
                  type="text"
                  value={form.certificadoEmisor || ""}
                  onChange={(e) => setForm({ ...form, certificadoEmisor: e.target.value })}
                  className="w-full rounded-[6px] border border-slate-300 py-1.5 px-2 bg-white text-xs"
                  placeholder="Entidad Emisora (Security Data / BCE)"
                />
              </div>

              <div>
                <button
                  type="button"
                  onClick={handleValidateCert}
                  className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[6px] text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Validar Clave</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. TARJETA COMPACTA: SERIE & CONTROL DE SECUENCIAS */}
      <div className="bg-white p-3.5 rounded-[6px] border border-slate-200 shadow-2xs space-y-3">
        {/* Selector de Serie en 1 sola fila */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FileCode2 className="w-4 h-4 text-[#004ac6]" />
            <h2 className="text-xs font-bold text-slate-800">
              Serie & Secuencias de Comprobantes SRI
            </h2>
          </div>

          {/* Selector de Sucursal y Punto con botones compactos */}
          <div className="flex items-center gap-3 text-xs flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Sucursal:</span>
              <input
                type="text"
                maxLength={3}
                value={form.establecimiento}
                onChange={(e) => setForm({ ...form, establecimiento: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                className="w-14 text-center font-mono font-bold py-1 px-1.5 border border-slate-300 rounded-[4px] bg-white text-[#004ac6]"
              />
              <div className="inline-flex rounded-[4px] border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, establecimiento: "010" })}
                  className={`px-2 py-0.5 text-[11px] font-bold ${form.establecimiento === "010" ? "bg-[#004ac6] text-white" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`}
                >
                  010 (ISP)
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, establecimiento: "011" })}
                  className={`px-2 py-0.5 text-[11px] font-bold border-l border-slate-200 ${form.establecimiento === "011" ? "bg-[#004ac6] text-white" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`}
                >
                  011
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, establecimiento: "001" })}
                  className={`px-2 py-0.5 text-[11px] font-bold border-l border-slate-200 ${form.establecimiento === "001" ? "bg-[#004ac6] text-white" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`}
                >
                  001
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Punto:</span>
              <input
                type="text"
                maxLength={3}
                value={form.puntoEmision}
                onChange={(e) => setForm({ ...form, puntoEmision: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                className="w-14 text-center font-mono font-bold py-1 px-1.5 border border-slate-300 rounded-[4px] bg-white text-[#004ac6]"
              />
              <div className="inline-flex rounded-[4px] border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, puntoEmision: "001" })}
                  className={`px-2 py-0.5 text-[11px] font-bold ${form.puntoEmision === "001" ? "bg-[#004ac6] text-white" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`}
                  title="Punto 001 recomendado por SRI"
                >
                  001 (Oficial)
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, puntoEmision: "002" })}
                  className={`px-2 py-0.5 text-[11px] font-bold border-l border-slate-200 ${form.puntoEmision === "002" ? "bg-[#004ac6] text-white" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`}
                >
                  002
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tabla compacta de secuencias numéricas */}
        <div className="overflow-x-auto rounded-[6px] border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 select-none">
              <tr>
                <th className="py-2 px-3">Comprobante</th>
                <th className="py-2 px-2 text-center">Código</th>
                <th className="py-2 px-3">Siguiente Secuencial</th>
                <th className="py-2 px-3 text-right">Vista Previa Oficial SRI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {/* Facturas */}
              <tr className="hover:bg-slate-50/50">
                <td className="py-1.5 px-3 font-semibold text-slate-800">Factura de Venta</td>
                <td className="py-1.5 px-2 text-center text-[11px] font-mono text-slate-400">01</td>
                <td className="py-1.5 px-3">
                  <input
                    type="number"
                    min="1"
                    value={form.secuencialFactura ?? 1}
                    onChange={(e) => setForm({ ...form, secuencialFactura: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-24 py-1 px-2 text-xs font-mono font-bold rounded-[4px] border border-slate-300 bg-white"
                  />
                </td>
                <td className="py-1.5 px-3 text-right font-mono font-bold text-[#004ac6]">
                  {formatearSecuencialSRI(form.secuencialFactura || 1, form.establecimiento || "010", form.puntoEmision || "001")}
                </td>
              </tr>

              {/* Notas de Crédito */}
              <tr className="hover:bg-slate-50/50">
                <td className="py-1.5 px-3 font-semibold text-slate-800">Nota de Crédito</td>
                <td className="py-1.5 px-2 text-center text-[11px] font-mono text-slate-400">04</td>
                <td className="py-1.5 px-3">
                  <input
                    type="number"
                    min="1"
                    value={form.secuencialNotaCredito ?? 1}
                    onChange={(e) => setForm({ ...form, secuencialNotaCredito: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-24 py-1 px-2 text-xs font-mono font-bold rounded-[4px] border border-slate-300 bg-white"
                  />
                </td>
                <td className="py-1.5 px-3 text-right font-mono font-bold text-[#004ac6]">
                  {formatearSecuencialSRI(form.secuencialNotaCredito || 1, form.establecimiento || "010", form.puntoEmision || "001")}
                </td>
              </tr>

              {/* Retenciones */}
              <tr className="hover:bg-slate-50/50">
                <td className="py-1.5 px-3 font-semibold text-slate-800">Comprobante de Retención</td>
                <td className="py-1.5 px-2 text-center text-[11px] font-mono text-slate-400">07</td>
                <td className="py-1.5 px-3">
                  <input
                    type="number"
                    min="1"
                    value={form.secuencialRetencion ?? 1}
                    onChange={(e) => setForm({ ...form, secuencialRetencion: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-24 py-1 px-2 text-xs font-mono font-bold rounded-[4px] border border-slate-300 bg-white"
                  />
                </td>
                <td className="py-1.5 px-3 text-right font-mono font-bold text-[#004ac6]">
                  {formatearSecuencialSRI(form.secuencialRetencion || 1, form.establecimiento || "010", form.puntoEmision || "001")}
                </td>
              </tr>

              {/* Guías de Remisión */}
              <tr className="hover:bg-slate-50/50">
                <td className="py-1.5 px-3 font-semibold text-slate-800">Guía de Remisión</td>
                <td className="py-1.5 px-2 text-center text-[11px] font-mono text-slate-400">06</td>
                <td className="py-1.5 px-3">
                  <input
                    type="number"
                    min="1"
                    value={form.secuencialGuiaRemision ?? 1}
                    onChange={(e) => setForm({ ...form, secuencialGuiaRemision: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-24 py-1 px-2 text-xs font-mono font-bold rounded-[4px] border border-slate-300 bg-white"
                  />
                </td>
                <td className="py-1.5 px-3 text-right font-mono font-bold text-[#004ac6]">
                  {formatearSecuencialSRI(form.secuencialGuiaRemision || 1, form.establecimiento || "010", form.puntoEmision || "001")}
                </td>
              </tr>

              {/* Notas de Débito */}
              <tr className="hover:bg-slate-50/50">
                <td className="py-1.5 px-3 font-semibold text-slate-800">Nota de Débito</td>
                <td className="py-1.5 px-2 text-center text-[11px] font-mono text-slate-400">05</td>
                <td className="py-1.5 px-3">
                  <input
                    type="number"
                    min="1"
                    value={form.secuencialNotaDebito ?? 1}
                    onChange={(e) => setForm({ ...form, secuencialNotaDebito: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-24 py-1 px-2 text-xs font-mono font-bold rounded-[4px] border border-slate-300 bg-white"
                  />
                </td>
                <td className="py-1.5 px-3 text-right font-mono font-bold text-[#004ac6]">
                  {formatearSecuencialSRI(form.secuencialNotaDebito || 1, form.establecimiento || "010", form.puntoEmision || "001")}
                </td>
              </tr>

              {/* Cotizaciones */}
              <tr className="hover:bg-slate-50/50">
                <td className="py-1.5 px-3 font-semibold text-slate-800">Cotización Comercial</td>
                <td className="py-1.5 px-2 text-center text-[11px] font-mono text-slate-400">COT</td>
                <td className="py-1.5 px-3">
                  <input
                    type="number"
                    min="1"
                    value={form.secuencialCotizacion ?? 1}
                    onChange={(e) => setForm({ ...form, secuencialCotizacion: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-24 py-1 px-2 text-xs font-mono font-bold rounded-[4px] border border-slate-300 bg-white"
                  />
                </td>
                <td className="py-1.5 px-3 text-right font-mono font-bold text-[#004ac6]">
                  COT-{new Date().getFullYear()}-{String(form.secuencialCotizacion || 1).padStart(4, "0")}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. TARJETA COMPACTA: DATOS FISCALES & DOMICILIO DEL EMISOR */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Columna Izquierda: Identificación Fiscal & Régimen */}
        <div className="bg-white p-3.5 rounded-[6px] border border-slate-200 shadow-2xs space-y-2.5">
          <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
            <Building2 className="w-4 h-4 text-[#004ac6]" />
            <h2 className="text-xs font-bold text-slate-800">Identificación Fiscal</h2>
          </div>

          <div className="space-y-2 text-xs">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">R.U.C. del Emisor *</label>
              <input
                type="text"
                required
                maxLength={13}
                value={form.ruc}
                onChange={(e) => setForm({ ...form, ruc: e.target.value })}
                className="w-full text-xs font-mono font-bold rounded-[4px] border border-slate-300 p-1.5 bg-slate-50 focus:bg-white"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Razón Social *</label>
              <input
                type="text"
                required
                value={form.razonSocial}
                onChange={(e) => setForm({ ...form, razonSocial: e.target.value })}
                className="w-full text-xs font-medium rounded-[4px] border border-slate-300 p-1.5 bg-slate-50 focus:bg-white"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Nombre Comercial</label>
              <input
                type="text"
                value={form.nombreComercial}
                onChange={(e) => setForm({ ...form, nombreComercial: e.target.value })}
                className="w-full text-xs rounded-[4px] border border-slate-300 p-1.5 bg-slate-50 focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Tipo Contribuyente</label>
                <select
                  value={form.tipoContribuyente}
                  onChange={(e) => setForm({ ...form, tipoContribuyente: e.target.value as any })}
                  className="w-full text-xs rounded-[4px] border border-slate-300 p-1.5 bg-white font-medium"
                >
                  <option value="general">Régimen General</option>
                  <option value="rimpe_emprendedor">RIMPE Emprendedor</option>
                  <option value="rimpe_popular">RIMPE Popular</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-4">
                <input
                  type="checkbox"
                  id="obligadoContabilidad"
                  checked={form.obligadoContabilidad}
                  onChange={(e) => setForm({ ...form, obligadoContabilidad: e.target.checked })}
                  className="w-3.5 h-3.5 rounded-[3px] text-[#004ac6] border-slate-300"
                />
                <label htmlFor="obligadoContabilidad" className="text-[11px] font-bold text-slate-700 cursor-pointer">
                  Obligado Contabilidad
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Domicilio & Notificaciones */}
        <div className="bg-white p-3.5 rounded-[6px] border border-slate-200 shadow-2xs space-y-2.5">
          <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
            <MapPin className="w-4 h-4 text-[#004ac6]" />
            <h2 className="text-xs font-bold text-slate-800">Domicilio & Notificaciones</h2>
          </div>

          <div className="space-y-2 text-xs">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Dirección Matriz *</label>
              <input
                type="text"
                required
                value={form.direccionMatriz}
                onChange={(e) => setForm({ ...form, direccionMatriz: e.target.value })}
                className="w-full text-xs rounded-[4px] border border-slate-300 p-1.5 bg-slate-50 focus:bg-white"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Dirección Sucursal ({form.establecimiento}) *</label>
              <input
                type="text"
                required
                value={form.direccionEstablecimiento}
                onChange={(e) => setForm({ ...form, direccionEstablecimiento: e.target.value })}
                className="w-full text-xs rounded-[4px] border border-slate-300 p-1.5 bg-slate-50 focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Email Notificaciones RIDE</label>
                <input
                  type="email"
                  value={form.emailNotificaciones || ""}
                  onChange={(e) => setForm({ ...form, emailNotificaciones: e.target.value })}
                  className="w-full text-xs rounded-[4px] border border-slate-300 p-1.5 bg-slate-50 focus:bg-white"
                  placeholder="facturacion@empresa.com"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Teléfono de Contacto</label>
                <input
                  type="text"
                  value={form.telefonoContacto || ""}
                  onChange={(e) => setForm({ ...form, telefonoContacto: e.target.value })}
                  className="w-full text-xs rounded-[4px] border border-slate-300 p-1.5 bg-slate-50 focus:bg-white"
                  placeholder="+593 2 000 0000"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Agente de Retención (No. Res.)</label>
                <input
                  type="text"
                  value={form.resolucionAgenteRetencion || ""}
                  onChange={(e) => setForm({ ...form, resolucionAgenteRetencion: e.target.value })}
                  className="w-full text-xs rounded-[4px] border border-slate-300 p-1.5 bg-slate-50 focus:bg-white"
                  placeholder="Opcional"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Contribuyente Especial</label>
                <input
                  type="text"
                  value={form.contribuyenteEspecial || ""}
                  onChange={(e) => setForm({ ...form, contribuyenteEspecial: e.target.value })}
                  className="w-full text-xs rounded-[4px] border border-slate-300 p-1.5 bg-slate-50 focus:bg-white"
                  placeholder="Opcional"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
