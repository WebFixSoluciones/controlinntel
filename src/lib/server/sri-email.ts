import { fiscalMailCollections, type FiscalMailKind } from "./fiscal-email-format.ts";
import { randomUUID } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import type { SriCompanyConfig, UserProfile } from "@/types";
import { HttpError } from "./security.ts";
import { recordOperation } from "./operation-log.ts";
import { sendInvoiceEmail, type InvoiceEmailResult, type InvoiceEmailInput } from "./email-delivery.ts";

export async function deliverFiscalDocument(db: Firestore, user: UserProfile, config: SriCompanyConfig, kind: FiscalMailKind, id: string,
  send: (input: InvoiceEmailInput) => Promise<InvoiceEmailResult> = sendInvoiceEmail, confirmUncertain = false) {
  const ref = db.collection(fiscalMailCollections[kind]).doc(id), lease = randomUUID();
  const claim = await db.runTransaction(async tx => {
    const row = (await tx.get(ref)).data();
    if (!row || row.documentType !== kind || row.ambiente !== "2" || row.claveAcceso?.[23] !== "2" || row.estadoSRI !== "AUTORIZADO" || typeof row.xmlAutorizado !== "string" || !row.xmlAutorizado || ["anulada", "anulado"].includes(row.status)) throw new HttpError(409, "Solo se envían documentos vigentes y autorizados de producción.");
    if (row.emailStatus === "enviado") return { alreadySent: true as const };
    if (Number(row.emailLeaseUntil || 0) > Date.now()) throw new HttpError(409, "El envío de correo ya está en curso.");
    if (["enviando", "no_confirmado"].includes(row.emailStatus) && !confirmUncertain) throw new HttpError(409, "El envío anterior pudo ser aceptado. Verifica el proveedor antes de confirmar un nuevo intento.");
    const clientEmail = await recipientEmail(tx, db, row, kind);
    const updated: Record<string, any> = { ...row, emailStatus: "enviando", emailLease: lease, emailLeaseUntil: Date.now() + 75_000, emailAttempts: Number(row.emailAttempts || 0) + 1, emailLastAttempt: new Date().toISOString(), version: Number(row.version || 0) + 1 };
    tx.set(ref, updated);
    recordOperation(tx, db, user, "SRI_CORREO_INICIADO", [{ collection: fiscalMailCollections[kind], id, beforeVersion: row.version ?? null, after: updated }]);
    return { invoice: { ...updated, clientEmail }, accepted: row.emailAcceptedRecipients || [] };
  });
  if (claim.alreadySent) return { sent: true, recipients: [], skippedReason: "El correo ya fue confirmado; no se vuelve a enviar." };
  const invoice: Record<string, any> = claim.invoice!;
  let result: InvoiceEmailResult;
  try { result = await send({ config: { ...config, ...invoice.fiscalIssuer }, invoice, documentKind: kind, omitRecipients: claim.accepted, xmlFirmado: invoice.xmlAutorizado, numeroAutorizacion: invoice.numeroAutorizacion, fechaAutorizacion: invoice.authorizationDate }); }
  catch { result = { sent: false, recipients: [], error: "El proveedor no confirmó el envío.", deliveryUncertain: true }; }
  await db.runTransaction(async tx => {
    const row = (await tx.get(ref)).data();
    if (!row || row.emailLease !== lease) throw new HttpError(409, "El registro del envío cambió. Actualiza la factura.");
    const updated: Record<string, any> = { ...row, emailStatus: result.sent ? "enviado" : result.deliveryUncertain ? "no_confirmado" : result.partial ? "parcial" : "error", emailLease: null, emailLeaseUntil: 0,
      emailDelivery: result, emailAcceptedRecipients: [...new Set([...(row.emailAcceptedRecipients || []), ...result.recipients])], emailTemplateVersion: "inntel-minimal-v1", version: Number(row.version || 0) + 1, updatedAt: new Date().toISOString() };
    tx.set(ref, updated);
    recordOperation(tx, db, user, result.sent ? "SRI_CORREO_ENVIADO" : "SRI_CORREO_ERROR", [{ collection: fiscalMailCollections[kind], id, beforeVersion: row.version ?? null, after: updated }]);
  });
  return result;
}

// Preserve the original invoice-only API for existing callers and regression tests.
export function deliverFiscalInvoice(db: Firestore, user: UserProfile, config: SriCompanyConfig, id: string,
  send: (input: InvoiceEmailInput) => Promise<InvoiceEmailResult> = sendInvoiceEmail, confirmUncertain = false) {
  return deliverFiscalDocument(db, user, config, "factura", id, send, confirmUncertain);
}

async function recipientEmail(tx: any, db: Firestore, row: Record<string, any>, kind: FiscalMailKind): Promise<string> {
  const usable = (value: unknown) => typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+/.test(value);
  if (usable(row.clientEmail)) return row.clientEmail;
  const collection = kind === "retencion" ? "suppliers" : "clients";
  if (row.clientId) {
    const contact = (await tx.get(db.collection(collection).doc(row.clientId))).data();
    if (usable(contact?.email)) return contact.email;
  }
  if (kind === "retencion" && row.purchaseInvoiceId) {
    const purchase = (await tx.get(db.collection("purchaseInvoices").doc(row.purchaseInvoiceId))).data();
    if (usable(purchase?.supplierEmail)) return purchase.supplierEmail;
    if (purchase?.supplierId) {
      const supplier = (await tx.get(db.collection("suppliers").doc(purchase.supplierId))).data();
      if (usable(supplier?.email)) return supplier.email;
    }
  }
  if (row.invoiceId && kind !== "retencion") {
    const original = (await tx.get(db.collection("billingInvoices").doc(row.invoiceId))).data();
    if (usable(original?.clientEmail)) return original.clientEmail;
    if (original?.clientId) {
      const contact = (await tx.get(db.collection("clients").doc(original.clientId))).data();
      if (usable(contact?.email)) return contact.email;
    }
  }
  if (kind === "guia_remision" && row.destClientRuc) {
    const contacts = await tx.get(db.collection("clients").where("identificationNumber", "==", row.destClientRuc).limit(2));
    if (contacts.docs.length === 1 && usable(contacts.docs[0].data()?.email)) return contacts.docs[0].data().email;
  }
  return "";
}
