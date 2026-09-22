"use client";

import React, { useState, useEffect } from "react";
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
  X,
  FileCode,
  FileCheck,
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
  },
];

export function TemplateGenerator() {
  const { clients, clientServices, nodes, policies, monthlyCharges, currentUser } = useApp();
  const { showSuccess, showError, showWarning } = useToast();

  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>([]);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<CustomTemplate["category"]>("Contratos");
  const [newDescription, setNewDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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
      console.warn("Storage full or unavailable", e);
    }
  };

  const handleDownloadContract = async () => {
    if (clients.length === 0) {
      showWarning("Sin Clientes", "No hay abonados registrados para generar el contrato.");
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

  const handleFileUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      showError("Nombre Requerido", "Ingresa el nombre descriptivo de la plantilla.");
      return;
    }
    if (!selectedFile) {
      showError("Archivo Requerido", "Selecciona un archivo desde tu equipo.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = typeof reader.result === "string" ? reader.result : "";
      const sizeKb = Math.round(selectedFile.size / 1024);
      const newTmpl: CustomTemplate = {
        id: "tmpl-" + Date.now(),
        name: newName.trim(),
        description: newDescription.trim() || "Plantilla institucional cargada por el personal.",
        category: newCategory,
        fileName: selectedFile.name,
        fileSize: sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`,
        fileType: selectedFile.type || "application/octet-stream",
        fileData: base64,
        uploadedAt: new Date().toISOString().split("T")[0],
        uploadedBy: currentUser.displayName || "Administrador",
      };

      saveCustomTemplates([newTmpl, ...customTemplates]);
      showSuccess("Archivo Subido", `La plantilla "${newTmpl.name}" ha sido agregada al repositorio.`);
      setIsUploadModalOpen(false);
      setNewName("");
      setNewDescription("");
      setSelectedFile(null);
    };

    reader.readAsDataURL(selectedFile);
  };

  const handleDownloadCustom = (tmpl: CustomTemplate) => {
    if (tmpl.fileData) {
      const link = document.createElement("a");
      link.href = tmpl.fileData;
      link.download = tmpl.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showSuccess("Descargando", `Se ha iniciado la descarga de ${tmpl.fileName}.`);
    } else {
      // Fallback mock text file if data missing
      const blob = new Blob([`Contenido de plantilla: ${tmpl.name}\nINNTEL CORP S.A.`], { type: "text/plain" });
      triggerBrowserDownload(blob, tmpl.fileName);
      showSuccess("Descargando", `Descargando archivo institucional ${tmpl.fileName}.`);
    }
  };

  const handleDeleteCustom = (id: string, name: string) => {
    const updated = customTemplates.filter((t) => t.id !== id);
    saveCustomTemplates(updated);
    showSuccess("Archivo Eliminado", `Se ha removido "${name}" del repositorio.`);
  };

  const SYSTEM_TEMPLATES = [
    {
      title: "Contrato de Adhesión para Servicio de Internet (SAI)",
      desc: "Modelo formal homologado por ARCOTEL con cláusulas de SLA, comparecientes y tarifas.",
      format: "Word (.docx)",
      icon: FileText,
      color: "bg-[#eff4ff] text-[#004ac6] border-[#dce9ff]",
      action: handleDownloadContract,
    },
    {
      title: "Registro de Infraestructura de Red SAI",
      desc: "Formulario técnico de POPs, coordenadas, capacidades y proveedores para reporte ARCOTEL.",
      format: "Excel (.xlsx)",
      icon: FileSpreadsheet,
      color: "bg-[#ecfdf5] text-[#059669] border-[#a7f3d0]",
      action: handleDownloadSaiExcel,
    },
    {
      title: "Lote de Órdenes de Pedido & Pre-Facturas Internas",
      desc: "Estructura estándar de cotizaciones, tarifas mensuales y seguimiento de cobros por cliente.",
      format: "Excel (.xlsx)",
      icon: FileSpreadsheet,
      color: "bg-[#eff4ff] text-[#004ac6] border-[#dce9ff]",
      action: handleDownloadBillingBatch,
    },
    {
      title: "Oficio Formal de Renovación de Póliza ARCOTEL",
      desc: "Documento oficial dirigido a la Dirección Ejecutiva de ARCOTEL para ingreso en QUIPUX.",
      format: "Word (.docx)",
      icon: Shield,
      color: "bg-[#f5f3ff] text-[#712ae2] border-[#ddd6fe]",
      action: handleDownloadRenewalLetter,
    },
  ];

  return (
    <div className="w-full space-y-8 select-none">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1c30] tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-[#004ac6]" />
            Automatización de Plantillas Regulatorias & Comerciales
          </h1>
        </div>

        <button
          onClick={() => setIsUploadModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
        >
          <Upload className="w-4 h-4" />
          <span>Subir Archivo / Plantilla</span>
        </button>
      </div>

      {/* System Automated Templates */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-[#0b1c30] uppercase tracking-wider">
          Plantillas Oficiales Generadas Dinámicamente
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {SYSTEM_TEMPLATES.map((tmpl, idx) => {
            const Icon = tmpl.icon;
            return (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-white border border-[#e2e8f0] shadow-lumina-card flex flex-col justify-between hover:border-[#cbd5e1] transition-all"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className={`p-3 rounded-xl border ${tmpl.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-bold font-mono text-[#434655] bg-[#f8f9ff] px-2.5 py-0.5 rounded-md border border-[#e2e8f0]">
                      {tmpl.format}
                    </span>
                  </div>

                  <h3 className="font-bold text-base text-[#0b1c30] mt-4">{tmpl.title}</h3>
                  <p className="text-xs text-[#737686] mt-1 leading-relaxed">{tmpl.desc}</p>
                </div>

                <div className="mt-6 pt-4 border-t border-[#f1f5f9] flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#059669] flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" /> Listo para Generación
                  </span>
                  <button
                    onClick={tmpl.action}
                    className="px-4 py-2 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Generar {tmpl.format.split(" ")[0]}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Uploaded Files Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#0b1c30] uppercase tracking-wider flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-[#004ac6]" />
            Repositorio Institucional de Documentos & Plantillas
          </h2>
          <span className="text-xs text-[#737686] font-medium">
            {customTemplates.length} documentos almacenados
          </span>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-[#e2e8f0] bg-white shadow-lumina-card">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-[11px] uppercase tracking-wider border-b border-[#e2e8f0]">
              <tr>
                <th className="py-3.5 px-5">Documento / Título</th>
                <th className="py-3.5 px-5">Categoría</th>
                <th className="py-3.5 px-5">Nombre de Archivo</th>
                <th className="py-3.5 px-5">Tamaño</th>
                <th className="py-3.5 px-5">Fecha de Carga</th>
                <th className="py-3.5 px-5">Subido Por</th>
                <th className="py-3.5 px-5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9] font-medium text-[#434655]">
              {customTemplates.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-[#737686] italic">
                    No hay plantillas o archivos adicionales subidos aún. Presiona &quot;Subir Archivo / Plantilla&quot;.
                  </td>
                </tr>
              ) : (
                customTemplates.map((item) => (
                  <tr key={item.id} className="hover:bg-[#f8f9ff] transition-colors">
                    <td className="py-3.5 px-5">
                      <p className="font-bold text-[#0b1c30]">{item.name}</p>
                      <span className="text-[11px] text-[#737686] block mt-0.5">{item.description}</span>
                    </td>
                    <td className="py-3.5 px-5">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#eff4ff] text-[#004ac6] border border-[#dce9ff]">
                        {item.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 font-mono text-[11px] text-[#0b1c30]">
                      {item.fileName}
                    </td>
                    <td className="py-3.5 px-5 font-mono text-[#737686]">{item.fileSize}</td>
                    <td className="py-3.5 px-5 font-mono text-[11px] text-[#737686]">{item.uploadedAt}</td>
                    <td className="py-3.5 px-5 font-semibold text-[#434655]">{item.uploadedBy}</td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleDownloadCustom(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-[#004ac6] bg-[#eff4ff] hover:bg-[#dce9ff] transition-colors cursor-pointer"
                          title="Descargar archivo"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Descargar</span>
                        </button>
                        <button
                          onClick={() => handleDeleteCustom(item.id, item.name)}
                          className="p-1.5 text-[#737686] hover:text-[#ef4444] hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Eliminar plantilla"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* Upload Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-lumina-dropdown border border-[#e2e8f0] overflow-hidden">
            <div className="p-4 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8f9ff]">
              <h3 className="font-bold text-[#0b1c30] text-sm flex items-center gap-2">
                <Upload className="w-4 h-4 text-[#004ac6]" />
                Subir Nueva Plantilla o Archivo al Repositorio
              </h3>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="p-1 rounded-lg text-[#737686] hover:text-[#0b1c30] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleFileUpload} className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-bold text-[#434655] block mb-1">Nombre / Título de la Plantilla *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Acta de Entrega ONT / Formato de Cesión de Derechos"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 font-semibold text-[#0b1c30]"
                />
              </div>

              <div>
                <label className="font-bold text-[#434655] block mb-1">Categoría Institucional</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 font-semibold text-[#0b1c30]"
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
                  className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 text-[#0b1c30]"
                />
              </div>

              <div>
                <label className="font-bold text-[#434655] block mb-1">Seleccionar Archivo (Word, Excel, PDF, etc.) *</label>
                <input
                  type="file"
                  required
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-[#434655] file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#eff4ff] file:text-[#004ac6] hover:file:bg-[#dce9ff] cursor-pointer"
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
                  className="px-4 py-2 text-[#737686] hover:bg-[#f8f9ff] rounded-lg font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-lg font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Upload className="w-4 h-4" />
                  <span>Subir Archivo</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
