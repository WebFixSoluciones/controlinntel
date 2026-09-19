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
  Expense,
  MonthlyCharge,
  AuditLog,
  UserProfile,
  UserRole,
  SystemUser,
  ClientProjectTask,
  ClientQuoteOrder,
  ClientVaultItem,
  ClientContractInfo,
  ProjectKanbanColumn,
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
} from "./mock-data";
import { app, db, auth } from "./firebase";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { collection, doc, setDoc, deleteDoc, onSnapshot, getDocs } from "firebase/firestore";
import { usePathname } from "next/navigation";
import { can, collectionPermissions, routePermissions, type Entity } from "./permissions";
import { simpleDecrypt, simpleEncrypt } from "./crypto-vault";

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

  // Client 360 Extensions
  clientProjects: ClientProjectTask[];
  addClientProjectTask: (task: Omit<ClientProjectTask, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  updateClientProjectTask: (id: string, updates: Partial<ClientProjectTask>) => Promise<void>;
  moveProjectTaskColumn: (id: string, newColumn: ProjectKanbanColumn) => Promise<void>;
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

  addClient: (client: Omit<Client, "id" | "createdAt" | "updatedAt">, serviceData?: Partial<ClientService>) => Promise<void>;
  updateClient: (id: string, updates: Partial<Client>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;

  addPolicy: (policy: Omit<ArcotelPolicy, "id">) => Promise<void>;
  updatePolicy: (id: string, updates: Partial<ArcotelPolicy>) => Promise<void>;

  addVaultCredential: (cred: Omit<VaultCredential, "id" | "updatedAt">) => Promise<void>;
  updateVaultCredential: (id: string, updates: Partial<VaultCredential>) => Promise<void>;
  logVaultAccess: (credentialId: string, serviceName: string) => Promise<void>;

  addNode: (node: Omit<NodeLocation, "id">) => Promise<void>;
  updateNode: (id: string, updates: Partial<NodeLocation>) => Promise<void>;

  addTicket: (ticket: Omit<Ticket, "id" | "ticketNumber" | "createdAt">) => Promise<void>;
  updateTicketStatus: (id: string, status: Ticket["status"], notes?: string) => Promise<void>;

  addExpense: (expense: Omit<Expense, "id">) => Promise<void>;
  generateMonthlyBillingBatch: (month: number, year: number) => Promise<void>;
  markChargeAsPaid: (chargeId: string, method: string) => Promise<void>;

  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;

  resetDataToDefaults: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);
const STORAGE_KEY = "INNTEL_CORP_STATE_PROD_CLEAN_V1";
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
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Client 360 Extensions State
  const [clientProjects, setClientProjects] = useState<ClientProjectTask[]>([]);
  const [clientQuotes, setClientQuotes] = useState<ClientQuoteOrder[]>([]);
  const [clientVaultItems, setClientVaultItems] = useState<ClientVaultItem[]>([]);
  const [clientContracts, setClientContracts] = useState<ClientContractInfo[]>([]);

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
    }
  };

  const deleteFromFirestore = async (collectionName: string, id: string) => {
    try {
      await deleteDoc(doc(db, collectionName, id));
    } catch (err: any) {
      console.warn(`Firestore delete note (${collectionName}/${id}):`, err?.message);
    }
  };

  // Initial load from LocalStorage cache and Firebase session
  useEffect(() => {
    try {
      // 0. Clean legacy demo caches
      ["INNTEL_CORP_STATE_HUB_V6", "INNTEL_CORP_STATE_HUB_V5", "INNTEL_CORP_STATE_HUB_V4"].forEach((k) => {
        try { localStorage.removeItem(k); } catch (e) {}
      });

      // 1. Check saved users
      const savedUsers = localStorage.getItem(USERS_KEY);
      let activeUsers = INITIAL_SYSTEM_USERS;
      if (savedUsers) {
        try {
          const parsed = JSON.parse(savedUsers);
          if (Array.isArray(parsed) && parsed.length > 0) {
            activeUsers = parsed;
            setSystemUsers(parsed);
          }
        } catch (e) {}
      }

      // 2. Check auth session
      const savedAuth = localStorage.getItem(AUTH_KEY);
      if (savedAuth) {
        try {
          const user = JSON.parse(savedAuth);
          if (user && user.email) {
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
    systemUsers,
    isAuthLoaded,
  ]);

  const addAuditLog = (action: AuditLog["action"], resource: string, details: string) => {
    const newLog: AuditLog = {
      id: "log-" + Date.now(),
      userId: currentUser.uid || "system",
      userEmail: currentUser.email || "admin@inntelcorp.ec",
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
              localStorage.setItem(AUTH_KEY, JSON.stringify(activeProfile));
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
                  localStorage.setItem(AUTH_KEY, JSON.stringify(activeProfile));
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
        localStorage.setItem(AUTH_KEY, JSON.stringify(updatedUser));
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
    } catch (e) {}
    addAuditLog("LOGOUT", `Cierre de Sesión: ${currentUser.displayName}`, `Rol: ${currentUser.role}`);
  };

  const setUserRole = (role: UserRole) => {
    setCurrentUser((prev) => ({ ...prev, role }));
  };

  const refresh = useCallback(async () => {
    const collectionsToSync: { name: string; setter: (data: any[]) => void; initialData?: any[] }[] = [
      { name: "clients", setter: setClients },
      { name: "clientServices", setter: setClientServices },
      { name: "plans", setter: setPlans, initialData: INITIAL_PLANS },
      { name: "nodes", setter: setNodes },
      { name: "ipPools", setter: setIpPools },
      { name: "policies", setter: setPolicies },
      { name: "vault", setter: setVault },
      { name: "tickets", setter: setTickets },
      { name: "expenses", setter: setExpenses },
      { name: "monthlyCharges", setter: setMonthlyCharges },
      { name: "clientProjects", setter: setClientProjects },
      { name: "clientQuotes", setter: setClientQuotes },
      { name: "clientVaultItems", setter: setClientVaultItems },
      { name: "clientContracts", setter: setClientContracts },
      { name: "users", setter: setSystemUsers, initialData: INITIAL_SYSTEM_USERS },
      { name: "auditLogs", setter: setAuditLogs },
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
                void syncToFirestore(col.name, itemId, item);
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

  // Client Project Kanban
  const addClientProjectTask = async (taskData: Omit<ClientProjectTask, "id" | "createdAt" | "updatedAt">) => {
    const newTask: ClientProjectTask = {
      ...taskData,
      id: "prj-" + Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await syncToFirestore("clientProjects", newTask.id, newTask);
    setClientProjects((prev) => [newTask, ...prev]);
    addAuditLog("CREATE_CLIENT", `Proyecto Kanban: ${newTask.title}`, `Cliente: ${newTask.clientName}`);
  };

  const updateClientProjectTask = async (id: string, updates: Partial<ClientProjectTask>) => {
    const updated = { ...updates, updatedAt: new Date().toISOString() };
    await syncToFirestore("clientProjects", id, updated);
    setClientProjects((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updated } : t))
    );
  };

  const moveProjectTaskColumn = async (id: string, newColumn: ProjectKanbanColumn) => {
    await updateClientProjectTask(id, { column: newColumn });
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

  // Client Core Operations
  const addClient = async (
    clientData: Omit<Client, "id" | "createdAt" | "updatedAt">,
    serviceData?: Partial<ClientService>
  ) => {
    const newId = "cli-" + (clients.length + 1).toString().padStart(3, "0");
    const newClient: Client = {
      ...clientData,
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
      const node = nodes.find((n) => n.id === serviceData.nodeId) || nodes[0];
      const newService: ClientService = {
        id: "srv-" + Date.now(),
        clientId: newId,
        planId: plan ? plan.id : "plan-100m",
        planName: plan ? plan.name : "Fibra Óptica 100M",
        downloadMbps: plan ? plan.downloadMbps : 100,
        uploadMbps: plan ? plan.uploadMbps : 100,
        basePrice: plan ? plan.defaultPrice : 28.0,
        customPrice: serviceData.customPrice || (plan ? plan.defaultPrice : 28.0),
        billingType: serviceData.billingType || (plan ? plan.billingType : "pospago"),
        cutoffDay: serviceData.cutoffDay || 1,
        nodeId: node ? node.id : "nodo-default",
        nodeName: node ? node.name : "POP Central",
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
  };

  const updateClient = async (id: string, updates: Partial<Client>) => {
    const updated = { ...updates, updatedAt: new Date().toISOString() };
    await syncToFirestore("clients", id, updated);
    setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...updated } : c)));
    addAuditLog("UPDATE_CLIENT", `Cliente ID: ${id}`, JSON.stringify(updates));
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
    const newNode: NodeLocation = { ...nodeData, id: "nodo-" + (nodes.length + 1) };
    await syncToFirestore("nodes", newNode.id, newNode);
    setNodes((prev) => [...prev, newNode]);
  };

  const updateNode = async (id: string, updates: Partial<NodeLocation>) => {
    await syncToFirestore("nodes", id, updates);
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, ...updates } : n)));
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

  const updateTicketStatus = async (id: string, status: Ticket["status"], notes?: string) => {
    const updated = {
      status,
      resolvedAt: status === "resuelto" ? new Date().toISOString() : undefined,
      resolutionNotes: notes,
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
    newCharges.forEach((c) => syncToFirestore("monthlyCharges", c.id, c));
    addAuditLog("EXPORT_BILLING", "Emisión Cobros Día 1", `Lote para ${clients.length} clientes`);
  };

  const markChargeAsPaid = async (chargeId: string, method: string) => {
    const updated = {
      status: "pagado" as const,
      paymentDate: new Date().toISOString().split("T")[0],
      paymentMethod: method,
    };
    await syncToFirestore("monthlyCharges", chargeId, updated);
    setMonthlyCharges((prev) =>
      prev.map((c) => (c.id === chargeId ? { ...c, ...updated } : c))
    );
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
  };

  const requiredPermission = routePermissions[pathname];
  const hasAccess = !requiredPermission || can(currentUser, requiredPermission);

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
          clientProjects,
          addClientProjectTask,
          updateClientProjectTask,
          moveProjectTaskColumn,
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
