"use client";

import React from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { FileText, Download, CheckCircle2, FileSpreadsheet, Shield } from "lucide-react";
import {
  generateAdhesionContractDocx,
  generateSaiInfraExcel,
  generateSriBillingBatchExcel,
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

  const handleDownloadSriBatch = async () => {
    if (monthlyCharges.length === 0) {
      showWarning("Sin Comprobantes", "Emite el lote del Día 1 en el módulo de Finanzas primero.");
      return;
    }
    try {
      const blob = await generateSriBillingBatchExcel(monthlyCharges);
      triggerBrowserDownload(blob, `Lote_Facturacion_SRI_INNTEL_CORP.xlsx`);
      showSuccess("Lote SRI Generado", `Archivo Excel listo para alimentar el sistema de facturación.`);
    } catch (e) {
      showError("Error al Generar", "No se pudo generar el lote para el SRI.");
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
      color: "bg-sky-50 text-sky-700 border-sky-200",
      action: handleDownloadContract,
    },
    {
      title: "Registro de Infraestructura de Red SAI",
      desc: "Formulario técnico de POPs, coordenadas, capacidades y proveedores para reporte ARCOTEL.",
      format: "Excel (.xlsx)",
      icon: FileSpreadsheet,
      color: "bg-emerald-50 text-emerald-700 border-emerald-200",
      action: handleDownloadSaiExcel,
    },
    {
      title: "Lote de Facturación Electrónica para SRI",
      desc: "Estructura estándar compatible para alimentar el software de facturación y emisión oficial SRI.",
      format: "Excel (.xlsx)",
      icon: FileSpreadsheet,
      color: "bg-indigo-50 text-indigo-700 border-indigo-200",
      action: handleDownloadSriBatch,
    },
    {
      title: "Oficio Formal de Renovación de Póliza ARCOTEL",
      desc: "Documento oficial dirigido a la Dirección Ejecutiva de ARCOTEL para ingreso en QUIPUX.",
      format: "Word (.docx)",
      icon: Shield,
      color: "bg-purple-50 text-purple-700 border-purple-200",
      action: handleDownloadRenewalLetter,
    },
  ];

  return (
    <div className="space-y-6 select-none">
      <div>
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <FileText className="w-5 h-5 text-sky-600" />
          Automatización de Plantillas Regulatorias & Comerciales
        </h2>
        <p className="text-xs text-slate-400">
          Generación instantánea de contratos Word, cuadros tarifarios y reportes regulatorios con inyección de datos en vivo
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TEMPLATES.map((tmpl, idx) => {
          const Icon = tmpl.icon;
          return (
            <div
              key={idx}
              className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-md transition-all"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className={`p-2.5 rounded-xl border ${tmpl.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                    {tmpl.format}
                  </span>
                </div>

                <h3 className="font-bold text-sm text-slate-900 mt-3.5">{tmpl.title}</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{tmpl.desc}</p>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Listo para Descarga
                </span>
                <button
                  onClick={tmpl.action}
                  className="px-3.5 py-1.5 bg-slate-900 hover:bg-sky-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
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
