import type { UserProfile } from "@/types";
import { canAccessSubmodule } from "../permissions.ts";
import { HttpError } from "./security.ts";

export function requireSettingsAccess(user: UserProfile, section: "sri" | "email", write = false) {
  const allowed = canAccessSubmodule(user, "configuracion", "sri")
    || (section === "email" && canAccessSubmodule(user, "configuracion", "general"));
  if (!allowed || (write && user.role === "consulta")) throw new HttpError(403, "No tienes permiso para esta configuración.");
}
