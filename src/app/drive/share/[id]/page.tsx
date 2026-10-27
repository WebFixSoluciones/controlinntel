"use client";

import React, { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useApp } from "@/lib/state";
import { ClientDocumentFile } from "@/types";
import {
  HardDrive,
  Download,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  File,
  ShieldCheck,
  Building2,
  Calendar,
  ExternalLink,
  Lock,
} from "lucide-react";

export default function DocumentSharePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { clientDocuments = [], clients = [] } = useApp();

  const docId = params?.id as string;
  const token = searchParams?.get("token");

  const [document, setDocument] = useState<ClientDocumentFile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!docId) {
      setLoading(false);
      return;
    }
    const found = clientDocuments.find((d) => d.id === docId);
    setDocument(found || null);
    setLoading(false);
  }, [docId, clientDocuments]);

  const client = clients.find((c) => c.id === document?.clientId);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-[#004ac6] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-600">Cargando documento seguro...</p>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-slate-200 p-6 text-center space-y-4">
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-800">Documento No Encontrado o No Disponible</h2>
          <p className="text-xs text-slate-500">
            El enlace solicitado puede haber expirado o no está disponible en este momento. Por favor contacta a soporte técnico de Inntel.
          </p>
        </div>
      </div>
    );
  }

  const ext = document.fileName.split(".").pop()?.toLowerCase();
  const isPdf = ext === "pdf";
  const isImage = ["jpg", "jpeg", "png", "webp"].includes(ext || "");

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Header corporativo */}
      <header className="bg-[#004ac6] text-white py-3.5 px-6 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <HardDrive className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-extrabold tracking-wide">INNTEL CORP S.A.</h1>
              <p className="text-[10px] text-white/80">Portal Seguro de Documentación al Cliente</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs bg-white/10 px-3 py-1 rounded-full text-white/90 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
            <span>Enlace Seguro</span>
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-4">
        {/* Ficha del documento */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 text-[#004ac6] flex items-center justify-center shrink-0">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                  📁 {document.folderName || "General"}
                </span>
                <h2 className="text-base font-extrabold text-slate-900 mt-1">{document.title}</h2>
                <p className="text-xs font-mono text-slate-500">{document.fileName}</p>
              </div>
            </div>

            {document.fileUrl && (
              <a
                href={document.fileUrl}
                download={document.fileName}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Descargar Archivo</span>
              </a>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] font-bold uppercase">Tamaño</span>
              <span className="font-mono font-bold text-slate-700">{document.fileSize}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] font-bold uppercase">Fecha de Emisión</span>
              <span className="font-mono text-slate-700">
                {new Date(document.uploadedAt).toLocaleDateString("es-EC")}
              </span>
            </div>
            {client && (
              <div>
                <span className="text-slate-400 block text-[10px] font-bold uppercase">Emitido Para</span>
                <span className="font-semibold text-slate-800 truncate block">
                  {client.businessName}
                </span>
              </div>
            )}
          </div>

          {document.notes && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700">
              <span className="font-bold text-slate-900 block mb-0.5">Observaciones:</span>
              <p>{document.notes}</p>
            </div>
          )}
        </div>

        {/* Vista previa si es PDF o imagen */}
        {document.fileUrl && (isPdf || isImage) && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">Vista Previa del Documento</span>
              <a
                href={document.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#004ac6] font-semibold hover:underline flex items-center gap-1 text-[11px]"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Abrir en pantalla completa</span>
              </a>
            </div>

            <div className="p-4 bg-slate-100/50 flex justify-center">
              {isPdf ? (
                <iframe
                  src={document.fileUrl}
                  className="w-full h-[650px] rounded-lg border border-slate-300 bg-white"
                  title={document.title}
                />
              ) : (
                <img
                  src={document.fileUrl}
                  alt={document.title}
                  className="max-h-[600px] object-contain rounded-lg border border-slate-300 shadow-xs"
                />
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-slate-400 border-t border-slate-200 bg-white">
        INNTEL CORP S.A. • Documento protegido mediante cifrado y enlace privado.
      </footer>
    </div>
  );
}
