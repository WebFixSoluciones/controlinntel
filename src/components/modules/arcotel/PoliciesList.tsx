"use client";

import React from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { ShieldCheck, Plus, Clock, Trash2 } from "lucide-react";
import { getEcuadorDate, diffInCalendarDays } from "@/lib/date-utils";

interface PoliciesListProps {
  onOpenNewModal: () => void;
}

export function PoliciesList({ onOpenNewModal }: PoliciesListProps) {
  const { policies, deletePolicy } = useApp();
  const { showConfirm, showSuccess, showError } = useToast();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1c30] tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-[#004ac6]" />
            Control Regulatorio de Pólizas & Títulos ARCOTEL
          </h1>
        </div>

        <button
          onClick={onOpenNewModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Póliza</span>
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#e2e8f0] bg-white shadow-2xs">
        <table className="table-fixed w-full text-left text-xs border-collapse">
          <caption className="sr-only">Pólizas y garantías registradas para control ARCOTEL</caption>
          <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-xs uppercase tracking-wider border-b border-[#e2e8f0]">
            <tr>
              <th scope="col" className="px-5 py-3.5 font-bold w-[20%]">Póliza / Código</th>
              <th scope="col" className="px-5 py-3.5 font-bold w-[18%]">Aseguradora</th>
              <th scope="col" className="px-5 py-3.5 font-bold w-[16%]">Cobertura</th>
              <th scope="col" className="px-5 py-3.5 font-bold w-[14%]">Monto asegurado</th>
              <th scope="col" className="px-5 py-3.5 font-bold w-[14%]">Vencimiento</th>
              <th scope="col" className="px-5 py-3.5 font-bold w-[10%]">Estado</th>
              <th scope="col" className="px-5 py-3.5 font-bold w-[8%] text-right">Acciones</th>
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
              const daysLeft = diffInCalendarDays(getEcuadorDate(), p.expirationDate);
              const dynamicStatus: "vencida" | "por_vencer" | "vigente" =
                daysLeft < 0 ? "vencida" : daysLeft <= 30 ? "por_vencer" : "vigente";
              const isUrgent = dynamicStatus === "por_vencer";
              const isExpired = dynamicStatus === "vencida";

              return (
                <tr
                  key={p.id}
                  className={`hover:bg-[#f8f9ff] transition-colors ${
                    isUrgent ? "border-l-4 border-l-amber-500" : isExpired ? "border-l-4 border-l-rose-500" : ""
                  }`}
                >
                  <th scope="row" className="px-5 py-4 font-normal text-left">
                    <div className="font-bold text-slate-900">{p.policyNumber}</div>
                    <div className="mt-0.5 font-mono text-[10px] font-bold text-[#737686]">{p.titleGrantCode || "SAI-2026"}</div>
                  </th>
                  <td className="px-5 py-4 font-semibold text-slate-700">{p.insuranceCompany}</td>
                  <td className="px-5 py-4 font-bold uppercase text-[11px] text-slate-600">{p.policyType.replace("_", " ")}</td>
                  <td className="px-5 py-4 font-mono font-bold tabular-nums text-[#004ac6]">
                    ${p.insuredAmount.toLocaleString("es-EC", { minimumFractionDigits: 2 })} USD
                  </td>
                  <td className={`px-5 py-4 font-bold ${isUrgent ? "text-amber-700" : isExpired ? "text-rose-600" : "text-[#0b1c30]"}`}>
                    <div>{p.expirationDate}</div>
                    <div className="mt-0.5 flex items-center gap-1 text-[10px] text-[#737686]">
                      <Clock className="size-3" />
                      {daysLeft < 0
                        ? `Vencida hace ${Math.abs(daysLeft)} días`
                        : daysLeft === 0
                        ? "Vence hoy"
                        : `Quedan ${daysLeft} días`}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex rounded-md border px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                      isUrgent
                        ? "border-amber-200 bg-amber-50 text-amber-800"
                        : isExpired
                        ? "border-rose-200 bg-rose-50 text-rose-800"
                        : "border-emerald-200 bg-emerald-50 text-emerald-800"
                    }`}>
                      {dynamicStatus.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        showConfirm(
                          "¿Eliminar Póliza?",
                          `¿Deseas eliminar la póliza ${p.policyNumber}? Esta acción no se puede deshacer.`,
                          async () => {
                            try {
                              await deletePolicy(p.id);
                              showSuccess("Póliza Eliminada", `La póliza ${p.policyNumber} fue eliminada.`);
                            } catch {
                              showError("Error", "No se pudo eliminar la póliza.");
                            }
                          },
                          "Eliminar"
                        )
                      }
                      className="p-1.5 rounded-lg text-[#737686] hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                      title="Eliminar póliza"
                    >
                      <Trash2 className="w-4 h-4" />
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
