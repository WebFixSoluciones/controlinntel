import type { UserProfile } from "@/types";
import { canAccessModule, can, canManageTemplates, canUser, canPerformAction } from "../permissions.ts";
import { documentArea } from "./document-path.ts";
import { HttpError } from "./security.ts";

export function requireDocumentAccess(user: UserProfile, path: string, action: "read" | "write" | "delete") {
  let area;
  try { area = documentArea(path); } catch { throw new HttpError(400, "Ruta de archivo inválida."); }
  const moduleKey = area === "clients" ? "abonados" : area === "arcotel" ? "arcotel" : "plantillas";
  if (!canAccessModule(user, moduleKey)) throw new HttpError(403, "No tienes acceso a estos documentos.");
  if (area === "clients" && action === "write" && !canUser(user, "clientes", "canUploadContracts")) throw new HttpError(403, "No tienes permiso para cargar documentos de clientes.");
  if (area === "arcotel" && action === "write" && user.accessRoleId && !canUser(user,"arcotel","canManageRegulatoryFiles")) throw new HttpError(403,"No tienes permiso para subir archivos regulatorios.");
  if (area === "templates" && action !== "read" && !canManageTemplates(user)) throw new HttpError(403, "No tienes permiso para administrar plantillas.");
  if (action !== "read" && area !== "templates" && !can(user, area === "clients" ? "manage_clients" : "manage_policies")) {
    throw new HttpError(403, "No tienes permiso para modificar estos documentos.");
  }
  if (action === "delete" && ((area === "arcotel" && !canPerformAction(user, "canDeleteFiles")) || (area === "clients" && !canUser(user, "clientes", "canDeleteContracts")))) {
    throw new HttpError(403, "No tienes permiso para eliminar archivos.");
  }
}
