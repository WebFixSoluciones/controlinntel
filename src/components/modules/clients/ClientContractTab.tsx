"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { Client, ClientContractInfo } from "@/types";
import { generateAdhesionContractDocx, triggerBrowserDownload } from "@/lib/doc-generator";
import {
  ShieldCheck,
  Download,
  FileText,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Plus,
  X,
  Edit2,
} from "lucide-react";

interface ClientContractTabProps {
  client: Client;
}

export function ClientContractTab({ client }: ClientContractTabProps) {
  const { clientContracts, clientServices, addClientContract, updateClientContract } = useApp();
  const { showSuccess, showError } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [contractNumber, setContractNumber] = useState(`CONT-INNTEL-2026-${client.id.toUpperCase()}`);
  const [homologationCode, setHomologationCode] = useState("ARCOTEL-SAI-HOM-0841");
  const [signedDate, setSignedDate] = useState(new Date().toISOString().split("T")[0]);
  const [expirationDate, setExpirationDate] = useState(new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split("T")[0]);
  const [contractStatus, setContractStatus] = useState<ClientContractInfo["status"]>("vigente");

  const contracts = clientContracts.filter((c) => c.clientId === client.id);
  const activeService = clientServices.find((s) => s.clientId === client.id && s.status === "activo");

  const handleDownloadDocx = async (contract?: ClientContractInfo) => {
    try {
      const blob = await generateAdhesionContractDocx(client, activeService);
      triggerBrowserDownload(
        blob,
        `Contrato_Adhesion_ARCOTEL_${client.identificationNumber}_${contract?.contractNumber || "INNTEL"}.docx`
      );
      showSuccess("Contrato Descargado", `Modelo Word homologado generado para ${client.businessName}.`);
    } catch (e) {
      showError("Error", "No se pudo generar el archivo Word.");
    }
  };

  const handleSaveContract = (e: React.FormEvent) => {
    e.preventDefault();

    addClientContract({
      clientId: client.id,
      contractNumber,
      arcotelHomologationCode: homologationCode,
      planName: activeService?.planName || "Plan Fibra Óptica 100M",
      signedDate,
      expirationDate,
      status: contractStatus,
      monthlyPrice: activeService?.customPrice || 28.0,
      notes: "Contrato de adhesión registrado para servicio de acceso a internet SAI",
    });

    showSuccess("Contrato Guardado", "Registro contractual actualizado con éxito.");
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-4 select-none">
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
        <div>
          <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Contratos de Adhesión Homologados & Control ARCOTEL
          </h4>
          <p className="text-[11px] text-slate-400">
            Supervisión de plazos forzosos, vigencia de 12/24 meses y generación instantánea del modelo Word homologado
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleDownloadDocx()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Descargar Contrato Word (.docx)</span>
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Registrar Renovación</span>
          </button>
        </div>
      </div>

      {/* Contracts List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {contracts.length === 0 ? (
          <div className="col-span-full p-8 text-center bg-white rounded-2xl border border-dashed border-slate-200">
            <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-bold text-slate-600 text-xs">Sin contratos registrados</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Haz clic en "Descargar Contrato Word" para emitir el contrato estándar o "Registrar Renovación".
            </p>
          </div>
        ) : (
          contracts.map((cnt) => (
            <div
              key={cnt.id}
              className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                    {cnt.contractNumber}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      cnt.status === "vigente"
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        : cnt.status === "por_renovar"
                        ? "bg-amber-100 text-amber-800 border border-amber-200"
                        : "bg-rose-100 text-rose-800 border border-rose-200"
                    }`}
                  >
                    {cnt.status.replace("_", " ")}
                  </span>
                </div>

                <div className="mt-3 space-y-1.5 text-xs text-slate-700">
                  <p>
                    <span className="font-bold text-slate-900">Homologación ARCOTEL:</span>{" "}
                    <span className="font-mono font-bold text-sky-700">{cnt.arcotelHomologationCode}</span>
                  </p>
                  <p>
                    <span className="font-bold text-slate-900">Servicio Contratado:</span> {cnt.planName}
                  </p>
                  <p>
                    <span className="font-bold text-slate-900">Tarifa Mensual:</span>{" "}
                    <span className="font-mono font-bold text-emerald-700">${cnt.monthlyPrice.toFixed(2)} USD</span>
                  </p>
                </div>

                <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 block font-bold">Fecha Suscripción</span>
                    <span className="font-semibold text-slate-800">{cnt.signedDate}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-bold">Fecha Vencimiento</span>
                    <span className="font-semibold text-slate-800">{cnt.expirationDate}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-medium">Cláusulas Homologadas ARCOTEL</span>
                <button
                  onClick={() => handleDownloadDocx(cnt)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-sky-50 text-sky-700 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 border border-slate-200"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar Word</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Contract Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Registrar Término / Renovación
              </h4>
              <button onClick={() => setIsModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveContract} className="p-5 space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Número de Contrato *</label>
                <input
                  type="text"
                  required
                  value={contractNumber}
                  onChange={(e) => setContractNumber(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Código Homologación ARCOTEL</label>
                <input
                  type="text"
                  value={homologationCode}
                  onChange={(e) => setHomologationCode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Fecha de Firma</label>
                  <input
                    type="date"
                    value={signedDate}
                    onChange={(e) => setSignedDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Fecha Vencimiento</label>
                  <input
                    type="date"
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Estado Contractual</label>
                <select
                  value={contractStatus}
                  onChange={(e) => setContractStatus(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold"
                >
                  <option value="vigente">Vigente (Plazo Activo)</option>
                  <option value="por_renovar">Por Renovar (Próximo a Vencer)</option>
                  <option value="vencido">Vencido</option>
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 font-bold text-slate-600 cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-sm cursor-pointer">
                  Guardar Contrato
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
