"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
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
  Expense,
  MonthlyCharge,
  AuditLog,
  UserProfile,
  UserRole,
} from "@/types";
import {
  INITIAL_USER,
  SYSTEM_ACCOUNTS,
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
} from "./mock-data";

interface AppContextType {
  currentUser: UserProfile;
  setUserRole: (role: UserRole) => void;
  isAuthenticated: boolean;
  login: (email: string, password: string, remember?: boolean) => boolean;
  logout: () => void;

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

  addClient: (client: Omit<Client, "id" | "createdAt" | "updatedAt">, serviceData?: Partial<ClientService>) => void;
  updateClient: (id: string, updates: Partial<Client>) => void;
  deleteClient: (id: string) => void;

  addPolicy: (policy: Omit<ArcotelPolicy, "id">) => void;
  updatePolicy: (id: string, updates: Partial<ArcotelPolicy>) => void;

  addVaultCredential: (cred: Omit<VaultCredential, "id" | "updatedAt">) => void;
  updateVaultCredential: (id: string, updates: Partial<VaultCredential>) => void;
  logVaultAccess: (credentialId: string, serviceName: string) => void;

  addNode: (node: Omit<NodeLocation, "id">) => void;
  updateNode: (id: string, updates: Partial<NodeLocation>) => void;

  addTicket: (ticket: Omit<Ticket, "id" | "ticketNumber" | "createdAt">) => void;
  updateTicketStatus: (id: string, status: Ticket["status"], notes?: string) => void;

  addExpense: (expense: Omit<Expense, "id">) => void;
  generateMonthlyBillingBatch: (month: number, year: number) => void;
  markChargeAsPaid: (chargeId: string, method: string) => void;

  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;

  resetDataToDefaults: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);
const STORAGE_KEY = "INNTEL_CORP_STATE_FINAL";
const AUTH_KEY = "INNTEL_AUTH_USER";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthLoaded, setIsAuthLoaded] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<UserProfile>(INITIAL_USER);

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
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    try {
      // Check auth session
      const savedAuth = localStorage.getItem(AUTH_KEY);
      if (savedAuth) {
        const user = JSON.parse(savedAuth);
        if (user && user.email) {
          setCurrentUser(user);
          setIsAuthenticated(true);
        }
      }

      // Check saved business state
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const p = JSON.parse(saved);
        if (p.clients) setClients(p.clients);
        if (p.clientServices) setClientServices(p.clientServices);
        if (p.nodes) setNodes(p.nodes);
        if (p.policies) setPolicies(p.policies);
        if (p.vault) setVault(p.vault);
        if (p.tickets) setTickets(p.tickets);
        if (p.expenses) setExpenses(p.expenses);
        if (p.monthlyCharges) setMonthlyCharges(p.monthlyCharges);
        if (p.auditLogs) setAuditLogs(p.auditLogs);
      }
    } catch (e) {
      console.warn("Could not load state:", e);
    } finally {
      setIsAuthLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!isAuthLoaded) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ clients, clientServices, nodes, policies, vault, tickets, expenses, monthlyCharges, auditLogs })
      );
    } catch (e) {}
  }, [clients, clientServices, nodes, policies, vault, tickets, expenses, monthlyCharges, auditLogs, isAuthLoaded]);

  const login = (email: string, password: string, remember: boolean = true): boolean => {
    const trimmedEmail = email.trim().toLowerCase();
    const account = SYSTEM_ACCOUNTS.find(
      (a) => a.user.email.toLowerCase() === trimmedEmail && a.passwordHash === password
    );

    if (account) {
      setCurrentUser(account.user);
      setIsAuthenticated(true);
      if (remember) {
        try {
          localStorage.setItem(AUTH_KEY, JSON.stringify(account.user));
        } catch (e) {}
      }
      addAuditLog("LOGIN", `Acceso al Sistema: ${account.user.displayName}`, `Rol: ${account.user.role}`);
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
    try {
      localStorage.removeItem(AUTH_KEY);
    } catch (e) {}
    addAuditLog("LOGOUT", `Cierre de Sesión: ${currentUser.displayName}`, `Rol: ${currentUser.role}`);
  };

  const addAuditLog = (action: AuditLog["action"], resource: string, details: string) => {
    const newLog: AuditLog = {
      id: "log-" + Date.now(),
      userId: currentUser.uid,
      userEmail: currentUser.email,
      userRole: currentUser.role,
      action,
      resource,
      details,
      timestamp: new Date().toISOString(),
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  const setUserRole = (role: UserRole) => {
    setCurrentUser((prev) => ({ ...prev, role }));
  };

  const addClient = (clientData: Omit<Client, "id" | "createdAt" | "updatedAt">, serviceData?: Partial<ClientService>) => {
    const newId = "cli-" + (clients.length + 1).toString().padStart(3, "0");
    const newClient: Client = {
      ...clientData,
      id: newId,
      totalActiveServices: serviceData ? 1 : 0,
      currentBalance: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setClients((prev) => [newClient, ...prev]);

    if (serviceData) {
      const plan = plans.find((p) => p.id === serviceData.planId) || plans[0];
      const node = nodes.find((n) => n.id === serviceData.nodeId) || nodes[0];
      const newService: ClientService = {
        id: "srv-" + Date.now(),
        clientId: newId,
        planId: plan.id,
        planName: plan.name,
        downloadMbps: plan.downloadMbps,
        uploadMbps: plan.uploadMbps,
        basePrice: plan.defaultPrice,
        customPrice: serviceData.customPrice || plan.defaultPrice,
        billingType: serviceData.billingType || plan.billingType,
        cutoffDay: serviceData.cutoffDay || 1,
        nodeId: node.id,
        nodeName: node.name,
        ipv4Address: serviceData.ipv4Address || `100.64.10.${Math.floor(Math.random() * 200) + 10}`,
        pppoeUser: serviceData.pppoeUser || newClient.identificationNumber,
        status: "activo",
        installationDate: new Date().toISOString().split("T")[0],
      };
      setClientServices((prev) => [...prev, newService]);
    }
    addAuditLog("CREATE_CLIENT", `Cliente: ${newClient.businessName}`, `ID: ${newClient.identificationNumber}`);
  };

  const updateClient = (id: string, updates: Partial<Client>) => {
    setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c)));
    addAuditLog("UPDATE_CLIENT", `Cliente ID: ${id}`, JSON.stringify(updates));
  };

  const deleteClient = (id: string) => {
    setClients((prev) => prev.filter((c) => c.id !== id));
    setClientServices((prev) => prev.filter((s) => s.clientId !== id));
  };

  const addPolicy = (policyData: Omit<ArcotelPolicy, "id">) => {
    const newPolicy: ArcotelPolicy = {
      ...policyData,
      id: "pol-" + (policies.length + 1).toString().padStart(3, "0"),
    };
    setPolicies((prev) => [newPolicy, ...prev]);
    addAuditLog("GENERATE_DOC", `Póliza ARCOTEL: ${newPolicy.policyNumber}`, `$${newPolicy.insuredAmount}`);
  };

  const updatePolicy = (id: string, updates: Partial<ArcotelPolicy>) => {
    setPolicies((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  };

  const addVaultCredential = (cred: Omit<VaultCredential, "id" | "updatedAt">) => {
    const newCred: VaultCredential = {
      ...cred,
      id: "vlt-" + Date.now(),
      updatedAt: new Date().toISOString(),
    };
    setVault((prev) => [newCred, ...prev]);
    addAuditLog("UPDATE_VAULT", `Credencial: ${newCred.serviceName}`, `Usuario: ${newCred.username}`);
  };

  const updateVaultCredential = (id: string, updates: Partial<VaultCredential>) => {
    setVault((prev) => prev.map((v) => (v.id === id ? { ...v, ...updates, updatedAt: new Date().toISOString() } : v)));
  };

  const logVaultAccess = (credentialId: string, serviceName: string) => {
    setVault((prev) => prev.map((v) => (v.id === credentialId ? { ...v, lastAccessedAt: new Date().toISOString() } : v)));
    addAuditLog("VIEW_VAULT_PASSWORD", `Bóveda: ${serviceName}`, `Consulta por ${currentUser.role}`);
  };

  const addNode = (nodeData: Omit<NodeLocation, "id">) => {
    const newNode: NodeLocation = { ...nodeData, id: "nodo-" + (nodes.length + 1) };
    setNodes((prev) => [...prev, newNode]);
  };

  const updateNode = (id: string, updates: Partial<NodeLocation>) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, ...updates } : n)));
  };

  const addTicket = (ticketData: Omit<Ticket, "id" | "ticketNumber" | "createdAt">) => {
    const newTicket: Ticket = {
      ...ticketData,
      id: "tck-" + Date.now(),
      ticketNumber: "TCK-" + (1080 + tickets.length + 1),
      createdAt: new Date().toISOString(),
    };
    setTickets((prev) => [newTicket, ...prev]);
  };

  const updateTicketStatus = (id: string, status: Ticket["status"], notes?: string) => {
    setTickets((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, status, resolvedAt: status === "resuelto" ? new Date().toISOString() : t.resolvedAt, resolutionNotes: notes || t.resolutionNotes }
          : t
      )
    );
  };

  const addExpense = (expenseData: Omit<Expense, "id">) => {
    const newExpense: Expense = { ...expenseData, id: "exp-" + Date.now() };
    setExpenses((prev) => [newExpense, ...prev]);
    addAuditLog("CREATE_EXPENSE", `Gasto: ${newExpense.supplierName}`, `$${newExpense.amount}`);
  };

  const generateMonthlyBillingBatch = (month: number, year: number) => {
    const newCharges: MonthlyCharge[] = clients.map((client) => {
      const clientServs = clientServices.filter((s) => s.clientId === client.id && s.status === "activo");
      const totalAmount = clientServs.reduce((sum, s) => sum + s.customPrice, 0) || 28.0;
      const subtotal = totalAmount / 1.15;
      const iva = totalAmount - subtotal;
      return {
        id: `chg-${client.id}-${month}-${year}`,
        clientId: client.id,
        clientName: client.businessName,
        clientRuc: client.identificationNumber,
        month,
        year,
        serviceDescription: `Servicio Internet Banda Ancha Fibra Óptica - Periodo ${month}/${year}`,
        subtotal: parseFloat(subtotal.toFixed(2)),
        ivaAmount: parseFloat(iva.toFixed(2)),
        total: parseFloat(totalAmount.toFixed(2)),
        status: "pendiente",
        invoiceNumber: `001-100-${Math.floor(Math.random() * 900000 + 100000)}`,
      };
    });
    setMonthlyCharges((prev) => [...newCharges, ...prev]);
    addAuditLog("EXPORT_SRI", "Emisión Cobros Día 1", `Lote para ${clients.length} clientes`);
  };

  const markChargeAsPaid = (chargeId: string, method: string) => {
    setMonthlyCharges((prev) =>
      prev.map((c) => (c.id === chargeId ? { ...c, status: "pagado", paymentDate: new Date().toISOString().split("T")[0], paymentMethod: method } : c))
    );
  };

  const resetDataToDefaults = () => {
    localStorage.removeItem(STORAGE_KEY);
    setClients(INITIAL_CLIENTS);
    setClientServices(INITIAL_CLIENT_SERVICES);
    setNodes(INITIAL_NODES);
    setPolicies(INITIAL_POLICIES);
    setVault(INITIAL_VAULT);
    setTickets(INITIAL_TICKETS);
    setExpenses(INITIAL_EXPENSES);
    setMonthlyCharges(INITIAL_MONTHLY_CHARGES);
    setAuditLogs([]);
  };

  return (
    <ToastProvider>
      <AppContext.Provider
        value={{
          currentUser,
          setUserRole,
          isAuthenticated,
          login,
          logout,
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
          addTicket,
          updateTicketStatus,
          addExpense,
          generateMonthlyBillingBatch,
          markChargeAsPaid,
          searchQuery,
          setSearchQuery,
          isSearchOpen,
          setIsSearchOpen,
          resetDataToDefaults,
        }}
      >
        {isAuthLoaded ? (
          isAuthenticated ? (
            children
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
