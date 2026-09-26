import type { UserProfile } from "@/types";
export const collectionPermissions = {
  clients: "manage_clients", clientServices: "manage_clients", plans: "manage_clients",
  clientProjects: "manage_clients", clientContracts: "manage_clients",
  clientQuotes: "manage_finance", nodes: "manage_network", ipPools: "manage_network",
  policies: "manage_policies", tickets: "manage_tickets", expenses: "manage_finance",
  monthlyCharges: "manage_finance", vault: "manage_vault", clientVaultItems: "manage_vault",
  systemUsers: "manage_users", auditLogs: "manage_users",
  arcotelFiles: "manage_policies", clientDocuments: "manage_clients",
  inventoryProducts: "manage_network", inventoryWarehouses: "manage_network",
  inventoryCategories: "manage_network", inventoryBrands: "manage_network",
  inventoryKardex: "manage_finance", inventoryTransfers: "manage_network",
  inventoryAdjustments: "manage_finance",
} as const;
export type Entity = keyof typeof collectionPermissions;
export function can(user: UserProfile, permission: string) {
  return user.status === "activo" && !!user.permissions?.some(p => p === "all" || p === permission);
}
export const routePermissions: Record<string, string> = {
  "/clientes": "manage_clients",
  "/arcotel": "manage_policies",
  "/boveda": "manage_vault",
  "/red": "manage_network",
  "/proyectos": "manage_network",
  "/tickets": "manage_tickets",
  "/finanzas": "manage_finance",
  "/inventarios": "manage_network",
  "/plantillas": "export_reports",
  "/configuracion": "manage_users",
};

export function canAccessRoute(user: UserProfile, route: string): boolean {
  if (route === "/inventarios") {
    return can(user, "manage_network") || can(user, "manage_finance");
  }
  const req = routePermissions[route];
  return !req || can(user, req);
}

export const tabPermissions: Record<string, string> = {
  fiscal: "manage_clients",
  red: "manage_network",        // Nodos
  boveda: "manage_vault",
  contratos: "manage_policies", // Arcotel
  cotizaciones: "manage_finance",
  finanzas: "manage_finance",   // Cobros
  tickets: "manage_tickets",
  proyectos: "manage_network",
  dossier: "manage_clients",
  inventario: "manage_network",
};
