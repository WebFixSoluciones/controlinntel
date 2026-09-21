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
  Plus,
  X,
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

  const handleSaveContract = async (e: React.FormEvent) => {
    try {

    e.preventDefault();

    await addClientContract({
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
  
    } catch (error) { window.dispatchEvent(new CustomEvent("inntel:error", { detail: error instanceof Error ? error.message : "No se pudo guardar." })); }
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
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[1050px] w-full text-left text-xs">
          <caption className="sr-only">Contratos de adhesión del cliente</caption>
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              <th scope="col" className="px-5 py-3 font-bold">Contrato</th>
              <th scope="col" className="px-5 py-3 font-bold">Homologación ARCOTEL</th>
              <th scope="col" className="px-5 py-3 font-bold">Servicio</th>
              <th scope="col" className="px-5 py-3 font-bold">Tarifa mensual</th>
              <th scope="col" className="px-5 py-3 font-bold">Vigencia</th>
              <th scope="col" className="px-5 py-3 font-bold">Estado</th>
              <th scope="col" className="px-5 py-3 text-right font-bold">Documento</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-800">
            {contracts.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center">
                  <FileText className="mx-auto mb-2 size-8 text-slate-300" />
                  <p className="font-bold text-slate-600">Sin contratos registrados</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Haz clic en &quot;Descargar Contrato Word&quot; para emitir el contrato estándar o &quot;Registrar Renovación&quot;.
                  </p>
                </td>
              </tr>
            ) : contracts.map((cnt) => (
              <tr key={cnt.id} className="hover:bg-slate-50">
                <th scope="row" className="px-5 py-4 font-mono font-bold text-slate-900">{cnt.contractNumber}</th>
                <td className="px-5 py-4 font-mono font-bold text-sky-700">{cnt.arcotelHomologationCode}</td>
                <td className="px-5 py-4 font-semibold">{cnt.planName}</td>
                <td className="px-5 py-4 font-mono font-bold text-emerald-700">${cnt.monthlyPrice.toFixed(2)} USD</td>
                <td className="px-5 py-4">
                  <div className="font-semibold">Firma: {cnt.signedDate}</div>
                  <div className="mt-0.5 text-[11px] text-slate-500">Vence: {cnt.expirationDate}</div>
                </td>
                <td className="px-5 py-4">
                  <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                    cnt.status === "vigente"
                      ? "border-emerald-200 bg-emerald-100 text-emerald-800"
                      : cnt.status === "por_renovar"
                      ? "border-amber-200 bg-amber-100 text-amber-800"
                      : "border-rose-200 bg-rose-100 text-rose-800"
                  }`}>
                    {cnt.status.replace("_", " ")}
                  </span>
                </td>
                <td className="px-5 py-4 text-right">
                  <button
                    onClick={() => void handleDownloadDocx(cnt)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-bold text-sky-700 hover:bg-sky-50"
                  >
                    <Download className="size-3.5" />
                    <span>Descargar Word</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Contract Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Registrar Término / Renovación
              </h4>
              <button onClick={() => setIsModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveContract} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
