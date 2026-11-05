import type { SriInvoice } from "@/types";
import { compareDocumentsDescending } from "./sales-policy.ts";

/** Issued customer documents, independently of collections or contracted services. */
export function clientIssuedInvoices(documents: SriInvoice[], clientId: string) {
  return documents.filter(document => document.clientId === clientId
    && ["registrado", "emitida", "autorizada"].includes(document.status)
    && (!document.documentType || ["factura", "nota_venta"].includes(document.documentType)))
    .sort(compareDocumentsDescending);
}
