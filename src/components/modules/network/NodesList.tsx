"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { validateIpv4OrCidr, validateMonetaryAmount } from "@/lib/validation-engine";
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
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Radio className="w-5 h-5 text-emerald-600" />
            Infraestructura Multi-Nodo & MikroTik RouterOS
          </h2>
          <p className="text-xs text-slate-400">
            Control de POPs, capacidades contratadas de tránsito IP y concentradores PPPoE
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Nodo / POP</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {nodes.map((n) => {
          const usagePercent = Math.round((n.usedCapacityMbps / n.totalCapacityMbps) * 100);
          const isHighUsage = usagePercent > 80;

          return (
            <div
              key={n.id}
              className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      n.status === "online"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {n.status.toUpperCase()}
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                    RouterOS: {n.mikrotikIp || "N/A"}
                  </span>
                </div>

                <h3 className="font-bold text-sm text-slate-900 mt-3">{n.name}</h3>
                <p className="text-xs text-slate-500 font-medium">{n.address}</p>
                <p className="text-[11px] text-sky-700 font-bold mt-1">Proveedor: {n.upstreamProvider}</p>

                <div className="mt-4 space-y-1.5">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-500">Capacidad de Tráfico:</span>
                    <span className={isHighUsage ? "text-rose-600" : "text-slate-800"}>
                      {n.usedCapacityMbps} / {n.totalCapacityMbps} Mbps ({usagePercent}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isHighUsage ? "bg-rose-500" : "bg-emerald-500"
                      }`}
                      style={{ width: `${usagePercent}%` }}
                    />
                  </div>
                </div>

                {n.notes && <p className="text-[11px] text-slate-400 italic mt-3 bg-slate-50 p-2 rounded-lg">{n.notes}</p>}
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700">
                  {n.activeClientsCount} abonados activos
                </span>
                <span className="text-emerald-700 font-bold flex items-center gap-1 text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Enlace Troncal Estable
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-bold text-slate-900 text-sm">Registrar Nuevo Nodo / POP</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-4 space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nombre del Nodo *</label>
                <input
                  type="text"
                  required
                  placeholder="Nodo Centro Histórico (Torre Panecillo)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Ubicación / Dirección *</label>
                <input
                  type="text"
                  required
                  placeholder="Cima del Panecillo, Caseta No. 4"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Capacidad (Mbps)</label>
                  <input
                    type="number"
                    required
                    value={totalCapacityMbps}
                    onChange={(e) => setTotalCapacityMbps(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">IP Router MikroTik *</label>
                  <input
                    type="text"
                    required
                    placeholder="10.50.1.1"
                    value={mikrotikIp}
                    onChange={(e) => setMikrotikIp(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono font-bold"
                  />
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 font-bold cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-sm cursor-pointer">
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
