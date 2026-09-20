"use client";

import React from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { ArcotelPolicy } from "@/types";
import { ShieldCheck, Plus, Download, Clock } from "lucide-react";
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

      <div className="overflow-x-auto rounded-2xl border border-[#e2e8f0] bg-white shadow-lumina-card">
        <table className="min-w-[1150px] w-full text-left text-xs">
          <caption className="sr-only">Pólizas y garantías registradas para control ARCOTEL</caption>
          <thead className="bg-[#f8f9ff] text-[10px] uppercase tracking-wide text-[#737686]">
            <tr>
              <th scope="col" className="px-5 py-3 font-bold">Póliza / Código</th>
              <th scope="col" className="px-5 py-3 font-bold">Aseguradora</th>
              <th scope="col" className="px-5 py-3 font-bold">Cobertura</th>
              <th scope="col" className="px-5 py-3 font-bold">Monto asegurado</th>
              <th scope="col" className="px-5 py-3 font-bold">Vencimiento</th>
              <th scope="col" className="px-5 py-3 font-bold">Estado</th>
              <th scope="col" className="px-5 py-3 text-right font-bold">Documento</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9] text-[#0b1c30]">
            {policies.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-xs italic text-[#737686]">
                  No hay pólizas registradas aún. Usa “Registrar Póliza” para añadir la primera.
                </td>
              </tr>
            ) : policies.map((p) => {
              const isUrgent = p.status === "por_vencer";
              const isExpired = p.status === "vencida";

              return (
                <tr
                  key={p.id}
                  className={`hover:bg-[#f8f9ff] ${
                    isUrgent ? "border-l-4 border-l-amber-500" : isExpired ? "border-l-4 border-l-rose-500" : ""
                  }`}
                >
                  <th scope="row" className="px-5 py-4">
                    <div className="font-bold">{p.policyNumber}</div>
                    <div className="mt-0.5 font-mono text-[10px] font-bold text-[#737686]">{p.titleGrantCode || "SAI-2026"}</div>
                  </th>
                  <td className="px-5 py-4 font-semibold">{p.insuranceCompany}</td>
                  <td className="px-5 py-4 font-bold uppercase text-[11px]">{p.policyType.replace("_", " ")}</td>
                  <td className="px-5 py-4 font-mono font-bold tabular-nums text-[#004ac6]">
                    ${p.insuredAmount.toLocaleString("es-EC", { minimumFractionDigits: 2 })} USD
                  </td>
                  <td className={`px-5 py-4 font-bold ${isUrgent ? "text-amber-700" : isExpired ? "text-rose-600" : "text-[#0b1c30]"}`}>
                    <div>{p.expirationDate}</div>
                    <div className="mt-0.5 flex items-center gap-1 text-[10px] text-[#737686]">
                      <Clock className="size-3" />
                      {p.daysUntilExpiration > 0 ? `Quedan ${p.daysUntilExpiration} días` : "Expirada"}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                      isUrgent
                        ? "border-amber-200 bg-amber-100 text-amber-800"
                        : isExpired
                        ? "border-rose-200 bg-rose-100 text-rose-800"
                        : "border-emerald-200 bg-emerald-100 text-emerald-800"
                    }`}>
                      {p.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => void handleDownloadRenewal(p)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#dce9ff] bg-[#eff4ff] px-3 py-1.5 text-xs font-bold text-[#004ac6] hover:bg-[#dce9ff]"
                    >
                      <Download className="size-3.5" />
                      Oficio ARCOTEL
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
