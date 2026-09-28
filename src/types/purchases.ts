// ==========================================
// INNTEL CORP - PURCHASES, SUPPLIERS & FINANCE EXTENSIONS
// ==========================================

export type SupplierCategory =
  | "transito_ip"
  | "fibra_optica"
  | "equipos_networking"
  | "ferreteria_infraestructura"
  | "servicios_profesionales"
  | "arriendo_espacio_nodo"
  | "general";

export interface Supplier {
  id: string;
  ruc: string;
  razonSocial: string;
  nombreComercial?: string;
  category: SupplierCategory;
  email: string;
  phone: string;
  address: string;
  city?: string;
  creditDaysDefault: number; // 0 = contado, 15, 30, etc.
  bankName?: string;
  bankAccountType?: "ahorros" | "corriente";
  bankAccountNumber?: string;
  bankAccountOwner?: string;
  notes?: string;
  status: "activo" | "inactivo";
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseItem {
  id: string;
  productId?: string;
  sku?: string;
  name: string;
  description?: string;
  quantity: number;
  unitCost: number;
  discount: number;
  ivaRate: number; // 15, 0, 5
  subtotal: number;
  ivaAmount: number;
  total: number;
  warehouseId: string;
}

export type PurchasePaymentCondition = "contado" | "credito";
export type PurchasePaymentStatus = "pagado" | "pendiente" | "abono_parcial";

export interface PurchaseInvoice {
  id: string;
  documentNumber: string; // ej. "001-002-000012345"
  claveAcceso?: string;   // 49 dígitos oficiales si es XML SRI
  date: string;           // YYYY-MM-DD
  supplierId: string;
  supplierName: string;
  supplierRuc: string;
  items: PurchaseItem[];
  subtotal15: number;
  subtotal0: number;
  subtotal: number;
  ivaAmount: number;
  total: number;
  paymentCondition: PurchasePaymentCondition;
  paymentMethod?: string;
  bankAccountId?: string;
  paymentStatus: PurchasePaymentStatus;
  paidAmount: number;
  balanceRemaining: number;
  dueDate?: string;
  inventoryStatus: "ingresado" | "no_aplica";
  xmlContent?: string;
  notes?: string;
  createdAt: string;
}

export interface SupplierCreditNote {
  id: string;
  purchaseInvoiceId: string;
  documentNumber: string;
  claveAcceso?: string;
  supplierId: string;
  supplierName: string;
  date: string;
  total: number;
  reason: "devolucion_mercaderia" | "descuento_bonificacion" | "correccion_precio";
  items?: {
    productId: string;
    productName: string;
    warehouseId: string;
    quantity: number;
    unitCost: number;
  }[];
  notes?: string;
  createdAt: string;
}

export interface SupplierDebitNote {
  id: string;
  purchaseInvoiceId: string;
  documentNumber: string;
  claveAcceso?: string;
  supplierId: string;
  supplierName: string;
  date: string;
  total: number;
  reason: string;
  createdAt: string;
}

export interface PurchaseWithholding {
  id: string;
  purchaseInvoiceId: string;
  documentNumber: string;
  claveAcceso: string;
  supplierId: string;
  supplierName: string;
  supplierRuc: string;
  date: string;
  rentaBase: number;
  rentaPercentage: number;
  rentaAmount: number;
  ivaBase: number;
  ivaPercentage: number;
  ivaAmount: number;
  totalWithheld: number;
  createdAt: string;
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountType: "corriente" | "ahorros" | "caja_efectivo";
  accountNumber: string;
  currency: "USD";
  initialBalance: number;
  currentBalance: number;
  status: "activa" | "inactiva";
}

export interface FinancialMovement {
  id: string;
  type: "ingreso" | "egreso";
  date: string;
  amount: number;
  category: string;
  description: string;
  bankAccountId: string;
  bankAccountName: string;
  paymentMethod: "transferencia" | "cheque" | "efectivo" | "tarjeta";
  referenceNumber?: string;
  relatedEntityId?: string;
  createdAt: string;
}

export interface SupplierPaymentRecord {
  id: string;
  purchaseInvoiceId: string;
  supplierId: string;
  supplierName: string;
  date: string;
  amount: number;
  bankAccountId: string;
  bankAccountName: string;
  paymentMethod: "transferencia" | "cheque" | "efectivo";
  referenceNumber: string;
  notes?: string;
  registeredBy: string;
  createdAt: string;
}

export interface UserModulePermissions {
  abonados?: { enabled: boolean };
  personas?: {
    enabled: boolean;
    submodules: {
      proveedores: boolean;
      usuarios_equipo: boolean;
    };
  };
  compras?: {
    enabled: boolean;
    submodules: {
      historial_compras: boolean;
      registrar_compra: boolean;
      notas_credito: boolean;
      notas_debito: boolean;
      retenciones: boolean;
    };
  };
  finanzas?: {
    enabled: boolean;
    submodules: {
      movimientos: boolean;
      bancos: boolean;
      cuentas_por_cobrar: boolean;
      cuentas_por_pagar: boolean;
      reportes: boolean;
    };
  };

  facturacion?: {
    enabled: boolean;
    submodules: {
      facturas: boolean;
      cotizaciones: boolean;
      notas_credito: boolean;
      retenciones: boolean;
      guias_remision: boolean;
      configuracion_sri: boolean;
    };
  };
  inventarios?: {
    enabled: boolean;
    submodules: {
      productos: boolean;
      bodegas: boolean;
      kardex: boolean;
      transferencias: boolean;
      ajustes: boolean;
    };
  };
  red?: {
    enabled: boolean;
    submodules: {
      nodos: boolean;
      pools_ip: boolean;
    };
  };
  proyectos?: { enabled: boolean };
  tickets?: { enabled: boolean };
  arcotel?: { enabled: boolean };
  boveda?: { enabled: boolean };
  plantillas?: { enabled: boolean };
  configuracion?: { enabled: boolean };
}
