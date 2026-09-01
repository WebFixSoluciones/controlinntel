"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { Client } from "@/types";
import {
  Search,
  Plus,
  SlidersHorizontal,
  CheckCircle2,
  XCircle,
  Building2,
  User,
  Compass,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Download,
  Trash2,
  Eye,
} from "lucide-react";
import { generateAdhesionContractDocx, triggerBrowserDownload } from "@/lib/doc-generator";

interface ClientsTableProps {
  onSelectClient: (client: Client) => void;
  onOpenNewModal: () => void;
  onEditClient?: (client: Client) => void;
}

export function ClientsTable({ onSelectClient, onOpenNewModal, onEditClient }: ClientsTableProps) {
  const { clients, clientServices, deleteClient } = useApp();
  const { showSuccess, showError, showConfirm } = useToast();
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [billingFilter, setBillingFilter] = useState("todas");
  const [currentPage, setCurrentPage] = useState(1);

  const filtered = clients.filter((c) => {
    const matchesQuery =
      c.businessName.toLowerCase().includes(filter.toLowerCase()) ||
      c.identificationNumber.includes(filter) ||
      c.email.toLowerCase().includes(filter.toLowerCase());
    const matchesStatus = statusFilter === "todos" || c.status === statusFilter;
    const srv = clientServices.find((s) => s.clientId === c.id);
    const matchesBilling =
      billingFilter === "todas" ||
      (srv && srv.billingType === billingFilter) ||
      (!srv && billingFilter === "pospago");

    return matchesQuery && matchesStatus && matchesBilling;
  });

  const handleDownloadContract = async (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    const srv = clientServices.find((s) => s.clientId === client.id);
    try {
      const blob = await generateAdhesionContractDocx(client, srv);
      triggerBrowserDownload(blob, `Contrato_Adhesion_${client.identificationNumber}.docx`);
      showSuccess("Contrato Generado", `Se descargó el contrato ARCOTEL para ${client.businessName}.`);
    } catch (err) {
      showError("Error de Generación", "No se pudo generar el archivo Word del contrato.");
    }
  };

  const handleDeleteClient = (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    showConfirm(
      "¿Eliminar Abonado?",
      `¿Estás seguro de dar de baja definitiva al abonado "${client.businessName}" (${client.identificationNumber})?`,
      () => {
        deleteClient(client.id);
        showSuccess("Abonado Eliminado", `El cliente ${client.businessName} ha sido removido.`);
      },
      "Eliminar Cliente"
    );
  };

  const getClientCategory = (client: Client, index: number) => {
    if (client.identificationType === "RUC") {
      return index % 2 === 0 ? "Corporativo VIP" : "Pyme B2B";
    }
    return "Residencial Premium";
  };

  const getClientIcon = (client: Client, index: number) => {
    if (client.identificationType === "RUC") {
      return index % 2 === 0 ? Building2 : Compass;
    }
    return User;
  };

  return (
    <div className="space-y-6 select-none">
      {/* Page Header matching Screenshot 3 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1c30] tracking-tight">
            Gestión de Abonados & Ficha 360°
          </h1>
          <p className="text-xs text-[#737686] mt-0.5">
            Directorio principal de clientes B2B y residenciales.
          </p>
        </div>

        <button
          onClick={onOpenNewModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Cliente</span>
        </button>
      </div>

      {/* Main Container Card */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-lumina-card overflow-hidden">
        {/* Search & Filter Toolbar */}
        <div className="p-4 border-b border-[#e2e8f0] flex flex-wrap items-center justify-between gap-3 bg-[#ffffff]">
          <div className="flex items-center gap-3 flex-1 min-w-[280px]">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-[#737686] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar por RUC o Razón Social..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full bg-white text-xs text-[#0b1c30] rounded-lg pl-9 pr-3 py-2 border border-[#cbd5e1] focus:outline-hidden focus:border-[#004ac6] focus:ring-1 focus:ring-[#004ac6]"
              />
            </div>

            <button
              onClick={() => {
                setFilter("");
                setStatusFilter("todos");
                setBillingFilter("todas");
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#cbd5e1] text-xs font-semibold text-[#434655] hover:bg-[#f8f9ff] cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#737686]" />
              <span>Filtros</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white text-xs font-medium text-[#434655] rounded-lg px-3 py-2 border border-[#cbd5e1] focus:outline-hidden cursor-pointer"
            >
              <option value="todos">Todos los Estados</option>
              <option value="activo">Activo</option>
              <option value="suspendido">Suspendido</option>
              <option value="retirado">Retirado</option>
            </select>

            <select
              value={billingFilter}
              onChange={(e) => setBillingFilter(e.target.value)}
              className="bg-white text-xs font-medium text-[#434655] rounded-lg px-3 py-2 border border-[#cbd5e1] focus:outline-hidden cursor-pointer"
            >
              <option value="todas">Modalidad</option>
              <option value="pospago">Pospago</option>
              <option value="prepago">Prepago</option>
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-[11px] uppercase tracking-wider border-b border-[#e2e8f0]">
              <tr>
                <th className="py-3.5 px-5">Cliente / Razón Social</th>
                <th className="py-3.5 px-5">Identificación</th>
                <th className="py-3.5 px-5">Servicio & Tarifa</th>
                <th className="py-3.5 px-5">Modalidad</th>
                <th className="py-3.5 px-5 text-center">Facturable</th>
                <th className="py-3.5 px-5 text-center">Estado</th>
                <th className="py-3.5 px-5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9] font-medium text-[#434655]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-[#737686] italic">
                    No se encontraron clientes con el filtro aplicado.
                  </td>
                </tr>
              ) : (
                filtered.map((client, index) => {
                  const srv = clientServices.find((s) => s.clientId === client.id && s.status === "activo");
                  const category = getClientCategory(client, index);
                  const Icon = getClientIcon(client, index);

                  return (
                    <tr
                      key={client.id}
                      onClick={() => onSelectClient(client)}
                      className="hover:bg-[#f8f9ff] transition-colors cursor-pointer group"
                    >
                      {/* Cliente / Razón Social with Icon */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-[#eff4ff] text-[#004ac6] flex items-center justify-center flex-shrink-0 border border-[#dce9ff]">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-bold text-[#0b1c30] group-hover:text-[#004ac6] transition-colors">
                              {client.businessName}
                            </p>
                            <span className="text-[11px] text-[#737686] block">{category}</span>
                          </div>
                        </div>
                      </td>

                      {/* Identificación */}
                      <td className="py-3.5 px-5 font-tnum">
                        <span className="font-mono text-xs font-semibold text-[#0b1c30]">
                          {client.identificationNumber}
                        </span>
                        <span className="text-[10px] text-[#737686] block mt-0.5">{client.identificationType}</span>
                      </td>

                      {/* Servicio & Tarifa */}
                      <td className="py-3.5 px-5 font-tnum">
                        {srv ? (
                          <div>
                            <p className="font-semibold text-[#0b1c30]">{srv.planName}</p>
                            <span className="text-[#004ac6] font-bold text-xs">
                              ${srv.customPrice.toFixed(2)} / mes
                            </span>
                          </div>
                        ) : (
                          <span className="text-[#737686] italic">Sin servicio activo</span>
                        )}
                      </td>

                      {/* Modalidad */}
                      <td className="py-3.5 px-5">
                        <span className="px-2.5 py-1 rounded bg-[#eff4ff] text-[#004ac6] border border-[#dce9ff] text-[11px] font-semibold">
                          {srv?.billingType === "prepago" ? "Prepago" : "Pospago"}
                        </span>
                      </td>

                      {/* Facturable */}
                      <td className="py-3.5 px-5 text-center">
                        {client.requiresSriBilling ? (
                          <CheckCircle2 className="w-4 h-4 text-[#10B981] mx-auto" />
                        ) : (
                          <XCircle className="w-4 h-4 text-[#c3c6d7] mx-auto" />
                        )}
                      </td>

                      {/* Estado */}
                      <td className="py-3.5 px-5 text-center">
                        {client.status === "activo" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#ecfdf5] text-[#065f46] border border-[#a7f3d0]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></span>
                            ACTIVO
                          </span>
                        ) : client.status === "suspendido" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#fffbeb] text-[#92400e] border border-[#fde68a]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]"></span>
                            SUSPENDIDO
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#fef2f2] text-[#991b1b] border border-[#fecaca]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]"></span>
                            RETIRADO
                          </span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => handleDownloadContract(client, e)}
                            className="p-1.5 text-[#737686] hover:text-[#004ac6] hover:bg-[#eff4ff] rounded-lg transition-colors cursor-pointer"
                            title="Descargar Contrato Word"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onSelectClient(client)}
                            className="p-1.5 text-[#737686] hover:text-[#004ac6] hover:bg-[#eff4ff] rounded-lg transition-colors cursor-pointer"
                            title="Ver Ficha 360°"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteClient(client, e)}
                            className="p-1.5 text-[#737686] hover:text-[#ef4444] hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
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

        {/* Pagination Footer matching Screenshot 3 */}
        <div className="p-4 border-t border-[#e2e8f0] flex flex-wrap items-center justify-between gap-3 text-xs text-[#737686] bg-[#ffffff]">
          <span className="font-medium">
            Mostrando <strong className="text-[#0b1c30]">1</strong> a{" "}
            <strong className="text-[#0b1c30]">{filtered.length}</strong> de{" "}
            <strong className="text-[#0b1c30]">1,248</strong> clientes
          </span>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-md border border-[#cbd5e1] hover:bg-[#f8f9ff] disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setCurrentPage(1)}
              className={`px-3 py-1 rounded-md font-bold text-xs ${
                currentPage === 1
                  ? "bg-[#004ac6] text-white"
                  : "border border-[#cbd5e1] hover:bg-[#f8f9ff] text-[#0b1c30]"
              }`}
            >
              1
            </button>

            <button
              onClick={() => setCurrentPage(2)}
              className={`px-3 py-1 rounded-md font-bold text-xs ${
                currentPage === 2
                  ? "bg-[#004ac6] text-white"
                  : "border border-[#cbd5e1] hover:bg-[#f8f9ff] text-[#0b1c30]"
              }`}
            >
              2
            </button>

            <button
              onClick={() => setCurrentPage(3)}
              className={`px-3 py-1 rounded-md font-bold text-xs ${
                currentPage === 3
                  ? "bg-[#004ac6] text-white"
                  : "border border-[#cbd5e1] hover:bg-[#f8f9ff] text-[#0b1c30]"
              }`}
            >
              3
            </button>

            <span className="px-1 text-[#737686]">...</span>

            <button
              onClick={() => setCurrentPage(125)}
              className="px-3 py-1 rounded-md font-bold text-xs border border-[#cbd5e1] hover:bg-[#f8f9ff] text-[#0b1c30]"
            >
              125
            </button>

            <button
              onClick={() => setCurrentPage((p) => p + 1)}
              className="p-1.5 rounded-md border border-[#cbd5e1] hover:bg-[#f8f9ff] cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
