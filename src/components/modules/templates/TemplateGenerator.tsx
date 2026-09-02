"use client";

import React from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { FileText, Download, CheckCircle2, FileSpreadsheet, Shield } from "lucide-react";
import {
  generateAdhesionContractDocx,
  generateSaiInfraExcel,
  generateBillingBatchExcel,
  generateArcotelRenewalLetterDocx,
  triggerBrowserDownload,
} from "@/lib/doc-generator";

export function TemplateGenerator() {
  const { clients, clientServices, nodes, policies, monthlyCharges } = useApp();
  const { showSuccess, showError, showWarning } = useToast();

  const handleDownloadContract = async () => {
    if (clients.length === 0) {
      showWarning("Sin Clientes", "No hay abonados registrados para generar el contrato.");
      return;
    }
    try {
      const client = clients[0];
      const srv = clientServices.find((s) => s.clientId === client.id);
      const blob = await generateAdhesionContractDocx(client, srv);
      triggerBrowserDownload(blob, `Contrato_Adhesion_ARCOTEL_${client.identificationNumber}.docx`);
      showSuccess("Contrato Generado", `Modelo homologado generado para ${client.businessName}.`);
    } catch (e) {
      showError("Error al Generar", "No se pudo crear el documento Word.");
    }
  };

  const handleDownloadSaiExcel = async () => {
    if (nodes.length === 0) {
      showWarning("Sin Nodos", "No hay infraestructura de red para exportar.");
      return;
    }
    try {
      const blob = await generateSaiInfraExcel(nodes);
      triggerBrowserDownload(blob, `Registro_Infraestructura_SAI_ARCOTEL_2026.xlsx`);
      showSuccess("Reporte SAI Generado", `Se exportó el inventario técnico de ${nodes.length} POPs.`);
    } catch (e) {
      showError("Error al Generar", "No se pudo generar el archivo Excel.");
    }
  };

  const handleDownloadBillingBatch = async () => {
    if (monthlyCharges.length === 0) {
      showWarning("Sin Comprobantes", "Emite el lote del Día 1 en el módulo de Finanzas primero.");
      return;
    }
    try {
      const blob = await generateBillingBatchExcel(monthlyCharges);
      triggerBrowserDownload(blob, `Lote_Cobranzas_PreFacturas_INNTEL_CORP.xlsx`);
      showSuccess("Lote Generado", `Archivo Excel listo con las órdenes de pedido y pre-facturas emitidas.`);
    } catch (e) {
      showError("Error al Generar", "No se pudo generar el lote de cobros.");
    }
  };

  const handleDownloadRenewalLetter = async () => {
    if (policies.length === 0) {
      showWarning("Sin Pólizas", "No hay pólizas registradas para solicitar renovación.");
      return;
    }
    try {
      const blob = await generateArcotelRenewalLetterDocx(policies[0]);
      triggerBrowserDownload(blob, `Oficio_Renovacion_ARCOTEL_${policies[0].policyNumber}.docx`);
      showSuccess("Oficio QUIPUX Generado", `Borrador oficial para ARCOTEL listo en Word.`);
    } catch (e) {
      showError("Error al Generar", "No se pudo generar el oficio formal.");
    }
  };

  const TEMPLATES = [
    {
      title: "Contrato de Adhesión para Servicio de Internet (SAI)",
      desc: "Modelo formal homologado por ARCOTEL con cláusulas de SLA, comparecientes y tarifas.",
      format: "Word (.docx)",
      icon: FileText,
      color: "bg-[#eff4ff] text-[#004ac6] border-[#dce9ff]",
      action: handleDownloadContract,
    },
    {
      title: "Registro de Infraestructura de Red SAI",
      desc: "Formulario técnico de POPs, coordenadas, capacidades y proveedores para reporte ARCOTEL.",
      format: "Excel (.xlsx)",
      icon: FileSpreadsheet,
      color: "bg-[#ecfdf5] text-[#059669] border-[#a7f3d0]",
      action: handleDownloadSaiExcel,
    },
    {
      title: "Lote de Órdenes de Pedido & Pre-Facturas Internas",
      desc: "Estructura estándar de cotizaciones, tarifas mensuales y seguimiento de cobros por cliente.",
      format: "Excel (.xlsx)",
      icon: FileSpreadsheet,
      color: "bg-[#eff4ff] text-[#004ac6] border-[#dce9ff]",
      action: handleDownloadBillingBatch,
    },
    {
      title: "Oficio Formal de Renovación de Póliza ARCOTEL",
      desc: "Documento oficial dirigido a la Dirección Ejecutiva de ARCOTEL para ingreso en QUIPUX.",
      format: "Word (.docx)",
      icon: Shield,
      color: "bg-[#f5f3ff] text-[#712ae2] border-[#ddd6fe]",
      action: handleDownloadRenewalLetter,
    },
  ];

  return (
    <div className="space-y-6 select-none">
      <div>
        <h1 className="text-2xl font-bold text-[#0b1c30] tracking-tight flex items-center gap-2">
          <FileText className="w-6 h-6 text-[#004ac6]" />
          Automatización de Plantillas Regulatorias & Comerciales
        </h1>
        <p className="text-xs text-[#737686] mt-0.5">
          Generación instantánea de contratos Word, cuadros tarifarios y reportes regulatorios con inyección de datos en vivo
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {TEMPLATES.map((tmpl, idx) => {
          const Icon = tmpl.icon;
          return (
            <div
              key={idx}
              className="p-6 rounded-2xl bg-white border border-[#e2e8f0] shadow-lumina-card flex flex-col justify-between hover:border-[#cbd5e1] transition-all"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className={`p-3 rounded-xl border ${tmpl.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold font-mono text-[#434655] bg-[#f8f9ff] px-2.5 py-0.5 rounded-md border border-[#e2e8f0]">
                    {tmpl.format}
                  </span>
                </div>

                <h3 className="font-bold text-base text-[#0b1c30] mt-4">{tmpl.title}</h3>
                <p className="text-xs text-[#737686] mt-1 leading-relaxed">{tmpl.desc}</p>
              </div>

              <div className="mt-6 pt-4 border-t border-[#f1f5f9] flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#059669] flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" /> Listo para Descarga
                </span>
                <button
                  onClick={tmpl.action}
                  className="px-4 py-2 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Generar {tmpl.format.split(" ")[0]}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
