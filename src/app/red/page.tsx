"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { QuickSearchModal } from "@/components/layout/QuickSearchModal";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { Client, NodeLocation } from "@/types";
import { ClientNodeModal } from "@/components/modules/clients/ClientNodeModal";
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
  Users,
  ExternalLink,
} from "lucide-react";

export default function RedPage() {
  const { nodes, clients, deleteNode } = useApp();
  const { showSuccess, showConfirm } = useToast();

  const [selectedClientId, setSelectedClientId] = useState<string>("todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [nodeToEdit, setNodeToEdit] = useState<NodeLocation | null>(null);
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

  const handleCopy = (text: string, keyId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyId);
    showSuccess("Copiado", "Texto copiado al portapapeles.");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Filtrado de nodos
  const filteredNodes = useMemo(() => {
    return nodes.filter((n) => {
      const matchClient =
        selectedClientId === "todos" || n.clientId === selectedClientId;

      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        n.name.toLowerCase().includes(q) ||
        (n.clientName || "").toLowerCase().includes(q) ||
        (n.province || "").toLowerCase().includes(q) ||
        (n.canton || "").toLowerCase().includes(q) ||
        (n.detailedAddress || n.address || "").toLowerCase().includes(q) ||
        (n.providers || []).some((p) => p.providerName.toLowerCase().includes(q));

      const st = (n.status || "activo").toLowerCase();
      const matchStatus =
        statusFilter === "todos" ||
        (statusFilter === "reportado" && (n.isReportedArcotel || st === "reportado")) ||
        st === statusFilter;

      return matchClient && matchSearch && matchStatus;
    });
  }, [nodes, selectedClientId, searchQuery, statusFilter]);

  const activeClientForModal: Client = useMemo(() => {
    if (selectedClientId !== "todos") {
      const found = clients.find((c) => c.id === selectedClientId);
      if (found) return found;
    }
    return (
      clients[0] || {
        id: "cli-default",
        identificationType: "RUC",
        identificationNumber: "1790000000001",
        businessName: "Cliente General",
        email: "general@inntelcorp.com",
        phone: "0990000000",
        address: "Quito, Ecuador",
        requiresSriBilling: true,
        status: "activo",
        totalActiveServices: 1,
        currentBalance: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    );
  }, [clients, selectedClientId]);

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
      `¿Confirmas la eliminación del nodo "${node.name}"?`,
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
    <div className="flex min-h-screen bg-[#f8f9ff] text-[#0b1c30]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="p-6 md:p-8 space-y-6 flex-1 overflow-y-auto w-full min-w-0 select-none">
          {/* Header del Módulo Nodos / Red */}
          <div className="p-5 bg-white rounded-[6px] border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-[6px] bg-[#004ac6]/10 text-[#004ac6] flex items-center justify-center">
                <Radio className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  Control de Red, Nodos & Conectividad IP
                </h1>
                <p className="text-xs text-slate-500">
                  Supervisión de sedes corporativas, enlaces portadores multi-carrier y plataformas de red por cliente
                </p>
              </div>
            </div>

            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#004ac6] hover:bg-[#003ca0] text-white rounded-[6px] text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Nodo / Sede</span>
            </button>
          </div>

          {/* Filtros: Por Cliente, Estado y Búsqueda */}
          <div className="p-4 bg-white rounded-[6px] border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              {/* Filtro por Cliente */}
              <div className="min-w-[220px]">
                <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">
                  Filtrar por Cliente
                </label>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full px-3 py-2 rounded-[6px] border border-slate-200 bg-slate-50 font-bold text-slate-800 focus:outline-hidden focus:border-[#004ac6]"
                >
                  <option value="todos">Todos los Clientes ({nodes.length} nodos)</option>
                  {clients.map((c) => {
                    const cNodeCount = nodes.filter((n) => n.clientId === c.id).length;
                    return (
                      <option key={c.id} value={c.id}>
                        {c.businessName} ({cNodeCount} sedes)
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Filtro por Estado */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">
                  Estado
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 rounded-[6px] border border-slate-200 bg-slate-50 font-semibold text-slate-800 focus:outline-hidden focus:border-[#004ac6]"
                >
                  <option value="todos">Todos los Estados</option>
                  <option value="activo">ACTIVO</option>
                  <option value="suspendido">SUSPENDIDO</option>
                  <option value="retirado">RETIRADO</option>
                  <option value="reportado">Reportado ARCOTEL</option>
                </select>
              </div>

              {/* Buscador de texto */}
              <div className="flex-1 min-w-[200px]">
                <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">
                  Búsqueda Rápida
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Buscar sede, ciudad, proveedor portador..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 rounded-[6px] border border-slate-200 bg-white font-medium text-slate-800 focus:outline-hidden focus:border-[#004ac6]"
                  />
                </div>
              </div>
            </div>

            <div className="text-[11px] font-semibold text-slate-500 self-end pb-2">
              Mostrando <strong>{filteredNodes.length}</strong> de {nodes.length} nodos
            </div>
          </div>

          {/* Grilla de Nodos */}
          {filteredNodes.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-[6px] border border-dashed border-slate-200 p-8 space-y-3">
              <div className="w-12 h-12 rounded-[6px] bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Radio className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-800 text-sm">
                No se encontraron nodos con los filtros seleccionados
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Prueba cambiando el cliente seleccionado o el término de búsqueda.
              </p>
              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#004ac6] text-white rounded-[6px] text-xs font-bold hover:bg-[#003ca0] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Registrar Nuevo Nodo</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {filteredNodes.map((node) => {
                const st = (node.status || "activo").toLowerCase();
                const isSuspended = st === "suspendido";
                const isRetired = st === "retirado";
                const isReported = node.isReportedArcotel ?? (node.status === "reportado");
                const matchedClient = clients.find((c) => c.id === node.clientId);

                return (
                  <div
                    key={node.id}
                    className="bg-white rounded-[6px] border border-slate-200 shadow-2xs hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4 group"
                  >
                    <div className="space-y-3">
                      {/* Cliente asociado */}
                      {matchedClient && (
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold truncate">
                            <Users className="w-3.5 h-3.5 text-[#004ac6] shrink-0" />
                            <span className="truncate">{matchedClient.businessName}</span>
                          </div>
                          <Link
                            href="/clientes"
                            className="text-[11px] font-bold text-[#004ac6] hover:underline flex items-center gap-1 shrink-0"
                          >
                            <span>Ficha 360</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>
                      )}

                      {/* Header del Nodo */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-[6px] bg-blue-50 text-[#004ac6] flex items-center justify-center shrink-0">
                            <Radio className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-slate-900 text-sm leading-snug truncate">
                              {node.name}
                            </h3>
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
                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
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

                      {/* Ubicación Geográfica */}
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

                    {/* Sistemas, Servicios & Credenciales con temporizador de 20s */}
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
                                        onClick={() => handleCopy(userVal, `red-user-${srv.id}`)}
                                        className="p-1 text-slate-400 hover:text-[#004ac6] cursor-pointer"
                                        title="Copiar usuario"
                                      >
                                        {copiedKey === `red-user-${srv.id}` ? (
                                          <Check className="w-3 h-3 text-emerald-600" />
                                        ) : (
                                          <Copy className="w-3 h-3" />
                                        )}
                                      </button>
                                    )}
                                  </div>

                                  {/* Contraseña */}
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
                                          onClick={() => handleCopy(passVal, `red-pass-${srv.id}`)}
                                          className="p-1 text-slate-400 hover:text-[#004ac6] cursor-pointer"
                                          title="Copiar contraseña"
                                        >
                                          {copiedKey === `red-pass-${srv.id}` ? (
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
            client={activeClientForModal}
            nodeToEdit={nodeToEdit}
          />
        </main>

        {/* Footer Institucional */}
        <footer className="px-8 py-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 select-none">
          <a
            href="https://www.inntelcorp.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#004ac6] font-medium transition-colors"
          >
            &copy; 2026 INNTEL CORP S.A. • Gestión de Red & Nodos IP • www.inntelcorp.com
          </a>
          <div className="flex items-center gap-4">
            <span className="text-slate-400">NOC Central Operativo</span>
          </div>
        </footer>

        <QuickSearchModal />
      </div>
    </div>
  );
}
