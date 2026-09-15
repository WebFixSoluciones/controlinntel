import type { NextRequest } from "next/server";
import { adminServices } from "./admin";
import { can } from "../permissions";
import type { UserProfile } from "@/types";
export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function actor(request: NextRequest): Promise<UserProfile> {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new HttpError(401, "Inicia sesión para continuar.");
  const {auth, db} = adminServices();
  let uid: string;
  try { uid = (await auth.verifyIdToken(token, true)).uid; }
  catch { throw new HttpError(401, "La sesión ha caducado."); }
  const profile = (await db.collection("users").doc(uid).get()).data();
  if (!profile || profile.status !== "activo") throw new HttpError(403, "Cuenta sin perfil activo.");
  return { uid, email: profile.email, displayName: profile.displayName, role: profile.role,
    status: profile.status, permissions: profile.permissions || [] };
}
export function requirePermission(user: UserProfile, permission: string) {
  if (!can(user, permission)) throw new HttpError(403, "No tienes permiso para esta operación.");
}
export function audit(user: UserProfile, action: string, resource: string) {
  return { id: crypto.randomUUID(), userId: user.uid, userEmail: user.email, userRole: user.role,
    action, resource, details: action + " " + resource, timestamp: new Date().toISOString() };
}

