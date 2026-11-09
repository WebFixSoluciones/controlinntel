"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { ToastProvider } from "./toast-context";
import type { ExpenseCategory } from "./expense-categories";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { ModalFocusGuard } from "@/components/layout/ModalFocusGuard";
import { BackButton } from "@/components/ui/BackButton";
import { normalizeConcession } from "./arcotel-concession";
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
import { observeVerifiedSession } from "./session-restoration";
import { vaultMetadata } from "./vault-metadata";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { usePathname, useRouter } from "next/navigation";
import { can, canAccessRoute, firstAccessibleRoute, collectionPermissions, routePermissions, type Entity } from "./permissions";
import { DEFAULT_INNTEL_SRI_CONFIG } from "./sri-service";
import { api } from "./api-client";
import type { SriRequest, SriSubmission, FiscalKind } from "./server/sri-documents";
import type { SriFiscalEvidence } from "@/types";
import { getEcuadorDate, addMonthsSafely, calculateContractEndDate, calculateNextRenewalDate } from "./date-utils";
import { calculateLines, planServicePeriod } from "./commercial-core";
import { resolveTicketDepartments } from "./ticket-departments";
import type { TicketDepartmentRecord, UserRoleTemplate } from "@/types";
import { sanitizeObjectTexts } from "./sanitize-text";
import { SecurityLockoutModal } from "@/components/security/SecurityLockoutModal";

export interface LoginResult {
  success: boolean;
  error?: string;
  code?: string;
}

interface AppContextType {
  currentUser: UserProfile;
  isAuthenticated: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<LoginResult>;
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
  ticketDepartments: TicketDepartmentRecord[];
  ticketAssignees: Pick<UserProfile, "uid" | "displayName" | "role">[];
  userRoleTemplates: UserRoleTemplate[];
  addTicketSubject: (subject: Omit<TicketSubject, "id">) => Promise<void>;
  updateTicketSubject: (id: string, updates: Partial<TicketSubject>) => Promise<void>;
  deleteTicketSubject: (id: string) => Promise<void>;
  expenses: Expense[];
  expenseCategories: ExpenseCategory[];
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
  addClientService: (
    service: Omit<ClientService, "id">
  ) => Promise<ClientService>;
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
  updateExpense: (id: string, expense: Omit<Expense, "id">, expectedVersion?: number) => Promise<void>;
  deleteExpense: (id: string, expectedVersion?: number) => Promise<void>;
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
  applyClientCredit: (chargeId: string, amount: number, date?: string, notes?: string) => Promise<void>;
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
    customData?: Partial<SriInvoice>, correctionId?: string
  ) => Promise<SriInvoice>;
  createCreditNote: (
    data: Omit<CreditNote, "id" | "claveAcceso" | "documentNumber" | "createdAt" | "kardexReentered">, correctionId?: string
  ) => Promise<CreditNote>;
  createDebitNote: (
    data: Omit<DebitNote, "id" | "claveAcceso" | "documentNumber" | "createdAt">, correctionId?: string
  ) => Promise<DebitNote>;
  createWithholding: (
    data: Omit<Extract<SriRequest, { kind: "retencion" }>, "kind">, correctionId?: string
  ) => Promise<WithholdingReceipt>;
  createRemissionGuide: (
    data: Omit<RemissionGuide, "id" | "claveAcceso" | "documentNumber" | "createdAt"> & { invoiceId?: string }, correctionId?: string
  ) => Promise<RemissionGuide>;
  consultFiscalDocument: (kind: FiscalKind, id: string, retry?: boolean) => Promise<SriFiscalEvidence>;
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
  isNavigationOpen: boolean;
  setIsNavigationOpen: (open: boolean) => void;

  resetDataToDefaults: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);
const STORAGE_KEY = "INNTEL_CORP_STATE_CLEAN_V1";
const USERS_KEY = "INNTEL_SYSTEM_USERS_PROD_V1";
const AUTH_KEY = "INNTEL_AUTH_USER_PROD_V1";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthLoaded, setIsAuthLoaded] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<UserProfile>(INITIAL_USER);
  const [dataReady, setDataReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const snapshotGeneration = useRef(0);
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
  const [ticketDepartmentRecords, setTicketDepartmentRecords] = useState<TicketDepartmentRecord[]>([]);
  const [ticketAssignees, setTicketAssignees] = useState<Pick<UserProfile, "uid" | "displayName" | "role">[]>([]);
  const [userRoleTemplates, setUserRoleTemplates] = useState<UserRoleTemplate[]>([]);
  const ticketDepartments = useMemo(() => resolveTicketDepartments(ticketDepartmentRecords), [ticketDepartmentRecords]);
  const [expenses, setExpenses] = useState<Expense[]>(INITIAL_EXPENSES);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
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
    if (["vault", "clientVaultItems"].includes(collectionName)) {
      // Object.assign alone leaves the submitted password on the original object.
      Object.keys(data).forEach(key => { delete data[key]; });
      Object.assign(data, vaultMetadata(response.result));
    } else Object.assign(data, response.result);
  };

  const deleteFromFirestore = async (collectionName: string, id: string) => {
    await api("/api/data", {
      action: "delete", entity: collectionName === "users" ? "systemUsers" : collectionName, id,
    });
  };

  // Initial load preserves historical recovery data without hydrating the session.
  useEffect(() => {
    try {
      // Preserve records that may never have reached the server before refreshing.
      const cached = localStorage.getItem(STORAGE_KEY);
      const recoveryKey = `INNTEL_RECOVERY_${STORAGE_KEY}`;
      if (cached && !localStorage.getItem(recoveryKey)) localStorage.setItem(recoveryKey, cached);
      // Older cache keys remain available as snapshot recovery sources.

      // Local caches never authorize a session or supply permissions.
      localStorage.removeItem(AUTH_KEY);
      localStorage.removeItem(`${AUTH_KEY}_SIG`);
      localStorage.removeItem(USERS_KEY);

    } catch (e) {
      console.warn("Error loading local state:", e);
    }
  }, []);

  // Only Firebase identity plus the server's active profile can authorize access.
  useEffect(() => {
    const invalidateSnapshot = () => { snapshotGeneration.current++; };
    const unsubscribe = observeVerifiedSession({
      subscribe: (listener) => onAuthStateChanged(auth, listener),
      loadProfile: () => api<UserProfile>("/api/session"),
      pending: () => {
        invalidateSnapshot();
        setIsAuthLoaded(false);
        setIsAuthenticated(false);
        setDataReady(false);
      },
      authenticated: (profile) => {
        setCurrentUser(profile);
        setIsAuthenticated(true);
        setIsAuthLoaded(true);
      },
      guest: () => {
        setCurrentUser(INITIAL_USER);
        setIsAuthLoaded(true);
      },
      failed: () => {
        setIsAuthenticated(false);
        setIsAuthLoaded(true);
        void signOut(auth).catch(() => {});
      },
    });
    return () => { invalidateSnapshot(); unsubscribe(); };
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

  const login = async (
    email: string,
    password: string,
    remember: boolean = true
  ): Promise<LoginResult> => {
    setIsAuthenticated(false);
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    // Normalización de homóglifos tipográficos (ejemplo: '×' \u00d7 vs letra 'x') y variantes
    const variants: string[] = [cleanPassword];
    const normalizedX = cleanPassword.replace(/[\u00d7\u2715\u2716\u2a09]/g, "x");
    if (normalizedX !== cleanPassword) variants.push(normalizedX);
    const normalizedCross = cleanPassword.replace(/x/g, "×");
    if (normalizedCross !== cleanPassword && !variants.includes(normalizedCross)) variants.push(normalizedCross);

    try {
      const { setPersistence, browserLocalPersistence, browserSessionPersistence } = await import("firebase/auth");
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);

      let lastError: any = null;
      let authenticated = false;

      for (const passVariant of variants) {
        try {
          await signInWithEmailAndPassword(auth, cleanEmail, passVariant);
          authenticated = true;
          break;
        } catch (err: any) {
          lastError = err;
          if (err?.code !== "auth/invalid-credential" && err?.code !== "auth/wrong-password") {
            break;
          }
        }
      }

      if (!authenticated) {
        await signOut(auth).catch(() => {});
        setIsAuthenticated(false);
        const code = lastError?.code || "auth/invalid-credential";
        let msg = "Usuario o contraseña erróneos.";
        if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
          msg = "Credenciales incorrectas. Verifica tu usuario y contraseña (evita espacios y asegúrate de usar 'x' en lugar de símbolos como '×').";
        } else if (code === "auth/too-many-requests") {
          msg = "Demasiados intentos fallidos en Firebase. La cuenta se encuentra temporalmente protegida; espera unos minutos.";
        } else if (code === "auth/user-disabled") {
          msg = "Esta cuenta ha sido inhabilitada. Contacta al soporte del sistema.";
        } else if (code === "auth/network-request-failed") {
          msg = "Error de red al conectar con Firebase. Revisa tu conexión a internet.";
        } else if (code === "auth/unauthorized-domain") {
          msg = "Dominio no autorizado en Firebase Authentication.";
        }
        return { success: false, error: msg, code };
      }

      const profile = await api<UserProfile>("/api/session");
      setCurrentUser(profile);
      setIsAuthenticated(true);
      return { success: true };
    } catch (err: any) {
      await signOut(auth).catch(() => {});
      setIsAuthenticated(false);
      return {
        success: false,
        error: err?.message || "No se pudo validar la sesión del servidor.",
        code: "server/session-error"
      };
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
    const request = ++snapshotGeneration.current;
    const uid = auth.currentUser?.uid;
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
      { name: "ticketDepartments", setter: setTicketDepartmentRecords, initialData: [] },
      { name: "expenses", setter: setExpenses, initialData: INITIAL_EXPENSES },
      { name: "expenseCategories", setter: setExpenseCategories, initialData: [] },
      { name: "monthlyCharges", setter: setMonthlyCharges, initialData: INITIAL_MONTHLY_CHARGES },
      { name: "clientAdvances", setter: setClientAdvances, initialData: [] },
      { name: "projects", setter: setProjects, initialData: INITIAL_PROJECTS },
      { name: "clientProjects", setter: setClientProjects, initialData: INITIAL_PROJECT_TASKS },
      { name: "clientQuotes", setter: setClientQuotes, initialData: INITIAL_QUOTES },
      { name: "clientVaultItems", setter: setClientVaultItems, initialData: INITIAL_CLIENT_VAULT },
      { name: "clientContracts", setter: setClientContracts, initialData: INITIAL_CONTRACTS },
      { name: "users", setter: setSystemUsers, initialData: INITIAL_SYSTEM_USERS },
      { name: "userRoleTemplates", setter: setUserRoleTemplates, initialData: [] },
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
    // A slow earlier read must not overwrite balances loaded after a payment/reversal.
    if (request !== snapshotGeneration.current || uid !== auth.currentUser?.uid) return;
    collectionsToSync.forEach((col) => {
      const entityKey = col.name === "users" ? "systemUsers" : col.name;
      if (!Array.isArray(serverSnapshot[entityKey])) throw new Error(`Falta la colección ${entityKey} en la respuesta del servidor.`);
      col.setter(serverSnapshot[entityKey]);
    });
    if (serverSnapshot.currentUser?.uid === uid) setCurrentUser(serverSnapshot.currentUser);
    setTicketAssignees(Array.isArray(serverSnapshot.ticketAssignees) ? serverSnapshot.ticketAssignees : []);
    if (serverSnapshot.sriCompanyConfig?.[0]) setSriCompanyConfig(serverSnapshot.sriCompanyConfig[0]);
    const concession = serverSnapshot.systemConfig?.find((row: any) => row.id === "arcotelConcession");
    setArcotelConcession(normalizeConcession(concession));
    setLoadError("");
    setDataReady(true);
  }, []);

  const pendingOperation = async (action: string, payload: unknown) => {
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify({ action, data: payload }))))).map(b => b.toString(16).padStart(2, "0")).join("");
    const key = `INNTEL_PENDING_${currentUser.uid}_${hash}`;
    let operationId = sessionStorage.getItem(key);
    if (!operationId) { operationId = crypto.randomUUID(); sessionStorage.setItem(key, operationId); }
    return { key, operationId };
  };

  const runCommercial = async <T,>(action: string, data: Record<string, unknown>, refreshAfter = true): Promise<T> => {
    const payload = JSON.parse(JSON.stringify(data));
    const { key, operationId } = await pendingOperation(action, payload);
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
      case "expenseCategories":
        setExpenseCategories(prev => [...prev.filter(category => category.id !== targetId), recordWithId as unknown as ExpenseCategory]);
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
      case "ticketDepartments":
        setTicketDepartmentRecords(prev => [...prev.filter(row => row.id !== targetId), recordWithId as TicketDepartmentRecord]);
        break;
      case "userRoleTemplates":
        setUserRoleTemplates(prev => [...prev.filter(row => row.id !== targetId), recordWithId as UserRoleTemplate]);
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
      id: "clv-" + crypto.randomUUID(),
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
      prev.map((v) => vaultMetadata(v.id === id ? { ...v, ...updated } : v))
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
      id: "vlt-" + crypto.randomUUID(),
      updatedAt: new Date().toISOString(),
    };
    await syncToFirestore("vault", newCred.id, newCred);
    setVault((prev) => [newCred, ...prev]);
    addAuditLog("UPDATE_VAULT", `Credencial: ${newCred.serviceName}`, `Usuario: ${newCred.username}`);
  };

  const updateVaultCredential = async (id: string, updates: Partial<VaultCredential>) => {
    const updated = { ...updates, updatedAt: new Date().toISOString() };
    await syncToFirestore("vault", id, updated);
    setVault((prev) => prev.map((v) => vaultMetadata(v.id === id ? { ...v, ...updated } : v)));
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
      id: "arc-" + crypto.randomUUID(),
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
      id: "tck-" + crypto.randomUUID(),
      ticketNumber: "",
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

    await api("/api/tickets/reply", { id, messageId: crypto.randomUUID(), body: text, isInternal, status: newStatus });
    await refresh();
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

  const updateExpense = async (id: string, expense: Omit<Expense, "id">, expectedVersion?: number) => {
    await runCommercial("editExpense", { ...expense, id, expectedVersion });
  };

  const deleteExpense = async (id: string, expectedVersion?: number) => {
    await runCommercial("deleteExpense", { id, expectedVersion });
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

  const applyClientCredit = async (chargeId: string, amount: number, date?: string, notes?: string): Promise<void> => {
    await runCommercial("applyClientCredit", { chargeId, amount, date, notes });
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
    if (data.documentType !== "nota_venta") throw new Error("Emite la factura SRI desde una nota de venta registrada.");
    return runCommercial<SriInvoice>("issueSale", data);
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

  const updateInvoiceStatus = async (id: string, status: SriInvoice["status"]) => {
    if (status !== "anulada" || billingInvoices.find(invoice => invoice.id === id)?.documentType !== "nota_venta") {
      throw new Error("Consulta el estado tributario en Facturación SRI.");
    }
    await runCommercial("cancelSale", { id, reason: "Anulación comercial" });
  };

  const updateInvoice = async (id: string, updates: Partial<SriInvoice>) => {
    if (billingInvoices.find(invoice => invoice.id === id)?.documentType !== "nota_venta") {
      throw new Error("Los documentos fiscales se administran en Facturación SRI.");
    }
    return runCommercial<SriInvoice>("editSale", { id, updates });
  };

  const deleteInvoice = async (id: string) => {
    await updateInvoiceStatus(id, "anulada");
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

  const runFiscal = async <T,>(request: SriSubmission): Promise<T> => {
    const operation = request.kind === "factura" || request.kind === "consultar" || request.correctionId
      ? null : await pendingOperation("sri", request);
    const result = await api<{ document: T }>("/api/sri/emitir", { ...request, operationId: operation?.operationId });
    await refresh();
    if (operation) sessionStorage.removeItem(operation.key);
    return result.document;
  };

  const convertSaleToSriInvoice = (saleId: string, customData?: Partial<SriInvoice>, correctionId?: string) =>
    runFiscal<SriInvoice>({
      kind: "factura", saleId, correctionId, clientId: customData?.clientId, clientRuc: customData?.clientRuc,
      clientEmail: customData?.clientEmail || undefined, clientAddress: customData?.clientAddress || undefined,
    });

  const createCreditNote = (data: Omit<CreditNote, "id" | "claveAcceso" | "documentNumber" | "createdAt" | "kardexReentered">, correctionId?: string) =>
    runFiscal<CreditNote>({ kind: "nota_credito", correctionId, invoiceId: data.invoiceId, reason: data.reason,
      items: data.items.map(({ id, quantity }) => ({ id, quantity })) });

  const createDebitNote = (data: Omit<DebitNote, "id" | "claveAcceso" | "documentNumber" | "createdAt">, correctionId?: string) => {
    if (!data.invoiceId || !data.paymentCode) throw new Error("Selecciona la factura de sustento y la forma de pago.");
    return runFiscal<DebitNote>({ kind: "nota_debito", correctionId, invoiceId: data.invoiceId, ivaRate: data.ivaRate,
      paymentCode: data.paymentCode, reasons: data.reasons });
  };

  const createWithholding = (data: Omit<Extract<SriRequest, { kind: "retencion" }>, "kind">, correctionId?: string) =>
    runFiscal<WithholdingReceipt>({ kind: "retencion", correctionId, ...data });

  const createRemissionGuide = (data: Omit<RemissionGuide, "id" | "claveAcceso" | "documentNumber" | "createdAt"> & { invoiceId?: string }, correctionId?: string) =>
    runFiscal<RemissionGuide>({ kind: "guia_remision", correctionId, ...data });

  const consultFiscalDocument = (documentKind: FiscalKind, id: string, retry = false) =>
    runFiscal<SriFiscalEvidence>({ kind: "consultar", documentKind, id, retry });

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
  const homeRoute = firstAccessibleRoute(currentUser);
  const router = useRouter();
  useEffect(() => {
    if (isAuthenticated && dataReady && pathname === "/" && !hasAccess && homeRoute) router.replace(homeRoute);
  }, [isAuthenticated, dataReady, pathname, hasAccess, homeRoute, router]);

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
          ticketDepartments,
          ticketAssignees,
          userRoleTemplates,
          expenses,
          expenseCategories,
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
          updateExpense,
          deleteExpense,
          generateMonthlyBillingBatch,
          markChargeAsPaid,
          addMonthlyCharge,
          updateMonthlyCharge,
          deleteMonthlyCharge,
          addPaymentToCharge,
          addClientAdvance,
          applyClientAdvance,
          applyClientCredit,
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
          consultFiscalDocument,
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
          isNavigationOpen,
          setIsNavigationOpen,
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
                  {homeRoute && <BackButton href={homeRoute} label="Ir a mi inicio" />}
                  <button type="button" className="px-3 py-2 text-xs text-[#004ac6]" onClick={() => void logout()}>Cerrar sesión</button>
                </div>
              </div>
            )
          ) : (
            <LoginScreen />
          )
        ) : (
          <div className="min-h-screen bg-[#f8f9ff] flex flex-col gap-4 items-center justify-center" role="status" aria-live="polite">
            <div aria-hidden="true" className="w-8 h-8 border-2 border-[#004ac6] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-600">Restaurando sesión…</p>
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
