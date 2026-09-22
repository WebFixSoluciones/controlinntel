"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { NodeLocation } from "@/types";
import { validateIpv4OrCidr } from "@/lib/validation-engine";
import { IpPoolsManager } from "./IpPoolsManager";
import { PoolsEditor } from "../settings/RecordManager";
import {
  Radio,
  Plus,
  Search,
  RotateCcw,
  Edit2,
  Server,
  Network,
  X,
  AlertCircle,
  Wifi,
  Users,
  Activity,
  Layers,
} from "lucide-react";

export function ClientNodesManager() {
  const { clients, clientServices, nodes, ipPools, addNode, updateNode } = useApp();
  const { showSuccess, showError } = useToast();

  const [activeTab, setActiveTab] = useState<"nodos" | "clientes" | "pools">("nodos");
  const [nodeSearch, setNodeSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [clientSearch, setClientSearch] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<NodeLocation | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  // Form states
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [upstreamProvider, setUpstreamProvider] = useState("Telconet Latam (5 Gbps)");
  const [totalCapacityMbps, setTotalCapacityMbps] = useState(3000);
  const [usedCapacityMbps, setUsedCapacityMbps] = useState(1200);
  const [mikrotikIp, setMikrotikIp] = useState("10.50.1.1");
  const [status, setStatus] = useState<NodeLocation["status"]>("online");
  const [notes, setNotes] = useState("");

  const handleOpenCreateModal = () => {
    setEditingNode(null);
    setName("");
    setAddress("");
    setUpstreamProvider("Telconet Latam (5 Gbps)");
    setTotalCapacityMbps(3000);
    setUsedCapacityMbps(500);
    setMikrotikIp(`10.50.${nodes.length + 1}.1`);
    setStatus("online");
    setNotes("");
    setFormError("");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (node: NodeLocation) => {
    setEditingNode(node);
    setName(node.name);
    setAddress(node.address);
    setUpstreamProvider(node.upstreamProvider);
    setTotalCapacityMbps(node.totalCapacityMbps);
    setUsedCapacityMbps(node.usedCapacityMbps);
    setMikrotikIp(node.mikrotikIp || "");
    setStatus(node.status);
    setNotes(node.notes || "");
    setFormError("");
    setIsModalOpen(true);
  };

  const handleSaveNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    if (!name || name.trim().length < 3) {
      setFormError("Ingresa un nombre descriptivo para el POP (mínimo 3 caracteres).");
      return;
    }

    if (!address || address.trim().length < 4) {
      setFormError("Especifica la ubicación física o caseta del nodo.");
      return;
    }

    const ipVal = validateIpv4OrCidr(mikrotikIp);
    if (!ipVal.isValid) {
      setFormError(ipVal.error || "La IP del Router MikroTik no tiene un formato válido.");
      return;
    }

    if (totalCapacityMbps <= 0) {
      setFormError("La capacidad total debe ser superior a 0 Mbps.");
      return;
    }

    if (usedCapacityMbps < 0 || usedCapacityMbps > totalCapacityMbps) {
      setFormError("La capacidad utilizada debe encontrarse entre 0 y la capacidad total.");
      return;
    }

    setBusy(true);
    setFormError("");

    try {
      if (editingNode) {
        await updateNode(editingNode.id, {
          name: name.trim(),
          address: address.trim(),
          upstreamProvider: upstreamProvider.trim(),
          totalCapacityMbps: Number(totalCapacityMbps),
          usedCapacityMbps: Number(usedCapacityMbps),
          mikrotikIp: mikrotikIp.trim(),
          status,
          notes: notes.trim(),
        });
        showSuccess("Nodo Actualizado", `Configuración de ${name} guardada.`);
      } else {
        await addNode({
          name: name.trim(),
          address: address.trim(),
          upstreamProvider: upstreamProvider.trim(),
          totalCapacityMbps: Number(totalCapacityMbps),
          usedCapacityMbps: Number(usedCapacityMbps),
          mikrotikIp: mikrotikIp.trim(),
          status,
          activeClientsCount: 0,
          notes: notes.trim(),
        });
        showSuccess("Nodo Incorporado", `POP ${name} añadido a la topología de red.`);
      }

      setIsModalOpen(false);
      setEditingNode(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al procesar el nodo.");
      showError("Error", "No se pudo guardar la configuración del nodo.");
    } finally {
      setBusy(false);
    }
  };

  const filteredNodes = nodes.filter((n) => {
    const matchesStatus = !statusFilter || n.status === statusFilter;
    const target = `${n.name} ${n.address} ${n.mikrotikIp || ""} ${n.upstreamProvider}`.toLowerCase();
    const matchesSearch = !nodeSearch.trim() || target.includes(nodeSearch.trim().toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const clientAssociations = clients.map((client) => {
    const service = clientServices.find((s) => s.clientId === client.id);
    const node = service ? nodes.find((n) => n.id === service.nodeId || n.name === service.nodeName) : undefined;
    return {
      client,
      service,
      node,
    };
  }).filter((item) => {
    if (!clientSearch.trim()) return true;
    const target = `${item.client.businessName} ${item.client.identificationNumber} ${item.node?.name || ""} ${item.service?.ipv4Address || ""}`.toLowerCase();
    return target.includes(clientSearch.trim().toLowerCase());
  });

  const renderStatusBadge = (nodeStatus: NodeLocation["status"]) => {
    switch (nodeStatus) {
      case "online":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            En Línea
          </span>
        );
      case "warning":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Alerta
          </span>
        );
      case "offline":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            Fuera de Línea
          </span>
        );
    }
  };

  return (
    <div className="w-full space-y-6 select-none">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#004ac6] to-[#1e293b] flex items-center justify-center text-white shadow-xs">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#0b1c30] tracking-tight">
              Infraestructura Multi-Nodo & Topología de Red
            </h1>
          </div>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Nodo / POP</span>
        </button>
      </div>

      {/* Navigation Ribbon */}
      <div className="flex items-center gap-2 border-b border-[#e2e8f0] pb-2">
        <button
          onClick={() => setActiveTab("nodos")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "nodos"
              ? "bg-[#004ac6] text-white shadow-xs"
              : "bg-white text-[#434655] hover:bg-[#f8f9ff] border border-[#e2e8f0]"
          }`}
        >
          <Server className="w-3.5 h-3.5" />
          <span>Infraestructura de Nodos (POPs)</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeTab === "nodos" ? "bg-white/20 text-white" : "bg-slate-100 text-[#434655]"
            }`}
          >
            {nodes.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("clientes")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "clientes"
              ? "bg-[#004ac6] text-white shadow-xs"
              : "bg-white text-[#434655] hover:bg-[#f8f9ff] border border-[#e2e8f0]"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Nodos por Abonado</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeTab === "clientes" ? "bg-white/20 text-white" : "bg-slate-100 text-[#434655]"
            }`}
          >
            {clients.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("pools")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "pools"
              ? "bg-[#004ac6] text-white shadow-xs"
              : "bg-white text-[#434655] hover:bg-[#f8f9ff] border border-[#e2e8f0]"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Pools IP & Subredes IPv4</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeTab === "pools" ? "bg-white/20 text-white" : "bg-slate-100 text-[#434655]"
            }`}
          >
            {ipPools.length}
          </span>
        </button>
      </div>

      {/* TAB 1: INFRAESTRUCTURA DE NODOS */}
      {activeTab === "nodos" && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="bg-white rounded-2xl border border-[#e2e8f0] p-4 shadow-lumina-card flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="w-4 h-4 text-[#737686] absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar por POP, ubicación, IP o proveedor..."
                  value={nodeSearch}
                  onChange={(e) => setNodeSearch(e.target.value)}
                  className="w-full bg-white text-xs text-[#0b1c30] rounded-xl pl-9 pr-3 py-2 border border-[#cbd5e1] focus:outline-hidden focus:border-[#004ac6] focus:ring-1 focus:ring-[#004ac6]"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-white text-xs font-medium text-[#434655] rounded-xl px-3 py-2 border border-[#cbd5e1] focus:outline-hidden cursor-pointer"
              >
                <option value="">Estado: Todos</option>
                <option value="online">En Línea</option>
                <option value="warning">Alerta</option>
                <option value="offline">Fuera de Línea</option>
              </select>
            </div>

            {(nodeSearch || statusFilter) && (
              <button
                onClick={() => {
                  setNodeSearch("");
                  setStatusFilter("");
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#cbd5e1] text-xs font-semibold text-[#434655] hover:bg-[#f8f9ff] cursor-pointer transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#737686]" />
                <span>Limpiar</span>
              </button>
            )}
          </div>

          {/* Nodes Table Card */}
          <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-lumina-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[1000px]">
                <caption className="sr-only">Nodos de infraestructura registrados</caption>
                <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-[11px] uppercase tracking-wider border-b border-[#e2e8f0]">
                  <tr>
                    <th className="py-3.5 px-5 text-center">Estado</th>
                    <th className="py-3.5 px-5">POP / Ubicación Física</th>
                    <th className="py-3.5 px-5">Proveedor Upstream</th>
                    <th className="py-3.5 px-5">RouterOS MikroTik</th>
                    <th className="py-3.5 px-5">Capacidad / Saturación</th>
                    <th className="py-3.5 px-5 text-center">Abonados</th>
                    <th className="py-3.5 px-5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9] text-[#0b1c30]">
                  {filteredNodes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-xs text-[#737686]">
                        <Radio className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="font-bold text-slate-600">No hay nodos que coincidan con la búsqueda.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredNodes.map((n) => {
                      const usagePercent = Math.round((n.usedCapacityMbps / n.totalCapacityMbps) * 100);
                      const isHighUsage = usagePercent > 80;

                      return (
                        <tr key={n.id} className="hover:bg-[#f8f9ff] transition-colors">
                          <td className="py-4 px-5 text-center">{renderStatusBadge(n.status)}</td>
                          <td className="py-4 px-5">
                            <div className="font-bold text-[#0b1c30] text-sm flex items-center gap-2">
                              <Radio className="w-4 h-4 text-[#004ac6]" />
                              {n.name}
                            </div>
                            <div className="text-[11px] text-[#737686] mt-0.5">{n.address}</div>
                            {n.notes && <div className="text-[10px] text-slate-400 italic mt-0.5">{n.notes}</div>}
                          </td>
                          <td className="py-4 px-5">
                            <span className="font-semibold text-[#004ac6]">{n.upstreamProvider}</span>
                          </td>
                          <td className="py-4 px-5">
                            <span className="font-mono font-bold text-[#0b1c30] bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              {n.mikrotikIp || "Sin IP"}
                            </span>
                          </td>
                          <td className="py-4 px-5">
                            <div className={`font-bold tabular-nums ${isHighUsage ? "text-red-600" : "text-[#0b1c30]"}`}>
                              {n.usedCapacityMbps} / {n.totalCapacityMbps} Mbps ({usagePercent}%)
                            </div>
                            <div className="mt-1 h-2 w-44 overflow-hidden rounded-full bg-[#f1f5f9] border border-slate-100">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  isHighUsage ? "bg-red-500" : usagePercent > 60 ? "bg-amber-500" : "bg-emerald-500"
                                }`}
                                style={{ width: `${Math.min(usagePercent, 100)}%` }}
                              />
                            </div>
                          </td>
                          <td className="py-4 px-5 text-center">
                            <span className="inline-flex items-center gap-1 font-bold font-mono text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
                              <Users className="w-3 h-3 text-[#004ac6]" />
                              {n.activeClientsCount}
                            </span>
                          </td>
                          <td className="py-4 px-5 text-right">
                            <button
                              onClick={() => handleOpenEditModal(n)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold text-[#004ac6] hover:bg-[#eff4ff] rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>Editar</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-3 px-5 border-t border-[#e2e8f0] bg-[#f8f9ff] flex items-center justify-between text-xs text-[#737686]">
              <span>
                Total de POPs activos: <strong className="text-[#0b1c30]">{nodes.length}</strong>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: NODOS POR ABONADO */}
      {activeTab === "clientes" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#e2e8f0] p-4 shadow-lumina-card flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[280px] max-w-md">
              <Search className="w-4 h-4 text-[#737686] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar por abonado, RUC, nodo asignado o IP..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="w-full bg-white text-xs text-[#0b1c30] rounded-xl pl-9 pr-3 py-2 border border-[#cbd5e1] focus:outline-hidden focus:border-[#004ac6] focus:ring-1 focus:ring-[#004ac6]"
              />
            </div>
            {clientSearch && (
              <button
                onClick={() => setClientSearch("")}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#cbd5e1] text-xs font-semibold text-[#434655] hover:bg-[#f8f9ff] cursor-pointer transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#737686]" />
                <span>Limpiar</span>
              </button>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-lumina-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[950px]">
                <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-[11px] uppercase tracking-wider border-b border-[#e2e8f0]">
                  <tr>
                    <th className="py-3.5 px-5">Cliente / Razón Social</th>
                    <th className="py-3.5 px-5">POP / Nodo de Conexión</th>
                    <th className="py-3.5 px-5">Plan de Enlace</th>
                    <th className="py-3.5 px-5">Dirección IPv4</th>
                    <th className="py-3.5 px-5">Ancho de Banda</th>
                    <th className="py-3.5 px-5 text-center">Estado Servicio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9] text-[#0b1c30]">
                  {clientAssociations.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-xs text-[#737686]">
                        No se encontraron clientes asociados a los criterios.
                      </td>
                    </tr>
                  ) : (
                    clientAssociations.map(({ client, service, node }) => (
                      <tr key={client.id} className="hover:bg-[#f8f9ff] transition-colors">
                        <td className="py-4 px-5">
                          <div className="font-bold text-[#0b1c30]">{client.businessName}</div>
                          <div className="text-[10px] text-[#737686] font-mono">{client.identificationNumber}</div>
                        </td>
                        <td className="py-4 px-5">
                          {node ? (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-[#004ac6] border border-blue-200 font-bold text-[11px]">
                              <Radio className="w-3.5 h-3.5" />
                              {node.name}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Sin nodo asignado</span>
                          )}
                        </td>
                        <td className="py-4 px-5">
                          <div className="font-semibold text-[#0b1c30]">{service?.planName || "Sin plan activo"}</div>
                          {service && (
                            <div className="text-[10px] font-mono text-emerald-700 font-bold">
                              ${service.customPrice.toFixed(2)} USD/mes
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-5">
                          {service?.ipv4Address ? (
                            <span className="font-mono font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200 text-[11px]">
                              {service.ipv4Address}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Dinámica / N/A</span>
                          )}
                        </td>
                        <td className="py-4 px-5 font-mono text-[11px]">
                          {service ? (
                            <span className="font-semibold">
                              {service.downloadMbps}M / {service.uploadMbps}M
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-4 px-5 text-center">
                          <span
                            className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              client.status === "activo"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {client.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: POOLS IP & SUBREDES */}
      {activeTab === "pools" && (
        <div className="space-y-6">
          <IpPoolsManager />
          <PoolsEditor />
        </div>
      )}

      {/* Node Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-lumina-dropdown border border-[#e2e8f0] overflow-hidden my-8">
            <div className="p-4 px-6 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8f9ff]">
              <div className="flex items-center gap-2.5">
                <Radio className="w-5 h-5 text-[#004ac6]" />
                <h3 className="font-bold text-[#0b1c30] text-sm">
                  {editingNode ? `Editar Nodo: ${editingNode.name}` : "Registrar Nuevo Nodo / POP"}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-[#737686] hover:text-[#0b1c30] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNode} className="p-6 space-y-4 text-xs">
              <fieldset disabled={busy} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="font-bold text-[#434655] block mb-1">Nombre del Nodo / Caseta *</label>
                  <input
                    required
                    type="text"
                    placeholder="Ej: Nodo Centro Histórico (Torre Panecillo)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-xs font-semibold text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="font-bold text-[#434655] block mb-1">Ubicación Física / Dirección *</label>
                  <input
                    required
                    type="text"
                    placeholder="Ej: Cima del Panecillo, Caseta de Telecomunicaciones No. 4"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-xs font-medium text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="font-bold text-[#434655] block mb-1">Proveedor Upstream *</label>
                  <input
                    required
                    type="text"
                    placeholder="Ej: Telconet Latam (5 Gbps)"
                    value={upstreamProvider}
                    onChange={(e) => setUpstreamProvider(e.target.value)}
                    className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-xs font-medium text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="font-bold text-[#434655] block mb-1">IP Router MikroTik Core *</label>
                  <input
                    required
                    type="text"
                    placeholder="10.50.1.1"
                    value={mikrotikIp}
                    onChange={(e) => setMikrotikIp(e.target.value)}
                    className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#004ac6] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="font-bold text-[#434655] block mb-1">Capacidad Total (Mbps) *</label>
                  <input
                    required
                    type="number"
                    min="1"
                    value={totalCapacityMbps}
                    onChange={(e) => setTotalCapacityMbps(Number(e.target.value))}
                    className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="font-bold text-[#434655] block mb-1">Capacidad Utilizada (Mbps) *</label>
                  <input
                    required
                    type="number"
                    min="0"
                    max={totalCapacityMbps}
                    value={usedCapacityMbps}
                    onChange={(e) => setUsedCapacityMbps(Number(e.target.value))}
                    className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="font-bold text-[#434655] block mb-1">Estado Operativo *</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as NodeLocation["status"])}
                    className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-xs font-semibold text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                  >
                    <option value="online">En Línea (Normal)</option>
                    <option value="warning">Alerta (Alto Consumo)</option>
                    <option value="offline">Fuera de Línea</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-[#434655] block mb-1">Notas / Especificaciones</label>
                  <input
                    type="text"
                    placeholder="Router CCR2004, baterías de respaldo..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-xs font-medium text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                  />
                </div>
              </fieldset>

              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="pt-3 flex justify-end gap-2.5 border-t border-[#e2e8f0]">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 text-[#737686] hover:bg-slate-100 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-5 py-2.5 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-2"
                >
                  {busy ? "Guardando..." : "Guardar Nodo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
