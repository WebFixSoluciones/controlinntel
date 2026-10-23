"use client";

import React, { useState, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { Client, NodeLocation } from "@/types";
import { ClientNodeModal } from "./ClientNodeModal";
import { ClientTabHeader } from "./ClientTabHeader";
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
  ShieldCheck,
  Search,
  ExternalLink,
  Table,
  Map,
} from "lucide-react";

const ClientNodesOverviewMap = dynamic(
  () => import("./ClientNodesOverviewMap"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[380px] bg-slate-100 rounded-[6px] border border-slate-200 flex flex-col items-center justify-center text-slate-400 gap-2">
        <div className="w-6 h-6 border-2 border-[#004ac6] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-semibold">Cargando mapa de sedes...</span>
      </div>
    ),
  }
);

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
  const [viewMode, setViewMode] = useState<"table" | "map">("table");

  // Revelación temporal de 20s para credenciales
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, number>>({});

  useEffect(() => {
    if (Object.keys(revealedPasswords).length === 0) return;

    const timer = setInterval(() => {
      setRevealedPasswords((prev) => {
        const next: Record<string, number> = {};
        let changed = false;
        for (const [id, count] of Object.entries(prev)) {
          if (count > 1) {
            next[id] = count - 1;
            changed = true;
          } else {
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [revealedPasswords]);

  const handleRevealPasswordFor20s = (serviceId: string) => {
    setRevealedPasswords((prev) => ({
      ...prev,
      [serviceId]: 20,
    }));
  };

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
      return matchName || matchProv || matchCant || matchParr || matchAddr;
    });
  }, [clientNodes, searchQuery]);

  const handleCopy = (text: string, keyId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyId);
    showSuccess("Copiado", "Texto copiado al portapapeles.");
    setTimeout(() => setCopiedKey(null), 2000);
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
      `¿Confirmas la eliminación del nodo "${node.name}" de este cliente?`,
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
      <ClientTabHeader
        title="Nodos"
        icon={Radio}
        badge={
          <span className="text-[11px] font-semibold text-slate-500">
            ({clientNodes.length})
          </span>
        }
        actions={
          <>
            {clientNodes.length > 0 && (
              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    viewMode === "table"
                      ? "bg-[#004ac6] text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                  title="Vista de tabla"
                >
                  <Table className="w-3.5 h-3.5" />
                  <span>Tabla</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("map")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    viewMode === "map"
                      ? "bg-[#004ac6] text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                  title="Vista en mapa de sedes"
                >
                  <Map className="w-3.5 h-3.5" />
                  <span>Mapa</span>
                </button>
              </div>
            )}

            {viewMode === "table" && clientNodes.length > 0 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar sede..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-[#004ac6] w-44 shadow-2xs"
                />
              </div>
            )}

            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nuevo Nodo</span>
            </button>
          </>
        }
      />

      {/* VISTA MAPA GENERAL DE SEDES */}
      {viewMode === "map" && (
        <ClientNodesOverviewMap
          nodes={clientNodes}
          onEditNode={handleOpenEdit}
        />
      )}

      {/* VISTA TABLA */}
      {viewMode === "table" && (
        <>
          {filteredNodes.length === 0 ? (
            <div className="py-14 text-center bg-white rounded-[6px] border border-dashed border-slate-200 p-6 space-y-3">
          <div className="w-12 h-12 rounded-[6px] bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Radio className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h5 className="font-bold text-slate-800 text-sm">
              {searchQuery ? "No se encontraron sedes con ese criterio" : "Este cliente no tiene sedes ni nodos registrados"}
            </h5>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Registra las sedes, enlaces portadores y credenciales de acceso para este cliente.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[6px] border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[980px] border-collapse">
              <thead className="bg-[#f8f9ff] text-[#434655] font-bold text-[10px] uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Nodo / Sede</th>
                  <th className="py-3 px-4">Ubicación Geográfica</th>
                  <th className="py-3 px-4 text-center">Estado / ARCOTEL</th>
                  <th className="py-3 px-4">Proveedores Portadores</th>
                  <th className="py-3 px-4">Sistemas & Credenciales</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800 align-top">
                {filteredNodes.map((node) => {
                  const st = (node.status || "activo").toLowerCase();
                  const isSuspended = st === "suspendido";
                  const isRetired = st === "retirado";
                  const isReported = node.isReportedArcotel ?? (node.status === "reportado");

                  return (
                    <tr key={node.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* 1. Nodo / Sede */}
                      <td className="py-3 px-4 min-w-[160px]">
                        <div className="flex items-start gap-2.5">
                          <div className="w-8 h-8 rounded-[6px] bg-blue-50 text-[#004ac6] flex items-center justify-center shrink-0 mt-0.5">
                            <Radio className="w-4 h-4" />
                          </div>
                          <div className="space-y-1 min-w-0">
                            <div className="font-bold text-slate-900 text-xs leading-snug">
                              {node.name}
                            </div>
                            {node.totalCapacityMbps > 0 && (
                              <span className="inline-block text-[10px] font-bold text-[#004ac6] bg-blue-50 border border-blue-200/70 px-2 py-0.5 rounded-[4px]">
                                {node.totalCapacityMbps} Mbps
                              </span>
                            )}
                            {node.notes && (
                              <p className="text-[10px] text-slate-500 italic max-w-[180px] leading-snug pt-0.5">
                                {node.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 2. Ubicación Geográfica */}
                      <td className="py-3 px-4 min-w-[180px]">
                        <div className="space-y-1 text-xs">
                          <div className="flex flex-wrap items-center gap-1 font-semibold text-slate-800">
                            <MapPin className="w-3.5 h-3.5 text-[#004ac6] shrink-0" />
                            <span className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded-[4px] border border-slate-200 text-[10px] font-bold">
                              {node.province || "Ecuador"}
                            </span>
                            {node.canton && (
                              <span className="text-[11px] text-slate-700">/ {node.canton}</span>
                            )}
                            {node.parish && (
                              <span className="text-[11px] text-slate-500">/ {node.parish}</span>
                            )}
                          </div>
                          {(node.detailedAddress || node.address) && (
                            <p className="text-[11px] text-slate-500 pl-4 leading-snug max-w-[220px]">
                              {node.detailedAddress || node.address}
                            </p>
                          )}
                          {node.coordinates && (
                            <div className="pl-4 pt-0.5">
                              <a
                                href={`https://www.google.com/maps?q=${node.coordinates.lat},${node.coordinates.lng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] text-[#004ac6] hover:underline font-mono bg-blue-50/70 border border-blue-200/60 px-1.5 py-0.5 rounded-[4px] font-semibold"
                                title="Abrir ubicación en Google Maps"
                              >
                                <ExternalLink className="w-2.5 h-2.5" />
                                <span>{node.coordinates.lat.toFixed(5)}, {node.coordinates.lng.toFixed(5)}</span>
                              </a>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 3. Estado / ARCOTEL */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex flex-col items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[6px] text-[10px] font-extrabold uppercase tracking-wide border ${
                              isSuspended
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : isRetired
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isSuspended ? "bg-amber-500" : isRetired ? "bg-rose-500" : "bg-emerald-500"
                              }`}
                            />
                            {isSuspended ? "SUSPENDIDO" : isRetired ? "RETIRADO" : "ACTIVO"}
                          </span>

                          {isReported && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-[#004ac6] border border-blue-200 rounded-[6px] text-[10px] font-bold">
                              <ShieldCheck className="w-3 h-3" />
                              Reportado ARCOTEL
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 4. Proveedores Portadores */}
                      <td className="py-3 px-4 min-w-[230px]">
                        {node.providers && node.providers.length > 0 ? (
                          <div className="space-y-1.5">
                            {node.providers.map((p, idx) => (
                              <div
                                key={p.id || idx}
                                className="p-2 bg-slate-50 rounded-[6px] border border-slate-200/80 space-y-1 text-[11px]"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-4 h-4 rounded-[4px] bg-white border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-[9px]">
                                      {idx + 1}
                                    </span>
                                    <span className="font-bold text-slate-900">{p.providerName}</span>
                                  </div>
                                  {p.capacityMbps > 0 && (
                                    <span className="text-[10px] font-bold text-[#004ac6] bg-blue-50 px-1.5 py-0.5 rounded-[4px] whitespace-nowrap">
                                      {p.capacityMbps} Mbps
                                    </span>
                                  )}
                                </div>
                                {(p.circuitId || p.ipv4Subnet || p.ipv4Subnets?.length || p.ipv6Prefix) && (
                                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] font-mono text-slate-500 pl-5">
                                    {p.circuitId && (
                                      <span>ID: <strong className="text-slate-700">{p.circuitId}</strong></span>
                                    )}
                                    {p.ipv4Subnets && p.ipv4Subnets.length > 0 ? (
                                      <span className="flex items-center gap-1 flex-wrap">
                                        <span>IPv4:</span>
                                        {p.ipv4Subnets.map((ip, i) => (
                                          <strong key={i} className="text-slate-700 bg-white px-1.5 py-0.2 rounded border border-slate-200 text-[9.5px]">
                                            {ip}
                                          </strong>
                                        ))}
                                      </span>
                                    ) : p.ipv4Subnet ? (
                                      <span className="flex items-center gap-1 flex-wrap">
                                        <span>IPv4:</span>
                                        {p.ipv4Subnet.split(",").map((ip, i) => (
                                          <strong key={i} className="text-slate-700 bg-white px-1.5 py-0.2 rounded border border-slate-200 text-[9.5px]">
                                            {ip.trim()}
                                          </strong>
                                        ))}
                                      </span>
                                    ) : null}
                                    {p.ipv6Prefix && (
                                      <span>IPv6: <strong className="text-slate-700">{p.ipv6Prefix}</strong></span>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Sin portadores</span>
                        )}
                      </td>

                      {/* 5. Sistemas & Credenciales */}
                      <td className="py-3 px-4 min-w-[280px]">
                        {node.services && node.services.length > 0 ? (
                          <div className="space-y-1.5">
                            {node.services.map((srv) => {
                              const timeLeft = revealedPasswords[srv.id] || 0;
                              const isRevealed = timeLeft > 0;
                              const userVal =
                                srv.username ||
                                (srv.credentials ? srv.credentials.split("/")[0]?.trim() : "");
                              const passVal =
                                srv.password ||
                                (srv.credentials
                                  ? srv.credentials.split("/").slice(1).join("/").trim()
                                  : "");

                              return (
                                <div
                                  key={srv.id}
                                  className="p-2 rounded-[6px] bg-slate-50 border border-slate-200/80 space-y-1.5 text-[11px]"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <Server className="w-3.5 h-3.5 text-[#004ac6] shrink-0" />
                                      <span className="font-bold text-slate-900 truncate">
                                        {srv.systemName}
                                      </span>
                                    </div>
                                    {srv.linkOrIp && (
                                      <span className="text-[10px] font-mono text-slate-500 truncate max-w-[140px]">
                                        {srv.linkOrIp}
                                      </span>
                                    )}
                                  </div>

                                  <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                                    {/* Usuario */}
                                    <div className="flex items-center justify-between px-2 py-1 bg-white rounded-[4px] border border-slate-200 min-w-0">
                                      <span className="font-mono text-slate-700 truncate">
                                        User: <strong>{userVal || "—"}</strong>
                                      </span>
                                      {userVal && (
                                        <button
                                          onClick={() => handleCopy(userVal, `tab-user-${srv.id}`)}
                                          className="p-0.5 text-slate-400 hover:text-[#004ac6] cursor-pointer shrink-0"
                                          title="Copiar usuario"
                                        >
                                          {copiedKey === `tab-user-${srv.id}` ? (
                                            <Check className="w-3 h-3 text-emerald-600" />
                                          ) : (
                                            <Copy className="w-3 h-3" />
                                          )}
                                        </button>
                                      )}
                                    </div>

                                    {/* Clave con revelación 20s */}
                                    <div className="flex items-center justify-between px-2 py-1 bg-white rounded-[4px] border border-slate-200 min-w-0">
                                      <div className="flex items-center gap-1 truncate font-mono">
                                        <span className="text-slate-500">Clave:</span>
                                        <span className="text-slate-800 font-semibold truncate">
                                          {isRevealed ? passVal || "—" : "••••••••"}
                                        </span>
                                        {isRevealed && (
                                          <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1 rounded-[4px]">
                                            {timeLeft}s
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-0.5 shrink-0">
                                        <button
                                          onClick={() => handleRevealPasswordFor20s(srv.id)}
                                          className={`p-0.5 rounded-[4px] cursor-pointer transition-colors ${
                                            isRevealed
                                              ? "text-amber-600 bg-amber-50"
                                              : "text-slate-400 hover:text-slate-700"
                                          }`}
                                          title="Revelar por 20 segundos"
                                        >
                                          {isRevealed ? (
                                            <EyeOff className="w-3 h-3" />
                                          ) : (
                                            <Eye className="w-3 h-3" />
                                          )}
                                        </button>
                                        {passVal && (
                                          <button
                                            onClick={() => handleCopy(passVal, `tab-pass-${srv.id}`)}
                                            className="p-0.5 text-slate-400 hover:text-[#004ac6] cursor-pointer"
                                            title="Copiar contraseña"
                                          >
                                            {copiedKey === `tab-pass-${srv.id}` ? (
                                              <Check className="w-3 h-3 text-emerald-600" />
                                            ) : (
                                              <Copy className="w-3 h-3" />
                                            )}
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Sin sistemas</span>
                        )}
                      </td>

                      {/* 6. Acciones */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(node)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-[#004ac6] hover:bg-blue-50 rounded-[6px] border border-transparent hover:border-blue-200 transition-colors cursor-pointer"
                            title="Editar Sede"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Editar</span>
                          </button>
                          <button
                            onClick={() => handleDelete(node)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-[6px] transition-colors cursor-pointer"
                            title="Eliminar Sede"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
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
