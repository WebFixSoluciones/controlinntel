"use client";

import React, { useState, useMemo, useEffect } from "react";
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
  ShieldCheck,
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

  // Revelación temporal de 20s para credenciales
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, number>>({});

  useEffect(() => {
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
  }, []);

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
      {/* Barra Superior */}
      <div className="p-4 bg-slate-50 rounded-[6px] border border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[6px] bg-[#004ac6]/10 text-[#004ac6] flex items-center justify-center">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 text-xs">
              Sedes, Nodos & Conectividad del Cliente
            </h4>
            <p className="text-[11px] text-slate-500">
              {clientNodes.length} sedes registradas para {client.businessName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {clientNodes.length > 0 && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar sede, cantón..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xs pl-8 pr-3 py-1.5 rounded-[6px] border border-slate-200 bg-white focus:outline-hidden focus:border-[#004ac6] transition-all"
              />
            </div>
          )}

          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#004ac6] hover:bg-[#003ca0] text-white rounded-[6px] text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Registrar Nodo / Sede</span>
          </button>
        </div>
      </div>

      {/* Lista de Nodos */}
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
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#004ac6] text-white rounded-[6px] text-xs font-bold shadow-sm hover:bg-[#003ca0] transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Registrar Primera Sede</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredNodes.map((node) => {
            const st = (node.status || "activo").toLowerCase();
            const isSuspended = st === "suspendido";
            const isRetired = st === "retirado";
            const isReported = node.isReportedArcotel ?? (node.status === "reportado");

            return (
              <div
                key={node.id}
                className="bg-white rounded-[6px] border border-slate-200 shadow-2xs hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4 group"
              >
                {/* Header de la tarjeta del Nodo */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-[6px] bg-blue-50 text-[#004ac6] flex items-center justify-center shrink-0">
                        <Radio className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-900 text-sm leading-snug truncate">
                          {node.name}
                        </h4>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
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

                          {node.totalCapacityMbps > 0 && (
                            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-[6px]">
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
                        className="p-1.5 text-slate-400 hover:text-[#004ac6] hover:bg-slate-100 rounded-[6px] transition-colors cursor-pointer"
                        title="Editar Sede"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(node)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-[6px] transition-colors cursor-pointer"
                        title="Eliminar Sede"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Localización Geográfica */}
                  <div className="p-3 bg-slate-50/80 rounded-[6px] border border-slate-200/70 space-y-1 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                      <MapPin className="w-3.5 h-3.5 text-[#004ac6] shrink-0" />
                      <span className="bg-white text-slate-800 px-2 py-0.5 rounded-[6px] border border-slate-200 text-[11px]">
                        {node.province || "Ecuador"}
                      </span>
                      {node.canton && (
                        <>
                          <span className="text-slate-400">/</span>
                          <span className="text-slate-800">{node.canton}</span>
                        </>
                      )}
                      {node.parish && (
                        <>
                          <span className="text-slate-400">/</span>
                          <span className="text-slate-600">{node.parish}</span>
                        </>
                      )}
                    </div>
                    {node.detailedAddress && (
                      <p className="text-[11px] text-slate-600 pl-5 leading-relaxed">
                        {node.detailedAddress}
                      </p>
                    )}
                  </div>
                </div>

                {/* Proveedores Portadores */}
                {node.providers && node.providers.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Proveedores Portadores ({node.providers.length})
                    </span>
                    <div className="space-y-1.5">
                      {node.providers.map((p, idx) => (
                        <div
                          key={p.id || idx}
                          className="p-2 bg-slate-50 rounded-[6px] border border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-[11px]"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-[6px] bg-white border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                              {idx + 1}
                            </span>
                            <span className="font-bold text-slate-900">{p.providerName}</span>
                            {p.capacityMbps > 0 && (
                              <span className="text-[10px] font-bold text-[#004ac6] bg-blue-50 px-1.5 py-0.2 rounded-[6px]">
                                {p.capacityMbps} Mbps
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 text-[10px] font-mono text-slate-500">
                            {p.circuitId && (
                              <span>ID: <strong className="text-slate-700">{p.circuitId}</strong></span>
                            )}
                            {p.ipv4Subnet && (
                              <span>IPv4: <strong className="text-slate-700">{p.ipv4Subnet}</strong></span>
                            )}
                            {p.ipv6Prefix && (
                              <span>IPv6: <strong className="text-slate-700">{p.ipv6Prefix}</strong></span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Observación */}
                {node.notes && (
                  <div className="p-2.5 rounded-[6px] bg-slate-50/70 border border-slate-200 text-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Observación:</span>
                    <p className="text-[11px] text-slate-700 italic">{node.notes}</p>
                  </div>
                )}

                {/* Sistemas, Servicios & Credenciales */}
                {node.services && node.services.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Sistemas & Credenciales ({node.services.length})
                    </span>
                    <div className="space-y-1.5">
                      {node.services.map((srv) => {
                        const timeLeft = revealedPasswords[srv.id] || 0;
                        const isRevealed = timeLeft > 0;
                        const userVal = srv.username || (srv.credentials ? srv.credentials.split("/")[0]?.trim() : "");
                        const passVal = srv.password || (srv.credentials ? srv.credentials.split("/").slice(1).join("/").trim() : "");

                        return (
                          <div
                            key={srv.id}
                            className="p-2.5 rounded-[6px] bg-slate-50 border border-slate-200/80 space-y-1.5 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 truncate">
                                <Server className="w-3.5 h-3.5 text-[#004ac6] shrink-0" />
                                <span className="font-bold text-slate-900 truncate">{srv.systemName}</span>
                              </div>
                              {srv.linkOrIp && (
                                <span className="text-[10px] font-mono text-slate-500 truncate max-w-[160px]">
                                  {srv.linkOrIp}
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                              {/* Usuario */}
                              <div className="flex items-center justify-between px-2 py-1 bg-white rounded-[6px] border border-slate-200">
                                <span className="font-mono text-slate-700 truncate">
                                  User: <strong>{userVal || "—"}</strong>
                                </span>
                                {userVal && (
                                  <button
                                    onClick={() => handleCopy(userVal, `tab-user-${srv.id}`)}
                                    className="p-1 text-slate-400 hover:text-[#004ac6] cursor-pointer"
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
                              <div className="flex items-center justify-between px-2 py-1 bg-white rounded-[6px] border border-slate-200">
                                <div className="flex items-center gap-1 truncate font-mono">
                                  <span className="text-slate-500">Clave:</span>
                                  <span className="text-slate-800 font-semibold truncate">
                                    {isRevealed ? passVal || "—" : "••••••••"}
                                  </span>
                                  {isRevealed && (
                                    <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1 py-0.2 rounded-[6px]">
                                      {timeLeft}s
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleRevealPasswordFor20s(srv.id)}
                                    className={`p-1 rounded-[6px] cursor-pointer transition-colors ${
                                      isRevealed ? "text-amber-600 bg-amber-50" : "text-slate-400 hover:text-slate-700"
                                    }`}
                                    title="Revelar por 20 segundos"
                                  >
                                    {isRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                  </button>
                                  {passVal && (
                                    <button
                                      onClick={() => handleCopy(passVal, `tab-pass-${srv.id}`)}
                                      className="p-1 text-slate-400 hover:text-[#004ac6] cursor-pointer"
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
