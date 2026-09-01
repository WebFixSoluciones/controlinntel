import { Document, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel, Packer } from "docx";
import ExcelJS from "exceljs";
import { Client, ClientService, ArcotelPolicy } from "@/types";

export function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export async function generateAdhesionContractDocx(client: Client, service?: ClientService): Promise<Blob> {
  const dateStr = new Date().toLocaleDateString("es-EC", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "INNTEL CORP — SERVICIOS DE TELECOMUNICACIONES",
                bold: true,
                size: 28,
                color: "0066B3",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "CONTRATO DE ADHESIÓN PARA LA PRESTACIÓN DEL SERVICIO DE ACCESO A INTERNET (SAI)",
                bold: true,
                size: 22,
                color: "333333",
              }),
            ],
            spacing: { after: 300 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Comparecen por una parte INNTEL CORP S.A., portadora del Título Habilitante conferido por la ARCOTEL; y por otra parte el/la ABONADO(A) ${client.businessName}, con Cédula/RUC ${client.identificationNumber}.`,
                size: 20,
              }),
            ],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Plan: ${service?.planName || "Fibra Óptica 100M"} | Tarifa: $${(service?.customPrice || 28.0).toFixed(2)} USD + IVA mensual | Dirección: ${client.address}`,
                size: 20,
              }),
            ],
            spacing: { after: 400 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Firmado en Quito D.M., a ${dateStr}.`,
                italics: true,
                size: 18,
              }),
            ],
          }),
        ],
      },
    ],
  });

  return await Packer.toBlob(doc);
}

export async function generateSaiInfraExcel(nodes: any[]): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Infraestructura SAI ARCOTEL");

  sheet.getRow(1).values = ["ID NODO", "NOMBRE NODO", "DIRECCION", "PROVEEDOR TRANSITO", "CAPACIDAD MBPS", "CLIENTES"];
  nodes.forEach((n) => {
    sheet.addRow([n.id, n.name, n.address, n.upstreamProvider, n.totalCapacityMbps, n.activeClientsCount]);
  });

  sheet.columns.forEach((col) => {
    col.width = 25;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export async function generateBillingBatchExcel(charges: any[]): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Lote Cobranzas y Pre-Facturas");

  sheet.getRow(1).values = [
    "TIPO_DOC",
    "RUC_CEDULA_CLIENTE",
    "RAZON_SOCIAL_CLIENTE",
    "MES",
    "ANIO",
    "DESCRIPCION",
    "SUBTOTAL_15",
    "IVA_15",
    "TOTAL",
    "ESTADO",
  ];

  charges.forEach((c) => {
    sheet.addRow(["PRE-FACTURA", c.clientRuc, c.clientName, c.month, c.year, c.serviceDescription, c.subtotal, c.ivaAmount, c.total, c.status]);
  });

  sheet.columns.forEach((col) => {
    col.width = 20;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export const generateSriBillingBatchExcel = generateBillingBatchExcel;

export async function generateArcotelRenewalLetterDocx(policy: ArcotelPolicy): Promise<Blob> {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({
                text: `Quito D.M., ${new Date().toLocaleDateString("es-EC")}\nOficio No. INNTEL-REG-2026-${policy.id}`,
                bold: true,
                size: 20,
              }),
            ],
            spacing: { after: 300 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Señor(a)\nDIRECTOR(A) EJECUTIVO(A)\nAGENCIA DE REGULACIÓN Y CONTROL DE LAS TELECOMUNICACIONES (ARCOTEL)\n\n",
                bold: true,
                size: 20,
              }),
              new TextRun({
                text: `Asunto: Renovación de Póliza ${policy.policyNumber} (${policy.insuranceCompany}) por valor de $${policy.insuredAmount.toFixed(2)} USD.`,
                size: 20,
              }),
            ],
          }),
        ],
      },
    ],
  });

  return await Packer.toBlob(doc);
}
