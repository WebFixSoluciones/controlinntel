import type { NextRequest } from "next/server";
import { adminServices } from "./admin.ts";
import { can, effectiveAccountPermissions } from "../permissions.ts";
import type { UserProfile } from "@/types";
import type { UserRoleTemplate } from "@/types";
import { resolveAssignedRole, RoleAccessError } from "../role-access.ts";

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
  if (profile.accessRoleId) {
    try {
      const role = await db.collection("userRoleTemplates").doc(profile.accessRoleId).get();
      profile = resolveAssignedRole(profile, role.exists ? { ...role.data(), id: role.id } as UserRoleTemplate : undefined);
    } catch (error) {
      if (error instanceof RoleAccessError) throw new HttpError(403, error.message);
      throw new HttpError(503, "No se pudo verificar el rol de acceso. Intenta nuevamente.");
    }
  }

  return {
    uid,
    accessRoleId: profile.accessRoleId,
    accessRoleName: profile.accessRoleName,
    accessRoleVersion: profile.accessRoleVersion,
    permissionOverrides: profile.permissionOverrides,
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
    action, resource, ...(user.accessRoleId ? { actorRoleId: user.accessRoleId, actorRoleName: user.accessRoleName || "", actorRoleVersion: user.accessRoleVersion || 0 } : {}), details: action + " " + resource, timestamp: new Date().toISOString() };
}

