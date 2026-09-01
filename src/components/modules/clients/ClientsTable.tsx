"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { Client } from "@/types";
import { Search, Plus, Eye, Trash2, CheckCircle2, XCircle, Download } from "lucide-react";
import { generateAdhesionContractDocx, triggerBrowserDownload } from "@/lib/doc-generator";

interface ClientsTableProps {
  onSelectClient: (client: Client) => void;
  onOpenNewModal: () => void;
}

export function ClientsTable({ onSelectClient, onOpenNewModal }: ClientsTableProps) {
  const { clients, clientServices, deleteClient } = useApp();
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");

  const filtered = clients.filter((c) => {
    const matchesQuery =
      c.businessName.toLowerCase().includes(filter.toLowerCase()) ||
      c.identificationNumber.includes(filter) ||
      c.email.toLowerCase().includes(filter.toLowerCase());
    const matchesStatus = statusFilter === "todos" || c.status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  const handleDownloadContract = async (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    const srv = clientServices.find((s) => s.clientId === client.id);
    try {
      const blob = await generateAdhesionContractDocx(client, srv);
      triggerBrowserDownload(blob, `Contrato_Adhesion_${client.identificationNumber}.docx`);
    } catch (err) {
      alert("Error al generar contrato");
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col overflow-hidden select-none">
      <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por RUC/Cédula, Razón Social o Email..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full bg-white text-xs text-slate-800 rounded-xl pl-9 pr-3 py-2 border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white text-xs font-semibold text-slate-700 rounded-xl px-3 py-2 border border-slate-200 focus:outline-hidden cursor-pointer"
          >
            <option value="todos">Todos los Estados</option>
            <option value="activo">Activos</option>
            <option value="suspendido">Suspendidos</option>
            <option value="retirado">Retirados</option>
          </select>
        </div>

        <button
          onClick={onOpenNewModal}
          className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Cliente</span>
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b border-slate-200">
            <tr>
              <th className="py-3 px-4">Cliente / Razón Social</th>
              <th className="py-3 px-4">Identificación SRI</th>
              <th className="py-3 px-4">Servicio & Tarifa Pactada</th>
              <th className="py-3 px-4">Modalidad</th>
              <th className="py-3 px-4">Factura SRI</th>
              <th className="py-3 px-4">Estado</th>
              <th className="py-3 px-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                  No se encontraron clientes con el filtro aplicado.
                </td>
              </tr>
            ) : (
              filtered.map((client) => {
                const srv = clientServices.find((s) => s.clientId === client.id && s.status === "activo");

                return (
                  <tr
                    key={client.id}
                    onClick={() => onSelectClient(client)}
                    className="hover:bg-sky-50/50 transition-colors cursor-pointer group"
                  >
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900 group-hover:text-sky-700 transition-colors">
                        {client.businessName}
                      </p>
                      <p className="text-[11px] text-slate-400">{client.email}</p>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                        {client.identificationNumber}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">{client.identificationType}</span>
                    </td>

                    <td className="py-3 px-4">
                      {srv ? (
                        <div>
                          <p className="font-bold text-slate-800">{srv.planName}</p>
                          <span className="text-emerald-700 font-bold text-[11px] bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                            ${srv.customPrice.toFixed(2)} / mes
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Sin servicio</span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          srv?.billingType === "prepago"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-sky-100 text-sky-800"
                        }`}
                      >
                        {srv?.billingType ? srv.billingType.toUpperCase() : "POSPAGO"}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      {client.requiresSriBilling ? (
                        <span className="text-emerald-700 font-bold text-[10px] flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Facturable
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px] flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5 text-slate-300" /> Exento
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          client.status === "activo"
                            ? "bg-emerald-100 text-emerald-800"
                            : client.status === "suspendido"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {client.status.toUpperCase()}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => handleDownloadContract(client, e)}
                          className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer"
                          title="Descargar Contrato Word"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onSelectClient(client)}
                          className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer"
                          title="Ver Ficha 360°"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`¿Eliminar al cliente ${client.businessName}?`)) {
                              deleteClient(client.id);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
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
    </div>
  );
}
