"use client";

import React from "react";
import Link from "next/link";
import { useApp } from "@/lib/state";
import { ShieldCheck, AlertTriangle, ArrowRight, Download, FileText } from "lucide-react";
import { generateArcotelRenewalLetterDocx, triggerBrowserDownload } from "@/lib/doc-generator";

export function ExpirationsTimeline() {
  const { policies } = useApp();

  const handleDownloadRenewal = async (policy: any) => {
    try {
      const blob = await generateArcotelRenewalLetterDocx(policy);
      triggerBrowserDownload(blob, `Oficio_Renovacion_${policy.policyNumber}.docx`);
    } catch (e) {
      alert("Error al generar el oficio de renovación");
    }
  };

  return (
    <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col select-none">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            Control de Vencimientos ARCOTEL
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-sky-100 text-sky-800">
              Regulación SAI
            </span>
          </h3>
          <p className="text-[11px] text-slate-400">Monitoreo de pólizas de fiel cumplimiento y títulos habilitantes</p>
        </div>
        <Link
          href="/arcotel"
          className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1 hover:underline"
        >
          Ver Módulo <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="mt-4 space-y-3">
        {policies.map((p) => (
          <div
            key={p.id}
            className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
              p.status === "por_vencer"
                ? "bg-amber-50/60 border-amber-200"
                : p.status === "vigente"
                ? "bg-slate-50/60 border-slate-200"
                : "bg-rose-50/60 border-rose-200"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  p.status === "por_vencer"
                    ? "bg-amber-100 text-amber-700"
                    : p.status === "vigente"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-rose-100 text-rose-700"
                }`}
              >
                {p.status === "por_vencer" ? (
                  <AlertTriangle className="w-4 h-4 animate-bounce" />
                ) : (
                  <ShieldCheck className="w-4 h-4" />
                )}
              </div>
              <div>
                <p className="font-bold text-xs text-slate-800">{p.policyNumber}</p>
                <p className="text-[11px] text-slate-500">
                  {p.insuranceCompany} • Cobertura: ${p.insuredAmount.toLocaleString("es-EC")} USD
                </p>
                <p className="text-[10px] font-semibold text-slate-600 mt-0.5">
                  Vence: <span className="font-bold">{p.expirationDate}</span> ({p.daysUntilExpiration > 0 ? `Quedan ${p.daysUntilExpiration} días` : "Vencida"})
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDownloadRenewal(p)}
                className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-sky-700 border border-slate-200 text-[11px] font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer"
                title="Generar Oficio Formal de Renovación en Word"
              >
                <Download className="w-3 h-3" />
                Oficio ARCOTEL
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
