import type { NextRequest } from "next/server";
import { adminServices } from "./admin.ts";
import { can, effectiveAccountPermissions } from "../permissions.ts";
import type { UserProfile } from "@/types";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status=status; }
}

export async function actor(request: NextRequest, services = adminServices): Promise<UserProfile> {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new HttpError(401, "Inicia sesión para continuar.");
  const {auth, db} = services();
  let decoded: { uid: string; email?: string };
  try {
    decoded = await auth.verifyIdToken(token, true);
  } catch (err: any) {
    console.error("Token verification failed:", err?.message || err);
    throw new HttpError(401, "La sesión ha caducado.");
  }

  const uid = decoded.uid;
  let profile: any;
  try {
    const doc = await db.collection("users").doc(uid).get();
    profile = doc.exists ? doc.data() : null;
  } catch { throw new HttpError(503, "No se pudo verificar el perfil. Intenta nuevamente."); }

  if (!profile || profile.status !== "activo") throw new HttpError(403, "Cuenta sin perfil activo.");

  return {
    uid,
    email: profile.email || decoded.email || "",
    permissionModelVersion: profile.permissionModelVersion,
    displayName: profile.displayName || "Usuario Corporativo",
    role: profile.role,
    status: profile.status,
    permissions: effectiveAccountPermissions(profile.role, profile.permissions || []),
    modulePermissions: profile.modulePermissions
  };
}
export function requirePermission(user: UserProfile, permission: string) {
  if (!can(user, permission)) throw new HttpError(403, "No tienes permiso para esta operación.");
}
export function audit(user: UserProfile, action: string, resource: string) {
  return { id: crypto.randomUUID(), userId: user.uid, userEmail: user.email, userRole: user.role,
    action, resource, details: action + " " + resource, timestamp: new Date().toISOString() };
}

