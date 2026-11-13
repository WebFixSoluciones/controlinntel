import { z } from "zod";
import type { UserProfile, SystemPermission } from "@/types";
import { DEFAULT_MODULE_PERMISSIONS_BY_ROLE, DEFAULT_ACCOUNT_PERMISSIONS, editableModulePermissions, can } from "./permissions.ts";

const flags = z.record(z.boolean());
const moduleSchema = z.object({ enabled: z.boolean(), submodules: flags.optional(), actions: flags.optional() }).strict();
const keys = new Set([...Object.keys(DEFAULT_MODULE_PERMISSIONS_BY_ROLE.superadmin), "visibility"]);
export const modulePermissionsSchema = z.record(z.unknown()).superRefine((value, context) => {
  for (const [key, entry] of Object.entries(value)) {
    if (!keys.has(key)) { context.addIssue({ code: "custom", path: [key], message: "Módulo desconocido." }); continue; }
    const parsed = (key === "visibility" || key === "actions" ? flags : moduleSchema).safeParse(entry);
    if (!parsed.success) context.addIssue({ code: "custom", path: [key], message: "Los permisos deben ser valores de activado o desactivado." });
  }
});

export function userAccessSnapshot(profile: UserProfile) {
  if (profile.modulePermissions) modulePermissionsSchema.parse(profile.modulePermissions);
  const modulePermissions = editableModulePermissions(profile);
  if (profile.role !== "superadmin" && modulePermissions.personas?.submodules) modulePermissions.personas.submodules.usuarios_equipo = false;
  const user = { ...profile, modulePermissions, permissionModelVersion: 2 as const };
  const permissions: SystemPermission[] = profile.role === "superadmin" ? ["all"]
    : [...new Set(Object.values(DEFAULT_ACCOUNT_PERMISSIONS).flat())].filter(permission => permission !== "all" && can(user, permission));
  return { modulePermissions, permissionModelVersion: 2 as const, permissions };
}
