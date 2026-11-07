"use client";

import React, { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { Client, NodeLocation } from "@/types";
import { ClientNodeModal } from "./ClientNodeModal";
import { ClientTabHeader } from "./ClientTabHeader";
import { NodeSystemCredentials } from "./NodeSystemCredentials";
import {
  Radio,
  Plus,
  MapPin,
  Edit2,
  Trash2,
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
      <div className="h-[380px] bg-slate-100 rounded-xl border border-slate-200 flex flex-col items-center justify-center text-slate-400 gap-2">
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
  const [viewMode, setViewMode] = useState<"table" | "map">("table");

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
      const matchSystem = n.services?.some(service =>
        [service.systemName, service.linkOrIp, service.username].some(value => value?.toLowerCase().includes(q)));
      return matchName || matchProv || matchCant || matchParr || matchAddr || matchSystem;
    });
  }, [clientNodes, searchQuery]);

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
    <div className="space-y-4">
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
                  placeholder="Buscar sede, sistema o IP..."
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
            <div className="py-14 text-center bg-white rounded-xl border border-dashed border-slate-200 p-6 space-y-3">
          <div className="w-12 h-12 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
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
        <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
          <div role="region" aria-label="Tabla de nodos" tabIndex={0} className="max-w-full overflow-x-auto overscroll-x-contain">
            <table className="table-fixed w-full min-w-[60rem] text-left text-xs border-collapse">
              <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-xs uppercase tracking-wider border-b border-[#e2e8f0]">
                <tr>
                  <th className="py-3 px-3 w-[15%]">Nodo / Sede</th>
                  <th className="py-3 px-3 w-[18%]">Ubicación</th>
                  <th className="py-3 px-3 w-[25%]">Proveedores Portadores</th>
                  <th className="py-3 px-3 w-[34%]">Sistemas & Credenciales</th>
                  <th className="py-3 px-2 w-[8%] text-right">Acciones</th>
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
                      {/* Nodo, estado y reporte regulatorio */}
                      <td className="py-3 px-3">
                        <div className="flex items-start gap-1.5">
                          <span className={`mt-1 size-1.5 shrink-0 rounded-full ${isSuspended ? "bg-amber-500" : isRetired ? "bg-rose-500" : "bg-emerald-500"}`} aria-hidden="true" />
                          <span className="min-w-0 break-words font-semibold text-slate-900">{node.name}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1 text-[9px]">
                          <span className={`rounded px-1.5 py-0.5 font-semibold ${isSuspended ? "bg-amber-50 text-amber-700" : isRetired ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                            {isSuspended ? "Suspendido" : isRetired ? "Retirado" : "Activo"}
                          </span>
                          {isReported && <span title="Reportado ARCOTEL" className="inline-flex items-center gap-0.5 rounded bg-blue-50 px-1.5 py-0.5 font-semibold text-[#004ac6]">
                            <ShieldCheck className="size-2.5" /> ARCOTEL
                          </span>}
                        </div>
                        {node.totalCapacityMbps > 0 && <p className="mt-1 text-[10px] font-semibold text-[#004ac6]">{node.totalCapacityMbps} Mbps</p>}
                        {node.notes && <p className="mt-1 break-words text-[10px] text-slate-500">{node.notes}</p>}
                      </td>

                      {/* 2. Ubicación Geográfica */}
                      <td className="py-3 px-3">
                        <div className="space-y-1 text-xs">
                          <div className="flex flex-wrap items-center gap-1 font-semibold text-slate-800">
                            <MapPin className="w-3.5 h-3.5 text-[#004ac6] shrink-0" />
                            <span className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded-md border border-slate-200 text-[10px] font-bold">
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
                            <p className="text-[11px] text-slate-500 pl-4 leading-snug break-words">
                              {node.detailedAddress || node.address}
                            </p>
                          )}
                          {node.coordinates && (
                            <div className="pl-4 pt-0.5">
                              <a
                                href={`https://www.google.com/maps?q=${node.coordinates.lat},${node.coordinates.lng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] text-[#004ac6] hover:underline font-mono bg-blue-50/70 border border-blue-200/60 px-1.5 py-0.5 rounded-md font-semibold"
                                title="Abrir ubicación en Google Maps"
                              >
                                <ExternalLink className="w-2.5 h-2.5" />
                                <span>{node.coordinates.lat.toFixed(5)}, {node.coordinates.lng.toFixed(5)}</span>
                              </a>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 4. Proveedores Portadores */}
                      <td className="py-3 px-3">
                        {node.providers && node.providers.length > 0 ? (
                          <div className="space-y-1.5">
                            {node.providers.map((p, idx) => (
                              <div
                                key={p.id || idx}
                                className="p-2 bg-slate-50 rounded-lg border border-slate-200/80 space-y-1 text-[11px]"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-4 h-4 rounded-md bg-white border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-[9px]">
                                      {idx + 1}
                                    </span>
                                    <span className="min-w-0 break-words font-bold text-slate-900">{p.providerName}</span>
                                  </div>
                                  {p.capacityMbps > 0 && (
                                    <span className="text-[10px] font-bold text-[#004ac6] bg-blue-50 px-1.5 py-0.5 rounded-md whitespace-nowrap">
                                      {p.capacityMbps} Mbps
                                    </span>
                                  )}
                                </div>
                                {(p.circuitId || p.ipv4Subnet || p.ipv4Subnets?.length || p.ipv6Prefix) && (
                                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] font-mono text-slate-500 break-all">
                                    {p.circuitId && (
                                      <span>ID: <strong className="text-slate-700">{p.circuitId}</strong></span>
                                    )}
                                    {p.ipv4Subnets && p.ipv4Subnets.length > 0 ? (
                                      <span className="flex items-center gap-1 flex-wrap">
                                        <span>IPv4:</span>
                                        {p.ipv4Subnets.map((ip, i) => (
                                          <strong key={i} className="text-slate-700 bg-white px-1.5 py-0.2 rounded-md border border-slate-200 text-[9.5px]">
                                            {ip}
                                          </strong>
                                        ))}
                                      </span>
                                    ) : p.ipv4Subnet ? (
                                      <span className="flex items-center gap-1 flex-wrap">
                                        <span>IPv4:</span>
                                        {p.ipv4Subnet.split(",").map((ip, i) => (
                                          <strong key={i} className="text-slate-700 bg-white px-1.5 py-0.2 rounded-md border border-slate-200 text-[9.5px]">
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

                      {/* Sistemas con IP y credenciales legibles */}
                      <td className="py-3 px-3">
                        {node.services?.length ? (
                          <div className="space-y-1.5">
                            {node.services.map(service => <NodeSystemCredentials key={service.id} nodeId={node.id} service={service} />)}
                          </div>
                        ) : <span className="text-[11px] text-slate-400 italic">Sin sistemas</span>}
                      </td>

                      {/* 6. Acciones */}
                      <td className="py-3 px-2 text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(node)}
                            className="inline-flex items-center gap-1 p-1.5 text-[11px] font-bold text-[#004ac6] hover:bg-blue-50 rounded-lg border border-transparent hover:border-blue-200 transition-colors cursor-pointer"
                            title="Editar Sede"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span className="hidden 2xl:inline">Editar</span>
                          </button>
                          <button
                            onClick={() => handleDelete(node)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
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
