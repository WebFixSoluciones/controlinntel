import { z } from "zod";
import { validateIdentification } from "../validation-engine";

const text = z.string().trim().min(1).max(500);
const optionalText = z.string().trim().max(500).optional();
const money = z.number().finite().nonnegative().max(100000000);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => !Number.isNaN(Date.parse(v)));

const client = z
  .object({
    businessName: text,
    identificationType: z.enum(["RUC", "CEDULA", "PASAPORTE"]),
    identificationNumber: text,
    email: z.string().email(),
    phone: text,
    address: text,
    status: z.enum(["activo", "suspendido", "retirado"]),
  })
  .passthrough()
  .superRefine((v, c) => {
    const result = validateIdentification(v.identificationType, v.identificationNumber);
    if (!result.isValid) c.addIssue({ code: "custom", message: result.error || "Identificación inválida" });
  });

const supplier = z
  .object({
    businessName: text,
    identificationType: z.enum(["RUC", "CEDULA", "PASAPORTE"]),
    identificationNumber: text,
    email: z.string().email(),
    phone: text,
    address: text,
    status: z.enum(["activo", "inactivo"]).optional(),
  })
  .passthrough()
  .superRefine((v, c) => {
    const result = validateIdentification(v.identificationType, v.identificationNumber);
    if (!result.isValid) c.addIssue({ code: "custom", message: result.error || "RUC/Identificación de proveedor inválida" });
  });

export const schemas: Record<string, z.ZodTypeAny> = {
  // Clientes & Servicios
  clients: client,
  clientServices: z
    .object({
      clientId: text,
      planId: text,
      customPrice: money,
      status: z.enum(["activo", "suspendido", "retirado", "en_instalacion"]),
    })
    .passthrough(),
  plans: z
    .object({
      name: text,
      downloadMbps: money,
      uploadMbps: money,
      defaultPrice: money,
      billingType: z.enum(["prepago", "pospago"]),
      description: z.string().max(2000),
    })
    .passthrough(),
  clientProjects: z
    .object({
      title: text,
      column: text,
      dueDate: date,
      checklist: z.array(z.object({ id: text, text: text, done: z.boolean() })).max(100),
    })
    .passthrough(),
  clientContracts: z
    .object({
      clientId: text,
      contractNumber: text,
      signedDate: date,
      expirationDate: date,
      monthlyPrice: money,
    })
    .passthrough()
    .refine((v) => v.expirationDate >= v.signedDate, "Fechas inválidas"),
  clientQuotes: z
    .object({
      clientId: text,
      title: text,
      items: z
        .array(
          z.object({
            id: text,
            description: text,
            quantity: z.number().positive().max(1000000),
            unitPrice: money,
            total: money,
          })
        )
        .min(1)
        .max(100),
      status: z.enum(["borrador", "enviada", "aprobada", "orden_pedido", "facturada"]),
    })
    .passthrough(),
  clientDocuments: z
    .object({
      clientId: text,
      title: text,
    })
    .passthrough(),

  // Red & Telecomunicaciones
  nodes: z
    .object({
      name: text,
      address: text,
      totalCapacityMbps: z.number().positive(),
      usedCapacityMbps: money,
      status: z.enum(["online", "offline", "warning"]),
    })
    .passthrough(),
  ipPools: z
    .object({
      name: text,
      subnetCidr: text,
      gateway: text,
      nodeId: text,
      type: z.enum(["cgnat", "publica_fija", "ipv6_pool"]),
      totalIpsCount: z.number().int().positive(),
      usableIpsCount: z.number().int().nonnegative(),
      assignedIpsCount: z.number().int().nonnegative(),
    })
    .passthrough(),
  projects: z.object({ title: text, startDate: date, endDate: date }).passthrough(),

  // Regulatorio & ARCOTEL
  policies: z
    .object({
      policyNumber: text,
      insuranceCompany: text,
      startDate: date,
      expirationDate: date,
      insuredAmount: money,
    })
    .passthrough()
    .refine((v) => v.expirationDate >= v.startDate, "Fechas de póliza inválidas"),
  arcotelFiles: z.object({ title: text }).passthrough(),
  regulatoryTramites: z
    .object({
      title: text,
      tramiteNumber: text,
    })
    .passthrough(),

  // Bóveda & Seguridad
  vault: z.object({ serviceName: text, username: text, allowedRoles: z.array(text).min(1) }).passthrough(),
  clientVaultItems: z.object({ clientId: text, serviceName: text, username: text, category: text }).passthrough(),
  systemUsers: z
    .object({
      email: z.string().email(),
      displayName: text,
      role: text,
      status: z.enum(["activo", "inactivo"]),
    })
    .passthrough(),

  // Soporte & Tickets
  tickets: z
    .object({
      clientId: text,
      title: text,
      description: text,
      priority: z.enum(["baja", "media", "alta", "critica"]),
      status: z.enum(["abierto", "en_progreso", "resuelto", "cerrado"]),
    })
    .passthrough(),

  // Facturación & Cobros
  monthlyCharges: z
    .object({
      clientId: text,
      month: z.number().int().min(1).max(12),
      year: z.number().int().min(2020).max(2100),
      total: money,
    })
    .passthrough(),
  billingInvoices: z
    .object({
      clientId: text,
      invoiceNumber: text,
      issueDate: date,
      total: money,
      status: text,
    })
    .passthrough(),
  billingQuotes: z
    .object({
      clientId: text,
      quoteNumber: text,
      total: money,
      status: text,
    })
    .passthrough(),
  billingCreditNotes: z
    .object({
      clientId: text,
      total: money,
    })
    .passthrough(),
  billingWithholdings: z
    .object({
      clientId: text,
      totalWithheld: money,
    })
    .passthrough(),
  billingRemissionGuides: z
    .object({
      guideNumber: text,
    })
    .passthrough(),
  sriCompanyConfig: z
    .object({
      ruc: text,
      razonSocial: text,
    })
    .passthrough(),

  // Compras & Proveedores
  suppliers: supplier,
  purchaseInvoices: z
    .object({
      supplierId: text,
      documentNumber: text,
      issueDate: date,
      total: money,
      status: text,
    })
    .passthrough(),
  supplierCreditNotes: z.object({ supplierId: text, total: money }).passthrough(),
  supplierDebitNotes: z.object({ supplierId: text, total: money }).passthrough(),
  purchaseWithholdings: z.object({ supplierId: text, totalWithheld: money }).passthrough(),
  supplierPayments: z.object({ supplierId: text, amount: money }).passthrough(),

  // Inventarios
  inventoryProducts: z
    .object({
      name: text,
      sku: text,
      salePrice: money,
      currentStock: z.number(),
    })
    .passthrough(),
  inventoryWarehouses: z.object({ name: text }).passthrough(),
  inventoryCategories: z.object({ name: text }).passthrough(),
  inventoryBrands: z.object({ name: text }).passthrough(),
  inventoryKardex: z
    .object({
      productId: text,
      movementType: text,
      quantity: z.number(),
      date: text,
    })
    .passthrough(),
  inventoryTransfers: z.object({ originWarehouseId: text, destinationWarehouseId: text }).passthrough(),
  inventoryAdjustments: z.object({ warehouseId: text }).passthrough(),

  // Finanzas & Tesorería
  bankAccounts: z
    .object({
      bankName: text,
      accountNumber: text,
      currentBalance: z.number(),
    })
    .passthrough(),
  financialMovements: z
    .object({
      type: z.enum(["ingreso", "egreso", "transferencia"]),
      amount: money,
      date: text,
    })
    .passthrough(),
  expenses: z.object({ supplierName: text, amount: money, expenseDate: date, description: text }).passthrough(),
  hostingDomains: z.object({ domainName: text, annualCostUsd: money }).passthrough(),
};
