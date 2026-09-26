"use client";

import React, { useState, useMemo } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { ArcotelPolicy, ArcotelPeriodicFile, ArcotelSubsystem } from "@/types";
import { PoliciesList } from "./PoliciesList";
import { PolicyModal } from "./PolicyModal";
import {
  ShieldCheck,
  FileSpreadsheet,
  Upload,
  Plus,
  Trash2,
  Download,
  Calendar,
  Globe,
  FileText,
  FileCheck,
  AlertTriangle,
  Clock,
  ExternalLink,
  RotateCcw,
  CheckCircle2,
  SlidersHorizontal,
  X,
  Layers,
  ArrowRight,
  Database,
  Building2,
  Bell,
  Search,
} from "lucide-react";

export function ArcotelManager() {
  const {
    arcotelConcession,
    updateArcotelConcession,
    arcotelFiles,
    addArcotelFile,
    deleteArcotelFile,
    policies,
    clients,
    clientServices,
    nodes,
    plans,
    currentUser,
  } = useApp();
  const { showSuccess, showError, showConfirm } = useToast();

  const [activeTab, setActiveTab] = useState<
    "concesion" | "sietel" | "fodetel" | "contingencia" | "bdh" | "transformador" | "polizas"
  >("concesion");

  const [sietelSubTab, setSietelSubTab] = useState<
    "sietel_lopam" | "sietel_tarifas" | "sietel_usuarios" | "sietel_calidad" | "sietel_encuestas" | "sietel_capacidades"
  >("sietel_lopam");

  // Concession Form State
  const [concessionForm, setConcessionForm] = useState(arcotelConcession);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);

  // File Upload Modal State
  const [isFileModalOpen, setIsFileModalOpen] = useState(false);
  const [targetSubsystem, setTargetSubsystem] = useState<ArcotelSubsystem>("sietel_lopam");
  const [uploadPeriod, setUploadPeriod] = useState("");
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  // Transformador ARCOTEL State
  const [transformReportType, setTransformReportType] = useState<"abonados_sietel" | "tarifas" | "nodos_transito">(
    "abonados_sietel"
  );
  const [transformPeriod, setTransformPeriod] = useState("Septiembre 2026");

  // Calculate Policy reminder countdown
  const policyReminderStatus = useMemo(() => {
    if (!arcotelConcession.lastPolicyDate) return null;
    const policyDate = new Date(arcotelConcession.lastPolicyDate);
    const now = new Date();
    // One year policy validity by default
    const expirationDate = new Date(policyDate);
    expirationDate.setFullYear(expirationDate.getFullYear() + 1);

    const diffDays = Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const reminderThreshold = arcotelConcession.reminderDays || 30;

    return {
      expirationDate: expirationDate.toISOString().split("T")[0],
      daysRemaining: diffDays,
      isReminderTriggered: diffDays <= reminderThreshold,
      isExpired: diffDays <= 0,
    };
  }, [arcotelConcession]);

  const handleSaveConcession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateArcotelConcession(concessionForm);
      showSuccess("Concesión Actualizada", "Datos del título habilitante ARCOTEL guardados.");
    } catch {
      showError("Error", "No se pudieron guardar los datos.");
    }
  };

  const handleAddCustomField = () => {
    const label = prompt("Ingresa el nombre del nuevo atributo regulatorio (ej. Número de Trámite Quipux):");
    if (!label) return;
    const currentFields = concessionForm.additionalFields || [];
    setConcessionForm({
      ...concessionForm,
      additionalFields: [
        ...currentFields,
        { id: "field-" + Date.now(), label, value: "" },
      ],
    });
  };

  const handleRemoveCustomField = (id: string) => {
    setConcessionForm({
      ...concessionForm,
      additionalFields: (concessionForm.additionalFields || []).filter((f) => f.id !== id),
    });
  };

  const handleOpenUploadModal = (subsystem: ArcotelSubsystem) => {
    setTargetSubsystem(subsystem);
    setUploadFile(null);
    setUploadNotes("");

    // Default period based on subsystem
    if (subsystem === "sietel_lopam") {
      setUploadPeriod(`Semana ${Math.ceil(new Date().getDate() / 7)} - ${new Date().getFullYear()}`);
    } else if (subsystem === "fodetel") {
      setUploadPeriod(`Trimestre III - ${new Date().getFullYear()}`);
    } else if (subsystem === "contingencia") {
      setUploadPeriod(`Vigencia Anual ${new Date().getFullYear()}`);
    } else {
      setUploadPeriod(`Septiembre ${new Date().getFullYear()}`);
    }

    setIsFileModalOpen(true);
  };

  const handleFileUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      showError("Archivo Requerido", "Selecciona un documento para cargar.");
      return;
    }

    setBusy(true);
    try {
      const ext = uploadFile.name.split(".").pop()?.toLowerCase() || "xlsx";
      const sizeKb = Math.round(uploadFile.size / 1024);
      const sizeStr = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;

      // Si es LOPAM, el PDF especifica: "esta solo basta con el último archivo"
      if (targetSubsystem === "sietel_lopam") {
        const oldLopam = arcotelFiles.filter((f) => f.subsystem === "sietel_lopam");
        for (const old of oldLopam) {
          await deleteArcotelFile(old.id);
        }
      }

      await addArcotelFile({
        subsystem: targetSubsystem,
        fileName: uploadFile.name,
        fileSize: sizeStr,
        period: uploadPeriod.trim(),
        uploadedBy: currentUser.displayName,
        fileType: ext as any,
        status: "vigente",
        notes: uploadNotes.trim() || undefined,
      });

      showSuccess("Archivo Cargado", `Se registró ${uploadFile.name} en ${targetSubsystem.replace("_", " ").toUpperCase()}.`);
      setIsFileModalOpen(false);
      setUploadFile(null);
    } catch (err: any) {
      showError("Error", err?.message || "No se pudo cargar el archivo.");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteFile = (fileId: string, name: string) => {
    showConfirm(
      "¿Eliminar Archivo Regulatorio?",
      `¿Confirmas la remoción del archivo ${name}?`,
      async () => {
        try {
          await deleteArcotelFile(fileId);
          showSuccess("Archivo Eliminado", "Documento retirado del repositorio.");
        } catch {
          showError("Error", "No se pudo eliminar el archivo.");
        }
      },
      "Eliminar Archivo"
    );
  };

  // Transformation engine: Transforms internal clients/services into official ARCOTEL SIETEL CSV structure (PDF Page 4)
  const handleExportTransformedArcotel = () => {
    try {
      if (transformReportType === "abonados_sietel") {
        // Official SIETEL format headers
        const headers = [
          "CODIGO_CONCESIONARIO",
          "TIPO_DOCUMENTO",
          "NUMERO_IDENTIFICACION",
          "RAZON_SOCIAL",
          "PROVINCIA",
          "CANTON",
          "PARROQUIA",
          "PLAN_SERVICIO",
          "VELOCIDAD_BAJADA_MBPS",
          "VELOCIDAD_SUBIDA_MBPS",
          "MODALIDAD",
          "TECNOLOGIA",
          "FECHA_CONTRATO",
          "ESTADO_SERVICIO",
        ];

        const rows = clients.map((c) => {
          const srv = clientServices.find((s) => s.clientId === c.id);
          return [
            `"${arcotelConcession.concessionaireCode}"`,
            `"${c.identificationType}"`,
            `"${c.identificationNumber}"`,
            `"${c.businessName}"`,
            `"Pichincha"`,
            `"Quito"`,
            `"${c.sector || "Matriz"}"`,
            `"${srv?.planName || "Internet Fibra"}"`,
            srv?.downloadMbps || 100,
            srv?.uploadMbps || 100,
            `"${srv?.billingType || "pospago"}"`,
            `"FIBRA OPTICA GPON"`,
            `"${srv?.installationDate || "2024-01-15"}"`,
            `"${c.status.toUpperCase()}"`,
          ].join(",");
        });

        const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `ARCOTEL_SIETEL_ABONADOS_${transformPeriod.replace(/\s+/g, "_")}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        showSuccess("Transformación Exitosa", `Archivo CSV compatible con el validador SIETEL de ARCOTEL generado.`);
      } else if (transformReportType === "tarifas") {
        const headers = ["CODIGO_CONCESIONARIO", "NOMBRE_PLAN", "TARIFA_REGISTRADA_USD", "MODALIDAD", "TECNOLOGIA"];
        const rows = plans.map((p) => [
          `"${arcotelConcession.concessionaireCode}"`,
          `"${p.name}"`,
          p.defaultPrice.toFixed(2),
          `"${p.billingType}"`,
          `"FIBRA OPTICA"`,
        ]);
        const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `ARCOTEL_MATRIZ_TARIFARIA_${transformPeriod.replace(/\s+/g, "_")}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        showSuccess("Tarifario Exportado", "Matriz de tarifas homologadas para ARCOTEL generada.");
      } else {
        const headers = ["CODIGO_CONCESIONARIO", "NODO_POP", "UBICACION", "PROVEEDORES_TRANSITO", "CAPACIDAD_TOTAL_MBPS"];
        const rows = nodes.map((n) => [
          `"${arcotelConcession.concessionaireCode}"`,
          `"${n.name}"`,
          `"${n.address}"`,
          `"${n.upstreamProvider}"`,
          n.totalCapacityMbps,
        ]);
        const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `ARCOTEL_CAPACIDADES_TRANSITO_${transformPeriod.replace(/\s+/g, "_")}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        showSuccess("Capacidades Exportadas", "Reporte de enlaces de tránsito internacional ARCOTEL generado.");
      }
    } catch {
      showError("Error", "No se pudo generar el archivo de transformación.");
    }
  };

  const getSubsystemFiles = (sub: ArcotelSubsystem) => {
    return arcotelFiles.filter((f) => f.subsystem === sub);
  };

  return (
    <div className="w-full space-y-6 select-none">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#004ac6] to-slate-800 flex items-center justify-center text-white shadow-xs">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#0b1c30] tracking-tight">
              Regulación & Cumplimiento ARCOTEL
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => handleOpenUploadModal("sietel_lopam")}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Subir Archivo Regulatorio</span>
          </button>
        </div>
      </div>

      {/* Main Navigation Ribbon */}
      <div className="flex items-center gap-2 border-b border-[#e2e8f0] pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("concesion")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "concesion"
              ? "bg-[#004ac6] text-white shadow-xs"
              : "bg-white text-[#434655] hover:bg-[#f8f9ff] border border-[#e2e8f0]"
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Título Habilitante & Concesión</span>
        </button>

        <button
          onClick={() => setActiveTab("sietel")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "sietel"
              ? "bg-[#004ac6] text-white shadow-xs"
              : "bg-white text-[#434655] hover:bg-[#f8f9ff] border border-[#e2e8f0]"
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>SIETEL (Archivos Periódicos)</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeTab === "sietel" ? "bg-white/20 text-white" : "bg-slate-100 text-[#434655]"
            }`}
          >
            {arcotelFiles.filter((f) => f.subsystem.startsWith("sietel")).length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("fodetel")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "fodetel"
              ? "bg-[#004ac6] text-white shadow-xs"
              : "bg-white text-[#434655] hover:bg-[#f8f9ff] border border-[#e2e8f0]"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>FODETEL (Trimestral)</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeTab === "fodetel" ? "bg-white/20 text-white" : "bg-slate-100 text-[#434655]"
            }`}
          >
            {getSubsystemFiles("fodetel").length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("contingencia")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "contingencia"
              ? "bg-[#004ac6] text-white shadow-xs"
              : "bg-white text-[#434655] hover:bg-[#f8f9ff] border border-[#e2e8f0]"
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Plan de Contingencia (Anual)</span>
        </button>

        <button
          onClick={() => setActiveTab("bdh")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "bdh"
              ? "bg-[#004ac6] text-white shadow-xs"
              : "bg-white text-[#434655] hover:bg-[#f8f9ff] border border-[#e2e8f0]"
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Sistema BDH</span>
        </button>

        <button
          onClick={() => setActiveTab("transformador")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "transformador"
              ? "bg-[#004ac6] text-white shadow-xs"
              : "bg-white text-[#434655] hover:bg-[#f8f9ff] border border-[#e2e8f0]"
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reportería & Transformador</span>
        </button>

        <button
          onClick={() => setActiveTab("polizas")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "polizas"
              ? "bg-[#004ac6] text-white shadow-xs"
              : "bg-white text-[#434655] hover:bg-[#f8f9ff] border border-[#e2e8f0]"
          }`}
        >
          <FileCheck className="w-3.5 h-3.5" />
          <span>Pólizas Regulatorias</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeTab === "polizas" ? "bg-white/20 text-white" : "bg-slate-100 text-[#434655]"
            }`}
          >
            {policies.length}
          </span>
        </button>
      </div>

      {/* PESTAÑA 1: TITULO HABILITANTE & DATOS DEL CONCESIONARIO (PDF Página 3) */}
      {activeTab === "concesion" && (
        <div className="space-y-6">
          {/* Banner de Recordatorio de Vencimiento de Póliza con Alerta Configurable */}
          {policyReminderStatus && (
            <div
              className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${
                policyReminderStatus.isExpired
                  ? "bg-rose-50 border-rose-200 text-rose-900"
                  : policyReminderStatus.isReminderTriggered
                  ? "bg-amber-50 border-amber-200 text-amber-900 animate-pulse"
                  : "bg-emerald-50 border-emerald-200 text-emerald-900"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                    policyReminderStatus.isExpired
                      ? "bg-rose-600 text-white"
                      : policyReminderStatus.isReminderTriggered
                      ? "bg-amber-600 text-white"
                      : "bg-emerald-600 text-white"
                  }`}
                >
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wide">
                    {policyReminderStatus.isExpired
                      ? "¡Póliza ARCOTEL Vencida!"
                      : policyReminderStatus.isReminderTriggered
                      ? `Recordatorio Activo: Póliza por renovar en ${policyReminderStatus.daysRemaining} días`
                      : "Póliza de Título Habilitante Vigente"}
                  </h4>
                  <p className="text-[11px] opacity-80">
                    Fecha última póliza: <strong>{arcotelConcession.lastPolicyDate}</strong> • Vencimiento calculado:{" "}
                    <strong>{policyReminderStatus.expirationDate}</strong> (Plazo alerta:{" "}
                    {arcotelConcession.reminderDays} días)
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveTab("polizas")}
                className="px-3 py-1.5 bg-white border border-current rounded-xl text-xs font-bold transition-all hover:bg-white/80 cursor-pointer"
              >
                Ver Pólizas
              </button>
            </div>
          )}

          {/* Formulario de Parámetros del Título Habilitante */}
          <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-lumina-card p-6">
            <form onSubmit={handleSaveConcession} className="space-y-5 text-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-[#0b1c30] text-sm flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#004ac6]" />
                  Datos del Título Habilitante & Sistemas Concesionarios (INNTEL CORP S.A.)
                </h3>
                <button
                  type="button"
                  onClick={handleAddCustomField}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Agregar Campo / Atributo</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="font-bold text-[#434655] block mb-1">Nombre del Título Habilitante *</label>
                  <input
                    type="text"
                    required
                    value={concessionForm.titleName}
                    onChange={(e) => setConcessionForm({ ...concessionForm, titleName: e.target.value })}
                    className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-xs font-semibold text-[#0b1c30] focus:ring-1 focus:ring-[#004ac6]"
                  />
                </div>

                <div>
                  <label className="font-bold text-[#434655] block mb-1">Código Concesionario *</label>
                  <input
                    type="text"
                    required
                    value={concessionForm.concessionaireCode}
                    onChange={(e) => setConcessionForm({ ...concessionForm, concessionaireCode: e.target.value })}
                    className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#004ac6] focus:ring-1 focus:ring-[#004ac6]"
                  />
                </div>

                <div>
                  <label className="font-bold text-[#434655] block mb-1">Fecha del Título *</label>
                  <input
                    type="date"
                    required
                    value={concessionForm.titleDate}
                    onChange={(e) => setConcessionForm({ ...concessionForm, titleDate: e.target.value })}
                    className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-xs font-medium text-[#0b1c30] focus:ring-1 focus:ring-[#004ac6]"
                  />
                </div>

                <div>
                  <label className="font-bold text-[#434655] block mb-1">Fecha Última Póliza *</label>
                  <input
                    type="date"
                    required
                    value={concessionForm.lastPolicyDate}
                    onChange={(e) => setConcessionForm({ ...concessionForm, lastPolicyDate: e.target.value })}
                    className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-xs font-medium text-[#0b1c30] focus:ring-1 focus:ring-[#004ac6]"
                  />
                </div>

                <div>
                  <label className="font-bold text-[#434655] block mb-1">Recordatorio de Vencimiento (Plazo en días) *</label>
                  <select
                    value={concessionForm.reminderDays}
                    onChange={(e) => setConcessionForm({ ...concessionForm, reminderDays: Number(e.target.value) })}
                    className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-xs font-semibold text-[#0b1c30] focus:ring-1 focus:ring-[#004ac6]"
                  >
                    <option value={15}>15 días antes</option>
                    <option value={30}>30 días antes (Recomendado)</option>
                    <option value={45}>45 días antes</option>
                    <option value={60}>60 días antes</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="font-bold text-[#434655] block mb-1">Página Web Institucional *</label>
                  <input
                    type="url"
                    required
                    value={concessionForm.websiteUrl}
                    onChange={(e) => setConcessionForm({ ...concessionForm, websiteUrl: e.target.value })}
                    className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-xs text-[#004ac6] font-medium focus:ring-1 focus:ring-[#004ac6]"
                  />
                </div>
              </div>

              {/* Campos Dinámicos Adicionales (PDF: "debe permitir poder agregar más opciones en caso de requerir") */}
              {concessionForm.additionalFields && concessionForm.additionalFields.length > 0 && (
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Atributos Adicionales</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {concessionForm.additionalFields.map((field) => (
                      <div key={field.id} className="flex items-center gap-2">
                        <div className="flex-1">
                          <label className="text-[10px] text-[#737686] font-bold block mb-0.5">{field.label}</label>
                          <input
                            type="text"
                            value={field.value}
                            onChange={(e) => {
                              const updated = (concessionForm.additionalFields || []).map((f) =>
                                f.id === field.id ? { ...f, value: e.target.value } : f
                              );
                              setConcessionForm({ ...concessionForm, additionalFields: updated });
                            }}
                            className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-xs font-medium text-[#0b1c30] focus:ring-1 focus:ring-[#004ac6]"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomField(field.id)}
                          className="mt-4 p-2 text-slate-400 hover:text-rose-600 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 flex justify-end border-t border-slate-100">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                >
                  Guardar Parámetros de Concesión
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PESTAÑA 2: SIETEL (ARCHIVOS PERIODICOS) (PDF Página 3) */}
      {activeTab === "sietel" && (
        <div className="space-y-5">
          {/* Submenú de Sistemas SIETEL */}
          <div className="flex items-center gap-2 border-b border-[#e2e8f0] pb-2 overflow-x-auto">
            <button
              onClick={() => setSietelSubTab("sietel_lopam")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                sietelSubTab === "sietel_lopam"
                  ? "bg-[#004ac6] text-white shadow-2xs"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              LOPAM (Semanal)
            </button>
            <button
              onClick={() => setSietelSubTab("sietel_tarifas")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                sietelSubTab === "sietel_tarifas"
                  ? "bg-[#004ac6] text-white shadow-2xs"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              Tarifas (Mensual)
            </button>
            <button
              onClick={() => setSietelSubTab("sietel_usuarios")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                sietelSubTab === "sietel_usuarios"
                  ? "bg-[#004ac6] text-white shadow-2xs"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              Usuarios (Mensual)
            </button>
            <button
              onClick={() => setSietelSubTab("sietel_calidad")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                sietelSubTab === "sietel_calidad"
                  ? "bg-[#004ac6] text-white shadow-2xs"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              Calidad QoS (Mensual)
            </button>
            <button
              onClick={() => setSietelSubTab("sietel_encuestas")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                sietelSubTab === "sietel_encuestas"
                  ? "bg-[#004ac6] text-white shadow-2xs"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              Encuestas (Semestral)
            </button>
            <button
              onClick={() => setSietelSubTab("sietel_capacidades")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                sietelSubTab === "sietel_capacidades"
                  ? "bg-[#004ac6] text-white shadow-2xs"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              Capacidades (Mensual)
            </button>
          </div>

          {/* Banner de frecuencia específica */}
          {sietelSubTab === "sietel_lopam" && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-[#004ac6] flex items-center justify-between">
              <span>
                <strong>Periodicidad Semanal:</strong> Según disposición técnica de ARCOTEL, en LOPAM solo basta con conservar el último archivo cargado.
              </span>
              <button
                onClick={() => handleOpenUploadModal("sietel_lopam")}
                className="px-3 py-1 bg-[#004ac6] text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Actualizar LOPAM
              </button>
            </div>
          )}

          {/* Tabla de Archivos para la subsección activa */}
          <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-lumina-card overflow-hidden">
            <div className="p-4 px-6 border-b border-[#e2e8f0] bg-[#f8f9ff] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-[#0b1c30] text-xs uppercase tracking-wider">
                  Archivos Registrados: {sietelSubTab.replace("sietel_", "").toUpperCase()}
                </h3>
              </div>
              <button
                onClick={() => handleOpenUploadModal(sietelSubTab)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Cargar Archivo</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[750px]">
                <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-[10px] uppercase tracking-wider border-b border-[#e2e8f0]">
                  <tr>
                    <th className="py-3 px-5">Periodo</th>
                    <th className="py-3 px-5">Nombre del Archivo</th>
                    <th className="py-3 px-5">Tamaño</th>
                    <th className="py-3 px-5">Fecha de Carga</th>
                    <th className="py-3 px-5">Responsable</th>
                    <th className="py-3 px-5 text-center">Estado</th>
                    <th className="py-3 px-5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9] text-[#0b1c30]">
                  {getSubsystemFiles(sietelSubTab).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-xs text-slate-500 italic">
                        No hay archivos registrados en esta subsección.
                      </td>
                    </tr>
                  ) : (
                    getSubsystemFiles(sietelSubTab).map((file) => (
                      <tr key={file.id} className="hover:bg-[#f8f9ff] transition-colors">
                        <td className="py-3.5 px-5 font-bold text-[#0b1c30]">{file.period}</td>
                        <td className="py-3.5 px-5">
                          <div className="font-mono font-bold text-[#004ac6] flex items-center gap-1.5">
                            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                            <span>{file.fileName}</span>
                          </div>
                          {file.notes && <div className="text-[10px] text-slate-400 mt-0.5">{file.notes}</div>}
                        </td>
                        <td className="py-3.5 px-5 font-mono text-slate-500">{file.fileSize}</td>
                        <td className="py-3.5 px-5 text-slate-600">{file.uploadedAt.split("T")[0]}</td>
                        <td className="py-3.5 px-5 text-slate-700">{file.uploadedBy}</td>
                        <td className="py-3.5 px-5 text-center">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              file.status === "vigente"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-blue-50 text-[#004ac6] border border-blue-200"
                            }`}
                          >
                            {file.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => showSuccess("Descarga Simulada", `Descargando ${file.fileName}...`)}
                              className="p-1.5 text-slate-500 hover:text-[#004ac6] hover:bg-[#eff4ff] rounded-lg transition-colors cursor-pointer"
                              title="Descargar archivo"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteFile(file.id, file.fileName)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Eliminar archivo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA 3: FODETEL (TRIMESTRAL) (PDF Página 3) */}
      {activeTab === "fodetel" && (
        <div className="space-y-4">
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-xs text-[#0b1c30]">
                Fondo de Desarrollo de Telecomunicaciones (FODETEL)
              </h3>
              <p className="text-[11px] text-[#737686]">
                Carga de documentación trimestral (archivos Excel y PDF con comprobantes de depósito bancario del 1% del ingreso facturado).
              </p>
            </div>
            <button
              onClick={() => handleOpenUploadModal("fodetel")}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Cargar Archivo FODETEL</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-lumina-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-[10px] uppercase tracking-wider border-b border-[#e2e8f0]">
                  <tr>
                    <th className="py-3 px-5">Trimestre</th>
                    <th className="py-3 px-5">Archivo</th>
                    <th className="py-3 px-5">Tipo</th>
                    <th className="py-3 px-5">Fecha Carga</th>
                    <th className="py-3 px-5">Responsable</th>
                    <th className="py-3 px-5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9] text-[#0b1c30]">
                  {getSubsystemFiles("fodetel").length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-xs text-slate-500 italic">
                        No hay declaraciones de FODETEL registradas aún.
                      </td>
                    </tr>
                  ) : (
                    getSubsystemFiles("fodetel").map((f) => (
                      <tr key={f.id} className="hover:bg-[#f8f9ff] transition-colors">
                        <td className="py-3.5 px-5 font-bold text-[#0b1c30]">{f.period}</td>
                        <td className="py-3.5 px-5">
                          <div className="font-mono font-bold text-[#004ac6] flex items-center gap-1.5">
                            {f.fileType === "pdf" ? (
                              <FileCheck className="w-4 h-4 text-rose-600" />
                            ) : (
                              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                            )}
                            <span>{f.fileName}</span>
                            <span className="text-[10px] text-slate-400">({f.fileSize})</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-5 uppercase font-bold text-slate-600 text-[10px]">{f.fileType}</td>
                        <td className="py-3.5 px-5 text-slate-600">{f.uploadedAt.split("T")[0]}</td>
                        <td className="py-3.5 px-5 text-slate-700">{f.uploadedBy}</td>
                        <td className="py-3.5 px-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => showSuccess("Descarga Simulada", `Descargando ${f.fileName}...`)}
                              className="p-1.5 text-slate-500 hover:text-[#004ac6] hover:bg-[#eff4ff] rounded-lg transition-colors cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteFile(f.id, f.fileName)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA 4: PLAN DE CONTINGENCIA (ANUAL) (PDF Página 4) */}
      {activeTab === "contingencia" && (
        <div className="space-y-4">
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-xs text-[#0b1c30]">
                Plan de Contingencia & Continuidad Operativa (Anual)
              </h3>
              <p className="text-[11px] text-[#737686]">
                Carga de planes anuales en formatos Word (.docx) y PDF con protocolos ante fallas de enlace y desastres.
              </p>
            </div>
            <button
              onClick={() => handleOpenUploadModal("contingencia")}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Cargar Plan de Contingencia</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-lumina-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-[10px] uppercase tracking-wider border-b border-[#e2e8f0]">
                  <tr>
                    <th className="py-3 px-5">Vigencia</th>
                    <th className="py-3 px-5">Documento</th>
                    <th className="py-3 px-5">Formato</th>
                    <th className="py-3 px-5">Fecha Carga</th>
                    <th className="py-3 px-5">Responsable Técnico</th>
                    <th className="py-3 px-5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9] text-[#0b1c30]">
                  {getSubsystemFiles("contingencia").length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-xs text-slate-500 italic">
                        No hay planes de contingencia cargados.
                      </td>
                    </tr>
                  ) : (
                    getSubsystemFiles("contingencia").map((f) => (
                      <tr key={f.id} className="hover:bg-[#f8f9ff] transition-colors">
                        <td className="py-3.5 px-5 font-bold text-[#0b1c30]">{f.period}</td>
                        <td className="py-3.5 px-5">
                          <div className="font-mono font-bold text-[#004ac6] flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-blue-600" />
                            <span>{f.fileName}</span>
                            <span className="text-[10px] text-slate-400">({f.fileSize})</span>
                          </div>
                          {f.notes && <div className="text-[10px] text-slate-400 mt-0.5">{f.notes}</div>}
                        </td>
                        <td className="py-3.5 px-5 uppercase font-bold text-slate-600 text-[10px]">{f.fileType}</td>
                        <td className="py-3.5 px-5 text-slate-600">{f.uploadedAt.split("T")[0]}</td>
                        <td className="py-3.5 px-5 text-slate-700">{f.uploadedBy}</td>
                        <td className="py-3.5 px-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => showSuccess("Descarga Simulada", `Descargando ${f.fileName}...`)}
                              className="p-1.5 text-slate-500 hover:text-[#004ac6] hover:bg-[#eff4ff] rounded-lg transition-colors cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteFile(f.id, f.fileName)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA 5: SISTEMA BDH (EXCEL) (PDF Página 4) */}
      {activeTab === "bdh" && (
        <div className="space-y-4">
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-xs text-[#0b1c30]">
                Sistema BDH (Bono de Desarrollo Humano - Subsidio Tarifa Social)
              </h3>
              <p className="text-[11px] text-[#737686]">
                Carga y cruce en formato Excel (.xlsx) de los abonados beneficiarios de tarifas preferenciales subsidiadas ante ARCOTEL.
              </p>
            </div>
            <button
              onClick={() => handleOpenUploadModal("bdh")}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Cargar Base BDH (.xlsx)</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-lumina-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-[10px] uppercase tracking-wider border-b border-[#e2e8f0]">
                  <tr>
                    <th className="py-3 px-5">Periodo / Corte</th>
                    <th className="py-3 px-5">Archivo Excel</th>
                    <th className="py-3 px-5">Tamaño</th>
                    <th className="py-3 px-5">Fecha Carga</th>
                    <th className="py-3 px-5">Responsable</th>
                    <th className="py-3 px-5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9] text-[#0b1c30]">
                  {getSubsystemFiles("bdh").length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-xs text-slate-500 italic">
                        No se han cargado nóminas del BDH aún.
                      </td>
                    </tr>
                  ) : (
                    getSubsystemFiles("bdh").map((f) => (
                      <tr key={f.id} className="hover:bg-[#f8f9ff] transition-colors">
                        <td className="py-3.5 px-5 font-bold text-[#0b1c30]">{f.period}</td>
                        <td className="py-3.5 px-5">
                          <div className="font-mono font-bold text-[#004ac6] flex items-center gap-1.5">
                            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                            <span>{f.fileName}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-5 font-mono text-slate-500">{f.fileSize}</td>
                        <td className="py-3.5 px-5 text-slate-600">{f.uploadedAt.split("T")[0]}</td>
                        <td className="py-3.5 px-5 text-slate-700">{f.uploadedBy}</td>
                        <td className="py-3.5 px-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => showSuccess("Descarga Simulada", `Descargando ${f.fileName}...`)}
                              className="p-1.5 text-slate-500 hover:text-[#004ac6] hover:bg-[#eff4ff] rounded-lg transition-colors cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteFile(f.id, f.fileName)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA 6: REPORTERIA & TRANSFORMADOR ARCOTEL (PDF Página 4) */}
      {activeTab === "transformador" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-lumina-card p-6 space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-bold text-[#0b1c30] text-sm flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-[#004ac6]" />
                Transformador de Formatos & Validador para ARCOTEL / SIETEL
              </h3>
              <p className="text-[11px] text-[#737686] mt-0.5">
                Convierte automáticamente la base de clientes, contratos y nodos del sistema en las plantillas y formatos oficiales que exige el portal ARCOTEL.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="font-bold text-[#434655] block mb-1">Tipo de Reporte a Generar *</label>
                <select
                  value={transformReportType}
                  onChange={(e) => setTransformReportType(e.target.value as any)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 font-semibold text-[#0b1c30] focus:ring-1 focus:ring-[#004ac6]"
                >
                  <option value="abonados_sietel">Matriz de Abonados Activos (SIETEL Oficial)</option>
                  <option value="tarifas">Matriz Tarifaria Homologada</option>
                  <option value="nodos_transito">Capacidades & Enlaces de Tránsito Multi-Carrier</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-[#434655] block mb-1">Periodo de Reporte *</label>
                <input
                  type="text"
                  value={transformPeriod}
                  onChange={(e) => setTransformPeriod(e.target.value)}
                  placeholder="Septiembre 2026"
                  className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 font-medium text-[#0b1c30] focus:ring-1 focus:ring-[#004ac6]"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleExportTransformedArcotel}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar Archivo Transformado</span>
                </button>
              </div>
            </div>

            {/* Previsualización del Esquema Oficial */}
            <div className="pt-3 border-t border-slate-100">
              <h4 className="font-bold text-slate-700 text-xs mb-2">Estructura Oficial del Archivo de Salida:</h4>
              <div className="bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-[11px] overflow-x-auto space-y-1">
                {transformReportType === "abonados_sietel" ? (
                  <>
                    <div className="text-sky-400 font-bold">
                      CODIGO_CONCESIONARIO,TIPO_DOCUMENTO,NUMERO_IDENTIFICACION,RAZON_SOCIAL,PROVINCIA,CANTON,PARROQUIA,PLAN_SERVICIO,VELOCIDAD_BAJADA_MBPS,VELOCIDAD_SUBIDA_MBPS,MODALIDAD,TECNOLOGIA,FECHA_CONTRATO,ESTADO_SERVICIO
                    </div>
                    {clients.slice(0, 2).map((c) => (
                      <div key={c.id} className="text-emerald-400">
                        "{arcotelConcession.concessionaireCode}","{c.identificationType}","{c.identificationNumber}","{c.businessName}","Pichincha","Quito","{c.sector || "Matriz"}","Internet Dedicado",500,500,"pospago","FIBRA OPTICA GPON","2024-01-15","ACTIVO"
                      </div>
                    ))}
                    <div className="text-slate-500 italic">... y {Math.max(0, clients.length - 2)} registros más listos para compilar.</div>
                  </>
                ) : transformReportType === "tarifas" ? (
                  <>
                    <div className="text-sky-400 font-bold">CODIGO_CONCESIONARIO,NOMBRE_PLAN,TARIFA_REGISTRADA_USD,MODALIDAD,TECNOLOGIA</div>
                    {plans.slice(0, 2).map((p) => (
                      <div key={p.id} className="text-emerald-400">
                        "{arcotelConcession.concessionaireCode}","{p.name}",{p.defaultPrice.toFixed(2)},"{p.billingType}","FIBRA OPTICA"
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                    <div className="text-sky-400 font-bold">CODIGO_CONCESIONARIO,NODO_POP,UBICACION,PROVEEDORES_TRANSITO,CAPACIDAD_TOTAL_MBPS</div>
                    {nodes.slice(0, 2).map((n) => (
                      <div key={n.id} className="text-emerald-400">
                        "{arcotelConcession.concessionaireCode}","{n.name}","{n.address}","{n.upstreamProvider}",{n.totalCapacityMbps}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA 7: POLIZAS DE FIEL CUMPLIMIENTO */}
      {activeTab === "polizas" && (
        <div className="space-y-4">
          <PoliciesList onOpenNewModal={() => setIsPolicyModalOpen(true)} />
          {isPolicyModalOpen && <PolicyModal isOpen={isPolicyModalOpen} onClose={() => setIsPolicyModalOpen(false)} />}
        </div>
      )}

      {/* MODAL PARA SUBIR ARCHIVOS REGULATORIOS */}
      {isFileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-lumina-dropdown border border-[#e2e8f0] overflow-hidden">
            <div className="p-4 px-5 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8f9ff]">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-[#004ac6]" />
                <h3 className="font-bold text-[#0b1c30] text-xs">
                  Cargar Archivo: {targetSubsystem.replace("_", " ").toUpperCase()}
                </h3>
              </div>
              <button
                onClick={() => setIsFileModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleFileUploadSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-bold text-[#434655] block mb-1">Destino Regulatorio *</label>
                <select
                  value={targetSubsystem}
                  onChange={(e) => setTargetSubsystem(e.target.value as ArcotelSubsystem)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 font-semibold text-[#0b1c30] focus:ring-1 focus:ring-[#004ac6]"
                >
                  <option value="sietel_lopam">SIETEL - LOPAM (Semanal)</option>
                  <option value="sietel_tarifas">SIETEL - Tarifas (Mensual)</option>
                  <option value="sietel_usuarios">SIETEL - Usuarios (Mensual)</option>
                  <option value="sietel_calidad">SIETEL - Calidad QoS (Mensual)</option>
                  <option value="sietel_encuestas">SIETEL - Encuestas (Semestral)</option>
                  <option value="sietel_capacidades">SIETEL - Capacidades (Mensual)</option>
                  <option value="fodetel">FODETEL (Trimestral)</option>
                  <option value="contingencia">Plan de Contingencia (Anual)</option>
                  <option value="bdh">Sistema BDH (Excel)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-[#434655] block mb-1">Periodo Correspondiente *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Semana 38 - 2026, Septiembre 2026, Trimestre III"
                  value={uploadPeriod}
                  onChange={(e) => setUploadPeriod(e.target.value)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 font-medium text-[#0b1c30] focus:ring-1 focus:ring-[#004ac6]"
                />
              </div>

              <div>
                <label className="font-bold text-[#434655] block mb-1">Seleccionar Archivo (.xlsx, .pdf, .docx, .csv) *</label>
                <input
                  type="file"
                  required
                  accept=".xlsx,.xls,.pdf,.docx,.doc,.csv"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setUploadFile(e.target.files[0]);
                    }
                  }}
                  className="w-full bg-slate-50 border border-dashed border-[#cbd5e1] rounded-xl p-3 text-xs text-[#434655] cursor-pointer file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#004ac6] file:text-white hover:file:bg-[#2563eb]"
                />
              </div>

              <div>
                <label className="font-bold text-[#434655] block mb-1">Observaciones / Notas</label>
                <input
                  type="text"
                  placeholder="Detalles sobre el envío o número de trámite..."
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 font-medium text-[#0b1c30] focus:ring-1 focus:ring-[#004ac6]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFileModalOpen(false)}
                  className="px-3.5 py-2 text-[#737686] hover:bg-slate-100 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{busy ? "Cargando..." : "Subir Archivo"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
