"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import {
  FileText,
  Download,
  CheckCircle2,
  FileSpreadsheet,
  Shield,
  Upload,
  Plus,
  Trash2,
  Edit2,
  X,
  FileCheck,
  Search,
  RefreshCw,
  FileUp,
  FileCode,
  Tag,
  Calendar,
  User,
} from "lucide-react";
import {
  generateAdhesionContractDocx,
  generateSaiInfraExcel,
  generateBillingBatchExcel,
  generateArcotelRenewalLetterDocx,
  triggerBrowserDownload,
} from "@/lib/doc-generator";

interface CustomTemplate {
  id: string;
  name: string;
  description: string;
  category: "Contratos" | "Técnico / Red" | "Comercial / Ventas" | "Legal / ARCOTEL" | "Finanzas";
  fileName: string;
  fileSize: string;
  fileType: string;
  fileData?: string;
  uploadedAt: string;
  uploadedBy: string;
  version?: number;
  updatedAt?: string;
  updatedBy?: string;
}

const STORAGE_TEMPLATES_KEY = "inntel_custom_templates_v1";

const INITIAL_CUSTOM_TEMPLATES: CustomTemplate[] = [
  {
    id: "tmpl-1",
    name: "Acta de Entrega - Recepción de Equipos ONT",
    description: "Formulario de firma de conformidad de entrega de módem óptico y credenciales WiFi.",
    category: "Técnico / Red",
    fileName: "Acta_Entrega_Equipos_ONT_2026.docx",
    fileSize: "84 KB",
    fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    uploadedAt: "2026-02-15",
    uploadedBy: "Ing. Diego Cárdenas",
    version: 1,
  },
  {
    id: "tmpl-2",
    name: "Formulario de Solicitud de Traspaso de Línea",
    description: "Documento de cesión de derechos contractuales y traspaso de acometida.",
    category: "Contratos",
    fileName: "Solicitud_Traspaso_Cesion_Derechos.pdf",
    fileSize: "128 KB",
    fileType: "application/pdf",
    uploadedAt: "2026-03-01",
    uploadedBy: "Lic. Elena Andrade",
    version: 1,
  },
  {
    id: "tmpl-3",
    name: "Checklist de Mantenimiento Preventivo OLT / FTTx",
    description: "Guía de campo para calibración de puertos PON y limpieza de conectores SC/APC.",
    category: "Técnico / Red",
    fileName: "Checklist_NOC_Preventivo_OLT.xlsx",
    fileSize: "62 KB",
    fileType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    uploadedAt: "2026-03-10",
    uploadedBy: "Tec. Roberto Valarezo",
    version: 1,
  },
];

export function TemplateGenerator() {
  const { clients, clientServices, nodes, policies, monthlyCharges, currentUser } = useApp();
  const { showSuccess, showError, showWarning } = useToast();

  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("todas");

  // Create Modal state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<CustomTemplate["category"]>("Contratos");
  const [newDescription, setNewDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Edit / Update Modal state
  const [editingTemplate, setEditingTemplate] = useState<CustomTemplate | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState<CustomTemplate["category"]>("Contratos");
  const [editDescription, setEditDescription] = useState("");
  const [editReplacementFile, setEditReplacementFile] = useState<File | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_TEMPLATES_KEY);
      if (stored) {
        setCustomTemplates(JSON.parse(stored));
      } else {
        setCustomTemplates(INITIAL_CUSTOM_TEMPLATES);
        localStorage.setItem(STORAGE_TEMPLATES_KEY, JSON.stringify(INITIAL_CUSTOM_TEMPLATES));
      }
    } catch {
      setCustomTemplates(INITIAL_CUSTOM_TEMPLATES);
    }
  }, []);

  const saveCustomTemplates = (updated: CustomTemplate[]) => {
    setCustomTemplates(updated);
    try {
      localStorage.setItem(STORAGE_TEMPLATES_KEY, JSON.stringify(updated));
    } catch (e) {
      try {
        const light = updated.map((t) => ({ ...t, fileData: undefined }));
        localStorage.setItem(STORAGE_TEMPLATES_KEY, JSON.stringify(light));
      } catch (err) {
        console.warn("Storage quota exceeded", err);
      }
    }
  };

  const handleDownloadContract = async () => {
    if (clients.length === 0) {
      showWarning("Sin Clientes", "No hay clientes registrados para generar el contrato.");
      return;
    }
    try {
      const client = clients[0];
      const srv = clientServices.find((s) => s.clientId === client.id);
      const blob = await generateAdhesionContractDocx(client, srv);
      triggerBrowserDownload(blob, `Contrato_Adhesion_ARCOTEL_${client.identificationNumber}.docx`);
      showSuccess("Contrato Generado", `Modelo homologado generado para ${client.businessName}.`);
    } catch (e) {
      showError("Error al Generar", "No se pudo crear el documento Word.");
    }
  };

  const handleDownloadSaiExcel = async () => {
    if (nodes.length === 0) {
      showWarning("Sin Nodos", "No hay infraestructura de red para exportar.");
      return;
    }
    try {
      const blob = await generateSaiInfraExcel(nodes);
      triggerBrowserDownload(blob, `Registro_Infraestructura_SAI_ARCOTEL_2026.xlsx`);
      showSuccess("Reporte SAI Generado", `Se exportó el inventario técnico de ${nodes.length} POPs.`);
    } catch (e) {
      showError("Error al Generar", "No se pudo generar el archivo Excel.");
    }
  };

  const handleDownloadBillingBatch = async () => {
    if (monthlyCharges.length === 0) {
      showWarning("Sin Comprobantes", "Emite el lote del Día 1 en el módulo de Finanzas primero.");
      return;
    }
    try {
      const blob = await generateBillingBatchExcel(monthlyCharges);
      triggerBrowserDownload(blob, `Lote_Cobranzas_PreFacturas_INNTEL_CORP.xlsx`);
      showSuccess("Lote Generado", `Archivo Excel listo con las órdenes de pedido y pre-facturas emitidas.`);
    } catch (e) {
      showError("Error al Generar", "No se pudo generar el lote de cobros.");
    }
  };

  const handleDownloadRenewalLetter = async () => {
    if (policies.length === 0) {
      showWarning("Sin Pólizas", "No hay pólizas registradas para solicitar renovación.");
      return;
    }
    try {
      const blob = await generateArcotelRenewalLetterDocx(policies[0]);
      triggerBrowserDownload(blob, `Oficio_Renovacion_ARCOTEL_${policies[0].policyNumber}.docx`);
      showSuccess("Oficio QUIPUX Generado", `Borrador oficial para ARCOTEL listo en Word.`);
    } catch (e) {
      showError("Error al Generar", "No se pudo generar el oficio formal.");
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      showError("Nombre Requerido", "Ingresa el nombre descriptivo de la plantilla.");
      return;
    }
    if (!selectedFile) {
      showError("Archivo Requerido", "Selecciona un archivo desde tu equipo.");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("folder", "templates");

      const res = await fetch("/api/blob/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Error en el servidor al subir el archivo.");
      }

      const data = await res.json();
      const sizeKb = Math.round(selectedFile.size / 1024);

      const newTmpl: CustomTemplate = {
        id: "tmpl-" + Date.now(),
        name: newName.trim(),
        description: newDescription.trim() || "Plantilla institucional cargada por el personal.",
        category: newCategory,
        fileName: selectedFile.name,
        fileSize: sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`,
        fileType: selectedFile.type || "application/octet-stream",
        fileData: data.url || data.downloadUrl,
        uploadedAt: new Date().toISOString().split("T")[0],
        uploadedBy: currentUser.displayName || "Administrador",
        version: 1,
      };

      saveCustomTemplates([newTmpl, ...customTemplates]);
      showSuccess("Plantilla Creada", `La plantilla "${newTmpl.name}" ha sido agregada con éxito.`);
      setIsUploadModalOpen(false);
      setNewName("");
      setNewDescription("");
      setSelectedFile(null);
    } catch (err: any) {
      showError("Error al Subir", err?.message || "No se pudo cargar el archivo.");
    } finally {
      setIsUploading(false);
    }
  };

  const openEditModal = (tmpl: CustomTemplate) => {
    setEditingTemplate(tmpl);
    setEditName(tmpl.name);
    setEditCategory(tmpl.category);
    setEditDescription(tmpl.description);
    setEditReplacementFile(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate) return;
    if (!editName.trim()) {
      showError("Nombre Requerido", "Ingresa el nombre de la plantilla.");
      return;
    }

    setIsUpdating(true);
    try {
      let updatedFileName = editingTemplate.fileName;
      let updatedFileSize = editingTemplate.fileSize;
      let updatedFileType = editingTemplate.fileType;
      let updatedFileData = editingTemplate.fileData;
      let didReplaceFile = false;

      // Si el usuario subió una actualización del archivo (Word, Excel, etc.)
      if (editReplacementFile) {
        const formData = new FormData();
        formData.append("file", editReplacementFile);
        formData.append("folder", "templates");

        const res = await fetch("/api/blob/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          throw new Error("Error en el servidor al subir la actualización del archivo.");
        }

        const data = await res.json();
        const sizeKb = Math.round(editReplacementFile.size / 1024);

        updatedFileName = editReplacementFile.name;
        updatedFileSize = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;
        updatedFileType = editReplacementFile.type || "application/octet-stream";
        updatedFileData = data.url || data.downloadUrl;
        didReplaceFile = true;

        // Limpiar archivo anterior de blob si era remoto
        if (
          editingTemplate.fileData?.startsWith("https://") &&
          editingTemplate.fileData.includes(".blob.vercel-storage.com")
        ) {
          fetch(`/api/blob/upload?url=${encodeURIComponent(editingTemplate.fileData)}`, {
            method: "DELETE",
          }).catch(() => null);
        }
      }

      const todayStr = new Date().toISOString().split("T")[0];
      const updatedList = customTemplates.map((t) => {
        if (t.id === editingTemplate.id) {
          return {
            ...t,
            name: editName.trim(),
            category: editCategory,
            description: editDescription.trim(),
            fileName: updatedFileName,
            fileSize: updatedFileSize,
            fileType: updatedFileType,
            fileData: updatedFileData,
            updatedAt: todayStr,
            updatedBy: currentUser.displayName || "Administrador",
            version: (t.version || 1) + (didReplaceFile ? 1 : 0),
          };
        }
        return t;
      });

      saveCustomTemplates(updatedList);
      showSuccess(
        "Plantilla Actualizada",
        didReplaceFile
          ? `Se actualizó el formato de la plantilla con "${updatedFileName}".`
          : `Los datos de "${editName}" fueron actualizados correctamente.`
      );
      setEditingTemplate(null);
      setEditReplacementFile(null);
    } catch (err: any) {
      showError("Error al Actualizar", err?.message || "No se pudo actualizar la plantilla.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDownloadCustom = (tmpl: CustomTemplate) => {
    if (tmpl.fileData) {
      if (tmpl.fileData.startsWith("http")) {
        const link = document.createElement("a");
        link.href = tmpl.fileData;
        link.download = tmpl.fileName;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const link = document.createElement("a");
        link.href = tmpl.fileData;
        link.download = tmpl.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      showSuccess("Descargando", `Se ha iniciado la descarga de ${tmpl.fileName}.`);
    } else {
      const blob = new Blob([`Contenido de plantilla: ${tmpl.name}\nINNTEL CORP S.A.`], { type: "text/plain" });
      triggerBrowserDownload(blob, tmpl.fileName);
      showSuccess("Descargando", `Descargando archivo institucional ${tmpl.fileName}.`);
    }
  };

  const handleDeleteCustom = async (id: string, name: string) => {
    const tmplToDelete = customTemplates.find((t) => t.id === id);
    if (tmplToDelete?.fileData?.startsWith("https://")) {
      fetch(`/api/blob/upload?url=${encodeURIComponent(tmplToDelete.fileData)}`, {
        method: "DELETE",
      }).catch(() => null);
    }
    const updated = customTemplates.filter((t) => t.id !== id);
    saveCustomTemplates(updated);
    showSuccess("Archivo Eliminado", `Se ha removido "${name}" del repositorio.`);
  };

  const SYSTEM_TEMPLATES = useMemo(
    () => [
      {
        id: "sys-contract",
        title: "Contrato de Adhesión para Servicio de Internet (SAI)",
        desc: "Modelo formal homologado por ARCOTEL con cláusulas de SLA, comparecientes y tarifas vigentes.",
        format: "Word (.docx)",
        module: "Clientes & Contratos",
        icon: FileText,
        badgeBg: "bg-blue-50 text-[#004ac6] border-blue-200",
        action: handleDownloadContract,
        buttonText: "Generar Word",
      },
      {
        id: "sys-infra",
        title: "Registro de Infraestructura de Red SAI",
        desc: "Formulario técnico de POPs, coordenadas, capacidades y proveedores para reporte ARCOTEL.",
        format: "Excel (.xlsx)",
        module: "Redes & POPs",
        icon: FileSpreadsheet,
        badgeBg: "bg-emerald-50 text-emerald-700 border-emerald-200",
        action: handleDownloadSaiExcel,
        buttonText: "Generar Excel",
      },
      {
        id: "sys-billing",
        title: "Lote de Órdenes de Pedido & Pre-Facturas Internas",
        desc: "Estructura estándar de cotizaciones, tarifas mensuales y seguimiento de cobros por cliente.",
        format: "Excel (.xlsx)",
        module: "Finanzas & Facturación",
        icon: FileSpreadsheet,
        badgeBg: "bg-emerald-50 text-emerald-700 border-emerald-200",
        action: handleDownloadBillingBatch,
        buttonText: "Generar Excel",
      },
      {
        id: "sys-renewal",
        title: "Oficio Formal de Renovación de Póliza ARCOTEL",
        desc: "Documento oficial dirigido a la Dirección Ejecutiva de ARCOTEL para ingreso en QUIPUX.",
        format: "Word (.docx)",
        module: "Legal & Regulatorio",
        icon: Shield,
        badgeBg: "bg-purple-50 text-purple-700 border-purple-200",
        action: handleDownloadRenewalLetter,
        buttonText: "Generar Word",
      },
    ],
    [clients, clientServices, nodes, policies, monthlyCharges]
  );

  // Filtered lists
  const filteredSystemTemplates = useMemo(() => {
    return SYSTEM_TEMPLATES.filter((tmpl) => {
      const matchSearch =
        tmpl.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tmpl.desc.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tmpl.module.toLowerCase().includes(searchTerm.toLowerCase());
      return matchSearch;
    });
  }, [SYSTEM_TEMPLATES, searchTerm]);

  const filteredCustomTemplates = useMemo(() => {
    return customTemplates.filter((tmpl) => {
      const matchSearch =
        tmpl.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tmpl.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tmpl.fileName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCategory = selectedCategory === "todas" || tmpl.category === selectedCategory;
      return matchSearch && matchCategory;
    });
  }, [customTemplates, searchTerm, selectedCategory]);

  const getFileBadge = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (ext === "docx" || ext === "doc") {
      return {
        label: "Word (.docx)",
        color: "bg-blue-50 text-[#004ac6] border-blue-200",
        icon: FileText,
      };
    }
    if (ext === "xlsx" || ext === "xls" || ext === "csv") {
      return {
        label: "Excel (.xlsx)",
        color: "bg-emerald-50 text-emerald-700 border-emerald-200",
        icon: FileSpreadsheet,
      };
    }
    if (ext === "pdf") {
      return {
        label: "PDF",
        color: "bg-rose-50 text-rose-700 border-rose-200",
        icon: FileCode,
      };
    }
    return {
      label: ext ? ext.toUpperCase() : "Documento",
      color: "bg-slate-100 text-slate-700 border-slate-200",
      icon: FileText,
    };
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-150">
      {/* Top Filter and Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search Input */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-[#737686] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar plantilla o documento..."
              className="w-full pl-9 pr-3 py-2 bg-[#f8f9ff] border border-[#e2e8f0] rounded-xl text-xs text-[#0b1c30] placeholder-[#737686] focus:outline-hidden focus:border-[#004ac6] transition-colors"
            />
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-[#f8f9ff] border border-[#e2e8f0] rounded-xl text-xs font-semibold text-[#434655] focus:outline-hidden focus:border-[#004ac6] cursor-pointer"
          >
            <option value="todas">Todas las Categorías</option>
            <option value="Contratos">Contratos</option>
            <option value="Técnico / Red">Técnico / Red</option>
            <option value="Comercial / Ventas">Comercial / Ventas</option>
            <option value="Legal / ARCOTEL">Legal / ARCOTEL</option>
            <option value="Finanzas">Finanzas</option>
          </select>

          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-[#434655]">
            <span>Total:</span>
            <span className="text-[#004ac6]">{SYSTEM_TEMPLATES.length + customTemplates.length} plantillas</span>
          </div>
        </div>

        {/* Upload / New Template Button */}
        <button
          onClick={() => setIsUploadModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer shrink-0"
        >
          <Upload className="w-4 h-4" />
          <span>Subir Archivo / Plantilla</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* TABLA 1: PLANTILLAS OFICIALES                             */}
      {/* ========================================================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div>
            <h2 className="text-sm font-bold text-[#0b1c30]">
              Plantillas del Sistema
            </h2>
            <p className="text-xs text-[#737686]">
              Documentos generados automáticamente con datos del sistema
            </p>
          </div>
          <span className="text-xs font-bold text-[#737686] bg-white px-2.5 py-1 rounded-lg border border-[#e2e8f0]">
            {filteredSystemTemplates.length} activas
          </span>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-[#e2e8f0] bg-white shadow-2xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-[11px] uppercase tracking-wider border-b border-[#e2e8f0]">
              <tr>
                <th className="py-3 px-4">Plantilla / Documento</th>
                <th className="py-3 px-4">Formato</th>
                <th className="py-3 px-4">Módulo de Origen</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9] font-medium text-[#434655]">
              {filteredSystemTemplates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[#737686] italic">
                    No se encontraron plantillas dinámicas con el filtro especificado.
                  </td>
                </tr>
              ) : (
                filteredSystemTemplates.map((tmpl) => {
                  const Icon = tmpl.icon;
                  return (
                    <tr key={tmpl.id} className="hover:bg-[#f8f9ff] transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2.5 rounded-xl border shrink-0 ${tmpl.badgeBg}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-bold text-[#0b1c30] text-xs">{tmpl.title}</p>
                            <span className="text-[11px] text-[#737686] block mt-0.5 max-w-xl leading-relaxed">
                              {tmpl.desc}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${tmpl.badgeBg}`}>
                          {tmpl.format}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                          {tmpl.module}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Listo para Generación
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={tmpl.action}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{tmpl.buttonText}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TABLA 2: PLANTILLAS INSTITUCIONALES                       */}
      {/* ========================================================= */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between px-1">
          <div>
            <h2 className="text-sm font-bold text-[#0b1c30] flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-[#004ac6]" />
              Plantillas Institucionales
            </h2>
            <p className="text-xs text-[#737686]">
              Archivos descargables y editables (Word, Excel y PDF)
            </p>
          </div>
          <span className="text-xs font-bold text-[#737686] bg-white px-2.5 py-1 rounded-lg border border-[#e2e8f0]">
            {filteredCustomTemplates.length} documentos
          </span>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-[#e2e8f0] bg-white shadow-2xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-[11px] uppercase tracking-wider border-b border-[#e2e8f0]">
              <tr>
                <th className="py-3 px-4">Documento / Título</th>
                <th className="py-3 px-4">Categoría</th>
                <th className="py-3 px-4">Archivo & Formato</th>
                <th className="py-3 px-4">Tamaño</th>
                <th className="py-3 px-4">Última Actualización</th>
                <th className="py-3 px-4">Responsable</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9] font-medium text-[#434655]">
              {filteredCustomTemplates.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-[#737686] italic">
                    {customTemplates.length === 0
                      ? 'No hay plantillas o archivos subidos aún. Presiona "Subir Archivo / Plantilla".'
                      : "No se encontraron plantillas con los filtros aplicados."}
                  </td>
                </tr>
              ) : (
                filteredCustomTemplates.map((item) => {
                  const badge = getFileBadge(item.fileName);
                  const Icon = badge.icon;
                  const currentVer = item.version || 1;

                  return (
                    <tr key={item.id} className="hover:bg-[#f8f9ff] transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-[#0b1c30] text-xs">{item.name}</p>
                          {currentVer > 1 && (
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black bg-blue-100 text-[#004ac6] border border-blue-200">
                              v{currentVer}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-[#737686] block mt-0.5 max-w-sm line-clamp-1">
                          {item.description}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase bg-[#eff4ff] text-[#004ac6] border border-[#dce9ff]">
                          {item.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg border shrink-0 ${badge.color}`}>
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <span className="font-mono text-[11px] text-[#0b1c30] truncate max-w-[200px]" title={item.fileName}>
                            {item.fileName}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[#737686] whitespace-nowrap">{item.fileSize}</td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-[#737686] whitespace-nowrap">
                        {item.updatedAt ? (
                          <span title={`Actualizado el ${item.updatedAt}`}>
                            {item.updatedAt} <span className="text-[9px] text-[#004ac6] font-bold">(act)</span>
                          </span>
                        ) : (
                          item.uploadedAt
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-[#434655] whitespace-nowrap truncate max-w-[140px]">
                        {item.updatedBy || item.uploadedBy}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                            title="Editar plantilla y actualizar archivo"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-[#004ac6]" />
                            <span>Editar</span>
                          </button>
                          <button
                            onClick={() => handleDownloadCustom(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-[#004ac6] bg-[#eff4ff] hover:bg-[#dce9ff] transition-colors cursor-pointer"
                            title="Descargar archivo"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Descargar</span>
                          </button>
                          <button
                            onClick={() => handleDeleteCustom(item.id, item.name)}
                            className="p-1.5 text-[#737686] hover:text-[#ef4444] hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                            title="Eliminar plantilla"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: SUBIR NUEVA PLANTILLA                            */}
      {/* ========================================================= */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-[#e2e8f0] overflow-hidden">
            <div className="p-4 px-6 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8f9ff]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#eff4ff] text-[#004ac6]">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-[#0b1c30] text-sm">Nueva Plantilla</h3>
                  <p className="text-[11px] text-[#737686]">Sube un archivo Word, Excel o PDF al catálogo</p>
                </div>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="p-1 rounded-lg text-[#737686] hover:text-[#0b1c30] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleFileUpload} className="p-6 space-y-4 text-xs">
              <div>
                <label className="font-bold text-[#434655] block mb-1">Nombre / Título de la Plantilla *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Acta de Entrega ONT / Formato de Cesión de Derechos"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 font-semibold text-[#0b1c30] focus:border-[#004ac6] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-bold text-[#434655] block mb-1">Categoría Institucional</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 font-semibold text-[#0b1c30] focus:border-[#004ac6] focus:outline-hidden cursor-pointer"
                >
                  <option value="Contratos">Contratos</option>
                  <option value="Técnico / Red">Técnico / Red</option>
                  <option value="Comercial / Ventas">Comercial / Ventas</option>
                  <option value="Legal / ARCOTEL">Legal / ARCOTEL</option>
                  <option value="Finanzas">Finanzas</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-[#434655] block mb-1">Descripción / Propósito</label>
                <textarea
                  rows={2}
                  placeholder="Explica brevemente cuándo o quién debe utilizar este documento..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-[#0b1c30] focus:border-[#004ac6] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-bold text-[#434655] block mb-1">Seleccionar Archivo (Word, Excel, PDF) *</label>
                <input
                  type="file"
                  required
                  accept=".docx,.doc,.xlsx,.xls,.pdf,.csv"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-[#434655] file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#eff4ff] file:text-[#004ac6] hover:file:bg-[#dce9ff] cursor-pointer"
                />
                {selectedFile && (
                  <p className="text-[11px] text-[#059669] font-medium mt-1">
                    ✓ Archivo seleccionado: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-[#e2e8f0]">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 text-[#737686] hover:bg-slate-50 rounded-xl font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-5 py-2 bg-[#004ac6] hover:bg-[#003da6] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Upload className={`w-4 h-4 ${isUploading ? "animate-spin" : ""}`} />
                  <span>{isUploading ? "Subiendo..." : "Guardar Plantilla"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: EDITAR Y ACTUALIZAR FORMATO DE LA PLANTILLA      */}
      {/* ========================================================= */}
      {editingTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-[#e2e8f0] overflow-hidden">
            <div className="p-4 px-6 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8f9ff]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 text-[#004ac6]">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-[#0b1c30] text-sm">Editar Plantilla</h3>
                  <p className="text-[11px] text-[#737686]">Actualiza la información o reemplaza el archivo por una versión nueva</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setEditingTemplate(null);
                  setEditReplacementFile(null);
                }}
                className="p-1 rounded-lg text-[#737686] hover:text-[#0b1c30] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="font-bold text-[#434655] block mb-1">Nombre / Título de la Plantilla *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 font-semibold text-[#0b1c30] focus:border-[#004ac6] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-bold text-[#434655] block mb-1">Categoría Institucional</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value as any)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 font-semibold text-[#0b1c30] focus:border-[#004ac6] focus:outline-hidden cursor-pointer"
                >
                  <option value="Contratos">Contratos</option>
                  <option value="Técnico / Red">Técnico / Red</option>
                  <option value="Comercial / Ventas">Comercial / Ventas</option>
                  <option value="Legal / ARCOTEL">Legal / ARCOTEL</option>
                  <option value="Finanzas">Finanzas</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-[#434655] block mb-1">Descripción / Propósito</label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-[#0b1c30] focus:border-[#004ac6] focus:outline-hidden"
                />
              </div>

              {/* Archivo Actual */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                  Archivo Actual en el Repositorio
                </span>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-[#004ac6] shrink-0" />
                    <span className="font-mono font-bold text-slate-800 text-[11px] truncate">
                      {editingTemplate.fileName}
                    </span>
                    <span className="text-slate-500 text-[10px]">({editingTemplate.fileSize})</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200 text-slate-700 shrink-0">
                    v{editingTemplate.version || 1}
                  </span>
                </div>
              </div>

              {/* Reemplazar Archivo / Subir Actualización */}
              <div className="p-3.5 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/40 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[#004ac6]">
                  <FileUp className="w-4 h-4" />
                  <span>Actualizar / Reemplazar Formato de la Plantilla</span>
                </div>
                <p className="text-[11px] text-[#737686] leading-relaxed">
                  Si editaste el documento Word o Excel y deseas actualizar el formato, selecciona el nuevo archivo.
                  Reemplazará la versión anterior manteniendo el historial de la plantilla.
                </p>

                <input
                  type="file"
                  accept=".docx,.doc,.xlsx,.xls,.pdf,.csv"
                  onChange={(e) => setEditReplacementFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-[#434655] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#004ac6] file:text-white hover:file:bg-[#003da6] cursor-pointer"
                />

                {editReplacementFile ? (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px]">
                    <span className="font-bold flex items-center gap-1.5 truncate">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      Nuevo archivo a cargar: {editReplacementFile.name} ({(editReplacementFile.size / 1024).toFixed(1)} KB)
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditReplacementFile(null)}
                      className="text-emerald-700 hover:text-emerald-900 font-bold ml-2 cursor-pointer"
                    >
                      Remover
                    </button>
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-400 italic block">
                    (Opcional) Si no seleccionas ningún archivo, se mantendrá el formato actual.
                  </span>
                )}
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-[#e2e8f0]">
                <button
                  type="button"
                  onClick={() => {
                    setEditingTemplate(null);
                    setEditReplacementFile(null);
                  }}
                  className="px-4 py-2 text-[#737686] hover:bg-slate-50 rounded-xl font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-5 py-2 bg-[#004ac6] hover:bg-[#003da6] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-4 h-4 ${isUpdating ? "animate-spin" : ""}`} />
                  <span>{isUpdating ? "Guardando..." : "Guardar Cambios"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
