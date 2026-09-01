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
  UserProfile,
} from "@/types";

export interface SystemAccount {
  user: UserProfile;
  passwordHash: string;
}

export const SYSTEM_ACCOUNTS: SystemAccount[] = [
  {
    user: {
      uid: "usr-admin-01",
      email: "admin@inntelcorp.ec",
      displayName: "Ing. Santiago Morales",
      role: "admin",
      department: "NOC Central & Gerencia General",
      phone: "+593 99 876 5432",
    },
    passwordHash: "Admin2026*",
  },
  {
    user: {
      uid: "usr-fin-02",
      email: "finanzas@inntelcorp.ec",
      displayName: "Lcda. Patricia Andrade",
      role: "finanzas",
      department: "Contabilidad & Facturación SRI",
      phone: "+593 98 432 1098",
    },
    passwordHash: "Finanzas2026*",
  },
  {
    user: {
      uid: "usr-tec-03",
      email: "tecnico@inntelcorp.ec",
      displayName: "Ing. Carlos Benítez",
      role: "tecnico",
      department: "Ingeniería NOC & MikroTik",
      phone: "+593 97 123 4567",
    },
    passwordHash: "Tecnico2026*",
  },
  {
    user: {
      uid: "usr-sop-04",
      email: "soporte@inntelcorp.ec",
      displayName: "Téc. Alex Mendoza",
      role: "soporte",
      department: "Mesa de Ayuda & Cuadrillas",
      phone: "+593 96 987 6543",
    },
    passwordHash: "Soporte2026*",
  },
  {
    user: {
      uid: "usr-leg-05",
      email: "legal@inntelcorp.ec",
      displayName: "Abg. Fernando Viteri",
      role: "consulta",
      department: "Asesoría Legal & ARCOTEL",
      phone: "+593 95 654 3210",
    },
    passwordHash: "Arcotel2026*",
  },
];

export const INITIAL_USER: UserProfile = SYSTEM_ACCOUNTS[0].user;

export const INITIAL_PLANS: Plan[] = [
  {
    id: "plan-50m",
    name: "Fibra Óptica Residencial 50M",
    downloadMbps: 50,
    uploadMbps: 50,
    defaultPrice: 20.0,
    billingType: "pospago",
    description: "Internet simétrico residencial de alta velocidad",
  },
  {
    id: "plan-100m",
    name: "Fibra Óptica Hogar & PYME 100M",
    downloadMbps: 100,
    uploadMbps: 100,
    defaultPrice: 28.0,
    billingType: "pospago",
    description: "Plan recomendado con IP pública dinámica y baja latencia",
  },
  {
    id: "plan-200m",
    name: "Fibra Óptica Corporativo 200M",
    downloadMbps: 200,
    uploadMbps: 200,
    defaultPrice: 45.0,
    billingType: "pospago",
    description: "Enlace simétrico para empresas con SLA garantizado",
  },
  {
    id: "plan-500m",
    name: "Fibra Óptica Dedicado 500M",
    downloadMbps: 500,
    uploadMbps: 500,
    defaultPrice: 95.0,
    billingType: "pospago",
    description: "Canal dedicado 1:1 con pool de IPs estáticas /29",
  },
];

export const INITIAL_NODES: NodeLocation[] = [];
export const INITIAL_IP_POOLS: IpPool[] = [];
export const INITIAL_CLIENTS: Client[] = [];
export const INITIAL_CLIENT_SERVICES: ClientService[] = [];
export const INITIAL_POLICIES: ArcotelPolicy[] = [];
export const INITIAL_VAULT: VaultCredential[] = [];
export const INITIAL_TICKETS: Ticket[] = [];
export const INITIAL_EXPENSES: Expense[] = [];
export const INITIAL_MONTHLY_CHARGES: MonthlyCharge[] = [];
