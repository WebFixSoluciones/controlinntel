"use client";

import React, { useState, useRef } from "react";
import { Client, ClientDocumentFile } from "@/types";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { ClientTabHeader } from "./ClientTabHeader";
import {
  Cloud,
  HardDrive,
  Upload,
  Search,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  File,
  Download,
  Trash2,
  ExternalLink,
  Plus,
  LayoutGrid,
  List,
  X,
  ShieldCheck,
  Calendar,
  Sparkles,
} from "lucide-react";

interface ClientFilesTabProps {
  client: Client;
}

const CATEGORY_LABELS: Record<ClientDocumentFile["documentType"], { label: string; color: string }> = {
  contrato_adhesion: { label: "Contrato de Adhesión", color: "bg-blue-50 text-[#004ac6] border-blue-200" },
  cedula_ruc: { label: "Cédula / RUC", color: "bg-purple-50 text-purple-700 border-purple-200" },
  acta_entrega: { label: "Acta de Entrega", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  proteccion_datos: { label: "Protección de Datos", color: "bg-amber-50 text-amber-700 border-amber-200" },
  comprobante_pago: { label: "Comprobante de Pago", color: "bg-teal-50 text-teal-700 border-teal-200" },
  ficha_tecnica: { label: "Ficha Técnica", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  otro: { label: "Otro Documento", color: "bg-slate-100 text-slate-700 border-slate-200" },
};

function formatFileSize(bytesOrStr: string | number) {
  if (typeof bytesOrStr === "string" && (bytesOrStr.includes("KB") || bytesOrStr.includes("MB") || bytesOrStr.includes("B"))) {
    return bytesOrStr;
  }
  const bytes = Number(bytesOrStr);
  if (isNaN(bytes) || bytes === 0) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileVisual(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "pdf") {
    return { icon: FileText, color: "text-rose-600 bg-rose-50 border-rose-200", label: "PDF" };
  }
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext || "")) {
    return { icon: ImageIcon, color: "text-purple-600 bg-purple-50 border-purple-200", label: "IMG" };
  }
  if (["doc", "docx"].includes(ext || "")) {
    return { icon: FileText, color: "text-blue-600 bg-blue-50 border-blue-200", label: "DOC" };
  }
  if (["xls", "xlsx", "csv"].includes(ext || "")) {
    return { icon: FileSpreadsheet, color: "text-emerald-600 bg-emerald-50 border-emerald-200", label: "XLS" };
  }
  return { icon: File, color: "text-slate-600 bg-slate-50 border-slate-200", label: ext ? ext.toUpperCase() : "FILE" };
}

export function ClientFilesTab({ client }: ClientFilesTabProps) {
  const { clientDocuments = [], addClientDocument, deleteClientDocument } = useApp();
  const { showSuccess, showError, showConfirm } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Modal de Subida
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCategory, setUploadCategory] = useState<ClientDocumentFile["documentType"]>("contrato_adhesion");
  const [uploadNotes, setUploadNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const docs = (clientDocuments || []).filter((d) => d.clientId === client.id);

  const filteredDocs = docs.filter((d) => {
    const matchesQuery =
      (d.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.fileName || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || d.documentType === categoryFilter;
    return matchesQuery && matchesCategory;
  });

  const totalFiles = docs.length;

  const handleOpenUploadModal = (preselectedCategory?: ClientDocumentFile["documentType"]) => {
    setUploadTitle("");
    setUploadNotes("");
    setSelectedFile(null);
    if (preselectedCategory) setUploadCategory(preselectedCategory);
    setIsUploadModalOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!uploadTitle.trim()) {
        const cleanName = file.name.replace(/\.[^/.]+$/, "");
        setUploadTitle(cleanName);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!uploadTitle.trim()) {
        const cleanName = file.name.replace(/\.[^/.]+$/, "");
        setUploadTitle(cleanName);
      }
      setIsUploadModalOpen(true);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      showError("Archivo Requerido", "Por favor selecciona un archivo para subir.");
      return;
    }

    setIsUploading(true);
    try {
      let fileUrl = "";

      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("folder", `clients/${client.id}/documents`);

      const res = await fetch("/api/blob/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        fileUrl = data.url || data.downloadUrl || "";
      } else {
        // Fallback local base64 si la API de blob fallara
        const reader = new FileReader();
        fileUrl = await new Promise((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(selectedFile);
        });
      }

      await addClientDocument({
        clientId: client.id,
        title: uploadTitle.trim() || selectedFile.name,
        documentType: uploadCategory,
        fileName: selectedFile.name,
        fileSize: formatFileSize(selectedFile.size),
        fileUrl: fileUrl || undefined,
        notes: uploadNotes.trim() || undefined,
      });

      showSuccess("Archivo Guardado", `El archivo "${selectedFile.name}" se guardó en el expediente del cliente.`);
      setIsUploadModalOpen(false);
      setSelectedFile(null);
      setUploadTitle("");
      setUploadNotes("");
    } catch (err: any) {
      showError("Error al Subir", err?.message || "No se pudo completar la subida del archivo.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = (doc: ClientDocumentFile) => {
    showConfirm(
      "¿Eliminar Archivo?",
      `¿Estás seguro de que deseas eliminar permanentemente el archivo "${doc.title}"?`,
      async () => {
        try {
          await deleteClientDocument(doc.id);
          showSuccess("Archivo Eliminado", "El documento ha sido retirado del expediente.");
        } catch (err: any) {
          showError("Error al Eliminar", err?.message || "No se pudo eliminar el archivo.");
        }
      },
      "Eliminar Archivo"
    );
  };

  return (
    <div className="space-y-4">
      {/* Header Estándar de Pestaña */}
      <ClientTabHeader
        title="Archivos del Cliente"
        icon={HardDrive}
        badge={
          <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-[#eff4ff] text-[#004ac6] border border-[#dce9ff]">
            {totalFiles} {totalFiles === 1 ? "archivo" : "archivos"}
          </span>
        }
        actions={
          <button
            type="button"
            onClick={() => handleOpenUploadModal()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Subir Archivo</span>
          </button>
        }
      />

      {/* Barra de Filtros, Búsqueda y Alternador de Vistas */}
      <div className="bg-white p-3 rounded-xl border border-[#e2e8f0] shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar archivo por nombre o título..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-[#e2e8f0] bg-white focus:outline-hidden focus:border-[#004ac6]"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-[#e2e8f0] bg-white text-slate-700 cursor-pointer"
          >
            <option value="all">Todas las Categorías</option>
            <option value="contrato_adhesion">Contratos de Adhesión</option>
            <option value="cedula_ruc">Cédula / RUC</option>
            <option value="acta_entrega">Actas de Entrega</option>
            <option value="proteccion_datos">Protección de Datos</option>
            <option value="comprobante_pago">Comprobantes de Pago</option>
            <option value="ficha_tecnica">Ficha Técnica</option>
            <option value="otro">Otros</option>
          </select>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={`p-1.5 rounded-md transition cursor-pointer ${
              viewMode === "grid" ? "bg-white text-[#004ac6] shadow-2xs" : "text-slate-500 hover:text-slate-800"
            }`}
            title="Vista Cuadrícula (Mini Drive)"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`p-1.5 rounded-md transition cursor-pointer ${
              viewMode === "table" ? "bg-white text-[#004ac6] shadow-2xs" : "text-slate-500 hover:text-slate-800"
            }`}
            title="Vista Tabla"
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Zona Drag & Drop / Subida Rápida */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-5 text-center transition cursor-pointer ${
          isDragging
            ? "border-[#004ac6] bg-blue-50/60"
            : "border-slate-200 hover:border-[#004ac6]/60 bg-white hover:bg-[#f8f9ff]/50"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileChange}
          className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp"
        />
        <div className="w-10 h-10 rounded-full bg-blue-50 text-[#004ac6] flex items-center justify-center mx-auto mb-2">
          <Upload className="w-5 h-5" />
        </div>
        <p className="text-xs font-bold text-slate-800">
          Arrastra y suelta aquí contratos o archivos del cliente, o haz clic para explorar
        </p>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Admite documentos PDF, Word, Excel, Cédula escaneada o imágenes (hasta 15 MB)
        </p>
      </div>

      {/* Visualización de Archivos: Cuadrícula (Mini Drive) o Tabla */}
      {filteredDocs.length === 0 ? (
        <div className="bg-white p-8 rounded-xl border border-[#e2e8f0] text-center space-y-2">
          <HardDrive className="w-10 h-10 text-slate-300 mx-auto" />
          <h4 className="text-xs font-bold text-slate-700">Sin archivos en el Drive</h4>
          <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
            {searchQuery || categoryFilter !== "all"
              ? "No hay documentos que coincidan con los filtros de búsqueda."
              : "Este cliente aún no tiene archivos ni contratos guardados. Usa el botón 'Subir Archivo' para comenzar."}
          </p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {filteredDocs.map((doc) => {
            const visual = getFileVisual(doc.fileName || doc.title);
            const IconComponent = visual.icon;
            const categoryMeta = CATEGORY_LABELS[doc.documentType] || CATEGORY_LABELS.otro;

            return (
              <div
                key={doc.id}
                className="bg-white rounded-xl border border-[#e2e8f0] hover:border-blue-300 shadow-2xs hover:shadow-xs transition p-4 flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${visual.color}`}>
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border truncate max-w-[130px] ${categoryMeta.color}`}>
                      {categoryMeta.label}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-slate-900 line-clamp-1 mb-1 group-hover:text-[#004ac6] transition" title={doc.title}>
                    {doc.title}
                  </h4>
                  <p className="text-[10px] font-mono text-slate-500 truncate mb-2" title={doc.fileName}>
                    {doc.fileName}
                  </p>
                  {doc.notes && (
                    <p className="text-[10px] text-slate-600 line-clamp-2 bg-slate-50 p-1.5 rounded-md border border-slate-100 mb-2">
                      {doc.notes}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                  <div className="flex items-center gap-2 font-mono">
                    <span>{formatFileSize(doc.fileSize)}</span>
                    <span>•</span>
                    <span>{new Date(doc.uploadedAt).toLocaleDateString("es-EC")}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {doc.fileUrl ? (
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded-md text-slate-500 hover:text-[#004ac6] hover:bg-blue-50 transition cursor-pointer"
                        title="Ver o Descargar Archivo"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleDelete(doc)}
                      className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                      title="Eliminar Archivo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
          <table className="table-fixed w-full text-left text-xs border-collapse">
            <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-xs uppercase tracking-wider border-b border-[#e2e8f0]">
              <tr>
                <th className="py-3 px-4 w-[40%]">Documento / Archivo</th>
                <th className="py-3 px-4 w-[25%]">Categoría</th>
                <th className="py-3 px-4 w-[12%] text-right">Tamaño</th>
                <th className="py-3 px-4 w-[13%] text-center">Fecha</th>
                <th className="py-3 px-4 w-[10%] text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredDocs.map((doc) => {
                const visual = getFileVisual(doc.fileName || doc.title);
                const IconComponent = visual.icon;
                const categoryMeta = CATEGORY_LABELS[doc.documentType] || CATEGORY_LABELS.otro;

                return (
                  <tr key={doc.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-7 h-7 rounded-md border flex items-center justify-center shrink-0 ${visual.color}`}>
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 truncate" title={doc.title}>
                            {doc.title}
                          </div>
                          <div className="text-[10px] font-mono text-slate-500 truncate" title={doc.fileName}>
                            {doc.fileName}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border truncate max-w-[160px] ${categoryMeta.color}`}>
                        {categoryMeta.label}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">
                      {formatFileSize(doc.fileSize)}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-slate-500 text-[11px]">
                      {new Date(doc.uploadedAt).toLocaleDateString("es-EC")}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {doc.fileUrl && (
                          <a
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded-md text-[#004ac6] hover:bg-blue-50 transition cursor-pointer"
                            title="Descargar o Abrir"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(doc)}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title="Eliminar Archivo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Corporativo para Subir Archivo (Master Modal) */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-5 py-3.5 bg-[#004ac6] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4" />
                <h3 className="text-sm font-bold">Subir Archivo al Drive</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                className="p-1 rounded-md text-white/80 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Título o Descripción del Archivo *
                </label>
                <input
                  type="text"
                  placeholder="Ej: Contrato de Fibra Óptica 300M, Cédula de Identidad..."
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-hidden focus:border-[#004ac6]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Categoría del Documento *
                </label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value as any)}
                  className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-hidden focus:border-[#004ac6]"
                >
                  <option value="contrato_adhesion">Contrato de Adhesión</option>
                  <option value="cedula_ruc">Cédula / RUC</option>
                  <option value="acta_entrega">Acta de Entrega / Instalación</option>
                  <option value="proteccion_datos">Protección de Datos</option>
                  <option value="comprobante_pago">Comprobante de Pago</option>
                  <option value="ficha_tecnica">Ficha Técnica</option>
                  <option value="otro">Otro</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Archivo Seleccionado *
                </label>
                <div className="flex items-center gap-2">
                  <label className="flex-1 flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs cursor-pointer hover:bg-slate-100 transition">
                    <span className="truncate text-slate-700 font-mono">
                      {selectedFile ? selectedFile.name : "Seleccionar archivo desde el equipo..."}
                    </span>
                    <Upload className="w-3.5 h-3.5 text-[#004ac6] shrink-0 ml-2" />
                    <input
                      type="file"
                      onChange={handleFileChange}
                      className="hidden"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp"
                    />
                  </label>
                </div>
                {selectedFile && (
                  <p className="text-[11px] font-mono text-emerald-600 mt-1">
                    Tamaño: {formatFileSize(selectedFile.size)}
                  </p>
                )}
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Notas u Observaciones (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalles sobre el contrato, firmas o fecha de entrega..."
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-hidden focus:border-[#004ac6]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  disabled={isUploading}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !selectedFile}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#004ac6] hover:bg-[#003da6] disabled:bg-slate-300 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                >
                  {isUploading ? (
                    <>
                      <Sparkles className="w-3.5 h-3.5 animate-spin" />
                      <span>Subiendo...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Guardar en Archivos</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
