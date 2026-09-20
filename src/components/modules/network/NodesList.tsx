"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { validateIpv4OrCidr } from "@/lib/validation-engine";
import { Radio, Plus, X } from "lucide-react";

export function NodesList() {
  const { nodes, addNode } = useApp();
  const { showError, showSuccess } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [upstreamProvider, setUpstreamProvider] = useState("Telconet Latam (5 Gbps)");
  const [totalCapacityMbps, setTotalCapacityMbps] = useState(3000);
  const [mikrotikIp, setMikrotikIp] = useState("10.50.1.1");

  const handleCreate = async (e: React.FormEvent) => {
    try {

    e.preventDefault();

    if (!name || name.trim().length < 3) {
      showError("Nombre de Nodo Inválido", "Ingresa un nombre descriptivo para el POP.");
      return;
    }

    if (!address || address.trim().length < 5) {
      showError("Ubicación Inválida", "Especifica la dirección física del nodo/torre.");
      return;
    }

    const ipVal = validateIpv4OrCidr(mikrotikIp);
    if (!ipVal.isValid) {
      showError("Dirección IP Inválida", ipVal.error || "La IP del Router MikroTik no tiene un formato válido.");
      return;
    }

    if (totalCapacityMbps <= 0) {
      showError("Capacidad Inválida", "La capacidad total en Mbps debe ser mayor a cero.");
      return;
    }

    await addNode({
      name,
      address,
      upstreamProvider,
      totalCapacityMbps: Number(totalCapacityMbps),
      usedCapacityMbps: Math.floor(Number(totalCapacityMbps) * 0.4),
      mikrotikIp,
      status: "online",
      activeClientsCount: 0,
      notes: "Nuevo POP instalado",
    });

    showSuccess("Nodo Registrado", `POP ${name} incorporado a la topología de red.`);
    setIsModalOpen(false);
    setName("");
    setAddress("");
  
    } catch (error) { window.dispatchEvent(new CustomEvent("inntel:error", { detail: error instanceof Error ? error.message : "No se pudo guardar." })); }
};

  return (
    <div className="space-y-6 select-none">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1c30] tracking-tight flex items-center gap-2">
            <Radio className="w-6 h-6 text-[#004ac6]" />
            Infraestructura Multi-Nodo & MikroTik RouterOS
          </h1>
          <p className="text-xs text-[#737686] mt-0.5">
            Control de POPs, capacidades contratadas de tránsito IP y concentradores PPPoE
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Nodo / POP</span>
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[#e2e8f0] bg-white shadow-lumina-card">
        <table className="min-w-[1050px] w-full text-left text-xs">
          <caption className="sr-only">Nodos de infraestructura registrados</caption>
          <thead className="bg-[#f8f9ff] text-[10px] uppercase tracking-wide text-[#737686]">
            <tr>
              <th scope="col" className="px-5 py-3 font-bold">Estado</th>
              <th scope="col" className="px-5 py-3 font-bold">Nodo / Ubicación</th>
              <th scope="col" className="px-5 py-3 font-bold">Proveedor</th>
              <th scope="col" className="px-5 py-3 font-bold">RouterOS</th>
              <th scope="col" className="px-5 py-3 font-bold">Capacidad</th>
              <th scope="col" className="px-5 py-3 text-right font-bold">Abonados</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9] text-[#0b1c30]">
            {nodes.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-xs italic text-[#737686]">
                  No hay nodos registrados aún.
                </td>
              </tr>
            ) : nodes.map((n) => {
              const usagePercent = Math.round((n.usedCapacityMbps / n.totalCapacityMbps) * 100);
              const isHighUsage = usagePercent > 80;

              return (
                <tr key={n.id} className="hover:bg-[#f8f9ff]">
                  <td className="px-5 py-4">
                    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                      n.status === "online"
                        ? "border-[#a7f3d0] bg-[#ecfdf5] text-[#065f46]"
                        : "border-[#fde68a] bg-[#fffbeb] text-[#92400e]"
                    }`}>
                      {n.status.toUpperCase()}
                    </span>
                  </td>
                  <th scope="row" className="px-5 py-4">
                    <div className="font-bold">{n.name}</div>
                    <div className="mt-0.5 max-w-xs text-[11px] font-medium text-[#737686]">{n.address}</div>
                    {n.notes && <div className="mt-1 max-w-xs truncate text-[10px] italic text-[#737686]">{n.notes}</div>}
                  </th>
                  <td className="px-5 py-4 font-semibold text-[#004ac6]">{n.upstreamProvider}</td>
                  <td className="px-5 py-4 font-mono font-semibold">{n.mikrotikIp || "N/A"}</td>
                  <td className="px-5 py-4">
                    <div className={`font-bold ${isHighUsage ? "text-[#ef4444]" : "text-[#0b1c30]"}`}>
                      {n.usedCapacityMbps} / {n.totalCapacityMbps} Mbps ({usagePercent}%)
                    </div>
                    <div className="mt-1 h-2 w-40 overflow-hidden rounded-full bg-[#f1f5f9]">
                      <div
                        className={`h-full rounded-full ${isHighUsage ? "bg-[#ef4444]" : "bg-[#10B981]"}`}
                        style={{ width: `${Math.min(usagePercent, 100)}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right font-bold tabular-nums">{n.activeClientsCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-lumina-dropdown border border-[#e2e8f0] overflow-hidden">
            <div className="p-4 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8f9ff]">
              <h3 className="font-bold text-[#0b1c30] text-sm">Registrar Nuevo Nodo / POP</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 rounded-lg text-[#737686] hover:text-[#0b1c30] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-4 space-y-3 text-xs">
              <div>
                <label className="font-bold text-[#434655] block mb-1">Nombre del Nodo *</label>
                <input
                  type="text"
                  required
                  placeholder="Nodo Centro Histórico (Torre Panecillo)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 font-semibold text-[#0b1c30]"
                />
              </div>
              <div>
                <label className="font-bold text-[#434655] block mb-1">Ubicación / Dirección *</label>
                <input
                  type="text"
                  required
                  placeholder="Cima del Panecillo, Caseta No. 4"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 text-[#0b1c30]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#434655] block mb-1">Capacidad (Mbps)</label>
                  <input
                    type="number"
                    required
                    value={totalCapacityMbps}
                    onChange={(e) => setTotalCapacityMbps(Number(e.target.value))}
                    className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 font-bold text-[#004ac6]"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#434655] block mb-1">IP Router MikroTik *</label>
                  <input
                    type="text"
                    required
                    placeholder="10.50.1.1"
                    value={mikrotikIp}
                    onChange={(e) => setMikrotikIp(e.target.value)}
                    className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 font-mono font-bold text-[#0b1c30]"
                  />
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2 border-t border-[#e2e8f0]">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-[#737686] hover:bg-[#f8f9ff] rounded-lg font-bold cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-lg font-bold shadow-xs cursor-pointer">
                  Guardar Nodo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
