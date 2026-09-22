"use client";

import React, { useState } from "react";
import { Client, ClientDocumentFile } from "@/types";
import { ContractsManager } from "./ContractsManager";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { generateAdhesionContractDocx, triggerBrowserDownload } from "@/lib/doc-generator";
import {
  Download,
  FileText,
  Upload,
  Plus,
  Trash2,
  FileCheck,
  ShieldCheck,
  File,
  X,
  AlertCircle,
} from "lucide-react";

export function ClientContractTab({ client }: { client: Client }) {
  const { clientServices, clientDocuments, addClientDocument, deleteClientDocument } = useApp();
  const { showError, showSuccess, showConfirm } = useToast();

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docType, setDocType] = useState<ClientDocumentFile["documentType"]>("contrato_adhesion");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const docs = clientDocuments.filter((d) => d.clientId === client.id);

  const handleDownloadTemplate = async () => {
    try {
      const service = clientServices.find((s) => s.clientId === client.id && s.status === "activo");
      const blob = await generateAdhesionContractDocx(client, service);
      triggerBrowserDownload(blob, `Modelo_Adhesion_${client.identificationNumber}.docx`);
      showSuccess("Descarga Exitosa", `Borrador oficial para ${client.businessName} descargado.`);
    } catch {
      showError("Error", "No se pudo generar el modelo Word.");
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle.trim()) {
      showError("Título Requerido", "Ingresa un título descriptivo para el documento.");
      return;
    }
    if (!selectedFile) {
      showError("Archivo Requerido", "Selecciona un archivo PDF o Word para cargar.");
      return;
    }

    setBusy(true);
    try {
      const fileSizeKb = Math.round(selectedFile.size / 1024);
      const sizeStr = fileSizeKb > 1024 ? `${(fileSizeKb / 1024).toFixed(1)} MB` : `${fileSizeKb} KB`;

      await addClientDocument({
        clientId: client.id,
        title: docTitle.trim(),
        documentType: docType,
        fileName: selectedFile.name,
        fileSize: sizeStr,
        fileUrl: "#",
      });

      showSuccess("Documento Guardado", `El archivo ${selectedFile.name} se vinculó al expediente del abonado.`);
      setIsUploadModalOpen(false);
      setDocTitle("");
      setSelectedFile(null);
    } catch (err: any) {
      showError("Error", err?.message || "No se pudo guardar el documento.");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteDoc = (docId: string, title: string) => {
    showConfirm(
      "¿Eliminar Documento?",
      `¿Confirmas la eliminación del documento "${title}" del expediente?`,
      async () => {
        try {
          await deleteClientDocument(docId);
          showSuccess("Documento Eliminado", "El archivo ha sido retirado.");
        } catch {
          showError("Error", "No se pudo eliminar el archivo.");
        }
      },
      "Eliminar Archivo"
    );
  };

  const getDocTypeBadge = (type: ClientDocumentFile["documentType"]) => {
    switch (type) {
      case "contrato_adhesion":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-50 text-[#004ac6] border border-blue-200">
            <FileCheck className="w-3 h-3" />
            Contrato de Servicios
          </span>
        );
      case "proteccion_datos":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ShieldCheck className="w-3 h-3" />
            Protección de Datos
          </span>
        );
      case "cedula_ruc":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-50 text-purple-700 border border-purple-200">
            <File className="w-3 h-3" />
            Identificación / Legal
          </span>
        );
      case "acta_entrega":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
            <FileText className="w-3 h-3" />
            Acta de Entrega
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-50 text-slate-700 border border-slate-200">
            Otro Documento
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 select-none">
      {/* 1. Contratos SAI ARCOTEL Registrados */}
      <ContractsManager clientId={client.id} />

      {/* 2. Repositorio de Documentos Digitales del Abonado (PDF Página 4) */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-lumina-card overflow-hidden">
        <div className="p-4 px-6 border-b border-[#e2e8f0] bg-[#f8f9ff] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-[#0b1c30] text-xs uppercase tracking-wider flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-[#004ac6]" />
              Expediente Digital del Abonado (Contratos & Protección de Datos)
            </h3>
            <p className="text-[11px] text-[#737686]">
              Archivos digitalizados: Contrato de Adhesión firmado, Cláusula de Protección de Datos Personales, Cédula y Actas
            </p>
          </div>

          <button
            onClick={() => {
              setDocTitle("");
              setSelectedFile(null);
              setIsUploadModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Subir Documento</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-[10px] uppercase tracking-wider border-b border-[#e2e8f0]">
              <tr>
                <th className="py-3 px-5">Tipo Documento</th>
                <th className="py-3 px-5">Título / Descripción</th>
                <th className="py-3 px-5">Archivo Digital</th>
                <th className="py-3 px-5">Fecha Carga</th>
                <th className="py-3 px-5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9] text-[#0b1c30]">
              {docs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-[#737686]">
                    <Upload className="w-7 h-7 text-slate-300 mx-auto mb-1.5" />
                    <p className="font-semibold text-slate-600">No se han cargado documentos para este abonado.</p>
                    <p className="text-[11px] text-slate-400">Puedes cargar el contrato de adhesión escaneado y la autorización de protección de datos.</p>
                  </td>
                </tr>
              ) : (
                docs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-[#f8f9ff] transition-colors">
                    <td className="py-3.5 px-5">{getDocTypeBadge(doc.documentType)}</td>
                    <td className="py-3.5 px-5">
                      <div className="font-bold text-[#0b1c30]">{doc.title}</div>
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="font-mono text-[11px] text-[#004ac6] flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        <span>{doc.fileName}</span>
                        <span className="text-[10px] text-slate-400">({doc.fileSize})</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-5 text-[#737686] text-[11px]">
                      {doc.uploadedAt.split("T")[0]}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            showSuccess("Descarga Simulada", `Descargando ${doc.fileName}...`);
                          }}
                          className="p-1.5 text-slate-500 hover:text-[#004ac6] hover:bg-[#eff4ff] rounded-lg transition-colors cursor-pointer"
                          title="Descargar archivo"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteDoc(doc.id, doc.title)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Eliminar documento"
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

      {/* 3. Descarga de Plantilla Oficial Word */}
      <div className="p-4 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#004ac6] flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-xs text-[#0b1c30]">Modelo Homologado ARCOTEL en Formato Word (.docx)</h4>
            <span className="text-[11px] text-[#737686]">Plantilla institucional pre-llenada con los datos legales del abonado</span>
          </div>
        </div>

        <button
          onClick={handleDownloadTemplate}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-[#cbd5e1] hover:border-[#004ac6] hover:text-[#004ac6] text-[#434655] rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-[#004ac6]" />
          <span>Descargar Contrato Adhesión Word</span>
        </button>
      </div>

      {/* Modal Subir Documento del Abonado */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-lumina-dropdown border border-[#e2e8f0] overflow-hidden">
            <div className="p-4 px-5 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8f9ff]">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-[#004ac6]" />
                <h3 className="font-bold text-[#0b1c30] text-xs">Cargar Documento del Abonado</h3>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-bold text-[#434655] block mb-1">Tipo de Documento *</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as ClientDocumentFile["documentType"])}
                  className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-xs font-semibold text-[#0b1c30] focus:ring-1 focus:ring-[#004ac6]"
                >
                  <option value="contrato_adhesion">Contrato de Adhesión / Servicios Firmado</option>
                  <option value="proteccion_datos">Autorización de Protección de Datos Personales</option>
                  <option value="cedula_ruc">Cédula / Nombramiento Legal / RUC</option>
                  <option value="acta_entrega">Acta de Entrega-Recepción de Equipos</option>
                  <option value="otro">Otro Documento Legal</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-[#434655] block mb-1">Título / Descripción del Archivo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Contrato de Adhesión Firmado 2026"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-xs text-[#0b1c30] focus:ring-1 focus:ring-[#004ac6]"
                />
              </div>

              <div>
                <label className="font-bold text-[#434655] block mb-1">Seleccionar Archivo (PDF / Word) *</label>
                <input
                  type="file"
                  required
                  accept=".pdf,.docx,.doc"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedFile(e.target.files[0]);
                      if (!docTitle) {
                        setDocTitle(e.target.files[0].name.replace(/\.[^/.]+$/, ""));
                      }
                    }
                  }}
                  className="w-full bg-slate-50 border border-dashed border-[#cbd5e1] rounded-xl p-3 text-xs text-[#434655] cursor-pointer file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#004ac6] file:text-white hover:file:bg-[#2563eb]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
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
