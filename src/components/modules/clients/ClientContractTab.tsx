"use client";

import React from "react";
import { Client } from "@/types";
import { ContractsManager } from "./ContractsManager";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { generateAdhesionContractDocx, triggerBrowserDownload } from "@/lib/doc-generator";
import { Download, FileText } from "lucide-react";

export function ClientContractTab({ client }: { client: Client }) {
  const { clientServices } = useApp();
  const { showError, showSuccess } = useToast();

  const handleDownloadTemplate = async () => {
    try {
      const service = clientServices.find((s) => s.clientId === client.id && s.status === "activo");
      const blob = await generateAdhesionContractDocx(client, service);
      triggerBrowserDownload(blob, `Modelo_Adhesion_${client.identificationNumber}.docx`);
      showSuccess("Descarga Exitosa", `Borrador oficial para ${client.businessName} descargado.`);
    } catch {
      showError("Error", "No se pudo generar el modelo Word.");
    }
  };

  return (
    <div className="space-y-5 select-none">
      <ContractsManager clientId={client.id} />
      
      <div className="p-4 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#004ac6] flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-xs text-[#0b1c30]">Modelo Homologado ARCOTEL en Formato Word (.docx)</h4>
            <span className="text-[11px] text-[#737686]">Plantilla institucional pre-llenada con los datos legales del abonado</span>
          </div>
        </div>

        <button
          onClick={handleDownloadTemplate}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-[#cbd5e1] hover:border-[#004ac6] hover:text-[#004ac6] text-[#434655] rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-[#004ac6]" />
          <span>Descargar Contrato Adhesión Word</span>
        </button>
      </div>
    </div>
  );
}
