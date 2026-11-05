import type { UserProfile } from "@/types";
import { can, canUser } from "../permissions.ts";
import { HttpError } from "./security.ts";

export function requireVaultAccess(user: UserProfile, entity: string, action: "save" | "delete" | "reveal") {
  if (!["vault", "clientVaultItems"].includes(entity)) throw new HttpError(400, "Bóveda inválida.");
  const view = entity === "vault" ? "canViewInternalVault" : "canViewClientVault";
  if (user.status !== "activo" || !can(user, "manage_vault") || !canUser(user, "boveda", view) || user.role === "consulta") {
    throw new HttpError(403, "No tienes permiso para administrar estas credenciales.");
  }
  if ((action === "reveal" && !canUser(user, "boveda", "canRevealPasswords")) || (action === "delete" && !canUser(user, "boveda", "canDeleteCredentials"))) {
    throw new HttpError(403, "No tienes permiso para esta acción de la bóveda.");
  }
}
