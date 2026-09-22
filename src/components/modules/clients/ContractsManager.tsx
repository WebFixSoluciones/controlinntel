"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { ClientContractInfo } from "@/types";
import { generateAdhesionContractDocx, triggerBrowserDownload } from "@/lib/doc-generator";
import { PoliciesList } from "../arcotel/PoliciesList";
import { PolicyModal } from "../arcotel/PolicyModal";
import {
  Search,
  Plus,
  ShieldCheck,
  FileText,
  Download,
  Edit2,
  RotateCcw,
  X,
  Shield,
  Calendar,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";

type Draft = Omit<ClientContractInfo, "id">;

export function ContractsManager({ clientId }: { clientId?: string }) {
  const { clients, clientContracts, clientServices, addClientContract, updateClientContract, policies } = useApp();
  const { showSuccess, showError } = useToast();

  const [activeTab, setActiveTab] = useState<"contratos" | "polizas">("contratos");
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);

  const [query, setQuery] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const clientName = (id: string) => clients.find((c) => c.id === id)?.businessName || "Abonado no disponible";

  const filteredContracts = clientContracts.filter((c) => {
    const matchesClientScope = !clientId || c.clientId === clientId;
    const matchesClientDropdown = !clientFilter || c.clientId === clientFilter;
    const matchesStatus = !status || c.status === status;
    const matchesFrom = !from || c.expirationDate >= from;
    const matchesUntil = !until || c.expirationDate <= until;
    const textTarget = `${clientName(c.clientId)} ${c.contractNumber} ${c.arcotelHomologationCode || ""} ${c.planName}`.toLowerCase();
    const matchesQuery = !query.trim() || textTarget.includes(query.trim().toLowerCase());

    return matchesClientScope && matchesClientDropdown && matchesStatus && matchesFrom && matchesUntil && matchesQuery;
  });

  const handleOpenForm = (contract?: ClientContractInfo) => {
    setEditingId(contract?.id || null);
    setDraft(
      contract
        ? { ...contract }
        : {
            clientId: clientId || clientFilter || (clients.length > 0 ? clients[0].id : ""),
            contractNumber: `CONT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
            arcotelHomologationCode: "ARCOTEL-SAI-2026",
            planName: "Plan Corporativo Fibra Óptica Dedicado",
            signedDate: new Date().toISOString().split("T")[0],
            expirationDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split("T")[0],
            status: "vigente",
            monthlyPrice: 120,
            notes: "Servicio de telecomunicaciones homologado bajo normativa ARCOTEL con SLA garantizado del 99.8%.",
          }
    );
    setFormError("");
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft || busy) return;

    if (
      !draft.clientId ||
      !draft.contractNumber.trim() ||
      !draft.planName.trim() ||
      !draft.signedDate ||
      !draft.expirationDate ||
      draft.expirationDate < draft.signedDate ||
      !Number.isFinite(draft.monthlyPrice) ||
      draft.monthlyPrice < 0
    ) {
      setFormError("Verifica los campos obligatorios: Abonado, Número, Servicio y Fechas coherentes.");
      return;
    }

    const isDuplicate = clientContracts.some(
      (c) =>
        c.id !== editingId &&
        c.clientId === draft.clientId &&
        c.contractNumber.trim().toLowerCase() === draft.contractNumber.trim().toLowerCase()
    );
    if (isDuplicate) {
      setFormError("Este abonado ya cuenta con un contrato registrado con ese número.");
      return;
    }

    setBusy(true);
    setFormError("");

    try {
      const data = {
        ...draft,
        contractNumber: draft.contractNumber.trim(),
        planName: draft.planName.trim(),
      };

      if (editingId) {
        await updateClientContract(editingId, data);
        showSuccess("Contrato Actualizado", `Contrato ${draft.contractNumber} actualizado con éxito.`);
      } else {
        await addClientContract(data);
        showSuccess("Contrato Registrado", `Contrato ${draft.contractNumber} registrado y sincronizado en la Ficha 360.`);
      }

      setIsFormOpen(false);
      setDraft(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al guardar el contrato.");
      showError("Error", "No se pudo guardar el contrato.");
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadDocx = async (contract: ClientContractInfo) => {
    const client = clients.find((c) => c.id === contract.clientId);
    if (!client) {
      showError("Error", "No se encontró el registro del cliente.");
      return;
    }
    const service = clientServices.find((s) => s.clientId === client.id);
    try {
      const blob = await generateAdhesionContractDocx(client, service);
      triggerBrowserDownload(blob, `Contrato_Adhesion_${contract.contractNumber}_${client.identificationNumber}.docx`);
      showSuccess("Descarga Exitosa", `Modelo Word generado para ${client.businessName}.`);
    } catch {
      showError("Error", "No se pudo generar el documento Word.");
    }
  };

  const renderStatusBadge = (contractStatus: ClientContractInfo["status"]) => {
    switch (contractStatus) {
      case "vigente":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Vigente
          </span>
        );
      case "por_renovar":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Por Renovar
          </span>
        );
      case "vencido":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            Vencido
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-50 text-slate-700 border border-slate-200">
            {contractStatus}
          </span>
        );
    }
  };

  const clearFilters = () => {
    setQuery("");
    setClientFilter("");
    setStatus("");
    setFrom("");
    setUntil("");
  };

  return (
    <div className="w-full space-y-6 select-none">
      {/* Top Header - Only when rendered as standalone page */}
      {!clientId && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#004ac6] to-[#1e293b] flex items-center justify-center text-white shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#0b1c30] tracking-tight">
                Contratos & Control Regulatorio ARCOTEL
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {activeTab === "contratos" ? (
              <button
                onClick={() => handleOpenForm()}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Registrar Contrato</span>
              </button>
            ) : (
              <button
                onClick={() => setIsPolicyModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Registrar Póliza</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tabs Switcher for standalone mode */}
      {!clientId && (
        <div className="flex items-center gap-2 border-b border-[#e2e8f0] pb-2">
          <button
            onClick={() => setActiveTab("contratos")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "contratos"
                ? "bg-[#004ac6] text-white shadow-xs"
                : "bg-white text-[#434655] hover:bg-[#f8f9ff] border border-[#e2e8f0]"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Contratos de Abonados (SAI)</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === "contratos" ? "bg-white/20 text-white" : "bg-slate-100 text-[#434655]"
              }`}
            >
              {clientContracts.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("polizas")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "polizas"
                ? "bg-[#004ac6] text-white shadow-xs"
                : "bg-white text-[#434655] hover:bg-[#f8f9ff] border border-[#e2e8f0]"
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Pólizas de Título Habilitante ARCOTEL</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === "polizas" ? "bg-white/20 text-white" : "bg-slate-100 text-[#434655]"
              }`}
            >
              {policies.length}
            </span>
          </button>
        </div>
      )}

      {/* Subtab Content: Pólizas */}
      {!clientId && activeTab === "polizas" ? (
        <>
          <PoliciesList onOpenNewModal={() => setIsPolicyModalOpen(true)} />
          <PolicyModal isOpen={isPolicyModalOpen} onClose={() => setIsPolicyModalOpen(false)} />
        </>
      ) : (
        /* Subtab Content: Contratos de Abonados */
        <div className="space-y-4">
          {/* Action Bar for Client 360 mode */}
          {clientId && (
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[#0b1c30] text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#004ac6]" />
                Contratos Homologados del Abonado
              </h3>
              <button
                onClick={() => handleOpenForm()}
                className="flex items-center gap-2 px-3.5 py-1.5 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nuevo Contrato</span>
              </button>
            </div>
          )}

          {/* Search & Filter Toolbar Card */}
          <div className="bg-white rounded-2xl border border-[#e2e8f0] p-4 shadow-lumina-card flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="w-4 h-4 text-[#737686] absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar contrato, servicio u homologación..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full bg-white text-xs text-[#0b1c30] rounded-xl pl-9 pr-3 py-2 border border-[#cbd5e1] focus:outline-hidden focus:border-[#004ac6] focus:ring-1 focus:ring-[#004ac6]"
                />
              </div>

              {!clientId && (
                <select
                  value={clientFilter}
                  onChange={(e) => setClientFilter(e.target.value)}
                  className="bg-white text-xs font-medium text-[#434655] rounded-xl px-3 py-2 border border-[#cbd5e1] focus:outline-hidden cursor-pointer max-w-xs"
                >
                  <option value="">Todos los Abonados</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.businessName}
                    </option>
                  ))}
                </select>
              )}

              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="bg-white text-xs font-medium text-[#434655] rounded-xl px-3 py-2 border border-[#cbd5e1] focus:outline-hidden cursor-pointer"
              >
                <option value="">Estado: Todos</option>
                <option value="vigente">Vigente</option>
                <option value="por_renovar">Por Renovar</option>
                <option value="vencido">Vencido</option>
              </select>

              <div className="flex items-center gap-1.5 text-xs text-[#737686]">
                <Calendar className="w-3.5 h-3.5" />
                <span className="text-[11px] font-semibold">Vence:</span>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="bg-white text-xs rounded-xl px-2.5 py-1.5 border border-[#cbd5e1] text-[#0b1c30]"
                />
                <span>a</span>
                <input
                  type="date"
                  value={until}
                  onChange={(e) => setUntil(e.target.value)}
                  className="bg-white text-xs rounded-xl px-2.5 py-1.5 border border-[#cbd5e1] text-[#0b1c30]"
                />
              </div>
            </div>

            {(query || clientFilter || status || from || until) && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#cbd5e1] text-xs font-semibold text-[#434655] hover:bg-[#f8f9ff] cursor-pointer transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#737686]" />
                <span>Limpiar</span>
              </button>
            )}
          </div>

          {/* Table Container Card */}
          <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-lumina-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[1000px]">
                <caption className="sr-only">Contratos de abonados registrados</caption>
                <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-[11px] uppercase tracking-wider border-b border-[#e2e8f0]">
                  <tr>
                    <th className="py-3.5 px-5">Abonado / Razón Social</th>
                    <th className="py-3.5 px-5">N° Contrato</th>
                    <th className="py-3.5 px-5">Servicio / Infraestructura</th>
                    <th className="py-3.5 px-5">Homologación</th>
                    <th className="py-3.5 px-5">Vigencia</th>
                    <th className="py-3.5 px-5 text-center">Estado</th>
                    <th className="py-3.5 px-5 text-right">Tarifa Mensual</th>
                    <th className="py-3.5 px-5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9] text-[#0b1c30]">
                  {filteredContracts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-xs text-[#737686]">
                        <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="font-bold text-slate-600">No se encontraron contratos registrados.</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Ajusta los filtros de búsqueda o registra un nuevo contrato.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredContracts.map((c) => (
                      <tr key={c.id} className="hover:bg-[#f8f9ff] transition-colors">
                        <td className="py-4 px-5">
                          <div className="font-bold text-[#0b1c30]">{clientName(c.clientId)}</div>
                          <div className="text-[10px] text-[#737686] font-mono">
                            {clients.find((cl) => cl.id === c.clientId)?.identificationNumber}
                          </div>
                        </td>
                        <td className="py-4 px-5 font-mono font-bold text-[#004ac6]">{c.contractNumber}</td>
                        <td className="py-4 px-5">
                          <div className="font-medium text-[#0b1c30]">{c.planName}</div>
                          {c.notes && <div className="text-[10px] text-[#737686] truncate max-w-xs">{c.notes}</div>}
                        </td>
                        <td className="py-4 px-5 font-mono text-[11px] font-semibold text-[#434655]">
                          {c.arcotelHomologationCode || "ARCOTEL-SAI-2026"}
                        </td>
                        <td className="py-4 px-5 whitespace-nowrap">
                          <div className="font-medium text-[#0b1c30]">{c.expirationDate}</div>
                          <div className="text-[10px] text-[#737686]">Desde: {c.signedDate}</div>
                        </td>
                        <td className="py-4 px-5 text-center">{renderStatusBadge(c.status)}</td>
                        <td className="py-4 px-5 text-right font-mono font-bold text-emerald-700">
                          ${c.monthlyPrice.toFixed(2)} USD
                        </td>
                        <td className="py-4 px-5 text-right">
                          <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                            <button
                              onClick={() => handleDownloadDocx(c)}
                              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-[#434655] hover:text-[#004ac6] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              title="Descargar Adhesión Word"
                            >
                              <Download className="w-3.5 h-3.5 text-[#004ac6]" />
                              <span>Word</span>
                            </button>
                            <button
                              onClick={() => handleOpenForm(c)}
                              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-[#004ac6] hover:bg-[#eff4ff] rounded-lg transition-colors cursor-pointer"
                              title="Editar contrato"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>Editar</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-3 px-5 border-t border-[#e2e8f0] bg-[#f8f9ff] flex items-center justify-between text-xs text-[#737686]">
              <span>
                Mostrando <strong className="text-[#0b1c30]">{filteredContracts.length}</strong> de{" "}
                <strong className="text-[#0b1c30]">{clientContracts.length}</strong> contratos totales
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Contract Create/Edit Modal */}
      {isFormOpen && draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-lumina-dropdown border border-[#e2e8f0] overflow-hidden my-8">
            <div className="p-4 px-6 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8f9ff]">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-[#004ac6]" />
                <h3 className="font-bold text-[#0b1c30] text-sm">
                  {editingId ? `Editar Contrato: ${draft.contractNumber}` : "Registrar Contrato de Abonado"}
                </h3>
              </div>
              <button
                onClick={() => setIsFormOpen(false)}
                className="p-1 rounded-lg text-[#737686] hover:text-[#0b1c30] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
              <fieldset disabled={busy} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-[#434655] block mb-1">Abonado / Cliente *</label>
                  <select
                    required
                    disabled={!!clientId || !!editingId}
                    className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-xs font-semibold text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent disabled:bg-slate-100"
                    value={draft.clientId}
                    onChange={(e) => setDraft({ ...draft, clientId: e.target.value })}
                  >
                    <option value="">Selecciona un abonado</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.businessName} ({c.identificationNumber})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-[#434655] block mb-1">Número de Contrato *</label>
                  <input
                    required
                    type="text"
                    className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#004ac6] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                    value={draft.contractNumber}
                    onChange={(e) => setDraft({ ...draft, contractNumber: e.target.value })}
                  />
                </div>

                <div>
                  <label className="font-bold text-[#434655] block mb-1">Servicio / Plan Contratado *</label>
                  <input
                    required
                    type="text"
                    className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-xs font-medium text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                    value={draft.planName}
                    onChange={(e) => setDraft({ ...draft, planName: e.target.value })}
                  />
                </div>

                <div>
                  <label className="font-bold text-[#434655] block mb-1">Código de Homologación ARCOTEL</label>
                  <input
                    type="text"
                    className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-xs font-mono font-semibold text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                    value={draft.arcotelHomologationCode || ""}
                    onChange={(e) => setDraft({ ...draft, arcotelHomologationCode: e.target.value })}
                  />
                </div>

                <div>
                  <label className="font-bold text-[#434655] block mb-1">Fecha de Inicio *</label>
                  <input
                    required
                    type="date"
                    className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-xs font-medium text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                    value={draft.signedDate}
                    onChange={(e) => setDraft({ ...draft, signedDate: e.target.value })}
                  />
                </div>

                <div>
                  <label className="font-bold text-[#434655] block mb-1">Fecha de Vencimiento *</label>
                  <input
                    required
                    type="date"
                    min={draft.signedDate}
                    className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-xs font-medium text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                    value={draft.expirationDate}
                    onChange={(e) => setDraft({ ...draft, expirationDate: e.target.value })}
                  />
                </div>

                <div>
                  <label className="font-bold text-[#434655] block mb-1">Tarifa Mensual (USD) *</label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-xs font-mono font-bold text-emerald-700 focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                    value={draft.monthlyPrice}
                    onChange={(e) => setDraft({ ...draft, monthlyPrice: Number(e.target.value) })}
                  />
                </div>

                <div>
                  <label className="font-bold text-[#434655] block mb-1">Estado de Vigencia *</label>
                  <select
                    className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-xs font-semibold text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                    value={draft.status}
                    onChange={(e) => setDraft({ ...draft, status: e.target.value as ClientContractInfo["status"] })}
                  >
                    <option value="vigente">Vigente</option>
                    <option value="por_renovar">Por Renovar</option>
                    <option value="vencido">Vencido</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="font-bold text-[#434655] block mb-1">
                    Condiciones Particulares & Especificaciones del Servicio
                  </label>
                  <textarea
                    rows={4}
                    className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-xs font-medium text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                    value={draft.notes || ""}
                    onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                    placeholder="Detalles de ancho de banda, permanencia mínima, SLA, equipos entregados..."
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
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2.5 text-[#737686] hover:bg-slate-100 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-5 py-2.5 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-2"
                >
                  {busy ? "Guardando..." : "Guardar Contrato"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
