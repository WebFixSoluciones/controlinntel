"use client";

import React, { useState, useEffect, useRef } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { api } from "@/lib/api-client";
import { auth } from "@/lib/firebase";
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

type EmailFormState = {
  emailEnabled: boolean;
  emailHost: string;
  emailPort: number;
  emailSecure: boolean;
  emailUser: string;
  emailFromName: string;
  emailFrom: string;
  emailReplyTo: string;
  emailCopyTo: string;
  emailNotifyClient: boolean;
  emailNotifyCompany: boolean;
  hasPassword?: boolean;
};

const EMPTY_EMAIL_FORM: EmailFormState = {
  emailEnabled: false,
  emailHost: "",
  emailPort: 587,
  emailSecure: false,
  emailUser: "",
  emailFromName: "",
  emailFrom: "",
  emailReplyTo: "",
  emailCopyTo: "",
  emailNotifyClient: true,
  emailNotifyCompany: false,
};

interface CertificateResponse {
  stored: boolean;
  certificado: {
    nombre: string;
    vencimiento: string;
    emisor: string;
    tamano: number;
    fechaCarga: string;
    cargado: boolean;
  };
}

interface EmailResponse {
  config: EmailFormState;
  complete: boolean;
}

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
    certificadoCargado: Boolean(sriCompanyConfig?.certificadoCargado && sriCompanyConfig?.certificadoNombre),
    certificadoTamano: sriCompanyConfig?.certificadoTamano,
    certificadoFechaCarga: sriCompanyConfig?.certificadoFechaCarga,
    secuencialFactura: sriCompanyConfig?.secuencialFactura ?? 1,
    secuencialNotaVenta: sriCompanyConfig?.secuencialNotaVenta ?? 1,
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

  // Firma electrónica: el archivo y la contraseña se envían al servidor y
  // nunca se guardan en el documento público de configuración.
  const [certFile, setCertFile] = useState<{ name: string; base64: string; size: number } | null>(null);
  const [certPassword, setCertPassword] = useState("");
  const [certBusy, setCertBusy] = useState(false);
  const [certStored, setCertStored] = useState(false);
  const [certLoaded, setCertLoaded] = useState(false);

  // Entrega de documentos por correo (configuración independiente).
  const [emailForm, setEmailForm] = useState<EmailFormState>(EMPTY_EMAIL_FORM);
  const [emailPassword, setEmailPassword] = useState("");
  const [emailHasPassword, setEmailHasPassword] = useState(false);
  const [emailComplete, setEmailComplete] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);

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

  useEffect(() => {
    let active = true;
    api<CertificateResponse>("/api/sri/certificado")
      .then((response) => {
        if (!active) return;
        setCertLoaded(true);
        setCertStored(Boolean(response.stored));
        setForm((prev) => ({
          ...prev,
          certificadoNombre: response.certificado.nombre || prev.certificadoNombre,
          certificadoVencimiento: response.certificado.vencimiento || prev.certificadoVencimiento,
          certificadoEmisor: response.certificado.emisor || prev.certificadoEmisor,
          certificadoTamano: response.certificado.tamano || prev.certificadoTamano,
          certificadoFechaCarga: response.certificado.fechaCarga || prev.certificadoFechaCarga,
          certificadoCargado: Boolean(response.stored) && response.certificado.cargado,
        }));
      })
      .catch(() => {
        if (active) setCertLoaded(true);
      });

    api<EmailResponse>("/api/settings/email")
      .then((response) => {
        if (!active) return;
        setEmailForm({ ...EMPTY_EMAIL_FORM, ...response.config });
        setEmailHasPassword(Boolean(response.config.hasPassword));
        setEmailComplete(Boolean(response.complete));
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "p12" && ext !== "pfx") {
      showError("Formato No Válido", "Selecciona un archivo con extensión .p12 o .pfx (estándar PKCS#12 del SRI).");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      showError("Archivo Demasiado Grande", "El certificado de firma no debe exceder los 2 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const base64Data = String(loadEvent.target?.result || "");
      setCertFile({ name: file.name, base64: base64Data, size: file.size });
      setCertPassword("");
      showSuccess(
        "Firma Cargada",
        `"${file.name}" listo (${(file.size / 1024).toFixed(1)} KB). Ingresa la contraseña y valídalo.`
      );
    };
    reader.onerror = () => {
      showError("Error de Lectura", "No se pudo leer el archivo de la firma electrónica.");
    };
    reader.readAsDataURL(file);
  };

  const certificatePayload = (action: "validar" | "guardar") => ({
    action,
    certificadoBase64: certFile?.base64 || "",
    certificadoClave: certPassword,
    nombreArchivo: certFile?.name || undefined,
  });

  const handleValidateCert = async () => {
    if (!certFile) {
      showError("Sin Firma Cargada", "Por favor primero sube tu archivo de firma electrónica (.p12 o .pfx).");
      return;
    }
    if (!certPassword.trim()) {
      showWarning("Contraseña Requerida", "Ingresa la contraseña de la firma para validarla.");
      return;
    }
    setCertBusy(true);
    try {
      const response = await api<{ message: string; certificado: { vencimiento: string; emisor: string; titular: string; expiresInDays: number } }>(
        "/api/sri/certificado",
        certificatePayload("validar")
      );
      showSuccess(
        "Firma Verificada",
        `${response.certificado.titular || certFile.name} · vence ${response.certificado.vencimiento} (${response.certificado.expiresInDays} días).`
      );
    } catch (err: any) {
      showError("Firma No Válida", err?.message || "No se pudo validar el certificado.");
    } finally {
      setCertBusy(false);
    }
  };

  const handleSaveCert = async () => {
    if (!certFile) {
      showError("Sin Firma Cargada", "Sube el archivo .p12 o .pfx antes de guardarlo.");
      return;
    }
    if (!certPassword.trim()) {
      showWarning("Contraseña Requerida", "Ingresa la contraseña de la firma para guardarla.");
      return;
    }
    setCertBusy(true);
    try {
      const response = await api<{ message: string; certificado: { nombre: string; vencimiento: string; emisor: string; tamano: number; fechaCarga: string } }>(
        "/api/sri/certificado",
        certificatePayload("guardar")
      );
      setForm((prev) => ({
        ...prev,
        certificadoNombre: response.certificado.nombre,
        certificadoVencimiento: response.certificado.vencimiento,
        certificadoEmisor: response.certificado.emisor,
        certificadoTamano: response.certificado.tamano,
        certificadoFechaCarga: response.certificado.fechaCarga,
        certificadoCargado: true,
      }));
      setCertStored(true);
      setCertFile(null);
      setCertPassword("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      showSuccess("Firma Guardada", response.message);
    } catch (err: any) {
      showError("No se Pudo Guardar", err?.message || "No se pudo guardar la firma electrónica.");
    } finally {
      setCertBusy(false);
    }
  };

  const handleRemoveCertificate = async () => {
    setCertBusy(true);
    try {
      const token = await auth?.currentUser?.getIdToken();
      const response = await fetch("/api/sri/certificado", {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error || "No se pudo eliminar la firma electrónica.");

      setForm((prev) => ({
        ...prev,
        certificadoNombre: "",
        certificadoCargado: false,
        certificadoTamano: undefined,
        certificadoFechaCarga: undefined,
        certificadoVencimiento: "",
      }));
      setCertFile(null);
      setCertPassword("");
      setCertStored(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      showSuccess("Firma Eliminada", "El certificado y su contraseña fueron borrados del servidor.");
    } catch (err: any) {
      showError("No se Pudo Eliminar", err?.message || "No se pudo eliminar la firma electrónica.");
    } finally {
      setCertBusy(false);
    }
  };

  const emailConfigPayload = () => {
    const { hasPassword, ...rest } = emailForm;
    return rest;
  };

  const saveEmailConfig = async () => {
    const response = await api<{ message: string; config: EmailFormState; complete: boolean }>(
      "/api/settings/email",
      {
        action: "guardar",
        config: emailConfigPayload(),
        password: emailPassword.trim() ? emailPassword : undefined,
      }
    );
    setEmailForm({ ...EMPTY_EMAIL_FORM, ...response.config });
    setEmailHasPassword(Boolean(response.config.hasPassword));
    setEmailComplete(Boolean(response.complete));
    setEmailPassword("");
    return response;
  };

  const handleSaveEmail = async () => {
    if (emailForm.emailEnabled && !emailForm.emailHost.trim()) {
      showWarning("Servidor Requerido", "Indica el servidor SMTP para activar la entrega de documentos por correo.");
      return;
    }
    setEmailBusy(true);
    try {
      const response = await saveEmailConfig();
      showSuccess(
        "Correo Guardado",
        response.complete
          ? "Los documentos autorizados se enviarán automáticamente por correo."
          : "Configuración guardada. Completa los datos para habilitar el envío."
      );
    } catch (err: any) {
      showError("No se Pudo Guardar", err?.message || "No se pudo guardar la configuración de correo.");
    } finally {
      setEmailBusy(false);
    }
  };

  const handleTestEmail = async () => {
    setEmailBusy(true);
    try {
      await saveEmailConfig();
      const response = await api<{ message: string }>("/api/settings/email", { action: "probar" });
      showSuccess("Conexión Verificada", response.message);
    } catch (err: any) {
      showError("Fallo de Conexión SMTP", err?.message || "No se pudo conectar con el servidor de correo.");
    } finally {
      setEmailBusy(false);
    }
  };

  const handleSendTestEmail = async () => {
    setEmailBusy(true);
    try {
      const saved = await saveEmailConfig();
      if (!saved.complete) {
        showWarning("Configuración Incompleta", "Completa servidor, puerto, usuario, remitente y contraseña antes de enviar la prueba.");
        return;
      }
      const destinatario = (emailForm.emailCopyTo || "").split(",")[0].trim() || emailForm.emailFrom;
      const response = await api<{ message: string }>("/api/settings/email", {
        action: "enviar_prueba",
        destinatario: destinatario || undefined,
      });
      showSuccess("Correo de Prueba Enviado", response.message);
    } catch (err: any) {
      showError("No se Pudo Enviar", err?.message || "No se pudo enviar el correo de prueba.");
    } finally {
      setEmailBusy(false);
    }
  };

  const handleRemoveEmailPassword = async () => {
    setEmailBusy(true);
    try {
      await api<{ message: string }>("/api/settings/email", { action: "eliminar_password" });
      setEmailPassword("");
      setEmailHasPassword(false);
      showSuccess("Contraseña Eliminada", "La contraseña SMTP fue borrada del servidor.");
    } catch (err: any) {
      showError("No se Pudo Eliminar", err?.message || "No se pudo eliminar la contraseña SMTP.");
    } finally {
      setEmailBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const finalEstablecimiento = String(form.establecimiento || "010").replace(/\D/g, "").padStart(3, "0").slice(-3);
      const finalPuntoEmision = String(form.puntoEmision || "001").replace(/\D/g, "").padStart(3, "0").slice(-3);

      const payload: SriCompanyConfig = {
        ...form,
        ...emailConfigPayload(),
        establecimiento: finalEstablecimiento,
        puntoEmision: finalPuntoEmision,
        secuencialFactura: Math.max(1, Number(form.secuencialFactura) || 1),
        secuencialNotaVenta: Math.max(1, Number(form.secuencialNotaVenta) || 1),
        secuencialNotaCredito: Math.max(1, Number(form.secuencialNotaCredito) || 1),
        secuencialNotaDebito: Math.max(1, Number(form.secuencialNotaDebito) || 1),
        secuencialRetencion: Math.max(1, Number(form.secuencialRetencion) || 1),
        secuencialGuiaRemision: Math.max(1, Number(form.secuencialGuiaRemision) || 1),
        secuencialCotizacion: Math.max(1, Number(form.secuencialCotizacion) || 1),
      };

      // Los secretos de firma (.p12 y contraseña) viven solo en el servidor.
      delete payload.certificadoBase64;
      delete payload.certificadoClave;

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

  const serieActual = `${String(form.establecimiento || "010").padStart(3, "0")}-${String(form.puntoEmision || "001").padStart(3, "0")}`;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 1. BARRA SUPERIOR COMPACTA DE ACCIONES & ESTADO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-[#e2e8f0] shadow-2xs">
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Switch rápido de ambiente */}
          <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setForm({ ...form, ambiente: "1" })}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition cursor-pointer ${
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
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition cursor-pointer ${
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
            <span>Serie: <strong className="font-mono text-[#004ac6] bg-[#eff4ff] px-2 py-0.5 rounded-md border border-[#bfdbfe]">{serieActual}</strong></span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTestingConn}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
          >
            <Wifi className={`w-3.5 h-3.5 ${isTestingConn ? "animate-pulse text-[#004ac6]" : ""}`} />
            <span>{isTestingConn ? "Probando..." : "Comprobar SRI"}</span>
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#004ac6] hover:bg-[#003da6] disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSubmitting ? "Guardando..." : "Guardar Configuración"}</span>
          </button>
        </div>
      </div>

      {/* Alerta de prueba de conexión compacta */}
      {connTestResult && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between gap-3 shadow-2xs">
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
      <div className="bg-white p-4 rounded-xl border border-[#e2e8f0] shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-[#004ac6]" />
            <h2 className="text-xs font-bold text-slate-800">
              Firma Electrónica Digital (.p12 / .pfx)
            </h2>
          </div>

          {!certLoaded ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Verificando...</span>
            </span>
          ) : certStored ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Firma Activa</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
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

        {certFile ? (
          /* Archivo seleccionado: validar y guardar en el servidor */
          <div className="p-3 bg-[#f8faff] rounded-lg border border-[#bfdbfe] space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs">
                <FileCheck className="w-3.5 h-3.5 text-[#004ac6]" />
                <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded-md border border-[#e2e8f0]">
                  {certFile.name}
                </span>
                <span className="text-[11px] text-slate-500">
                  ({(certFile.size / 1024).toFixed(1)} KB)
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setCertFile(null);
                  setCertPassword("");
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="px-2 py-1 bg-white hover:bg-slate-100 border border-[#cbd5e1] rounded-md text-xs font-semibold text-slate-700 transition cursor-pointer"
              >
                Descartar
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="relative">
                <input
                  type={showCertPassword ? "text" : "password"}
                  value={certPassword}
                  onChange={(e) => setCertPassword(e.target.value)}
                  className="w-full rounded-lg border border-[#cbd5e1] py-1.5 px-2.5 pr-7 bg-white text-xs font-mono"
                  placeholder="Contraseña del .p12"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowCertPassword(!showCertPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  {showCertPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
              </div>

              <button
                type="button"
                onClick={handleValidateCert}
                disabled={certBusy}
                className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{certBusy ? "Verificando..." : "Validar Firma"}</span>
              </button>

              <button
                type="button"
                onClick={handleSaveCert}
                disabled={certBusy}
                className="w-full py-1.5 bg-[#004ac6] hover:bg-[#003da6] disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{certBusy ? "Guardando..." : "Guardar Firma"}</span>
              </button>
            </div>

            <p className="text-[10px] text-slate-500">
              El archivo y su contraseña se guardan únicamente en el servidor y nunca se envían al navegador.
            </p>
          </div>
        ) : certStored ? (
          /* Firma ya guardada en el servidor */
          <div className="p-3 bg-slate-50 rounded-lg border border-[#e2e8f0] space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded-md border border-[#e2e8f0]">
                  {form.certificadoNombre || "Certificado de firma"}
                </span>
                {Boolean(form.certificadoTamano) && (
                  <span className="text-[11px] text-slate-500">
                    ({((form.certificadoTamano || 0) / 1024).toFixed(1)} KB)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-[#cbd5e1] rounded-md text-xs font-semibold text-slate-700 transition cursor-pointer"
                >
                  Reemplazar .p12
                </button>
                <button
                  type="button"
                  onClick={handleRemoveCertificate}
                  disabled={certBusy}
                  className="px-2 py-1 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 border border-rose-200 rounded-md text-xs font-semibold text-rose-700 transition cursor-pointer"
                >
                  Quitar
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-600">
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400">Vence</span>
                <span className="font-mono">{form.certificadoVencimiento || "No registrado"}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400">Entidad emisora</span>
                <span>{form.certificadoEmisor || "No registrada"}</span>
              </div>
            </div>
          </div>
        ) : (
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
            className="p-3 border border-dashed border-blue-300 hover:border-[#004ac6] bg-[#f8faff] hover:bg-[#eff6ff] rounded-lg flex flex-col sm:flex-row items-center justify-between gap-3 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-2.5 text-xs">
              <div className="p-1.5 bg-blue-100 text-[#004ac6] rounded-md">
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
              className="px-3 py-1.5 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg text-xs font-bold transition shrink-0 cursor-pointer"
            >
              Examinar Archivo .p12
            </button>
          </div>
        )}
      </div>

      {/* 3. TARJETA COMPACTA: SERIE & CONTROL DE SECUENCIAS */}
      <div className="bg-white p-4 rounded-xl border border-[#e2e8f0] shadow-2xs space-y-3">
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
                className="w-14 text-center font-mono font-bold py-1 px-1.5 border border-[#cbd5e1] rounded-md bg-white text-[#004ac6]"
              />
              <div className="inline-flex rounded-md border border-[#cbd5e1] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, establecimiento: "010" })}
                  className={`px-2 py-0.5 text-[11px] font-bold ${form.establecimiento === "010" ? "bg-[#004ac6] text-white" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`}
                >
                  010 (Operativa)
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, establecimiento: "011" })}
                  className={`px-2 py-0.5 text-[11px] font-bold border-l border-[#cbd5e1] ${form.establecimiento === "011" ? "bg-[#004ac6] text-white" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`}
                >
                  011
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, establecimiento: "001" })}
                  className={`px-2 py-0.5 text-[11px] font-bold border-l border-[#cbd5e1] ${form.establecimiento === "001" ? "bg-[#004ac6] text-white" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`}
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
                className="w-14 text-center font-mono font-bold py-1 px-1.5 border border-[#cbd5e1] rounded-md bg-white text-[#004ac6]"
              />
              <div className="inline-flex rounded-md border border-[#cbd5e1] overflow-hidden">
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
                  className={`px-2 py-0.5 text-[11px] font-bold border-l border-[#cbd5e1] ${form.puntoEmision === "002" ? "bg-[#004ac6] text-white" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`}
                >
                  002
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tabla compacta de secuencias numéricas */}
        <div className="overflow-x-auto rounded-xl border border-[#e2e8f0]">
          <table className="table-fixed w-full text-left text-xs border-collapse">
            <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-xs uppercase tracking-wider border-b border-[#e2e8f0]">
              <tr>
                <th className="py-2.5 px-3 w-[40%]">Comprobante</th>
                <th className="py-2.5 px-2 text-center w-[15%]">Código</th>
                <th className="py-2.5 px-3 w-[20%]">Siguiente Secuencial</th>
                <th className="py-2.5 px-3 text-right w-[25%]">Vista Previa Oficial SRI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9] font-medium">
              {/* Facturas */}
              <tr className="hover:bg-[#f8f9ff] transition-colors">
                <td className="py-2 px-3 font-semibold text-slate-800">Factura de Venta</td>
                <td className="py-2 px-2 text-center text-[11px] font-mono text-slate-400">01</td>
                <td className="py-2 px-3">
                  <input
                    type="number"
                    min="1"
                    value={form.secuencialFactura ?? 1}
                    onChange={(e) => setForm({ ...form, secuencialFactura: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-24 py-1 px-2 text-xs font-mono font-bold rounded-md border border-[#cbd5e1] bg-white"
                  />
                </td>
                <td className="py-2 px-3 text-right font-mono font-bold text-[#004ac6]">
                  {formatearSecuencialSRI(form.secuencialFactura || 1, form.establecimiento || "010", form.puntoEmision || "001")}
                </td>
              </tr>

              {/* Notas de Venta (Recibo Interno) */}
              <tr className="hover:bg-[#f8f9ff] transition-colors">
                <td className="py-2 px-3 font-semibold text-slate-800">Nota de Venta (Recibo Interno)</td>
                <td className="py-2 px-2 text-center text-[11px] font-mono text-slate-400">NV</td>
                <td className="py-2 px-3">
                  <input
                    type="number"
                    min="1"
                    value={form.secuencialNotaVenta ?? 1}
                    onChange={(e) => setForm({ ...form, secuencialNotaVenta: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-24 py-1 px-2 text-xs font-mono font-bold rounded-md border border-[#cbd5e1] bg-white"
                  />
                </td>
                <td className="py-2 px-3 text-right font-mono font-bold text-slate-700">
                  {formatearSecuencialSRI(form.secuencialNotaVenta || 1, form.establecimiento || "010", form.puntoEmision || "001")}
                </td>
              </tr>

              {/* Notas de Crédito */}
              <tr className="hover:bg-[#f8f9ff] transition-colors">
                <td className="py-2 px-3 font-semibold text-slate-800">Nota de Crédito</td>
                <td className="py-2 px-2 text-center text-[11px] font-mono text-slate-400">04</td>
                <td className="py-2 px-3">
                  <input
                    type="number"
                    min="1"
                    value={form.secuencialNotaCredito ?? 1}
                    onChange={(e) => setForm({ ...form, secuencialNotaCredito: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-24 py-1 px-2 text-xs font-mono font-bold rounded-md border border-[#cbd5e1] bg-white"
                  />
                </td>
                <td className="py-2 px-3 text-right font-mono font-bold text-[#004ac6]">
                  {formatearSecuencialSRI(form.secuencialNotaCredito || 1, form.establecimiento || "010", form.puntoEmision || "001")}
                </td>
              </tr>

              {/* Retenciones */}
              <tr className="hover:bg-[#f8f9ff] transition-colors">
                <td className="py-2 px-3 font-semibold text-slate-800">Comprobante de Retención</td>
                <td className="py-2 px-2 text-center text-[11px] font-mono text-slate-400">07</td>
                <td className="py-2 px-3">
                  <input
                    type="number"
                    min="1"
                    value={form.secuencialRetencion ?? 1}
                    onChange={(e) => setForm({ ...form, secuencialRetencion: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-24 py-1 px-2 text-xs font-mono font-bold rounded-md border border-[#cbd5e1] bg-white"
                  />
                </td>
                <td className="py-2 px-3 text-right font-mono font-bold text-[#004ac6]">
                  {formatearSecuencialSRI(form.secuencialRetencion || 1, form.establecimiento || "010", form.puntoEmision || "001")}
                </td>
              </tr>

              {/* Guías de Remisión */}
              <tr className="hover:bg-[#f8f9ff] transition-colors">
                <td className="py-2 px-3 font-semibold text-slate-800">Guía de Remisión</td>
                <td className="py-2 px-2 text-center text-[11px] font-mono text-slate-400">06</td>
                <td className="py-2 px-3">
                  <input
                    type="number"
                    min="1"
                    value={form.secuencialGuiaRemision ?? 1}
                    onChange={(e) => setForm({ ...form, secuencialGuiaRemision: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-24 py-1 px-2 text-xs font-mono font-bold rounded-md border border-[#cbd5e1] bg-white"
                  />
                </td>
                <td className="py-2 px-3 text-right font-mono font-bold text-[#004ac6]">
                  {formatearSecuencialSRI(form.secuencialGuiaRemision || 1, form.establecimiento || "010", form.puntoEmision || "001")}
                </td>
              </tr>

              {/* Notas de Débito */}
              <tr className="hover:bg-[#f8f9ff] transition-colors">
                <td className="py-2 px-3 font-semibold text-slate-800">Nota de Débito</td>
                <td className="py-2 px-2 text-center text-[11px] font-mono text-slate-400">05</td>
                <td className="py-2 px-3">
                  <input
                    type="number"
                    min="1"
                    value={form.secuencialNotaDebito ?? 1}
                    onChange={(e) => setForm({ ...form, secuencialNotaDebito: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-24 py-1 px-2 text-xs font-mono font-bold rounded-md border border-[#cbd5e1] bg-white"
                  />
                </td>
                <td className="py-2 px-3 text-right font-mono font-bold text-[#004ac6]">
                  {formatearSecuencialSRI(form.secuencialNotaDebito || 1, form.establecimiento || "010", form.puntoEmision || "001")}
                </td>
              </tr>

              {/* Cotizaciones */}
              <tr className="hover:bg-[#f8f9ff] transition-colors">
                <td className="py-2 px-3 font-semibold text-slate-800">Cotización Comercial</td>
                <td className="py-2 px-2 text-center text-[11px] font-mono text-slate-400">COT</td>
                <td className="py-2 px-3">
                  <input
                    type="number"
                    min="1"
                    value={form.secuencialCotizacion ?? 1}
                    onChange={(e) => setForm({ ...form, secuencialCotizacion: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-24 py-1 px-2 text-xs font-mono font-bold rounded-md border border-[#cbd5e1] bg-white"
                  />
                </td>
                <td className="py-2 px-3 text-right font-mono font-bold text-[#004ac6]">
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
        <div className="bg-white p-4 rounded-xl border border-[#e2e8f0] shadow-2xs space-y-2.5">
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
                className="w-full text-xs font-mono font-bold rounded-lg border border-[#cbd5e1] p-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Razón Social *</label>
              <input
                type="text"
                required
                value={form.razonSocial}
                onChange={(e) => setForm({ ...form, razonSocial: e.target.value })}
                className="w-full text-xs font-medium rounded-lg border border-[#cbd5e1] p-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Nombre Comercial</label>
              <input
                type="text"
                value={form.nombreComercial}
                onChange={(e) => setForm({ ...form, nombreComercial: e.target.value })}
                className="w-full text-xs rounded-lg border border-[#cbd5e1] p-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Tipo Contribuyente</label>
                <select
                  value={form.tipoContribuyente}
                  onChange={(e) => setForm({ ...form, tipoContribuyente: e.target.value as any })}
                  className="w-full text-xs rounded-lg border border-[#cbd5e1] p-2 bg-white font-medium focus:ring-2 focus:ring-[#004ac6] outline-hidden cursor-pointer"
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
                  className="w-4 h-4 rounded text-[#004ac6] border-slate-300 focus:ring-[#004ac6] cursor-pointer"
                />
                <label htmlFor="obligadoContabilidad" className="text-[11px] font-bold text-slate-700 cursor-pointer">
                  Obligado Contabilidad
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Domicilio & Notificaciones */}
        <div className="bg-white p-4 rounded-xl border border-[#e2e8f0] shadow-2xs space-y-2.5">
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
                className="w-full text-xs rounded-lg border border-[#cbd5e1] p-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Dirección Sucursal ({form.establecimiento}) *</label>
              <input
                type="text"
                required
                value={form.direccionEstablecimiento}
                onChange={(e) => setForm({ ...form, direccionEstablecimiento: e.target.value })}
                className="w-full text-xs rounded-lg border border-[#cbd5e1] p-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Email Notificaciones RIDE</label>
                <input
                  type="email"
                  value={form.emailNotificaciones || ""}
                  onChange={(e) => setForm({ ...form, emailNotificaciones: e.target.value })}
                  className="w-full text-xs rounded-lg border border-[#cbd5e1] p-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
                  placeholder="facturacion@empresa.com"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Teléfono de Contacto</label>
                <input
                  type="text"
                  value={form.telefonoContacto || ""}
                  onChange={(e) => setForm({ ...form, telefonoContacto: e.target.value })}
                  className="w-full text-xs rounded-lg border border-[#cbd5e1] p-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
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
                  className="w-full text-xs rounded-lg border border-[#cbd5e1] p-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
                  placeholder="Opcional"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Contribuyente Especial</label>
                <input
                  type="text"
                  value={form.contribuyenteEspecial || ""}
                  onChange={(e) => setForm({ ...form, contribuyenteEspecial: e.target.value })}
                  className="w-full text-xs rounded-lg border border-[#cbd5e1] p-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
                  placeholder="Opcional"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. TARJETA COMPACTA: ENTREGA DE DOCUMENTOS POR CORREO */}
      <div className="bg-white p-4 rounded-xl border border-[#e2e8f0] shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-[#004ac6]" />
            <h2 className="text-xs font-bold text-slate-800">Entrega de Documentos por Correo</h2>
          </div>

          <div className="flex items-center gap-2">
            {emailComplete ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>Listo para Enviar</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                <AlertTriangle className="w-3 h-3 text-amber-600" />
                <span>Configuración Incompleta</span>
              </span>
            )}

            <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={emailForm.emailEnabled}
                onChange={(e) => setEmailForm({ ...emailForm, emailEnabled: e.target.checked })}
                className="w-4 h-4 rounded text-[#004ac6] border-slate-300 focus:ring-[#004ac6] cursor-pointer"
              />
              <span>Envío automático</span>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
          <div className="lg:col-span-2">
            <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Servidor SMTP *</label>
            <input
              type="text"
              value={emailForm.emailHost}
              onChange={(e) => setEmailForm({ ...emailForm, emailHost: e.target.value })}
              className="w-full text-xs rounded-lg border border-[#cbd5e1] p-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
              placeholder="smtp.gmail.com"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Puerto *</label>
            <input
              type="number"
              min={1}
              max={65535}
              value={emailForm.emailPort}
              onChange={(e) =>
                setEmailForm({ ...emailForm, emailPort: Math.max(1, parseInt(e.target.value) || 587) })
              }
              className="w-full text-xs font-mono rounded-lg border border-[#cbd5e1] p-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
            />
          </div>

          <div className="flex items-center gap-2 pt-4">
            <input
              type="checkbox"
              id="emailSecure"
              checked={emailForm.emailSecure}
              onChange={(e) => setEmailForm({ ...emailForm, emailSecure: e.target.checked })}
              className="w-4 h-4 rounded text-[#004ac6] border-slate-300 focus:ring-[#004ac6] cursor-pointer"
            />
            <label htmlFor="emailSecure" className="text-[11px] font-bold text-slate-700 cursor-pointer">
              SSL/TLS directo (puerto 465)
            </label>
          </div>

          <div className="lg:col-span-2">
            <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Usuario SMTP *</label>
            <input
              type="text"
              value={emailForm.emailUser}
              onChange={(e) => setEmailForm({ ...emailForm, emailUser: e.target.value })}
              className="w-full text-xs rounded-lg border border-[#cbd5e1] p-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
              placeholder="facturacion@inntelcorp.com"
              autoComplete="off"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">
              Contraseña SMTP {emailHasPassword && <span className="text-emerald-600">(guardada)</span>}
            </label>
            <input
              type="password"
              value={emailPassword}
              onChange={(e) => setEmailPassword(e.target.value)}
              className="w-full text-xs font-mono rounded-lg border border-[#cbd5e1] p-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
              placeholder={emailHasPassword ? "•••••••• (dejar vacío para conservarla)" : "Contraseña o clave de aplicación"}
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Nombre Remitente</label>
            <input
              type="text"
              value={emailForm.emailFromName}
              onChange={(e) => setEmailForm({ ...emailForm, emailFromName: e.target.value })}
              className="w-full text-xs rounded-lg border border-[#cbd5e1] p-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
              placeholder="INNTEL CORP S.A."
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Correo Remitente *</label>
            <input
              type="email"
              value={emailForm.emailFrom}
              onChange={(e) => setEmailForm({ ...emailForm, emailFrom: e.target.value })}
              className="w-full text-xs rounded-lg border border-[#cbd5e1] p-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
              placeholder="facturacion@inntelcorp.com"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Responder a</label>
            <input
              type="email"
              value={emailForm.emailReplyTo}
              onChange={(e) => setEmailForm({ ...emailForm, emailReplyTo: e.target.value })}
              className="w-full text-xs rounded-lg border border-[#cbd5e1] p-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
              placeholder="Opcional"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Copia oculta (separadas por coma)</label>
            <input
              type="text"
              value={emailForm.emailCopyTo}
              onChange={(e) => setEmailForm({ ...emailForm, emailCopyTo: e.target.value })}
              className="w-full text-xs rounded-lg border border-[#cbd5e1] p-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
              placeholder="contabilidad@inntelcorp.com"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-700">
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={emailForm.emailNotifyClient}
                onChange={(e) => setEmailForm({ ...emailForm, emailNotifyClient: e.target.checked })}
                className="w-4 h-4 rounded text-[#004ac6] border-slate-300 focus:ring-[#004ac6] cursor-pointer"
              />
              <span>Enviar copia al cliente</span>
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={emailForm.emailNotifyCompany}
                onChange={(e) => setEmailForm({ ...emailForm, emailNotifyCompany: e.target.checked })}
                className="w-4 h-4 rounded text-[#004ac6] border-slate-300 focus:ring-[#004ac6] cursor-pointer"
              />
              <span>Enviar copia a la empresa</span>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={handleSaveEmail}
              disabled={emailBusy}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#004ac6] hover:bg-[#003da6] disabled:opacity-50 text-white rounded-lg text-xs font-bold transition cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Guardar Correo</span>
            </button>

            <button
              type="button"
              onClick={handleTestEmail}
              disabled={emailBusy}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition cursor-pointer"
            >
              <Wifi className="w-3.5 h-3.5" />
              <span>Probar Conexión</span>
            </button>

            <button
              type="button"
              onClick={handleSendTestEmail}
              disabled={emailBusy}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-100 disabled:opacity-50 border border-[#cbd5e1] text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Enviar Prueba</span>
            </button>

            <button
              type="button"
              onClick={handleRemoveEmailPassword}
              disabled={emailBusy || !emailHasPassword}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 disabled:opacity-40 border border-rose-200 text-rose-700 rounded-lg text-xs font-bold transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Borrar Clave</span>
            </button>
          </div>
        </div>

        <p className="text-[10px] text-slate-500">
          Al autorizarse una factura, el SRI y el RIDE se envían por correo al cliente. La contraseña SMTP se guarda cifrada
          en el servidor y nunca se devuelve al navegador.
        </p>
      </div>
    </form>
  );
}
