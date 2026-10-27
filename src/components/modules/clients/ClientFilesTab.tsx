"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import { Client, ClientDocumentFile } from "@/types";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { planUpload, compressImageFile, formatBytes } from "@/lib/file-upload";
import { openStoredFile } from "@/lib/file-download";
import { ClientTabHeader } from "./ClientTabHeader";
import {
  HardDrive,
  Upload,
  Search,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  File,
  Download,
  Trash2,
  LayoutGrid,
  List,
  X,
  Sparkles,
  Folder,
  FolderPlus,
  Share2,
  Link2,
  Check,
  MessageCircle,
  Copy,
  Lock,
  ShieldCheck,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";

interface ClientFilesTabProps {
  client: Client;
}

// Carpetas: el expediente arranca sin carpetas; el usuario crea las que necesite.

// Helper visual por extensión de archivo
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
  const [selectedFolder, setSelectedFolder] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Carpetas personalizadas persistidas
  const [customFolders, setCustomFolders] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(`inntel_folders_${client.id}`);
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return [];
  });

  const saveCustomFolders = (folders: string[]) => {
    setCustomFolders(folders);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(`inntel_folders_${client.id}`, JSON.stringify(folders));
      } catch {}
    }
  };

  // Modal Nueva Carpeta
  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState(false);
  const [newFolderNameInput, setNewFolderNameInput] = useState("");

  // Modal de Subida
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadFolder, setUploadFolder] = useState<string>("Contratos");
  const [isCreatingFolderInModal, setIsCreatingFolderInModal] = useState(false);
  const [newFolderNameInModal, setNewFolderNameInModal] = useState("");
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploadShareEnabled, setUploadShareEnabled] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Modal Compartir Enlace Privado
  const [sharingDoc, setSharingDoc] = useState<ClientDocumentFile | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Documentos del cliente actual
  const docs = useMemo(
    () => (clientDocuments || []).filter((d) => d.clientId === client.id),
    [clientDocuments, client.id]
  );

  // Unificación de todas las carpetas (personalizadas + registradas en docs).
  // No se siembran carpetas por defecto: el expediente arranca vacío.
  const allFolders = useMemo(() => {
    const set = new Set<string>(customFolders);
    docs.forEach((d) => set.add(d.folderName || "General"));
    return Array.from(set);
  }, [customFolders, docs]);

  // Conteo de archivos por carpeta
  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allFolders.forEach((f) => {
      counts[f] = docs.filter((d) => (d.folderName || "General") === f).length;
    });
    return counts;
  }, [allFolders, docs]);

  // Filtrado de documentos por búsqueda y carpeta activa
  const filteredDocs = useMemo(() => {
    return docs.filter((d) => {
      const matchesQuery =
        (d.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.fileName || "").toLowerCase().includes(searchQuery.toLowerCase());
      const docFolder = d.folderName || "General";
      const matchesFolder = selectedFolder === "all" || docFolder === selectedFolder;
      return matchesQuery && matchesFolder;
    });
  }, [docs, searchQuery, selectedFolder]);

  const totalFiles = docs.length;

  const handleOpenUploadModal = (preselectedFolder?: string) => {
    setUploadTitle("");
    setUploadNotes("");
    setSelectedFile(null);
    setIsCreatingFolderInModal(false);
    setNewFolderNameInModal("");
    setUploadShareEnabled(true);
    if (preselectedFolder && preselectedFolder !== "all") {
      setUploadFolder(preselectedFolder);
    } else if (selectedFolder !== "all") {
      setUploadFolder(selectedFolder);
    } else {
      setUploadFolder(allFolders[0] || "Contratos");
    }
    setIsUploadModalOpen(true);
  };

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFolderNameInput.trim();
    if (!trimmed) {
      showError("Nombre requerido", "Ingresa un nombre para la carpeta.");
      return;
    }
    if (allFolders.some((f) => f.toLowerCase() === trimmed.toLowerCase())) {
      showError("Carpeta duplicada", "Ya existe una carpeta con este nombre.");
      return;
    }
    const updated = [...customFolders, trimmed];
    saveCustomFolders(updated);
    setSelectedFolder(trimmed);
    setNewFolderNameInput("");
    setIsNewFolderModalOpen(false);
    showSuccess("Carpeta Creada", `Carpeta "${trimmed}" creada correctamente.`);
  };

  const handleCreateFolderInModal = () => {
    const trimmed = newFolderNameInModal.trim();
    if (!trimmed) return;
    if (!allFolders.some((f) => f.toLowerCase() === trimmed.toLowerCase())) {
      saveCustomFolders([...customFolders, trimmed]);
    }
    setUploadFolder(trimmed);
    setNewFolderNameInModal("");
    setIsCreatingFolderInModal(false);
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
      // Política local: cualquier documento (incluye .p12), bloqueo de ejecutables y tope de tamaño.
      const plan = planUpload({ name: selectedFile.name, size: selectedFile.size, type: selectedFile.type });
      if (!plan.ok) {
        showError("Archivo no admitido", plan.reason || "Revisa el archivo antes de subirlo.");
        return;
      }

      // Optimiza imágenes pesadas antes de enviarlas; PDF y certificados se envían tal cual.
      let fileToUpload = selectedFile;
      if (plan.compress) {
        fileToUpload = await compressImageFile(selectedFile);
        if (fileToUpload.size < selectedFile.size) {
          showSuccess(
            "Imagen optimizada",
            `${selectedFile.name}: ${formatBytes(selectedFile.size)} → ${formatBytes(fileToUpload.size)}`
          );
        }
      }

      let fileUrl = "";

      const formData = new FormData();
      formData.append("file", fileToUpload);
      formData.append("folder", `clients/${client.id}/documents`);

      const res = await fetch("/api/blob/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || "No se pudo almacenar el archivo en el servidor.");
      }
      const data = await res.json();
      fileUrl = data.url || data.downloadUrl || "";
      if (!fileUrl) throw new Error("El servidor no devolvió la ubicación del archivo.");

      // Mapeo retrocompatible para documentType (contrato_adhesion, cedula_ruc, acta_entrega, etc.)
      const lowerFolder = uploadFolder.toLowerCase();
      const mappedDocType = lowerFolder.includes("contrato")
        ? "contrato_adhesion"
        : lowerFolder.includes("cedula") || lowerFolder.includes("ruc")
        ? "cedula_ruc"
        : lowerFolder.includes("acta")
        ? "acta_entrega"
        : "otro";

      const token = "tok-" + Math.random().toString(36).substring(2, 10);

      await addClientDocument({
        clientId: client.id,
        title: uploadTitle.trim() || fileToUpload.name,
        documentType: mappedDocType,
        folderName: uploadFolder,
        fileName: fileToUpload.name,
        fileSize: formatFileSize(fileToUpload.size),
        fileUrl: fileUrl || undefined,
        notes: uploadNotes.trim() || undefined,
        shareToken: token,
        isShared: uploadShareEnabled,
      });

      showSuccess(
        "Archivo Guardado",
        `El archivo se organizó en la carpeta "${uploadFolder}" del expediente.`
      );
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

  const getShareLink = (doc: ClientDocumentFile) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://control.inntel.ec";
    const token = doc.shareToken || "tok-" + doc.id;
    return `${origin}/drive/share/${doc.id}?token=${token}`;
  };

  const handleOpenShareModal = (doc: ClientDocumentFile) => {
    setSharingDoc(doc);
    setCopiedLink(false);
  };

  const handleCopyShareLink = async (doc: ClientDocumentFile) => {
    const link = getShareLink(doc);
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(true);
      showSuccess("Enlace Copiado", "El link privado se copió al portapapeles.");
      setTimeout(() => setCopiedLink(false), 3000);
    } catch {
      showError("Error", "No se pudo copiar automáticamente. Por favor cópialo manualmente.");
    }
  };

  const handleShareViaWhatsApp = (doc: ClientDocumentFile) => {
    const link = getShareLink(doc);
    const phone = client.phone ? client.phone.replace(/[^0-9]/g, "") : "";
    const message = `Estimado/a ${client.businessName}, adjuntamos el enlace privado y seguro para acceder a su documento "${doc.title}":\n${link}`;
    const waUrl = phone
      ? `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    window.open(waUrl, "_blank");
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsNewFolderModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-[#cbd5e1] rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5 text-[#004ac6]" />
              <span>+ Nueva Carpeta</span>
            </button>
            <button
              type="button"
              onClick={() => handleOpenUploadModal()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Subir Archivo</span>
            </button>
          </div>
        }
      />

      {/* Visualización de Carpetas (Estilo Google Drive / Carpetas Principales) */}
      <div className="bg-white p-4 rounded-xl border border-[#e2e8f0] shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Folder className="w-4 h-4 text-[#004ac6]" />
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Directorios del Expediente
            </h4>
          </div>
          {selectedFolder !== "all" && (
            <button
              type="button"
              onClick={() => setSelectedFolder("all")}
              className="text-xs font-bold text-[#004ac6] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Ver todas las carpetas</span>
            </button>
          )}
        </div>

        {/* Fila Horizontal de Carpetas */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
          {/* Tarjeta para "Todas las Carpetas" */}
          <button
            type="button"
            onClick={() => setSelectedFolder("all")}
            className={`p-3 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between ${
              selectedFolder === "all"
                ? "bg-[#eff4ff] border-[#004ac6] shadow-2xs"
                : "bg-slate-50/70 border-slate-200 hover:border-slate-300 hover:bg-white"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <Folder
                className={`w-5 h-5 ${
                  selectedFolder === "all" ? "text-[#004ac6] fill-[#004ac6]/20" : "text-amber-500 fill-amber-500/20"
                }`}
              />
              <span className="text-[10px] font-mono font-bold bg-white px-1.5 py-0.5 rounded-md border border-slate-200 text-slate-600">
                {totalFiles}
              </span>
            </div>
            <div>
              <span className="font-bold text-xs text-slate-900 block truncate">Todas</span>
              <span className="text-[10px] text-slate-500">Expediente completo</span>
            </div>
          </button>

          {/* Carpetas individuales */}
          {allFolders.map((folder) => {
            const count = folderCounts[folder] || 0;
            const isSelected = selectedFolder === folder;
            return (
              <button
                key={folder}
                type="button"
                onClick={() => setSelectedFolder(folder)}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? "bg-[#eff4ff] border-[#004ac6] shadow-2xs"
                    : "bg-slate-50/70 border-slate-200 hover:border-slate-300 hover:bg-white"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Folder
                    className={`w-5 h-5 ${
                      isSelected ? "text-[#004ac6] fill-[#004ac6]/20" : "text-amber-500 fill-amber-500/20"
                    }`}
                  />
                  <span className="text-[10px] font-mono font-bold bg-white px-1.5 py-0.5 rounded-md border border-slate-200 text-slate-600">
                    {count}
                  </span>
                </div>
                <div>
                  <span className="font-bold text-xs text-slate-900 block truncate" title={folder}>
                    {folder}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {count} {count === 1 ? "archivo" : "archivos"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Barra de Filtros, Búsqueda y Alternador de Vistas */}
      <div className="bg-white p-3 rounded-xl border border-[#e2e8f0] shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar archivo por nombre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-[#e2e8f0] bg-white focus:outline-hidden focus:border-[#004ac6]"
            />
          </div>

          {/* Selector de Carpeta activo */}
          <select
            value={selectedFolder}
            onChange={(e) => setSelectedFolder(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-[#e2e8f0] bg-white text-slate-700 cursor-pointer font-semibold"
          >
            <option value="all">📂 Todas las Carpetas</option>
            {allFolders.map((f) => (
              <option key={f} value={f}>
                📁 {f} ({folderCounts[f] || 0})
              </option>
            ))}
          </select>
        </div>

        {/* Breadcrumb de Carpeta Activa + Alternador de Vista */}
        <div className="flex items-center gap-3">
          {selectedFolder !== "all" && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <span className="text-slate-400">Carpeta:</span>
              <span className="px-2 py-0.5 rounded-md bg-[#eff4ff] text-[#004ac6] border border-[#dce9ff]">
                {selectedFolder}
              </span>
            </div>
          )}

          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md transition cursor-pointer ${
                viewMode === "grid" ? "bg-white text-[#004ac6] shadow-2xs" : "text-slate-500 hover:text-slate-800"
              }`}
              title="Vista Cuadrícula (Drive)"
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
        />
        <div className="w-10 h-10 rounded-full bg-blue-50 text-[#004ac6] flex items-center justify-center mx-auto mb-2">
          <Upload className="w-5 h-5" />
        </div>
        <p className="text-xs font-bold text-slate-800">
          Arrastra y suelta aquí contratos o archivos del cliente, o haz clic para explorar
        </p>
        <p className="text-[11px] text-slate-400 mt-0.5">
          {selectedFolder !== "all"
            ? `Se organizará directamente en la carpeta "${selectedFolder}"`
            : "Admite documentos PDF, Word, Excel, Cédula escaneada o imágenes (hasta 15 MB)"}
        </p>
      </div>

      {/* Visualización de Archivos: Cuadrícula (Mini Drive) o Tabla */}
      {filteredDocs.length === 0 ? (
        <div className="bg-white p-8 rounded-xl border border-[#e2e8f0] text-center space-y-2">
          <HardDrive className="w-10 h-10 text-slate-300 mx-auto" />
          <h4 className="text-xs font-bold text-slate-700">Sin archivos en el Drive</h4>
          <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
            {searchQuery || selectedFolder !== "all"
              ? "No hay documentos que coincidan con la carpeta o búsqueda seleccionada."
              : "Este cliente aún no tiene archivos ni contratos guardados. Usa el botón 'Subir Archivo' para comenzar."}
          </p>
          {selectedFolder !== "all" && (
            <button
              type="button"
              onClick={() => handleOpenUploadModal(selectedFolder)}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#004ac6] text-white text-xs font-bold rounded-lg hover:bg-[#003da6] cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Subir archivo a &quot;{selectedFolder}&quot;</span>
            </button>
          )}
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {filteredDocs.map((doc) => {
            const visual = getFileVisual(doc.fileName || doc.title);
            const IconComponent = visual.icon;
            const folder = doc.folderName || "General";

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
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold border truncate max-w-[130px] bg-slate-50 text-slate-700 border-slate-200 flex items-center gap-1">
                      <Folder className="w-3 h-3 text-amber-500 shrink-0" />
                      <span className="truncate">{folder}</span>
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
                    {/* Botón Compartir Enlace Privado */}
                    <button
                      type="button"
                      onClick={() => handleOpenShareModal(doc)}
                      className="p-1.5 rounded-md text-[#004ac6] hover:bg-[#eff4ff] transition cursor-pointer"
                      title="Compartir enlace privado seguro con el cliente"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Descargar / Abrir */}
                    {doc.fileUrl ? (
                      <button
                        type="button"
                        onClick={() =>
                          openStoredFile(doc.fileUrl, doc.fileName || "documento").catch((error: Error) =>
                            showError("No se pudo abrir el archivo", error.message)
                          )
                        }
                        className="p-1.5 rounded-md text-slate-500 hover:text-[#004ac6] hover:bg-blue-50 transition cursor-pointer"
                        title="Ver o Descargar Archivo"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    ) : null}

                    {/* Eliminar */}
                    <button
                      type="button"
                      onClick={() => handleDelete(doc)}
                      className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
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
                <th className="py-3 px-4 w-[38%]">Documento / Archivo</th>
                <th className="py-3 px-4 w-[22%]">Carpeta / Directorio</th>
                <th className="py-3 px-4 w-[12%] text-right">Tamaño</th>
                <th className="py-3 px-4 w-[13%] text-center">Fecha</th>
                <th className="py-3 px-4 w-[15%] text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredDocs.map((doc) => {
                const visual = getFileVisual(doc.fileName || doc.title);
                const IconComponent = visual.icon;
                const folder = doc.folderName || "General";

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
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold border truncate max-w-[160px] bg-slate-50 text-slate-700 border-slate-200">
                        <Folder className="w-3 h-3 text-amber-500 shrink-0" />
                        <span className="truncate">{folder}</span>
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
                        <button
                          type="button"
                          onClick={() => handleOpenShareModal(doc)}
                          className="p-1 rounded-md text-[#004ac6] hover:bg-blue-50 transition cursor-pointer"
                          title="Compartir enlace privado"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                        {doc.fileUrl && (
                          <a
                            href={doc.fileUrl}
                          onClick={(event) => {
                            event.preventDefault();
                            openStoredFile(doc.fileUrl, doc.fileName || "documento").catch((error: Error) =>
                              showError("No se pudo abrir el archivo", error.message)
                            );
                          }}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded-md text-slate-500 hover:text-[#004ac6] hover:bg-blue-50 transition cursor-pointer"
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

      {/* Modal Nueva Carpeta */}
      {isNewFolderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-5 py-3.5 bg-[#004ac6] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-4 h-4" />
                <h3 className="text-sm font-bold">Crear Nueva Carpeta</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewFolderModalOpen(false)}
                className="p-1 rounded-md text-white/80 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateFolder} className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Nombre de la Carpeta *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Planos de Fibra, Documentación Legal, Soporte..."
                  value={newFolderNameInput}
                  onChange={(e) => setNewFolderNameInput(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-hidden focus:border-[#004ac6]"
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewFolderModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                >
                  Crear Carpeta
                </button>
              </div>
            </form>
          </div>
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

              {/* Selector de Carpeta / Directorio (en lugar de selector de categoría) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700 block">
                    Carpeta / Directorio de Destino *
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCreatingFolderInModal(!isCreatingFolderInModal)}
                    className="text-[11px] text-[#004ac6] font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <FolderPlus className="w-3 h-3" />
                    <span>+ Nueva Carpeta</span>
                  </button>
                </div>

                <select
                  value={uploadFolder}
                  onChange={(e) => setUploadFolder(e.target.value)}
                  className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:outline-hidden focus:border-[#004ac6] cursor-pointer"
                >
                  {allFolders.map((f) => (
                    <option key={f} value={f}>
                      📁 {f}
                    </option>
                  ))}
                </select>

                {isCreatingFolderInModal && (
                  <div className="mt-2 flex gap-1.5 animate-in fade-in">
                    <input
                      type="text"
                      placeholder="Nombre de la nueva carpeta..."
                      value={newFolderNameInModal}
                      onChange={(e) => setNewFolderNameInModal(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-hidden focus:border-[#004ac6]"
                    />
                    <button
                      type="button"
                      onClick={handleCreateFolderInModal}
                      className="px-3 py-1.5 bg-[#004ac6] text-white text-xs font-bold rounded-lg hover:bg-[#003da6] cursor-pointer"
                    >
                      Añadir
                    </button>
                  </div>
                )}
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
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-hidden focus:border-[#004ac6] resize-none"
                />
              </div>

              {/* Opción de Enlace Privado Seguro */}
              <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-lg flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-[#004ac6] shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Enlace Privado para Clientes</span>
                    <span className="text-[10px] text-slate-500 block">
                      Genera un link seguro con token para compartir directamente
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={uploadShareEnabled}
                  onChange={(e) => setUploadShareEnabled(e.target.checked)}
                  className="w-4 h-4 text-[#004ac6] rounded border-slate-300 cursor-pointer"
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

      {/* Modal Compartir Archivo por Enlace Privado */}
      {sharingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-5 py-3.5 bg-[#004ac6] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4" />
                <h3 className="text-sm font-bold">Compartir Enlace Privado</h3>
              </div>
              <button
                type="button"
                onClick={() => setSharingDoc(null)}
                className="p-1 rounded-md text-white/80 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Información del Archivo */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-3">
                <div className="w-9 h-9 rounded-md bg-blue-50 border border-blue-200 text-[#004ac6] flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-xs text-slate-900 truncate">{sharingDoc.title}</h4>
                  <p className="text-[11px] text-slate-500 font-mono truncate">
                    📁 {sharingDoc.folderName || "General"} • {formatFileSize(sharingDoc.fileSize)}
                  </p>
                </div>
              </div>

              {/* Enlace Privado */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block flex items-center justify-between">
                  <span>Enlace Privado Seguro (Token Cifrado)</span>
                  <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Acceso Directo Protegido</span>
                  </span>
                </label>

                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={getShareLink(sharingDoc)}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-[11px] font-mono text-slate-700 select-all focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopyShareLink(sharingDoc)}
                    className="px-3.5 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>¡Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Acciones directas para compartir */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleShareViaWhatsApp(sharingDoc)}
                  className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Enviar por WhatsApp</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSharingDoc(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cerrar
                </button>
              </div>

              {/* Nota de Seguridad */}
              <p className="text-[11px] text-slate-400 bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-center">
                🔒 El cliente podrá visualizar y descargar este documento directamente desde su móvil o PC sin requerir inicio de sesión en el sistema.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
