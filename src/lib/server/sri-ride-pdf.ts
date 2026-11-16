import { jsPDF } from "jspdf";
import autoTableModule from "jspdf-autotable";
import JsBarcode from "jsbarcode";
import type { SriCompanyConfig, SriInvoice } from "@/types";
import { normalizarPagosFactura, mapearFormaPagoSRI } from "../sri-service.ts";
import { fiscalMailLabels, fiscalMailRecipient, type FiscalMailKind } from "./fiscal-email-format.ts";
import type { RecordData } from "../commercial-core.ts";
import { inntelEmailLogo } from "./email-brand.ts";
const autoTable = typeof autoTableModule === "function" ? autoTableModule : (autoTableModule as { default: typeof autoTableModule }).default;

/** Standalone RIDE for the authorized invoice attached to the delivery email. */
export function invoiceRidePdf(invoice: SriInvoice, currentConfig: SriCompanyConfig): Buffer {
  if (invoice.estadoSRI !== "AUTORIZADO" || !invoice.xmlAutorizado) throw new Error("El RIDE requiere una factura autorizada.");
  const config = { ...currentConfig, ...invoice.fiscalIssuer };
  const pdf = new jsPDF({ compress: false });
  const cash = (value: number) => Number(value || 0).toFixed(2);
  pdf.setFont("helvetica", "bold").setFontSize(13);
  const logo = pdf.getImageProperties(inntelEmailLogo);
  pdf.addImage(inntelEmailLogo, "PNG", 169, 7, 22, 22 * logo.height / logo.width, undefined, "FAST");
  const companyLines = pdf.splitTextToSize(config.razonSocial, 142);
  pdf.text(companyLines, 16, 18);
  pdf.setFontSize(10).setFont("helvetica", "normal");
  autoTable(pdf, { startY: 23 + companyLines.length * 5, theme: "plain", styles: { fontSize: 9, cellPadding: 2 }, body: [
    ["RUC", config.ruc, "FACTURA", invoice.documentNumber],
    ["Dirección matriz", config.direccionMatriz, "Fecha emisión", invoice.date],
    ["Establecimiento", config.direccionEstablecimiento || config.direccionMatriz, "Ambiente", invoice.ambiente === "1" ? "PRUEBAS · SIN VALIDEZ TRIBUTARIA" : "PRODUCCIÓN"],
    ["Obligado a llevar contabilidad", config.obligadoContabilidad ? "SI" : "NO", "Autorización", invoice.numeroAutorizacion || invoice.claveAcceso],
    ...(config.tipoContribuyente?.startsWith("rimpe") ? [["Régimen", config.tipoContribuyente === "rimpe_popular" ? "CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE" : "CONTRIBUYENTE RÉGIMEN RIMPE", "", ""]] : []),
    ...(config.contribuyenteEspecial ? [["Contribuyente especial", config.contribuyenteEspecial, "", ""]] : []),
    ...(config.resolucionAgenteRetencion ? [["Agente de retención", config.resolucionAgenteRetencion, "", ""]] : []),
    ["Cliente", invoice.clientName, "Identificación", invoice.clientRuc],
    ["Dirección cliente", invoice.clientAddress || "", "Fecha autorización", invoice.authorizationDate || ""],
  ] });
  let y = (pdf as any).lastAutoTable.finalY + 7;
  const encoded: { encodings?: { data: string }[] } = {};
  JsBarcode(encoded, invoice.claveAcceso, { format: "CODE128", displayValue: false, margin: 0 });
  const bits = encoded.encodings!.map(row => row.data).join("");
  const width = 178 / bits.length;
  pdf.setFillColor(0, 0, 0);
  for (let i = 0; i < bits.length; i++) if (bits[i] === "1") pdf.rect(16 + i * width, y, width, 12, "F");
  pdf.setFontSize(8).text(invoice.claveAcceso, 105, y + 17, { align: "center" });
  autoTable(pdf, { startY: y + 23, head: [["Código", "Descripción", "Cantidad", "P. unitario", "Descuento", "Base sin IVA"]],
    body: invoice.items.map(item => [item.sku || "", item.name, String(item.quantity), String(item.unitPrice), cash(item.discount), cash(item.subtotal)]),
    styles: { fontSize: 8 }, headStyles: { fillColor: [0, 74, 198] }, margin: { left: 16, right: 16 } });
  y = (pdf as any).lastAutoTable.finalY + 6;
  const bases = new Map<number, number>();
  for (const item of invoice.items) bases.set(item.ivaRate, (bases.get(item.ivaRate) || 0) + Math.round(item.subtotal * 100));
  autoTable(pdf, { startY: y, theme: "grid", styles: { fontSize: 9 }, body: [
    ...[...bases].sort(([a], [b]) => a - b).map(([rate, base]) => [`Subtotal ${rate}%`, cash(base / 100)]),
    ["Subtotal sin impuestos", cash(invoice.items.reduce((sum, item) => sum + item.subtotal, 0))],
    ["Descuento total", cash(invoice.discountTotal)], ["IVA", cash(invoice.ivaTotal)], ["VALOR TOTAL USD", cash(invoice.total)],
    ...normalizarPagosFactura(invoice, invoice.total).map(payment => [`Pago ${mapearFormaPagoSRI(payment.metodo)} · ${payment.metodo}`, cash(payment.monto)]),
    ["Plazo (días)", String(invoice.paymentTermDays || 0)], ["Observaciones", invoice.notes || ""],
  ], margin: { left: 105, right: 16 } });
  for (let i = 1; i <= pdf.getNumberOfPages(); i++) { pdf.setPage(i); pdf.setFontSize(8).text(`RIDE · ${invoice.documentNumber} · ${i}/${pdf.getNumberOfPages()}`, 105, 288, { align: "center" }); }
  return Buffer.from(pdf.output("arraybuffer"));
}

/** Complementary documents retain their own fields; a guide is never a zero-value invoice. */
export function fiscalRidePdf(kind: FiscalMailKind, row: RecordData, currentConfig: SriCompanyConfig): Buffer {
  if (kind === "factura") return invoiceRidePdf(row as SriInvoice, currentConfig);
  if (row.estadoSRI !== "AUTORIZADO" || !row.xmlAutorizado) throw new Error("El RIDE requiere un documento autorizado.");
  const company = { ...currentConfig, ...row.fiscalIssuer }, pdf = new jsPDF();
  const cash = (value: unknown) => Number(value || 0).toFixed(2);
  const logo = pdf.getImageProperties(inntelEmailLogo);
  pdf.addImage(inntelEmailLogo, "PNG", 16, 10, 24, 24 * logo.height / logo.width, undefined, "FAST");
  pdf.setFont("helvetica", "bold").setFontSize(12).text(fiscalMailLabels[kind].toUpperCase(), 50, 18);
  pdf.setFont("helvetica", "normal").setFontSize(10).text(row.documentNumber, 50, 25);
  const info = [
    ["Emisor", company.razonSocial, "RUC", company.ruc],
    ["Dirección matriz", company.direccionMatriz, "Emisión", row.date],
    ["Ambiente", row.ambiente === "1" ? "PRUEBAS - SIN VALIDEZ TRIBUTARIA" : "PRODUCCIÓN", "Autorización", row.numeroAutorizacion || row.claveAcceso],
    ["Fecha autorización", row.authorizationDate || "", "Emisión", "NORMAL"],
    [kind === "retencion" ? "Sujeto retenido" : "Destinatario / cliente", fiscalMailRecipient(row), "Identificación", row.clientRuc || row.destClientRuc],
    ["Dirección", row.clientAddress || row.destAddress || "", "Documento origen", row.invoiceNumber || row.modifiedInvoiceNumber || ""],
  ];
  if (company.contribuyenteEspecial) info.push(["Contribuyente especial", company.contribuyenteEspecial, "", ""]);
  if (company.resolucionAgenteRetencion) info.push(["Agente de retención", company.resolucionAgenteRetencion, "", ""]);
  info.push(["Obligado a llevar contabilidad", company.obligadoContabilidad ? "SI" : "NO", "Régimen", company.tipoContribuyente || "general"]);
  if (kind === "guia_remision") info.push(["Transportista", row.carrierName, "Identificación", row.carrierRuc], ["Placa", row.licensePlate, "Fechas de traslado", `${row.startDate} al ${row.endDate}`], ["Origen", row.originAddress, "Destino", row.destAddress], ["Motivo", row.reason, "Ruta", row.route]);
  if (kind === "retencion") info.push(["Período fiscal", row.fiscalPeriod, "Clave del sustento", row.support?.authorization || ""], ["Fecha del sustento", row.support?.date || "", "", ""]);
  if (kind === "nota_credito") info.push(["Motivo", row.reason, "Fecha factura origen", row.invoiceDate]);
  if (kind === "nota_debito") info.push(["Fecha factura origen", row.modifiedInvoiceDate, "", ""]);
  autoTable(pdf, { startY: 35, body: info, theme: "plain", styles: { fontSize: 8, cellPadding: 2 }, margin: { left: 16, right: 16 } });
  let y = (pdf as any).lastAutoTable.finalY + 5;
  if (y > 245) { pdf.addPage(); y = 16; }
  const encoded: { encodings?: { data: string }[] } = {};
  JsBarcode(encoded, row.claveAcceso, { format: "CODE128", displayValue: false, margin: 0 });
  const bits = encoded.encodings!.map(item => item.data).join("");
  pdf.setFillColor(0, 0, 0);
  for (let i = 0; i < bits.length; i++) if (bits[i] === "1") pdf.rect(16 + i * 178 / bits.length, y, 178 / bits.length, 12, "F");
  pdf.setFontSize(8).text(row.claveAcceso, 105, y + 17, { align: "center" });
  const head = kind === "retencion" ? ["Impuesto", "Código", "Base", "%", "Valor retenido"] : kind === "guia_remision" ? ["Código", "Descripción", "Cantidad", "Unidad"] : kind === "nota_debito" ? ["Motivo", "Valor"] : ["Código", "Descripción", "Cantidad", "P. unitario", "Descuento", "Base", "IVA"];
  const body = kind === "retencion" ? (row.items || []).map((item: RecordData) => [item.taxType, item.code, cash(item.taxBase), item.percentage, cash(item.retainedAmount)])
    : kind === "guia_remision" ? (row.items || []).map((item: RecordData) => [item.sku || "", item.name, item.quantity, item.unit])
    : kind === "nota_debito" ? (row.reasons || []).map((item: RecordData) => [item.reason, cash(item.amount)])
    : (row.items || []).map((item: RecordData) => [item.sku, item.name, item.quantity, item.unitPrice, cash(item.discount), cash(item.subtotal), cash(item.ivaAmount)]);
  autoTable(pdf, { startY: y + 23, head: [head], body, styles: { fontSize: 8 }, headStyles: { fillColor: [0, 74, 198] }, margin: { left: 16, right: 16 } });
  if (kind !== "guia_remision") autoTable(pdf, { startY: (pdf as any).lastAutoTable.finalY + 5, body: kind === "retencion" ? [["TOTAL RETENIDO USD", cash(row.totalRetained)]] : [["Subtotal sin impuestos", cash(row.subtotal ?? (row.items || []).reduce((sum: number, item: RecordData) => sum + Number(item.subtotal || 0), 0))], ["IVA", cash(row.ivaTotal ?? row.ivaAmount)], ["TOTAL USD", cash(row.total)]], styles: { fontSize: 9 }, margin: { left: 105, right: 16 } });
  for (let i = 1; i <= pdf.getNumberOfPages(); i++) { pdf.setPage(i); pdf.setFontSize(8).text(`${fiscalMailLabels[kind]} - ${row.documentNumber} - ${i}/${pdf.getNumberOfPages()}`, 105, 288, { align: "center" }); }
  return Buffer.from(pdf.output("arraybuffer"));
}
