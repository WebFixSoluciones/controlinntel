"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useApp } from "@/lib/state";
import { Search, Users, ShieldCheck, Radio, X } from "lucide-react";

export function QuickSearchModal() {
  const { isSearchOpen, setIsSearchOpen, searchQuery, setSearchQuery, clients, nodes, policies } = useApp();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen(!isSearchOpen);
      }
      if (e.key === "Escape" && isSearchOpen) {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSearchOpen, setIsSearchOpen]);

  if (!isSearchOpen) return null;

  const q = searchQuery.toLowerCase().trim();

  const filteredClients = clients.filter(
    (c) => c.businessName.toLowerCase().includes(q) || c.identificationNumber.includes(q)
  );

  const filteredNodes = nodes.filter(
    (n) => n.name.toLowerCase().includes(q) || n.address.toLowerCase().includes(q) || (n.mikrotikIp && n.mikrotikIp.includes(q))
  );

  const filteredPolicies = policies.filter(
    (p) => p.policyNumber.toLowerCase().includes(q) || p.insuranceCompany.toLowerCase().includes(q)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-lumina-dropdown border border-[#e2e8f0] overflow-hidden flex flex-col max-h-[80vh]">
        <div className="p-4 border-b border-[#e2e8f0] flex items-center gap-3 bg-[#f8f9ff]">
          <Search className="w-5 h-5 text-[#737686]" />
          <input
            type="text"
            autoFocus
            placeholder="Escribe RUC, nombre de cliente, IP de nodo o póliza ARCOTEL..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent border-none text-sm font-medium text-[#0b1c30] placeholder:text-[#737686] focus:outline-hidden"
          />
          <button
            onClick={() => setIsSearchOpen(false)}
            className="p-1 rounded-lg text-[#737686] hover:text-[#0b1c30] hover:bg-[#eff4ff] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4 flex-1 text-xs">
          {filteredClients.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[#737686] font-bold uppercase tracking-wider text-[10px] mb-2">
                <Users className="w-3.5 h-3.5 text-[#004ac6]" /> Clientes ({filteredClients.length})
              </div>
              <div className="space-y-1.5">
                {filteredClients.slice(0, 4).map((c) => (
                  <Link
                    key={c.id}
                    href="/clientes"
                    onClick={() => setIsSearchOpen(false)}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-[#eff4ff] border border-transparent hover:border-[#cbdbf5] transition-colors group"
                  >
                    <div>
                      <p className="font-bold text-[#0b1c30] group-hover:text-[#004ac6]">{c.businessName}</p>
                      <p className="text-[#737686] text-[11px]">
                        {c.identificationType}: {c.identificationNumber} • {c.phone}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#eff4ff] text-[#004ac6]">
                      {c.status.toUpperCase()}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {filteredNodes.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[#737686] font-bold uppercase tracking-wider text-[10px] mb-2">
                <Radio className="w-3.5 h-3.5 text-[#10B981]" /> Nodos & Red ({filteredNodes.length})
              </div>
              <div className="space-y-1.5">
                {filteredNodes.map((n) => (
                  <Link
                    key={n.id}
                    href="/red"
                    onClick={() => setIsSearchOpen(false)}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-[#eff4ff] border border-transparent hover:border-[#cbdbf5] transition-colors group"
                  >
                    <div>
                      <p className="font-bold text-[#0b1c30] group-hover:text-[#004ac6]">{n.name}</p>
                      <p className="text-[#737686] text-[11px]">MikroTik: {n.mikrotikIp || "N/A"} • {n.upstreamProvider}</p>
                    </div>
                    <span className="text-[11px] font-semibold text-[#434655]">
                      {n.usedCapacityMbps} / {n.totalCapacityMbps} Mbps
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {filteredPolicies.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[#737686] font-bold uppercase tracking-wider text-[10px] mb-2">
                <ShieldCheck className="w-3.5 h-3.5 text-[#712ae2]" /> Pólizas ARCOTEL ({filteredPolicies.length})
              </div>
              <div className="space-y-1.5">
                {filteredPolicies.map((p) => (
                  <Link
                    key={p.id}
                    href="/arcotel"
                    onClick={() => setIsSearchOpen(false)}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-[#eff4ff] border border-transparent hover:border-[#cbdbf5] transition-colors group"
                  >
                    <div>
                      <p className="font-bold text-[#0b1c30] group-hover:text-[#004ac6]">{p.policyNumber}</p>
                      <p className="text-[#737686] text-[11px]">{p.insuranceCompany} • Vence: {p.expirationDate}</p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        p.status === "por_vencer"
                          ? "bg-amber-100 text-amber-800"
                          : p.status === "vigente"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {p.status.toUpperCase()}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
