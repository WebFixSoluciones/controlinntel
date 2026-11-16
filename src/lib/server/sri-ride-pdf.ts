import { jsPDF } from "jspdf";
import autoTableModule from "jspdf-autotable";
import JsBarcode from "jsbarcode";
import type { SriCompanyConfig, SriInvoice } from "@/types";
import { normalizarPagosFactura, mapearFormaPagoSRI } from "../sri-service.ts";
const autoTable = typeof autoTableModule === "function" ? autoTableModule : (autoTableModule as { default: typeof autoTableModule }).default;

/** Standalone RIDE for the authorized invoice attached to the delivery email. */
export function invoiceRidePdf(invoice: SriInvoice, currentConfig: SriCompanyConfig): Buffer {
  if (invoice.estadoSRI !== "AUTORIZADO" || !invoice.xmlAutorizado) throw new Error("El RIDE requiere una factura autorizada.");
  const config = { ...currentConfig, ...invoice.fiscalIssuer };
  const pdf = new jsPDF({ compress: false });
  const cash = (value: number) => Number(value || 0).toFixed(2);
  pdf.setFont("helvetica", "bold").setFontSize(13);
  const companyLines = pdf.splitTextToSize(config.razonSocial, 178);
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
