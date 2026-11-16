import { jsPDF } from "jspdf";
import autoTableModule from "jspdf-autotable";
import JsBarcode from "jsbarcode";
import type { SriCompanyConfig, SriInvoice } from "@/types";
import { normalizarPagosFactura, mapearFormaPagoSRI, numeroALetrasDolares } from "../sri-service.ts";
import { fiscalMailLabels, fiscalMailRecipient, type FiscalMailKind } from "./fiscal-email-format.ts";
import type { RecordData } from "../commercial-core.ts";
import { inntelEmailLogo } from "./email-brand.ts";
const autoTable = typeof autoTableModule === "function" ? autoTableModule : (autoTableModule as { default: typeof autoTableModule }).default;

export const INNTEL_RIDE_VERSION = "inntel-a4-v2";

/** The authorized A4 used by preview, printing, downloading and email. */
export function invoiceRidePdf(invoice: SriInvoice, currentConfig: SriCompanyConfig): Buffer {
  if (invoice.estadoSRI !== "AUTORIZADO" || !invoice.xmlAutorizado) throw new Error("El RIDE requiere una factura autorizada.");
  const company = { ...currentConfig, ...invoice.fiscalIssuer }, row = invoice as SriInvoice & { sourceNumber?: string; guideNumber?: string };
  const pdf = new jsPDF({ compress: false });
  pdf.setProperties({ title: `FACTURA ELECTRÓNICA ${invoice.documentNumber}`, subject: INNTEL_RIDE_VERSION, author: company.razonSocial, creator: "INNTEL CORP" });
  const cash = (value: unknown) => Number(value || 0).toFixed(2);
  const date = (value?: string) => value ? value.slice(0, 10).split("-").reverse().join("/") : "N/D";
  const fit = (text: unknown, x: number, y: number, width: number, size = 7, font = "helvetica", weight = "normal") => {
    const value = String(text ?? ""); pdf.setFont(font, weight).setFontSize(size);
    if (pdf.getTextWidth(value) > width) pdf.setFontSize(size * width / pdf.getTextWidth(value));
    pdf.text(value, x, y); // Never slice, wrap or ellipsize authorization digits.
  };
  const label = (name: string, value: unknown, x: number, y: number, width: number, size = 7) => {
    pdf.setFont("helvetica", "bold").setFontSize(size);
    const prefix = name + " ", offset = pdf.getTextWidth(prefix);
    pdf.text(prefix, x, y); pdf.setFont("helvetica", "normal");
    const lines = pdf.splitTextToSize(String(value || "N/D"), Math.max(10, width - offset));
    pdf.text(lines[0] || "", x + offset, y);
    for (let i = 1; i < lines.length; i++) pdf.text(lines[i], x, y + i * 3.4);
    return y + Math.max(1, lines.length) * 3.4;
  };
  pdf.setTextColor(15, 23, 42);
  fit(company.razonSocial, 12, 14, 91, 8.3, "helvetica", "bold");
  const logo = pdf.getImageProperties(inntelEmailLogo);
  pdf.addImage(inntelEmailLogo, "PNG", 12, 18, 14, 14 * logo.height / logo.width, undefined, "FAST");
  pdf.setTextColor(0, 74, 198); fit(company.nombreComercial, 29, 20, 72, 7.4, "helvetica", "bold");
  pdf.setTextColor(15, 23, 42);
  let left = 24;
  for (const [name, value] of [["RUC:", company.ruc], ["Dirección matriz:", company.direccionMatriz], ["Teléfono:", company.telefonoContacto || "N/D"], ["Obligado a llevar contabilidad:", company.obligadoContabilidad ? "SI" : "NO"], ["Régimen:", (company.tipoContribuyente || "general").replaceAll("_", " ").toUpperCase()]]) left = label(name!, value, 29, left, 72, 6.8);
  if (company.direccionEstablecimiento && company.direccionEstablecimiento !== company.direccionMatriz) left = label("Sucursal:", company.direccionEstablecimiento, 12, left, 91);
  if (company.contribuyenteEspecial) left = label("Contribuyente especial:", company.contribuyenteEspecial, 12, left, 91);
  if (company.resolucionAgenteRetencion) left = label("Agente de retención:", company.resolucionAgenteRetencion, 12, left, 91);
  fit(`Ambiente: ${invoice.ambiente === "1" ? "PRUEBAS" : "PRODUCCIÓN"}`, 107, 14, 52, 7);
  fit("Emisión: NORMAL", 169, 14, 29, 7);
  fit("Clave de acceso:", 107, 19, 90, 6.8, "helvetica", "bold");
  fit(invoice.claveAcceso, 107, 22.5, 90, 6.3, "courier");
  fit("N.º autorización:", 107, 27, 90, 6.8, "helvetica", "bold");
  fit(invoice.numeroAutorizacion || invoice.claveAcceso, 107, 30.5, 90, 6.3, "courier");
  const authorizedAt = invoice.authorizationDate && Number.isFinite(Date.parse(invoice.authorizationDate)) ? new Date(invoice.authorizationDate).toLocaleString("es-EC", { timeZone: "America/Guayaquil" }) : "N/D";
  fit(`Fecha y hora de autorización: ${authorizedAt}`, 107, 35.5, 90, 6.7);
  const encoded: { encodings?: { data: string }[] } = {};
  JsBarcode(encoded, invoice.claveAcceso, { format: "CODE128", displayValue: false, margin: 0 });
  const bits = encoded.encodings!.map(item => item.data).join("");
  pdf.setFillColor(0, 0, 0);
  for (let i = 0; i < bits.length; i++) if (bits[i] === "1") pdf.rect(118 + i * 69 / bits.length, 39, 69 / bits.length, 8, "F");
  fit(invoice.claveAcceso, 113, 50, 80, 5.3, "courier");
  if (invoice.ambiente === "1") { pdf.setTextColor(180, 83, 9); fit("COMPROBANTE DE PRUEBAS · SIN VALIDEZ TRIBUTARIA", 107, 54, 90, 6.2); }
  pdf.setTextColor(15, 23, 42);
  const headerBottom = Math.max(65, left + 3);
  pdf.setDrawColor(203, 213, 225).setLineWidth(0.25); pdf.rect(10, 10, 190, headerBottom - 10); pdf.line(105, 10, 105, headerBottom); pdf.line(107, headerBottom - 7, 198, headerBottom - 7);
  fit(`FACTURA ELECTRÓNICA ${invoice.documentNumber}`, 107, headerBottom - 3, 90, 7.3, "helvetica", "bold");
  const customerTop = headerBottom + 3;
  let customerLeft = customerTop + 4, customerRight = customerLeft;
  for (const [name, value] of [["CLIENTE:", invoice.clientName], ["DIRECCIÓN:", invoice.clientAddress], ["CI O RUC:", invoice.clientRuc], ["TELÉFONO:", invoice.clientPhone], ["EMAIL:", invoice.clientEmail]]) customerLeft = label(name!, value, 12, customerLeft, 91, 7);
  for (const [name, value] of [["DOC. INTERNO:", row.sourceNumber || (invoice.relatedSaleId ? "Nota de venta vinculada" : "Ninguno")], ["DOC. REFERENCIA:", invoice.orderNumber || "Ninguno"], ["GUÍA DE REMISIÓN:", row.guideNumber || "Sin guía"], ["FECHA EMISIÓN:", date(invoice.date)], ...(invoice.creditDueDate ? [["FECHA VENCIMIENTO:", date(invoice.creditDueDate)]] : [])]) customerRight = label(name!, value, 107, customerRight, 91, 7);
  const customerBottom = Math.max(customerLeft, customerRight) + 1;
  pdf.rect(10, customerTop, 190, customerBottom - customerTop);
  autoTable(pdf, { startY: customerBottom + 3, head: [["Cod. principal", "Cant.", "Descripción", "Precio unitario", "Descuento", "Subtotal sin IVA"]],
    body: invoice.items.map(item => [item.sku || "", Number.isInteger(item.quantity) ? item.quantity.toFixed(2) : String(item.quantity), item.name + (item.description ? `\n${item.description}` : ""), `$${cash(item.unitPrice)}`, `$${cash(item.discount)}`, `$${cash(item.subtotal)}`]),
    theme: "plain", styles: { font: "helvetica", fontSize: 7.2, cellPadding: 2, textColor: [15, 23, 42], lineColor: [226, 232, 240], lineWidth: 0.1 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold" }, columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 15 }, 2: { cellWidth: 70 }, 3: { cellWidth: 27, halign: "right" }, 4: { cellWidth: 23, halign: "right" }, 5: { cellWidth: 30, halign: "right" } },
    margin: { left: 10, right: 10, top: 14, bottom: 18 }, rowPageBreak: "avoid" });
  let y = (pdf as any).lastAutoTable.finalY + 4;
  const notes = [invoice.warehouseName ? `Bodega de despacho: ${invoice.warehouseName}` : "", invoice.notes ? `Observaciones: ${invoice.notes}` : ""].filter(Boolean).join("\n") || "Sin observaciones adicionales.";
  const noteLines = pdf.splitTextToSize(notes, 104).length;
  const estimated = Math.max(55, 25 + noteLines * 3.5 + normalizarPagosFactura(invoice, invoice.total).length * 10);
  if (y + estimated > 274) { pdf.addPage(); y = 16; }
  const summaryPage = pdf.getCurrentPageInfo().pageNumber;
  autoTable(pdf, { startY: y, head: [["INFORMACIÓN ADICIONAL"]], body: [[notes]], theme: "grid", styles: { fontSize: 7.2, cellPadding: 2, textColor: [15, 23, 42], lineColor: [203, 213, 225], lineWidth: 0.2 }, headStyles: { fillColor: [248, 250, 252], textColor: [15, 23, 42] }, margin: { left: 10, right: 90, bottom: 18 } });
  autoTable(pdf, { startY: (pdf as any).lastAutoTable.finalY + 3, head: [["FORMA DE PAGO", "VALOR", "PLAZO", "TIEMPO"]],
    body: normalizarPagosFactura(invoice, invoice.total).map(payment => [`${mapearFormaPagoSRI(payment.metodo)} - ${payment.metodo.toUpperCase()}`, `$${cash(payment.monto)}`, String(payment.metodo === "credito" ? invoice.paymentTermDays || 0 : 0), "Días"]), theme: "grid", styles: { fontSize: 7, cellPadding: 2, textColor: [15, 23, 42], lineColor: [203, 213, 225], lineWidth: 0.2 }, headStyles: { fillColor: [248, 250, 252], textColor: [15, 23, 42] }, margin: { left: 10, right: 90, bottom: 18 } });
  const leftEnd = (pdf as any).lastAutoTable.finalY, lastLeftPage = pdf.getCurrentPageInfo().pageNumber;
  pdf.setPage(summaryPage);
  const bases = new Map<number, number>();
  for (const item of invoice.items) bases.set(item.ivaRate, (bases.get(item.ivaRate) || 0) + Math.round(item.subtotal * 100));
  const totals = [...[...bases].sort(([a], [b]) => b - a).map(([rate, base]) => [`SUBTOTAL ${rate}%:`, `$${cash(base / 100)}`]), ["SUBTOTAL SIN IMPUESTOS:", `$${cash(invoice.items.reduce((sum, item) => sum + item.subtotal, 0))}`], ["TOTAL DESCUENTO:", `$${cash(invoice.discountTotal)}`], ["IVA DE LAS PARTIDAS:", `$${cash(invoice.ivaTotal)}`], ["PROPINA:", "$0.00"], ["VALOR TOTAL:", `$${cash(invoice.total)}`]];
  autoTable(pdf, { startY: y, body: totals, theme: "grid", styles: { fontSize: 7, cellPadding: 2, textColor: [15, 23, 42], lineColor: [203, 213, 225], lineWidth: 0.2 }, columnStyles: { 0: { cellWidth: 53, fontStyle: "bold" }, 1: { cellWidth: 24, halign: "right", fontStyle: "bold" } }, alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: data => { if (data.row.index === totals.length - 1) { data.cell.styles.fillColor = [15, 23, 42]; data.cell.styles.textColor = [255, 255, 255]; data.cell.styles.fontStyle = "bold"; } }, margin: { left: 123, right: 10, bottom: 18 } });
  const rightEnd = (pdf as any).lastAutoTable.finalY;
  pdf.setPage(Math.max(lastLeftPage, pdf.getCurrentPageInfo().pageNumber));
  let bottom = (lastLeftPage > summaryPage ? leftEnd : Math.max(leftEnd, rightEnd)) + 4;
  if (bottom > 262) { pdf.addPage(); bottom = 16; }
  autoTable(pdf, { startY: bottom, body: [[numeroALetrasDolares(invoice.total)], [invoice.ambiente === "1" ? "COMPROBANTE DE PRUEBAS · SIN VALIDEZ TRIBUTARIA" : "Documento tributario electrónico autorizado por el SRI del Ecuador."]], theme: "plain", styles: { fontSize: 7, halign: "center", fillColor: [241, 245, 249], textColor: [71, 85, 105], cellPadding: 2 }, margin: { left: 10, right: 10, bottom: 18 } });
  for (let i = 1; i <= pdf.getNumberOfPages(); i++) { pdf.setPage(i); pdf.setTextColor(100, 116, 139); pdf.setFontSize(6.5).text(`${invoice.documentNumber} · ${i}/${pdf.getNumberOfPages()}`, 105, 290, { align: "center" }); }
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
