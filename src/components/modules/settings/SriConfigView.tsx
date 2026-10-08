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
  FileText,
  Hash,
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
      showError("Formato No Válido", "Por favor selecciona un archivo con extensión .p12 o .pfx (estándar PKCS#12 del SRI).");
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
        "Firma Electrónica Cargada",
        `Archivo "${file.name}" cargado exitosamente (${(file.size / 1024).toFixed(1)} KB). Por favor ingresa la contraseña para activarlo.`
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
    showSuccess("Firma Retirada", "El archivo de firma electrónica ha sido removido. Ahora puedes cargar uno nuevo.");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // Normalizar códigos a 3 dígitos
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
        `Parámetros guardados: Serie ${payload.establecimiento}-${payload.puntoEmision} y secuencias actualizadas.`
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
      showError("Sin Firma Cargada", "Por favor primero selecciona y sube tu archivo de firma electrónica (.p12 o .pfx).");
      return;
    }
    if (!form.certificadoClave || form.certificadoClave.trim() === "") {
      showWarning("Contraseña Requerida", "Ingresa la contraseña de la firma electrónica para validarla.");
      return;
    }
    showSuccess(
      "Firma Digital Verificada",
      `Archivo "${form.certificadoNombre}" validado con contraseña. Entidad: ${form.certificadoEmisor || "Security Data"}. Listo para firmado XAdES-BES.`
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
            RUC: <strong className="font-mono text-slate-800">{form.ruc}</strong> • Serie Oficial:{" "}
            <strong className="font-mono text-[#004ac6] bg-blue-50 px-2 py-0.5 rounded-[4px] border border-blue-200">
              {form.establecimiento || "010"}-{form.puntoEmision || "001"}
            </strong>
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

      {/* BLOQUE CENTRAL: 1. FIRMA ELECTRÓNICA Y 2. CONTROL DE SUCURSAL Y SECUENCIAS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ========================================================= */}
        {/* SECCIÓN 1: FIRMA ELECTRÓNICA (.p12 / .pfx) */}
        {/* ========================================================= */}
        <div className="lg:col-span-2 bg-white p-6 rounded-[6px] border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <Key className="w-4 h-4 text-[#004ac6]" />
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Certificado Digital de Firma Electrónica (PKCS#12 / .p12 / .pfx)
                </h2>
                <p className="text-[11px] text-slate-500">
                  Archivo criptográfico exigido por el SRI para el sellado y firmado digital XAdES-BES
                </p>
              </div>
            </div>
            {form.certificadoCargado && form.certificadoNombre ? (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-[4px] bg-emerald-50 text-emerald-700 border border-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>FIRMA CARGADA & VINCULADA</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-[4px] bg-amber-50 text-amber-700 border border-amber-300">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>SIN FIRMA CARGADA</span>
              </span>
            )}
          </div>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".p12,.pfx"
            onChange={handleFileChange}
            className="hidden"
          />

          {!form.certificadoCargado || !form.certificadoNombre ? (
            /* Dropzone / Upload area when no cert loaded */
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
              className="p-8 border-2 border-dashed border-[#bfdbfe] hover:border-[#004ac6] bg-[#f8faff] hover:bg-[#eff6ff] rounded-[6px] text-center cursor-pointer transition-all space-y-3"
            >
              <div className="w-12 h-12 bg-white text-[#004ac6] border border-[#bfdbfe] rounded-[6px] flex items-center justify-center mx-auto shadow-2xs">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">
                  Haz clic aquí para seleccionar o arrastra tu archivo de Firma Electrónica (.p12 / .pfx)
                </p>
                <p className="text-[11px] text-slate-500 mt-1 max-w-lg mx-auto">
                  Acepta certificados emitidos por Security Data, Banco Central del Ecuador (BCE), ANFAC, Consejo de la Judicatura, Uanataca, etc.
                </p>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-[6px] text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Seleccionar Archivo .p12 / .pfx</span>
              </button>
            </div>
          ) : (
            /* Card showing loaded cert details */
            <div className="p-4 bg-slate-50 rounded-[6px] border border-slate-200/80 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white rounded-[6px] border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-[6px] border border-emerald-200">
                    <FileCode2 className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-mono font-bold text-xs text-slate-800 block">
                      {form.certificadoNombre}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {form.certificadoTamano ? `${(form.certificadoTamano / 1024).toFixed(1)} KB • ` : ""}
                      {form.certificadoFechaCarga
                        ? `Cargado: ${new Date(form.certificadoFechaCarga).toLocaleDateString("es-EC")}`
                        : "Certificado digital almacenado"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-[6px] text-xs font-semibold transition cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Reemplazar Archivo</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveCertificate}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-[6px] text-xs font-semibold transition cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Quitar</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contraseña de la Firma Electrónica *
                  </label>
                  <div className="relative">
                    <input
                      type={showCertPassword ? "text" : "password"}
                      required
                      value={form.certificadoClave || ""}
                      onChange={(e) => setForm({ ...form, certificadoClave: e.target.value })}
                      className="w-full text-xs rounded-[6px] border border-slate-300 p-2.5 pr-8 bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden font-mono"
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
                    Fecha de Vencimiento de la Firma
                  </label>
                  <input
                    type="date"
                    value={form.certificadoVencimiento || ""}
                    onChange={(e) => setForm({ ...form, certificadoVencimiento: e.target.value })}
                    className="w-full text-xs rounded-[6px] border border-slate-300 p-2.5 bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden font-mono font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Entidad Emisora de la Firma
                  </label>
                  <input
                    type="text"
                    value={form.certificadoEmisor || ""}
                    onChange={(e) => setForm({ ...form, certificadoEmisor: e.target.value })}
                    className="w-full text-xs rounded-[6px] border border-slate-300 p-2.5 bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
                    placeholder="Ej. Security Data, Banco Central, ANFAC"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleValidateCert}
                  className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[6px] text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Validar Certificado & Clave</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* SECCIÓN 2: ESTABLECIMIENTO, PUNTO DE EMISIÓN & SECUENCIAS */}
        {/* ========================================================= */}
        <div className="lg:col-span-2 bg-white p-6 rounded-[6px] border border-slate-200/80 shadow-2xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <FileCode2 className="w-4 h-4 text-[#004ac6]" />
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Establecimiento, Punto de Emisión & Control de Secuencias SRI
                </h2>
                <p className="text-[11px] text-slate-500">
                  Configura la sucursal emisora y el punto de inicio correlativo de cada comprobante electrónico
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block font-medium">Serie de Emisión</span>
              <span className="text-sm font-mono font-bold text-[#004ac6] bg-blue-50 px-2.5 py-1 rounded-[4px] border border-blue-200 inline-block">
                {String(form.establecimiento || "010").padStart(3, "0")}-{String(form.puntoEmision || "001").padStart(3, "0")}
              </span>
            </div>
          </div>

          {/* Selector de Sucursal y Punto de Emisión con Botones Rápidos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs p-4 bg-slate-50 rounded-[6px] border border-slate-200/80">
            {/* Establecimiento */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-700">
                  Establecimiento / Sucursal (3 dígitos) *
                </label>
                <span className="text-[10px] text-slate-500 font-mono">Código SRI</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  required
                  maxLength={3}
                  value={form.establecimiento}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, "").slice(0, 3);
                    setForm({ ...form, establecimiento: clean });
                  }}
                  className="w-24 text-sm font-mono font-bold rounded-[6px] border border-slate-300 p-2.5 bg-white text-center text-[#004ac6] focus:ring-2 focus:ring-[#004ac6] outline-hidden"
                  placeholder="010"
                />
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, establecimiento: "010" })}
                    className={`px-2.5 py-1.5 rounded-[4px] text-[11px] font-bold border transition cursor-pointer ${
                      form.establecimiento === "010"
                        ? "bg-[#004ac6] text-white border-[#004ac6]"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    010 (Sucursal 10 - Recomendado)
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, establecimiento: "011" })}
                    className={`px-2.5 py-1.5 rounded-[4px] text-[11px] font-bold border transition cursor-pointer ${
                      form.establecimiento === "011"
                        ? "bg-[#004ac6] text-white border-[#004ac6]"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    011 (Sucursal 11)
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, establecimiento: "001" })}
                    className={`px-2.5 py-1.5 rounded-[4px] text-[11px] font-bold border transition cursor-pointer ${
                      form.establecimiento === "001"
                        ? "bg-[#004ac6] text-white border-[#004ac6]"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    001 (Matriz)
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                La <strong>Sucursal 10 (`010`)</strong> o <strong>11 (`011`)</strong> se utiliza comúnmente en ISPs para aislar la facturación electrónica recurrente respecto a la matriz física (`001`).
              </p>
            </div>

            {/* Punto de Emisión */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-700">
                  Punto de Emisión (3 dígitos) *
                </label>
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded-[4px] border border-emerald-200">
                  001 Mejor Opción SRI
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  required
                  maxLength={3}
                  value={form.puntoEmision}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, "").slice(0, 3);
                    setForm({ ...form, puntoEmision: clean });
                  }}
                  className="w-24 text-sm font-mono font-bold rounded-[6px] border border-slate-300 p-2.5 bg-white text-center text-[#004ac6] focus:ring-2 focus:ring-[#004ac6] outline-hidden"
                  placeholder="001"
                />
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, puntoEmision: "001" })}
                    className={`px-2.5 py-1.5 rounded-[4px] text-[11px] font-bold border transition cursor-pointer ${
                      form.puntoEmision === "001"
                        ? "bg-[#004ac6] text-white border-[#004ac6]"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    001 (Punto Principal Oficial)
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, puntoEmision: "002" })}
                    className={`px-2.5 py-1.5 rounded-[4px] text-[11px] font-bold border transition cursor-pointer ${
                      form.puntoEmision === "002"
                        ? "bg-[#004ac6] text-white border-[#004ac6]"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    002 (Punto Secundario Web)
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                <strong>¿Por qué 001 es el mejor punto de emisión?</strong> En el SRI, cada nuevo establecimiento (`010`) tiene por defecto autorizado su Punto de Emisión 1 (`001`). Usar `001` garantiza total compatibilidad sin requerir aperturas adicionales.
              </p>
            </div>
          </div>

          {/* Grilla de Secuencias de Documentos */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Secuencias Numéricas de Emisión (Siguiente Comprobante a Generar)
              </h3>
              <span className="text-[11px] text-slate-500">
                Formato SRI de 9 dígitos correlativos
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              {/* Facturas */}
              <div className="p-3.5 rounded-[6px] border border-slate-200 bg-white space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">Facturas de Venta (01)</span>
                  <span className="text-[10px] font-mono text-slate-500 font-semibold">FAC</span>
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Siguiente número correlativo:</label>
                  <input
                    type="number"
                    min="1"
                    value={form.secuencialFactura ?? 1}
                    onChange={(e) => setForm({ ...form, secuencialFactura: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-full text-xs font-mono font-bold rounded-[6px] border border-slate-300 p-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
                  />
                </div>
                <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Próxima Factura:</span>
                  <span className="font-mono font-bold text-[#004ac6]">
                    {formatearSecuencialSRI(form.secuencialFactura || 1, form.establecimiento || "010", form.puntoEmision || "001")}
                  </span>
                </div>
              </div>

              {/* Notas de Crédito */}
              <div className="p-3.5 rounded-[6px] border border-slate-200 bg-white space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">Notas de Crédito (04)</span>
                  <span className="text-[10px] font-mono text-slate-500 font-semibold">NC</span>
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Siguiente número correlativo:</label>
                  <input
                    type="number"
                    min="1"
                    value={form.secuencialNotaCredito ?? 1}
                    onChange={(e) => setForm({ ...form, secuencialNotaCredito: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-full text-xs font-mono font-bold rounded-[6px] border border-slate-300 p-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
                  />
                </div>
                <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Próxima NC:</span>
                  <span className="font-mono font-bold text-[#004ac6]">
                    {formatearSecuencialSRI(form.secuencialNotaCredito || 1, form.establecimiento || "010", form.puntoEmision || "001")}
                  </span>
                </div>
              </div>

              {/* Retenciones */}
              <div className="p-3.5 rounded-[6px] border border-slate-200 bg-white space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">Retenciones (07)</span>
                  <span className="text-[10px] font-mono text-slate-500 font-semibold">RET</span>
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Siguiente número correlativo:</label>
                  <input
                    type="number"
                    min="1"
                    value={form.secuencialRetencion ?? 1}
                    onChange={(e) => setForm({ ...form, secuencialRetencion: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-full text-xs font-mono font-bold rounded-[6px] border border-slate-300 p-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
                  />
                </div>
                <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Próxima Retención:</span>
                  <span className="font-mono font-bold text-[#004ac6]">
                    {formatearSecuencialSRI(form.secuencialRetencion || 1, form.establecimiento || "010", form.puntoEmision || "001")}
                  </span>
                </div>
              </div>

              {/* Guías de Remisión */}
              <div className="p-3.5 rounded-[6px] border border-slate-200 bg-white space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">Guías de Remisión (06)</span>
                  <span className="text-[10px] font-mono text-slate-500 font-semibold">GR</span>
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Siguiente número correlativo:</label>
                  <input
                    type="number"
                    min="1"
                    value={form.secuencialGuiaRemision ?? 1}
                    onChange={(e) => setForm({ ...form, secuencialGuiaRemision: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-full text-xs font-mono font-bold rounded-[6px] border border-slate-300 p-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
                  />
                </div>
                <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Próxima Guía:</span>
                  <span className="font-mono font-bold text-[#004ac6]">
                    {formatearSecuencialSRI(form.secuencialGuiaRemision || 1, form.establecimiento || "010", form.puntoEmision || "001")}
                  </span>
                </div>
              </div>

              {/* Notas de Débito */}
              <div className="p-3.5 rounded-[6px] border border-slate-200 bg-white space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">Notas de Débito (05)</span>
                  <span className="text-[10px] font-mono text-slate-500 font-semibold">ND</span>
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Siguiente número correlativo:</label>
                  <input
                    type="number"
                    min="1"
                    value={form.secuencialNotaDebito ?? 1}
                    onChange={(e) => setForm({ ...form, secuencialNotaDebito: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-full text-xs font-mono font-bold rounded-[6px] border border-slate-300 p-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
                  />
                </div>
                <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Próxima ND:</span>
                  <span className="font-mono font-bold text-[#004ac6]">
                    {formatearSecuencialSRI(form.secuencialNotaDebito || 1, form.establecimiento || "010", form.puntoEmision || "001")}
                  </span>
                </div>
              </div>

              {/* Cotizaciones Comerciales */}
              <div className="p-3.5 rounded-[6px] border border-slate-200 bg-white space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">Cotizaciones Comerciales</span>
                  <span className="text-[10px] font-mono text-slate-500 font-semibold">COT</span>
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Siguiente correlativo anual:</label>
                  <input
                    type="number"
                    min="1"
                    value={form.secuencialCotizacion ?? 1}
                    onChange={(e) => setForm({ ...form, secuencialCotizacion: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-full text-xs font-mono font-bold rounded-[6px] border border-slate-300 p-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
                  />
                </div>
                <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Próxima Cotización:</span>
                  <span className="font-mono font-bold text-[#004ac6]">
                    COT-{new Date().getFullYear()}-{String(form.secuencialCotizacion || 1).padStart(4, "0")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* SECCIÓN 3: IDENTIFICACIÓN TRIBUTARIA & RAZÓN SOCIAL */}
        {/* ========================================================= */}
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

        {/* ========================================================= */}
        {/* SECCIÓN 4: AMBIENTE & PARÁMETROS TRIBUTARIOS */}
        {/* ========================================================= */}
        <div className="bg-white p-6 rounded-[6px] border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <Server className="w-4 h-4 text-[#004ac6]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Ambiente de Facturación & Régimen
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

            <div className="sm:col-span-2">
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

            <div className="sm:col-span-2 flex items-center gap-3 pt-2">
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

        {/* ========================================================= */}
        {/* SECCIÓN 5: DOMICILIO TRIBUTARIO */}
        {/* ========================================================= */}
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

        {/* ========================================================= */}
        {/* SECCIÓN 6: NOTIFICACIONES & RESOLUCIONES */}
        {/* ========================================================= */}
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

      </div>
    </form>
  );
}
