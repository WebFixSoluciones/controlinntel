import { compareDatesDescending, type DatedEntry } from "./date-utils.ts";

export function canTradeWithClient(client: { status?: string } | null | undefined) {
  return Boolean(client && client.status !== "retirado");
}

type NumberedDocument = DatedEntry & { documentNumber?: string; invoiceNumber?: string; quoteNumber?: string };
const documentNumberCollator = new Intl.Collator("es", { numeric: true });

/** Sort numbered documents first. Use the date only to break ties or sort unnumbered documents. */
export function compareDocumentsDescending(
  a: NumberedDocument,
  b: NumberedDocument,
) {
  const numberA = String(a.documentNumber || a.invoiceNumber || a.quoteNumber || "").trim();
  const numberB = String(b.documentNumber || b.invoiceNumber || b.quoteNumber || "").trim();
  const numberedA = /\d/.test(numberA);
  const numberedB = /\d/.test(numberB);
  if (numberedA !== numberedB) return numberedA ? -1 : 1;
  return (numberedA ? documentNumberCollator.compare(numberB, numberA) : 0) || compareDatesDescending(a, b);
}

export function activeCommercialDocuments<T extends { status?: string; documentNumber?: string; invoiceNumber?: string }>(documents: T[]): T[] {
  return documents.filter(document => document.status !== "anulada" && document.status !== "anulado").sort(compareDocumentsDescending);
}
