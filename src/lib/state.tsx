"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { ToastProvider } from "./toast-context";
import { LoginScreen } from "@/components/auth/LoginScreen";
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
  Expense,
  MonthlyCharge,
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
import { app, db, auth } from "./firebase";
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { collection, doc, setDoc, deleteDoc, onSnapshot, getDocs, updateDoc, arrayUnion } from "firebase/firestore";
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
import { simpleDecrypt, simpleEncrypt } from "./crypto-vault";
import {
  signUserProfile,
  verifyUserProfileIntegrity,
  triggerSecurityExplosion,
} from "./security-shield";
import { SecurityLockoutModal } from "@/components/security/SecurityLockoutModal";

interface AppContextType {
  currentUser: UserProfile;
  setUserRole: (role: UserRole) => void;
  isAuthenticated: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<boolean>;
  logout: () => Promise<void>;
  revealCredential: (entity: "vault" | "clientVaultItems", id: string) => Promise<string>;
  refresh: () => Promise<void>;
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

  addPolicy: (policy: Omit<ArcotelPolicy, "id">) => Promise<void>;
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
    remainingBalance?: number
  ) => Promise<void>;
  addMonthlyCharge: (charge: Omit<MonthlyCharge, "id">) => Promise<void>;

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
    paymentMethod?: SriInvoice["paymentMethod"]
  ) => Promise<SriInvoice>;
  createCreditNote: (
    data: Omit<CreditNote, "id" | "claveAcceso" | "documentNumber" | "createdAt" | "kardexReentered">
  ) => Promise<CreditNote>;
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
const STORAGE_KEY = "INNTEL_CORP_STATE_PROD_DEMO_CLIENT_V1";
const USERS_KEY = "INNTEL_SYSTEM_USERS_PROD_V1";
const AUTH_KEY = "INNTEL_AUTH_USER_PROD_V1";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthLoaded, setIsAuthLoaded] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<UserProfile>(INITIAL_USER);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>(INITIAL_SYSTEM_USERS);

  const [clients, setClients] = useState<Client[]>(INITIAL_CLIENTS);
  const [clientServices, setClientServices] = useState<ClientService[]>(INITIAL_CLIENT_SERVICES);
  const [plans, setPlans] = useState<Plan[]>(INITIAL_PLANS);
  const [nodes, setNodes] = useState<NodeLocation[]>(INITIAL_NODES);
  const [ipPools, setIpPools] = useState<IpPool[]>(INITIAL_IP_POOLS);
  const [policies, setPolicies] = useState<ArcotelPolicy[]>(INITIAL_POLICIES);
  const [vault, setVault] = useState<VaultCredential[]>(INITIAL_VAULT);
  const [tickets, setTickets] = useState<Ticket[]>(INITIAL_TICKETS);
  const [expenses, setExpenses] = useState<Expense[]>(INITIAL_EXPENSES);
  const [monthlyCharges, setMonthlyCharges] = useState<MonthlyCharge[]>(INITIAL_MONTHLY_CHARGES);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INITIAL_AUDIT_LOGS);

  // Projects & Tasks State (Notion-style hierarchy)
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [clientProjects, setClientProjects] = useState<ClientProjectTask[]>(INITIAL_PROJECT_TASKS);
  const [clientQuotes, setClientQuotes] = useState<ClientQuoteOrder[]>(INITIAL_QUOTES);
  const [clientVaultItems, setClientVaultItems] = useState<ClientVaultItem[]>(INITIAL_CLIENT_VAULT);
  const [clientContracts, setClientContracts] = useState<ClientContractInfo[]>(INITIAL_CONTRACTS);
  const [arcotelConcession, setArcotelConcession] = useState<ArcotelConcessionInfo>(INITIAL_CONCESSION_INFO);
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
  const [hostingDomains, setHostingDomains] = useState<HostingDomainRecord[]>(INITIAL_HOSTING_DOMAINS);
  const [regulatoryTramites, setRegulatoryTramites] = useState<RegulatoryTramite[]>(INITIAL_REGULATORY_TRAMITES);

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const pathname = usePathname();

  // Synchronize state directly to Firestore cloud database
  const syncToFirestore = async (collectionName: string, id: string, data: any) => {
    try {
      const cleanData = JSON.parse(JSON.stringify(data));
      await setDoc(doc(db, collectionName, id), cleanData, { merge: true });
    } catch (err: any) {
      console.warn(`Firestore sync note (${collectionName}/${id}):`, err?.message);
      if (["clientContracts", "clientVaultItems", "vault", "nodes", "tickets"].includes(collectionName)) throw err;
    }
  };

  const deleteFromFirestore = async (collectionName: string, id: string) => {
    try {
      await deleteDoc(doc(db, collectionName, id));
    } catch (err: any) {
      console.warn(`Firestore delete note (${collectionName}/${id}):`, err?.message);
      if (["clientContracts", "clientVaultItems", "vault", "nodes", "tickets"].includes(collectionName)) throw err;
    }
  };

  // Initial load from LocalStorage cache and Firebase session
  useEffect(() => {
    try {
      // 0. Clean legacy demo caches
      ["INNTEL_CORP_STATE_HUB_V6", "INNTEL_CORP_STATE_HUB_V5", "INNTEL_CORP_STATE_HUB_V4"].forEach((k) => {
        try { localStorage.removeItem(k); } catch (e) {}
      });

      // 1. Check saved users & migrate legacy domains
      const savedUsers = localStorage.getItem(USERS_KEY);
      let activeUsers = INITIAL_SYSTEM_USERS;
      if (savedUsers) {
        try {
          const parsed = JSON.parse(savedUsers);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const migrated = parsed.map((u: any) => ({
              ...u,
              email: u.email ? u.email.replace(/@inntelcorp\.ec$/i, "@inntelcorp.com") : u.email,
            }));
            activeUsers = migrated;
            setSystemUsers(migrated);
            localStorage.setItem(USERS_KEY, JSON.stringify(migrated));
          }
        } catch (e) {}
      }

      // 2. Check auth session with Anti-Tampering Integrity Guard
      const savedAuth = localStorage.getItem(AUTH_KEY);
      const savedSig = localStorage.getItem(`${AUTH_KEY}_SIG`);
      if (savedAuth) {
        try {
          const user = JSON.parse(savedAuth);
          if (user && user.email) {
            user.email = user.email.replace(/@inntelcorp\.ec$/i, "@inntelcorp.com");

            // Si hay firma, verificar que el rol/email no hayan sido adulterados
            if (savedSig) {
              const isSignatureValid = verifyUserProfileIntegrity(user, savedSig);
              if (!isSignatureValid) {
                console.error("[ANTI-TAMPER SHIELD] Sesión adulterada en LocalStorage. Destruyendo sesión.");
                localStorage.removeItem(AUTH_KEY);
                localStorage.removeItem(`${AUTH_KEY}_SIG`);
                triggerSecurityExplosion(
                  "DETECCIÓN DE MANIPULACIÓN: Se detectó una alteración ilegal de privilegios o roles en el almacenamiento local. La sesión ha sido destruida preventivamente."
                );
                return;
              }
            } else {
              // Si no tenía firma, firmar la sesión legítima inicial
              const { integritySignature } = signUserProfile(user);
              localStorage.setItem(`${AUTH_KEY}_SIG`, integritySignature);
            }

            const matched = activeUsers.find(
              (u) => u.email.toLowerCase() === user.email.toLowerCase() && u.status === "activo"
            );
            if (matched) {
              setCurrentUser(matched);
              setIsAuthenticated(true);
            } else if (user.uid) {
              setCurrentUser(user);
              setIsAuthenticated(true);
            }
          }
        } catch (e) {}
      }

      // 3. Check saved business state
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
          if (Array.isArray(p.expenses)) setExpenses(p.expenses);
          if (Array.isArray(p.monthlyCharges)) setMonthlyCharges(p.monthlyCharges);
          if (Array.isArray(p.auditLogs)) setAuditLogs(p.auditLogs);
          if (Array.isArray(p.clientProjects)) setClientProjects(p.clientProjects);
          if (Array.isArray(p.clientQuotes)) setClientQuotes(p.clientQuotes);
          if (Array.isArray(p.clientVaultItems)) setClientVaultItems(p.clientVaultItems);
          if (Array.isArray(p.clientContracts)) setClientContracts(p.clientContracts);
          if (p.arcotelConcession) setArcotelConcession(p.arcotelConcession);
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
          if (Array.isArray(p.bankAccounts)) setBankAccounts(p.bankAccounts);
          if (Array.isArray(p.financialMovements)) setFinancialMovements(p.financialMovements);
          if (Array.isArray(p.supplierPayments)) setSupplierPayments(p.supplierPayments);
        } catch (e) {}
      }
    } catch (e) {
      console.warn("Error loading local state:", e);
    } finally {
      setIsAuthLoaded(true);
    }
  }, []);

  // Listen for Firebase Auth changes
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        const emailLower = firebaseUser.email.toLowerCase();
        const matched = systemUsers.find((u) => u.email.toLowerCase() === emailLower);
        if (matched) {
          setCurrentUser(matched);
          setIsAuthenticated(true);
        }
      }
    });
    return () => unsubscribe();
  }, [systemUsers]);

  // Sincronización en tiempo real con la colección 'users' de Firestore
  useEffect(() => {
    if (!db) return;
    const unsubscribe = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        if (!snapshot.empty) {
          const firestoreUsers = snapshot.docs.map((d) => {
            const data = d.data();
            return {
              uid: d.id,
              email: data.email,
              displayName: data.displayName,
              role: data.role,
              department: data.department || "",
              phone: data.phone || "",
              status: data.status || "activo",
              passwordHash:
                data.passwordHash ||
                INITIAL_SYSTEM_USERS.find((u) => u.uid === d.id)?.passwordHash ||
                "",
              permissions: data.permissions || ["all"],
              createdAt: data.createdAt || new Date().toISOString(),
            } as SystemUser;
          });
          setSystemUsers(firestoreUsers);
          try {
            localStorage.setItem(USERS_KEY, JSON.stringify(firestoreUsers));
          } catch (e) {}
        }
      },
      (error) => {
        console.warn("Firestore users sync note:", error?.message);
      }
    );
    return () => unsubscribe();
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
    if (!isAuthLoaded) return;
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
          expenses,
          monthlyCharges,
          auditLogs,
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
    expenses,
    monthlyCharges,
    auditLogs,
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
    void syncToFirestore("auditLogs", newLog.id, newLog).catch(() => {
      window.dispatchEvent(new CustomEvent("inntel:error", {
        detail: "La operación terminó, pero no se pudo guardar su registro de auditoría.",
      }));
    });
  };

  const login = async (email: string, password: string, remember: boolean = true): Promise<boolean> => {
    const trimmedEmail = email.trim().toLowerCase();

    // 1. Try Firebase Auth (with auto-provisioning if enabled)
    try {
      if (auth) {
        try {
          const userCred = await signInWithEmailAndPassword(auth, trimmedEmail, password);
          if (userCred.user) {
            const matched = systemUsers.find((u) => u.email.toLowerCase() === trimmedEmail);
            const activeProfile: UserProfile = matched || {
              uid: userCred.user.uid,
              email: userCred.user.email || trimmedEmail,
              displayName: userCred.user.displayName || "Operador INNTEL",
              role: "admin",
              status: "activo",
              permissions: ["all"],
            };
            setCurrentUser(activeProfile);
            setIsAuthenticated(true);
            if (remember) {
              const { integritySignature } = signUserProfile(activeProfile);
              localStorage.setItem(AUTH_KEY, JSON.stringify(activeProfile));
              localStorage.setItem(`${AUTH_KEY}_SIG`, integritySignature);
            }
            addAuditLog("LOGIN", `Acceso Firebase Auth: ${activeProfile.displayName}`, `Rol: ${activeProfile.role}`);
            return true;
          }
        } catch (authSignInErr: any) {
          if (authSignInErr?.code === "auth/user-not-found" || authSignInErr?.code === "auth/invalid-credential") {
            try {
              const newCred = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
              if (newCred.user) {
                const matched = systemUsers.find((u) => u.email.toLowerCase() === trimmedEmail);
                const activeProfile: UserProfile = matched || {
                  uid: newCred.user.uid,
                  email: newCred.user.email || trimmedEmail,
                  displayName: "Operador INNTEL",
                  role: "admin",
                  status: "activo",
                  permissions: ["all"],
                };
                setCurrentUser(activeProfile);
                setIsAuthenticated(true);
                if (remember) {
                  const { integritySignature } = signUserProfile(activeProfile);
                  localStorage.setItem(AUTH_KEY, JSON.stringify(activeProfile));
                  localStorage.setItem(`${AUTH_KEY}_SIG`, integritySignature);
                }
                addAuditLog("LOGIN", `Cuenta Creada & Acceso Firebase: ${activeProfile.displayName}`, `Rol: ${activeProfile.role}`);
                return true;
              }
            } catch (createErr) {
              // Proceed to system account validation
            }
          }
        }
      }
    } catch (firebaseErr: any) {
      console.log("Firebase Auth note (fallback to system accounts):", firebaseErr?.code);
    }

    // 2. Check against System Accounts (Mock & Saved Accounts)
    const account = systemUsers.find(
      (a) => a.email.toLowerCase() === trimmedEmail && a.passwordHash === password && a.status === "activo"
    );

    if (account) {
      const updatedUser: UserProfile = {
        uid: account.uid,
        email: account.email,
        displayName: account.displayName,
        role: account.role,
        department: account.department,
        phone: account.phone,
        status: account.status,
        permissions: account.permissions || ["all"],
      };

      setCurrentUser(updatedUser);
      setIsAuthenticated(true);

      setSystemUsers((prev) =>
        prev.map((u) => (u.uid === account.uid ? { ...u, lastLogin: new Date().toISOString() } : u))
      );

      if (remember) {
        const { integritySignature } = signUserProfile(updatedUser);
        localStorage.setItem(AUTH_KEY, JSON.stringify(updatedUser));
        localStorage.setItem(`${AUTH_KEY}_SIG`, integritySignature);
      }

      addAuditLog("LOGIN", `Acceso al Sistema: ${account.displayName}`, `Rol: ${account.role.toUpperCase()}`);
      return true;
    }

    return false;
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

  const setUserRole = (role: UserRole) => {
    setCurrentUser((prev) => {
      const updated = { ...prev, role };
      try {
        if (localStorage.getItem(AUTH_KEY)) {
          const { integritySignature } = signUserProfile(updated);
          localStorage.setItem(AUTH_KEY, JSON.stringify(updated));
          localStorage.setItem(`${AUTH_KEY}_SIG`, integritySignature);
        }
      } catch (e) {}
      return updated;
    });
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
      { name: "expenses", setter: setExpenses, initialData: INITIAL_EXPENSES },
      { name: "monthlyCharges", setter: setMonthlyCharges, initialData: INITIAL_MONTHLY_CHARGES },
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
      { name: "billingWithholdings", setter: setBillingWithholdings, initialData: INITIAL_WITHHOLDINGS },
      { name: "billingRemissionGuides", setter: setBillingRemissionGuides, initialData: INITIAL_REMISSION_GUIDES },
    ];

    await Promise.all(
      collectionsToSync.map(async (col) => {
        const entity = (col.name === "users" ? "systemUsers" : col.name) as Entity;
        if (!can(currentUser, collectionPermissions[entity])) {
          return;
        }
        try {
          const snap = await getDocs(collection(db, col.name));
          if (!snap.empty) {
            col.setter(
              snap.docs.map((d) => {
                const { passwordHash: _password, ...data } = d.data();
                return { ...data, id: d.id, ...(col.name === "users" ? { uid: d.id } : {}) };
              })
            );
          } else if (col.initialData && col.initialData.length > 0) {
            // Seed base configuration into Firestore
            col.initialData.forEach((item) => {
              const itemId = item.id || item.uid;
              if (itemId) {
                void syncToFirestore(col.name, itemId, item).catch(() => {
                  window.dispatchEvent(new CustomEvent("inntel:error", { detail: "No se pudieron guardar los datos iniciales de " + col.name }));
                });
              }
            });
          }
        } catch (e) {
          console.warn(`Firestore collection read note (${col.name}):`, e);
        }
      })
    );
  }, [currentUser]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const reload = () => {
      void refresh().catch((error: Error) => {
        console.warn("Refresh error note:", error?.message);
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
      case "billingWithholdings": setBillingWithholdings((prev) => prev.filter((w) => w.id !== id)); break;
      case "billingRemissionGuides": setBillingRemissionGuides((prev) => prev.filter((g) => g.id !== id)); break;
    }
  };

  const revealCredential = async (entity: "vault" | "clientVaultItems", id: string): Promise<string> => {
    if (entity === "clientVaultItems") {
      const item = clientVaultItems.find((v) => v.id === id);
      if (!item) throw new Error("Credencial no encontrada.");
      addAuditLog("VIEW_VAULT_PASSWORD", `Clave Cliente: ${item.serviceName}`, `Consulta por ${currentUser.role}`);
      return simpleDecrypt(item.encryptedPassword || "");
    } else {
      const item = vault.find((v) => v.id === id);
      if (!item) throw new Error("Credencial no encontrada.");
      addAuditLog("VIEW_VAULT_PASSWORD", `Bóveda General: ${item.serviceName}`, `Consulta por ${currentUser.role}`);
      return simpleDecrypt(item.encryptedPassword || "");
    }
  };

  // User Management
  const addSystemUser = async (userData: Omit<SystemUser, "uid" | "createdAt">) => {
    const newUid = "usr-" + Date.now();
    const newUser: SystemUser = {
      ...userData,
      uid: newUid,
      createdAt: new Date().toISOString(),
    };
    await syncToFirestore("users", newUid, newUser);
    setSystemUsers((prev) => [newUser, ...prev]);
    addAuditLog("CREATE_USER", `Usuario: ${newUser.displayName}`, `Rol: ${newUser.role} | Email: ${newUser.email}`);
  };

  const updateSystemUser = async (uid: string, updates: Partial<SystemUser>) => {
    await syncToFirestore("users", uid, updates);
    setSystemUsers((prev) =>
      prev.map((u) => (u.uid === uid ? { ...u, ...updates } : u))
    );
    if (currentUser.uid === uid) {
      setCurrentUser((prev) => ({ ...prev, ...updates }));
    }
    addAuditLog("UPDATE_USER", `Usuario ID: ${uid}`, JSON.stringify(updates));
  };

  const deleteSystemUser = async (uid: string): Promise<boolean> => {
    const target = systemUsers.find((u) => u.uid === uid);
    if (!target) return false;
    if (target.role === "superadmin" && systemUsers.filter((u) => u.role === "superadmin").length <= 1) {
      return false;
    }
    await deleteFromFirestore("users", uid);
    setSystemUsers((prev) => prev.filter((u) => u.uid !== uid));
    addAuditLog("DELETE_USER", `Usuario: ${target.displayName}`, `Email: ${target.email}`);
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
    clientData: Omit<Client, "id" | "createdAt" | "updatedAt">,
    serviceData?: Partial<ClientService>
  ): Promise<Client> => {
    const newId = "cli-" + (clients.length + 1).toString().padStart(3, "0");
    const cleanIdentification = String(clientData.identificationNumber || "")
      .replace(/\s+/g, "")
      .trim();
    const cleanEmail = String(clientData.email || "")
      .replace(/\s+/g, "")
      .trim()
      .toLowerCase();
    const newClient: Client = {
      ...clientData,
      identificationNumber: cleanIdentification,
      email: cleanEmail,
      businessName: String(clientData.businessName || "").replace(/\s+/g, " ").trim(),
      address: String(clientData.address || "").replace(/\s+/g, " ").trim(),
      id: newId,
      totalActiveServices: serviceData ? 1 : 0,
      currentBalance: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await syncToFirestore("clients", newId, newClient);
    setClients((prev) => [newClient, ...prev]);

    if (serviceData) {
      const plan = plans.find((p) => p.id === serviceData.planId) || plans[0];
      const node = serviceData.nodeId ? nodes.find((n) => n.id === serviceData.nodeId) : null;
      const newService: ClientService = {
        id: "srv-" + Date.now(),
        clientId: newId,
        planId: plan ? plan.id : "plan-100m",
        planName: plan ? plan.name : "Fibra Óptica Dedicado",
        downloadMbps: plan ? plan.downloadMbps : 100,
        uploadMbps: plan ? plan.uploadMbps : 100,
        basePrice: plan ? plan.defaultPrice : 28.0,
        customPrice: serviceData.customPrice || (plan ? plan.defaultPrice : 28.0),
        billingType: serviceData.billingType || (plan ? plan.billingType : "pospago"),
        cutoffDay: serviceData.cutoffDay || 1,
        nodeId: node ? node.id : "",
        nodeName: node ? node.name : "Sin nodo asignado",
        ipv4Address: serviceData.ipv4Address || `100.64.10.${Math.floor(Math.random() * 200) + 10}`,
        pppoeUser: serviceData.pppoeUser || newClient.identificationNumber,
        status: "activo",
        installationDate: new Date().toISOString().split("T")[0],
      };
      await syncToFirestore("clientServices", newService.id, newService);
    setClientServices((prev) => [...prev, newService]);

      // Auto-create default contract and project task
      await addClientContract({
        clientId: newId,
        contractNumber: `CONT-INNTEL-2026-${newId.toUpperCase()}`,
        arcotelHomologationCode: "ARCOTEL-SAI-HOM-0841",
        planName: newService.planName,
        signedDate: new Date().toISOString().split("T")[0],
        expirationDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split("T")[0],
        status: "vigente",
        monthlyPrice: newService.customPrice,
        notes: "Contrato estándar de adhesión para servicio de acceso a internet",
      });

      await addClientProjectTask({
        clientId: newId,
        clientName: newClient.businessName,
        title: `Instalación Fibra Óptica: ${newService.planName}`,
        description: `Despliegue de acometida de fibra óptica e instalación de ONT en ${newClient.address}`,
        column: "factibilidad",
        priority: "alta",
        assignedTo: "Cuadrilla NOC Central",
        dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0],
        checklist: [
          { id: "chk-1", text: "Inspección de caja NAP y nivel de potencia óptica (dBm)", done: false },
          { id: "chk-2", text: "Tendido de cable drop y herrajes", done: false },
          { id: "chk-3", text: "Fusión de pigtail y conectorización SC/APC", done: false },
          { id: "chk-4", text: "Aprovisionamiento de ONT y pruebas de velocidad", done: false },
        ],
      });
    }

    addAuditLog("CREATE_CLIENT", `Cliente: ${newClient.businessName}`, `ID: ${newClient.identificationNumber}`);
    return newClient;
  };

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
    await deleteFromFirestore("clients", id);
    setClients((prev) => prev.filter((c) => c.id !== id));
    setClientServices((prev) => prev.filter((s) => s.clientId !== id));
    setClientProjects((prev) => prev.filter((p) => p.clientId !== id));
    setClientQuotes((prev) => prev.filter((q) => q.clientId !== id));
    setClientVaultItems((prev) => prev.filter((v) => v.clientId !== id));
    setClientContracts((prev) => prev.filter((c) => c.clientId !== id));
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
    setArcotelConcession((prev) => ({ ...prev, ...updates }));
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

    try {
      await updateDoc(doc(db, "tickets", id), {
        messages: arrayUnion(message),
        ...updates,
      });
    } catch (e) {
      console.warn("Firestore replyToTicket sync note:", e);
    }

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
    const newExpense: Expense = { ...expenseData, id: "exp-" + Date.now() };
    await syncToFirestore("expenses", newExpense.id, newExpense);
    setExpenses((prev) => [newExpense, ...prev]);
    addAuditLog("CREATE_EXPENSE", `Gasto: ${newExpense.supplierName}`, `$${newExpense.amount}`);
  };

  const generateMonthlyBillingBatch = async (month: number, year: number) => {
    const newCharges: MonthlyCharge[] = clients.map((client) => {
      const clientServs = clientServices.filter((s) => s.clientId === client.id && s.status === "activo");
      const totalAmount = clientServs.reduce((sum, s) => sum + s.customPrice, 0) || 28.0;
      const subtotal = totalAmount / 1.15;
      const iva = totalAmount - subtotal;
      const planNames = clientServs.map((s) => s.planName).join(" + ") || "Servicio de Internet";
      return {
        id: `chg-${client.id}-${month}-${year}`,
        clientId: client.id,
        clientName: client.businessName,
        clientRuc: client.identificationNumber,
        month,
        year,
        serviceDescription: `${planNames} - Periodo ${month}/${year}`,
        subtotal: parseFloat(subtotal.toFixed(2)),
        ivaAmount: parseFloat(iva.toFixed(2)),
        total: parseFloat(totalAmount.toFixed(2)),
        status: "pendiente",
        invoiceNumber: `001-100-${Math.floor(Math.random() * 900000 + 100000)}`,
      };
    });
    setMonthlyCharges((prev) => [...newCharges, ...prev]);
    newCharges.forEach((c) => syncToFirestore("monthlyCharges", c.id, c));
    addAuditLog("EXPORT_BILLING", "Emisión Cobros Día 1", `Lote para ${clients.length} clientes`);
  };

  const addMonthlyCharge = async (chargeData: Omit<MonthlyCharge, "id">) => {
    const newCharge: MonthlyCharge = {
      ...chargeData,
      id: "chg-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
    };
    await syncToFirestore("monthlyCharges", newCharge.id, newCharge);
    setMonthlyCharges((prev) => [newCharge, ...prev]);
    addAuditLog("CREATE_EXPENSE", `Factura Manual: ${newCharge.invoiceNumber}`, `$${newCharge.total} USD - ${newCharge.clientName}`);
  };

  const markChargeAsPaid = async (
    chargeId: string,
    method: string,
    reference?: string,
    paidAmount?: number,
    remainingBalance?: number
  ) => {
    const charge = monthlyCharges.find((c) => c.id === chargeId);
    if (!charge) return;

    if (remainingBalance && remainingBalance > 0 && paidAmount && paidAmount < charge.total) {
      // Abono: mark current as paid for the partial amount
      const updated = {
        status: "pagado" as const,
        paymentDate: new Date().toISOString().split("T")[0],
        paymentMethod: method,
        paymentReference: reference || "ABONO-REF",
        paidAmount: paidAmount,
        balanceRemaining: 0,
      };
      await syncToFirestore("monthlyCharges", chargeId, updated);

      // Create new invoice for remaining balance
      const remSubtotal = parseFloat((remainingBalance / 1.15).toFixed(2));
      const remIva = parseFloat((remainingBalance - remSubtotal).toFixed(2));
      const newBalanceCharge: MonthlyCharge = {
        id: "chg-bal-" + Date.now(),
        clientId: charge.clientId,
        clientName: charge.clientName,
        clientRuc: charge.clientRuc,
        month: charge.month,
        year: charge.year,
        serviceDescription: `Saldo restante / Abono pendiente factura #${charge.invoiceNumber}`,
        subtotal: remSubtotal,
        ivaAmount: remIva,
        total: remainingBalance,
        status: "pendiente",
        invoiceNumber: `${charge.invoiceNumber}-R`,
        parentChargeId: charge.id,
        maxPaymentDate: charge.maxPaymentDate,
      };
      await syncToFirestore("monthlyCharges", newBalanceCharge.id, newBalanceCharge);
      setMonthlyCharges((prev) => [
        newBalanceCharge,
        ...prev.map((c) => (c.id === chargeId ? { ...c, ...updated } : c)),
      ]);
      addAuditLog("EXPORT_BILLING", `Abono a Factura: ${charge.invoiceNumber}`, `Abonado: $${paidAmount}, Saldo pendiente: $${remainingBalance}`);
    } else {
      const updated = {
        status: "pagado" as const,
        paymentDate: new Date().toISOString().split("T")[0],
        paymentMethod: method,
        paymentReference: reference || undefined,
        paidAmount: charge.total,
        balanceRemaining: 0,
      };
      await syncToFirestore("monthlyCharges", chargeId, updated);
      setMonthlyCharges((prev) =>
        prev.map((c) => (c.id === chargeId ? { ...c, ...updated } : c))
      );
      addAuditLog("EXPORT_BILLING", `Pago Registrado: ${charge.invoiceNumber}`, `$${charge.total} - ${method}`);
    }
  };

  // ==========================================
  // INVENTORY MODULE METHODS
  // ==========================================

  const addInventoryProduct = async (productData: Omit<InventoryProduct, "id" | "createdAt" | "updatedAt">): Promise<InventoryProduct> => {
    const id = `prod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    const salePriceConIva = calculatePriceWithTax(productData.salePrice, productData.ivaRate);
    
    const stockByWarehouse = productData.stockByWarehouse || {};
    const totalStock = Object.values(stockByWarehouse).reduce((acc, val) => acc + (Number(val) || 0), 0);

    const newProduct: InventoryProduct = {
      ...productData,
      id,
      stock: productData.tracksStock ? totalStock : 0,
      salePriceConIva,
      createdAt: now,
      updatedAt: now,
    };

    await syncToFirestore("inventoryProducts", id, newProduct);
    setInventoryProducts((prev) => [newProduct, ...prev]);

    if (newProduct.tracksStock && totalStock > 0) {
      const defaultWhId = newProduct.defaultWarehouseId || Object.keys(stockByWarehouse)[0] || inventoryWarehouses[0]?.id;
      const wh = inventoryWarehouses.find((w) => w.id === defaultWhId) || inventoryWarehouses[0];
      if (wh) {
        const kardexDocNum = generateInventoryDocNumber("KDX", inventoryKardex.length);
        const kardexEntry = buildKardexEntry({
          product: newProduct,
          warehouse: wh,
          type: "POSITIVE_ADJUSTMENT",
          referenceId: id,
          referenceDocNumber: kardexDocNum,
          concept: `Stock inicial al registrar producto: ${newProduct.name}`,
          quantity: totalStock,
          unitCost: newProduct.baseCost,
          currentStock: 0,
          currentAvgCost: newProduct.baseCost,
          userName: currentUser.displayName,
        });

        await syncToFirestore("inventoryKardex", kardexEntry.id, kardexEntry);
        setInventoryKardex((prev) => [kardexEntry, ...prev]);
      }
    }

    addAuditLog("CREATE_EXPENSE", `Producto Creado: ${newProduct.name}`, `SKU: ${newProduct.sku} | Stock: ${newProduct.stock}`);
    return newProduct;
  };

  const updateInventoryProduct = async (id: string, updates: Partial<InventoryProduct>) => {
    const product = inventoryProducts.find((p) => p.id === id);
    if (!product) return;

    const merged = { ...product, ...updates, updatedAt: new Date().toISOString() };
    if (updates.salePrice !== undefined || updates.ivaRate !== undefined) {
      merged.salePriceConIva = calculatePriceWithTax(merged.salePrice, merged.ivaRate);
    }
    if (updates.stockByWarehouse) {
      merged.stock = Object.values(updates.stockByWarehouse).reduce((acc, val) => acc + (Number(val) || 0), 0);
    }

    await syncToFirestore("inventoryProducts", id, merged);
    setInventoryProducts((prev) => prev.map((p) => (p.id === id ? merged : p)));
    addAuditLog("CREATE_EXPENSE", `Producto Actualizado: ${product.name}`, `SKU: ${product.sku}`);
  };

  const deleteInventoryProduct = async (id: string) => {
    const product = inventoryProducts.find((p) => p.id === id);
    await deleteFromFirestore("inventoryProducts", id);
    setInventoryProducts((prev) => prev.filter((p) => p.id !== id));
    if (product) {
      addAuditLog("CREATE_EXPENSE", `Producto Eliminado: ${product.name}`, `SKU: ${product.sku}`);
    }
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

  const executeTransfer = async ({
    originWarehouseId,
    destWarehouseId,
    productId,
    quantity,
    reason,
  }: {
    originWarehouseId: string;
    destWarehouseId: string;
    productId: string;
    quantity: number;
    reason: string;
  }) => {
    if (originWarehouseId === destWarehouseId) {
      throw new Error("La bodega de origen y destino no pueden ser iguales.");
    }
    const product = inventoryProducts.find((p) => p.id === productId);
    if (!product) throw new Error("Producto no encontrado.");

    const originWh = inventoryWarehouses.find((w) => w.id === originWarehouseId);
    const destWh = inventoryWarehouses.find((w) => w.id === destWarehouseId);
    if (!originWh || !destWh) throw new Error("Bodega no válida.");

    const validation = validateStockAvailability(product, originWarehouseId, quantity);
    if (!validation.valid) throw new Error(validation.error);

    const transferDocNumber = generateInventoryDocNumber("TRF", inventoryTransfers.length);
    const transferId = `trf-${Date.now()}`;
    const now = new Date().toISOString();
    const qty = Math.abs(quantity);
    const cost = product.baseCost;

    // 1. Kardex TRANSFER_OUT en origen
    const currentOriginStock = Number(product.stockByWarehouse?.[originWarehouseId] || 0);
    const originKardex = buildKardexEntry({
      product,
      warehouse: originWh,
      type: "TRANSFER_OUT",
      referenceId: transferId,
      referenceDocNumber: transferDocNumber,
      concept: `Traslado a ${destWh.name}: ${reason}`,
      quantity: qty,
      unitCost: cost,
      currentStock: currentOriginStock,
      currentAvgCost: cost,
      userName: currentUser.displayName,
    });

    // 2. Kardex TRANSFER_IN en destino
    const currentDestStock = Number(product.stockByWarehouse?.[destWarehouseId] || 0);
    const destKardex = buildKardexEntry({
      product,
      warehouse: destWh,
      type: "TRANSFER_IN",
      referenceId: transferId,
      referenceDocNumber: transferDocNumber,
      concept: `Recepción de traslado desde ${originWh.name}: ${reason}`,
      quantity: qty,
      unitCost: cost,
      currentStock: currentDestStock,
      currentAvgCost: cost,
      userName: currentUser.displayName,
    });

    // 3. Actualizar stock del producto por bodega
    const updatedStockByWh = {
      ...(product.stockByWarehouse || {}),
      [originWarehouseId]: Math.max(0, currentOriginStock - qty),
      [destWarehouseId]: currentDestStock + qty,
    };
    const updatedProduct: InventoryProduct = {
      ...product,
      stockByWarehouse: updatedStockByWh,
      updatedAt: now,
    };

    // 4. Registro de Transferencia
    const transferRecord: WarehouseTransfer = {
      id: transferId,
      transferNumber: transferDocNumber,
      date: now,
      originWarehouseId,
      originWarehouseName: originWh.name,
      destWarehouseId,
      destWarehouseName: destWh.name,
      productId: product.id,
      productName: product.name,
      quantity: qty,
      unitCost: cost,
      totalCost: Math.round(qty * cost * 100) / 100,
      reason,
      responsibleUser: currentUser.displayName,
      status: "completada",
      createdAt: now,
    };

    // Persistir
    await Promise.all([
      syncToFirestore("inventoryKardex", originKardex.id, originKardex),
      syncToFirestore("inventoryKardex", destKardex.id, destKardex),
      syncToFirestore("inventoryTransfers", transferRecord.id, transferRecord),
      syncToFirestore("inventoryProducts", updatedProduct.id, updatedProduct),
    ]);

    setInventoryKardex((prev) => [originKardex, destKardex, ...prev]);
    setInventoryTransfers((prev) => [transferRecord, ...prev]);
    setInventoryProducts((prev) => prev.map((p) => (p.id === product.id ? updatedProduct : p)));

    addAuditLog("CREATE_EXPENSE", `Transferencia: ${transferDocNumber}`, `${qty} ${product.unit}s de ${originWh.code} a ${destWh.code}`);
  };

  const executeAdjustment = async ({
    warehouseId,
    type,
    concept,
    items,
  }: {
    warehouseId: string;
    type: "manual_ingreso" | "manual_egreso" | "masivo" | "encerar";
    concept: string;
    items: {
      productId: string;
      type: "ingreso" | "egreso";
      quantity: number;
      unitCost: number;
    }[];
  }) => {
    const wh = inventoryWarehouses.find((w) => w.id === warehouseId);
    if (!wh) throw new Error("Bodega no encontrada.");

    const adjustmentDocNumber = generateInventoryDocNumber("ADJ", inventoryAdjustments.length);
    const adjustmentId = `adj-${Date.now()}`;
    const now = new Date().toISOString();

    const kardexEntries: KardexEntry[] = [];
    const adjustmentItems = [];
    const updatedProductsMap = new Map<string, InventoryProduct>();

    for (const item of items) {
      const product = updatedProductsMap.get(item.productId) || inventoryProducts.find((p) => p.id === item.productId);
      if (!product) continue;

      const qty = Math.abs(item.quantity);
      const currentWhStock = Number(product.stockByWarehouse?.[warehouseId] || 0);

      if (item.type === "egreso" && currentWhStock < qty) {
        throw new Error(`Stock insuficiente de ${product.name} en ${wh.name}. Disponible: ${currentWhStock}, Solicitado: ${qty}.`);
      }

      const isIngreso = item.type === "ingreso";
      const newWhStock = isIngreso ? currentWhStock + qty : Math.max(0, currentWhStock - qty);
      const kdxType = isIngreso ? "POSITIVE_ADJUSTMENT" : "NEGATIVE_ADJUSTMENT";

      const kdx = buildKardexEntry({
        product,
        warehouse: wh,
        type: kdxType,
        referenceId: adjustmentId,
        referenceDocNumber: adjustmentDocNumber,
        concept: `${concept} (${adjustmentDocNumber})`,
        quantity: qty,
        unitCost: item.unitCost || product.baseCost,
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
        baseCost: isIngreso ? kdx.balanceAverageCost : product.baseCost,
        updatedAt: now,
      };

      updatedProductsMap.set(product.id, updatedProd);

      adjustmentItems.push({
        productId: product.id,
        productName: product.name,
        type: item.type,
        quantity: qty,
        unitCost: item.unitCost || product.baseCost,
        previousStock: currentWhStock,
        newStock: newWhStock,
      });
    }

    const adjustmentRecord: InventoryAdjustment = {
      id: adjustmentId,
      adjustmentNumber: adjustmentDocNumber,
      date: now,
      type,
      warehouseId,
      warehouseName: wh.name,
      concept,
      items: adjustmentItems,
      responsibleUser: currentUser.displayName,
      createdAt: now,
    };

    // Sincronizar en lote
    await Promise.all([
      syncToFirestore("inventoryAdjustments", adjustmentRecord.id, adjustmentRecord),
      ...kardexEntries.map((k) => syncToFirestore("inventoryKardex", k.id, k)),
      ...Array.from(updatedProductsMap.values()).map((p) => syncToFirestore("inventoryProducts", p.id, p)),
    ]);

    setInventoryAdjustments((prev) => [adjustmentRecord, ...prev]);
    setInventoryKardex((prev) => [...kardexEntries, ...prev]);
    setInventoryProducts((prev) =>
      prev.map((p) => updatedProductsMap.get(p.id) || p)
    );

    addAuditLog("CREATE_EXPENSE", `Ajuste Inventario: ${adjustmentDocNumber}`, `${concept} en ${wh.name}`);
  };

  // ==========================================
  // BILLING & SRI METHODS
  // ==========================================

  const createInvoice = async (
    data: Omit<SriInvoice, "id" | "claveAcceso" | "documentNumber" | "createdAt" | "kardexRegistered"> & {
      customSecuencial?: number;
    }
  ): Promise<SriInvoice> => {
    const now = new Date().toISOString();
    const invoiceId = `inv-${Date.now()}`;
    const dateStr = data.date || now.slice(0, 10);
    const docType = data.documentType || "factura";
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
        const newWhStock = Math.max(0, currentWhStock - qty);

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
      documentType: docType,
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
        const targetBank =
          bankAccounts.find((b) => b.id === data.bankAccountId) || bankAccounts[0];
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
    }

    addAuditLog(
      "CREATE_CLIENT",
      `${docType === "nota_venta" ? "Nota de Venta" : "Factura"} ${isDraft ? "(Borrador)" : "Emitida"}: ${documentNumber}`,
      `Total: $${newInvoice.total.toFixed(2)} - Cliente: ${newInvoice.clientName}`
    );

    return newInvoice;
  };

  const updateInvoiceStatus = async (
    id: string,
    status: SriInvoice["status"],
    authorizationDate?: string
  ) => {
    const inv = billingInvoices.find((i) => i.id === id);
    if (!inv) return;

    const now = new Date().toISOString();

    // Si pasa a "anulada" y tenía kardex registrado, reversamos el stock
    if (status === "anulada" && inv.status !== "anulada" && inv.kardexRegistered) {
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
          concept: `Anulación de ${inv.documentType === "nota_venta" ? "Nota de Venta" : "Factura"} ${inv.documentNumber}`,
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

    const updated: SriInvoice = {
      ...inv,
      status,
      authorizationDate: authorizationDate || (status === "autorizada" ? now : inv.authorizationDate),
    };

    await syncToFirestore("billingInvoices", id, updated);
    setBillingInvoices((prev) => prev.map((i) => (i.id === id ? updated : i)));
    addAuditLog("UPDATE_CLIENT", `Estado Documento ${inv.documentNumber}`, `Nuevo estado: ${status}`);
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
    paymentMethod: SriInvoice["paymentMethod"] = "transferencia"
  ): Promise<SriInvoice> => {
    const quote = billingQuotes.find((q) => q.id === quoteId);
    if (!quote) throw new Error("Cotización no encontrada.");

    const wh = inventoryWarehouses.find((w) => w.id === warehouseId) || inventoryWarehouses[0];

    const invoice = await createInvoice({
      date: new Date().toISOString().slice(0, 10),
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
      status: "emitida",
      warehouseId: wh ? wh.id : warehouseId,
      warehouseName: wh ? wh.name : "Bodega Central",
      notes: `Facturado desde Cotización ${quote.quoteNumber}. ${quote.notes || ""}`,
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

    const kardexEntries: KardexEntry[] = [];
    const updatedProductsMap = new Map<string, InventoryProduct>();

    for (const item of data.items) {
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
        referenceId: ncId,
        referenceDocNumber: documentNumber,
        concept: `Devolución NC ${documentNumber} - Factura ${data.invoiceNumber}: ${data.reason}`,
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

    const newCreditNote: CreditNote = {
      ...data,
      id: ncId,
      documentNumber,
      claveAcceso,
      warehouseId,
      warehouseName,
      kardexReentered: kardexEntries.length > 0,
      createdAt: now,
    };

    await Promise.all([
      syncToFirestore("billingCreditNotes", newCreditNote.id, newCreditNote),
      ...kardexEntries.map((k) => syncToFirestore("inventoryKardex", k.id, k)),
      ...Array.from(updatedProductsMap.values()).map((p) => syncToFirestore("inventoryProducts", p.id, p)),
    ]);

    setBillingCreditNotes((prev) => [newCreditNote, ...prev]);
    if (kardexEntries.length > 0) {
      setInventoryKardex((prev) => [...kardexEntries, ...prev]);
      setInventoryProducts((prev) =>
        prev.map((p) => updatedProductsMap.get(p.id) || p)
      );
    }

    addAuditLog("CREATE_EXPENSE", `Nota de Crédito: ${documentNumber}`, `Factura: ${data.invoiceNumber} - Total: $${newCreditNote.total.toFixed(2)}`);

    return newCreditNote;
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
    setSuppliers((prev) => [newSupplier, ...prev]);
    await syncToFirestore("suppliers", id, newSupplier);
    addAuditLog("CREATE_USER", "Proveedores", `Proveedor ${newSupplier.razonSocial} (RUC: ${newSupplier.ruc}) registrado`);
    return newSupplier;
  };

  const updateSupplier = async (id: string, updates: Partial<Supplier>): Promise<void> => {
    setSuppliers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s))
    );
    await syncToFirestore("suppliers", id, updates);
  };

  const deleteSupplier = async (id: string): Promise<void> => {
    setSuppliers((prev) => prev.filter((s) => s.id !== id));
    await deleteFromFirestore("suppliers", id);
  };

  const addPurchaseInvoice = async (
    data: Omit<PurchaseInvoice, "id" | "createdAt" | "paidAmount" | "balanceRemaining"> & {
      paidAmount?: number;
    }
  ): Promise<PurchaseInvoice> => {
    const id = `pur-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const total = Number(data.total) || 0;
    const isContado = data.paymentCondition === "contado";
    const paidAmount = isContado ? total : Math.max(0, Number(data.paidAmount) || 0);
    const balanceRemaining = Math.max(0, Math.round((total - paidAmount) * 100) / 100);
    const paymentStatus: PurchasePaymentStatus =
      balanceRemaining === 0 ? "pagado" : paidAmount > 0 ? "abono_parcial" : "pendiente";

    const newInvoice: PurchaseInvoice = {
      ...data,
      id,
      paidAmount,
      balanceRemaining,
      paymentStatus,
      createdAt: new Date().toISOString(),
    };

    // 1. Impacto en Kardex si tiene ítems físicos
    if (data.items && data.items.length > 0) {
      let updatedProducts = [...inventoryProducts];
      const newKardexEntries: KardexEntry[] = [];

      for (const item of data.items) {
        if (!item.quantity || item.quantity <= 0) continue;
        const targetWarehouse = inventoryWarehouses.find((w) => w.id === item.warehouseId) || inventoryWarehouses[0];
        if (!targetWarehouse) continue;

        const prodIndex = updatedProducts.findIndex(
          (p) => p.id === item.productId || (item.sku && p.sku === item.sku) || p.name.toLowerCase() === item.name.toLowerCase()
        );

        if (prodIndex >= 0) {
          const product = updatedProducts[prodIndex];
          if (product.tracksStock) {
            const currentStock = Number(product.stock) || 0;
            const currentAvgCost = Number(product.baseCost) || 0;
            const qty = Number(item.quantity) || 0;
            const unitCost = Number(item.unitCost) || 0;

            const kardex = buildKardexEntry({
              product,
              warehouse: targetWarehouse,
              type: "PURCHASE_RECEIPT",
              referenceId: id,
              referenceDocNumber: data.documentNumber,
              concept: `Entrada por compra Factura ${data.documentNumber} (${data.supplierName})`,
              quantity: qty,
              unitCost,
              currentStock,
              currentAvgCost,
              userName: currentUser.displayName,
            });

            newKardexEntries.push(kardex);

            const newStock = currentStock + qty;
            const newAvg = calculateWeightedAverageCost(currentStock, currentAvgCost, qty, unitCost);
            const whStock = (product.stockByWarehouse?.[targetWarehouse.id] || 0) + qty;

            updatedProducts[prodIndex] = {
              ...product,
              stock: newStock,
              baseCost: newAvg,
              stockByWarehouse: {
                ...(product.stockByWarehouse || {}),
                [targetWarehouse.id]: whStock,
              },
            };
          }
        }
      }

      if (newKardexEntries.length > 0) {
        setInventoryKardex((prev) => [...newKardexEntries, ...prev]);
        setInventoryProducts(updatedProducts);
        for (const k of newKardexEntries) {
          await syncToFirestore("inventoryKardex", k.id, k);
        }
        for (const p of updatedProducts) {
          await syncToFirestore("inventoryProducts", p.id, p);
        }
      }
    }

    // 2. Si fue pagada de contado, registrar egreso en movimientos financieros y descontar de banco
    if (isContado && paidAmount > 0) {
      const targetBank = bankAccounts.find((b) => b.id === data.bankAccountId) || bankAccounts[0];
      if (targetBank) {
        const movId = `mov-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
        const movement: FinancialMovement = {
          id: movId,
          type: "egreso",
          date: data.date,
          amount: paidAmount,
          category: "compra_proveedor",
          description: `Pago contado Factura ${data.documentNumber} - ${data.supplierName}`,
          bankAccountId: targetBank.id,
          bankAccountName: targetBank.bankName,
          paymentMethod: (data.paymentMethod as any) || "transferencia",
          relatedEntityId: id,
          createdAt: new Date().toISOString(),
        };

        setFinancialMovements((prev) => [movement, ...prev]);
        await syncToFirestore("financialMovements", movId, movement);

        const newBal = Math.round((targetBank.currentBalance - paidAmount) * 100) / 100;
        setBankAccounts((prev) =>
          prev.map((b) => (b.id === targetBank.id ? { ...b, currentBalance: newBal } : b))
        );
        await syncToFirestore("bankAccounts", targetBank.id, { currentBalance: newBal });
      }
    }

    setPurchaseInvoices((prev) => [newInvoice, ...prev]);
    await syncToFirestore("purchaseInvoices", id, newInvoice);
    addAuditLog("CREATE_EXPENSE", "Compras", `Factura compra ${data.documentNumber} registrada ($ ${total} USD)`);
    return newInvoice;
  };

  const updatePurchaseInvoice = async (id: string, updates: Partial<PurchaseInvoice>): Promise<void> => {
    setPurchaseInvoices((prev) =>
      prev.map((inv) => (inv.id === id ? { ...inv, ...updates } : inv))
    );
    await syncToFirestore("purchaseInvoices", id, updates);
  };

  const addSupplierCreditNote = async (
    note: Omit<SupplierCreditNote, "id" | "createdAt">
  ): Promise<SupplierCreditNote> => {
    const id = `sup-nc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newNote: SupplierCreditNote = {
      ...note,
      id,
      createdAt: new Date().toISOString(),
    };

    if (note.purchaseInvoiceId) {
      setPurchaseInvoices((prev) =>
        prev.map((inv) => {
          if (inv.id === note.purchaseInvoiceId) {
            const newRem = Math.max(0, Math.round(((inv.balanceRemaining || 0) - note.total) * 100) / 100);
            const updated = {
              ...inv,
              balanceRemaining: newRem,
              paymentStatus: (newRem === 0 ? "pagado" : inv.paymentStatus) as PurchasePaymentStatus,
            };
            syncToFirestore("purchaseInvoices", inv.id, updated);
            return updated;
          }
          return inv;
        })
      );
    }

    if (note.reason === "devolucion_mercaderia" && note.items && note.items.length > 0) {
      let updatedProducts = [...inventoryProducts];
      const newKardex: KardexEntry[] = [];

      for (const item of note.items) {
        const prodIndex = updatedProducts.findIndex((p) => p.id === item.productId);
        const warehouse = inventoryWarehouses.find((w) => w.id === item.warehouseId) || inventoryWarehouses[0];
        if (prodIndex >= 0 && warehouse) {
          const product = updatedProducts[prodIndex];
          if (product.tracksStock) {
            const currentStock = Number(product.stock) || 0;
            const qty = Number(item.quantity) || 0;
            const kdx = buildKardexEntry({
              product,
              warehouse,
              type: "SUPPLIER_RETURN",
              referenceId: id,
              referenceDocNumber: note.documentNumber,
              concept: `Salida por devolución a proveedor (Nota Crédito ${note.documentNumber})`,
              quantity: qty,
              unitCost: item.unitCost || product.baseCost,
              currentStock,
              currentAvgCost: product.baseCost,
              userName: currentUser.displayName,
            });
            newKardex.push(kdx);

            const newStock = Math.max(0, currentStock - qty);
            const whStock = Math.max(0, (product.stockByWarehouse?.[warehouse.id] || 0) - qty);
            updatedProducts[prodIndex] = {
              ...product,
              stock: newStock,
              stockByWarehouse: {
                ...(product.stockByWarehouse || {}),
                [warehouse.id]: whStock,
              },
            };
          }
        }
      }

      if (newKardex.length > 0) {
        setInventoryKardex((prev) => [...newKardex, ...prev]);
        setInventoryProducts(updatedProducts);
        for (const k of newKardex) await syncToFirestore("inventoryKardex", k.id, k);
        for (const p of updatedProducts) await syncToFirestore("inventoryProducts", p.id, p);
      }
    }

    setSupplierCreditNotes((prev) => [newNote, ...prev]);
    await syncToFirestore("supplierCreditNotes", id, newNote);
    return newNote;
  };

  const addSupplierDebitNote = async (
    note: Omit<SupplierDebitNote, "id" | "createdAt">
  ): Promise<SupplierDebitNote> => {
    const id = `sup-nd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newNote: SupplierDebitNote = {
      ...note,
      id,
      createdAt: new Date().toISOString(),
    };

    if (note.purchaseInvoiceId) {
      setPurchaseInvoices((prev) =>
        prev.map((inv) => {
          if (inv.id === note.purchaseInvoiceId) {
            const newRem = Math.round(((inv.balanceRemaining || 0) + note.total) * 100) / 100;
            const updated = {
              ...inv,
              balanceRemaining: newRem,
              paymentStatus: "pendiente" as PurchasePaymentStatus,
            };
            syncToFirestore("purchaseInvoices", inv.id, updated);
            return updated;
          }
          return inv;
        })
      );
    }

    setSupplierDebitNotes((prev) => [newNote, ...prev]);
    await syncToFirestore("supplierDebitNotes", id, newNote);
    return newNote;
  };

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

  const addBankAccount = async (account: Omit<BankAccount, "id">): Promise<BankAccount> => {
    const id = `bank-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
    const newAccount: BankAccount = { ...account, id };
    setBankAccounts((prev) => [...prev, newAccount]);
    await syncToFirestore("bankAccounts", id, newAccount);
    return newAccount;
  };

  const updateBankAccount = async (id: string, updates: Partial<BankAccount>): Promise<void> => {
    setBankAccounts((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates } : b)));
    await syncToFirestore("bankAccounts", id, updates);
  };

  const addSupplierPayment = async (
    payment: Omit<SupplierPaymentRecord, "id" | "createdAt">
  ): Promise<SupplierPaymentRecord> => {
    const id = `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newPayment: SupplierPaymentRecord = {
      ...payment,
      id,
      createdAt: new Date().toISOString(),
    };

    setPurchaseInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id === payment.purchaseInvoiceId) {
          const newPaid = Math.round(((inv.paidAmount || 0) + payment.amount) * 100) / 100;
          const newRem = Math.max(0, Math.round((inv.total - newPaid) * 100) / 100);
          const newStatus: PurchasePaymentStatus = newRem === 0 ? "pagado" : "abono_parcial";
          const updated = {
            ...inv,
            paidAmount: newPaid,
            balanceRemaining: newRem,
            paymentStatus: newStatus,
          };
          syncToFirestore("purchaseInvoices", inv.id, updated);
          return updated;
        }
        return inv;
      })
    );

    const movId = `mov-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
    const movement: FinancialMovement = {
      id: movId,
      type: "egreso",
      date: payment.date,
      amount: payment.amount,
      category: "abono_cxp",
      description: `Abono a Proveedor ${payment.supplierName} (Ref: ${payment.referenceNumber})`,
      bankAccountId: payment.bankAccountId,
      bankAccountName: payment.bankAccountName,
      paymentMethod: payment.paymentMethod,
      referenceNumber: payment.referenceNumber,
      relatedEntityId: payment.purchaseInvoiceId,
      createdAt: new Date().toISOString(),
    };
    setFinancialMovements((prev) => [movement, ...prev]);
    await syncToFirestore("financialMovements", movId, movement);

    setBankAccounts((prev) =>
      prev.map((b) => {
        if (b.id === payment.bankAccountId) {
          const newBal = Math.round((b.currentBalance - payment.amount) * 100) / 100;
          syncToFirestore("bankAccounts", b.id, { currentBalance: newBal });
          return { ...b, currentBalance: newBal };
        }
        return b;
      })
    );

    setSupplierPayments((prev) => [newPayment, ...prev]);
    await syncToFirestore("supplierPayments", id, newPayment);
    addAuditLog("CREATE_EXPENSE", "Cuentas por Pagar", `Abono ${payment.amount} a ${payment.supplierName}`);
    return newPayment;
  };

  const addFinancialMovement = async (
    movement: Omit<FinancialMovement, "id" | "createdAt">
  ): Promise<FinancialMovement> => {
    const id = `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newMov: FinancialMovement = {
      ...movement,
      id,
      createdAt: new Date().toISOString(),
    };

    setFinancialMovements((prev) => [newMov, ...prev]);
    await syncToFirestore("financialMovements", id, newMov);

    if (movement.bankAccountId) {
      setBankAccounts((prev) =>
        prev.map((b) => {
          if (b.id === movement.bankAccountId) {
            const delta = movement.type === "ingreso" ? movement.amount : -movement.amount;
            const newBal = Math.round((b.currentBalance + delta) * 100) / 100;
            syncToFirestore("bankAccounts", b.id, { currentBalance: newBal });
            return { ...b, currentBalance: newBal };
          }
          return b;
        })
      );
    }

    return newMov;
  };

  const updateUserModulePermissions = async (
    uid: string,
    permissions: UserModulePermissions
  ): Promise<void> => {
    setSystemUsers((prev) =>
      prev.map((u) => {
        if (u.uid === uid) {
          const updated = { ...u, modulePermissions: permissions };
          syncToFirestore("systemUsers", u.uid, updated);
          return updated;
        }
        return u;
      })
    );
    if (currentUser.uid === uid) {
      setCurrentUser((prev) => ({ ...prev, modulePermissions: permissions }));
    }
    addAuditLog("UPDATE_USER", "Usuarios", `Permisos de módulos actualizados para usuario ${uid}`);
  };

  const resetDataToDefaults = async () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(USERS_KEY);
    setSystemUsers(INITIAL_SYSTEM_USERS);
    setClients(INITIAL_CLIENTS);
    setClientServices(INITIAL_CLIENT_SERVICES);
    setNodes(INITIAL_NODES);
    setPolicies(INITIAL_POLICIES);
    setVault(INITIAL_VAULT);
    setTickets(INITIAL_TICKETS);
    setExpenses(INITIAL_EXPENSES);
    setMonthlyCharges(INITIAL_MONTHLY_CHARGES);
    setAuditLogs([]);
    setClientProjects([]);
    setClientQuotes([]);
    setClientVaultItems([]);
    setClientContracts([]);
    setInventoryProducts(INITIAL_PRODUCTS);
    setInventoryWarehouses(INITIAL_WAREHOUSES);
    setInventoryCategories(INITIAL_CATEGORIES);
    setInventoryBrands(INITIAL_BRANDS);
    setInventoryKardex(INITIAL_KARDEX);
    setInventoryTransfers(INITIAL_TRANSFERS);
    setInventoryAdjustments(INITIAL_ADJUSTMENTS);
    setBillingInvoices(INITIAL_INVOICES);
    setBillingQuotes(INITIAL_BILLING_QUOTES);
    setBillingCreditNotes(INITIAL_CREDIT_NOTES);
    setBillingWithholdings(INITIAL_WITHHOLDINGS);
    setBillingRemissionGuides(INITIAL_REMISSION_GUIDES);
    setSriCompanyConfig(INITIAL_SRI_CONFIG);
    setSuppliers(INITIAL_SUPPLIERS);
    setPurchaseInvoices(INITIAL_PURCHASE_INVOICES);
    setSupplierCreditNotes(INITIAL_SUPPLIER_CREDIT_NOTES);
    setSupplierDebitNotes(INITIAL_SUPPLIER_DEBIT_NOTES);
    setPurchaseWithholdings(INITIAL_PURCHASE_WITHHOLDINGS);
    setBankAccounts(INITIAL_BANK_ACCOUNTS);
    setFinancialMovements(INITIAL_FINANCIAL_MOVEMENTS);
    setSupplierPayments(INITIAL_SUPPLIER_PAYMENTS);
  };

  const hasAccess = canAccessRoute(currentUser, pathname);

  return (
    <ToastProvider>
      <AppContext.Provider
        value={{
          currentUser,
          setUserRole,
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
          expenses,
          monthlyCharges,
          auditLogs,
          addClient,
          updateClient,
          deleteClient,
          addPolicy,
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
          deleteClientDocument,
          addTicket,
          updateTicketStatus,
          updateTicketDetails,
          replyToTicket,
          addExpense,
          generateMonthlyBillingBatch,
          markChargeAsPaid,
          addMonthlyCharge,
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
          billingWithholdings,
          billingRemissionGuides,
          sriCompanyConfig,
          createInvoice,
          updateInvoiceStatus,
          createBillingQuote,
          updateBillingQuote,
          deleteBillingQuote,
          convertQuoteToInvoice,
          createCreditNote,
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
          addSupplierPayment,
          addFinancialMovement,
          updateUserModulePermissions,
          searchQuery,
          setSearchQuery,
          isSearchOpen,
          setIsSearchOpen,
          resetDataToDefaults,
        }}
      >
        <SecurityLockoutModal />
        {isAuthLoaded ? (
          isAuthenticated ? (
            hasAccess ? (
              children
            ) : (
              <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="max-w-md bg-white p-6 rounded-3xl border border-slate-200 text-center space-y-3 shadow-sm">
                  <h3 className="font-bold text-slate-900 text-base">Módulo Restringido</h3>
                  <p className="text-xs text-slate-500">
                    Tu rol ({currentUser.role}) no tiene asignado el permiso para acceder a esta sección.
                  </p>
                  <a
                    href="/"
                    className="inline-block px-4 py-2 bg-sky-600 text-white rounded-xl text-xs font-bold shadow-2xs"
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
