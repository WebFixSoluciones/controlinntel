"use client";

import React from "react";
import { useApp } from "@/lib/state";
import { Network, Server } from "lucide-react";

export function IpPoolsManager() {
  const { ipPools } = useApp();

  return (
    <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs select-none">
      <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-3">
        <Network className="w-4 h-4 text-sky-600" />
        Gestión de Subredes & Pools de Direccionamiento IP (IPv4 / IPv6)
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {ipPools.map((pool) => (
          <div key={pool.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase bg-white border border-slate-200 text-slate-700">
              {pool.type.replace("_", " ")}
            </span>
            <h4 className="font-bold text-slate-800 text-xs mt-2">{pool.name}</h4>
            <p className="font-mono font-bold text-sky-700 mt-1">{pool.subnetCidr}</p>
            <div className="mt-2 text-[11px] text-slate-500 flex justify-between">
              <span>Gateway:</span>
              <span className="font-mono font-bold">{pool.gateway}</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500 flex justify-between">
              <span>Asignadas:</span>
              <span className="font-bold text-emerald-700">{pool.assignedIpsCount} / {pool.usableIpsCount} IPs</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
