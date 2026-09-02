"use client";

import React from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { ArcotelPolicy } from "@/types";
import { ShieldCheck, Plus, Download, AlertTriangle, Clock } from "lucide-react";
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
          <h1 className="text-2xl font-bold text-[#0b1c30] tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-[#004ac6]" />
            Control Regulatorio de Pólizas & Títulos ARCOTEL
          </h1>
          <p className="text-xs text-[#737686] mt-0.5">
            Seguimiento de garantías de fiel cumplimiento, responsabilidad civil y renovaciones periódicas
          </p>
        </div>

        <button
          onClick={onOpenNewModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Póliza</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {policies.map((p) => {
          const isUrgent = p.status === "por_vencer";
          const isExpired = p.status === "vencida";

          return (
            <div
              key={p.id}
              className={`p-6 rounded-2xl bg-white border flex flex-col justify-between transition-all shadow-lumina-card ${
                isUrgent
                  ? "border-amber-300 ring-2 ring-amber-100 border-l-4 border-l-amber-500"
                  : isExpired
                  ? "border-rose-200 border-l-4 border-l-rose-500"
                  : "border-[#e2e8f0]"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      isUrgent
                        ? "bg-amber-100 text-amber-800 border border-amber-200"
                        : isExpired
                        ? "bg-rose-100 text-rose-800 border border-rose-200"
                        : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    }`}
                  >
                    {p.status.replace("_", " ")}
                  </span>
                  <span className="text-xs font-mono font-bold text-[#737686]">{p.titleGrantCode || "SAI-2026"}</span>
                </div>

                <h3 className="font-bold text-sm text-[#0b1c30] mt-3">{p.policyNumber}</h3>
                <p className="text-xs text-[#737686] font-medium">{p.insuranceCompany}</p>

                <div className="mt-4 p-3.5 rounded-xl bg-[#f8f9ff] border border-[#e2e8f0] space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#737686]">Tipo de Cobertura:</span>
                    <span className="font-bold text-[#0b1c30] uppercase text-[11px]">
                      {p.policyType.replace("_", " ")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#737686]">Monto Asegurado:</span>
                    <span className="font-bold text-[#004ac6] font-mono">
                      ${p.insuredAmount.toLocaleString("es-EC", { minimumFractionDigits: 2 })} USD
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#737686]">Fecha Vencimiento:</span>
                    <span className={`font-bold ${isUrgent ? "text-amber-700" : isExpired ? "text-rose-600" : "text-[#0b1c30]"}`}>
                      {p.expirationDate}
                    </span>
                  </div>
                </div>

                {p.notes && <p className="text-[11px] text-[#737686] italic mt-3 bg-[#f8f9ff] p-2.5 rounded-lg border border-[#e2e8f0]">{p.notes}</p>}
              </div>

              <div className="mt-5 pt-3 border-t border-[#f1f5f9] flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#737686] flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {p.daysUntilExpiration > 0 ? `Quedan ${p.daysUntilExpiration} días` : "Expirada"}
                </span>

                <button
                  onClick={() => handleDownloadRenewal(p)}
                  className="px-3 py-1.5 bg-[#eff4ff] hover:bg-[#dce9ff] text-[#004ac6] rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-[#dce9ff]"
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
