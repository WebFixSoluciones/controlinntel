import { createHash, randomUUID } from "node:crypto";
import type { Firestore, Transaction, DocumentData } from "firebase-admin/firestore";
import type { UserProfile } from "@/types";

export function digest(value: unknown): string {
  function canonical(v: any): any {
    if (Array.isArray(v)) return v.map(canonical);
    if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => [k, canonical(v[k])]));
    return v;
  }
  return createHash("sha256").update(JSON.stringify(canonical(value)) ?? "null").digest("hex");
}

export type Effect = { collection: string; id: string; beforeVersion: number | null; after: DocumentData | null };

// Written in the same transaction as every confirmed mutation. Never client-writable.
export function recordOperation(tx: Transaction, db: Firestore, user: UserProfile, type: string, effects: Effect[], id: string = randomUUID(), source?: DocumentData) {
  const timestamp=new Date().toISOString();
  tx.create(db.collection("operationLog").doc(id), {
    id, schemaVersion: 1, status: "committed", type, actorId: user.uid,
    timestamp, effects, digest: digest(effects), ...(source ? { source } : {}),
  });
  tx.create(db.collection("auditLogs").doc("operation-"+id),{
    id:"operation-"+id,userId:user.uid,userEmail:user.email,userRole:user.role,
    action:type,resource:"operationLog/"+id,details:`${type}: ${effects.length} registros vinculados`,timestamp,operationId:id,
  });
}

export function redact(value: any): any {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !["passwordHash", "secret", "encryptedPassword", "totpSecret", "pppoePassword", "password", "certificadoBase64", "certificadoClave", "pkcs12Base64", "pkcs12Password", "emailPassword", "smtpPassword", "emailPass"].includes(key)).map(([key, item]) => [key, redact(item)]));
}
