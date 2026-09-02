"use client";

import React from "react";
import { useApp } from "@/lib/state";
import { Network } from "lucide-react";

export function IpPoolsManager() {
  const { ipPools } = useApp();

  return (
    <div className="p-6 rounded-2xl bg-white border border-[#e2e8f0] shadow-lumina-card select-none">
      <h3 className="font-bold text-[#0b1c30] text-sm flex items-center gap-2 mb-4">
        <Network className="w-4 h-4 text-[#004ac6]" />
        Gestión de Subredes & Pools de Direccionamiento IP (IPv4 / IPv6)
      </h3>
      {ipPools.length === 0 ? (
        <div className="py-6 text-center text-xs text-[#737686] italic bg-[#f8f9ff] rounded-xl border border-[#e2e8f0]">
          No hay pools o subredes IP configuradas aún.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {ipPools.map((pool) => (
            <div key={pool.id} className="p-4 rounded-xl bg-[#f8f9ff] border border-[#e2e8f0] text-xs">
              <span className="px-2.5 py-0.5 rounded-md text-[9px] font-bold uppercase bg-white border border-[#cbd5e1] text-[#434655]">
                {pool.type.replace("_", " ")}
              </span>
              <h4 className="font-bold text-[#0b1c30] text-xs mt-2">{pool.name}</h4>
              <p className="font-mono font-bold text-[#004ac6] mt-1">{pool.subnetCidr}</p>
              <div className="mt-2 text-[11px] text-[#737686] flex justify-between">
                <span>Gateway:</span>
                <span className="font-mono font-bold text-[#0b1c30]">{pool.gateway}</span>
              </div>
              <div className="mt-1 text-[11px] text-[#737686] flex justify-between">
                <span>Asignadas:</span>
                <span className="font-bold text-[#10B981]">{pool.assignedIpsCount} / {pool.usableIpsCount} IPs</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
