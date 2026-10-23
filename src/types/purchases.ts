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

export interface InventoryActions {
  canCreateProduct: boolean;
  canCreateService: boolean;
  canEditProduct: boolean;
  canChangePrices: boolean;       // 🔒 Modificar precios de venta
  canViewCosts: boolean;          // 🔒 Ver costos de compra / margen
  canAdjustStock: boolean;        // 🔒 Ajustes de stock / mermas
  canTransferWarehouses: boolean; // Transferencias entre bodegas
  canDeleteItems: boolean;        // 🔒 Eliminar productos o servicios
}

export interface BillingActions {
  canCreateInvoice: boolean;
  canEditPrices: boolean;         // 🔒 Modificar precio unitario en venta
  canApplyDiscounts: boolean;     // 🔒 Descuentos manuales
  canAuthorizeSri: boolean;       // Firmar / emitir ante el SRI
  canCancelInvoices: boolean;     // 🔒 Notas de crédito / anular facturas
  canCreateQuotes: boolean;
  canApproveQuotes: boolean;
  canViewSalesReports: boolean;
}

export interface ClientActions {
  canCreateClient: boolean;
  canEditClient: boolean;
  canEditServicePrices: boolean;  // 🔒 Editar tarifa mensual de servicio
  canUploadContracts: boolean;
  canDeleteContracts: boolean;    // 🔒 Eliminar contratos
  canDeleteClient: boolean;       // 🔒 Eliminar cliente
}

export interface PurchaseActions {
  canCreateSupplier: boolean;
  canRegisterPurchase: boolean;
  canApprovePayments: boolean;    // 🔒 Autorizar pagos a proveedores
  canEmitWithholding: boolean;    // Emitir retenciones
  canViewSupplierBank: boolean;   // Ver datos bancarios
}

export interface FinanceActions {
  canViewBankBalances: boolean;   // 🔒 Ver saldos de cuentas bancarias
  canRegisterReceipts: boolean;   // Registrar cobros y abonos
  canRegisterExpenses: boolean;   // Registrar gastos
  canCancelPayments: boolean;     // 🔒 Anular movimientos financieros
  canExportReports: boolean;      // Exportar balances contables
}

export interface NetworkActions {
  canManageNodes: boolean;
  canAssignIps: boolean;
  canEditRouterCredentials: boolean; // 🔒 Credenciales router NOC
}

export interface VaultActions {
  canViewClientVault: boolean;
  canViewInternalVault: boolean;  // 🔒 Credenciales NOC
  canRevealPasswords: boolean;    // 🔒 Revelar y descifrar contraseñas
  canDeleteCredentials: boolean;  // 🔒 Eliminar credenciales
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
  clientes?: {
    enabled: boolean;
    actions?: ClientActions;
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
    actions?: PurchaseActions;
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
    actions?: FinanceActions;
  };
  facturacion?: {
    enabled: boolean;
    submodules: {
      facturas: boolean;
      cotizaciones: boolean;
      notas_credito: boolean;
      retenciones: boolean;
      guias_remision: boolean;
    };
    actions?: BillingActions;
  };
  inventarios?: {
    enabled: boolean;
    submodules: {
      productos: boolean;
      servicios: boolean;
      categorias: boolean;
      kardex: boolean;
      transferencias: boolean;
      bodegas: boolean;
      ajustes: boolean;
    };
    actions?: InventoryActions;
  };
  red?: {
    enabled: boolean;
    submodules: {
      nodos: boolean;
      pools_ip: boolean;
    };
    actions?: NetworkActions;
  };
  proyectos?: { enabled: boolean };
  tickets?: { enabled: boolean };
  arcotel?: { enabled: boolean };
  boveda?: {
    enabled: boolean;
    actions?: VaultActions;
  };
  plantillas?: { enabled: boolean };
  configuracion?: {
    enabled: boolean;
    submodules?: {
      general: boolean;
      sri: boolean;
    };
  };
  actions?: {
    canDeleteClients?: boolean;
    canDeleteFiles?: boolean;
    canEditInvoices?: boolean;
    canDeleteInvoices?: boolean;
  };
}
