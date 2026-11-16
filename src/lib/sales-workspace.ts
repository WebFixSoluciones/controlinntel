import type { UserProfile } from "@/types";
import { canAccessSubmodule, canUser } from "./permissions.ts";

export function canUseSalesWorkspace(user: UserProfile) {
  return canAccessSubmodule(user, "ventas", "nueva_venta") && canUser(user, "ventas", "canCreateInvoice")
    || canAccessSubmodule(user, "ventas", "cotizaciones") && canUser(user, "ventas", "canCreateQuotes")
    || canAccessSubmodule(user, "ventas", "notas_venta");
}

export function canCreateSalesClient(user: UserProfile) {
  return canUser(user, "clientes", "canCreateClient") || (canAccessSubmodule(user, "ventas", "nueva_venta") || canAccessSubmodule(user, "ventas", "cotizaciones")) && canUser(user, "ventas", "canCreateClient");
}

export const salesLookupFields: Record<string, string[]> = {
  clients: ["businessName", "tradeName", "legalRepresentative", "identificationType", "identificationNumber", "email", "phone", "address", "status", "currentBalance", "sriValidated"],
  inventoryProducts: ["name", "sku", "barcode", "description", "type", "unit", "status", "salePrice", "salePriceConIva", "ivaRate", "taxMode", "categoryId", "categoryName", "tracksStock", "stock", "stockByWarehouse", "serialNumberRequired"],
  inventoryCategories: ["name", "itemType"],
  inventoryWarehouses: ["name", "status", "isDefault"],
  bankAccounts: ["bankName", "accountType", "accountNumber", "status"],
  clientServices: ["clientId", "planId", "inventoryProductId", "planName", "status"],
  monthlyCharges: ["clientId", "invoiceId", "invoiceNumber", "status", "total", "paidAmount", "balanceRemaining", "month", "year", "saleDate"],
};

export function salesLookupRow(entity: string, row: Record<string, any>) {
  if (entity === "clients" && row.status === "retirado" || entity === "inventoryProducts" && row.status === "inactivo" || entity === "bankAccounts" && row.status !== "activa") return null;
  return Object.fromEntries(["id", ...salesLookupFields[entity] || []].filter(key => key in row).map(key => [key, row[key]]));
}
