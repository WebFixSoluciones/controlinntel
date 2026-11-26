import { cents, money, chargeBalance, type RecordData } from "./commercial-core.ts";
import { compareDocumentsDescending } from "./sales-policy.ts";

export function clientSalesHistory(invoices: RecordData[], charges: RecordData[]) {
  const active = invoices.filter(row => !["anulada", "anulado", "borrador"].includes(row.status));
  const notes = new Map(active.filter(row => row.documentType === "nota_venta").map(row => [row.id, row]));
  const parents = new Map<string, string>();
  for (const note of notes.values()) for (const id of [note.sriInvoiceId, ...Object.values(note.sriInvoicesByEnvironment || {})]) if (id) parents.set(String(id), note.id);
  const parentOf = (row: RecordData) => row.relatedSaleId || parents.get(row.id);
  const usedCharges = new Set<string>();
  const rows: RecordData[] = [];
  for (const document of active) {
    if (document.documentType !== "nota_venta" && parentOf(document) && notes.has(parentOf(document))) continue;
    const related = active.filter(row => parentOf(row) === document.id && row.documentType === "factura");
    const fiscal = related.find(row => row.ambiente === "2" && row.estadoSRI === "AUTORIZADO") || document;
    const linkedIds = new Set([document.id, ...related.map(row => row.id)]);
    const linked = charges.filter(row => row.status !== "anulado" && (linkedIds.has(row.invoiceId) || !row.invoiceId && document.documentNumber && row.invoiceNumber === document.documentNumber));
    linked.forEach(row => usedCharges.add(row.id));
    const isTest = document.documentType !== "nota_venta" && (document.ambiente || document.claveAcceso?.[23]) === "1";
    rows.push({ id: document.id, documentNumber: fiscal.documentNumber, sourceNumber: fiscal.id !== document.id ? document.documentNumber : "",
      kind: document.documentType === "nota_venta" && fiscal === document ? "Nota de venta" : isTest ? "Factura SRI · Pruebas" : "Factura SRI",
      date: document.date, issuedDate: fiscal.date || document.date, total: Number(document.total || 0), paymentMethod: document.paymentMethod || "—",
      status: fiscal.documentType === "nota_venta" ? document.status : fiscal.estadoSRI || fiscal.status,
      description: (document.items || []).map((item: RecordData) => item.name).join(" + "),
      pending: linked.length === 1 ? money(chargeBalance(linked[0])) : null, isTest,
      testDocuments: related.filter(row => row.ambiente === "1").map(row => row.documentNumber), needsReconciliation: !isTest && linked.length !== 1 });
  }
  for (const charge of charges.filter(row => row.status !== "anulado" && !usedCharges.has(row.id))) {
    if (charge.invoiceId && invoices.some(row => row.id === charge.invoiceId && ["anulada", "anulado"].includes(row.status))) continue;
    rows.push({ id: charge.id, documentNumber: charge.invoiceNumber || "Cargo manual", kind: charge.invoiceId ? "Cargo por conciliar" : "Cargo manual",
      date: charge.saleDate || `${charge.year}-${String(charge.month || 1).padStart(2, "0")}-01`, total: Number(charge.total || 0),
      paymentMethod: charge.paymentMethod || "—", status: charge.status, description: charge.serviceDescription || "",
      pending: money(chargeBalance(charge)), isTest: false, needsReconciliation: !!charge.invoiceId, testDocuments: [] });
  }
  rows.sort(compareDocumentsDescending);
  const commercial = rows.filter(row => !row.isTest && row.kind !== "Cargo por conciliar");
  return { rows, total: money(commercial.reduce((sum, row) => sum + cents(row.total), 0)), count: commercial.length,
    pending: money(rows.filter(row => !row.isTest && row.pending !== null).reduce((sum, row) => sum + cents(row.pending), 0)),
    reconciliationCount: rows.filter(row => row.needsReconciliation).length };
}
