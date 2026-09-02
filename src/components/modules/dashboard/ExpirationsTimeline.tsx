"use client";

import React from "react";
import Link from "next/link";
import { useApp } from "@/lib/state";
import { AlertTriangle, ArrowRight } from "lucide-react";

export function ExpirationsTimeline() {
  const { policies } = useApp();

  return (
    <div className="p-6 rounded-2xl bg-white border border-[#e2e8f0] shadow-lumina-card flex flex-col justify-between select-none">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-[#f1f5f9]">
          <h3 className="font-bold text-sm text-[#0b1c30] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Alertas ARCOTEL
          </h3>
        </div>

        <div className="mt-3 space-y-3">
          {policies.length === 0 ? (
            <p className="text-xs text-[#737686] italic py-4 text-center">No hay alertas de pólizas vigentes.</p>
          ) : (
            policies.slice(0, 2).map((p, index) => {
              const isWarning = index === 0 || p.status === "por_vencer";
              return (
                <div
                  key={p.id}
                  className="p-3 rounded-xl bg-[#f8f9ff] border border-[#e2e8f0] flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <span className="font-bold text-[#0b1c30] block">{p.policyNumber}</span>
                    <span className="text-[11px] text-[#737686] block">{p.insuranceCompany}</span>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      isWarning
                        ? "bg-amber-100 text-amber-800 border border-amber-200"
                        : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    }`}
                  >
                    {isWarning ? "POR VENCER En 20 días" : "VIGENTE En 45 días"}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="pt-3 border-t border-[#f1f5f9] text-center">
        <Link
          href="/arcotel"
          className="text-xs font-bold text-[#004ac6] hover:text-[#2563eb] inline-flex items-center gap-1"
        >
          <span>Ver todas las pólizas</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
