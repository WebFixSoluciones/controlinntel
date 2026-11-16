import type { RecordData } from "../commercial-core.ts";

export const fiscalMailCollections = {
  factura: "billingInvoices", nota_credito: "billingCreditNotes", nota_debito: "billingDebitNotes",
  retencion: "billingWithholdings", guia_remision: "billingRemissionGuides",
} as const;
export type FiscalMailKind = keyof typeof fiscalMailCollections;
export const fiscalMailLabels: Record<FiscalMailKind, string> = {
  factura: "Factura electrónica", nota_credito: "Nota de crédito", nota_debito: "Nota de débito",
  retencion: "Comprobante de retención", guia_remision: "Guía de remisión",
};
export const fiscalMailAmount = (kind: FiscalMailKind, row: RecordData): number | undefined =>
  kind === "guia_remision" ? undefined : Number(kind === "retencion" ? row.totalRetained : row.total);
export const fiscalMailRecipient = (row: RecordData) => row.clientName || row.destClientName || "Cliente";
export const escapeEmailHtml = (value: unknown) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function fiscalEmailHtml(kind: FiscalMailKind, row: RecordData, company: RecordData) {
  const e = escapeEmailHtml, label = fiscalMailLabels[kind], total = fiscalMailAmount(kind, row);
  const brand = company.nombreComercial || "INNTEL CORP";
  const cash = total === undefined ? "" : `$${total.toFixed(2)} USD`;
  const bases = new Map<number, number>();
  if (kind === "factura" || kind === "nota_credito") for (const item of row.items || []) bases.set(item.ivaRate, (bases.get(item.ivaRate) || 0) + Math.round(Number(item.subtotal || 0) * 100));
  const taxRows = [...bases].map(([rate, base]) => `<tr><td style="padding:5px 0;color:#64748b">Subtotal ${e(rate)}%</td><td align="right">$${(base / 100).toFixed(2)}</td></tr>`).join("");
  return `<!DOCTYPE html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"><title>${e(label)} ${e(row.documentNumber)}</title></head>
<body style="margin:0;padding:0;background:#f3f5fb;font-family:Inter,'Segoe UI',Arial,sans-serif;color:#14213d">
<div style="display:none;max-height:0;overflow:hidden">${e(label)} ${e(row.documentNumber)}. Documento autorizado. PDF y XML adjuntos. ${e(cash)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#fff;border:1px solid #e4e8f2;border-radius:16px;overflow:hidden">
<tr><td style="height:4px;background:#004ac6;background:linear-gradient(90deg,#004ac6,#7652c9)"></td></tr>
<tr><td style="padding:28px 28px 20px"><table role="presentation" width="100%"><tr><td><img src="cid:inntel-logo" width="102" alt="INNTEL CORP" style="display:block;width:102px;height:auto;border:0"></td><td align="right" style="font-size:10px;letter-spacing:1.2px;color:#71809c">DOCUMENTOS<br>ELECTRÓNICOS</td></tr></table></td></tr>
<tr><td style="padding:4px 28px 28px"><span style="font-size:10px;letter-spacing:1px;font-weight:600;color:#087f68">AUTORIZADO POR EL SRI</span>
<h1 style="font-size:26px;line-height:1.2;font-weight:600;letter-spacing:-.6px;margin:12px 0 8px">Tu documento está listo.</h1>
<p style="font-size:14px;line-height:1.6;color:#66748c;margin:0">Hola, ${e(fiscalMailRecipient(row))}.<br>Adjuntamos el documento autorizado emitido por ${e(brand)}.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;background:#f7f9ff;border:1px solid #e6ebf7;border-radius:10px"><tr><td style="padding:18px"><p style="margin:0 0 6px;font-size:11px;color:#65748e">${e(label)}</p><p style="margin:0;font-size:17px;font-weight:600;word-break:break-all">${e(row.documentNumber)}</p><p style="margin:8px 0 0;font-size:11px;color:#65748e">Emisión: ${e(row.date)} · Producción</p></td>${total !== undefined ? `<td align="right" style="padding:18px;font-size:22px;font-weight:600;white-space:nowrap">$${total.toFixed(2)}<span style="display:block;font-size:10px;font-weight:400;color:#65748e">${kind === "retencion" ? "USD RETENIDOS" : "USD TOTAL"}</span></td>` : ""}</tr></table>
${taxRows ? `<table role="presentation" width="100%" style="margin-top:12px;font-size:11px">${taxRows}<tr><td style="padding:5px 0;color:#64748b">IVA</td><td align="right">$${Number(row.ivaTotal || 0).toFixed(2)}</td></tr></table>` : ""}
<table role="presentation" width="100%" style="margin-top:22px;border-top:1px solid #edf0f7"><tr><td style="padding:18px 0 0"><p style="margin:0;font-size:13px;font-weight:600">PDF RIDE + XML autorizado</p><p style="margin:6px 0 0;font-size:12px;line-height:1.6;color:#66748c">Abre o descarga los archivos adjuntos a este correo. El PDF contiene la representación del documento y el XML conserva su autorización electrónica.</p></td></tr></table>
<p style="margin:22px 0 5px;font-size:10px;font-weight:600;color:#65748e">CLAVE DE ACCESO / AUTORIZACIÓN</p><p style="margin:0;font-family:Consolas,monospace;font-size:10px;line-height:1.7;word-break:break-all;color:#6b7890">${e(row.claveAcceso)}</p>
<p style="font-size:10px;color:#71809c;margin:7px 0 0">Fecha de autorización: ${e(row.authorizationDate || "")}</p></td></tr>
<tr><td style="padding:20px 28px;border-top:1px solid #edf0f7;background:#fafbfe;font-size:10px;line-height:1.7;color:#7c88a0"><strong style="color:#42516b">${e(brand)}</strong><br>${e(company.razonSocial)} · RUC ${e(company.ruc)}<br>${e(company.direccionMatriz)}<br>Conserva este correo y sus adjuntos como respaldo de tu documento.</td></tr>
</table></td></tr></table></body></html>`;
}
