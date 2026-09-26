"use client";

import React, { useState, useMemo } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { Client, NodeLocation } from "@/types";
import { ClientNodeModal } from "./ClientNodeModal";
import {
  Radio,
  Plus,
  MapPin,
  Server,
  Layers,
  Edit2,
  Trash2,
  Copy,
  Check,
  Eye,
  EyeOff,
  Activity,
  Globe,
  Shield,
  Search,
} from "lucide-react";

interface ClientNodesTabProps {
  client: Client;
}

export function ClientNodesTab({ client }: ClientNodesTabProps) {
  const { nodes, deleteNode } = useApp();
  const { showSuccess, showConfirm } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [nodeToEdit, setNodeToEdit] = useState<NodeLocation | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [revealedCreds, setRevealedCreds] = useState<Record<string, boolean>>({});

  // Filtrar exclusivamente los nodos pertenecientes a este cliente
  const clientNodes = useMemo(() => {
    return nodes.filter((n) => n.clientId === client.id);
  }, [nodes, client.id]);

  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) return clientNodes;
    const q = searchQuery.toLowerCase();
    return clientNodes.filter((n) => {
      const matchName = n.name.toLowerCase().includes(q);
      const matchProv = (n.province || "").toLowerCase().includes(q);
      const matchCant = (n.canton || "").toLowerCase().includes(q);
      const matchParr = (n.parish || "").toLowerCase().includes(q);
      const matchAddr = (n.detailedAddress || n.address || "").toLowerCase().includes(q);
      const matchIp = (n.mikrotikIp || "").toLowerCase().includes(q);
      return matchName || matchProv || matchCant || matchParr || matchAddr || matchIp;
    });
  }, [clientNodes, searchQuery]);

  const handleCopy = (text: string, keyId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyId);
    showSuccess("Copiado", "Texto copiado al portapapeles.");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const toggleReveal = (id: string) => {
    setRevealedCreds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleOpenCreate = () => {
    setNodeToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (node: NodeLocation) => {
    setNodeToEdit(node);
    setIsModalOpen(true);
  };

  const handleDelete = (node: NodeLocation) => {
    showConfirm(
      "¿Eliminar Sede / Nodo?",
      `¿Confirmas la eliminación de la sede "${node.name}" de este cliente? Esta acción removerá sus enlaces y configuraciones asociadas.`,
      async () => {
        try {
          await deleteNode(node.id);
          showSuccess("Sede Eliminada", "El registro del nodo ha sido eliminado.");
        } catch (error) {
          window.dispatchEvent(
            new CustomEvent("inntel:error", {
              detail: error instanceof Error ? error.message : "No se pudo eliminar el nodo.",
            })
          );
        }
      },
      "Eliminar Sede"
    );
  };

  return (
    <div className="space-y-4 select-none">
      {/* Barra Superior con Controles */}
      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#004ac6]/10 text-[#004ac6] flex items-center justify-center">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 text-xs">
              Sedes, Nodos & Conectividad del Cliente
            </h4>
            <p className="text-[11px] text-slate-500">
              {clientNodes.length} {clientNodes.length === 1 ? "sede registrada" : "sedes registradas"} para {client.businessName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {clientNodes.length > 0 && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar sede, provincia, cantón..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xs pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-[#004ac6] transition-all"
              />
            </div>
          )}

          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#004ac6] hover:bg-[#003ca0] text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Registrar Nodo / Sede</span>
          </button>
        </div>
      </div>

      {/* Lista de Nodos / Sedes */}
      {filteredNodes.length === 0 ? (
        <div className="py-14 text-center bg-white rounded-3xl border border-dashed border-slate-200 p-6 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Radio className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h5 className="font-bold text-slate-800 text-sm">
              {searchQuery ? "No se encontraron sedes con ese criterio" : "Este cliente no tiene sedes ni nodos registrados"}
            </h5>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Registra las sucursales, oficinas o puntos de red que el cliente opera en Ecuador con su localización geográfica y parámetros de enlace.
            </p>
          </div>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#004ac6] text-white rounded-xl text-xs font-bold shadow-sm hover:bg-[#003ca0] transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Registrar Primera Sede</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredNodes.map((node) => {
            const isOnline = node.status === "online";
            const isWarning = node.status === "warning";

            return (
              <div
                key={node.id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4 group"
              >
                {/* Header de la tarjeta del Nodo */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#004ac6] flex items-center justify-center shrink-0">
                        <Radio className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm leading-snug">
                          {node.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${
                              isOnline
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                : isWarning
                                ? "bg-amber-100 text-amber-800 border border-amber-200"
                                : "bg-rose-100 text-rose-800 border border-rose-200"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isOnline ? "bg-emerald-600 animate-pulse" : isWarning ? "bg-amber-600" : "bg-rose-600"
                              }`}
                            />
                            {node.status}
                          </span>
                          {node.totalCapacityMbps && (
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                              {node.totalCapacityMbps} Mbps
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Botones de acción */}
                    <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleOpenEdit(node)}
                        className="p-1.5 text-slate-400 hover:text-[#004ac6] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        title="Editar Sede"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(node)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        title="Eliminar Sede"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Localización Geográfica en Ecuador */}
                  <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/70 space-y-1.5 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                      <MapPin className="w-3.5 h-3.5 text-[#004ac6] shrink-0" />
                      <span className="bg-white text-slate-800 px-2 py-0.5 rounded-md border border-slate-200 text-[11px]">
                        {node.province || "Ecuador"}
                      </span>
                      <span className="text-slate-400">/</span>
                      <span className="text-slate-800">{node.canton || "Cantón Central"}</span>
                      {node.parish && (
                        <>
                          <span className="text-slate-400">/</span>
                          <span className="text-slate-600">{node.parish}</span>
                        </>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 pl-5 leading-relaxed">
                      {node.detailedAddress || node.address}
                    </p>
                  </div>
                </div>

                {/* Parámetros de Red & MikroTik */}
                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100">
                  <div className="p-2 bg-slate-50/50 rounded-lg border border-slate-200/60">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Router / IP Gestión</span>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="font-mono font-bold text-slate-800 text-xs truncate">
                        {node.mikrotikIp || "No asignada"}
                      </span>
                      {node.mikrotikIp && (
                        <button
                          onClick={() => handleCopy(node.mikrotikIp || "", `ip-${node.id}`)}
                          className="p-1 text-slate-400 hover:text-[#004ac6] cursor-pointer"
                          title="Copiar IP"
                        >
                          {copiedKey === `ip-${node.id}` ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="p-2 bg-slate-50/50 rounded-lg border border-slate-200/60">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Portadores Activos</span>
                    <span className="font-bold text-slate-800 text-xs truncate block mt-0.5">
                      {node.providers && node.providers.length > 0
                        ? `${node.providers.length} Enlaces (${node.providers.map((p) => p.providerName).join(", ")})`
                        : node.upstreamProvider || "Enlace Dedicado"}
                    </span>
                  </div>
                </div>

                {/* Equipos / Credenciales revelables si existen */}
                {node.services && node.services.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Equipos en Sede
                    </span>
                    <div className="space-y-1">
                      {node.services.map((srv) => (
                        <div
                          key={srv.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200/60 text-[11px]"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Server className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="font-bold text-slate-800 truncate">{srv.systemName}</span>
                            <span className="text-slate-400 font-mono text-[10px]">({srv.linkOrIp})</span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="font-mono text-[10px] text-slate-600">
                              {revealedCreds[srv.id] ? srv.credentials : "••••••••••••"}
                            </span>
                            <button
                              onClick={() => toggleReveal(srv.id)}
                              className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                              title={revealedCreds[srv.id] ? "Ocultar" : "Mostrar credenciales"}
                            >
                              {revealedCreds[srv.id] ? (
                                <EyeOff className="w-3 h-3" />
                              ) : (
                                <Eye className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Sede / Nodo */}
      <ClientNodeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        client={client}
        nodeToEdit={nodeToEdit}
      />
    </div>
  );
}
