// ==========================================
// INNTEL CORP - ERP INVENTORY MODULE TYPES
// ==========================================

export type InventoryItemType = "producto" | "servicio" | "combo";

export type UnitOfMeasure =
  | "unidad"
  | "metro"
  | "rollo"
  | "caja"
  | "kit"
  | "servicio"
  | "hora";

export type TaxMode = "EXCLUIDO" | "INCLUIDO";

export type KardexMovementType =
  | "PURCHASE_RECEIPT"     // Entrada por compra a proveedor
  | "SALE"                 // Salida por venta / facturación
  | "POSITIVE_ADJUSTMENT"  // Ajuste positivo (ingreso por sobrante / corrección)
  | "NEGATIVE_ADJUSTMENT"  // Ajuste negativo (egreso por faltante / daño)
  | "CUSTOMER_RETURN"      // Reingreso por nota de crédito / devolución
  | "SUPPLIER_RETURN"      // Salida por devolución a proveedor
  | "TRANSFER_IN"          // Entrada por transferencia inter-bodega
  | "TRANSFER_OUT"         // Salida por transferencia inter-bodega
  | "SHRINKAGE"            // Merma / desecho / pérdida técnica
  | "MASSIVE_ZERO";        // Encerado global de inventario

export interface InventoryProduct {
  id: string;
  sku: string;                    // Código interno (ej. ONT-HW-EG8145V5)
  barcode?: string;               // Código de barras / EAN13
  name: string;                   // Nombre comercial (ej. ONT Huawei Dual Band)
  description?: string;
  type: InventoryItemType;        // "producto" | "servicio" | "combo"
  categoryId: string;             // ID categoría
  categoryName?: string;
  brandId?: string;               // ID marca (ej. Huawei, MikroTik, FiberHome)
  brandName?: string;
  unit: UnitOfMeasure;            // "unidad", "metro", etc.
  
  // Precios e Impuestos (Normativa Ecuador)
  baseCost: number;               // Costo promedio ponderado ($)
  salePrice: number;              // Precio de venta base sin IVA ($)
  salePriceConIva: number;        // Precio de venta calculado con IVA ($)
  taxMode: TaxMode;               // "EXCLUIDO" | "INCLUIDO"
  ivaRate: number;                // Porcentaje: 15 (vigente), 0, 5
  
  // Control de Stock
  tracksStock: boolean;           // true para productos físicos, false para servicios
  stock: number;                  // Stock total consolidado
  minStock: number;               // Alerta de stock mínimo
  maxStock?: number;              // Stock máximo sugerido
  
  // Stock por Bodega: { [warehouseId]: number }
  stockByWarehouse: Record<string, number>;
  defaultWarehouseId?: string;    // Bodega predeterminada
  
  // Atributos de Telecomunicaciones / ISP
  model?: string;
  serialNumberRequired?: boolean; // Requiere serializar en salidas (ONTs, Routers)
  fiberLengthMeters?: number;     // Metraje si es bobina de fibra
  
  status: "activo" | "inactivo";
  createdAt: string;
  updatedAt: string;
}

export interface Warehouse {
  id: string;
  code: string;                   // Ej. "BOD-CENTRAL", "BOD-GYE", "BOD-MOV-01"
  name: string;                   // Ej. "Bodega Central - Quito"
  address?: string;
  city?: string;
  responsibleName?: string;       // Nombre del custodio / técnico responsable
  responsiblePhone?: string;
  isDefault?: boolean;            // Bodega principal del sistema
  status: "activo" | "inactivo";
  createdAt: string;
}

export interface ProductCategory {
  id: string;
  name: string;                   // Ej. "Equipos de Red & ONTs", "Fibra Óptica & Pasivos"
  description?: string;
  itemType: "producto" | "servicio" | "ambos";
  createdAt: string;
}

export interface ProductBrand {
  id: string;
  name: string;                   // Ej. "Huawei", "MikroTik", "Ubiquiti", "FiberHome"
  originCountry?: string;
  createdAt: string;
}

export interface KardexEntry {
  id: string;
  date: string;
  productId: string;
  productName: string;
  warehouseId: string;
  warehouseName: string;
  type: KardexMovementType;
  referenceId: string;            // ID de factura, compra, transferencia o ajuste
  referenceDocNumber?: string;    // Ej. "FAC-001-001-00000045" o "TRF-2026-001"
  concept: string;                // Descripción humana del movimiento
  
  // Entradas (Si aplica)
  entryQuantity?: number;
  entryUnitCost?: number;
  entryTotalCost?: number;
  
  // Salidas (Si aplica)
  exitQuantity?: number;
  exitUnitCost?: number;
  exitTotalCost?: number;
  
  // Saldos Resultantes (Ponderado)
  balanceQuantity: number;
  balanceAverageCost: number;
  balanceTotalCost: number;
  
  userId?: string;
  userName?: string;
  createdAt: string;
}

export interface WarehouseTransfer {
  id: string;
  transferNumber: string;         // Ej. "TRF-0001"
  date: string;
  originWarehouseId: string;
  originWarehouseName: string;
  destWarehouseId: string;
  destWarehouseName: string;
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  reason: string;
  responsibleUser: string;
  status: "completada" | "anulada";
  createdAt: string;
}

export interface InventoryAdjustmentItem {
  productId: string;
  productName: string;
  type: "ingreso" | "egreso";
  quantity: number;
  unitCost: number;
  previousStock: number;
  newStock: number;
}

export interface InventoryAdjustment {
  id: string;
  adjustmentNumber: string;       // Ej. "ADJ-0001"
  date: string;
  type: "manual_ingreso" | "manual_egreso" | "masivo" | "encerar";
  warehouseId: string;
  warehouseName: string;
  concept: string;
  items: InventoryAdjustmentItem[];
  responsibleUser: string;
  createdAt: string;
}
