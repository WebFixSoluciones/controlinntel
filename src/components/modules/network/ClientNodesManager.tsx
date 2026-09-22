"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { NodeLocation, NodeCarrierProvider, NodeSystemService } from "@/types";
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
  Trash2,
  Globe,
  Key,
  ExternalLink,
  Copy,
  Check,
  Eye,
  EyeOff,
  Shield,
  Info,
} from "lucide-react";

export function ClientNodesManager() {
  const { clients, clientServices, nodes, ipPools, addNode, updateNode, deleteNode } = useApp();
  const { showSuccess, showError, showConfirm } = useToast();

  const [activeTab, setActiveTab] = useState<"nodos" | "clientes" | "pools">("nodos");
  const [nodeSearch, setNodeSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [clientSearch, setClientSearch] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<NodeLocation | null>(null);
  const [detailNode, setDetailNode] = useState<NodeLocation | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [revealedCreds, setRevealedCreds] = useState<Record<string, boolean>>({});

  // Node basic form states
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [mikrotikIp, setMikrotikIp] = useState("10.50.1.1");
  const [status, setStatus] = useState<NodeLocation["status"]>("online");
  const [notes, setNotes] = useState("");
  const [usedCapacityMbps, setUsedCapacityMbps] = useState(1200);

  // Multi-Carrier Providers list (PDF Page 6)
  const [providers, setProviders] = useState<NodeCarrierProvider[]>([
    {
      id: "prov-1",
      providerName: "Telconet Latam",
      capacityMbps: 3000,
      circuitId: "TCO-UIO-9921",
      ipv4Subnet: "181.198.112.112/30",
      ipv6Prefix: "2800:3f0:4000::/48",
    },
  ]);

  // Node Services & Credentials list (PDF Page 6 & 7)
  const [services, setServices] = useState<NodeSystemService[]>([
    {
      id: "srv-1",
      systemName: "MIKROTIK CCR2116-12G-4S+",
      linkOrIp: "181.198.112.112:5258",
      credentials: "admin / InntelRouter2026*",
      notes: "Core BGP Router & CGNAT",
    },
  ]);

  const totalCalculatedCapacity = providers.reduce((sum, p) => sum + (Number(p.capacityMbps) || 0), 0);

  const handleCopyText = (text: string, keyId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyId);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const toggleRevealCred = (id: string) => {
    setRevealedCreds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleOpenCreateModal = () => {
    setEditingNode(null);
    setName("");
    setAddress("");
    setMikrotikIp(`10.50.${nodes.length + 1}.1`);
    setStatus("online");
    setNotes("");
    setUsedCapacityMbps(500);
    setProviders([
      {
        id: "prov-" + Date.now() + "-1",
        providerName: "Telconet Latam",
        capacityMbps: 3000,
        circuitId: "",
        ipv4Subnet: "",
        ipv6Prefix: "",
      },
    ]);
    setServices([
      {
        id: "srv-" + Date.now() + "-1",
        systemName: "MIKROTIK CCR2116-12G-4S+",
        linkOrIp: "181.198.112.112:5258",
        credentials: "",
        notes: "",
      },
    ]);
    setFormError("");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (node: NodeLocation) => {
    setEditingNode(node);
    setName(node.name);
    setAddress(node.address);
    setMikrotikIp(node.mikrotikIp || "");
    setStatus(node.status);
    setNotes(node.notes || "");
    setUsedCapacityMbps(node.usedCapacityMbps || 0);
    setProviders(
      node.providers && node.providers.length > 0
        ? JSON.parse(JSON.stringify(node.providers))
        : [
            {
              id: "prov-" + Date.now(),
              providerName: node.upstreamProvider || "Telconet Latam",
              capacityMbps: node.totalCapacityMbps || 1000,
              circuitId: "",
              ipv4Subnet: "",
              ipv6Prefix: "",
            },
          ]
    );
    setServices(
      node.services && node.services.length > 0
        ? JSON.parse(JSON.stringify(node.services))
        : [
            {
              id: "srv-" + Date.now(),
              systemName: "MIKROTIK CCR2116-12G-4S+",
              linkOrIp: node.mikrotikIp || "",
              credentials: "",
              notes: "",
            },
          ]
    );
    setFormError("");
    setIsModalOpen(true);
  };

  // Provider list actions
  const handleAddProvider = () => {
    setProviders([
      ...providers,
      {
        id: "prov-" + Date.now(),
        providerName: "",
        capacityMbps: 1000,
        circuitId: "",
        ipv4Subnet: "",
        ipv6Prefix: "",
      },
    ]);
  };

  const handleUpdateProvider = (id: string, field: keyof NodeCarrierProvider, val: any) => {
    setProviders(providers.map((p) => (p.id === id ? { ...p, [field]: val } : p)));
  };

  const handleRemoveProvider = (id: string) => {
    if (providers.length <= 1) {
      showError("Aviso", "El nodo debe tener al menos un proveedor upstream.");
      return;
    }
    setProviders(providers.filter((p) => p.id !== id));
  };

  // Services list actions
  const handleAddService = () => {
    setServices([
      ...services,
      {
        id: "srv-" + Date.now(),
        systemName: "",
        linkOrIp: "",
        credentials: "",
        notes: "",
      },
    ]);
  };

  const handleUpdateService = (id: string, field: keyof NodeSystemService, val: any) => {
    setServices(services.map((s) => (s.id === id ? { ...s, [field]: val } : s)));
  };

  const handleRemoveService = (id: string) => {
    setServices(services.filter((s) => s.id !== id));
  };

  const handleDeleteNode = (node: NodeLocation) => {
    showConfirm(
      "¿Eliminar Nodo?",
      `¿Confirmas la eliminación del POP "${node.name}"? Los abonados asignados deberán ser migrados.`,
      async () => {
        try {
          await deleteNode(node.id);
          showSuccess("Nodo Eliminado", `El POP "${node.name}" ha sido retirado de la topología.`);
        } catch (err: any) {
          showError("Error", err?.message || "No se pudo eliminar el nodo.");
        }
      },
      "Eliminar POP"
    );
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

    // Validate providers
    for (let i = 0; i < providers.length; i++) {
      if (!providers[i].providerName.trim()) {
        setFormError(`El Proveedor ${i + 1} requiere un nombre (ej. Telconet, CenturyLink).`);
        return;
      }
      if (Number(providers[i].capacityMbps) <= 0) {
        setFormError(`La capacidad del Proveedor ${i + 1} debe ser mayor a 0 Mbps.`);
        return;
      }
    }

    const finalTotalCapacity = totalCalculatedCapacity > 0 ? totalCalculatedCapacity : 1000;
    const upstreamProviderSummary = providers.map((p) => p.providerName).join(" / ");

    setBusy(true);
    setFormError("");

    try {
      if (editingNode) {
        await updateNode(editingNode.id, {
          name: name.trim(),
          address: address.trim(),
          upstreamProvider: upstreamProviderSummary,
          totalCapacityMbps: finalTotalCapacity,
          usedCapacityMbps: Math.min(Number(usedCapacityMbps), finalTotalCapacity),
          mikrotikIp: mikrotikIp.trim(),
          status,
          notes: notes.trim(),
          providers,
          services,
        });
        showSuccess("Nodo Actualizado", `Topología de ${name} guardada con éxito.`);
      } else {
        await addNode({
          name: name.trim(),
          address: address.trim(),
          upstreamProvider: upstreamProviderSummary,
          totalCapacityMbps: finalTotalCapacity,
          usedCapacityMbps: Math.min(Number(usedCapacityMbps), finalTotalCapacity),
          mikrotikIp: mikrotikIp.trim(),
          status,
          activeClientsCount: 0,
          notes: notes.trim(),
          providers,
          services,
        });
        showSuccess("Nodo Incorporado", `POP ${name} añadido a la infraestructura multi-carrier.`);
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
    const providersText = n.providers?.map((p) => `${p.providerName} ${p.circuitId} ${p.ipv4Subnet}`).join(" ") || "";
    const servicesText = n.services?.map((s) => `${s.systemName} ${s.linkOrIp}`).join(" ") || "";
    const target = `${n.name} ${n.address} ${n.mikrotikIp || ""} ${n.upstreamProvider} ${providersText} ${servicesText}`.toLowerCase();
    const matchesSearch = !nodeSearch.trim() || target.includes(nodeSearch.trim().toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const clientAssociations = clients
    .map((client) => {
      const service = clientServices.find((s) => s.clientId === client.id);
      const node = service ? nodes.find((n) => n.id === service.nodeId || n.name === service.nodeName) : undefined;
      return {
        client,
        service,
        node,
      };
    })
    .filter((item) => {
      if (!clientSearch.trim()) return true;
      const target =
        `${item.client.businessName} ${item.client.identificationNumber} ${item.node?.name || ""} ${item.service?.ipv4Address || ""}`.toLowerCase();
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
              Infraestructura Multi-Nodo & Carrier Transit
            </h1>
          </div>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Nodo / POP Multi-Carrier</span>
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
          <span>Infraestructura Multi-Carrier</span>
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

      {/* TAB 1: INFRAESTRUCTURA MULTI-CARRIER */}
      {activeTab === "nodos" && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="bg-white rounded-2xl border border-[#e2e8f0] p-4 shadow-lumina-card flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="w-4 h-4 text-[#737686] absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar por POP, carrier, circuito, sistema o IP..."
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
              <table className="w-full text-left text-xs min-w-[1100px]">
                <caption className="sr-only">Nodos de infraestructura registrados</caption>
                <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-[11px] uppercase tracking-wider border-b border-[#e2e8f0]">
                  <tr>
                    <th className="py-3.5 px-5 text-center">Estado</th>
                    <th className="py-3.5 px-5">POP / Ubicación</th>
                    <th className="py-3.5 px-5">Proveedores Upstream (Multi-Carrier)</th>
                    <th className="py-3.5 px-5">Sistemas & Credenciales</th>
                    <th className="py-3.5 px-5">Capacidad / Uso</th>
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
                      const carrierList = n.providers && n.providers.length > 0 ? n.providers : [];
                      const systemList = n.services && n.services.length > 0 ? n.services : [];

                      return (
                        <tr key={n.id} className="hover:bg-[#f8f9ff] transition-colors">
                          <td className="py-4 px-5 text-center">{renderStatusBadge(n.status)}</td>
                          <td className="py-4 px-5">
                            <div className="font-bold text-[#0b1c30] text-sm flex items-center gap-2">
                              <Radio className="w-4 h-4 text-[#004ac6]" />
                              {n.name}
                            </div>
                            <div className="text-[11px] text-[#737686] mt-0.5">{n.address}</div>
                            {n.mikrotikIp && (
                              <div className="mt-1">
                                <span className="font-mono text-[10px] font-bold text-[#004ac6] bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                  Router: {n.mikrotikIp}
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="py-4 px-5">
                            {carrierList.length > 0 ? (
                              <div className="space-y-1.5 max-w-sm">
                                {carrierList.map((p, pIdx) => (
                                  <div
                                    key={p.id || pIdx}
                                    className="p-1.5 px-2 bg-slate-50 rounded-lg border border-slate-200/80 text-[11px]"
                                  >
                                    <div className="flex items-center justify-between font-bold text-[#0b1c30]">
                                      <span className="flex items-center gap-1 text-[#004ac6]">
                                        <Globe className="w-3 h-3" />
                                        {p.providerName || "Proveedor " + (pIdx + 1)}
                                      </span>
                                      <span className="font-mono text-[10px] text-slate-700 bg-white px-1.5 py-0.2 rounded border border-slate-200">
                                        {p.capacityMbps} Mbps
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-[#737686] mt-0.5">
                                      {p.circuitId && <span>ID: <strong className="text-slate-700 font-mono">{p.circuitId}</strong></span>}
                                      {p.ipv4Subnet && <span>IPv4: <strong className="text-slate-700 font-mono">{p.ipv4Subnet}</strong></span>}
                                      {p.ipv6Prefix && <span>IPv6: <strong className="text-slate-700 font-mono">{p.ipv6Prefix}</strong></span>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="font-semibold text-[#004ac6]">{n.upstreamProvider}</span>
                            )}
                          </td>
                          <td className="py-4 px-5">
                            {systemList.length > 0 ? (
                              <div className="space-y-1 max-w-xs">
                                {systemList.map((s, sIdx) => {
                                  const isRevealed = revealedCreds[s.id || sIdx.toString()];
                                  return (
                                    <div
                                      key={s.id || sIdx}
                                      className="p-1.5 bg-slate-50 rounded-lg border border-slate-200/80 text-[11px] flex items-center justify-between gap-2"
                                    >
                                      <div className="min-w-0">
                                        <div className="font-bold text-[#0b1c30] truncate">{s.systemName}</div>
                                        <div className="text-[10px] font-mono text-slate-600 truncate flex items-center gap-1">
                                          <span>{s.linkOrIp}</span>
                                          {s.linkOrIp && (
                                            <button
                                              onClick={() => handleCopyText(s.linkOrIp, `link-${s.id}`)}
                                              title="Copiar IP/Link"
                                              className="p-0.5 text-slate-400 hover:text-[#004ac6] cursor-pointer"
                                            >
                                              {copiedKey === `link-${s.id}` ? (
                                                <Check className="w-2.5 h-2.5 text-emerald-600" />
                                              ) : (
                                                <Copy className="w-2.5 h-2.5" />
                                              )}
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                      {s.credentials && (
                                        <button
                                          onClick={() => toggleRevealCred(s.id || sIdx.toString())}
                                          className="p-1 text-slate-500 hover:text-[#004ac6] hover:bg-slate-200 rounded cursor-pointer shrink-0"
                                          title={isRevealed ? "Ocultar credencial" : "Ver credencial"}
                                        >
                                          {isRevealed ? <EyeOff className="w-3 h-3 text-rose-600" /> : <Eye className="w-3 h-3" />}
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">Sin servicios asignados</span>
                            )}
                          </td>
                          <td className="py-4 px-5">
                            <div className={`font-bold tabular-nums ${isHighUsage ? "text-red-600" : "text-[#0b1c30]"}`}>
                              {n.usedCapacityMbps} / {n.totalCapacityMbps} Mbps ({usagePercent}%)
                            </div>
                            <div className="mt-1 h-2 w-36 overflow-hidden rounded-full bg-[#f1f5f9] border border-slate-100">
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
                          <td className="py-4 px-5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => setDetailNode(n)}
                                className="px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              >
                                Ficha
                              </button>
                              <button
                                onClick={() => handleOpenEditModal(n)}
                                className="px-2.5 py-1 text-[11px] font-bold text-[#004ac6] hover:bg-[#eff4ff] rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <Edit2 className="w-3 h-3" />
                                <span>Editar</span>
                              </button>
                              <button
                                onClick={() => handleDeleteNode(n)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Eliminar Nodo"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
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
                Total de POPs multi-carrier: <strong className="text-[#0b1c30]">{nodes.length}</strong>
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
                    <th className="py-3.5 px-5">Carriers Upstream</th>
                    <th className="py-3.5 px-5 text-center">Estado Servicio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9] text-[#0b1c30]">
                  {clientAssociations.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-xs text-[#737686]">
                        No se encontraron clientes asociados a nodos.
                      </td>
                    </tr>
                  ) : (
                    clientAssociations.map(({ client, service, node }) => (
                      <tr key={client.id} className="hover:bg-[#f8f9ff] transition-colors">
                        <td className="py-4 px-5">
                          <div className="font-bold text-[#0b1c30] text-sm">{client.businessName}</div>
                          <div className="text-[11px] font-mono text-[#737686]">
                            {client.identificationType}: {client.identificationNumber}
                          </div>
                        </td>
                        <td className="py-4 px-5">
                          {node ? (
                            <div>
                              <div className="font-bold text-[#004ac6] flex items-center gap-1.5">
                                <Radio className="w-3.5 h-3.5" />
                                {node.name}
                              </div>
                              <div className="text-[10px] text-[#737686]">{node.address}</div>
                            </div>
                          ) : (
                            <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-bold text-[10px]">
                              Sin Nodo Asignado
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-5">
                          {service ? (
                            <span className="font-semibold text-slate-800">{service.planName}</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-4 px-5">
                          {service?.ipv4Address ? (
                            <span className="font-mono font-bold text-[#004ac6] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              {service.ipv4Address}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono">Dinámica / CGNAT</span>
                          )}
                        </td>
                        <td className="py-4 px-5">
                          {node?.upstreamProvider ? (
                            <span className="text-[11px] font-medium text-slate-700">{node.upstreamProvider}</span>
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

      {/* MODAL DETALLE / FICHA COMPLETA DEL NODO */}
      {detailNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-lumina-dropdown border border-[#e2e8f0] overflow-hidden my-8">
            <div className="p-5 px-6 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8f9ff]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#004ac6] text-white flex items-center justify-center font-bold">
                  <Radio className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-[#0b1c30] text-sm">{detailNode.name}</h3>
                  <p className="text-[11px] text-[#737686]">{detailNode.address}</p>
                </div>
              </div>
              <button
                onClick={() => setDetailNode(null)}
                className="p-1 rounded-lg text-[#737686] hover:text-[#0b1c30] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs">
              {/* Resumen */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-[#f8f9ff] rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Estado</span>
                  <div className="mt-1">{renderStatusBadge(detailNode.status)}</div>
                </div>
                <div className="p-3 bg-[#f8f9ff] rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Capacidad Total</span>
                  <span className="font-mono font-bold text-sm text-[#0b1c30]">{detailNode.totalCapacityMbps} Mbps</span>
                </div>
                <div className="p-3 bg-[#f8f9ff] rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Router MikroTik</span>
                  <span className="font-mono font-bold text-sm text-[#004ac6]">{detailNode.mikrotikIp || "Sin IP"}</span>
                </div>
                <div className="p-3 bg-[#f8f9ff] rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Abonados Conectados</span>
                  <span className="font-mono font-bold text-sm text-slate-800">{detailNode.activeClientsCount}</span>
                </div>
              </div>

              {/* Proveedores Upstream */}
              <div className="space-y-2">
                <h4 className="font-bold text-[#004ac6] text-xs uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-1">
                  <Globe className="w-3.5 h-3.5" />
                  Proveedores Upstream Multi-Carrier
                </h4>
                {detailNode.providers && detailNode.providers.length > 0 ? (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#f8f9ff] text-[10px] uppercase font-bold text-slate-600">
                        <tr>
                          <th className="p-2.5 px-3">Proveedor</th>
                          <th className="p-2.5 px-3">Capacidad</th>
                          <th className="p-2.5 px-3">ID Circuito</th>
                          <th className="p-2.5 px-3">IPv4 Subnet</th>
                          <th className="p-2.5 px-3">IPv6 Prefix</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {detailNode.providers.map((p, idx) => (
                          <tr key={p.id || idx}>
                            <td className="p-2.5 px-3 font-bold text-[#0b1c30]">{p.providerName}</td>
                            <td className="p-2.5 px-3 font-mono font-bold text-slate-800">{p.capacityMbps} Mbps</td>
                            <td className="p-2.5 px-3 font-mono text-slate-600">{p.circuitId || "—"}</td>
                            <td className="p-2.5 px-3 font-mono text-[#004ac6]">{p.ipv4Subnet || "—"}</td>
                            <td className="p-2.5 px-3 font-mono text-indigo-700">{p.ipv6Prefix || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-500 italic">{detailNode.upstreamProvider}</p>
                )}
              </div>

              {/* Servicios & Credenciales del Nodo */}
              <div className="space-y-2">
                <h4 className="font-bold text-[#004ac6] text-xs uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-1">
                  <Key className="w-3.5 h-3.5" />
                  Servicios, Equipos & Credenciales
                </h4>
                {detailNode.services && detailNode.services.length > 0 ? (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#f8f9ff] text-[10px] uppercase font-bold text-slate-600">
                        <tr>
                          <th className="p-2.5 px-3">Sistema / Equipo</th>
                          <th className="p-2.5 px-3">Link / IP</th>
                          <th className="p-2.5 px-3">Credenciales</th>
                          <th className="p-2.5 px-3">Observación</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {detailNode.services.map((s, idx) => {
                          const isRev = revealedCreds[s.id || idx.toString()];
                          return (
                            <tr key={s.id || idx}>
                              <td className="p-2.5 px-3 font-bold text-[#0b1c30]">{s.systemName}</td>
                              <td className="p-2.5 px-3 font-mono text-[#004ac6] flex items-center gap-1">
                                <span>{s.linkOrIp}</span>
                                {s.linkOrIp && (
                                  <button
                                    onClick={() => handleCopyText(s.linkOrIp, `copy-detail-${s.id}`)}
                                    className="p-0.5 text-slate-400 hover:text-[#004ac6] cursor-pointer"
                                  >
                                    {copiedKey === `copy-detail-${s.id}` ? (
                                      <Check className="w-3 h-3 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                )}
                              </td>
                              <td className="p-2.5 px-3 font-mono text-slate-700">
                                {s.credentials ? (
                                  <div className="flex items-center gap-1.5">
                                    <span>{isRev ? s.credentials : "••••••••••••"}</span>
                                    <button
                                      onClick={() => toggleRevealCred(s.id || idx.toString())}
                                      className="p-1 text-slate-400 hover:text-slate-800 cursor-pointer"
                                    >
                                      {isRev ? <EyeOff className="w-3 h-3 text-rose-600" /> : <Eye className="w-3 h-3" />}
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="p-2.5 px-3 text-slate-500 text-[11px]">{s.notes || "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-400 italic">No hay sistemas o equipos registrados en este nodo.</p>
                )}
              </div>

              {detailNode.notes && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 text-[11px]">
                  <strong>Observaciones:</strong> {detailNode.notes}
                </div>
              )}
            </div>

            <div className="p-4 px-6 border-t border-[#e2e8f0] bg-[#f8f9ff] flex justify-end">
              <button
                onClick={() => setDetailNode(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Node Create/Edit Modal with Multi-Carrier and Services (PDF Page 6 & 7) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150 overflow-y-auto">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-lumina-dropdown border border-[#e2e8f0] overflow-hidden my-8 max-h-[90vh] flex flex-col">
            <div className="p-4 px-6 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8f9ff] shrink-0">
              <div className="flex items-center gap-2.5">
                <Radio className="w-5 h-5 text-[#004ac6]" />
                <h3 className="font-bold text-[#0b1c30] text-sm">
                  {editingNode ? `Editar Nodo: ${editingNode.name}` : "Registrar Nuevo Nodo / POP Multi-Carrier"}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-[#737686] hover:text-[#0b1c30] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNode} className="p-6 space-y-5 text-xs overflow-y-auto flex-1">
              <fieldset disabled={busy} className="space-y-4">
                {/* Datos Básicos del POP */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="font-bold text-[#434655] block mb-1">Nombre del Nodo / POP *</label>
                    <input
                      required
                      type="text"
                      placeholder="Ej: POP 01 - Telepuerto Quito Norte (MikroTik CCR2004)"
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
                      placeholder="Ej: Av. 6 de Diciembre y Eloy Alfaro, Quito"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
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
                </div>

                {/* SECCIÓN MULTI-CARRIER PROVIDERS (PDF Página 6) */}
                <div className="p-4 bg-[#f8f9ff] rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                    <div>
                      <h4 className="font-bold text-[#004ac6] text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <Globe className="w-4 h-4" />
                        Proveedores Upstream Multi-Carrier
                      </h4>
                      <p className="text-[11px] text-[#737686]">
                        Capacidad Total Acumulada:{" "}
                        <strong className="text-emerald-700 font-mono">{totalCalculatedCapacity} Mbps</strong>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddProvider}
                      className="flex items-center gap-1 px-3 py-1.5 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Agregar Proveedor</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {providers.map((prov, pIdx) => (
                      <div
                        key={prov.id}
                        className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2 relative group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[11px] text-slate-800">
                            Proveedor {pIdx + 1}
                          </span>
                          {providers.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveProvider(prov.id)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors"
                              title="Eliminar este carrier"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                          <div className="md:col-span-2">
                            <label className="text-[10px] text-[#737686] font-bold block mb-0.5">Nombre Proveedor *</label>
                            <input
                              type="text"
                              required
                              placeholder="Ej: Telconet / CenturyLink"
                              value={prov.providerName}
                              onChange={(e) => handleUpdateProvider(prov.id, "providerName", e.target.value)}
                              className="w-full bg-white border border-[#cbd5e1] rounded-lg px-2.5 py-1.5 text-xs text-[#0b1c30] focus:ring-1 focus:ring-[#004ac6]"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-[#737686] font-bold block mb-0.5">Capacidad (Mbps) *</label>
                            <input
                              type="number"
                              required
                              min="1"
                              placeholder="1000"
                              value={prov.capacityMbps}
                              onChange={(e) => handleUpdateProvider(prov.id, "capacityMbps", Number(e.target.value))}
                              className="w-full bg-white border border-[#cbd5e1] rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-[#0b1c30] focus:ring-1 focus:ring-[#004ac6]"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-[#737686] font-bold block mb-0.5">ID Circuito</label>
                            <input
                              type="text"
                              placeholder="Ej: TCO-UIO-9921"
                              value={prov.circuitId || ""}
                              onChange={(e) => handleUpdateProvider(prov.id, "circuitId", e.target.value)}
                              className="w-full bg-white border border-[#cbd5e1] rounded-lg px-2.5 py-1.5 text-xs font-mono text-[#0b1c30] focus:ring-1 focus:ring-[#004ac6]"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-[#737686] font-bold block mb-0.5">IPv4 / Subnet</label>
                            <input
                              type="text"
                              placeholder="181.198.112.112/30"
                              value={prov.ipv4Subnet || ""}
                              onChange={(e) => handleUpdateProvider(prov.id, "ipv4Subnet", e.target.value)}
                              className="w-full bg-white border border-[#cbd5e1] rounded-lg px-2.5 py-1.5 text-xs font-mono text-[#0b1c30] focus:ring-1 focus:ring-[#004ac6]"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] text-[#737686] font-bold block mb-0.5">IPv6 Prefix (Opcional)</label>
                          <input
                            type="text"
                            placeholder="Ej: 2800:3f0:4000::/48"
                            value={prov.ipv6Prefix || ""}
                            onChange={(e) => handleUpdateProvider(prov.id, "ipv6Prefix", e.target.value)}
                            className="w-full bg-white border border-[#cbd5e1] rounded-lg px-2.5 py-1.5 text-xs font-mono text-[#0b1c30] focus:ring-1 focus:ring-[#004ac6]"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* SECCIÓN SERVICIOS Y CREDENCIALES (PDF Página 6 & 7) */}
                <div className="p-4 bg-[#f8f9ff] rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                    <div>
                      <h4 className="font-bold text-[#004ac6] text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <Key className="w-4 h-4" />
                        Servicios, Equipos & Credenciales del Nodo
                      </h4>
                      <p className="text-[11px] text-[#737686]">
                        Credenciales de Routers MikroTik, OLTs SmartOLT/ZTE y switches del POP
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddService}
                      className="flex items-center gap-1 px-3 py-1.5 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Agregar Sistema</span>
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {services.map((srv, sIdx) => (
                      <div
                        key={srv.id}
                        className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2 relative"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[11px] text-slate-800">
                            Equipo / Sistema {sIdx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveService(srv.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors"
                            title="Eliminar este sistema"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] text-[#737686] font-bold block mb-0.5">Sistema *</label>
                            <input
                              type="text"
                              required
                              placeholder="Ej: MIKROTIK CCR2116-12G-4S+"
                              value={srv.systemName}
                              onChange={(e) => handleUpdateService(srv.id, "systemName", e.target.value)}
                              className="w-full bg-white border border-[#cbd5e1] rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#0b1c30] focus:ring-1 focus:ring-[#004ac6]"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-[#737686] font-bold block mb-0.5">Link / IP *</label>
                            <input
                              type="text"
                              required
                              placeholder="181.198.112.112:5258 o https://..."
                              value={srv.linkOrIp}
                              onChange={(e) => handleUpdateService(srv.id, "linkOrIp", e.target.value)}
                              className="w-full bg-white border border-[#cbd5e1] rounded-lg px-2.5 py-1.5 text-xs font-mono text-[#004ac6] focus:ring-1 focus:ring-[#004ac6]"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-[#737686] font-bold block mb-0.5">Credenciales</label>
                            <input
                              type="text"
                              placeholder="admin / Inntel2026*"
                              value={srv.credentials}
                              onChange={(e) => handleUpdateService(srv.id, "credentials", e.target.value)}
                              className="w-full bg-white border border-[#cbd5e1] rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:ring-1 focus:ring-[#004ac6]"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Observación */}
                <div>
                  <label className="font-bold text-[#434655] block mb-1">Observación</label>
                  <textarea
                    rows={2}
                    placeholder="Observaciones de infraestructura, acuerdos de interconexión..."
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

              <div className="pt-3 flex justify-end gap-2.5 border-t border-[#e2e8f0] shrink-0">
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
