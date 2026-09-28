import type { UserProfile, UserModulePermissions, UserRole } from "@/types";

export const collectionPermissions = {
  clients: "manage_clients", clientServices: "manage_clients", plans: "manage_clients",
  clientProjects: "manage_clients", clientContracts: "manage_clients",
  clientQuotes: "manage_finance", nodes: "manage_network", ipPools: "manage_network",
  policies: "manage_policies", tickets: "manage_tickets", expenses: "manage_finance",
  monthlyCharges: "manage_finance", vault: "manage_vault", clientVaultItems: "manage_vault",
  systemUsers: "manage_users", auditLogs: "manage_users",
  arcotelFiles: "manage_policies", clientDocuments: "manage_clients",
  inventoryProducts: "manage_network", inventoryWarehouses: "manage_network",
  inventoryCategories: "manage_network", inventoryBrands: "manage_network",
  inventoryKardex: "manage_finance", inventoryTransfers: "manage_network",
  inventoryAdjustments: "manage_finance",
  billingInvoices: "manage_finance", billingQuotes: "manage_finance",
  billingCreditNotes: "manage_finance", billingWithholdings: "manage_finance",
  billingRemissionGuides: "manage_network", sriCompanyConfig: "manage_finance",
  // Compras & Proveedores
  suppliers: "manage_finance",
  purchaseInvoices: "manage_finance",
  supplierCreditNotes: "manage_finance",
  supplierDebitNotes: "manage_finance",
  purchaseWithholdings: "manage_finance",
  bankAccounts: "manage_finance",
  supplierPayments: "manage_finance",
} as const;

export type Entity = keyof typeof collectionPermissions;

export function can(user: UserProfile, permission: string) {
  if (!user || user.status === "inactivo") return false;
  if (user.role === "superadmin") return true;
  return !!user.permissions?.some(p => p === "all" || p === permission);
}

/**
 * Plantilla predeterminada de permisos granulares según el Rol del usuario.
 */
export const DEFAULT_MODULE_PERMISSIONS_BY_ROLE: Record<UserRole, UserModulePermissions> = {
  superadmin: {
    abonados: { enabled: true },
    personas: { enabled: true, submodules: { proveedores: true, usuarios_equipo: true } },
    compras: { enabled: true, submodules: { historial_compras: true, registrar_compra: true, notas_credito: true, notas_debito: true, retenciones: true } },
    finanzas: { enabled: true, submodules: { movimientos: true, bancos: true, cuentas_por_cobrar: true, cuentas_por_pagar: true, reportes: true } },
    facturacion: { enabled: true, submodules: { facturas: true, cotizaciones: true, notas_credito: true, retenciones: true, guias_remision: true } },
    inventarios: { enabled: true, submodules: { productos: true, servicios: true, categorias: true, kardex: true, transferencias: true, bodegas: true, ajustes: true } },
    red: { enabled: true, submodules: { nodos: true, pools_ip: true } },
    proyectos: { enabled: true },
    tickets: { enabled: true },
    arcotel: { enabled: true },
    boveda: { enabled: true },
    plantillas: { enabled: true },
    configuracion: { enabled: true, submodules: { general: true, sri: true, planes: true } },
  },
  admin: {
    abonados: { enabled: true },
    personas: { enabled: true, submodules: { proveedores: true, usuarios_equipo: true } },
    compras: { enabled: true, submodules: { historial_compras: true, registrar_compra: true, notas_credito: true, notas_debito: true, retenciones: true } },
    finanzas: { enabled: true, submodules: { movimientos: true, bancos: true, cuentas_por_cobrar: true, cuentas_por_pagar: true, reportes: true } },
    facturacion: { enabled: true, submodules: { facturas: true, cotizaciones: true, notas_credito: true, retenciones: true, guias_remision: true } },
    inventarios: { enabled: true, submodules: { productos: true, servicios: true, categorias: true, kardex: true, transferencias: true, bodegas: true, ajustes: true } },
    red: { enabled: true, submodules: { nodos: true, pools_ip: true } },
    proyectos: { enabled: true },
    tickets: { enabled: true },
    arcotel: { enabled: true },
    boveda: { enabled: false }, // restringido por defecto a superadmin
    plantillas: { enabled: true },
    configuracion: { enabled: true, submodules: { general: true, sri: true, planes: true } },
  },
  finanzas: {
    abonados: { enabled: true },
    personas: { enabled: true, submodules: { proveedores: true, usuarios_equipo: false } },
    compras: { enabled: true, submodules: { historial_compras: true, registrar_compra: true, notas_credito: true, notas_debito: true, retenciones: true } },
    finanzas: { enabled: true, submodules: { movimientos: true, bancos: true, cuentas_por_cobrar: true, cuentas_por_pagar: true, reportes: true } },
    facturacion: { enabled: true, submodules: { facturas: true, cotizaciones: true, notas_credito: true, retenciones: true, guias_remision: true } },
    inventarios: { enabled: true, submodules: { productos: true, servicios: true, categorias: true, kardex: true, transferencias: false, bodegas: true, ajustes: true } },
    red: { enabled: false, submodules: { nodos: false, pools_ip: false } },
    proyectos: { enabled: true },
    tickets: { enabled: false },
    arcotel: { enabled: false },
    boveda: { enabled: false },
    plantillas: { enabled: true },
    configuracion: { enabled: true, submodules: { general: false, sri: true, planes: false } },
  },
  tecnico: {
    abonados: { enabled: true },
    personas: { enabled: true, submodules: { proveedores: true, usuarios_equipo: false } },
    compras: { enabled: true, submodules: { historial_compras: true, registrar_compra: true, notas_credito: false, notas_debito: false, retenciones: false } },
    finanzas: { enabled: false, submodules: { movimientos: false, bancos: false, cuentas_por_cobrar: false, cuentas_por_pagar: false, reportes: false } },
    facturacion: { enabled: false, submodules: { facturas: false, cotizaciones: true, notas_credito: false, retenciones: false, guias_remision: true } },
    inventarios: { enabled: true, submodules: { productos: true, servicios: true, categorias: true, kardex: true, transferencias: true, bodegas: true, ajustes: false } },
    red: { enabled: true, submodules: { nodos: true, pools_ip: true } },
    proyectos: { enabled: true },
    tickets: { enabled: true },
    arcotel: { enabled: false },
    boveda: { enabled: true },
    plantillas: { enabled: false },
    configuracion: { enabled: false, submodules: { general: false, sri: false, planes: false } },
  },
  soporte: {
    abonados: { enabled: true },
    personas: { enabled: false, submodules: { proveedores: false, usuarios_equipo: false } },
    compras: { enabled: false, submodules: { historial_compras: false, registrar_compra: false, notas_credito: false, notas_debito: false, retenciones: false } },
    finanzas: { enabled: false, submodules: { movimientos: false, bancos: false, cuentas_por_cobrar: false, cuentas_por_pagar: false, reportes: false } },
    facturacion: { enabled: false, submodules: { facturas: false, cotizaciones: false, notas_credito: false, retenciones: false, guias_remision: false } },
    inventarios: { enabled: false, submodules: { productos: false, servicios: false, categorias: false, kardex: false, transferencias: false, bodegas: false, ajustes: false } },
    red: { enabled: false, submodules: { nodos: false, pools_ip: false } },
    proyectos: { enabled: false },
    tickets: { enabled: true },
    arcotel: { enabled: false },
    boveda: { enabled: true },
    plantillas: { enabled: false },
    configuracion: { enabled: false, submodules: { general: false, sri: false, planes: false } },
  },
  legal: {
    abonados: { enabled: true },
    personas: { enabled: true, submodules: { proveedores: true, usuarios_equipo: false } },
    compras: { enabled: false, submodules: { historial_compras: false, registrar_compra: false, notas_credito: false, notas_debito: false, retenciones: false } },
    finanzas: { enabled: false, submodules: { movimientos: false, bancos: false, cuentas_por_cobrar: false, cuentas_por_pagar: false, reportes: false } },
    facturacion: { enabled: false, submodules: { facturas: false, cotizaciones: false, notas_credito: false, retenciones: false, guias_remision: false } },
    inventarios: { enabled: false, submodules: { productos: false, servicios: false, categorias: false, kardex: false, transferencias: false, bodegas: false, ajustes: false } },
    red: { enabled: false, submodules: { nodos: false, pools_ip: false } },
    proyectos: { enabled: false },
    tickets: { enabled: false },
    arcotel: { enabled: true },
    boveda: { enabled: false },
    plantillas: { enabled: true },
    configuracion: { enabled: false, submodules: { general: false, sri: false, planes: false } },
  },
  consulta: {
    abonados: { enabled: true },
    personas: { enabled: true, submodules: { proveedores: true, usuarios_equipo: false } },
    compras: { enabled: true, submodules: { historial_compras: true, registrar_compra: false, notas_credito: false, notas_debito: false, retenciones: false } },
    finanzas: { enabled: true, submodules: { movimientos: true, bancos: false, cuentas_por_cobrar: true, cuentas_por_pagar: true, reportes: true } },
    facturacion: { enabled: true, submodules: { facturas: true, cotizaciones: true, notas_credito: false, retenciones: false, guias_remision: false } },
    inventarios: { enabled: true, submodules: { productos: true, servicios: true, categorias: true, kardex: true, transferencias: false, bodegas: true, ajustes: false } },
    red: { enabled: true, submodules: { nodos: true, pools_ip: true } },
    proyectos: { enabled: true },
    tickets: { enabled: true },
    arcotel: { enabled: true },
    boveda: { enabled: false },
    plantillas: { enabled: true },
    configuracion: { enabled: false, submodules: { general: false, sri: false, planes: false } },
  },
};

/**
 * Verifica si un usuario tiene acceso a un módulo principal.
 */
export function canAccessModule(user: UserProfile | undefined | null, moduleKey: keyof UserModulePermissions): boolean {
  if (!user || user.status === "inactivo") return false;
  if (user.role === "superadmin") return true;

  // Si tiene permisos granulares configurados explícitamente
  if (user.modulePermissions && user.modulePermissions[moduleKey] !== undefined) {
    return !!user.modulePermissions[moduleKey]?.enabled;
  }

  // De lo contrario, inferir desde el rol predeterminado
  const defaultByRole = DEFAULT_MODULE_PERMISSIONS_BY_ROLE[user.role];
  if (defaultByRole && defaultByRole[moduleKey] !== undefined) {
    return !!defaultByRole[moduleKey]?.enabled;
  }

  return true;
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

  // Fallback a los predeterminados del rol
  const defaultByRole = (DEFAULT_MODULE_PERMISSIONS_BY_ROLE[user.role] as any)?.[moduleKey];
  if (defaultByRole && defaultByRole.submodules && typeof defaultByRole.submodules[submoduleKey] === "boolean") {
    return defaultByRole.submodules[submoduleKey];
  }

  return true;
}

export const routePermissions: Record<string, keyof UserModulePermissions> = {
  "/abonados": "abonados",
  "/personas": "personas",
  "/clientes": "abonados",
  "/compras": "compras",
  "/finanzas": "finanzas",
  "/facturacion": "facturacion",
  "/inventarios": "inventarios",
  "/red": "red",
  "/proyectos": "proyectos",
  "/tickets": "tickets",
  "/arcotel": "arcotel",
  "/boveda": "boveda",
  "/plantillas": "plantillas",
  "/configuracion": "configuracion",
};

export function canAccessRoute(user: UserProfile, route: string): boolean {
  if (!user || user.status === "inactivo") return false;
  if (user.role === "superadmin") return true;

  const targetModule = routePermissions[route];
  if (targetModule) {
    return canAccessModule(user, targetModule);
  }

  return true;
}

export const tabPermissions: Record<string, string> = {
  fiscal: "manage_clients",
  red: "manage_network",        // Nodos
  boveda: "manage_vault",
  contratos: "manage_policies", // Arcotel
  cotizaciones: "manage_finance",
  finanzas: "manage_finance",   // Cobros
  tickets: "manage_tickets",
  proyectos: "manage_network",
  dossier: "manage_clients",
  inventario: "manage_network",
};
