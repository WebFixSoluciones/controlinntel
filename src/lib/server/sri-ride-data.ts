import type { Firestore } from "firebase-admin/firestore";
import type { RecordData } from "../commercial-core.ts";
import type { FiscalMailKind } from "./fiscal-email-format.ts";

/** Use the same commercial references in the downloaded and emailed RIDE. */
export async function fiscalRideData(db: Firestore, kind: FiscalMailKind, document: RecordData): Promise<RecordData> {
  if (kind !== "factura") return document;
  const source = document.relatedSaleId ? (await db.collection("billingInvoices").doc(document.relatedSaleId).get()).data() : undefined;
  const guides = document.id ? await db.collection("billingRemissionGuides").where("invoiceId", "==", document.id).limit(50).get() : undefined;
  const guide = guides?.docs.map(doc => doc.data()).find(row => row.estadoSRI === "AUTORIZADO" && row.xmlAutorizado && row.ambiente === document.ambiente);
  return { ...document, sourceNumber: source?.documentNumber || document.sourceNumber || "", guideNumber: guide?.documentNumber || document.guideNumber || "", creditDueDate: document.creditDueDate || source?.creditDueDate || "" };
}
