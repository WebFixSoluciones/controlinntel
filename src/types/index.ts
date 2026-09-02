export type UserRole = "superadmin" | "admin" | "finanzas" | "tecnico" | "soporte" | "legal" | "consulta";

export type SystemPermission =
  | "all"
  | "manage_users"
  | "manage_vault"
  | "manage_clients"
  | "manage_network"
  | "manage_tickets"
  | "manage_finance"
  | "manage_policies"
  | "export_reports";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  department?: string;
  phone?: string;
  avatarUrl?: string;
  status?: "activo" | "inactivo";
  permissions?: SystemPermission[];
}

export interface SystemUser extends UserProfile {
  passwordHash: string;
  status: "activo" | "inactivo";
  permissions: SystemPermission[];
  createdAt: string;
  lastLogin?: string;
}

export type IdentificationType = "RUC" | "CEDULA" | "PASAPORTE";
export type ServiceBillingType = "prepago" | "pospago";
export type ServiceStatus = "activo" | "suspendido" | "retirado" | "en_instalacion";

export interface ClientService {
  id: string;
  clientId: string;
  planId: string;
  planName: string;
  downloadMbps: number;
  uploadMbps: number;
  basePrice: number;
  customPrice: number;
  billingType: ServiceBillingType;
  cutoffDay: number;
  nodeId: string;
  nodeName: string;
  ipv4Address: string;
  ipv6Prefix?: string;
  pppoeUser: string;
  pppoePassword?: string;
  status: ServiceStatus;
  installationDate: string;
  installationAddress?: string;
  coordinates?: { lat: number; lng: number };
  ontSerialNumber?: string;
  notes?: string;
}

export interface Client {
  id: string;
  identificationType: IdentificationType;
  identificationNumber: string;
  businessName: string;
  legalRepresentative?: string;
  email: string;
  phone: string;
  address: string;
  sector?: string;
  requiresSriBilling: boolean;
  status: "activo" | "suspendido" | "retirado";
  totalActiveServices: number;
  currentBalance: number;
  createdAt: string;
  updatedAt: string;
}

export interface Plan {
  id: string;
  name: string;
  downloadMbps: number;
  uploadMbps: number;
  defaultPrice: number;
  billingType: ServiceBillingType;
  description: string;
}

export interface ArcotelPolicy {
  id: string;
  policyNumber: string;
  insuranceCompany: string;
  policyType: "fiel_cumplimiento" | "responsabilidad_civil" | "buen_uso_anticipo";
  titleGrantCode: string;
  startDate: string;
  expirationDate: string;
  insuredAmount: number;
  status: "vigente" | "por_vencer" | "vencida";
  daysUntilExpiration: number;
  pdfUrl?: string;
  notes?: string;
}

export interface VaultCredential {
  id: string;
  serviceName: string;
  serviceType: "sietel" | "fodetel" | "quipux" | "bdh" | "mikrotik" | "arcotel_portal" | "otro";
  portalUrl?: string;
  username: string;
  encryptedPassword?: string;
  totpSecret?: string;
  notes?: string;
  allowedRoles: UserRole[];
  lastAccessedAt?: string;
  updatedAt: string;
}

export interface NodeLocation {
  id: string;
  name: string;
  address: string;
  coordinates?: { lat: number; lng: number };
  upstreamProvider: string;
  totalCapacityMbps: number;
  usedCapacityMbps: number;
  mikrotikIp?: string;
  status: "online" | "warning" | "offline";
  activeClientsCount: number;
  notes?: string;
}

export interface IpPool {
  id: string;
  name: string;
  subnetCidr: string;
  gateway: string;
  type: "cgnat" | "publica_fija" | "ipv6_pool";
  totalIpsCount: number;
  usableIpsCount: number;
  assignedIpsCount: number;
  nodeId: string;
}

export type TicketPriority = "baja" | "media" | "alta" | "critica";
export type TicketStatus = "abierto" | "en_progreso" | "resuelto" | "cerrado";

export interface Ticket {
  id: string;
  ticketNumber: string;
  clientId: string;
  clientName: string;
  title: string;
  description: string;
  category: "corte_fibra" | "atenuacion_alta" | "configuracion_ip" | "facturacion" | "otro";
  priority: TicketPriority;
  status: TicketStatus;
  assignedToId?: string;
  assignedToName?: string;
  createdAt: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  nodeName?: string;
}

export interface Expense {
  id: string;
  supplierName: string;
  category: "alquiler_nodo" | "enlace_transito" | "fibra_equipos" | "mantenimiento" | "seguros" | "otro";
  amount: number;
  description: string;
  expenseDate: string;
  nodeId?: string;
  paymentMethod: "transferencia" | "tarjeta_credito" | "efectivo";
  invoiceNumber?: string;
}

export interface MonthlyCharge {
  id: string;
  clientId: string;
  clientName: string;
  clientRuc: string;
  month: number;
  year: number;
  serviceDescription: string;
  subtotal: number;
  ivaAmount: number;
  total: number;
  status: "pendiente" | "pagado" | "anulado";
  paymentDate?: string;
  paymentMethod?: string;
  invoiceNumber: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  userRole: UserRole;
  action:
    | "LOGIN"
    | "LOGOUT"
    | "VIEW_VAULT_PASSWORD"
    | "UPDATE_VAULT"
    | "GENERATE_DOC"
    | "CREATE_CLIENT"
    | "UPDATE_CLIENT"
    | "CREATE_EXPENSE"
    | "EXPORT_BILLING"
    | "CREATE_USER"
    | "UPDATE_USER"
    | "DELETE_USER"
    | "EXPORT_SRI";
  resource: string;
  details: string;
  timestamp: string;
}

// ==========================================
// CLIENT-CENTRIC 360° EXTENSION TYPES
// ==========================================

export type ProjectKanbanColumn =
  | "factibilidad"
  | "tendido_fibra"
  | "fusion_splitters"
  | "instalacion_ont"
  | "pruebas_homologacion"
  | "completado";

export interface ProjectChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface ClientProjectTask {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  description: string;
  column: ProjectKanbanColumn;
  priority: "baja" | "media" | "alta" | "urgente";
  assignedTo: string;
  dueDate: string;
  checklist: ProjectChecklistItem[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteOrderItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ClientQuoteOrder {
  id: string;
  clientId: string;
  clientName: string;
  clientRuc: string;
  quoteNumber: string;
  title: string;
  items: QuoteOrderItem[];
  subtotal: number;
  ivaAmount: number;
  total: number;
  status: "borrador" | "enviada" | "aprobada" | "orden_pedido" | "facturada";
  validUntil: string;
  notes?: string;
  createdAt: string;
}

export interface ClientVaultItem {
  id: string;
  clientId: string;
  serviceName: string;
  category: "ont_router" | "wifi" | "pppoe" | "cctv_camaras" | "vpn_remoto" | "otro";
  username: string;
  encryptedPassword?: string;
  ipAddress?: string;
  port?: number;
  notes?: string;
  updatedAt: string;
}

export interface ClientContractInfo {
  id: string;
  clientId: string;
  contractNumber: string;
  arcotelHomologationCode: string;
  planName: string;
  signedDate: string;
  expirationDate: string;
  renewalDate?: string;
  status: "vigente" | "por_renovar" | "vencido";
  monthlyPrice: number;
  notes?: string;
}

