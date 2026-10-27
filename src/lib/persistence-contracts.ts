import { can, canAccessModule, canUser, type Entity } from "./permissions.ts";
import type { UserProfile,UserModulePermissions } from "@/types";

// Canonical physical names and routes for every collection exposed by /api/data.
export const commandCollections:Partial<Record<Entity,string>>={
  clients:"createClient / actualización de perfil",clientServices:"assignService / editService / retireService",
  inventoryProducts:"createProduct / editProduct",inventoryKardex:"efecto de operación de inventario",
  inventoryTransfers:"inventoryTransfer",inventoryAdjustments:"inventoryAdjustment",billingInvoices:"issueSale / editSale / cancelSale (notas internas)",
  monthlyCharges:"emisión / manualCharge / payCharge / reverseApplication / cancelCharge",clientAdvances:"advance / applyAdvance / cancelAdvance",
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
  if(["systemUsers","auditLogs","operationLog"].includes(entity))return can(user,"manage_users");
  if(entity==="vault")return canUser(user,"boveda","canViewInternalVault");
  if(entity==="clientVaultItems")return canUser(user,"boveda","canViewClientVault");
  let modules:(keyof UserModulePermissions)[];
  if(entity.startsWith("inventory"))modules=["inventarios"];
  else if(["clients","clientServices","plans","clientDocuments","clientContracts","clientProjects","hostingDomains"].includes(entity))modules=["abonados"];
  else if(entity==="clientQuotes")modules=["ventas"];
  else if(["nodes","ipPools"].includes(entity))modules=["red"];
  else if(entity==="projects")modules=["proyectos"];
  else if(["tickets","ticketSubjects"].includes(entity))modules=["tickets"];
  else if(["policies","arcotelFiles","regulatoryTramites","systemConfig"].includes(entity))modules=["arcotel","configuracion"];
  else if(["billingInvoices","billingQuotes"].includes(entity))modules=["ventas","facturacion"];
  else if(entity.startsWith("billing")||entity==="sriCompanyConfig")modules=["facturacion","configuracion"];
  else if(["suppliers","purchaseInvoices","supplierCreditNotes","supplierDebitNotes","supplierPayments","supplierCredits","purchaseWithholdings"].includes(entity))modules=["compras"];
  else modules=["finanzas"];
  return modules.some(module=>canAccessModule(user,module));
}
