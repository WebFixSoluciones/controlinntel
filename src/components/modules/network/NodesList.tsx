"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { validateIpv4OrCidr } from "@/lib/validation-engine";
import { Radio, Plus, CheckCircle2, X } from "lucide-react";

export function NodesList() {
  const { nodes, addNode } = useApp();
  const { showError, showSuccess } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [upstreamProvider, setUpstreamProvider] = useState("Telconet Latam (5 Gbps)");
  const [totalCapacityMbps, setTotalCapacityMbps] = useState(3000);
  const [mikrotikIp, setMikrotikIp] = useState("10.50.1.1");

  const handleCreate = (e: React.FormEvent) => {
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

    addNode({
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {nodes.map((n) => {
          const usagePercent = Math.round((n.usedCapacityMbps / n.totalCapacityMbps) * 100);
          const isHighUsage = usagePercent > 80;

          return (
            <div
              key={n.id}
              className="p-6 rounded-2xl bg-white border border-[#e2e8f0] shadow-lumina-card flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      n.status === "online"
                        ? "bg-[#ecfdf5] text-[#065f46] border border-[#a7f3d0]"
                        : "bg-[#fffbeb] text-[#92400e] border border-[#fde68a]"
                    }`}
                  >
                    {n.status.toUpperCase()}
                  </span>
                  <span className="font-mono text-xs font-semibold text-[#0b1c30] bg-[#f8f9ff] px-2.5 py-0.5 rounded-md border border-[#e2e8f0]">
                    RouterOS: {n.mikrotikIp || "N/A"}
                  </span>
                </div>

                <h3 className="font-bold text-base text-[#0b1c30] mt-3">{n.name}</h3>
                <p className="text-xs text-[#737686] font-medium">{n.address}</p>
                <p className="text-[11px] text-[#004ac6] font-bold mt-1">Proveedor: {n.upstreamProvider}</p>

                <div className="mt-4 space-y-1.5">
                  <div className="flex justify-between text-xs font-bold font-tnum">
                    <span className="text-[#737686]">Capacidad de Tráfico:</span>
                    <span className={isHighUsage ? "text-[#ef4444]" : "text-[#0b1c30]"}>
                      {n.usedCapacityMbps} / {n.totalCapacityMbps} Mbps ({usagePercent}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#f1f5f9] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isHighUsage ? "bg-[#ef4444]" : "bg-[#10B981]"
                      }`}
                      style={{ width: `${usagePercent}%` }}
                    />
                  </div>
                </div>

                {n.notes && <p className="text-[11px] text-[#737686] italic mt-3 bg-[#f8f9ff] p-2.5 rounded-lg border border-[#e2e8f0]">{n.notes}</p>}
              </div>

              <div className="mt-5 pt-3 border-t border-[#f1f5f9] flex items-center justify-between text-xs">
                <span className="font-bold text-[#434655]">
                  {n.activeClientsCount} abonados activos
                </span>
                <span className="text-[#059669] font-bold flex items-center gap-1 text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Enlace Troncal Estable
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-lumina-dropdown border border-[#e2e8f0] overflow-hidden">
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
