"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useApp } from "@/lib/state";
import { ArrowRight, Globe, ShieldCheck, Clock, Server } from "lucide-react";

export function ExpirationsTimeline() {
  const { policies, hostingDomains } = useApp();
  const [activeTab, setActiveTab] = useState<"arcotel" | "hosting">("hosting");

  const urgentHostingCount = hostingDomains.filter(
    (h) => h.status === "por_vencer" || h.daysUntilExpiration <= 30
  ).length;

  return (
    <div className="p-4 rounded-xl bg-white border border-[#e2e8f0] shadow-2xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-2.5 border-b border-[#f1f5f9]">
          <div className="flex items-center gap-1.5 bg-[#f1f5f9] p-0.5 rounded-lg text-xs font-bold">
            <button
              onClick={() => setActiveTab("hosting")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                activeTab === "hosting"
                  ? "bg-white text-[#004ac6] shadow-xs"
                  : "text-[#737686] hover:text-[#0b1c30]"
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Hosting & Dominios</span>
              {urgentHostingCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("arcotel")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                activeTab === "arcotel"
                  ? "bg-white text-[#004ac6] shadow-xs"
                  : "text-[#737686] hover:text-[#0b1c30]"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Pólizas</span>
            </button>
          </div>
        </div>

        {activeTab === "hosting" ? (
          <div className="mt-3 space-y-2">
            {hostingDomains.length === 0 ? (
              <p className="text-xs text-[#737686] italic py-4 text-center">
                Sin servicios de hosting o dominios por vencer.
              </p>
            ) : (
              hostingDomains.slice(0, 3).map((item) => {
                const isUrgent = item.daysUntilExpiration <= 15;
                const isWarning = item.daysUntilExpiration <= 30;

                return (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-xl bg-[#f8f9ff] border border-[#e2e8f0] flex items-center justify-between gap-2.5 text-xs hover:border-[#bfdbfe] transition"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {item.serviceType === "hosting" ? (
                          <Server className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                        ) : (
                          <Globe className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        )}
                        <span className="font-bold text-[#0b1c30] truncate block">
                          {item.domainOrService}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#737686] truncate mt-0.5">
                        {item.clientName}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isUrgent
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : isWarning
                            ? "bg-amber-50 text-amber-800 border border-amber-200"
                            : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        }`}
                      >
                        <Clock className="w-2.5 h-2.5" />
                        <span>{item.daysUntilExpiration}d</span>
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {policies.length === 0 ? (
              <p className="text-xs text-[#737686] italic py-4 text-center">
                Sin pólizas pendientes.
              </p>
            ) : (
              policies.slice(0, 2).map((p, index) => {
                const isWarning = index === 0 || p.status === "por_vencer";
                return (
                  <div
                    key={p.id}
                    className="p-2.5 rounded-xl bg-[#f8f9ff] border border-[#e2e8f0] flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <span className="font-bold text-[#0b1c30] block">{p.policyNumber}</span>
                      <span className="text-[11px] text-[#737686] block">{p.insuranceCompany}</span>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isWarning
                          ? "bg-amber-50 text-amber-800 border border-amber-200"
                          : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      }`}
                    >
                      {isWarning ? "Por Vencer" : "Vigente"}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      <div className="pt-2.5 border-t border-[#f1f5f9] text-center mt-2.5">
        <Link
          href={activeTab === "hosting" ? "/inventarios?sub=servicios" : "/clientes"}
          className="text-xs font-bold text-[#004ac6] hover:underline inline-flex items-center gap-1"
        >
          <span>Ver todos</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
