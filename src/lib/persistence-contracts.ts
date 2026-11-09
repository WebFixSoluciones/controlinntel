import { can, canAccessModule, canAccessSubmodule, canUser, canViewFinancialAmounts, type Entity } from "./permissions.ts";
import type { UserProfile,UserModulePermissions } from "@/types";

// Canonical physical names and routes for every collection exposed by /api/data.
export const commandCollections:Partial<Record<Entity,string>>={
  clients:"createClient / actualización de perfil",clientServices:"assignService / editService / retireService",
  inventoryProducts:"createProduct / editProduct",inventoryKardex:"efecto de operación de inventario",
  inventoryTransfers:"inventoryTransfer",inventoryAdjustments:"inventoryAdjustment",billingInvoices:"issueSale / editSale / cancelSale (notas internas)",
  monthlyCharges:"emisión / manualCharge / payCharge / reverseApplication / cancelCharge",clientAdvances:"advance / applyAdvance / applyClientCredit / cancelAdvance",
  bankAccounts:"createBank / editBank / adjustBank",financialMovements:"bankMovement / transfer / cobro / pago",
  purchaseInvoices:"purchase / paySupplier / ajustes",supplierPayments:"paySupplier",supplierCreditNotes:"supplierCredit",supplierDebitNotes:"supplierDebit",
  expenses:"expense",systemUsers:"/api/users",operationLog:"solo servidor; lectura paginada en /api/operations",
  supplierCredits:"supplierCredit / paySupplier con aplicación de saldo",
  auditLogs:"solo servidor, derivada de operationLog",
};
export const storageName=(entity:Entity)=>entity==="systemUsers"?"users":entity;
export function canReadCollection(user:UserProfile,entity:Entity) {
  if(user.status!=="activo")return false;
  if(user.role==="superadmin")return true;
  if(entity==="userRoleTemplates")return false;
  if(entity==="documentTemplates")return canAccessModule(user,"plantillas");
  if(entity==="systemUsers")return can(user,"manage_users")&&canAccessSubmodule(user,"personas","usuarios_equipo");
  if(!canViewFinancialAmounts(user) && (["monthlyCharges","clientAdvances","expenses","financialMovements","bankAccounts","purchaseInvoices","supplierPayments","supplierCredits","supplierCreditNotes","supplierDebitNotes","purchaseWithholdings","clientQuotes"].includes(entity)||entity.startsWith("billing")))return false;
  if(entity==="suppliers")return canAccessSubmodule(user,"personas","proveedores")||canAccessModule(user,"compras");
  if(["systemUsers","auditLogs","operationLog"].includes(entity))return can(user,"manage_users");
  if(entity==="vault")return canUser(user,"boveda","canViewInternalVault");
  if(entity==="clientVaultItems")return canUser(user,"boveda","canViewClientVault");
  const fiscalScreens: Partial<Record<Entity, string>> = {
    billingCreditNotes: "notas_credito", billingDebitNotes: "notas_debito", billingWithholdings: "retenciones", billingRemissionGuides: "guias_remision",
  };
  if(fiscalScreens[entity])return canAccessSubmodule(user,"facturacion",fiscalScreens[entity]!);
  let modules:(keyof UserModulePermissions)[];
  if(entity.startsWith("inventory"))modules=["inventarios"];
  else if(["clients","clientServices","plans","clientDocuments","clientContracts","clientProjects","hostingDomains"].includes(entity))modules=["abonados"];
  else if(entity==="clientQuotes")return canAccessSubmodule(user,"ventas","cotizaciones");
  else if(["nodes","ipPools"].includes(entity))modules=["red"];
  else if(entity==="projects")modules=["proyectos"];
  else if(["tickets","ticketSubjects","ticketDepartments"].includes(entity))modules=["tickets"];
  else if(["policies","arcotelFiles","regulatoryTramites","systemConfig"].includes(entity))modules=["arcotel","configuracion"];
  else if(entity==="billingInvoices")return canAccessSubmodule(user,"ventas","notas_venta")||canAccessSubmodule(user,"ventas","nueva_venta")||canAccessSubmodule(user,"ventas","recurrentes")||canAccessSubmodule(user,"facturacion","facturas");
  else if(entity==="billingQuotes")return canAccessSubmodule(user,"ventas","cotizaciones")||canAccessSubmodule(user,"facturacion","cotizaciones");
  else if(entity.startsWith("billing")||entity==="sriCompanyConfig")modules=["facturacion","configuracion"];
  else if(["suppliers","purchaseInvoices","supplierCreditNotes","supplierDebitNotes","supplierPayments","supplierCredits","purchaseWithholdings"].includes(entity))modules=["compras"];
  else modules=["finanzas"];
  return modules.some(module=>canAccessModule(user,module));
}

export function canReadBillingDocument(user: UserProfile, row: { documentType?: unknown }): boolean {
  if (!canReadCollection(user, "billingInvoices")) return false;
  return row.documentType === "nota_venta"
    ? ["notas_venta", "nueva_venta", "recurrentes"].some(key => canAccessSubmodule(user, "ventas", key))
    : canAccessSubmodule(user, "facturacion", "facturas");
}
