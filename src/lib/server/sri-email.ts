import { randomUUID } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import type { SriCompanyConfig, SriInvoice, UserProfile } from "@/types";
import { HttpError } from "./security.ts";
import { recordOperation } from "./operation-log.ts";
import { sendInvoiceEmail, type InvoiceEmailResult, type InvoiceEmailInput } from "./email-delivery.ts";

export async function deliverFiscalInvoice(db: Firestore, user: UserProfile, config: SriCompanyConfig, id: string,
  send: (input: InvoiceEmailInput) => Promise<InvoiceEmailResult> = sendInvoiceEmail, confirmUncertain = false) {
  const ref = db.collection("billingInvoices").doc(id), lease = randomUUID();
  const claim = await db.runTransaction(async tx => {
    const row = (await tx.get(ref)).data();
    if (!row || row.documentType !== "factura" || row.ambiente !== "2" || row.claveAcceso?.[23] !== "2" || row.estadoSRI !== "AUTORIZADO" || !row.xmlAutorizado) throw new HttpError(409, "Solo se envían facturas autorizadas de producción.");
    if (row.emailStatus === "enviado") return { alreadySent: true as const };
    if (Number(row.emailLeaseUntil || 0) > Date.now()) throw new HttpError(409, "El envío de correo ya está en curso.");
    if (["enviando", "no_confirmado"].includes(row.emailStatus) && !confirmUncertain) throw new HttpError(409, "El envío anterior pudo ser aceptado. Verifica el proveedor antes de confirmar un nuevo intento.");
    const updated = { ...row, emailStatus: "enviando", emailLease: lease, emailLeaseUntil: Date.now() + 75_000, emailAttempts: Number(row.emailAttempts || 0) + 1, emailLastAttempt: new Date().toISOString(), version: Number(row.version || 0) + 1 };
    tx.set(ref, updated);
    recordOperation(tx, db, user, "SRI_CORREO_INICIADO", [{ collection: "billingInvoices", id, beforeVersion: row.version ?? null, after: updated }]);
    return { invoice: updated as unknown as SriInvoice };
  });
  if (claim.alreadySent) return { sent: true, recipients: [], skippedReason: "El correo ya fue confirmado; no se vuelve a enviar." };
  const invoice = claim.invoice!;
  let result: InvoiceEmailResult;
  try { result = await send({ config: { ...config, ...invoice.fiscalIssuer }, invoice, xmlFirmado: invoice.xmlAutorizado, numeroAutorizacion: invoice.numeroAutorizacion, fechaAutorizacion: invoice.authorizationDate }); }
  catch { result = { sent: false, recipients: [], error: "El proveedor no confirmó el envío.", deliveryUncertain: true }; }
  await db.runTransaction(async tx => {
    const row = (await tx.get(ref)).data();
    if (!row || row.emailLease !== lease) throw new HttpError(409, "El registro del envío cambió. Actualiza la factura.");
    const updated = { ...row, emailStatus: result.sent ? "enviado" : result.deliveryUncertain ? "no_confirmado" : "error", emailLease: null, emailLeaseUntil: 0,
      emailDelivery: result, version: Number(row.version || 0) + 1, updatedAt: new Date().toISOString() };
    tx.set(ref, updated);
    recordOperation(tx, db, user, result.sent ? "SRI_CORREO_ENVIADO" : "SRI_CORREO_ERROR", [{ collection: "billingInvoices", id, beforeVersion: row.version ?? null, after: updated }]);
  });
  return result;
}
