"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { ToastProvider } from "./toast-context";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { ModalFocusGuard } from "@/components/layout/ModalFocusGuard";
import {
  Client,
  ClientService,
  Plan,
  NodeLocation,
  IpPool,
  ArcotelPolicy,
  VaultCredential,
  Ticket,
  TicketStatus,
  TicketMessage,
  TicketSubject,
  Expense,
  MonthlyCharge,
  ChargePayment,
  ClientAdvance,
  AuditLog,
  UserProfile,
  UserRole,
  SystemUser,
  ClientProjectTask,
  Project,
  ProjectCustomColumn,
  ProjectStatus,
  ProjectNoteItem,
  ClientQuoteOrder,
  ClientVaultItem,
  ClientContractInfo,
  ProjectKanbanColumn,
  ArcotelConcessionInfo,
  ArcotelPeriodicFile,
  ClientDocumentFile,
  InventoryProduct,
  Warehouse,
  ProductCategory,
  ProductBrand,
  KardexEntry,
  WarehouseTransfer,
  InventoryAdjustment,
  SriCompanyConfig,
  SriInvoice,
  ClientQuote,
  CreditNote,
  DebitNote,
  WithholdingReceipt,
  RemissionGuide,
  InvoiceItem,
  Supplier,
  PurchaseInvoice,
  PurchaseItem,
  PurchasePaymentCondition,
  PurchasePaymentStatus,
  SupplierCreditNote,
  SupplierDebitNote,
  PurchaseWithholding,
  BankAccount,
  FinancialMovement,
  SupplierPaymentRecord,
  SupplierCreditBalance,
  UserModulePermissions,
  HostingDomainRecord,
  RegulatoryTramite,
} from "@/types";
import {
  INITIAL_USER,
  INITIAL_SYSTEM_USERS,
  INITIAL_PLANS,
  INITIAL_NODES,
  INITIAL_IP_POOLS,
  INITIAL_CLIENTS,
  INITIAL_CLIENT_SERVICES,
  INITIAL_POLICIES,
  INITIAL_VAULT,
  INITIAL_TICKETS,
  INITIAL_EXPENSES,
  INITIAL_MONTHLY_CHARGES,
  INITIAL_PROJECTS,
  DEFAULT_PROJECT_COLUMNS,
  INITIAL_PROJECT_TASKS,
  INITIAL_QUOTES,
  INITIAL_CLIENT_VAULT,
  INITIAL_CONTRACTS,
  INITIAL_AUDIT_LOGS,
  INITIAL_CONCESSION_INFO,
  INITIAL_ARCOTEL_FILES,
  INITIAL_CLIENT_DOCUMENTS,
  INITIAL_CATEGORIES,
  INITIAL_BRANDS,
  INITIAL_WAREHOUSES,
  INITIAL_PRODUCTS,
  INITIAL_KARDEX,
  INITIAL_TRANSFERS,
  INITIAL_ADJUSTMENTS,
  INITIAL_SRI_CONFIG,
  INITIAL_INVOICES,
  INITIAL_BILLING_QUOTES,
  INITIAL_CREDIT_NOTES,
  INITIAL_WITHHOLDINGS,
  INITIAL_REMISSION_GUIDES,
  INITIAL_SUPPLIERS,
  INITIAL_BANK_ACCOUNTS,
  INITIAL_PURCHASE_INVOICES,
  INITIAL_SUPPLIER_PAYMENTS,
  INITIAL_PURCHASE_WITHHOLDINGS,
  INITIAL_SUPPLIER_CREDIT_NOTES,
  INITIAL_SUPPLIER_DEBIT_NOTES,
  INITIAL_FINANCIAL_MOVEMENTS,
  INITIAL_HOSTING_DOMAINS,
  INITIAL_REGULATORY_TRAMITES,
} from "./mock-data";
import { auth } from "./firebase";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { usePathname } from "next/navigation";
import { can, canAccessRoute, collectionPermissions, routePermissions, type Entity } from "./permissions";
import {
  calculateWeightedAverageCost,
  calculatePriceWithTax,
  validateStockAvailability,
  generateInventoryDocNumber,
  buildKardexEntry,
} from "./inventory-service";
import {
  generarClaveAccesoSRI,
  formatearSecuencialSRI,
  DEFAULT_INNTEL_SRI_CONFIG,
} from "./sri-service";
import { api } from "./api-client";
import { getEcuadorDate, addMonthsSafely, calculateContractEndDate, calculateNextRenewalDate } from "./date-utils";
import { calculateLines, planServicePeriod } from "./commercial-core";
import { sanitizeObjectTexts } from "./sanitize-text";
import { SecurityLockoutModal } from "@/components/security/SecurityLockoutModal";

interface AppContextType {
  currentUser: UserProfile;
  isAuthenticated: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<boolean>;
  logout: () => Promise<void>;
  revealCredential: (entity: "vault" | "clientVaultItems", id: string) => Promise<string>;
  refresh: () => Promise<void>;
  transferBetweenAccounts: (fromId: string, toId: string, amount: number, description?: string) => Promise<void>;
  startBillingRun: (units: Record<string, unknown>[]) => Promise<{ id: string; units: { index: number; status: string }[] }>;
  processBillingRun: (id: string, index: number) => Promise<{ status: string; error?: string }>;
  saveRecord: (entity: Entity, data: Record<string, unknown>, id?: string) => Promise<void>;
  deleteRecord: (entity: Entity, id: string) => Promise<void>;

  systemUsers: SystemUser[];
  addSystemUser: (user: Omit<SystemUser, "uid" | "createdAt">) => Promise<void>;
  updateSystemUser: (uid: string, updates: Partial<SystemUser>) => Promise<void>;
  deleteSystemUser: (uid: string) => Promise<boolean>;
  toggleUserStatus: (uid: string) => Promise<void>;

  clients: Client[];
  clientServices: ClientService[];
  plans: Plan[];
  nodes: NodeLocation[];
  ipPools: IpPool[];
  policies: ArcotelPolicy[];
  vault: VaultCredential[];
  tickets: Ticket[];
  ticketSubjects: TicketSubject[];
  addTicketSubject: (subject: Omit<TicketSubject, "id">) => Promise<void>;
  updateTicketSubject: (id: string, updates: Partial<TicketSubject>) => Promise<void>;
  deleteTicketSubject: (id: string) => Promise<void>;
  expenses: Expense[];
  monthlyCharges: MonthlyCharge[];
  auditLogs: AuditLog[];

  // Projects Management (Notion-style hierarchy)
  projects: Project[];
  addProject: (project: Omit<Project, "id" | "createdAt" | "updatedAt">) => Promise<string>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  restoreProject: (id: string) => Promise<void>;
  permanentDeleteProject: (id: string) => Promise<void>;
  updateProjectColumns: (projectId: string, columns: ProjectCustomColumn[]) => Promise<void>;

  // Client 360 Extensions & Project Tasks
  clientProjects: ClientProjectTask[];
  addClientProjectTask: (task: Omit<ClientProjectTask, "id" | "createdAt" | "updatedAt">) => Promise<ClientProjectTask>;
  updateClientProjectTask: (id: string, updates: Partial<ClientProjectTask>) => Promise<void>;
  moveProjectTaskColumn: (id: string, newColumn: ProjectKanbanColumn | string) => Promise<void>;
  addProjectTaskNote: (taskId: string, content: string) => Promise<void>;
  deleteClientProjectTask: (id: string) => Promise<void>;

  clientQuotes: ClientQuoteOrder[];
  addClientQuote: (quote: Omit<ClientQuoteOrder, "id" | "createdAt">) => Promise<void>;
  updateClientQuoteStatus: (id: string, status: ClientQuoteOrder["status"]) => Promise<void>;
  deleteClientQuote: (id: string) => Promise<void>;

  clientVaultItems: ClientVaultItem[];
  addClientVaultItem: (item: Omit<ClientVaultItem, "id" | "updatedAt">) => Promise<void>;
  updateClientVaultItem: (id: string, updates: Partial<ClientVaultItem>) => Promise<void>;
  deleteClientVaultItem: (id: string) => Promise<void>;

  clientContracts: ClientContractInfo[];
  addClientContract: (contract: Omit<ClientContractInfo, "id">) => Promise<void>;
  updateClientContract: (id: string, updates: Partial<ClientContractInfo>) => Promise<void>;

  addClient: (client: Omit<Client, "id" | "createdAt" | "updatedAt">, serviceData?: Partial<ClientService>) => Promise<Client>;
  updateClient: (id: string, updates: Partial<Client>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  addClientService: (service: Omit<ClientService, "id">) => Promise<ClientService>;
  updateClientService: (id: string, updates: Partial<ClientService>) => Promise<void>;
  deleteClientService: (id: string) => Promise<void>;
  renewClientService: (id: string) => Promise<void>;
  emitRecurringInvoiceForClient: (clientId: string, month: number, year: number, serviceIds?: string[]) => Promise<SriInvoice | null>;

  addPolicy: (policy: Omit<ArcotelPolicy, "id">) => Promise<void>;
  deletePolicy: (id: string) => Promise<void>;
  updatePolicy: (id: string, updates: Partial<ArcotelPolicy>) => Promise<void>;

  addVaultCredential: (cred: Omit<VaultCredential, "id" | "updatedAt">) => Promise<void>;
  updateVaultCredential: (id: string, updates: Partial<VaultCredential>) => Promise<void>;
  logVaultAccess: (credentialId: string, serviceName: string) => Promise<void>;

  addNode: (node: Omit<NodeLocation, "id">) => Promise<void>;
  updateNode: (id: string, updates: Partial<NodeLocation>) => Promise<void>;
  deleteNode: (id: string) => Promise<void>;

  arcotelConcession: ArcotelConcessionInfo;
  updateArcotelConcession: (updates: Partial<ArcotelConcessionInfo>) => Promise<void>;

  arcotelFiles: ArcotelPeriodicFile[];
  addArcotelFile: (file: Omit<ArcotelPeriodicFile, "id" | "uploadedAt">) => Promise<void>;
  deleteArcotelFile: (id: string) => Promise<void>;

  clientDocuments: ClientDocumentFile[];
  addClientDocument: (doc: Omit<ClientDocumentFile, "id" | "uploadedAt">) => Promise<void>;
  updateClientDocument: (id: string, updates: Partial<ClientDocumentFile>) => Promise<void>;
  deleteClientDocument: (id: string) => Promise<void>;

  addTicket: (ticket: Omit<Ticket, "id" | "ticketNumber" | "createdAt">) => Promise<void>;
  updateTicketStatus: (id: string, status: Ticket["status"], notes?: string) => Promise<void>;
  updateTicketDetails: (id: string, updates: Partial<Ticket>) => Promise<void>;
  replyToTicket: (id: string, body: string, isInternal?: boolean, newStatus?: TicketStatus) => Promise<void>;

  addExpense: (expense: Omit<Expense, "id">) => Promise<void>;
  generateMonthlyBillingBatch: (month: number, year: number) => Promise<void>;
  markChargeAsPaid: (
    chargeId: string,
    method: string,
    reference?: string,
    paidAmount?: number,
    remainingBalance?: number,
    bankAccountId?: string
  ) => Promise<void>;
  addMonthlyCharge: (charge: Omit<MonthlyCharge, "id">) => Promise<void>;
  updateMonthlyCharge: (id: string, updates: Partial<MonthlyCharge>) => Promise<void>;
  deleteMonthlyCharge: (id: string) => Promise<void>;
  addPaymentToCharge: (
    chargeId: string,
    payment: {
      amount: number;
      method: string;
      reference?: string;
      bankAccountId?: string;
      advanceId?: string;
      notes?: string;
      date?: string;
    }
  ) => Promise<void>;

  clientAdvances: ClientAdvance[];
  addClientAdvance: (
    advance: Omit<ClientAdvance, "id" | "remaining" | "status" | "applications">
  ) => Promise<ClientAdvance>;
  applyClientAdvance: (advanceId: string, chargeId: string, amount: number) => Promise<void>;
  deleteClientAdvance: (id: string) => Promise<void>;

  // Inventory Module
  inventoryProducts: InventoryProduct[];
  inventoryWarehouses: Warehouse[];
  inventoryCategories: ProductCategory[];
  inventoryBrands: ProductBrand[];
  inventoryKardex: KardexEntry[];
  inventoryTransfers: WarehouseTransfer[];
  inventoryAdjustments: InventoryAdjustment[];

  addInventoryProduct: (product: Omit<InventoryProduct, "id" | "createdAt" | "updatedAt">) => Promise<InventoryProduct>;
  updateInventoryProduct: (id: string, updates: Partial<InventoryProduct>) => Promise<void>;
  deleteInventoryProduct: (id: string) => Promise<void>;

  addWarehouse: (warehouse: Omit<Warehouse, "id" | "createdAt">) => Promise<void>;
  updateWarehouse: (id: string, updates: Partial<Warehouse>) => Promise<void>;
  deleteWarehouse: (id: string) => Promise<void>;

  addCategory: (category: Omit<ProductCategory, "id" | "createdAt">) => Promise<void>;
  addBrand: (brand: Omit<ProductBrand, "id" | "createdAt">) => Promise<void>;

  executeTransfer: (params: {
    originWarehouseId: string;
    destWarehouseId: string;
    productId: string;
    quantity: number;
    reason: string;
  }) => Promise<void>;

  executeAdjustment: (params: {
    warehouseId: string;
    type: "manual_ingreso" | "manual_egreso" | "masivo" | "encerar";
    concept: string;
    items: {
      productId: string;
      type: "ingreso" | "egreso";
      quantity: number;
      unitCost: number;
    }[];
  }) => Promise<void>;

  // Billing & SRI Module
  billingInvoices: SriInvoice[];
  billingQuotes: ClientQuote[];
  billingCreditNotes: CreditNote[];
  billingDebitNotes: DebitNote[];
  billingWithholdings: WithholdingReceipt[];
  billingRemissionGuides: RemissionGuide[];
  sriCompanyConfig: SriCompanyConfig;

  createInvoice: (
    data: Omit<SriInvoice, "id" | "claveAcceso" | "documentNumber" | "createdAt" | "kardexRegistered"> & {
      customSecuencial?: number;
    }
  ) => Promise<SriInvoice>;
  updateInvoiceStatus: (
    id: string,
    status: SriInvoice["status"],
    authorizationDate?: string
  ) => Promise<void>;
  updateInvoice: (
    id: string,
    updates: Partial<SriInvoice>
  ) => Promise<SriInvoice>;
  deleteInvoice: (id: string) => Promise<void>;
  createBillingQuote: (
    quote: Omit<ClientQuote, "id" | "quoteNumber" | "createdAt">
  ) => Promise<ClientQuote>;
  updateBillingQuote: (
    id: string,
    updates: Partial<ClientQuote>
  ) => Promise<void>;
  deleteBillingQuote: (id: string) => Promise<void>;
  convertQuoteToInvoice: (
    quoteId: string,
    warehouseId: string,
    paymentMethod?: SriInvoice["paymentMethod"],
    documentType?: "factura" | "nota_venta"
  ) => Promise<SriInvoice>;
  convertSaleToSriInvoice: (
    saleId: string,
    customData?: Partial<SriInvoice> & { customSecuencial?: number }
  ) => Promise<SriInvoice>;
  createCreditNote: (
    data: Omit<CreditNote, "id" | "claveAcceso" | "documentNumber" | "createdAt" | "kardexReentered">
  ) => Promise<CreditNote>;
  createDebitNote: (
    data: Omit<DebitNote, "id" | "claveAcceso" | "documentNumber" | "createdAt">
  ) => Promise<DebitNote>;
  createWithholding: (
    data: Omit<WithholdingReceipt, "id" | "claveAcceso" | "documentNumber" | "createdAt">
  ) => Promise<WithholdingReceipt>;
  createRemissionGuide: (
    data: Omit<RemissionGuide, "id" | "claveAcceso" | "documentNumber" | "createdAt">
  ) => Promise<RemissionGuide>;
  updateSriConfig: (updates: Partial<SriCompanyConfig>) => Promise<void>;

  // Compras & Proveedores & Finanzas Bancarias
  suppliers: Supplier[];
  purchaseInvoices: PurchaseInvoice[];
  supplierCreditNotes: SupplierCreditNote[];
  supplierDebitNotes: SupplierDebitNote[];
  purchaseWithholdings: PurchaseWithholding[];
  bankAccounts: BankAccount[];
  financialMovements: FinancialMovement[];
  supplierPayments: SupplierPaymentRecord[];
  supplierCredits: SupplierCreditBalance[];

  addSupplier: (supplier: Omit<Supplier, "id" | "createdAt" | "updatedAt">) => Promise<Supplier>;
  updateSupplier: (id: string, updates: Partial<Supplier>) => Promise<void>;
  deleteSupplier: (id: string) => Promise<void>;

  addPurchaseInvoice: (
    data: Omit<PurchaseInvoice, "id" | "createdAt" | "paidAmount" | "balanceRemaining"> & {
      paidAmount?: number;
    }
  ) => Promise<PurchaseInvoice>;
  updatePurchaseInvoice: (id: string, updates: Partial<PurchaseInvoice>) => Promise<void>;

  addSupplierCreditNote: (
    note: Omit<SupplierCreditNote, "id" | "createdAt">
  ) => Promise<SupplierCreditNote>;
  addSupplierDebitNote: (
    note: Omit<SupplierDebitNote, "id" | "createdAt">
  ) => Promise<SupplierDebitNote>;
  addPurchaseWithholding: (
    ret: Omit<PurchaseWithholding, "id" | "createdAt">
  ) => Promise<PurchaseWithholding>;

  addBankAccount: (account: Omit<BankAccount, "id">) => Promise<BankAccount>;
  updateBankAccount: (id: string, updates: Partial<BankAccount>) => Promise<void>;
  adjustBankBalance: (bankAccountId: string, delta: number, reason: string) => Promise<void>;
  reverseChargePayment: (chargeId: string, paymentId: string) => Promise<void>;

  addSupplierPayment: (payment: Omit<SupplierPaymentRecord, "id" | "createdAt">) => Promise<SupplierPaymentRecord>;
  addFinancialMovement: (movement: Omit<FinancialMovement, "id" | "createdAt">) => Promise<FinancialMovement>;

  updateUserModulePermissions: (uid: string, permissions: UserModulePermissions) => Promise<void>;

  // Hosting & Dominios
  hostingDomains: HostingDomainRecord[];
  addHostingDomain: (item: Omit<HostingDomainRecord, "id">) => Promise<void>;
  updateHostingDomain: (id: string, updates: Partial<HostingDomainRecord>) => Promise<void>;
  deleteHostingDomain: (id: string) => Promise<void>;

  // Trámites Regulatorios
  regulatoryTramites: RegulatoryTramite[];
  addRegulatoryTramite: (item: Omit<RegulatoryTramite, "id" | "createdAt" | "updatedAt">) => Promise<RegulatoryTramite>;
  updateRegulatoryTramite: (id: string, updates: Partial<RegulatoryTramite>) => Promise<void>;
  deleteRegulatoryTramite: (id: string) => Promise<void>;

  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;

  resetDataToDefaults: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);
const STORAGE_KEY = "INNTEL_CORP_STATE_CLEAN_V1";
const USERS_KEY = "INNTEL_SYSTEM_USERS_PROD_V1";
const AUTH_KEY = "INNTEL_AUTH_USER_PROD_V1";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthLoaded, setIsAuthLoaded] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<UserProfile>(INITIAL_USER);
  const [dataReady, setDataReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const cachePreserved = useRef(false);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>(INITIAL_SYSTEM_USERS);

  const [clients, setClients] = useState<Client[]>(INITIAL_CLIENTS);
  const [clientServices, setClientServices] = useState<ClientService[]>(INITIAL_CLIENT_SERVICES);
  const [plans, setPlans] = useState<Plan[]>(INITIAL_PLANS);
  const [nodes, setNodes] = useState<NodeLocation[]>(INITIAL_NODES);
  const [ipPools, setIpPools] = useState<IpPool[]>(INITIAL_IP_POOLS);
  const [policies, setPolicies] = useState<ArcotelPolicy[]>(INITIAL_POLICIES);
  const [vault, setVault] = useState<VaultCredential[]>(INITIAL_VAULT);
  const [tickets, setTickets] = useState<Ticket[]>(INITIAL_TICKETS);
  const [ticketSubjects, setTicketSubjects] = useState<TicketSubject[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>(INITIAL_EXPENSES);
  const [monthlyCharges, setMonthlyCharges] = useState<MonthlyCharge[]>(INITIAL_MONTHLY_CHARGES);
  const [clientAdvances, setClientAdvances] = useState<ClientAdvance[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INITIAL_AUDIT_LOGS);

  // Projects & Tasks State (Notion-style hierarchy)
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [clientProjects, setClientProjects] = useState<ClientProjectTask[]>(INITIAL_PROJECT_TASKS);
  const [clientQuotes, setClientQuotes] = useState<ClientQuoteOrder[]>(INITIAL_QUOTES);
  const [clientVaultItems, setClientVaultItems] = useState<ClientVaultItem[]>(INITIAL_CLIENT_VAULT);
  const [clientContracts, setClientContracts] = useState<ClientContractInfo[]>(INITIAL_CONTRACTS);
  const [arcotelConcession, setArcotelConcession] = useState<ArcotelConcessionInfo>(() => sanitizeObjectTexts(INITIAL_CONCESSION_INFO));
  const [arcotelFiles, setArcotelFiles] = useState<ArcotelPeriodicFile[]>(INITIAL_ARCOTEL_FILES);
  const [clientDocuments, setClientDocuments] = useState<ClientDocumentFile[]>(INITIAL_CLIENT_DOCUMENTS);

  // Inventory Module State
  const [inventoryProducts, setInventoryProducts] = useState<InventoryProduct[]>(INITIAL_PRODUCTS);
  const [inventoryWarehouses, setInventoryWarehouses] = useState<Warehouse[]>(INITIAL_WAREHOUSES);
  const [inventoryCategories, setInventoryCategories] = useState<ProductCategory[]>(INITIAL_CATEGORIES);
  const [inventoryBrands, setInventoryBrands] = useState<ProductBrand[]>(INITIAL_BRANDS);
  const [inventoryKardex, setInventoryKardex] = useState<KardexEntry[]>(INITIAL_KARDEX);
  const [inventoryTransfers, setInventoryTransfers] = useState<WarehouseTransfer[]>(INITIAL_TRANSFERS);
  const [inventoryAdjustments, setInventoryAdjustments] = useState<InventoryAdjustment[]>(INITIAL_ADJUSTMENTS);

  // Billing & SRI Module State
  const [billingInvoices, setBillingInvoices] = useState<SriInvoice[]>(INITIAL_INVOICES);
  const [billingQuotes, setBillingQuotes] = useState<ClientQuote[]>(INITIAL_BILLING_QUOTES);
  const [billingCreditNotes, setBillingCreditNotes] = useState<CreditNote[]>(INITIAL_CREDIT_NOTES);
  const [billingDebitNotes, setBillingDebitNotes] = useState<DebitNote[]>([]);
  const [billingWithholdings, setBillingWithholdings] = useState<WithholdingReceipt[]>(INITIAL_WITHHOLDINGS);
  const [billingRemissionGuides, setBillingRemissionGuides] = useState<RemissionGuide[]>(INITIAL_REMISSION_GUIDES);
  const [sriCompanyConfig, setSriCompanyConfig] = useState<SriCompanyConfig>(INITIAL_SRI_CONFIG);

  // Compras, Proveedores & Finanzas Bancarias State
  const [suppliers, setSuppliers] = useState<Supplier[]>(INITIAL_SUPPLIERS);
  const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoice[]>(INITIAL_PURCHASE_INVOICES);
  const [supplierCreditNotes, setSupplierCreditNotes] = useState<SupplierCreditNote[]>(INITIAL_SUPPLIER_CREDIT_NOTES);
  const [supplierDebitNotes, setSupplierDebitNotes] = useState<SupplierDebitNote[]>(INITIAL_SUPPLIER_DEBIT_NOTES);
  const [purchaseWithholdings, setPurchaseWithholdings] = useState<PurchaseWithholding[]>(INITIAL_PURCHASE_WITHHOLDINGS);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(INITIAL_BANK_ACCOUNTS);
  const [financialMovements, setFinancialMovements] = useState<FinancialMovement[]>(INITIAL_FINANCIAL_MOVEMENTS);
  const [supplierPayments, setSupplierPayments] = useState<SupplierPaymentRecord[]>(INITIAL_SUPPLIER_PAYMENTS);
  const [supplierCredits, setSupplierCredits] = useState<SupplierCreditBalance[]>([]);
  const [hostingDomains, setHostingDomains] = useState<HostingDomainRecord[]>(INITIAL_HOSTING_DOMAINS);
  const [regulatoryTramites, setRegulatoryTramites] = useState<RegulatoryTramite[]>(INITIAL_REGULATORY_TRAMITES);

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const pathname = usePathname();

  // A server rejection is final; never bypass validation or permissions.
  const syncToFirestore = async (collectionName: string, id: string, data: any) => {
    const cleanData = JSON.parse(JSON.stringify(data, (_key, value) => value === undefined ? null : value));
    const response = await api<{ result: Record<string, unknown> }>("/api/data", {
      action: "save", entity: collectionName === "users" ? "systemUsers" : collectionName,
      id, data: cleanData, ...(typeof data.version === "number" ? { version: data.version } : {}),
    });
    Object.assign(data, response.result);
    if (["vault", "clientVaultItems"].includes(collectionName)) delete data.encryptedPassword;
  };

  const deleteFromFirestore = async (collectionName: string, id: string) => {
    await api("/api/data", {
      action: "delete", entity: collectionName === "users" ? "systemUsers" : collectionName, id,
    });
  };

  // Initial load from LocalStorage cache and Firebase session
  useEffect(() => {
    try {
      // Preserve records that may never have reached the server before refreshing.
      const cached = localStorage.getItem(STORAGE_KEY);
      const recoveryKey = `INNTEL_RECOVERY_${STORAGE_KEY}`;
      if (cached && !localStorage.getItem(recoveryKey)) localStorage.setItem(recoveryKey, cached);
      cachePreserved.current = true;
      // Older cache keys remain available as snapshot recovery sources.

      // Local caches never authorize a session or supply permissions.
      localStorage.removeItem(AUTH_KEY);
      localStorage.removeItem(`${AUTH_KEY}_SIG`);
      localStorage.removeItem(USERS_KEY);

      // 3. Purge legacy demo storage & check saved business state
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const p = JSON.parse(saved);
          if (Array.isArray(p.clients)) setClients(p.clients);
          if (Array.isArray(p.clientServices)) setClientServices(p.clientServices);
          if (Array.isArray(p.plans) && p.plans.length > 0) setPlans(p.plans);
          if (Array.isArray(p.nodes)) setNodes(p.nodes);
          if (Array.isArray(p.ipPools)) setIpPools(p.ipPools);
          if (Array.isArray(p.policies)) setPolicies(p.policies);
          if (Array.isArray(p.vault)) setVault(p.vault);
          if (Array.isArray(p.tickets)) setTickets(p.tickets);
          if (Array.isArray(p.ticketSubjects)) setTicketSubjects(p.ticketSubjects);
          if (Array.isArray(p.expenses)) setExpenses(p.expenses);
          if (Array.isArray(p.monthlyCharges)) setMonthlyCharges(p.monthlyCharges);
          if (Array.isArray(p.clientAdvances)) setClientAdvances(p.clientAdvances);
          if (Array.isArray(p.auditLogs)) setAuditLogs(p.auditLogs);
          if (Array.isArray(p.projects)) setProjects(p.projects);
          if (Array.isArray(p.clientProjects)) setClientProjects(p.clientProjects);
          if (Array.isArray(p.clientQuotes)) setClientQuotes(p.clientQuotes);
          if (Array.isArray(p.clientVaultItems)) setClientVaultItems(p.clientVaultItems);
          if (Array.isArray(p.clientContracts)) setClientContracts(p.clientContracts);
          if (p.arcotelConcession) setArcotelConcession(sanitizeObjectTexts(p.arcotelConcession));
          if (Array.isArray(p.arcotelFiles)) setArcotelFiles(p.arcotelFiles);
          if (Array.isArray(p.clientDocuments)) setClientDocuments(p.clientDocuments);
          if (Array.isArray(p.inventoryProducts)) setInventoryProducts(p.inventoryProducts);
          if (Array.isArray(p.inventoryWarehouses)) setInventoryWarehouses(p.inventoryWarehouses);
          if (Array.isArray(p.inventoryCategories)) setInventoryCategories(p.inventoryCategories);
          if (Array.isArray(p.inventoryBrands)) setInventoryBrands(p.inventoryBrands);
          if (Array.isArray(p.inventoryKardex)) setInventoryKardex(p.inventoryKardex);
          if (Array.isArray(p.inventoryTransfers)) setInventoryTransfers(p.inventoryTransfers);
          if (Array.isArray(p.inventoryAdjustments)) setInventoryAdjustments(p.inventoryAdjustments);
          if (Array.isArray(p.billingInvoices)) setBillingInvoices(p.billingInvoices);
          if (Array.isArray(p.billingQuotes)) setBillingQuotes(p.billingQuotes);
          if (Array.isArray(p.billingCreditNotes)) setBillingCreditNotes(p.billingCreditNotes);
          if (Array.isArray(p.billingWithholdings)) setBillingWithholdings(p.billingWithholdings);
          if (Array.isArray(p.billingRemissionGuides)) setBillingRemissionGuides(p.billingRemissionGuides);
          if (p.sriCompanyConfig && p.sriCompanyConfig.ruc) setSriCompanyConfig(p.sriCompanyConfig);
          if (Array.isArray(p.suppliers)) setSuppliers(p.suppliers);
          if (Array.isArray(p.purchaseInvoices)) setPurchaseInvoices(p.purchaseInvoices);
          if (Array.isArray(p.supplierCreditNotes)) setSupplierCreditNotes(p.supplierCreditNotes);
          if (Array.isArray(p.supplierDebitNotes)) setSupplierDebitNotes(p.supplierDebitNotes);
          if (Array.isArray(p.purchaseWithholdings)) setPurchaseWithholdings(p.purchaseWithholdings);
          if (Array.isArray(p.bankAccounts)) {
            setBankAccounts(p.bankAccounts.length > 0 ? p.bankAccounts : INITIAL_BANK_ACCOUNTS);
          }
          if (Array.isArray(p.financialMovements)) setFinancialMovements(p.financialMovements);
          if (Array.isArray(p.supplierPayments)) setSupplierPayments(p.supplierPayments);
          if (Array.isArray(p.hostingDomains)) setHostingDomains(p.hostingDomains);
          if (Array.isArray(p.regulatoryTramites)) setRegulatoryTramites(p.regulatoryTramites);
        } catch (e) {}
      }
    } catch (e) {
      console.warn("Error loading local state:", e);
    } finally {
      setIsAuthLoaded(true);
    }
  }, []);

  // Only Firebase identity plus the server's active profile can authorize access.
  useEffect(() => {
    let generation = 0;
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      const request = ++generation;
      setIsAuthenticated(false);
      setDataReady(false);
      if (!firebaseUser) return;
      try {
        const profile = await api<UserProfile>("/api/session");
        if (request !== generation) return;
        setCurrentUser(profile);
        setIsAuthenticated(true);
      } catch {
        if (request === generation) {
          setIsAuthenticated(false);
          await signOut(auth).catch(() => {});
        }
      }
    });
    return () => { generation++; unsubscribe(); };
  }, []);

  // Escucha central de Detonación de Ciberseguridad (Escudo Anti-Hacking)
  useEffect(() => {
    const handleLockdown = (e: Event) => {
      const customEvent = e as CustomEvent;
      const reason = customEvent.detail?.reason || "Alerta Crítica de Ciberseguridad";
      setIsAuthenticated(false);
      try {
        localStorage.removeItem(AUTH_KEY);
        localStorage.removeItem(`${AUTH_KEY}_SIG`);
      } catch (err) {}
      addAuditLog("SECURITY_ALERT", "ESCUDO DE CIBERSEGURIDAD", reason);
    };

    window.addEventListener("inntel:security-lockdown", handleLockdown);
    return () => window.removeEventListener("inntel:security-lockdown", handleLockdown);
  }, []);

  // Sync to LocalStorage on every state update
  useEffect(() => {
    if (!isAuthLoaded || !isAuthenticated || !dataReady || !cachePreserved.current) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          clients,
          clientServices,
          plans,
          nodes,
          ipPools,
          policies,
          vault,
          tickets,
          ticketSubjects,
          expenses,
          monthlyCharges,
          clientAdvances,
          auditLogs,
          projects,
          clientProjects,
          clientQuotes,
          clientVaultItems,
          clientContracts,
          arcotelConcession,
          arcotelFiles,
          clientDocuments,
          inventoryProducts,
          inventoryWarehouses,
          inventoryCategories,
          inventoryBrands,
          inventoryKardex,
          inventoryTransfers,
          inventoryAdjustments,
          billingInvoices,
          billingQuotes,
          billingCreditNotes,
          billingWithholdings,
          billingRemissionGuides,
          sriCompanyConfig,
          suppliers,
          purchaseInvoices,
          supplierCreditNotes,
          supplierDebitNotes,
          purchaseWithholdings,
          bankAccounts,
          financialMovements,
          supplierPayments,
          hostingDomains,
          regulatoryTramites,
        })
      );
      localStorage.setItem(USERS_KEY, JSON.stringify(systemUsers));
    } catch (e) {}
  }, [
    clients,
    clientServices,
    plans,
    nodes,
    ipPools,
    policies,
    vault,
    tickets,
    ticketSubjects,
    expenses,
    monthlyCharges,
    clientAdvances,
    auditLogs,
    projects,
    clientProjects,
    clientQuotes,
    clientVaultItems,
    clientContracts,
    arcotelConcession,
    arcotelFiles,
    clientDocuments,
    inventoryProducts,
    inventoryWarehouses,
    inventoryCategories,
    inventoryBrands,
    inventoryKardex,
    inventoryTransfers,
    inventoryAdjustments,
    billingInvoices,
    billingQuotes,
    billingCreditNotes,
    billingWithholdings,
    billingRemissionGuides,
    sriCompanyConfig,
    suppliers,
    purchaseInvoices,
    supplierCreditNotes,
    supplierDebitNotes,
    purchaseWithholdings,
    bankAccounts,
    financialMovements,
    supplierPayments,
    hostingDomains,
    regulatoryTramites,
    systemUsers,
    isAuthLoaded,
  ]);

  const addAuditLog = (action: AuditLog["action"], resource: string, details: string) => {
    const newLog: AuditLog = {
      id: "log-" + Date.now(),
      userId: currentUser.uid || "system",
      userEmail: currentUser.email || "admin@inntelcorp.com",
      userRole: currentUser.role || "superadmin",
      action,
      resource,
      details,
      timestamp: new Date().toISOString(),
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  const login = async (email: string, password: string, remember: boolean = true): Promise<boolean> => {
    setIsAuthenticated(false);
    try {
      const { setPersistence, browserLocalPersistence, browserSessionPersistence } = await import("firebase/auth");
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
      await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      const profile = await api<UserProfile>("/api/session");
      setCurrentUser(profile);
      setIsAuthenticated(true);
      return true;
    } catch {
      await signOut(auth).catch(() => {});
      setIsAuthenticated(false);
      return false;
    }
  };

  const logout = async () => {
    setIsAuthenticated(false);
    try {
      if (auth) await signOut(auth);
    } catch (e) {}
    try {
      localStorage.removeItem(AUTH_KEY);
      localStorage.removeItem(`${AUTH_KEY}_SIG`);
    } catch (e) {}
    addAuditLog("LOGOUT", `Cierre de Sesión: ${currentUser.displayName}`, `Rol: ${currentUser.role}`);
  };

  const refresh = useCallback(async () => {
    const collectionsToSync: { name: string; setter: (data: any[]) => void; initialData?: any[] }[] = [
      { name: "clients", setter: setClients, initialData: INITIAL_CLIENTS },
      { name: "clientServices", setter: setClientServices, initialData: INITIAL_CLIENT_SERVICES },
      { name: "plans", setter: setPlans, initialData: INITIAL_PLANS },
      { name: "nodes", setter: setNodes, initialData: INITIAL_NODES },
      { name: "ipPools", setter: setIpPools, initialData: INITIAL_IP_POOLS },
      { name: "policies", setter: setPolicies, initialData: INITIAL_POLICIES },
      { name: "vault", setter: setVault, initialData: INITIAL_VAULT },
      { name: "tickets", setter: setTickets, initialData: INITIAL_TICKETS },
      { name: "ticketSubjects", setter: setTicketSubjects, initialData: [] },
      { name: "expenses", setter: setExpenses, initialData: INITIAL_EXPENSES },
      { name: "monthlyCharges", setter: setMonthlyCharges, initialData: INITIAL_MONTHLY_CHARGES },
      { name: "clientAdvances", setter: setClientAdvances, initialData: [] },
      { name: "projects", setter: setProjects, initialData: INITIAL_PROJECTS },
      { name: "clientProjects", setter: setClientProjects, initialData: INITIAL_PROJECT_TASKS },
      { name: "clientQuotes", setter: setClientQuotes, initialData: INITIAL_QUOTES },
      { name: "clientVaultItems", setter: setClientVaultItems, initialData: INITIAL_CLIENT_VAULT },
      { name: "clientContracts", setter: setClientContracts, initialData: INITIAL_CONTRACTS },
      { name: "users", setter: setSystemUsers, initialData: INITIAL_SYSTEM_USERS },
      { name: "auditLogs", setter: setAuditLogs, initialData: INITIAL_AUDIT_LOGS },
      { name: "inventoryProducts", setter: setInventoryProducts, initialData: INITIAL_PRODUCTS },
      { name: "inventoryWarehouses", setter: setInventoryWarehouses, initialData: INITIAL_WAREHOUSES },
      { name: "inventoryCategories", setter: setInventoryCategories, initialData: INITIAL_CATEGORIES },
      { name: "inventoryBrands", setter: setInventoryBrands, initialData: INITIAL_BRANDS },
      { name: "inventoryKardex", setter: setInventoryKardex, initialData: INITIAL_KARDEX },
      { name: "inventoryTransfers", setter: setInventoryTransfers, initialData: INITIAL_TRANSFERS },
      { name: "inventoryAdjustments", setter: setInventoryAdjustments, initialData: INITIAL_ADJUSTMENTS },
      { name: "billingInvoices", setter: setBillingInvoices, initialData: INITIAL_INVOICES },
      { name: "billingQuotes", setter: setBillingQuotes, initialData: INITIAL_BILLING_QUOTES },
      { name: "billingCreditNotes", setter: setBillingCreditNotes, initialData: INITIAL_CREDIT_NOTES },
      { name: "billingDebitNotes", setter: setBillingDebitNotes, initialData: [] },
      { name: "billingWithholdings", setter: setBillingWithholdings, initialData: INITIAL_WITHHOLDINGS },
      { name: "billingRemissionGuides", setter: setBillingRemissionGuides, initialData: INITIAL_REMISSION_GUIDES },
      // Compras, Proveedores & Finanzas (P0-09)
      { name: "suppliers", setter: setSuppliers, initialData: INITIAL_SUPPLIERS },
      { name: "purchaseInvoices", setter: setPurchaseInvoices, initialData: INITIAL_PURCHASE_INVOICES },
      { name: "supplierCreditNotes", setter: setSupplierCreditNotes, initialData: INITIAL_SUPPLIER_CREDIT_NOTES },
      { name: "supplierDebitNotes", setter: setSupplierDebitNotes, initialData: INITIAL_SUPPLIER_DEBIT_NOTES },
      { name: "purchaseWithholdings", setter: setPurchaseWithholdings, initialData: INITIAL_PURCHASE_WITHHOLDINGS },
      { name: "bankAccounts", setter: setBankAccounts, initialData: INITIAL_BANK_ACCOUNTS },
      { name: "financialMovements", setter: setFinancialMovements, initialData: INITIAL_FINANCIAL_MOVEMENTS },
      { name: "supplierPayments", setter: setSupplierPayments, initialData: INITIAL_SUPPLIER_PAYMENTS },
      { name: "supplierCredits", setter: setSupplierCredits, initialData: [] },
      { name: "hostingDomains", setter: setHostingDomains, initialData: INITIAL_HOSTING_DOMAINS },
      { name: "regulatoryTramites", setter: setRegulatoryTramites, initialData: INITIAL_REGULATORY_TRAMITES },
    ];

    const serverSnapshot = await api<Record<string, any>>("/api/data");
    collectionsToSync.forEach((col) => {
      const entityKey = col.name === "users" ? "systemUsers" : col.name;
      if (!Array.isArray(serverSnapshot[entityKey])) throw new Error(`Falta la colección ${entityKey} en la respuesta del servidor.`);
      col.setter(serverSnapshot[entityKey]);
    });
    if (serverSnapshot.sriCompanyConfig?.[0]) setSriCompanyConfig(serverSnapshot.sriCompanyConfig[0]);
    const concession = serverSnapshot.systemConfig?.find((row: any) => row.id === "arcotelConcession");
    if (concession) setArcotelConcession(concession);
    setLoadError("");
    setDataReady(true);
  }, [currentUser]);

  const runCommercial = async <T,>(action: string, data: Record<string, unknown>, refreshAfter = true): Promise<T> => {
    const payload = JSON.parse(JSON.stringify(data));
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify({ action, data: payload }))))).map(b => b.toString(16).padStart(2, "0")).join("");
    const key = `INNTEL_PENDING_${currentUser.uid}_${hash}`;
    let operationId = sessionStorage.getItem(key);
    if (!operationId) { operationId = crypto.randomUUID(); sessionStorage.setItem(key, operationId); }
    const response = await api<{ result: T }>("/api/commercial", { action, operationId, data: payload });
    if (refreshAfter) await refresh();
    sessionStorage.removeItem(key);
    return response.result;
  };

  const startBillingRun = (units: Record<string, unknown>[]) => runCommercial<{ id: string; units: { index: number; status: string }[] }>("startRun", { units }, false);
  const processBillingRun = (id: string, index: number) => runCommercial<{ status: string; error?: string }>("processRun", { id, index }, false);

  useEffect(() => {
    if (!isAuthenticated) return;
    const reload = () => {
      void refresh().catch((error: Error) => {
        setLoadError(error.message || "No se pudieron cargar los datos persistidos.");
      });
    };
    reload();
    window.addEventListener("online", reload);
    return () => window.removeEventListener("online", reload);
  }, [isAuthenticated, refresh]);

  const saveRecord = async (entity: Entity, data: Record<string, unknown>, id?: string) => {
    const targetId = id || (data.id ? String(data.id) : `${entity.slice(0, 4)}-${Date.now()}`);
    const recordWithId = { ...data, id: targetId };
    await syncToFirestore(entity, targetId, recordWithId);

    switch (entity) {
      case "plans":
        setPlans((prev) => {
          const exists = prev.some((p) => p.id === targetId);
          return exists ? prev.map((p) => (p.id === targetId ? ({ ...p, ...recordWithId } as Plan) : p)) : [...prev, recordWithId as Plan];
        });
        break;
      case "ipPools":
        setIpPools((prev) => {
          const exists = prev.some((p) => p.id === targetId);
          return exists ? prev.map((p) => (p.id === targetId ? ({ ...p, ...recordWithId } as IpPool) : p)) : [...prev, recordWithId as IpPool];
        });
        break;
      case "clientServices":
        setClientServices((prev) => {
          const exists = prev.some((s) => s.id === targetId);
          return exists ? prev.map((s) => (s.id === targetId ? ({ ...s, ...recordWithId } as ClientService) : s)) : [...prev, recordWithId as ClientService];
        });
        break;
      case "nodes":
        setNodes((prev) => {
          const exists = prev.some((n) => n.id === targetId);
          return exists ? prev.map((n) => (n.id === targetId ? ({ ...n, ...recordWithId } as NodeLocation) : n)) : [...prev, recordWithId as NodeLocation];
        });
        break;
      case "policies":
        setPolicies((prev) => {
          const exists = prev.some((p) => p.id === targetId);
          return exists ? prev.map((p) => (p.id === targetId ? ({ ...p, ...recordWithId } as ArcotelPolicy) : p)) : [...prev, recordWithId as ArcotelPolicy];
        });
        break;
      case "tickets":
        setTickets((prev) => {
          const exists = prev.some((t) => t.id === targetId);
          return exists ? prev.map((t) => (t.id === targetId ? ({ ...t, ...recordWithId } as Ticket) : t)) : [...prev, recordWithId as Ticket];
        });
        break;
      case "expenses":
        setExpenses((prev) => {
          const exists = prev.some((e) => e.id === targetId);
          return exists ? prev.map((e) => (e.id === targetId ? ({ ...e, ...recordWithId } as Expense) : e)) : [...prev, recordWithId as Expense];
        });
        break;
      case "monthlyCharges":
        setMonthlyCharges((prev) => {
          const exists = prev.some((c) => c.id === targetId);
          return exists ? prev.map((c) => (c.id === targetId ? ({ ...c, ...recordWithId } as MonthlyCharge) : c)) : [...prev, recordWithId as MonthlyCharge];
        });
        break;
      case "clientAdvances":
        setClientAdvances((prev) => {
          const exists = prev.some((a) => a.id === targetId);
          return exists ? prev.map((a) => (a.id === targetId ? ({ ...a, ...recordWithId } as ClientAdvance) : a)) : [...prev, recordWithId as ClientAdvance];
        });
        break;
      case "ticketSubjects":
        setTicketSubjects((prev) => {
          const exists = prev.some((s) => s.id === targetId);
          return exists ? prev.map((s) => (s.id === targetId ? ({ ...s, ...recordWithId } as TicketSubject) : s)) : [...prev, recordWithId as TicketSubject];
        });
        break;
      case "vault":
        setVault((prev) => {
          const exists = prev.some((v) => v.id === targetId);
          return exists ? prev.map((v) => (v.id === targetId ? ({ ...v, ...recordWithId } as VaultCredential) : v)) : [...prev, recordWithId as VaultCredential];
        });
        break;
      case "clientVaultItems":
        setClientVaultItems((prev) => {
          const exists = prev.some((v) => v.id === targetId);
          return exists ? prev.map((v) => (v.id === targetId ? ({ ...v, ...recordWithId } as ClientVaultItem) : v)) : [...prev, recordWithId as ClientVaultItem];
        });
        break;
      case "clientProjects":
        setClientProjects((prev) => {
          const exists = prev.some((p) => p.id === targetId);
          return exists ? prev.map((p) => (p.id === targetId ? ({ ...p, ...recordWithId } as ClientProjectTask) : p)) : [...prev, recordWithId as ClientProjectTask];
        });
        break;
      case "clientQuotes":
        setClientQuotes((prev) => {
          const exists = prev.some((q) => q.id === targetId);
          return exists ? prev.map((q) => (q.id === targetId ? ({ ...q, ...recordWithId } as ClientQuoteOrder) : q)) : [...prev, recordWithId as ClientQuoteOrder];
        });
        break;
      case "clientContracts":
        setClientContracts((prev) => {
          const exists = prev.some((c) => c.id === targetId);
          return exists ? prev.map((c) => (c.id === targetId ? ({ ...c, ...recordWithId } as ClientContractInfo) : c)) : [...prev, recordWithId as ClientContractInfo];
        });
        break;
      case "clients":
        setClients((prev) => {
          const exists = prev.some((c) => c.id === targetId);
          return exists ? prev.map((c) => (c.id === targetId ? ({ ...c, ...recordWithId } as Client) : c)) : [...prev, recordWithId as Client];
        });
        break;
      case "inventoryProducts":
        setInventoryProducts((prev) => {
          const exists = prev.some((p) => p.id === targetId);
          return exists ? prev.map((p) => (p.id === targetId ? ({ ...p, ...recordWithId } as InventoryProduct) : p)) : [...prev, recordWithId as InventoryProduct];
        });
        break;
      case "inventoryWarehouses":
        setInventoryWarehouses((prev) => {
          const exists = prev.some((w) => w.id === targetId);
          return exists ? prev.map((w) => (w.id === targetId ? ({ ...w, ...recordWithId } as Warehouse) : w)) : [...prev, recordWithId as Warehouse];
        });
        break;
      case "inventoryCategories":
        setInventoryCategories((prev) => {
          const exists = prev.some((c) => c.id === targetId);
          return exists ? prev.map((c) => (c.id === targetId ? ({ ...c, ...recordWithId } as ProductCategory) : c)) : [...prev, recordWithId as ProductCategory];
        });
        break;
      case "inventoryBrands":
        setInventoryBrands((prev) => {
          const exists = prev.some((b) => b.id === targetId);
          return exists ? prev.map((b) => (b.id === targetId ? ({ ...b, ...recordWithId } as ProductBrand) : b)) : [...prev, recordWithId as ProductBrand];
        });
        break;
      case "inventoryKardex":
        setInventoryKardex((prev) => [recordWithId as KardexEntry, ...prev]);
        break;
      case "inventoryTransfers":
        setInventoryTransfers((prev) => [recordWithId as WarehouseTransfer, ...prev]);
        break;
      case "inventoryAdjustments":
        setInventoryAdjustments((prev) => [recordWithId as InventoryAdjustment, ...prev]);
        break;
      case "billingInvoices":
        setBillingInvoices((prev) => {
          const exists = prev.some((i) => i.id === targetId);
          return exists ? prev.map((i) => (i.id === targetId ? ({ ...i, ...recordWithId } as SriInvoice) : i)) : [recordWithId as SriInvoice, ...prev];
        });
        break;
      case "billingQuotes":
        setBillingQuotes((prev) => {
          const exists = prev.some((q) => q.id === targetId);
          return exists ? prev.map((q) => (q.id === targetId ? ({ ...q, ...recordWithId } as ClientQuote) : q)) : [recordWithId as ClientQuote, ...prev];
        });
        break;
      case "billingCreditNotes":
        setBillingCreditNotes((prev) => {
          const exists = prev.some((c) => c.id === targetId);
          return exists ? prev.map((c) => (c.id === targetId ? ({ ...c, ...recordWithId } as CreditNote) : c)) : [recordWithId as CreditNote, ...prev];
        });
        break;
      case "billingDebitNotes":
        setBillingDebitNotes((prev) => {
          const exists = prev.some((d) => d.id === targetId);
          return exists ? prev.map((d) => (d.id === targetId ? ({ ...d, ...recordWithId } as DebitNote) : d)) : [recordWithId as DebitNote, ...prev];
        });
        break;
      case "billingWithholdings":
        setBillingWithholdings((prev) => {
          const exists = prev.some((w) => w.id === targetId);
          return exists ? prev.map((w) => (w.id === targetId ? ({ ...w, ...recordWithId } as WithholdingReceipt) : w)) : [recordWithId as WithholdingReceipt, ...prev];
        });
        break;
      case "billingRemissionGuides":
        setBillingRemissionGuides((prev) => {
          const exists = prev.some((g) => g.id === targetId);
          return exists ? prev.map((g) => (g.id === targetId ? ({ ...g, ...recordWithId } as RemissionGuide) : g)) : [recordWithId as RemissionGuide, ...prev];
        });
        break;
      case "sriCompanyConfig":
        setSriCompanyConfig(recordWithId as unknown as SriCompanyConfig);
        break;
    }

    addAuditLog(id ? "UPDATE_CLIENT" : "CREATE_CLIENT", `Registro ${entity}: ${targetId}`, "Registro actualizado sin incluir datos sensibles en la auditoría.");
  };

  const deleteRecord = async (entity: Entity, id: string) => {
    await deleteFromFirestore(entity, id);
    switch (entity) {
      case "plans": setPlans((prev) => prev.filter((p) => p.id !== id)); break;
      case "ipPools": setIpPools((prev) => prev.filter((p) => p.id !== id)); break;
      case "clientServices": setClientServices((prev) => prev.filter((s) => s.id !== id)); break;
      case "nodes": setNodes((prev) => prev.filter((n) => n.id !== id)); break;
      case "policies": setPolicies((prev) => prev.filter((p) => p.id !== id)); break;
      case "tickets": setTickets((prev) => prev.filter((t) => t.id !== id)); break;
      case "expenses": setExpenses((prev) => prev.filter((e) => e.id !== id)); break;
      case "monthlyCharges": setMonthlyCharges((prev) => prev.filter((c) => c.id !== id)); break;
      case "clientAdvances": setClientAdvances((prev) => prev.filter((a) => a.id !== id)); break;
      case "ticketSubjects": setTicketSubjects((prev) => prev.filter((s) => s.id !== id)); break;
      case "vault": setVault((prev) => prev.filter((v) => v.id !== id)); break;
      case "clientVaultItems": setClientVaultItems((prev) => prev.filter((v) => v.id !== id)); break;
      case "clientProjects": setClientProjects((prev) => prev.filter((p) => p.id !== id)); break;
      case "clientQuotes": setClientQuotes((prev) => prev.filter((q) => q.id !== id)); break;
      case "clientContracts": setClientContracts((prev) => prev.filter((c) => c.id !== id)); break;
      case "clients": setClients((prev) => prev.filter((c) => c.id !== id)); break;
      case "inventoryProducts": setInventoryProducts((prev) => prev.filter((p) => p.id !== id)); break;
      case "inventoryWarehouses": setInventoryWarehouses((prev) => prev.filter((w) => w.id !== id)); break;
      case "inventoryCategories": setInventoryCategories((prev) => prev.filter((c) => c.id !== id)); break;
      case "inventoryBrands": setInventoryBrands((prev) => prev.filter((b) => b.id !== id)); break;
      case "inventoryKardex": setInventoryKardex((prev) => prev.filter((k) => k.id !== id)); break;
      case "inventoryTransfers": setInventoryTransfers((prev) => prev.filter((t) => t.id !== id)); break;
      case "inventoryAdjustments": setInventoryAdjustments((prev) => prev.filter((a) => a.id !== id)); break;
      case "billingInvoices": setBillingInvoices((prev) => prev.filter((i) => i.id !== id)); break;
      case "billingQuotes": setBillingQuotes((prev) => prev.filter((q) => q.id !== id)); break;
      case "billingCreditNotes": setBillingCreditNotes((prev) => prev.filter((c) => c.id !== id)); break;
      case "billingDebitNotes": setBillingDebitNotes((prev) => prev.filter((d) => d.id !== id)); break;
      case "billingWithholdings": setBillingWithholdings((prev) => prev.filter((w) => w.id !== id)); break;
      case "billingRemissionGuides": setBillingRemissionGuides((prev) => prev.filter((g) => g.id !== id)); break;
    }
  };

  const revealCredential = async (entity: "vault" | "clientVaultItems", id: string): Promise<string> => {
    const response = await api<{ result: string }>("/api/data", { action: "reveal", entity, id });
    return response.result;
  };

  // User Management
  const addSystemUser = async (userData: Omit<SystemUser, "uid" | "createdAt">) => {
    await api("/api/users", { action: "create", data: userData });
    await refresh();
  };

  const updateSystemUser = async (uid: string, updates: Partial<SystemUser>) => {
    await api("/api/users", { action: "update", uid, data: updates });
    await refresh();
  };

  const deleteSystemUser = async (uid: string): Promise<boolean> => {
    await api("/api/users", { action: "disable", uid });
    await refresh();
    return true;
  };

  const toggleUserStatus = async (uid: string) => {
    const user = systemUsers.find((u) => u.uid === uid);
    if (!user) return;
    const newStatus = user.status === "activo" ? "inactivo" : "activo";
    await updateSystemUser(uid, { status: newStatus });
  };

  // Projects Management (Notion-style hierarchy)
  const addProject = async (projectData: Omit<Project, "id" | "createdAt" | "updatedAt">): Promise<string> => {
    const newProject: Project = {
      ...projectData,
      id: "proj-" + Date.now(),
      isDeleted: false,
      columns: projectData.columns && projectData.columns.length > 0 ? projectData.columns : DEFAULT_PROJECT_COLUMNS,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await syncToFirestore("projects", newProject.id, newProject);
    setProjects((prev) => [newProject, ...prev]);
    addAuditLog("CREATE_CLIENT", `Nuevo Proyecto: ${newProject.title}`, `Asignado: ${newProject.clientName || newProject.nodeName || "General"}`);
    return newProject.id;
  };

  const updateProject = async (id: string, updates: Partial<Project>) => {
    const updated = { ...updates, updatedAt: new Date().toISOString() };
    await syncToFirestore("projects", id, updated);
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
    addAuditLog("UPDATE_CLIENT", `Proyecto Actualizado: ${id}`, `Estado/Detalles modificados`);
  };

  const deleteProject = async (id: string) => {
    // Soft delete to trash
    const updated = { isDeleted: true, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await syncToFirestore("projects", id, updated);
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
    addAuditLog("UPDATE_CLIENT", `Proyecto Enviado a Papelera: ${id}`, `Papelera`);
  };

  const restoreProject = async (id: string) => {
    // Restore from trash
    const updated = { isDeleted: false, deletedAt: undefined, updatedAt: new Date().toISOString() };
    await syncToFirestore("projects", id, updated);
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
    addAuditLog("CREATE_CLIENT", `Proyecto Restaurado: ${id}`, `Restaurado de papelera`);
  };

  const permanentDeleteProject = async (id: string) => {
    // Hard delete
    await deleteFromFirestore("projects", id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
    // Also remove associated tasks
    setClientProjects((prev) => prev.filter((t) => t.projectId !== id));
    addAuditLog("UPDATE_CLIENT", `Proyecto Eliminado Definitivamente: ${id}`, `Purga definitiva`);
  };

  const updateProjectColumns = async (projectId: string, columns: ProjectCustomColumn[]) => {
    await updateProject(projectId, { columns });
  };

  // Client Project Tasks
  const addClientProjectTask = async (taskData: Omit<ClientProjectTask, "id" | "createdAt" | "updatedAt">): Promise<ClientProjectTask> => {
    const newTask: ClientProjectTask = {
      ...taskData,
      id: "prj-" + Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await syncToFirestore("clientProjects", newTask.id, newTask);
    setClientProjects((prev) => [newTask, ...prev]);
    addAuditLog("CREATE_CLIENT", `Tarea de Proyecto: ${newTask.title}`, `Cliente: ${newTask.clientName || "General"}`);
    return newTask;
  };

  const updateClientProjectTask = async (id: string, updates: Partial<ClientProjectTask>) => {
    const updated = { ...updates, updatedAt: new Date().toISOString() };
    await syncToFirestore("clientProjects", id, updated);
    setClientProjects((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updated } : t))
    );
  };

  const moveProjectTaskColumn = async (id: string, newColumn: ProjectKanbanColumn | string) => {
    await updateClientProjectTask(id, { column: newColumn });
  };

  const addProjectTaskNote = async (taskId: string, content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    const newNote: ProjectNoteItem = {
      id: "nt-" + Date.now(),
      authorName: currentUser.displayName || "Usuario",
      authorRole: currentUser.role ? currentUser.role.toUpperCase() : "STAFF",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    const targetTask = clientProjects.find((t) => t.id === taskId);
    const updatedThread = [newNote, ...(targetTask?.notesThread || [])];
    await updateClientProjectTask(taskId, { notesThread: updatedThread });
    addAuditLog("CREATE_CLIENT", `Nota en Proyecto: ${targetTask?.title || taskId}`, `Autor: ${currentUser.displayName}`);
  };

  const deleteClientProjectTask = async (id: string) => {
    await deleteFromFirestore("clientProjects", id);
    setClientProjects((prev) => prev.filter((t) => t.id !== id));
  };

  // Client Quotes & Orders
  const addClientQuote = async (quoteData: Omit<ClientQuoteOrder, "id" | "createdAt">) => {
    const newQuote: ClientQuoteOrder = {
      ...quoteData,
      id: "qto-" + Date.now(),
      createdAt: new Date().toISOString(),
    };
    await syncToFirestore("clientQuotes", newQuote.id, newQuote);
    setClientQuotes((prev) => [newQuote, ...prev]);
    addAuditLog("EXPORT_BILLING", `Cotización / Orden: ${newQuote.quoteNumber}`, `Monto: $${newQuote.total.toFixed(2)}`);
  };

  const updateClientQuoteStatus = async (id: string, status: ClientQuoteOrder["status"]) => {
    await syncToFirestore("clientQuotes", id, { status });
    setClientQuotes((prev) =>
      prev.map((q) => (q.id === id ? { ...q, status } : q))
    );
  };

  const deleteClientQuote = async (id: string) => {
    await deleteFromFirestore("clientQuotes", id);
    setClientQuotes((prev) => prev.filter((q) => q.id !== id));
  };

  // Client Vault
  const addClientVaultItem = async (itemData: Omit<ClientVaultItem, "id" | "updatedAt">) => {
    const newItem: ClientVaultItem = {
      ...itemData,
      id: "clv-" + Date.now(),
      updatedAt: new Date().toISOString(),
    };
    await syncToFirestore("clientVaultItems", newItem.id, newItem);
    setClientVaultItems((prev) => [newItem, ...prev]);
    addAuditLog("UPDATE_VAULT", `Clave Cliente: ${newItem.serviceName}`, `Categoría: ${newItem.category}`);
  };

  const updateClientVaultItem = async (id: string, updates: Partial<ClientVaultItem>) => {
    const updated = { ...updates, updatedAt: new Date().toISOString() };
    await syncToFirestore("clientVaultItems", id, updated);
    setClientVaultItems((prev) =>
      prev.map((v) => (v.id === id ? { ...v, ...updated } : v))
    );
  };

  const deleteClientVaultItem = async (id: string) => {
    await deleteFromFirestore("clientVaultItems", id);
    setClientVaultItems((prev) => prev.filter((v) => v.id !== id));
  };

  // Client Contracts
  const addClientContract = async (contractData: Omit<ClientContractInfo, "id">) => {
    const newContract: ClientContractInfo = {
      ...contractData,
      id: "cnt-" + Date.now(),
    };
    await syncToFirestore("clientContracts", newContract.id, newContract);
    setClientContracts((prev) => [newContract, ...prev]);
    addAuditLog("GENERATE_DOC", `Contrato ARCOTEL: ${newContract.contractNumber}`, `Homologación: ${newContract.arcotelHomologationCode}`);
  };

  const updateClientContract = async (id: string, updates: Partial<ClientContractInfo>) => {
    await syncToFirestore("clientContracts", id, updates);
    setClientContracts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  };

  // Asuntos de Tickets configurables
  const addTicketSubject = async (subject: Omit<TicketSubject, "id">) => {
    const newSubject: TicketSubject = { ...subject, id: "tsub-" + Date.now() };
    await syncToFirestore("ticketSubjects", newSubject.id, newSubject);
    setTicketSubjects((prev) => [...prev, newSubject]);
  };

  const updateTicketSubject = async (id: string, updates: Partial<TicketSubject>) => {
    await syncToFirestore("ticketSubjects", id, updates);
    setTicketSubjects((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const deleteTicketSubject = async (id: string) => {
    await deleteFromFirestore("ticketSubjects", id);
    setTicketSubjects((prev) => prev.filter((s) => s.id !== id));
  };

  // Hosting & Dominios
  const addHostingDomain = async (item: Omit<HostingDomainRecord, "id">) => {
    const newRecord: HostingDomainRecord = {
      ...item,
      id: "host-" + Date.now(),
    };
    await syncToFirestore("hostingDomains", newRecord.id, newRecord);
    setHostingDomains((prev) => [newRecord, ...prev]);
    addAuditLog("CREATE_CLIENT", `Servicio Web Registrado: ${newRecord.domainOrService}`, `Cliente: ${newRecord.clientName}`);
  };

  const updateHostingDomain = async (id: string, updates: Partial<HostingDomainRecord>) => {
    await syncToFirestore("hostingDomains", id, updates);
    setHostingDomains((prev) =>
      prev.map((h) => (h.id === id ? { ...h, ...updates } : h))
    );
  };

  const deleteHostingDomain = async (id: string) => {
    await deleteFromFirestore("hostingDomains", id);
    setHostingDomains((prev) => prev.filter((h) => h.id !== id));
  };

  // Trámites Regulatorios
  const addRegulatoryTramite = async (item: Omit<RegulatoryTramite, "id" | "createdAt" | "updatedAt">): Promise<RegulatoryTramite> => {
    const now = new Date().toISOString();
    const newTramite: RegulatoryTramite = {
      ...item,
      id: "trm-" + Date.now(),
      createdAt: now,
      updatedAt: now,
      history: item.history || [
        { date: now.split("T")[0], status: item.dynamicStatus, note: "Trámite registrado en la plataforma", author: currentUser.displayName }
      ],
    };
    await syncToFirestore("regulatoryTramites", newTramite.id, newTramite);
    setRegulatoryTramites((prev) => [newTramite, ...prev]);
    addAuditLog("GENERATE_DOC", `Trámite Institucional: ${newTramite.documentNumber}`, `Motivo: ${newTramite.reason}`);
    return newTramite;
  };

  const updateRegulatoryTramite = async (id: string, updates: Partial<RegulatoryTramite>) => {
    const now = new Date().toISOString();
    await syncToFirestore("regulatoryTramites", id, { ...updates, updatedAt: now });
    setRegulatoryTramites((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates, updatedAt: now } : t))
    );
  };

  const deleteRegulatoryTramite = async (id: string) => {
    await deleteFromFirestore("regulatoryTramites", id);
    setRegulatoryTramites((prev) => prev.filter((t) => t.id !== id));
  };

  // Client Core Operations
  const addClient = async (
    clientData: Omit<Client, "id" | "createdAt" | "updatedAt">, serviceData?: Partial<ClientService>
  ): Promise<Client> => runCommercial<Client>("createClient", { client: { ...clientData,
    identificationNumber: clientData.identificationNumber.replace(/\s+/g, "").trim(),
    email: clientData.email.trim().toLowerCase(), businessName: clientData.businessName.trim()
  }, ...(serviceData ? { service: serviceData } : {}) });

  const updateClient = async (id: string, updates: Partial<Client>) => {
    const sanitizedUpdates: Partial<Client> = { ...updates };
    if (sanitizedUpdates.identificationNumber !== undefined) {
      sanitizedUpdates.identificationNumber = String(sanitizedUpdates.identificationNumber)
        .replace(/\s+/g, "")
        .trim();
    }
    if (sanitizedUpdates.email !== undefined) {
      sanitizedUpdates.email = String(sanitizedUpdates.email)
        .replace(/\s+/g, "")
        .trim()
        .toLowerCase();
    }
    const updated = { ...sanitizedUpdates, updatedAt: new Date().toISOString() };
    await syncToFirestore("clients", id, updated);
    setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...updated } : c)));
    addAuditLog("UPDATE_CLIENT", `Cliente ID: ${id}`, JSON.stringify(sanitizedUpdates));
  };

  const deleteClient = async (id: string) => {
    await runCommercial("retireClient", { id });
  };

  const addClientService = async (serviceData: Omit<ClientService, "id">): Promise<ClientService> =>
    runCommercial<ClientService>("assignService", serviceData);

  const updateClientService = async (id: string, updates: Partial<ClientService>) => {
    await runCommercial("editService", { id, ...updates });
  };

  const deleteClientService = async (id: string) => {
    await runCommercial("retireService", { id });
  };

  const renewClientService = async (id: string) => {
    const target = clientServices.find((s) => s.id === id);
    if (!target) return;

    const baseDate = target.nextRenewalDate || getEcuadorDate();
    let monthsToAdd = 1;
    if (target.billingFrequency === "anual") monthsToAdd = 12;
    else if (target.billingFrequency === "semestral") monthsToAdd = 6;
    else if (target.billingFrequency === "trimestral") monthsToAdd = 3;

    const nextRenewalDate = addMonthsSafely(baseDate, monthsToAdd);

    // Si el contrato tenía fecha de fin y ya venció o se renueva el contrato completo:
    let newContractEndDate = target.contractEndDate;
    if (target.contractEndDate && target.contractEndDate <= getEcuadorDate() && target.contractDuration && target.contractDuration !== "indefinido") {
      newContractEndDate = calculateContractEndDate(getEcuadorDate(), target.contractDuration);
    }

    await updateClientService(id, {
      status: "activo",
      isBillableInCurrentCycle: true,
      nonBillableReason: "",
      nextRenewalDate,
      ...(newContractEndDate ? { contractEndDate: newContractEndDate } : {}),
    });
  };

  const addPolicy = async (policyData: Omit<ArcotelPolicy, "id">) => {
    const newPolicy: ArcotelPolicy = {
      ...policyData,
      id: "pol-" + (policies.length + 1).toString().padStart(3, "0"),
    };
    await syncToFirestore("policies", newPolicy.id, newPolicy);
    setPolicies((prev) => [newPolicy, ...prev]);
    addAuditLog("GENERATE_DOC", `Póliza ARCOTEL: ${newPolicy.policyNumber}`, `$${newPolicy.insuredAmount}`);
  };

  const deletePolicy = async (id: string) => {
    await deleteFromFirestore("policies", id);
    setPolicies((prev) => prev.filter((p) => p.id !== id));
  };

  const updatePolicy = async (id: string, updates: Partial<ArcotelPolicy>) => {
    await syncToFirestore("policies", id, updates);
    setPolicies((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  };

  const addVaultCredential = async (cred: Omit<VaultCredential, "id" | "updatedAt">) => {
    const newCred: VaultCredential = {
      ...cred,
      id: "vlt-" + Date.now(),
      updatedAt: new Date().toISOString(),
    };
    await syncToFirestore("vault", newCred.id, newCred);
    setVault((prev) => [newCred, ...prev]);
    addAuditLog("UPDATE_VAULT", `Credencial: ${newCred.serviceName}`, `Usuario: ${newCred.username}`);
  };

  const updateVaultCredential = async (id: string, updates: Partial<VaultCredential>) => {
    const updated = { ...updates, updatedAt: new Date().toISOString() };
    await syncToFirestore("vault", id, updated);
    setVault((prev) => prev.map((v) => (v.id === id ? { ...v, ...updated } : v)));
  };

  const logVaultAccess = async (credentialId: string, serviceName: string) => {
    const updated = { lastAccessedAt: new Date().toISOString() };
    await syncToFirestore("vault", credentialId, updated);
    setVault((prev) => prev.map((v) => (v.id === credentialId ? { ...v, ...updated } : v)));
    addAuditLog("VIEW_VAULT_PASSWORD", `Bóveda: ${serviceName}`, `Consulta por ${currentUser.role}`);
  };

  const addNode = async (nodeData: Omit<NodeLocation, "id">) => {
    const newNode: NodeLocation = { ...nodeData, id: "nodo-" + crypto.randomUUID() };
    await syncToFirestore("nodes", newNode.id, newNode);
    setNodes((prev) => [...prev, newNode]);
    addAuditLog("CREATE_CLIENT", `Nodo Creado: ${newNode.name}`, `Cliente: ${newNode.clientName || newNode.clientId || "N/A"} | Ubicación: ${newNode.canton || ""}, ${newNode.province || ""}`);
  };

  const updateNode = async (id: string, updates: Partial<NodeLocation>) => {
    await syncToFirestore("nodes", id, updates);
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, ...updates } : n)));
  };

  const deleteNode = async (id: string) => {
    await deleteFromFirestore("nodes", id);
    setNodes((prev) => prev.filter((n) => n.id !== id));
  };

  const updateArcotelConcession = async (updates: Partial<ArcotelConcessionInfo>) => {
    await syncToFirestore("systemConfig", "arcotelConcession", { ...arcotelConcession, ...updates });
    setArcotelConcession((prev) => sanitizeObjectTexts({ ...prev, ...updates }));
  };

  const addArcotelFile = async (fileData: Omit<ArcotelPeriodicFile, "id" | "uploadedAt">) => {
    const newFile: ArcotelPeriodicFile = {
      ...fileData,
      id: "arc-" + Date.now(),
      uploadedAt: new Date().toISOString(),
    };
    await syncToFirestore("arcotelFiles", newFile.id, newFile);
    setArcotelFiles((prev) => [newFile, ...prev]);
    addAuditLog("GENERATE_DOC", `Archivo Regulatorio ARCOTEL: ${newFile.fileName}`, `Sub-sistema: ${newFile.subsystem}`);
  };

  const deleteArcotelFile = async (id: string) => {
    await deleteFromFirestore("arcotelFiles", id);
    setArcotelFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const addClientDocument = async (docData: Omit<ClientDocumentFile, "id" | "uploadedAt">) => {
    const newDoc: ClientDocumentFile = {
      ...docData,
      id: "cdoc-" + Date.now(),
      uploadedAt: new Date().toISOString(),
    };
    await syncToFirestore("clientDocuments", newDoc.id, newDoc);
    setClientDocuments((prev) => [newDoc, ...prev]);
  };

  const updateClientDocument = async (id: string, updates: Partial<ClientDocumentFile>) => {
    setClientDocuments((prev) =>
      prev.map((doc) => {
        if (doc.id !== id) return doc;
        const updated = { ...doc, ...updates };
        syncToFirestore("clientDocuments", updated.id, updated);
        return updated;
      })
    );
  };

  const deleteClientDocument = async (id: string) => {
    await deleteFromFirestore("clientDocuments", id);
    setClientDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  const addTicket = async (ticketData: Omit<Ticket, "id" | "ticketNumber" | "createdAt">) => {
    const newTicket: Ticket = {
      ...ticketData,
      id: "tck-" + Date.now(),
      ticketNumber: "TCK-" + (1080 + tickets.length + 1),
      createdAt: new Date().toISOString(),
    };
    await syncToFirestore("tickets", newTicket.id, newTicket);
    setTickets((prev) => [newTicket, ...prev]);
  };

  const replyToTicket = async (
    id: string,
    body: string,
    isInternal: boolean = false,
    newStatus?: TicketStatus
  ) => {
    if (!auth.currentUser || !can(currentUser, "manage_tickets")) {
      throw new Error("No tienes permiso para responder tickets.");
    }
    const text = body.trim();
    if (!text || text.length > 5000) {
      throw new Error("La respuesta debe tener entre 1 y 5000 caracteres.");
    }
    if (!tickets.some((t) => t.id === id)) {
      throw new Error("Ticket no encontrado.");
    }

    const message: TicketMessage = {
      id: crypto.randomUUID(),
      body: text,
      authorId: auth.currentUser.uid,
      authorName: currentUser.displayName,
      authorRole:
        currentUser.role === "admin" || currentUser.role === "superadmin"
          ? "admin"
          : currentUser.role === "tecnico"
          ? "tecnico"
          : "staff",
      createdAt: new Date().toISOString(),
      isInternal: !!isInternal,
    };

    const targetTicket = tickets.find((t) => t.id === id);
    const updatedStatus =
      newStatus || (isInternal ? targetTicket?.status || "en_progreso" : "respondido");

    const updates: Partial<Ticket> = {
      status: updatedStatus,
      updatedAt: new Date().toISOString(),
      lastReplyAt: new Date().toISOString(),
      lastReplier: currentUser.displayName,
    };

    if (updatedStatus === "resuelto" || updatedStatus === "cerrado") {
      updates.resolvedAt = new Date().toISOString();
    }

    await api("/api/tickets/reply", { id, messageId: message.id, body: text, isInternal: !!isInternal, status: updatedStatus });

    setTickets((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              ...updates,
              messages: [...(t.messages || []).filter((m) => m.id !== message.id), message],
            }
          : t
      )
    );
  };

  const updateTicketDetails = async (id: string, updates: Partial<Ticket>) => {
    const cleanUpdates: Partial<Ticket> = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    if (updates.status === "resuelto" || updates.status === "cerrado") {
      cleanUpdates.resolvedAt = new Date().toISOString();
    }
    await syncToFirestore("tickets", id, cleanUpdates);
    setTickets((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...cleanUpdates } : t))
    );
  };

  const updateTicketStatus = async (id: string, status: Ticket["status"], notes?: string) => {
    const updated = {
      status,
      resolvedAt: status === "resuelto" || status === "cerrado" ? new Date().toISOString() : undefined,
      resolutionNotes: notes,
      updatedAt: new Date().toISOString(),
    };
    await syncToFirestore("tickets", id, updated);
    setTickets((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, ...updated, resolutionNotes: notes || t.resolutionNotes }
          : t
      )
    );
  };

  const addExpense = async (expenseData: Omit<Expense, "id">) => {
    await runCommercial("expense", expenseData);
  };

  const generateMonthlyBillingBatch = async (month: number, year: number) => {
    throw new Error("La emisión de " + month + "/" + year + " requiere revisar y seleccionar los servicios en Ventas recurrentes.");
  };

  const addMonthlyCharge = async (chargeData: Omit<MonthlyCharge, "id">) => {
    await runCommercial("manualCharge", chargeData);
  };

  const addPaymentToCharge = async (
    chargeId: string,
    payment: { amount: number; method: string; reference?: string; bankAccountId?: string; advanceId?: string; notes?: string; date?: string }
  ) => {
    await runCommercial(payment.advanceId ? "applyAdvance" : "payCharge", { chargeId, ...payment });
  };

  const markChargeAsPaid = async (
    chargeId: string,
    method: string,
    reference?: string,
    paidAmount?: number,
    remainingBalance?: number,
    bankAccountId?: string
  ) => {
    const charge = monthlyCharges.find((c) => c.id === chargeId);
    if (!charge) return;
    const paymentAmount =
      paidAmount !== undefined
        ? paidAmount
        : (charge.balanceRemaining !== undefined ? charge.balanceRemaining : Math.max(0, charge.total - (charge.paidAmount || 0)));

    await addPaymentToCharge(chargeId, {
      amount: paymentAmount,
      method,
      reference,
      bankAccountId,
    });
  };

  const updateMonthlyCharge = async (id: string, updates: Partial<MonthlyCharge>) => {
    await syncToFirestore("monthlyCharges", id, updates);
    setMonthlyCharges((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
    addAuditLog("UPDATE_CLIENT", `Cobro Modificado: ${id}`, "Actualización de datos");
  };

  const deleteMonthlyCharge = async (id: string) => {
    await runCommercial("cancelCharge", { id });
  };

  const reverseChargePayment = async (chargeId: string, paymentId: string) => {
    await runCommercial("reverseApplication", { chargeId, paymentId });
  };

  const addClientAdvance = async (
    advanceData: Omit<ClientAdvance, "id" | "remaining" | "status" | "applications">
  ): Promise<ClientAdvance> => runCommercial<ClientAdvance>("advance", advanceData);

  const applyClientAdvance = async (advanceId: string, chargeId: string, amount: number): Promise<void> => {
    await runCommercial("applyAdvance", { advanceId, chargeId, amount });
  };

  const deleteClientAdvance = async (id: string): Promise<void> => {
    await runCommercial("cancelAdvance", { id });
  };

  // ==========================================
  // INVENTORY MODULE METHODS
  // ==========================================

  const addInventoryProduct = async (productData: Omit<InventoryProduct, "id" | "createdAt" | "updatedAt">): Promise<InventoryProduct> =>
    runCommercial<InventoryProduct>("createProduct", productData);

  const updateInventoryProduct = async (id: string, updates: Partial<InventoryProduct>) => {
    await runCommercial("editProduct", { id, ...updates });
  };

  const deleteInventoryProduct = async (id: string) => {
    await runCommercial("editProduct", { id, status: "inactivo" });
  };

  const addWarehouse = async (warehouseData: Omit<Warehouse, "id" | "createdAt">) => {
    const id = `wh-${Date.now()}`;
    const newWh: Warehouse = {
      ...warehouseData,
      id,
      createdAt: new Date().toISOString(),
    };
    await syncToFirestore("inventoryWarehouses", id, newWh);
    setInventoryWarehouses((prev) => [...prev, newWh]);
    addAuditLog("CREATE_EXPENSE", `Bodega Creada: ${newWh.name}`, `Código: ${newWh.code}`);
  };

  const updateWarehouse = async (id: string, updates: Partial<Warehouse>) => {
    const wh = inventoryWarehouses.find((w) => w.id === id);
    if (!wh) return;
    const merged = { ...wh, ...updates };
    await syncToFirestore("inventoryWarehouses", id, merged);
    setInventoryWarehouses((prev) => prev.map((w) => (w.id === id ? merged : w)));
    addAuditLog("CREATE_EXPENSE", `Bodega Actualizada: ${wh.name}`, `Código: ${wh.code}`);
  };

  const deleteWarehouse = async (id: string) => {
    const wh = inventoryWarehouses.find((w) => w.id === id);
    await deleteFromFirestore("inventoryWarehouses", id);
    setInventoryWarehouses((prev) => prev.filter((w) => w.id !== id));
    if (wh) {
      addAuditLog("CREATE_EXPENSE", `Bodega Eliminada: ${wh.name}`, `Código: ${wh.code}`);
    }
  };

  const addCategory = async (categoryData: Omit<ProductCategory, "id" | "createdAt">) => {
    const id = `cat-${Date.now()}`;
    const newCat: ProductCategory = {
      ...categoryData,
      id,
      createdAt: new Date().toISOString(),
    };
    await syncToFirestore("inventoryCategories", id, newCat);
    setInventoryCategories((prev) => [...prev, newCat]);
  };

  const addBrand = async (brandData: Omit<ProductBrand, "id" | "createdAt">) => {
    const id = `brd-${Date.now()}`;
    const newBrand: ProductBrand = {
      ...brandData,
      id,
      createdAt: new Date().toISOString(),
    };
    await syncToFirestore("inventoryBrands", id, newBrand);
    setInventoryBrands((prev) => [...prev, newBrand]);
  };

  const executeTransfer = async (data: { originWarehouseId: string; destWarehouseId: string; productId: string; quantity: number; reason: string }) => {
    await runCommercial("inventoryTransfer", data);
  };

  const executeAdjustment = async (data: { warehouseId: string; type: "manual_ingreso" | "manual_egreso" | "masivo" | "encerar"; concept: string; items: { productId: string; type: "ingreso" | "egreso"; quantity: number; unitCost: number }[] }) => {
    await runCommercial("inventoryAdjustment", data);
  };

  // ==========================================
  // BILLING & SRI METHODS
  // ==========================================

  const createInvoice = async (
    data: Omit<SriInvoice, "id" | "claveAcceso" | "documentNumber" | "createdAt" | "kardexRegistered"> & {
      customSecuencial?: number;
    }
  ): Promise<SriInvoice> => {
    if (data.documentType === "nota_venta") return runCommercial<SriInvoice>("issueSale", data);
    const now = new Date().toISOString();
    const invoiceId = `inv-${Date.now()}`;
    const dateStr = data.date || now.slice(0, 10);
    const docType: string = String(data.documentType || "factura");
    const isDraft = data.status === "borrador";

    const estab = sriCompanyConfig.establecimiento || "010";
    const pto = sriCompanyConfig.puntoEmision || "001";

    let documentNumber = "";
    let claveAcceso = "";

    if (isDraft) {
      documentNumber = `BORRADOR-${String(Date.now()).slice(-4)}`;
      claveAcceso = "BORRADOR_PENDIENTE";
    } else if (docType === "nota_venta") {
      const startFromNotaVenta = (sriCompanyConfig.secuencialNotaVenta || 1) - 1;
      const maxSecNota = billingInvoices
        .filter((inv) => inv.documentType === "nota_venta" && inv.status !== "borrador")
        .reduce((max, inv) => {
          const parts = (inv.documentNumber || "").split("-");
          const num = parseInt(parts[2] || "0", 10);
          return !isNaN(num) && num > max ? num : max;
        }, 0);
      const secuencial = data.customSecuencial || (Math.max(maxSecNota, startFromNotaVenta) + 1);
      documentNumber = formatearSecuencialSRI(secuencial, estab, pto);
      claveAcceso = "";
    } else {
      const startFromFactura = (sriCompanyConfig.secuencialFactura || 1) - 1;
      const maxSec = billingInvoices
        .filter((inv) => (inv.documentType || "factura") === "factura" && inv.status !== "borrador")
        .reduce((max, inv) => {
          const parts = (inv.documentNumber || "").split("-");
          const num = parseInt(parts[2] || "0", 10);
          return !isNaN(num) && num > max ? num : max;
        }, 0);
      const secuencial = data.customSecuencial || (Math.max(maxSec, startFromFactura) + 1);
      documentNumber = formatearSecuencialSRI(secuencial, estab, pto);

      claveAcceso = generarClaveAccesoSRI({
        fechaEmision: dateStr,
        tipoComprobante: "01",
        ruc: sriCompanyConfig.ruc,
        ambiente: sriCompanyConfig.ambiente,
        establecimiento: estab,
        puntoEmision: pto,
        secuencial,
        codigoNumerico: Math.floor(10000000 + Math.random() * 90000000).toString(),
      });
    }

    const wh = inventoryWarehouses.find((w) => w.id === data.warehouseId) || inventoryWarehouses[0];
    const warehouseId = wh ? wh.id : (data.warehouseId || "wh-central");
    const warehouseName = wh ? wh.name : (data.warehouseName || "Bodega Central");

    const kardexEntries: KardexEntry[] = [];
    const updatedProductsMap = new Map<string, InventoryProduct>();

    if (!isDraft) {
      for (const item of data.items) {
        if (!item.productId) continue;
        const product = updatedProductsMap.get(item.productId) || inventoryProducts.find((p) => p.id === item.productId);
        if (!product || !product.tracksStock) continue;

        const qty = Math.abs(item.quantity);
        const currentWhStock = Number(product.stockByWarehouse?.[warehouseId] || 0);
        if (product.tracksStock && product.type !== "servicio" && currentWhStock < qty) {
          throw new Error(`Stock insuficiente para '${product.name}' en la bodega '${warehouseName}'. Disponible: ${currentWhStock}, Solicitado: ${qty}.`);
        }
        const newWhStock = currentWhStock - qty;

        const kdx = buildKardexEntry({
          product,
          warehouse: wh || { id: warehouseId, name: warehouseName },
          type: "SALE",
          referenceId: invoiceId,
          referenceDocNumber: documentNumber,
          concept: `Venta ${docType === "nota_venta" ? "Nota de Venta" : "Factura"} ${documentNumber} - Cliente: ${data.clientName}`,
          quantity: qty,
          unitCost: product.baseCost,
          currentStock: currentWhStock,
          currentAvgCost: product.baseCost,
          userName: currentUser.displayName,
        });

        kardexEntries.push(kdx);

        const updatedStockByWh = {
          ...(product.stockByWarehouse || {}),
          [warehouseId]: newWhStock,
        };
        const totalStock = Object.values(updatedStockByWh).reduce((acc, val) => acc + (Number(val) || 0), 0);

        const updatedProd: InventoryProduct = {
          ...product,
          stockByWarehouse: updatedStockByWh,
          stock: totalStock,
          updatedAt: now,
        };

        updatedProductsMap.set(product.id, updatedProd);
      }
    }

    const newInvoice: SriInvoice = {
      ...data,
      clientRuc: String(data.clientRuc || "").replace(/\s+/g, "").trim(),
      clientEmail: String(data.clientEmail || "").replace(/\s+/g, "").trim().toLowerCase(),
      clientName: String(data.clientName || "").replace(/\s+/g, " ").trim(),
      documentType: docType as "nota_venta" | "factura",
      id: invoiceId,
      documentNumber: String(documentNumber || "").replace(/\s+/g, "").trim(),
      claveAcceso: String(claveAcceso || "").replace(/\s+/g, "").trim(),
      warehouseId,
      warehouseName,
      kardexRegistered: kardexEntries.length > 0,
      createdAt: now,
    };

    await Promise.all([
      syncToFirestore("billingInvoices", newInvoice.id, newInvoice),
      ...kardexEntries.map((k) => syncToFirestore("inventoryKardex", k.id, k)),
      ...Array.from(updatedProductsMap.values()).map((p) => syncToFirestore("inventoryProducts", p.id, p)),
    ]);

    setBillingInvoices((prev) => [newInvoice, ...prev]);
    if (kardexEntries.length > 0) {
      setInventoryKardex((prev) => [...kardexEntries, ...prev]);
      setInventoryProducts((prev) =>
        prev.map((p) => updatedProductsMap.get(p.id) || p)
      );
    }

    // Sincronización financiera y cuentas por cobrar cuando no es borrador
    if (!isDraft) {
      const breakdown = data.paymentsBreakdown;
      const paidImmediate = breakdown
        ? Math.min(
            data.total,
            (Number(breakdown.efectivo) || 0) +
              (Number(breakdown.transferencia) || 0) +
              (Number(breakdown.tarjeta) || 0)
          )
        : data.paymentMethod !== "credito"
        ? data.total
        : 0;

      const creditPart = breakdown
        ? Number(breakdown.credito) || 0
        : data.paymentMethod === "credito"
        ? data.total
        : 0;

      if (paidImmediate > 0) {
        const targetBank = data.bankAccountId
          ? bankAccounts.find((b) => b.id === data.bankAccountId)
          : undefined;
        if (targetBank) {
          const movId = `mov-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
          const movement: FinancialMovement = {
            id: movId,
            type: "ingreso",
            date: dateStr,
            amount: Math.round(paidImmediate * 100) / 100,
            category: "venta_equipos",
            description: `Cobro ${docType === "nota_venta" ? "Nota de Venta" : "Factura"} ${documentNumber} - ${data.clientName}`,
            bankAccountId: targetBank.id,
            bankAccountName: targetBank.bankName,
            paymentMethod:
              data.paymentMethod === "credito" ? "efectivo" : data.paymentMethod,
            referenceNumber: data.transferenciaRef || data.tarjetaRef || documentNumber,
            relatedEntityId: invoiceId,
            createdAt: now,
          };
          setFinancialMovements((prev) => [movement, ...prev]);
          syncToFirestore("financialMovements", movId, movement);

          const newBal = Math.round((targetBank.currentBalance + paidImmediate) * 100) / 100;
          setBankAccounts((prev) =>
            prev.map((b) => (b.id === targetBank.id ? { ...b, currentBalance: newBal } : b))
          );
          syncToFirestore("bankAccounts", targetBank.id, { currentBalance: newBal });
        }
      }

      if (creditPart > 0 && data.clientId && data.clientId !== "cf-9999999999999") {
        const clientObj = clients.find((c) => c.id === data.clientId);
        if (clientObj) {
          const newClientBal = Math.round(((clientObj.currentBalance || 0) + creditPart) * 100) / 100;
          setClients((prev) =>
            prev.map((c) => (c.id === clientObj.id ? { ...c, currentBalance: newClientBal } : c))
          );
          syncToFirestore("clients", clientObj.id, { currentBalance: newClientBal });
        }
      }

      // Registro y vinculación automática del comprobante de venta a Cobranzas
      const chargeId = `chg-inv-${newInvoice.id}`;
      const balanceRemaining =
        creditPart > 0
          ? creditPart
          : data.paymentMethod === "credito"
          ? data.total
          : Math.max(0, Math.round((newInvoice.total - paidImmediate) * 100) / 100);

      const chargeStatus: "pagado" | "parcial" | "pendiente" =
        balanceRemaining <= 0.009
          ? "pagado"
          : paidImmediate > 0
          ? "parcial"
          : "pendiente";

      const initialPayments: ChargePayment[] = [];
      if (paidImmediate > 0) {
        initialPayments.push({
          id: `pay-init-${Date.now()}`,
          date: dateStr,
          amount: paidImmediate,
          method: data.paymentMethod === "credito" ? "efectivo" : data.paymentMethod,
          reference: data.transferenciaRef || data.tarjetaRef || documentNumber,
          bankAccountId: data.bankAccountId,
          bankAccountName: data.bankAccountId
            ? bankAccounts.find((b) => b.id === data.bankAccountId)?.bankName
            : undefined,
        });
      }

      const dateParts = dateStr.split("-");
      const chargeYear = parseInt(dateParts[0] || "2026", 10);
      const chargeMonth = parseInt(dateParts[1] || "1", 10);

      const newCharge: MonthlyCharge = {
        id: chargeId,
        invoiceId: newInvoice.id,
        invoiceNumber: newInvoice.documentNumber,
        saleDate: dateStr,
        clientId: data.clientId || "cf-9999999999999",
        clientName: newInvoice.clientName,
        clientRuc: newInvoice.clientRuc,
        month: chargeMonth,
        year: chargeYear,
        serviceDescription:
          newInvoice.items.map((i) => i.name).join(", ") ||
          (docType === "nota_venta" ? "Nota de Venta" : "Factura de Venta"),
        subtotal: (newInvoice.subtotal15 || 0) + (newInvoice.subtotal0 || 0),
        ivaAmount: newInvoice.ivaTotal || 0,
        maxPaymentDate: data.creditDueDate || dateStr,
        total: newInvoice.total,
        paidAmount: paidImmediate,
        balanceRemaining,
        status: chargeStatus,
        paymentMethod: data.paymentMethod,
        paymentReference: data.transferenciaRef || data.tarjetaRef || undefined,
        paymentDate: paidImmediate > 0 ? dateStr : undefined,
        payments: initialPayments,
        notes: data.notes || undefined,
      };

      setMonthlyCharges((prev) => [
        newCharge,
        ...prev.filter(
          (c) => c.invoiceId !== newInvoice.id && c.invoiceNumber !== newInvoice.documentNumber
        ),
      ]);
      void syncToFirestore("monthlyCharges", newCharge.id, newCharge);

      // Sincronización y seguimiento automático de servicios del cliente desde Nota de Venta / Factura
      if (data.clientId && data.clientId !== "cf-9999999999999") {
        const clientObj = clients.find((c) => c.id === data.clientId);
        for (const item of data.items) {
          const invProd = inventoryProducts.find((p) => p.id === item.productId);
          const isService =
            item.unit === "servicio" ||
            invProd?.type === "servicio" ||
            (item.sku && item.sku.toUpperCase().startsWith("SRV-"));

          if (isService) {
            // Verificar si el cliente ya tiene este servicio registrado pendiente de nota de venta
            const existingPending = clientServices.find(
              (cs) =>
                cs.clientId === data.clientId &&
                (cs.inventoryProductId === item.productId || cs.planName.toLowerCase() === item.name.toLowerCase()) &&
                cs.saleStatus === "pendiente_venta"
            );

            if (existingPending) {
              const updates: Partial<ClientService> = {
                origin: docType === "nota_venta" ? "nota_venta" : "factura",
                saleInvoiceId: invoiceId,
                saleDocNumber: documentNumber,
                saleDate: dateStr,
                saleStatus: "emitida",
                status: "activo",
                isBillableInCurrentCycle: true,
                basePrice: item.unitPrice,
                customPrice: item.unitPrice,
              };
              setClientServices((prev) =>
                prev.map((s) => (s.id === existingPending.id ? { ...s, ...updates } : s))
              );
              syncToFirestore("clientServices", existingPending.id, updates);
            } else {
              // Si no existe, crear el servicio vinculado a esta venta en el inventario del cliente
              const renewalDate = new Date();
              renewalDate.setMonth(renewalDate.getMonth() + 1);
              const newSvc: ClientService = {
                id: `srv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                clientId: data.clientId,
                planId: item.productId || `plan-${Date.now()}`,
                planName: item.name,
                inventoryProductId: item.productId || undefined,
                inventorySku: item.sku || undefined,
                downloadMbps: 100,
                uploadMbps: 100,
                basePrice: item.unitPrice,
                customPrice: item.unitPrice,
                billingType: "pospago",
                billingFrequency: "mensual",
                cutoffDay: 5,
                nodeId: "node-1",
                nodeName: "NODO-CENTRAL",
                ipv4Address: "DHCP",
                pppoeUser: `svc-${Date.now().toString().slice(-4)}`,
                status: "activo",
                installationDate: dateStr,
                nextRenewalDate: renewalDate.toISOString().split("T")[0],
                isBillableInCurrentCycle: true,
                origin: docType === "nota_venta" ? "nota_venta" : "factura",
                saleInvoiceId: invoiceId,
                saleDocNumber: documentNumber,
                saleDate: dateStr,
                saleStatus: "emitida",
                installationAddress: clientObj?.address || "Dirección Principal",
              };
              setClientServices((prev) => [...prev, newSvc]);
              syncToFirestore("clientServices", newSvc.id, newSvc);
            }
          }
        }
      }
    }

    addAuditLog(
      "CREATE_CLIENT",
      `${docType === "nota_venta" ? "Nota de Venta" : "Factura"} ${isDraft ? "(Borrador)" : "Emitida"}: ${documentNumber}`,
      `Total: $${newInvoice.total.toFixed(2)} - Cliente: ${newInvoice.clientName}`
    );

    return newInvoice;
  };

  const emitRecurringInvoiceForClient = async (
    clientId: string, month: number, year: number, serviceIds?: string[]
  ): Promise<SriInvoice | null> => {
    if (!serviceIds?.length) throw new Error("Selecciona los servicios del período antes de emitir.");
    const selected = clientServices.filter(s => serviceIds.includes(s.id));
    const plans = selected.map(s => planServicePeriod(s, month, year, getEcuadorDate()));
    const lines = plans.flatMap(p => p.eligible ? [p.line] : []);
    if (lines.length !== selected.length) throw new Error("Hay servicios no elegibles. Revisa la vista previa.");
    return runCommercial<SriInvoice>("recur", { clientId, month, year, serviceIds, expectedTotal: calculateLines(lines).total });
  };

  const updateInvoiceStatus = async (
    id: string,
    status: SriInvoice["status"],
    authorizationDate?: string
  ) => {
    if (status === "anulada" && billingInvoices.find(i => i.id === id)?.documentType === "nota_venta") {
      await runCommercial("cancelSale", { id, reason: "Anulación comercial" });
      return;
    }
    const inv = billingInvoices.find((i) => i.id === id);
    if (!inv) return;

    const now = new Date().toISOString();

    // Si pasa a "anulada":
    // - Si es una Nota de Venta comercial (documentType === "nota_venta") y tenía kardex registrado, reversamos el stock y finanzas.
    // - Si es una Factura Electrónica SRI (documentType === "factura"), NO altera inventario ni finanzas (que pertenecen a la Nota de Venta comercial), y libera la Nota de Venta origen si aplica.
    if (status === "anulada" && inv.status !== "anulada") {
      if (inv.documentType === "nota_venta" && inv.kardexRegistered) {
        const wh = inventoryWarehouses.find((w) => w.id === inv.warehouseId) || inventoryWarehouses[0];
        const warehouseId = wh ? wh.id : (inv.warehouseId || "wh-central");
        const warehouseName = wh ? wh.name : (inv.warehouseName || "Bodega Central");
        const kardexEntries: KardexEntry[] = [];
        const updatedProductsMap = new Map<string, InventoryProduct>();

        for (const item of inv.items) {
          if (!item.productId) continue;
          const product = updatedProductsMap.get(item.productId) || inventoryProducts.find((p) => p.id === item.productId);
          if (!product || !product.tracksStock) continue;

          const qty = Math.abs(item.quantity);
          const currentWhStock = Number(product.stockByWarehouse?.[warehouseId] || 0);
          const newWhStock = currentWhStock + qty;

          const kdx = buildKardexEntry({
            product,
            warehouse: wh || { id: warehouseId, name: warehouseName },
            type: "CUSTOMER_RETURN",
            referenceId: inv.id,
            referenceDocNumber: inv.documentNumber,
            concept: `Anulación de Nota de Venta ${inv.documentNumber}`,
            quantity: qty,
            unitCost: product.baseCost,
            currentStock: currentWhStock,
            currentAvgCost: product.baseCost,
            userName: currentUser.displayName,
          });

          kardexEntries.push(kdx);

          const updatedStockByWh = {
            ...(product.stockByWarehouse || {}),
            [warehouseId]: newWhStock,
          };
          const totalStock = Object.values(updatedStockByWh).reduce((acc, val) => acc + (Number(val) || 0), 0);

          updatedProductsMap.set(product.id, {
            ...product,
            baseCost: kdx.balanceAverageCost,
            stockByWarehouse: updatedStockByWh,
            stock: totalStock,
            updatedAt: now,
          });
        }

        if (kardexEntries.length > 0) {
          await Promise.all([
            ...kardexEntries.map((k) => syncToFirestore("inventoryKardex", k.id, k)),
            ...Array.from(updatedProductsMap.values()).map((p) => syncToFirestore("inventoryProducts", p.id, p)),
          ]);
          setInventoryKardex((prev) => [...kardexEntries, ...prev]);
          setInventoryProducts((prev) => prev.map((p) => updatedProductsMap.get(p.id) || p));
        }

        const linkedMovs = financialMovements.filter((m) => m.relatedEntityId === inv.id);
        for (const mov of linkedMovs) {
          if (mov.bankAccountId) {
            const bank = bankAccounts.find((b) => b.id === mov.bankAccountId);
            if (bank) {
              const revertedBankBal = Math.max(0, Math.round(((bank.currentBalance || 0) - mov.amount) * 100) / 100);
              await syncToFirestore("bankAccounts", bank.id, { currentBalance: revertedBankBal });
              setBankAccounts((prev) =>
                prev.map((b) => (b.id === bank.id ? { ...b, currentBalance: revertedBankBal } : b))
              );
            }
          }
          const revId = `mov-rev-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
          const revMov: FinancialMovement = {
            id: revId,
            type: "egreso",
            date: getEcuadorDate(),
            amount: mov.amount,
            category: "reversiones",
            description: `Reverso por anulación de Nota de Venta ${inv.documentNumber}`,
            bankAccountId: mov.bankAccountId,
            bankAccountName: mov.bankAccountName,
            paymentMethod: mov.paymentMethod || "transferencia",
            relatedEntityId: inv.id,
            createdAt: now,
          };
          await syncToFirestore("financialMovements", revId, revMov);
          setFinancialMovements((prev) => [revMov, ...prev]);
        }

        if (inv.clientId) {
          const clientObj = clients.find((c) => c.id === inv.clientId);
          if (clientObj) {
            const revertedClientBal = Math.max(0, Math.round(((clientObj.currentBalance || 0) - (inv.total || 0)) * 100) / 100);
            await syncToFirestore("clients", clientObj.id, { currentBalance: revertedClientBal });
            setClients((prev) =>
              prev.map((c) => (c.id === clientObj.id ? { ...c, currentBalance: revertedClientBal } : c))
            );
          }
        }
      } else if (inv.relatedSaleId) {
        // Es Factura Electrónica SRI: liberar la Nota de Venta comercial vinculada sin alterar stock ni finanzas
        const originSale = billingInvoices.find((s) => s.id === inv.relatedSaleId);
        if (originSale) {
          const restoredSale: SriInvoice = {
            ...originSale,
            sriStatus: "pendiente",
            sriInvoiceId: undefined,
            sriDocumentNumber: undefined,
          };
          await syncToFirestore("billingInvoices", originSale.id, restoredSale);
          setBillingInvoices((prev) => prev.map((i) => (i.id === originSale.id ? restoredSale : i)));
        }
      }
    }

    const updated: SriInvoice = {
      ...inv,
      status,
      authorizationDate: authorizationDate || (status === "autorizada" ? now : inv.authorizationDate),
    };

    await syncToFirestore("billingInvoices", id, updated);
    setBillingInvoices((prev) => prev.map((i) => (i.id === id ? updated : i)));
    addAuditLog("UPDATE_CLIENT", `Estado Documento ${inv.documentNumber}`, `Nuevo estado: ${status}`);
  };

  const updateInvoice = async (
    id: string,
    updates: Partial<SriInvoice>
  ): Promise<SriInvoice> => {
    if (billingInvoices.find(i => i.id === id)?.documentType === "nota_venta") {
      return runCommercial<SriInvoice>("editSale", { id, updates });
    }
    const inv = billingInvoices.find((i) => i.id === id);
    if (!inv) throw new Error("Comprobante no encontrado.");

    // Validación de permisos
    const isSuperOrAdmin = currentUser.role === "admin" || currentUser.role === "superadmin";
    const canEdit =
      isSuperOrAdmin ||
      currentUser.permissions?.includes("all") ||
      currentUser.permissions?.includes("manage_finance") ||
      currentUser.permissions?.includes("edit_invoices") ||
      currentUser.modulePermissions?.actions?.canEditInvoices;

    if (!canEdit) {
      throw new Error("No tienes autorización para editar ventas o notas de venta.");
    }

    if (inv.status === "anulada") {
      throw new Error("No se puede editar un comprobante que ya ha sido anulado.");
    }

    if (inv.documentType === "factura" && inv.status === "autorizada") {
      throw new Error("Una factura electrónica ya autorizada por el SRI no puede modificarse directamente. Debe emitir una Nota de Crédito.");
    }

    const now = new Date().toISOString();
    const oldWarehouseId = inv.warehouseId || "wh-central";
    const newWarehouseId = updates.warehouseId || oldWarehouseId;
    const wh = inventoryWarehouses.find((w) => w.id === newWarehouseId) || inventoryWarehouses[0];
    const warehouseId = wh ? wh.id : newWarehouseId;
    const warehouseName = wh ? wh.name : (updates.warehouseName || inv.warehouseName || "Bodega Central");

    // 1. Ajuste de Inventario / Kardex si aplica
    const kardexEntries: KardexEntry[] = [];
    const updatedProductsMap = new Map<string, InventoryProduct>();
    const isTransitioningFromDraft = inv.status === "borrador" && updates.status !== undefined && updates.status !== "borrador";

    let assignedDocNumber = inv.documentNumber;
    let assignedClaveAcceso = inv.claveAcceso;

    if (isTransitioningFromDraft) {
      const estab = sriCompanyConfig.establecimiento || "010";
      const pto = sriCompanyConfig.puntoEmision || "001";
      const docType = updates.documentType || inv.documentType || "factura";
      const dateStr = updates.date || inv.date || now.slice(0, 10);

      if (docType === "nota_venta") {
        const startFromNotaVenta = (sriCompanyConfig.secuencialNotaVenta || 1) - 1;
        const maxSecNota = billingInvoices
          .filter((i) => i.documentType === "nota_venta" && i.status !== "borrador")
          .reduce((max, i) => {
            const parts = (i.documentNumber || "").split("-");
            const num = parseInt(parts[2] || "0", 10);
            return !isNaN(num) && num > max ? num : max;
          }, 0);
        assignedDocNumber = formatearSecuencialSRI(Math.max(maxSecNota, startFromNotaVenta) + 1, estab, pto);
        assignedClaveAcceso = "";
      } else {
        const startFromFactura = (sriCompanyConfig.secuencialFactura || 1) - 1;
        const maxSec = billingInvoices
          .filter((i) => (i.documentType || "factura") === "factura" && i.status !== "borrador")
          .reduce((max, i) => {
            const parts = (i.documentNumber || "").split("-");
            const num = parseInt(parts[2] || "0", 10);
            return !isNaN(num) && num > max ? num : max;
          }, 0);
        const secuencial = Math.max(maxSec, startFromFactura) + 1;
        assignedDocNumber = formatearSecuencialSRI(secuencial, estab, pto);
        assignedClaveAcceso = generarClaveAccesoSRI({
          fechaEmision: dateStr,
          tipoComprobante: "01",
          ruc: sriCompanyConfig.ruc,
          ambiente: sriCompanyConfig.ambiente,
          establecimiento: estab,
          puntoEmision: pto,
          secuencial,
          codigoNumerico: Math.floor(10000000 + Math.random() * 90000000).toString(),
        });
      }
    }

    if ((inv.status !== "borrador" && (inv.kardexRegistered || updates.items)) || isTransitioningFromDraft) {
      const oldItems = isTransitioningFromDraft ? [] : (inv.items || []);
      const newItems = updates.items || inv.items || [];

      const oldQtyMap = new Map<string, number>();
      for (const it of oldItems) {
        if (!it.productId) continue;
        oldQtyMap.set(it.productId, (oldQtyMap.get(it.productId) || 0) + Math.abs(it.quantity));
      }

      const newQtyMap = new Map<string, number>();
      for (const it of newItems) {
        if (!it.productId) continue;
        newQtyMap.set(it.productId, (newQtyMap.get(it.productId) || 0) + Math.abs(it.quantity));
      }

      const allProductIds = Array.from(new Set([...oldQtyMap.keys(), ...newQtyMap.keys()]));

      for (const prodId of allProductIds) {
        const product = updatedProductsMap.get(prodId) || inventoryProducts.find((p) => p.id === prodId);
        if (!product || !product.tracksStock) continue;

        const oldQty = oldQtyMap.get(prodId) || 0;
        const newQty = newQtyMap.get(prodId) || 0;
        const delta = newQty - oldQty;

        if (delta === 0) continue;

        const currentWhStock = Number(product.stockByWarehouse?.[warehouseId] || 0);

        if (delta > 0) {
          if (product.tracksStock && product.type !== "servicio" && currentWhStock < delta) {
            throw new Error(`Stock insuficiente para '${product.name}' en la bodega '${warehouseName}'. Disponible: ${currentWhStock}, adicional requerido: ${delta}.`);
          }
          const newWhStock = currentWhStock - delta;
          const kdx = buildKardexEntry({
            product,
            warehouse: wh || { id: warehouseId, name: warehouseName },
            type: "SALE",
            referenceId: inv.id,
            referenceDocNumber: inv.documentNumber,
            concept: `Ajuste incremento por edición de ${inv.documentType === "nota_venta" ? "Nota de Venta" : "Factura"} ${inv.documentNumber}`,
            quantity: delta,
            unitCost: product.baseCost,
            currentStock: currentWhStock,
            currentAvgCost: product.baseCost,
            userName: currentUser.displayName,
          });
          kardexEntries.push(kdx);

          const updatedStockByWh = {
            ...(product.stockByWarehouse || {}),
            [warehouseId]: newWhStock,
          };
          const totalStock = Object.values(updatedStockByWh).reduce((acc, val) => acc + (Number(val) || 0), 0);

          updatedProductsMap.set(product.id, {
            ...product,
            stockByWarehouse: updatedStockByWh,
            stock: totalStock,
            updatedAt: now,
          });
        } else {
          const returnQty = Math.abs(delta);
          const newWhStock = currentWhStock + returnQty;
          const kdx = buildKardexEntry({
            product,
            warehouse: wh || { id: warehouseId, name: warehouseName },
            type: "CUSTOMER_RETURN",
            referenceId: inv.id,
            referenceDocNumber: inv.documentNumber,
            concept: `Reversión por reducción en edición de ${inv.documentType === "nota_venta" ? "Nota de Venta" : "Factura"} ${inv.documentNumber}`,
            quantity: returnQty,
            unitCost: product.baseCost,
            currentStock: currentWhStock,
            currentAvgCost: product.baseCost,
            userName: currentUser.displayName,
          });
          kardexEntries.push(kdx);

          const updatedStockByWh = {
            ...(product.stockByWarehouse || {}),
            [warehouseId]: newWhStock,
          };
          const totalStock = Object.values(updatedStockByWh).reduce((acc, val) => acc + (Number(val) || 0), 0);

          updatedProductsMap.set(product.id, {
            ...product,
            stockByWarehouse: updatedStockByWh,
            stock: totalStock,
            updatedAt: now,
          });
        }
      }

      if (kardexEntries.length > 0) {
        await Promise.all([
          ...kardexEntries.map((k) => syncToFirestore("inventoryKardex", k.id, k)),
          ...Array.from(updatedProductsMap.values()).map((p) => syncToFirestore("inventoryProducts", p.id, p)),
        ]);
        setInventoryKardex((prev) => [...kardexEntries, ...prev]);
        setInventoryProducts((prev) => prev.map((p) => updatedProductsMap.get(p.id) || p));
      }
    }

    // 2. Ajuste de movimientos financieros y saldos bancarios / cuentas por cobrar
    const oldTotal = Number(inv.total || 0);
    const newTotal = updates.total !== undefined ? Number(updates.total) : oldTotal;
    const oldMethod = inv.paymentMethod || "transferencia";
    const newMethod = updates.paymentMethod || oldMethod;
    const oldBankId = inv.bankAccountId;
    const newBankId = updates.bankAccountId || oldBankId;

    if (inv.status !== "borrador") {
      const diffTotal = Math.round((newTotal - oldTotal) * 100) / 100;
      const linkedMovs = financialMovements.filter((m) => m.relatedEntityId === inv.id);

      if (newMethod !== "credito") {
        if (oldMethod === "credito") {
          // Cambió de crédito a contado
          if (inv.clientId && inv.clientId !== "cf-9999999999999") {
            const cl = clients.find((c) => c.id === inv.clientId);
            if (cl) {
              const adjustedClBal = Math.max(0, Math.round(((cl.currentBalance || 0) - oldTotal) * 100) / 100);
              await syncToFirestore("clients", cl.id, { currentBalance: adjustedClBal });
              setClients((prev) => prev.map((c) => (c.id === cl.id ? { ...c, currentBalance: adjustedClBal } : c)));
            }
          }
          const targetBank = newBankId ? bankAccounts.find((b) => b.id === newBankId) : bankAccounts[0];
          if (targetBank) {
            const movId = `mov-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
            const movement: FinancialMovement = {
              id: movId,
              type: "ingreso",
              date: updates.date || inv.date,
              amount: newTotal,
              category: "venta_equipos",
              description: `Cobro editado ${inv.documentType === "nota_venta" ? "Nota de Venta" : "Factura"} ${inv.documentNumber} - ${updates.clientName || inv.clientName}`,
              bankAccountId: targetBank.id,
              bankAccountName: targetBank.bankName,
              paymentMethod: newMethod,
              referenceNumber: updates.transferenciaRef || updates.tarjetaRef || inv.documentNumber,
              relatedEntityId: inv.id,
              createdAt: now,
            };
            setFinancialMovements((prev) => [movement, ...prev]);
            await syncToFirestore("financialMovements", movId, movement);

            const newBankBal = Math.round((targetBank.currentBalance + newTotal) * 100) / 100;
            setBankAccounts((prev) => prev.map((b) => (b.id === targetBank.id ? { ...b, currentBalance: newBankBal } : b)));
            await syncToFirestore("bankAccounts", targetBank.id, { currentBalance: newBankBal });
          }
        } else {
          // Ambos contado
          if (linkedMovs.length > 0) {
            for (const mov of linkedMovs) {
              const currentBank = bankAccounts.find((b) => b.id === mov.bankAccountId);
              if (currentBank) {
                if (!newBankId || newBankId === mov.bankAccountId) {
                  const updatedBankBal = Math.max(0, Math.round(((currentBank.currentBalance || 0) + diffTotal) * 100) / 100);
                  await syncToFirestore("bankAccounts", currentBank.id, { currentBalance: updatedBankBal });
                  setBankAccounts((prev) => prev.map((b) => (b.id === currentBank.id ? { ...b, currentBalance: updatedBankBal } : b)));
                } else {
                  const revertedOldBankBal = Math.max(0, Math.round(((currentBank.currentBalance || 0) - mov.amount) * 100) / 100);
                  await syncToFirestore("bankAccounts", currentBank.id, { currentBalance: revertedOldBankBal });
                  setBankAccounts((prev) => prev.map((b) => (b.id === currentBank.id ? { ...b, currentBalance: revertedOldBankBal } : b)));

                  const targetNewBank = bankAccounts.find((b) => b.id === newBankId);
                  if (targetNewBank) {
                    const updatedNewBankBal = Math.round(((targetNewBank.currentBalance || 0) + newTotal) * 100) / 100;
                    await syncToFirestore("bankAccounts", targetNewBank.id, { currentBalance: updatedNewBankBal });
                    setBankAccounts((prev) => prev.map((b) => (b.id === targetNewBank.id ? { ...b, currentBalance: updatedNewBankBal } : b)));
                  }
                }
              }
              const updatedMov: FinancialMovement = {
                ...mov,
                amount: newTotal,
                bankAccountId: newBankId || mov.bankAccountId,
                bankAccountName: newBankId ? (bankAccounts.find((b) => b.id === newBankId)?.bankName || mov.bankAccountName) : mov.bankAccountName,
                paymentMethod: newMethod,
                description: `Cobro editado ${inv.documentType === "nota_venta" ? "Nota de Venta" : "Factura"} ${inv.documentNumber} - ${updates.clientName || inv.clientName}`,
              };
              await syncToFirestore("financialMovements", mov.id, updatedMov);
              setFinancialMovements((prev) => prev.map((m) => (m.id === mov.id ? updatedMov : m)));
            }
          }
        }
      } else {
        // Nuevo método es crédito
        if (oldMethod !== "credito") {
          for (const mov of linkedMovs) {
            if (mov.bankAccountId) {
              const b = bankAccounts.find((acc) => acc.id === mov.bankAccountId);
              if (b) {
                const revBal = Math.max(0, Math.round(((b.currentBalance || 0) - mov.amount) * 100) / 100);
                await syncToFirestore("bankAccounts", b.id, { currentBalance: revBal });
                setBankAccounts((prev) => prev.map((item) => (item.id === b.id ? { ...item, currentBalance: revBal } : item)));
              }
            }
            await deleteFromFirestore("financialMovements", mov.id);
          }
          setFinancialMovements((prev) => prev.filter((m) => m.relatedEntityId !== inv.id));

          const targetClientId = updates.clientId || inv.clientId;
          if (targetClientId && targetClientId !== "cf-9999999999999") {
            const cl = clients.find((c) => c.id === targetClientId);
            if (cl) {
              const updatedClBal = Math.round(((cl.currentBalance || 0) + newTotal) * 100) / 100;
              await syncToFirestore("clients", cl.id, { currentBalance: updatedClBal });
              setClients((prev) => prev.map((c) => (c.id === cl.id ? { ...c, currentBalance: updatedClBal } : c)));
            }
          }
        } else {
          // Ya era crédito
          const targetClientId = updates.clientId || inv.clientId;
          if (targetClientId && targetClientId !== "cf-9999999999999") {
            const cl = clients.find((c) => c.id === targetClientId);
            if (cl) {
              const updatedClBal = Math.max(0, Math.round(((cl.currentBalance || 0) + diffTotal) * 100) / 100);
              await syncToFirestore("clients", cl.id, { currentBalance: updatedClBal });
              setClients((prev) => prev.map((c) => (c.id === cl.id ? { ...c, currentBalance: updatedClBal } : c)));
            }
          }
        }
      }
    } else if (isTransitioningFromDraft) {
      if (newMethod !== "credito") {
        const targetBank = newBankId ? bankAccounts.find((b) => b.id === newBankId) : bankAccounts[0];
        if (targetBank && newTotal > 0) {
          const movId = `mov-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
          const movement: FinancialMovement = {
            id: movId,
            type: "ingreso",
            date: updates.date || inv.date,
            amount: newTotal,
            category: "venta_equipos",
            description: `Cobro ${inv.documentType === "nota_venta" ? "Nota de Venta" : "Factura"} ${assignedDocNumber} - ${updates.clientName || inv.clientName}`,
            bankAccountId: targetBank.id,
            bankAccountName: targetBank.bankName,
            paymentMethod: newMethod,
            referenceNumber: updates.transferenciaRef || updates.tarjetaRef || assignedDocNumber,
            relatedEntityId: inv.id,
            createdAt: now,
          };
          setFinancialMovements((prev) => [movement, ...prev]);
          await syncToFirestore("financialMovements", movId, movement);

          const newBankBal = Math.round((targetBank.currentBalance + newTotal) * 100) / 100;
          setBankAccounts((prev) => prev.map((b) => (b.id === targetBank.id ? { ...b, currentBalance: newBankBal } : b)));
          await syncToFirestore("bankAccounts", targetBank.id, { currentBalance: newBankBal });
        }
      } else {
        const targetClientId = updates.clientId || inv.clientId;
        if (targetClientId && targetClientId !== "cf-9999999999999" && newTotal > 0) {
          const cl = clients.find((c) => c.id === targetClientId);
          if (cl) {
            const updatedClBal = Math.round(((cl.currentBalance || 0) + newTotal) * 100) / 100;
            await syncToFirestore("clients", cl.id, { currentBalance: updatedClBal });
            setClients((prev) => prev.map((c) => (c.id === cl.id ? { ...c, currentBalance: updatedClBal } : c)));
          }
        }
      }
    }

    // 3. Objeto actualizado final y sincronización
    const updatedInvoice: SriInvoice = {
      ...inv,
      ...updates,
      documentNumber: assignedDocNumber,
      claveAcceso: assignedClaveAcceso,
      authorizationDate: isTransitioningFromDraft ? now : (updates.authorizationDate || inv.authorizationDate),
      warehouseId,
      warehouseName,
      kardexRegistered: inv.kardexRegistered || kardexEntries.length > 0,
      clientRuc: updates.clientRuc ? String(updates.clientRuc).replace(/\s+/g, "").trim() : inv.clientRuc,
      clientEmail: updates.clientEmail ? String(updates.clientEmail).replace(/\s+/g, "").trim().toLowerCase() : inv.clientEmail,
      clientName: updates.clientName ? String(updates.clientName).replace(/\s+/g, " ").trim() : inv.clientName,
    };

    await syncToFirestore("billingInvoices", id, updatedInvoice);
    setBillingInvoices((prev) => prev.map((i) => (i.id === id ? updatedInvoice : i)));

    addAuditLog(
      "UPDATE_CLIENT",
      `Edición de ${inv.documentType === "nota_venta" ? "Nota de Venta" : "Factura"}: ${inv.documentNumber}`,
      `Total anterior: $${oldTotal.toFixed(2)} -> Nuevo Total: $${newTotal.toFixed(2)} - Cliente: ${updatedInvoice.clientName}`
    );

    return updatedInvoice;
  };

  const deleteInvoice = async (id: string) => {
    if (billingInvoices.find(i => i.id === id)?.documentType === "nota_venta") {
      await runCommercial("cancelSale", { id, reason: "Anulación desde gestión comercial" });
      return;
    }
    const inv = billingInvoices.find((i) => i.id === id);
    if (!inv) return;

    // Validación de permisos para eliminación de facturas / notas de venta
    const isSuperOrAdmin = currentUser.role === "admin" || currentUser.role === "superadmin";
    const canDelete =
      isSuperOrAdmin ||
      currentUser.permissions?.includes("all") ||
      currentUser.permissions?.includes("delete_invoices") ||
      currentUser.permissions?.includes("manage_finance") ||
      currentUser.modulePermissions?.actions?.canDeleteInvoices;

    if (!canDelete) {
      throw new Error("No tienes autorización para eliminar ventas o notas de venta.");
    }

    const now = new Date().toISOString();

    // Si es una Factura Electrónica SRI vinculada a una Nota de Venta, liberar la Nota de Venta comercial
    if (inv.documentType !== "nota_venta" && inv.relatedSaleId) {
      const originSale = billingInvoices.find((s) => s.id === inv.relatedSaleId);
      if (originSale) {
        const restoredSale: SriInvoice = {
          ...originSale,
          sriStatus: "pendiente",
          sriInvoiceId: undefined,
          sriDocumentNumber: undefined,
        };
        await syncToFirestore("billingInvoices", originSale.id, restoredSale);
        setBillingInvoices((prev) => prev.map((i) => (i.id === originSale.id ? restoredSale : i)));
      }
    } else if (inv.status !== "anulada") {
      // 1. Reversión de inventario / stock en Kardex si la venta registró salidas físicas
      if (inv.kardexRegistered) {
        const wh = inventoryWarehouses.find((w) => w.id === inv.warehouseId) || inventoryWarehouses[0];
        const warehouseId = wh ? wh.id : (inv.warehouseId || "wh-central");
        const warehouseName = wh ? wh.name : (inv.warehouseName || "Bodega Central");
        const kardexEntries: KardexEntry[] = [];
        const updatedProductsMap = new Map<string, InventoryProduct>();

        for (const item of inv.items) {
          if (!item.productId) continue;
          const product = updatedProductsMap.get(item.productId) || inventoryProducts.find((p) => p.id === item.productId);
          if (!product || !product.tracksStock) continue;

          const qty = Math.abs(item.quantity);
          const currentWhStock = Number(product.stockByWarehouse?.[warehouseId] || 0);
          const newWhStock = currentWhStock + qty;

          const kdx = buildKardexEntry({
            product,
            warehouse: wh || { id: warehouseId, name: warehouseName },
            type: "CUSTOMER_RETURN",
            referenceId: inv.id,
            referenceDocNumber: inv.documentNumber,
            concept: `Reversión por eliminación de ${inv.documentType === "nota_venta" ? "Nota de Venta" : "Factura"} ${inv.documentNumber}`,
            quantity: qty,
            unitCost: product.baseCost,
            currentStock: currentWhStock,
            currentAvgCost: product.baseCost,
            userName: currentUser.displayName,
          });

          kardexEntries.push(kdx);

          const updatedStockByWh = {
            ...(product.stockByWarehouse || {}),
            [warehouseId]: newWhStock,
          };
          const totalStock = Object.values(updatedStockByWh).reduce((acc, val) => acc + (Number(val) || 0), 0);

          updatedProductsMap.set(product.id, {
            ...product,
            baseCost: kdx.balanceAverageCost,
            stockByWarehouse: updatedStockByWh,
            stock: totalStock,
            updatedAt: now,
          });
        }

        if (kardexEntries.length > 0) {
          await Promise.all([
            ...kardexEntries.map((k) => syncToFirestore("inventoryKardex", k.id, k)),
            ...Array.from(updatedProductsMap.values()).map((p) => syncToFirestore("inventoryProducts", p.id, p)),
          ]);
          setInventoryKardex((prev) => [...kardexEntries, ...prev]);
          setInventoryProducts((prev) => prev.map((p) => updatedProductsMap.get(p.id) || p));
        }
      }

      // 2. Reversión de movimientos financieros vinculados
      const linkedMovs = financialMovements.filter((m) => m.relatedEntityId === inv.id);
      for (const mov of linkedMovs) {
        if (mov.bankAccountId) {
          const bank = bankAccounts.find((b) => b.id === mov.bankAccountId);
          if (bank) {
            const revertedBankBal = Math.max(0, Math.round(((bank.currentBalance || 0) - mov.amount) * 100) / 100);
            await syncToFirestore("bankAccounts", bank.id, { currentBalance: revertedBankBal });
            setBankAccounts((prev) =>
              prev.map((b) => (b.id === bank.id ? { ...b, currentBalance: revertedBankBal } : b))
            );
          }
        }
        await deleteFromFirestore("financialMovements", mov.id);
      }
      if (linkedMovs.length > 0) {
        const linkedIds = new Set(linkedMovs.map((m) => m.id));
        setFinancialMovements((prev) => prev.filter((m) => !linkedIds.has(m.id)));
      }

      // 3. Reversión de saldo de cliente si aplica
      if (inv.clientId) {
        const clientObj = clients.find((c) => c.id === inv.clientId);
        if (clientObj) {
          const revertedClientBal = Math.max(0, Math.round(((clientObj.currentBalance || 0) - (inv.total || 0)) * 100) / 100);
          await syncToFirestore("clients", clientObj.id, { currentBalance: revertedClientBal });
          setClients((prev) =>
            prev.map((c) => (c.id === clientObj.id ? { ...c, currentBalance: revertedClientBal } : c))
          );
        }
      }

      // 4. Reversión y eliminación en cascada de servicios del cliente vinculados a esta venta
      const linkedServices = clientServices.filter(
        (s) =>
          s.saleInvoiceId === inv.id ||
          s.saleDocNumber === inv.documentNumber ||
          s.lastBilledInvoiceId === inv.id
      );

      const servicesToDelete: string[] = [];
      const servicesToRevert: ClientService[] = [];

      for (const svc of linkedServices) {
        // Si el servicio fue generado por la emisión de esta venta/nota de venta comercial:
        const wasCreatedBySale =
          svc.origin === "nota_venta" ||
          svc.origin === "factura" ||
          (!svc.origin && svc.saleInvoiceId === inv.id);

        if (wasCreatedBySale) {
          servicesToDelete.push(svc.id);
          await deleteFromFirestore("clientServices", svc.id);
        } else {
          // Si era un servicio preexistente (ej. de contrato o recurrente periódico facturado):
          servicesToRevert.push(svc);
          const updates: Partial<ClientService> = {
            saleInvoiceId: undefined,
            saleDocNumber: undefined,
            saleDate: undefined,
            saleStatus: "pendiente_venta",
            lastBilledPeriod: undefined,
            lastBilledInvoiceId: undefined,
          };
          await syncToFirestore("clientServices", svc.id, updates);
        }
      }

      if (servicesToDelete.length > 0) {
        const delSet = new Set(servicesToDelete);
        setClientServices((prev) => prev.filter((s) => !delSet.has(s.id)));
      }
      if (servicesToRevert.length > 0) {
        const revSet = new Set(servicesToRevert.map((s) => s.id));
        setClientServices((prev) =>
          prev.map((s) => {
            if (revSet.has(s.id)) {
              return {
                ...s,
                saleInvoiceId: undefined,
                saleDocNumber: undefined,
                saleDate: undefined,
                saleStatus: "pendiente_venta",
                lastBilledPeriod: undefined,
                lastBilledInvoiceId: undefined,
              };
            }
            return s;
          })
        );
      }

      // Actualizar contador de servicios activos del cliente si cambió
      if (inv.clientId) {
        const clientObj = clients.find((c) => c.id === inv.clientId);
        if (clientObj) {
          const activeCount = clientServices.filter(
            (s) => s.clientId === inv.clientId && !servicesToDelete.includes(s.id) && s.status === "activo"
          ).length;
          await syncToFirestore("clients", clientObj.id, { totalActiveServices: activeCount });
          setClients((prev) =>
            prev.map((c) => (c.id === clientObj.id ? { ...c, totalActiveServices: activeCount } : c))
          );
        }
      }
    }

    // 5. Eliminar de Firestore y estado local
    await deleteFromFirestore("billingInvoices", id);
    setBillingInvoices((prev) => prev.filter((i) => i.id !== id));

    // 6. Purga en cascada de cobros y abonos comerciales vinculados a esta venta
    const invDate = new Date(inv.date);
    const invMonth = isNaN(invDate.getTime()) ? undefined : invDate.getMonth() + 1;
    const invYear = isNaN(invDate.getTime()) ? undefined : invDate.getFullYear();
    const linkedCharges = monthlyCharges.filter(
      (c) =>
        c.invoiceId === id ||
        c.invoiceNumber === inv.documentNumber ||
        c.id === id ||
        c.id === `chg-inv-${id}` ||
        (invMonth && invYear && c.id === `chg-${inv.clientId}-${invMonth}-${invYear}`) ||
        (c.clientId === inv.clientId && (c.invoiceNumber === inv.documentNumber || c.invoiceId === id))
    );
    for (const chg of linkedCharges) {
      const chgMovs = financialMovements.filter((m) => m.relatedEntityId === chg.id);
      for (const mov of chgMovs) {
        if (mov.bankAccountId) {
          const bank = bankAccounts.find((b) => b.id === mov.bankAccountId);
          if (bank) {
            const revertedBankBal = Math.max(0, Math.round(((bank.currentBalance || 0) - mov.amount) * 100) / 100);
            await syncToFirestore("bankAccounts", bank.id, { currentBalance: revertedBankBal });
            setBankAccounts((prev) =>
              prev.map((b) => (b.id === bank.id ? { ...b, currentBalance: revertedBankBal } : b))
            );
          }
        }
        await deleteFromFirestore("financialMovements", mov.id);
      }
      if (chgMovs.length > 0) {
        const chgMovIds = new Set(chgMovs.map((m) => m.id));
        setFinancialMovements((prev) => prev.filter((m) => !chgMovIds.has(m.id)));
      }
      await deleteFromFirestore("monthlyCharges", chg.id);
    }
    if (linkedCharges.length > 0) {
      const chgIds = new Set(linkedCharges.map((c) => c.id));
      setMonthlyCharges((prev) =>
        prev.filter((c) => !chgIds.has(c.id))
      );
    }

    addAuditLog(
      "UPDATE_CLIENT",
      `Eliminación de ${inv.documentType === "nota_venta" ? "Nota de Venta" : "Factura"}: ${inv.documentNumber}`,
      `Total: $${inv.total?.toFixed(2) || "0.00"} - Cliente: ${inv.clientName}`
    );
  };

  const createBillingQuote = async (
    quote: Omit<ClientQuote, "id" | "quoteNumber" | "createdAt">
  ): Promise<ClientQuote> => {
    const now = new Date().toISOString();
    const quoteId = `cot-${Date.now()}`;
    const year = new Date().getFullYear();
    const count = billingQuotes.length + 1;
    const quoteNumber = `COT-${year}-${String(count).padStart(4, "0")}`;

    const newQuote: ClientQuote = {
      ...quote,
      id: quoteId,
      quoteNumber,
      createdAt: now,
    };

    await syncToFirestore("billingQuotes", newQuote.id, newQuote);
    setBillingQuotes((prev) => [newQuote, ...prev]);
    addAuditLog("CREATE_CLIENT", `Cotización Creada: ${quoteNumber}`, `Cliente: ${newQuote.clientName} - Total: $${newQuote.total.toFixed(2)}`);

    return newQuote;
  };

  const updateBillingQuote = async (id: string, updates: Partial<ClientQuote>) => {
    const existing = billingQuotes.find((q) => q.id === id);
    if (!existing) return;

    const updated: ClientQuote = { ...existing, ...updates };
    await syncToFirestore("billingQuotes", id, updated);
    setBillingQuotes((prev) => prev.map((q) => (q.id === id ? updated : q)));
    addAuditLog("UPDATE_CLIENT", `Cotización Actualizada: ${existing.quoteNumber}`, `Estado: ${updated.status}`);
  };

  const deleteBillingQuote = async (id: string) => {
    await deleteFromFirestore("billingQuotes", id);
    setBillingQuotes((prev) => prev.filter((q) => q.id !== id));
    addAuditLog("UPDATE_CLIENT", `Cotización Eliminada: ${id}`, "");
  };

  const convertQuoteToInvoice = async (
    quoteId: string,
    warehouseId: string,
    paymentMethod: SriInvoice["paymentMethod"] = "transferencia",
    documentType: "factura" | "nota_venta" = "nota_venta"
  ): Promise<SriInvoice> => {
    const quote = billingQuotes.find((q) => q.id === quoteId);
    if (!quote) throw new Error("Cotización no encontrada.");

    const wh = inventoryWarehouses.find((w) => w.id === warehouseId) || inventoryWarehouses[0];

    const invoice = await createInvoice({
      documentType,
      date: getEcuadorDate(),
      time: new Date().toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" }),
      clientId: quote.clientId,
      clientName: quote.clientName,
      clientRuc: quote.clientRuc,
      clientEmail: quote.clientEmail,
      clientPhone: quote.clientPhone,
      clientAddress: quote.clientAddress || "Ecuador",
      tipoIdentificacion: quote.clientRuc.length === 13 ? "04" : quote.clientRuc === "9999999999999" ? "07" : "05",
      items: quote.items.map((it) => ({
        ...it,
        warehouseId: warehouseId || it.warehouseId,
      })),
      subtotal15: quote.subtotal15,
      subtotal0: quote.subtotal0,
      subtotalNoObjeto: 0,
      subtotalExento: 0,
      discountTotal: quote.discountTotal,
      ivaTotal: quote.ivaTotal,
      total: quote.total,
      paymentMethod,
      sriPaymentCode: paymentMethod === "efectivo" ? "01" : paymentMethod === "tarjeta" ? "19" : "20",
      status: documentType === "nota_venta" ? "registrado" : "autorizada",
      sriStatus: documentType === "nota_venta" ? "pendiente" : "facturada",
      authorizationDate: new Date().toISOString(),
      warehouseId: wh ? wh.id : warehouseId,
      warehouseName: wh ? wh.name : "Bodega Central",
      notes: `${documentType === "nota_venta" ? "Nota de Venta" : "Facturado"} desde Cotización ${quote.quoteNumber}. ${quote.notes || ""}`,
    });

    const updatedQuote: ClientQuote = {
      ...quote,
      status: "facturada",
      invoicedAt: new Date().toISOString(),
      invoiceId: invoice.id,
      invoiceNumber: invoice.documentNumber,
    };

    await syncToFirestore("billingQuotes", updatedQuote.id, updatedQuote);
    setBillingQuotes((prev) => prev.map((q) => (q.id === quoteId ? updatedQuote : q)));

    return invoice;
  };

  const convertSaleToSriInvoice = async (
    saleId: string,
    customData?: Partial<SriInvoice> & { customSecuencial?: number }
  ): Promise<SriInvoice> => {
    const sale = billingInvoices.find((i) => i.id === saleId);
    if (!sale) throw new Error("Venta comercial no encontrada.");

    if (sale.sriInvoiceId) {
      const existing = billingInvoices.find((i) => i.id === sale.sriInvoiceId);
      if (existing) return existing;
    }

    const now = new Date().toISOString();
    const dateStr = customData?.date || sale.date || now.slice(0, 10);
    const invoiceId = `inv-${Date.now()}`;
    const estab = sriCompanyConfig.establecimiento || "010";
    const pto = sriCompanyConfig.puntoEmision || "001";

    const startFromFactura = (sriCompanyConfig.secuencialFactura || 1) - 1;
    const maxSec = billingInvoices
      .filter((inv) => (inv.documentType || "factura") === "factura" && inv.status !== "borrador")
      .reduce((max, inv) => {
        const parts = (inv.documentNumber || "").split("-");
        const num = parseInt(parts[2] || "0", 10);
        return !isNaN(num) && num > max ? num : max;
      }, 0);
    const secuencial = customData?.customSecuencial || (Math.max(maxSec, startFromFactura) + 1);
    const documentNumber = formatearSecuencialSRI(secuencial, estab, pto);

    const claveAcceso = generarClaveAccesoSRI({
      fechaEmision: dateStr,
      tipoComprobante: "01",
      ruc: sriCompanyConfig.ruc,
      ambiente: sriCompanyConfig.ambiente,
      establecimiento: estab,
      puntoEmision: pto,
      secuencial,
      codigoNumerico: Math.floor(10000000 + Math.random() * 90000000).toString(),
    });

    const newInvoice: SriInvoice = {
      ...sale,
      ...customData,
      id: invoiceId,
      documentType: "factura",
      documentNumber,
      claveAcceso,
      date: dateStr,
      time: new Date().toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" }),
      status: "autorizada",
      authorizationDate: now,
      relatedSaleId: sale.id,
      kardexRegistered: false, // El stock ya fue descontado en la Nota de Venta comercial
      notes: `Factura Electrónica emitida a partir de Nota de Venta ${sale.documentNumber}. ${sale.notes || ""}`,
      createdAt: now,
    };

    const updatedSale: SriInvoice = {
      ...sale,
      sriStatus: "facturada",
      sriInvoiceId: newInvoice.id,
      sriDocumentNumber: newInvoice.documentNumber,
    };

    await Promise.all([
      syncToFirestore("billingInvoices", newInvoice.id, newInvoice),
      syncToFirestore("billingInvoices", sale.id, updatedSale),
    ]);

    setBillingInvoices((prev) => [
      newInvoice,
      ...prev.map((i) => (i.id === sale.id ? updatedSale : i)),
    ]);

    addAuditLog(
      "UPDATE_CLIENT",
      `Pase de Venta a Factura SRI: ${sale.documentNumber} -> ${newInvoice.documentNumber}`,
      `Total: $${newInvoice.total.toFixed(2)} - Cliente: ${newInvoice.clientName}`
    );

    return newInvoice;
  };

  const createCreditNote = async (
    data: Omit<CreditNote, "id" | "claveAcceso" | "documentNumber" | "createdAt" | "kardexReentered">
  ): Promise<CreditNote> => {
    const now = new Date().toISOString();
    const ncId = `nc-${Date.now()}`;
    const dateStr = data.date || now.slice(0, 10);

    const startFromNC = (sriCompanyConfig.secuencialNotaCredito || 1) - 1;
    const maxSec = billingCreditNotes.reduce((max, nc) => {
      const parts = (nc.documentNumber || "").split("-");
      const num = parseInt(parts[2] || "0", 10);
      return !isNaN(num) && num > max ? num : max;
    }, 0);
    const secuencial = Math.max(maxSec, startFromNC) + 1;
    const documentNumber = formatearSecuencialSRI(
      secuencial,
      sriCompanyConfig.establecimiento,
      sriCompanyConfig.puntoEmision
    );

    const claveAcceso = generarClaveAccesoSRI({
      fechaEmision: dateStr,
      tipoComprobante: "04",
      ruc: sriCompanyConfig.ruc,
      ambiente: sriCompanyConfig.ambiente,
      establecimiento: sriCompanyConfig.establecimiento,
      puntoEmision: sriCompanyConfig.puntoEmision,
      secuencial,
      codigoNumerico: Math.floor(10000000 + Math.random() * 90000000).toString(),
    });

    const wh = inventoryWarehouses.find((w) => w.id === data.warehouseId) || inventoryWarehouses[0];
    const warehouseId = wh ? wh.id : (data.warehouseId || "wh-central");
    const warehouseName = wh ? wh.name : (data.warehouseName || "Bodega Central");

    // La Nota de Crédito (04) es un comprobante electrónico tributario del SRI sobre la Factura Electrónica (01).
    // El inventario y las finanzas se gestionan fuera del proceso de facturación electrónica.
    const newCreditNote: CreditNote = {
      ...data,
      id: ncId,
      documentNumber,
      claveAcceso,
      warehouseId,
      warehouseName,
      kardexReentered: false,
      createdAt: now,
    };

    await syncToFirestore("billingCreditNotes", newCreditNote.id, newCreditNote);
    setBillingCreditNotes((prev) => [newCreditNote, ...prev]);

    // Si la Nota de Crédito cubre el total de la Factura Electrónica modificada, marcar la factura SRI como anulada y liberar la Nota de Venta origen
    const targetInv = billingInvoices.find((i) => i.id === data.invoiceId);
    if (targetInv && newCreditNote.total >= (targetInv.total || 0)) {
      await updateInvoiceStatus(targetInv.id, "anulada");
    }

    addAuditLog("CREATE_EXPENSE", `Nota de Crédito SRI: ${documentNumber}`, `Factura: ${data.invoiceNumber} - Total: $${newCreditNote.total.toFixed(2)}`);

    return newCreditNote;
  };

  const createDebitNote = async (
    data: Omit<DebitNote, "id" | "claveAcceso" | "documentNumber" | "createdAt">
  ): Promise<DebitNote> => {
    const now = new Date().toISOString();
    const ndId = `nd-${Date.now()}`;
    const dateStr = data.date || now.slice(0, 10);

    const startFromND = (sriCompanyConfig.secuencialNotaDebito || 1) - 1;
    const maxSec = billingDebitNotes.reduce((max, nd) => {
      const parts = (nd.documentNumber || "").split("-");
      const num = parseInt(parts[2] || "0", 10);
      return !isNaN(num) && num > max ? num : max;
    }, 0);
    const secuencial = Math.max(maxSec, startFromND) + 1;
    const documentNumber = formatearSecuencialSRI(
      secuencial,
      sriCompanyConfig.establecimiento,
      sriCompanyConfig.puntoEmision
    );

    const claveAcceso = generarClaveAccesoSRI({
      fechaEmision: dateStr,
      tipoComprobante: "05",
      ruc: sriCompanyConfig.ruc,
      ambiente: sriCompanyConfig.ambiente,
      establecimiento: sriCompanyConfig.establecimiento,
      puntoEmision: sriCompanyConfig.puntoEmision,
      secuencial,
      codigoNumerico: Math.floor(10000000 + Math.random() * 90000000).toString(),
    });

    const newND: DebitNote = {
      ...data,
      status: data.status || "autorizada",
      id: ndId,
      documentNumber,
      claveAcceso,
      createdAt: now,
    };

    await syncToFirestore("billingDebitNotes", newND.id, newND);
    setBillingDebitNotes((prev) => [newND, ...prev]);

    addAuditLog(
      "UPDATE_CLIENT",
      `Nota de Débito SRI: ${newND.documentNumber}`,
      `Total: $${newND.total.toFixed(2)} - Factura Modificada: ${newND.modifiedInvoiceNumber}`
    );

    return newND;
  };

  const createWithholding = async (
    data: Omit<WithholdingReceipt, "id" | "claveAcceso" | "documentNumber" | "createdAt">
  ): Promise<WithholdingReceipt> => {
    const now = new Date().toISOString();
    const retId = `ret-${Date.now()}`;
    const dateStr = data.date || now.slice(0, 10);

    const startFromRet = (sriCompanyConfig.secuencialRetencion || 1) - 1;
    const maxSec = billingWithholdings.reduce((max, w) => {
      const parts = (w.documentNumber || "").split("-");
      const num = parseInt(parts[2] || "0", 10);
      return !isNaN(num) && num > max ? num : max;
    }, 0);
    const secuencial = Math.max(maxSec, startFromRet) + 1;
    const documentNumber = formatearSecuencialSRI(
      secuencial,
      sriCompanyConfig.establecimiento,
      sriCompanyConfig.puntoEmision
    );

    const claveAcceso = generarClaveAccesoSRI({
      fechaEmision: dateStr,
      tipoComprobante: "07",
      ruc: sriCompanyConfig.ruc,
      ambiente: sriCompanyConfig.ambiente,
      establecimiento: sriCompanyConfig.establecimiento,
      puntoEmision: sriCompanyConfig.puntoEmision,
      secuencial,
      codigoNumerico: Math.floor(10000000 + Math.random() * 90000000).toString(),
    });

    const newWithholding: WithholdingReceipt = {
      ...data,
      id: retId,
      documentNumber,
      claveAcceso,
      createdAt: now,
    };

    await syncToFirestore("billingWithholdings", newWithholding.id, newWithholding);
    setBillingWithholdings((prev) => [newWithholding, ...prev]);
    addAuditLog("CREATE_EXPENSE", `Comprobante Retención: ${documentNumber}`, `Cliente: ${newWithholding.clientName} - Retenido: $${newWithholding.totalRetained.toFixed(2)}`);

    return newWithholding;
  };

  const createRemissionGuide = async (
    data: Omit<RemissionGuide, "id" | "claveAcceso" | "documentNumber" | "createdAt">
  ): Promise<RemissionGuide> => {
    const now = new Date().toISOString();
    const guideId = `gr-${Date.now()}`;
    const dateStr = data.date || now.slice(0, 10);

    const startFromGuia = (sriCompanyConfig.secuencialGuiaRemision || 1) - 1;
    const maxSec = billingRemissionGuides.reduce((max, g) => {
      const parts = (g.documentNumber || "").split("-");
      const num = parseInt(parts[2] || "0", 10);
      return !isNaN(num) && num > max ? num : max;
    }, 0);
    const secuencial = Math.max(maxSec, startFromGuia) + 1;
    const documentNumber = formatearSecuencialSRI(
      secuencial,
      sriCompanyConfig.establecimiento,
      sriCompanyConfig.puntoEmision
    );

    const claveAcceso = generarClaveAccesoSRI({
      fechaEmision: dateStr,
      tipoComprobante: "06",
      ruc: sriCompanyConfig.ruc,
      ambiente: sriCompanyConfig.ambiente,
      establecimiento: sriCompanyConfig.establecimiento,
      puntoEmision: sriCompanyConfig.puntoEmision,
      secuencial,
      codigoNumerico: Math.floor(10000000 + Math.random() * 90000000).toString(),
    });

    const newGuide: RemissionGuide = {
      ...data,
      id: guideId,
      documentNumber,
      claveAcceso,
      createdAt: now,
    };

    await syncToFirestore("billingRemissionGuides", newGuide.id, newGuide);
    setBillingRemissionGuides((prev) => [newGuide, ...prev]);
    addAuditLog("CREATE_EXPENSE", `Guía de Remisión: ${documentNumber}`, `Destino: ${newGuide.destAddress} - Transportista: ${newGuide.carrierName}`);

    return newGuide;
  };

  const updateSriConfig = async (updates: Partial<SriCompanyConfig>) => {
    const updated: SriCompanyConfig = {
      ...sriCompanyConfig,
      ...updates,
    };
    await syncToFirestore("sriCompanyConfig", updated.id || "sri-config-inntel", updated);
    setSriCompanyConfig(updated);
    addAuditLog("UPDATE_CLIENT", "Configuración Emisor SRI Actualizada", `RUC: ${updated.ruc} - Ambiente: ${updated.ambiente === "1" ? "Pruebas" : "Producción"}`);
  };

  // ==========================================
  // COMPRAS, PROVEEDORES & FINANZAS MUTATIONS
  // ==========================================

  const addSupplier = async (
    supplier: Omit<Supplier, "id" | "createdAt" | "updatedAt">
  ): Promise<Supplier> => {
    const id = `prov-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
    const newSupplier: Supplier = {
      ...supplier,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await syncToFirestore("suppliers", id, newSupplier);
    setSuppliers((prev) => [newSupplier, ...prev]);
    addAuditLog("CREATE_USER", "Proveedores", `Proveedor ${newSupplier.razonSocial} (RUC: ${newSupplier.ruc}) registrado`);
    return newSupplier;
  };

  const updateSupplier = async (id: string, updates: Partial<Supplier>): Promise<void> => {
    await syncToFirestore("suppliers", id, updates);
    setSuppliers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s))
    );
  };

  const deleteSupplier = async (id: string): Promise<void> => {
    await updateSupplier(id, { status: "inactivo" });
  };

  const addPurchaseInvoice = async (
    data: Omit<PurchaseInvoice, "id" | "createdAt" | "paidAmount" | "balanceRemaining"> & { paidAmount?: number }
  ): Promise<PurchaseInvoice> => runCommercial<PurchaseInvoice>("purchase", data);

  const updatePurchaseInvoice = async (id: string, updates: Partial<PurchaseInvoice>): Promise<void> => {
    await syncToFirestore("purchaseInvoices", id, updates);
    setPurchaseInvoices((prev) =>
      prev.map((inv) => (inv.id === id ? { ...inv, ...updates } : inv))
    );
  };

  const addSupplierCreditNote = async (note: Omit<SupplierCreditNote, "id" | "createdAt">): Promise<SupplierCreditNote> =>
    runCommercial<SupplierCreditNote>("supplierCredit", note);

  const addSupplierDebitNote = async (note: Omit<SupplierDebitNote, "id" | "createdAt">): Promise<SupplierDebitNote> =>
    runCommercial<SupplierDebitNote>("supplierDebit", note);

  const addPurchaseWithholding = async (
    ret: Omit<PurchaseWithholding, "id" | "createdAt">
  ): Promise<PurchaseWithholding> => {
    const id = `ret-pur-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newRet: PurchaseWithholding = {
      ...ret,
      id,
      createdAt: new Date().toISOString(),
    };
    setPurchaseWithholdings((prev) => [newRet, ...prev]);
    await syncToFirestore("purchaseWithholdings", id, newRet);
    return newRet;
  };

  const addBankAccount = async (account: Omit<BankAccount, "id">): Promise<BankAccount> =>
    runCommercial<BankAccount>("createBank", account);

  const updateBankAccount = async (id: string, updates: Partial<BankAccount>): Promise<void> => {
    await runCommercial("editBank", { id, ...updates });
  };

  const adjustBankBalance = async (bankAccountId: string, delta: number, reason: string) => {
    await runCommercial("adjustBank", { bankAccountId, delta, reason });
  };

  const addSupplierPayment = async (
    payment: Omit<SupplierPaymentRecord, "id" | "createdAt">
  ): Promise<SupplierPaymentRecord> => runCommercial<SupplierPaymentRecord>("paySupplier", payment);

  const addFinancialMovement = async (
    movement: Omit<FinancialMovement, "id" | "createdAt">
  ): Promise<FinancialMovement> => runCommercial<FinancialMovement>("bankMovement", movement);

  const transferBetweenAccounts = async (fromId: string, toId: string, amount: number, description?: string) => {
    await runCommercial("transfer", { fromId, toId, amount, description });
  };

  const updateUserModulePermissions = async (uid: string, permissions: UserModulePermissions): Promise<void> => {
    await updateSystemUser(uid, { modulePermissions: permissions });
  };

  const resetDataToDefaults = async () => { await refresh(); };

  const hasAccess = canAccessRoute(currentUser, pathname);

  return (
    <ToastProvider>
      <AppContext.Provider
        value={{
          currentUser,
          isAuthenticated,
          login,
          logout,
          revealCredential,
          refresh,
          saveRecord,
          deleteRecord,
          systemUsers,
          addSystemUser,
          updateSystemUser,
          deleteSystemUser,
          toggleUserStatus,
          projects,
          addProject,
          updateProject,
          deleteProject,
          restoreProject,
          permanentDeleteProject,
          updateProjectColumns,
          clientProjects,
          addClientProjectTask,
          updateClientProjectTask,
          moveProjectTaskColumn,
          addProjectTaskNote,
          deleteClientProjectTask,
          clientQuotes,
          addClientQuote,
          updateClientQuoteStatus,
          deleteClientQuote,
          clientVaultItems,
          addClientVaultItem,
          addTicketSubject,
          updateTicketSubject,
          deleteTicketSubject,
          updateClientVaultItem,
          deleteClientVaultItem,
          clientContracts,
          addClientContract,
          updateClientContract,
          hostingDomains,
          addHostingDomain,
          updateHostingDomain,
          deleteHostingDomain,
          regulatoryTramites,
          addRegulatoryTramite,
          updateRegulatoryTramite,
          deleteRegulatoryTramite,
          clients,
          clientServices,
          plans,
          nodes,
          ipPools,
          policies,
          vault,
          tickets,
          ticketSubjects,
          expenses,
          monthlyCharges,
          clientAdvances,
          auditLogs,
          addClient,
          updateClient,
          deleteClient,
          addClientService,
          updateClientService,
          deleteClientService,
          renewClientService,
          emitRecurringInvoiceForClient,
          addPolicy,
          deletePolicy,
          updatePolicy,
          addVaultCredential,
          updateVaultCredential,
          logVaultAccess,
          addNode,
          updateNode,
          deleteNode,
          arcotelConcession,
          updateArcotelConcession,
          arcotelFiles,
          addArcotelFile,
          deleteArcotelFile,
          clientDocuments,
          addClientDocument,
          updateClientDocument,
          deleteClientDocument,
          addTicket,
          updateTicketStatus,
          updateTicketDetails,
          replyToTicket,
          addExpense,
          generateMonthlyBillingBatch,
          markChargeAsPaid,
          addMonthlyCharge,
          updateMonthlyCharge,
          deleteMonthlyCharge,
          addPaymentToCharge,
          addClientAdvance,
          applyClientAdvance,
          deleteClientAdvance,
          // Inventory Module
          inventoryProducts,
          inventoryWarehouses,
          inventoryCategories,
          inventoryBrands,
          inventoryKardex,
          inventoryTransfers,
          inventoryAdjustments,
          addInventoryProduct,
          updateInventoryProduct,
          deleteInventoryProduct,
          addWarehouse,
          updateWarehouse,
          deleteWarehouse,
          addCategory,
          addBrand,
          executeTransfer,
          executeAdjustment,
          // Billing & SRI Module
          billingInvoices,
          billingQuotes,
          billingCreditNotes,
          billingDebitNotes,
          billingWithholdings,
          billingRemissionGuides,
          sriCompanyConfig,
          createInvoice,
          updateInvoiceStatus,
          updateInvoice,
          deleteInvoice,
          createBillingQuote,
          updateBillingQuote,
          deleteBillingQuote,
          convertQuoteToInvoice,
          convertSaleToSriInvoice,
          createCreditNote,
          createDebitNote,
          createWithholding,
          createRemissionGuide,
          updateSriConfig,
          // Compras & Proveedores & Finanzas Bancarias
          suppliers,
          purchaseInvoices,
          supplierCreditNotes,
          supplierDebitNotes,
          purchaseWithholdings,
          bankAccounts,
          financialMovements,
          supplierPayments,
          supplierCredits,
          addSupplier,
          updateSupplier,
          deleteSupplier,
          addPurchaseInvoice,
          updatePurchaseInvoice,
          addSupplierCreditNote,
          addSupplierDebitNote,
          addPurchaseWithholding,
          addBankAccount,
          updateBankAccount,
          adjustBankBalance,
          reverseChargePayment,
          addSupplierPayment,
          addFinancialMovement,
          transferBetweenAccounts,
          startBillingRun,
          processBillingRun,
          updateUserModulePermissions,
          searchQuery,
          setSearchQuery,
          isSearchOpen,
          setIsSearchOpen,
          resetDataToDefaults,
        }}
      >
        <SecurityLockoutModal />
        <ModalFocusGuard />
        {isAuthLoaded ? (
          isAuthenticated ? (
            !dataReady ? (
              <div className="min-h-screen flex flex-col gap-4 items-center justify-center p-6" role="status">
                <p>{loadError || "Cargando datos verificados del servidor…"}</p>
                {loadError && <button onClick={() => { void refresh().catch(e => setLoadError(e.message)); }}>Reintentar carga</button>}
                <button onClick={() => { void logout(); }}>Cerrar sesión</button>
              </div>
            ) : hasAccess ? (
              children
            ) : (
              <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="max-w-md bg-white p-6 rounded-xl border border-[#e2e8f0] text-center space-y-3 shadow-2xs">
                  <h3 className="font-bold text-slate-900 text-base">Módulo Restringido</h3>
                  <p className="text-xs text-slate-500">
                    Tu rol ({currentUser.role}) no tiene asignado el permiso para acceder a esta sección.
                  </p>
                  <a
                    href="/"
                    className="inline-block px-4 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                  >
                    Volver al Dashboard
                  </a>
                </div>
              </div>
            )
          ) : (
            <LoginScreen />
          )
        ) : (
          <div className="min-h-screen bg-slate-900 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </AppContext.Provider>
    </ToastProvider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within an AppProvider");
  return context;
}
