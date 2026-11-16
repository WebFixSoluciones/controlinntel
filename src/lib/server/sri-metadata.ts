import type { DocumentData } from "firebase-admin/firestore";

export function fiscalMetadata(row: DocumentData) {
  const { xmlFirmado, xmlAutorizado, fiscalInput, fiscalLease, fiscalLeaseUntil, emailLease, emailLeaseUntil, ...metadata } = row;
  return { ...metadata, authorizationVerified: row.estadoSRI === "AUTORIZADO" && typeof xmlAutorizado === "string" && xmlAutorizado.length > 0 };
}
