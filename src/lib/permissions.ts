import type { UserProfile } from "@/types";
export const collectionPermissions = {
  clients: "manage_clients", clientServices: "manage_clients", plans: "manage_clients",
  clientProjects: "manage_clients", clientContracts: "manage_clients",
  clientQuotes: "manage_finance", nodes: "manage_network", ipPools: "manage_network",
  policies: "manage_policies", tickets: "manage_tickets", expenses: "manage_finance",
  monthlyCharges: "manage_finance", vault: "manage_vault", clientVaultItems: "manage_vault",
  systemUsers: "manage_users", auditLogs: "manage_users",
} as const;
export type Entity = keyof typeof collectionPermissions;
export function can(user: UserProfile, permission: string) {
  return user.status === "activo" && !!user.permissions?.some(p => p === "all" || p === permission);
}
export const routePermissions: Record<string, string> = {
  "/clientes": "manage_clients", "/arcotel": "manage_policies", "/boveda": "manage_vault",
  "/red": "manage_network", "/tickets": "manage_tickets", "/finanzas": "manage_finance",
  "/plantillas": "export_reports", "/configuracion": "manage_users",
};

