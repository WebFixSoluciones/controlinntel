import {
  InventoryProduct,
  KardexEntry,
  KardexMovementType,
  Warehouse,
} from "@/types";

/**
 * Calcula el Costo Promedio Ponderado para una entrada de inventario.
 * Fórmula: ((Stock Actual * Costo Actual) + (Cantidad Entrada * Costo Entrada)) / (Stock Actual + Cantidad Entrada)
 */
export function calculateWeightedAverageCost(
  currentStock: number,
  currentAverageCost: number,
  entryQuantity: number,
  entryUnitCost: number
): number {
  const currentTotal = Math.max(0, currentStock) * Math.max(0, currentAverageCost);
  const entryTotal = Math.max(0, entryQuantity) * Math.max(0, entryUnitCost);
  const newStock = Math.max(0, currentStock) + Math.max(0, entryQuantity);

  if (newStock <= 0) {
    return Number(entryUnitCost) || Number(currentAverageCost) || 0;
  }

  const result = (currentTotal + entryTotal) / newStock;
  return Math.round(result * 10000) / 10000;
}

/**
 * Calcula el precio con IVA incluido (por defecto 15% vigente en Ecuador).
 */
export function calculatePriceWithTax(priceSinIva: number, ivaRate: number = 15): number {
  const base = Math.max(0, Number(priceSinIva) || 0);
  const rate = Math.max(0, Number(ivaRate) || 0) / 100;
  const conIva = base * (1 + rate);
  return Math.round(conIva * 100) / 100;
}

/**
 * Desglosa el precio sin IVA a partir de un valor que ya incluye impuesto.
 */
export function calculatePriceWithoutTax(priceConIva: number, ivaRate: number = 15): number {
  const total = Math.max(0, Number(priceConIva) || 0);
  const rate = Math.max(0, Number(ivaRate) || 0) / 100;
  if (1 + rate === 0) return total;
  const sinIva = total / (1 + rate);
  return Math.round(sinIva * 100) / 100;
}

/**
 * Valida si hay stock suficiente en una bodega específica para una salida o transferencia.
 */
export function validateStockAvailability(
  product: InventoryProduct,
  warehouseId: string,
  requestedQuantity: number
): { valid: boolean; currentStock: number; error?: string } {
  if (!product.tracksStock || product.type === "servicio") {
    return { valid: true, currentStock: 999999 };
  }

  const currentStock = Number(product.stockByWarehouse?.[warehouseId] || 0);
  const qty = Number(requestedQuantity) || 0;

  if (qty <= 0) {
    return {
      valid: false,
      currentStock,
      error: "La cantidad debe ser mayor a cero.",
    };
  }

  if (currentStock < qty) {
    return {
      valid: false,
      currentStock,
      error: `Stock insuficiente en la bodega seleccionada. Disponible: ${currentStock}, Solicitado: ${qty}.`,
    };
  }

  return { valid: true, currentStock };
}

/**
 * Genera el secuencial consecutivo para transferencias o ajustes.
 */
export function generateInventoryDocNumber(
  prefix: "TRF" | "ADJ" | "KDX",
  existingCount: number
): string {
  const currentYear = new Date().getFullYear();
  const sequence = String(existingCount + 1).padStart(4, "0");
  return `${prefix}-${currentYear}-${sequence}`;
}

/**
 * Construye una entrada reglamentaria de Kardex valorado.
 */
export function buildKardexEntry({
  product,
  warehouse,
  type,
  referenceId,
  referenceDocNumber,
  concept,
  quantity,
  unitCost,
  currentStock,
  currentAvgCost,
  userName,
}: {
  product: InventoryProduct;
  warehouse: Warehouse;
  type: KardexMovementType;
  referenceId: string;
  referenceDocNumber?: string;
  concept: string;
  quantity: number;
  unitCost: number;
  currentStock: number;
  currentAvgCost: number;
  userName?: string;
}): KardexEntry {
  const isEntry = [
    "PURCHASE_RECEIPT",
    "POSITIVE_ADJUSTMENT",
    "CUSTOMER_RETURN",
    "TRANSFER_IN",
  ].includes(type);

  const qty = Math.abs(Number(quantity) || 0);
  const cost = Math.max(0, Number(unitCost) || 0);

  let newStock = currentStock;
  let newAvgCost = currentAvgCost;

  if (isEntry) {
    newStock = currentStock + qty;
    newAvgCost = calculateWeightedAverageCost(currentStock, currentAvgCost, qty, cost);
  } else {
    newStock = Math.max(0, currentStock - qty);
    // En salidas, el costo ponderado se mantiene constante
    newAvgCost = currentAvgCost;
  }

  const entryQuantity = isEntry ? qty : undefined;
  const entryUnitCost = isEntry ? cost : undefined;
  const entryTotalCost = isEntry ? qty * cost : undefined;

  const exitQuantity = !isEntry ? qty : undefined;
  const exitUnitCost = !isEntry ? currentAvgCost : undefined;
  const exitTotalCost = !isEntry ? qty * currentAvgCost : undefined;

  return {
    id: `kdx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    date: new Date().toISOString(),
    productId: product.id,
    productName: product.name,
    warehouseId: warehouse.id,
    warehouseName: warehouse.name,
    type,
    referenceId,
    referenceDocNumber,
    concept,
    entryQuantity,
    entryUnitCost,
    entryTotalCost,
    exitQuantity,
    exitUnitCost,
    exitTotalCost,
    balanceQuantity: newStock,
    balanceAverageCost: newAvgCost,
    balanceTotalCost: Math.round(newStock * newAvgCost * 100) / 100,
    userName: userName || "Sistema INNTEL",
    createdAt: new Date().toISOString(),
  };
}
