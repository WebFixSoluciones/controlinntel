import type {
  UserProfile,
  UserModulePermissions,
  UserRole,
  InventoryActions,
  BillingActions,
  ClientActions,
  PurchaseActions,
  FinanceActions,
  NetworkActions,
  VaultActions,
} from "@/types";

export const collectionPermissions = {
  clients: "manage_clients", clientServices: "manage_clients", plans: "manage_clients",
  projects: "manage_network", clientProjects: "manage_clients", clientContracts: "manage_clients",
  clientQuotes: "manage_finance", nodes: "manage_network", ipPools: "manage_network",
  policies: "manage_policies", tickets: "manage_tickets", ticketSubjects: "manage_tickets", ticketDepartments: "manage_tickets", expenses: "manage_finance",
  expenseCategories: "manage_finance", monthlyCharges: "manage_finance", clientAdvances: "manage_finance", vault: "manage_vault", clientVaultItems: "manage_vault",
  systemUsers: "manage_users", userRoleTemplates: "manage_users", auditLogs: "manage_users",
  documentTemplates: "export_reports",
  arcotelFiles: "manage_policies", clientDocuments: "manage_clients",
  inventoryProducts: "manage_network", inventoryWarehouses: "manage_network",
  inventoryCategories: "manage_network", inventoryBrands: "manage_network",
  inventoryKardex: "manage_finance", inventoryTransfers: "manage_network",
  inventoryAdjustments: "manage_finance",
  billingInvoices: "manage_finance", billingQuotes: "manage_finance",
  billingCreditNotes: "manage_finance", billingDebitNotes: "manage_finance", billingWithholdings: "manage_finance",
  billingRemissionGuides: "manage_network", sriCompanyConfig: "manage_finance",
  // Compras & Proveedores
  suppliers: "manage_finance",
  purchaseInvoices: "manage_finance",
  supplierCreditNotes: "manage_finance",
  supplierDebitNotes: "manage_finance",
  purchaseWithholdings: "manage_finance",
  bankAccounts: "manage_finance",
  financialMovements: "manage_finance",
  supplierPayments: "manage_finance",
  supplierCredits: "manage_finance",
  hostingDomains: "manage_network",
  regulatoryTramites: "manage_policies",
  systemConfig: "manage_policies",
  operationLog: "manage_users",
} as const;

export type Entity = keyof typeof collectionPermissions;

export const DEFAULT_ACCOUNT_PERMISSIONS: Record<UserRole, NonNullable<UserProfile["permissions"]>> = {
  superadmin: ["all"],
  admin: ["manage_clients", "manage_finance", "manage_network", "manage_tickets", "manage_vault", "manage_policies", "export_reports"],
  ventas: ["manage_clients", "manage_finance", "export_reports"],
  finanzas: ["manage_finance", "manage_clients", "export_reports"],
  tecnico: ["manage_clients", "manage_network", "manage_tickets"],
  soporte: ["manage_tickets"],
  bodega: ["manage_network"],
  legal: ["manage_policies", "export_reports"],
  consulta: ["export_reports"],
};

export function effectiveAccountPermissions(role: UserRole, permissions: UserProfile["permissions"] = []) {
  if (role !== "tecnico" || !permissions.includes("all")) return permissions;
  return [...new Set([...DEFAULT_ACCOUNT_PERMISSIONS.tecnico, ...permissions.filter(permission => permission !== "all")])];
}

export function canViewServicePrices(user: UserProfile | undefined | null): boolean {
  return user?.status === "activo" && (user.role === "superadmin"
    || (user.modulePermissions?.visibility?.canViewServicePrices ?? user.role !== "tecnico"));
}

export function canViewFinancialAmounts(user: UserProfile | undefined | null): boolean {
  return user?.status === "activo" && (user.role === "superadmin"
    || (user.modulePermissions?.visibility?.canViewFinancialAmounts ?? user.role !== "tecnico"));
}

export function canViewProductPrices(user: UserProfile | undefined | null): boolean {
  return user?.status === "activo" && (user.role === "superadmin"
    || (user.modulePermissions?.visibility?.canViewProductPrices ?? user.role !== "tecnico"));
}

export function canManageTicketDepartments(user: UserProfile): boolean {
  return can(user, "manage_tickets") && canAccessModule(user, "tickets") &&
    (user.role === "superadmin" || (user.modulePermissions?.tickets?.actions?.canManageDepartments ?? user.role === "admin"));
}

export function canManageTemplates(user: UserProfile): boolean {
  return canAccessModule(user, "plantillas") && user.role !== "consulta" && (user.role === "superadmin"
    || (user.modulePermissions?.plantillas?.actions?.canManageTemplates ?? user.role === "admin"));
}

export function can(user: UserProfile, permission: string) {
  if (!user || user.status !== "activo") return false;
  if (user.role === "superadmin") return true;
  return effectiveAccountPermissions(user.role, user.permissions).some(p => p === "all" || p === permission);
}

export const DEFAULT_INVENTORY_ACTIONS: InventoryActions = {
  canCreateProduct: true,
  canCreateService: true,
  canEditProduct: true,
  canChangePrices: true,
  canViewCosts: true,
  canAdjustStock: true,
  canTransferWarehouses: true,
  canDeleteItems: true,
};

export const DEFAULT_BILLING_ACTIONS: BillingActions = {
  canCreateInvoice: true,
  canEditPrices: true,
  canApplyDiscounts: true,
  canAuthorizeSri: true,
  canCancelInvoices: true,
  canCreateQuotes: true,
  canApproveQuotes: true,
  canViewSalesReports: true,
};

export const DEFAULT_CLIENT_ACTIONS: ClientActions = {
  canCreateClient: true,
  canEditClient: true,
  canEditServicePrices: true,
  canUploadContracts: true,
  canDeleteContracts: true,
  canDeleteClient: true,
};

export const DEFAULT_PURCHASE_ACTIONS: PurchaseActions = {
  canCreateSupplier: true,
  canRegisterPurchase: true,
  canApprovePayments: true,
  canEmitWithholding: true,
  canViewSupplierBank: true,
};

export const DEFAULT_FINANCE_ACTIONS: FinanceActions = {
  canViewBankBalances: true,
  canRegisterReceipts: true,
  canRegisterExpenses: true,
  canCancelPayments: true,
  canExportReports: true,
};

export const DEFAULT_NETWORK_ACTIONS: NetworkActions = {
  canManageNodes: true,
  canAssignIps: true,
  canEditRouterCredentials: true,
};

export const DEFAULT_VAULT_ACTIONS: VaultActions = {
  canViewClientVault: true,
  canViewInternalVault: true,
  canRevealPasswords: true,
  canDeleteCredentials: true,
};

/**
 * Plantilla predeterminada de permisos granulares según el Rol del usuario.
 */
export const DEFAULT_MODULE_PERMISSIONS_BY_ROLE: Record<UserRole, UserModulePermissions> = {
  superadmin: {
    dashboard: { enabled: true },
    visibility: { canViewServicePrices: true },
    abonados: { enabled: true },
    personas: { enabled: true, submodules: { proveedores: true, usuarios_equipo: true } },
    clientes: { enabled: true, actions: { ...DEFAULT_CLIENT_ACTIONS } },
    compras: { enabled: true, submodules: { historial_compras: true, registrar_compra: true, notas_credito: true, notas_debito: true, retenciones: true }, actions: { ...DEFAULT_PURCHASE_ACTIONS } },
    finanzas: { enabled: true, submodules: { cobranzas: true, gastos: true, movimientos: true, bancos: true, cuentas_por_cobrar: true, cuentas_por_pagar: true, reportes: true }, actions: { ...DEFAULT_FINANCE_ACTIONS } },
    ventas: { enabled: true, submodules: { notas_venta: true, nueva_venta: true, cotizaciones: true, recurrentes: true } },
    facturacion: { enabled: true, submodules: { facturas: true, cotizaciones: true, notas_credito: true, notas_debito: true, retenciones: true, guias_remision: true }, actions: { ...DEFAULT_BILLING_ACTIONS } },
    inventarios: { enabled: true, submodules: { productos: true, servicios: true, categorias: true, kardex: true, transferencias: true, bodegas: true, ajustes: true }, actions: { ...DEFAULT_INVENTORY_ACTIONS } },
    red: { enabled: true, submodules: { nodos: true, pools_ip: true }, actions: { ...DEFAULT_NETWORK_ACTIONS } },
    proyectos: { enabled: true },
    tickets: { enabled: true },
    arcotel: { enabled: true },
    boveda: { enabled: true, actions: { ...DEFAULT_VAULT_ACTIONS } },
    plantillas: { enabled: true },
    configuracion: { enabled: true, submodules: { general: true, sri: true } },
    actions: { canDeleteClients: true, canDeleteFiles: true, canEditInvoices: true, canDeleteInvoices: true },
  },
  admin: {
    abonados: { enabled: true },
    personas: { enabled: true, submodules: { proveedores: true, usuarios_equipo: true } },
    clientes: { enabled: true, actions: { ...DEFAULT_CLIENT_ACTIONS, canDeleteClient: false } },
    compras: { enabled: true, submodules: { historial_compras: true, registrar_compra: true, notas_credito: true, notas_debito: true, retenciones: true }, actions: { ...DEFAULT_PURCHASE_ACTIONS } },
    finanzas: { enabled: true, submodules: { cobranzas: true, gastos: true, movimientos: true, bancos: true, cuentas_por_cobrar: true, cuentas_por_pagar: true, reportes: true }, actions: { ...DEFAULT_FINANCE_ACTIONS } },
    ventas: { enabled: true, submodules: { notas_venta: true, nueva_venta: true, cotizaciones: true, recurrentes: true } },
    facturacion: { enabled: true, submodules: { facturas: true, cotizaciones: true, notas_credito: true, notas_debito: true, retenciones: true, guias_remision: true }, actions: { ...DEFAULT_BILLING_ACTIONS, canCancelInvoices: false } },
    inventarios: { enabled: true, submodules: { productos: true, servicios: true, categorias: true, kardex: true, transferencias: true, bodegas: true, ajustes: true }, actions: { ...DEFAULT_INVENTORY_ACTIONS, canDeleteItems: false } },
    red: { enabled: true, submodules: { nodos: true, pools_ip: true }, actions: { ...DEFAULT_NETWORK_ACTIONS } },
    proyectos: { enabled: true },
    tickets: { enabled: true },
    arcotel: { enabled: true },
    boveda: { enabled: false, actions: { ...DEFAULT_VAULT_ACTIONS, canViewInternalVault: false } },
    plantillas: { enabled: true },
    configuracion: { enabled: true, submodules: { general: true, sri: true } },
    actions: { canDeleteClients: false, canDeleteFiles: false, canEditInvoices: true, canDeleteInvoices: false },
  },
  ventas: {
    abonados: { enabled: true },
    personas: { enabled: true, submodules: { proveedores: false, usuarios_equipo: false } },
    clientes: {
      enabled: true,
      actions: {
        canCreateClient: true,
        canEditClient: true,
        canEditServicePrices: false,
        canUploadContracts: true,
        canDeleteContracts: false,
        canDeleteClient: false,
      },
    },
    compras: {
      enabled: false,
      submodules: { historial_compras: false, registrar_compra: false, notas_credito: false, notas_debito: false, retenciones: false },
      actions: { canCreateSupplier: false, canRegisterPurchase: false, canApprovePayments: false, canEmitWithholding: false, canViewSupplierBank: false },
    },
    finanzas: {
      enabled: true,
      submodules: { cobranzas: true, gastos: false, movimientos: false, bancos: true, cuentas_por_cobrar: true, cuentas_por_pagar: false, reportes: false },
      actions: { canViewBankBalances: true, canRegisterReceipts: true, canRegisterExpenses: false, canCancelPayments: false, canExportReports: false },
    },
    ventas: {
      enabled: true,
      submodules: { notas_venta: true, nueva_venta: true, cotizaciones: true, recurrentes: true },
    },
    facturacion: {
      enabled: true,
      submodules: { facturas: true, cotizaciones: true, notas_credito: false, notas_debito: false, retenciones: false, guias_remision: true },
      actions: {
        canCreateInvoice: true,
        canEditPrices: false,
        canApplyDiscounts: false,
        canAuthorizeSri: true,
        canCancelInvoices: false,
        canCreateQuotes: true,
        canApproveQuotes: true,
        canViewSalesReports: true,
      },
    },
    inventarios: {
      enabled: true,
      submodules: { productos: true, servicios: true, categorias: true, kardex: false, transferencias: false, bodegas: true, ajustes: false },
      actions: {
        canCreateProduct: false,
        canCreateService: false,
        canEditProduct: false,
        canChangePrices: false,
        canViewCosts: false,
        canAdjustStock: false,
        canTransferWarehouses: false,
        canDeleteItems: false,
      },
    },
    red: { enabled: false, submodules: { nodos: false, pools_ip: false }, actions: { canManageNodes: false, canAssignIps: false, canEditRouterCredentials: false } },
    proyectos: { enabled: true },
    tickets: { enabled: true },
    arcotel: { enabled: false },
    boveda: { enabled: true, actions: { canViewClientVault: true, canViewInternalVault: false, canRevealPasswords: true, canDeleteCredentials: false } },
    plantillas: { enabled: true },
    configuracion: { enabled: false, submodules: { general: false, sri: false } },
    actions: { canDeleteClients: false, canDeleteFiles: false, canEditInvoices: false, canDeleteInvoices: false },
  },
  finanzas: {
    abonados: { enabled: true },
    personas: { enabled: true, submodules: { proveedores: true, usuarios_equipo: false } },
    clientes: { enabled: true, actions: { ...DEFAULT_CLIENT_ACTIONS, canDeleteClient: false } },
    compras: { enabled: true, submodules: { historial_compras: true, registrar_compra: true, notas_credito: true, notas_debito: true, retenciones: true }, actions: { ...DEFAULT_PURCHASE_ACTIONS } },
    finanzas: { enabled: true, submodules: { cobranzas: true, gastos: true, movimientos: true, bancos: true, cuentas_por_cobrar: true, cuentas_por_pagar: true, reportes: true }, actions: { ...DEFAULT_FINANCE_ACTIONS } },
    ventas: { enabled: true, submodules: { notas_venta: true, nueva_venta: true, cotizaciones: true, recurrentes: true } },
    facturacion: { enabled: true, submodules: { facturas: true, cotizaciones: true, notas_credito: true, notas_debito: true, retenciones: true, guias_remision: true }, actions: { ...DEFAULT_BILLING_ACTIONS } },
    inventarios: { enabled: true, submodules: { productos: true, servicios: true, categorias: true, kardex: true, transferencias: false, bodegas: true, ajustes: true }, actions: { ...DEFAULT_INVENTORY_ACTIONS, canAdjustStock: false } },
    red: { enabled: false, submodules: { nodos: false, pools_ip: false }, actions: { canManageNodes: false, canAssignIps: false, canEditRouterCredentials: false } },
    proyectos: { enabled: true },
    tickets: { enabled: false },
    arcotel: { enabled: false },
    boveda: { enabled: false, actions: { ...DEFAULT_VAULT_ACTIONS, canViewInternalVault: false } },
    plantillas: { enabled: true },
    configuracion: { enabled: true, submodules: { general: false, sri: true } },
    actions: { canDeleteClients: false, canDeleteFiles: false, canEditInvoices: true, canDeleteInvoices: false },
  },
  tecnico: {
    dashboard: { enabled: false },
    visibility: { canViewServicePrices: false },
    abonados: { enabled: true },
    personas: { enabled: true, submodules: { proveedores: true, usuarios_equipo: false } },
    clientes: { enabled: true, actions: { canCreateClient: true, canEditClient: true, canEditServicePrices: false, canUploadContracts: true, canDeleteContracts: false, canDeleteClient: false } },
    compras: { enabled: true, submodules: { historial_compras: true, registrar_compra: true, notas_credito: false, notas_debito: false, retenciones: false }, actions: { ...DEFAULT_PURCHASE_ACTIONS, canApprovePayments: false } },
    finanzas: { enabled: false, submodules: { movimientos: false, bancos: false, cuentas_por_cobrar: false, cuentas_por_pagar: false, reportes: false }, actions: { canViewBankBalances: false, canRegisterReceipts: false, canRegisterExpenses: false, canCancelPayments: false, canExportReports: false } },
    ventas: { enabled: false, submodules: { notas_venta: false, nueva_venta: false, cotizaciones: true, recurrentes: false } },
    facturacion: { enabled: false, submodules: { facturas: false, cotizaciones: true, notas_credito: false, notas_debito: false, retenciones: false, guias_remision: true }, actions: { ...DEFAULT_BILLING_ACTIONS, canCreateInvoice: false, canCancelInvoices: false } },
    inventarios: { enabled: true, submodules: { productos: true, servicios: true, categorias: true, kardex: true, transferencias: true, bodegas: true, ajustes: false }, actions: { ...DEFAULT_INVENTORY_ACTIONS, canChangePrices: false, canViewCosts: false, canAdjustStock: false } },
    red: { enabled: true, submodules: { nodos: true, pools_ip: true }, actions: { ...DEFAULT_NETWORK_ACTIONS } },
    proyectos: { enabled: true },
    tickets: { enabled: true },
    arcotel: { enabled: false },
    boveda: { enabled: true, actions: { canViewClientVault: true, canViewInternalVault: false, canRevealPasswords: true, canDeleteCredentials: false } },
    plantillas: { enabled: false },
    configuracion: { enabled: false, submodules: { general: false, sri: false } },
    actions: { canDeleteClients: false, canDeleteFiles: false, canEditInvoices: false, canDeleteInvoices: false },
  },
  bodega: {
    abonados: { enabled: false },
    personas: { enabled: true, submodules: { proveedores: true, usuarios_equipo: false } },
    clientes: { enabled: false, actions: { canCreateClient: false, canEditClient: false, canEditServicePrices: false, canUploadContracts: false, canDeleteContracts: false, canDeleteClient: false } },
    compras: { enabled: true, submodules: { historial_compras: true, registrar_compra: true, notas_credito: false, notas_debito: false, retenciones: false }, actions: { ...DEFAULT_PURCHASE_ACTIONS, canApprovePayments: false, canViewSupplierBank: false } },
    finanzas: { enabled: false, submodules: { movimientos: false, bancos: false, cuentas_por_cobrar: false, cuentas_por_pagar: false, reportes: false }, actions: { canViewBankBalances: false, canRegisterReceipts: false, canRegisterExpenses: false, canCancelPayments: false, canExportReports: false } },
    ventas: { enabled: false, submodules: { notas_venta: false, nueva_venta: false, cotizaciones: false, recurrentes: false } },
    facturacion: { enabled: false, submodules: { facturas: false, cotizaciones: false, notas_credito: false, notas_debito: false, retenciones: false, guias_remision: true }, actions: { ...DEFAULT_BILLING_ACTIONS, canCreateInvoice: false, canCancelInvoices: false } },
    inventarios: { enabled: true, submodules: { productos: true, servicios: false, categorias: true, kardex: true, transferencias: true, bodegas: true, ajustes: true }, actions: { canCreateProduct: true, canCreateService: false, canEditProduct: true, canChangePrices: false, canViewCosts: false, canAdjustStock: true, canTransferWarehouses: true, canDeleteItems: false } },
    red: { enabled: false, submodules: { nodos: false, pools_ip: false }, actions: { canManageNodes: false, canAssignIps: false, canEditRouterCredentials: false } },
    proyectos: { enabled: false },
    tickets: { enabled: false },
    arcotel: { enabled: false },
    boveda: { enabled: false, actions: { canViewClientVault: false, canViewInternalVault: false, canRevealPasswords: false, canDeleteCredentials: false } },
    plantillas: { enabled: false },
    configuracion: { enabled: false, submodules: { general: false, sri: false } },
    actions: { canDeleteClients: false, canDeleteFiles: false, canEditInvoices: false, canDeleteInvoices: false },
  },
  soporte: {
    abonados: { enabled: true },
    personas: { enabled: false, submodules: { proveedores: false, usuarios_equipo: false } },
    clientes: { enabled: true, actions: { canCreateClient: false, canEditClient: false, canEditServicePrices: false, canUploadContracts: false, canDeleteContracts: false, canDeleteClient: false } },
    compras: { enabled: false, submodules: { historial_compras: false, registrar_compra: false, notas_credito: false, notas_debito: false, retenciones: false }, actions: { canCreateSupplier: false, canRegisterPurchase: false, canApprovePayments: false, canEmitWithholding: false, canViewSupplierBank: false } },
    finanzas: { enabled: false, submodules: { movimientos: false, bancos: false, cuentas_por_cobrar: false, cuentas_por_pagar: false, reportes: false }, actions: { canViewBankBalances: false, canRegisterReceipts: false, canRegisterExpenses: false, canCancelPayments: false, canExportReports: false } },
    ventas: { enabled: false, submodules: { notas_venta: false, nueva_venta: false, cotizaciones: false, recurrentes: false } },
    facturacion: { enabled: false, submodules: { facturas: false, cotizaciones: false, notas_credito: false, notas_debito: false, retenciones: false, guias_remision: false }, actions: { ...DEFAULT_BILLING_ACTIONS, canCreateInvoice: false, canCancelInvoices: false } },
    inventarios: { enabled: false, submodules: { productos: false, servicios: false, categorias: false, kardex: false, transferencias: false, bodegas: false, ajustes: false }, actions: { canCreateProduct: false, canCreateService: false, canEditProduct: false, canChangePrices: false, canViewCosts: false, canAdjustStock: false, canTransferWarehouses: false, canDeleteItems: false } },
    red: { enabled: false, submodules: { nodos: false, pools_ip: false }, actions: { canManageNodes: false, canAssignIps: false, canEditRouterCredentials: false } },
    proyectos: { enabled: false },
    tickets: { enabled: true },
    arcotel: { enabled: false },
    boveda: { enabled: true, actions: { canViewClientVault: true, canViewInternalVault: false, canRevealPasswords: true, canDeleteCredentials: false } },
    plantillas: { enabled: false },
    configuracion: { enabled: false, submodules: { general: false, sri: false } },
    actions: { canDeleteClients: false, canDeleteFiles: false, canEditInvoices: false, canDeleteInvoices: false },
  },
  legal: {
    abonados: { enabled: true },
    personas: { enabled: true, submodules: { proveedores: true, usuarios_equipo: false } },
    clientes: { enabled: true, actions: { canCreateClient: false, canEditClient: false, canEditServicePrices: false, canUploadContracts: true, canDeleteContracts: false, canDeleteClient: false } },
    compras: { enabled: false, submodules: { historial_compras: false, registrar_compra: false, notas_credito: false, notas_debito: false, retenciones: false }, actions: { canCreateSupplier: false, canRegisterPurchase: false, canApprovePayments: false, canEmitWithholding: false, canViewSupplierBank: false } },
    finanzas: { enabled: false, submodules: { movimientos: false, bancos: false, cuentas_por_cobrar: false, cuentas_por_pagar: false, reportes: false }, actions: { canViewBankBalances: false, canRegisterReceipts: false, canRegisterExpenses: false, canCancelPayments: false, canExportReports: false } },
    ventas: { enabled: false, submodules: { notas_venta: false, nueva_venta: false, cotizaciones: false, recurrentes: false } },
    facturacion: { enabled: false, submodules: { facturas: false, cotizaciones: false, notas_credito: false, notas_debito: false, retenciones: false, guias_remision: false }, actions: { ...DEFAULT_BILLING_ACTIONS, canCreateInvoice: false, canCancelInvoices: false } },
    inventarios: { enabled: false, submodules: { productos: false, servicios: false, categorias: false, kardex: false, transferencias: false, bodegas: false, ajustes: false }, actions: { canCreateProduct: false, canCreateService: false, canEditProduct: false, canChangePrices: false, canViewCosts: false, canAdjustStock: false, canTransferWarehouses: false, canDeleteItems: false } },
    red: { enabled: false, submodules: { nodos: false, pools_ip: false }, actions: { canManageNodes: false, canAssignIps: false, canEditRouterCredentials: false } },
    proyectos: { enabled: false },
    tickets: { enabled: false },
    arcotel: { enabled: true },
    boveda: { enabled: false, actions: { canViewClientVault: false, canViewInternalVault: false, canRevealPasswords: false, canDeleteCredentials: false } },
    plantillas: { enabled: true },
    configuracion: { enabled: false, submodules: { general: false, sri: false } },
    actions: { canDeleteClients: false, canDeleteFiles: false, canEditInvoices: false, canDeleteInvoices: false },
  },
  consulta: {
    abonados: { enabled: true },
    personas: { enabled: true, submodules: { proveedores: true, usuarios_equipo: false } },
    clientes: { enabled: true, actions: { canCreateClient: false, canEditClient: false, canEditServicePrices: false, canUploadContracts: false, canDeleteContracts: false, canDeleteClient: false } },
    compras: { enabled: true, submodules: { historial_compras: true, registrar_compra: false, notas_credito: false, notas_debito: false, retenciones: false }, actions: { canCreateSupplier: false, canRegisterPurchase: false, canApprovePayments: false, canEmitWithholding: false, canViewSupplierBank: false } },
    finanzas: { enabled: true, submodules: { cobranzas: true, gastos: true, movimientos: true, bancos: true, cuentas_por_cobrar: true, cuentas_por_pagar: true, reportes: true }, actions: { canViewBankBalances: true, canRegisterReceipts: false, canRegisterExpenses: false, canCancelPayments: false, canExportReports: false } },
    ventas: { enabled: true, submodules: { notas_venta: true, nueva_venta: false, cotizaciones: true, recurrentes: true } },
    facturacion: { enabled: true, submodules: { facturas: true, cotizaciones: true, notas_credito: false, notas_debito: false, retenciones: false, guias_remision: false }, actions: { ...DEFAULT_BILLING_ACTIONS, canCreateInvoice: false, canCancelInvoices: false, canEditPrices: false, canApplyDiscounts: false } },
    inventarios: { enabled: true, submodules: { productos: true, servicios: true, categorias: true, kardex: true, transferencias: false, bodegas: true, ajustes: false }, actions: { canCreateProduct: false, canCreateService: false, canEditProduct: false, canChangePrices: false, canViewCosts: false, canAdjustStock: false, canTransferWarehouses: false, canDeleteItems: false } },
    red: { enabled: true, submodules: { nodos: true, pools_ip: true }, actions: { canManageNodes: false, canAssignIps: false, canEditRouterCredentials: false } },
    proyectos: { enabled: true },
    tickets: { enabled: true },
    arcotel: { enabled: true },
    boveda: { enabled: false, actions: { canViewClientVault: false, canViewInternalVault: false, canRevealPasswords: false, canDeleteCredentials: false } },
    plantillas: { enabled: true },
    configuracion: { enabled: false, submodules: { general: false, sri: false } },
    actions: { canDeleteClients: false, canDeleteFiles: false, canEditInvoices: false, canDeleteInvoices: false },
  },
};

/**
 * Verifica si un usuario tiene acceso a un módulo principal.
 */
export function canAccessModule(user: UserProfile | undefined | null, moduleKey: keyof UserModulePermissions): boolean {
  if (!user || user.status !== "activo") return false;
  if (user.role === "superadmin") return true;
  if (moduleKey === "actions") return true;
  if (["ventas", "compras", "finanzas", "facturacion"].includes(moduleKey) && !canViewFinancialAmounts(user)) return false;
  const override = user.modulePermissions?.[moduleKey] as { enabled?: boolean } | undefined;
  if (typeof override?.enabled === "boolean") return override.enabled;
  if (moduleKey === "dashboard") return user.role !== "tecnico";
  if (effectiveAccountPermissions(user.role, user.permissions).includes("all")) return true;
  if (moduleKey === "finanzas" && user.permissions?.includes("manage_finance")) return true;
  const preset = DEFAULT_MODULE_PERMISSIONS_BY_ROLE[user.role]?.[moduleKey] as { enabled?: boolean } | undefined;
  return preset?.enabled === true;
}

/**
 * Verifica si un usuario tiene permiso para ejecutar una acción crítica específica.
 */
export function canPerformAction(
  user: UserProfile | undefined | null,
  actionKey: "canDeleteClients" | "canDeleteFiles" | "canEditInvoices" | "canDeleteInvoices"
): boolean {
  if (!user || user.status === "inactivo") return false;
  if (user.role === "superadmin") return true;
  if (user.modulePermissions?.actions?.[actionKey] !== undefined) {
    return !!user.modulePermissions.actions[actionKey];
  }
  if (user.role === "admin") {
    return actionKey !== "canDeleteInvoices";
  }
  return false;
}

/**
 * Verifica si un usuario tiene acceso a un submódulo específico dentro de un módulo.
 */
export function canAccessSubmodule(
  user: UserProfile | undefined | null,
  moduleKey: keyof UserModulePermissions,
  submoduleKey: string
): boolean {
  if (!user || user.status === "inactivo") return false;
  if (user.role === "superadmin") return true;

  // Si el módulo general está deshabilitado, el submódulo tampoco es accesible
  if (!canAccessModule(user, moduleKey)) return false;

  // Verificar en la matriz del usuario
  const modPerms = user.modulePermissions?.[moduleKey] as any;
  if (modPerms && modPerms.submodules && typeof modPerms.submodules[submoduleKey] === "boolean") {
    return modPerms.submodules[submoduleKey];
  }
  if (effectiveAccountPermissions(user.role, user.permissions).includes("all")) return true;
  if (moduleKey === "finanzas" && user.permissions?.includes("manage_finance")) return true;

  // Fallback a los predeterminados del rol
  const defaultByRole = (DEFAULT_MODULE_PERMISSIONS_BY_ROLE[user.role] as any)?.[moduleKey];
  if (defaultByRole && defaultByRole.submodules && typeof defaultByRole.submodules[submoduleKey] === "boolean") {
    return defaultByRole.submodules[submoduleKey];
  }

  return false;
}

export const routePermissions: Record<string, keyof UserModulePermissions> = {
  "/": "dashboard",
  "/abonados": "abonados",
  "/personas": "personas",
  "/clientes": "abonados",
  "/compras": "compras",
  "/ventas": "ventas",
  "/finanzas": "finanzas",
  "/facturacion": "facturacion",
  "/inventarios": "inventarios",
  "/red": "red",
  "/proyectos": "proyectos",
  "/tickets": "tickets",
  "/arcotel": "arcotel",
  "/tramites": "arcotel",
  "/boveda": "boveda",
  "/plantillas": "plantillas",
  "/configuracion": "configuracion",
};

export function canAccessRoute(user: UserProfile, route: string): boolean {
  if (!user || user.status === "inactivo") return false;
  if (user.role === "superadmin") return true;
  const targetModule = routePermissions[route || "/"];
  if (targetModule) {
    return canAccessModule(user, targetModule);
  }

  // Fail-closed por defecto para rutas no reconocidas
  return false;
}

export function firstAccessibleRoute(user: UserProfile): string | undefined {
  return ["/", "/clientes", "/tickets", ...Object.keys(routePermissions)].find(route => canAccessRoute(user, route));
}

export const tabPermissions: Record<string, string> = {
  fiscal: "manage_clients",
  red: "manage_network",        // Nodos
  boveda: "manage_vault",
  contratos: "manage_policies", // Arcotel
  cotizaciones: "manage_finance",
  facturacion: "manage_finance",
  finanzas: "manage_finance",   // Cobros
  tickets: "manage_tickets",
  proyectos: "manage_network",
  dossier: "manage_clients",
  inventario: "manage_network",
};

/**
 * Verifica si un usuario tiene acceso a una acción granular específica dentro de un módulo.
 * Si no se pasa actionKey, verifica si tiene acceso al módulo general.
 */
export function canUser(
  user: UserProfile | undefined | null,
  moduleKey: keyof UserModulePermissions,
  actionKey?: string
): boolean {
  if (!user || user.status === "inactivo") return false;
  if (user.role === "superadmin") return true;

  if (!canAccessModule(user, moduleKey)) return false;
  if (!actionKey) return true;

  // 1. Revisar override específico en user.modulePermissions
  const userModule = user.modulePermissions?.[moduleKey] as any;
  if (userModule?.actions && typeof userModule.actions[actionKey] === "boolean") {
    return userModule.actions[actionKey];
  }

  // Older profiles stored commercial sale actions under SRI billing.
  if (moduleKey === "ventas") {
    if (actionKey === "canCancelInvoices") return canPerformAction(user, "canDeleteInvoices");
    return !!((user.modulePermissions?.facturacion?.actions as unknown as Record<string, boolean> | undefined)?.[actionKey]
      ?? (DEFAULT_MODULE_PERMISSIONS_BY_ROLE[user.role].facturacion?.actions as unknown as Record<string, boolean> | undefined)?.[actionKey]);
  }

  // 2. Revisar preset predeterminado del rol
  const roleDefault = (DEFAULT_MODULE_PERMISSIONS_BY_ROLE[user.role] as any)?.[moduleKey];
  if (roleDefault?.actions && typeof roleDefault.actions[actionKey] === "boolean") {
    return roleDefault.actions[actionKey];
  }

  return false;
}

/** Match the editor to the effective defaults, retaining every explicit denial. */
export function editableModulePermissions(user: UserProfile): UserModulePermissions {
  const defaults = DEFAULT_MODULE_PERMISSIONS_BY_ROLE[user.role];
  const result = JSON.parse(JSON.stringify({ ...defaults, ...user.modulePermissions })) as UserModulePermissions;
  for (const key of Object.keys(defaults) as (keyof UserModulePermissions)[]) {
    const preset = defaults[key] as { submodules?: object; actions?: object } | undefined;
    const override = user.modulePermissions?.[key] as { submodules?: object; actions?: object } | undefined;
    const target = result[key] as { submodules?: object; actions?: object } | undefined;
    if (!target) continue;
    if (preset?.submodules) target.submodules = { ...preset.submodules, ...override?.submodules };
    if (preset?.actions) target.actions = { ...preset.actions, ...override?.actions };
  }
  result.dashboard = { enabled: canAccessModule(user, "dashboard") };
  result.visibility = {
    ...result.visibility, canViewServicePrices: canViewServicePrices(user),
    canViewProductPrices: canViewProductPrices(user), canViewFinancialAmounts: canViewFinancialAmounts(user),
  };
  if (result.ventas) result.ventas.actions = {
    ...defaults.facturacion?.actions, ...user.modulePermissions?.facturacion?.actions,
    canCancelInvoices: canPerformAction(user, "canDeleteInvoices"), ...user.modulePermissions?.ventas?.actions,
  };
  return result;
}
