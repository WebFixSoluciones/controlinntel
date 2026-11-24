export function canTradeWithClient(client: { status?: string } | null | undefined) {
  return Boolean(client && client.status !== "retirado");
}

type NumberedDocument = { documentNumber?: string; invoiceNumber?: string; quoteNumber?: string };

/** Compare the full series and sequence numerically, independently of issue date. */
export function compareDocumentsDescending(
  a: NumberedDocument,
  b: NumberedDocument,
) {
  return String(b.documentNumber || b.invoiceNumber || b.quoteNumber || "").localeCompare(
    String(a.documentNumber || a.invoiceNumber || a.quoteNumber || ""), "es", { numeric: true },
  );
}

export function activeCommercialDocuments<T extends { status?: string; documentNumber?: string; invoiceNumber?: string }>(documents: T[]): T[] {
  return documents.filter(document => document.status !== "anulada" && document.status !== "anulado").sort(compareDocumentsDescending);
}
