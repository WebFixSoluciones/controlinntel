import type { UserProfile, UserModulePermissions } from "@/types";
import { canAccessModule, canAccessSubmodule, canUser, canPerformAction } from "../permissions.ts";
import { HttpError } from "./security.ts";

/** Generic forms must enforce the same controls as commercial commands. */
export function requireEntityWriteAccess(user: UserProfile, entity: string, action: "save" | "delete") {
  if (user.status !== "activo" || user.role === "consulta") throw new HttpError(403, "No tienes permiso para modificar estos datos.");
  if (user.role === "superadmin") return;
  const modules: Record<string, keyof UserModulePermissions> = {
    clients: "abonados", clientProjects: "proyectos", projects: "proyectos", nodes: "red", ipPools: "red",
    clientContracts: "abonados", clientDocuments: "abonados", plans: "abonados", hostingDomains: "abonados",
    policies: "arcotel", arcotelFiles: "arcotel", regulatoryTramites: "arcotel", systemConfig: "configuracion",
    inventoryCategories: "inventarios", inventoryBrands: "inventarios", inventoryWarehouses: "inventarios",
  };
  const moduleKey = modules[entity];
  if (moduleKey && !canAccessModule(user, moduleKey)) throw new HttpError(403, "No tienes acceso al módulo de este registro.");
  const actions: Record<string, [keyof UserModulePermissions, string]> = {
    clients: ["clientes", "canEditClient"], nodes: ["red", "canManageNodes"], ipPools: ["red", "canAssignIps"],
    suppliers: ["compras", "canCreateSupplier"], purchaseInvoices: ["compras", "canRegisterPurchase"],
    monthlyCharges: ["finanzas", "canRegisterReceipts"],
    clientContracts: ["clientes", action === "delete" ? "canDeleteContracts" : "canUploadContracts"],
    clientDocuments: ["clientes", action === "delete" ? "canDeleteContracts" : "canUploadContracts"],
    plans: ["clientes", "canEditServicePrices"], hostingDomains: ["clientes", "canEditServicePrices"],
    inventoryCategories: ["inventarios", "canEditProduct"], inventoryBrands: ["inventarios", "canEditProduct"],
    inventoryWarehouses: ["inventarios", "canEditProduct"],
  };
  if(user.accessRoleId){
    const custom: Record<string,[keyof UserModulePermissions,string]>={clientProjects:["proyectos","canManageClientTasks"],ticketSubjects:["tickets","canManageSubjects"],policies:["arcotel","canManageRegulatoryData"],regulatoryTramites:["arcotel","canManageRegulatoryData"],arcotelFiles:["arcotel","canManageRegulatoryFiles"],systemConfig:["configuracion","canEditGeneralSettings"]};
    if(action==="delete"){custom.projects=["proyectos","canDeleteProject"];custom.tickets=["tickets","canDeleteTicket"];}
    if(action==="delete"&&entity==="arcotelFiles")delete custom.arcotelFiles;
    const requested=custom[entity];if(requested&&!canUser(user,requested[0],requested[1]))throw new HttpError(403,"No tienes permiso para esta función.");
  }
  const grant = actions[entity];
  if (grant && !canUser(user, grant[0], grant[1])) throw new HttpError(403, "No tienes permiso para modificar este registro.");
  if (entity === "arcotelFiles" && action === "delete" && !canPerformAction(user, "canDeleteFiles")) throw new HttpError(403, "No tienes permiso para eliminar archivos de ARCOTEL.");
  if (entity === "systemConfig" && !canAccessSubmodule(user, "configuracion", "general")) throw new HttpError(403, "No tienes acceso a Configuración general.");
}
