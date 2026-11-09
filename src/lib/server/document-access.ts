import type { UserProfile } from "@/types";
import { canAccessModule, can, canManageTemplates } from "../permissions.ts";
import { documentArea } from "./document-path.ts";
import { HttpError } from "./security.ts";

export function requireDocumentAccess(user: UserProfile, path: string, action: "read" | "write" | "delete") {
  let area;
  try { area = documentArea(path); } catch { throw new HttpError(400, "Ruta de archivo inválida."); }
  const moduleKey = area === "clients" ? "abonados" : area === "arcotel" ? "arcotel" : "plantillas";
  if (!canAccessModule(user, moduleKey)) throw new HttpError(403, "No tienes acceso a estos documentos.");
  if (area === "templates" && action !== "read" && !canManageTemplates(user)) throw new HttpError(403, "No tienes permiso para administrar plantillas.");
  if (action !== "read" && area !== "templates" && !can(user, area === "clients" ? "manage_clients" : "manage_policies")) {
    throw new HttpError(403, "No tienes permiso para modificar estos documentos.");
  }
  if (action === "delete" && !["superadmin", "admin"].includes(user.role)
    && !user.permissions?.includes("delete_files") && !user.modulePermissions?.actions?.canDeleteFiles) {
    throw new HttpError(403, "No tienes permiso para eliminar archivos.");
  }
}
