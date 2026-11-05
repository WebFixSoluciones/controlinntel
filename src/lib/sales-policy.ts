export function canTradeWithClient(client: { status?: string } | null | undefined) {
  return Boolean(client && client.status !== "retirado");
}

/** Compare the full series and sequence numerically, independently of issue date. */
export function compareDocumentsDescending(
  a: { documentNumber?: string; invoiceNumber?: string },
  b: { documentNumber?: string; invoiceNumber?: string },
) {
  return String(b.documentNumber || b.invoiceNumber || "").localeCompare(
    String(a.documentNumber || a.invoiceNumber || ""), "es", { numeric: true },
  );
}

export function activeCommercialDocuments<T extends { status?: string; documentNumber?: string; invoiceNumber?: string }>(documents: T[]): T[] {
  return documents.filter(document => document.status !== "anulada" && document.status !== "anulado").sort(compareDocumentsDescending);
}
