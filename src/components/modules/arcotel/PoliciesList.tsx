"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { ArcotelPolicy } from "@/types";
import { ShieldCheck, Plus, Download, AlertTriangle, FileText, CheckCircle2, Clock } from "lucide-react";
import { generateArcotelRenewalLetterDocx, triggerBrowserDownload } from "@/lib/doc-generator";

interface PoliciesListProps {
  onOpenNewModal: () => void;
}

export function PoliciesList({ onOpenNewModal }: PoliciesListProps) {
  const { policies } = useApp();
  const { showSuccess, showError } = useToast();

  const handleDownloadRenewal = async (policy: ArcotelPolicy) => {
    try {
      const blob = await generateArcotelRenewalLetterDocx(policy);
      triggerBrowserDownload(blob, `Oficio_Renovacion_${policy.policyNumber}.docx`);
      showSuccess("Oficio Generado", `Borrador oficial para ARCOTEL descargado en Word (.docx).`);
    } catch (e) {
      showError("Error de Descarga", "No se pudo generar el archivo Word.");
    }
  };

  return (
    <div className="space-y-6 select-none">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-sky-600" />
            Control Regulatorio de Pólizas & Títulos ARCOTEL
          </h2>
          <p className="text-xs text-slate-400">
            Seguimiento de garantías de fiel cumplimiento, responsabilidad civil y renovaciones periódicas
          </p>
        </div>

        <button
          onClick={onOpenNewModal}
          className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Póliza</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {policies.map((p) => {
          const isUrgent = p.status === "por_vencer";
          const isExpired = p.status === "vencida";

          return (
            <div
              key={p.id}
              className={`p-5 rounded-2xl bg-white border flex flex-col justify-between transition-all shadow-xs hover:shadow-md ${
                isUrgent
                  ? "border-amber-300 ring-2 ring-amber-100"
                  : isExpired
                  ? "border-rose-200"
                  : "border-slate-200/80"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      isUrgent
                        ? "bg-amber-100 text-amber-800"
                        : isExpired
                        ? "bg-rose-100 text-rose-800"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {p.status.replace("_", " ")}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-400">{p.titleGrantCode || "SAI-2026"}</span>
                </div>

                <h3 className="font-bold text-sm text-slate-900 mt-3">{p.policyNumber}</h3>
                <p className="text-xs text-slate-500 font-medium">{p.insuranceCompany}</p>

                <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tipo de Cobertura:</span>
                    <span className="font-bold text-slate-800 uppercase text-[11px]">
                      {p.policyType.replace("_", " ")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Monto Asegurado:</span>
                    <span className="font-bold text-emerald-700 font-mono">
                      ${p.insuredAmount.toLocaleString("es-EC", { minimumFractionDigits: 2 })} USD
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Fecha Vencimiento:</span>
                    <span className={`font-bold ${isUrgent ? "text-amber-700" : isExpired ? "text-rose-600" : "text-slate-800"}`}>
                      {p.expirationDate}
                    </span>
                  </div>
                </div>

                {p.notes && <p className="text-[11px] text-slate-500 italic mt-3 bg-slate-50 p-2 rounded-lg">{p.notes}</p>}
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {p.daysUntilExpiration > 0 ? `Quedan ${p.daysUntilExpiration} días` : "Expirada"}
                </span>

                <button
                  onClick={() => handleDownloadRenewal(p)}
                  className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-sky-200"
                >
                  <Download className="w-3.5 h-3.5" />
                  Oficio ARCOTEL
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
