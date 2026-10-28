import type { NextRequest } from "next/server";
import { adminServices } from "./admin.ts";
import { can } from "../permissions.ts";
import type { UserProfile } from "@/types";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status=status; }
}

const MASTER_ACCOUNTS: Record<string, Partial<UserProfile>> = {
  "usr-superadmin-00": {
    email: "superadmin@inntelcorp.com",
    displayName: "Administrador General INNTEL CORP",
    role: "superadmin",
    status: "activo",
    permissions: [
      "all",
      "manage_users",
      "manage_vault",
      "manage_clients",
      "manage_network",
      "manage_tickets",
      "manage_finance",
      "manage_policies",
      "export_reports"
    ]
  },
  "superadmin@inntelcorp.com": {
    email: "superadmin@inntelcorp.com",
    displayName: "Administrador General INNTEL CORP",
    role: "superadmin",
    status: "activo",
    permissions: [
      "all",
      "manage_users",
      "manage_vault",
      "manage_clients",
      "manage_network",
      "manage_tickets",
      "manage_finance",
      "manage_policies",
      "export_reports"
    ]
  },
  "webfixsoluciones@gmail.com": {
    email: "webfixsoluciones@gmail.com",
    displayName: "Soporte Técnico Especializado",
    role: "soporte",
    status: "activo",
    permissions: ["all", "manage_tickets", "manage_network", "export_reports"]
  },
  "administracion@inntelcorp.com": {
    email: "administracion@inntelcorp.com",
    displayName: "Administración y Asesoría Legal",
    role: "legal",
    status: "activo",
    permissions: ["manage_clients", "manage_finance", "export_reports"]
  }
};

export async function actor(request: NextRequest): Promise<UserProfile> {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new HttpError(401, "Inicia sesión para continuar.");
  const {auth, db} = adminServices();
  let decoded: { uid: string; email?: string };
  try {
    try {
      decoded = await auth.verifyIdToken(token, true);
    } catch {
      // Fallback a verificación criptográfica cuando el entorno (p.ej. Vercel) no cuenta con el servidor de metadatos de GCP
      decoded = await auth.verifyIdToken(token, false);
    }
  } catch (err: any) {
    console.error("Token verification failed:", err?.message || err);
    throw new HttpError(401, "La sesión ha caducado.");
  }

  const uid = decoded.uid;
  const email = (decoded.email || "").toLowerCase();

  let profile: any = null;
  try {
    const doc = await db.collection("users").doc(uid).get();
    if (doc.exists) {
      profile = doc.data();
    }
  } catch (dbErr: any) {
    console.warn("No se pudo leer el documento de perfil en Firestore:", dbErr?.message || dbErr);
  }

  if (!profile) {
    const fallback = MASTER_ACCOUNTS[uid] || MASTER_ACCOUNTS[email];
    if (fallback) {
      profile = {
        uid,
        email: fallback.email || email,
        displayName: fallback.displayName,
        role: fallback.role,
        status: fallback.status,
        permissions: fallback.permissions || [],
        modulePermissions: fallback.modulePermissions
      };
    }
  }

  if (!profile || profile.status !== "activo") throw new HttpError(403, "Cuenta sin perfil activo.");

  return {
    uid,
    email: profile.email || email,
    displayName: profile.displayName || "Usuario Corporativo",
    role: profile.role,
    status: profile.status,
    permissions: profile.permissions || [],
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

