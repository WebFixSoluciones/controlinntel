"use client";
import { Client } from "@/types";
import { ContractsManager } from "./ContractsManager";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { generateAdhesionContractDocx, triggerBrowserDownload } from "@/lib/doc-generator";

export function ClientContractTab({ client }: { client: Client }) {
  const { clientServices } = useApp();
  const { showError } = useToast();
  async function downloadTemplate() {
    try {
      const service = clientServices.find(s => s.clientId === client.id && s.status === "activo");
      const blob = await generateAdhesionContractDocx(client, service);
      triggerBrowserDownload(blob, `Modelo_Adhesion_${client.identificationNumber}.docx`);
    } catch { showError("Error", "No se pudo generar el modelo Word."); }
  }
  return <div className="space-y-4">
    <ContractsManager clientId={client.id} />
    <button onClick={() => void downloadTemplate()} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-blue-700">Descargar modelo de adhesión Word</button>
  </div>;
}
