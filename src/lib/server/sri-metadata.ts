import type { DocumentData } from "firebase-admin/firestore";

export function fiscalMetadata(row: DocumentData) {
  const { xmlFirmado, xmlAutorizado, fiscalInput, fiscalLease, fiscalLeaseUntil, ...metadata } = row;
  return { ...metadata, authorizationVerified: row.estadoSRI === "AUTORIZADO" && typeof xmlAutorizado === "string" && xmlAutorizado.length > 0 };
}
