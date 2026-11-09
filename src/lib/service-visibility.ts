import type { UserProfile } from "@/types";
import { canUser, canViewServicePrices } from "./permissions.ts";

type Row = Record<string, unknown>;

export const servicePriceFields = {
  clientServices: ["basePrice", "customPrice", "priceConIva", "ivaRate", "zeroPriceReason"],
  plans: ["defaultPrice"],
  clientContracts: ["monthlyPrice"],
  hostingDomains: ["annualCost"],
  inventoryProducts: ["baseCost", "salePrice", "salePriceConIva", "ivaRate"],
} as const;

export function visibleServiceData(user: UserProfile, collection: string, row: Row): Row {
  if (collection === "billingInvoices" && Array.isArray(row.items) && !canUser(user, "inventarios", "canViewCosts")) {
    return { ...row, items: row.items.map(item => {
      const { costUnitSnapshot, costTotalSnapshot, costKindSnapshot, ...visible } = item;
      return visible;
    }) };
  }
  let hidden: readonly string[] = [];
  if (!canViewServicePrices(user)) {
    if (collection === "clientServices") hidden = servicePriceFields.clientServices;
    if (collection === "plans") hidden = servicePriceFields.plans;
    if (collection === "clientContracts") hidden = servicePriceFields.clientContracts;
    if (collection === "hostingDomains") hidden = servicePriceFields.hostingDomains;
    if (collection === "inventoryProducts" && row.type === "servicio") hidden = servicePriceFields.inventoryProducts;
  }
  if (!canUser(user, "inventarios", "canViewCosts")) {
    if (collection === "inventoryProducts") hidden = [...hidden, "baseCost"];
    if (collection === "inventoryKardex") hidden = ["entryUnitCost", "entryTotalCost", "exitUnitCost", "exitTotalCost", "balanceAverageCost", "balanceTotalCost"];
    if (collection === "inventoryTransfers") hidden = ["unitCost", "totalCost"];
  }
  return hidden.length ? Object.fromEntries(Object.entries(row).filter(([key]) => !hidden.includes(key))) : row;
}
