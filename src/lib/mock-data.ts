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
  SystemUser,
} from "@/types";

export const INITIAL_SYSTEM_USERS: SystemUser[] = [
  {
    uid: "usr-superadmin-00",
    email: "superadmin@inntelcorp.ec",
    displayName: "Ing. Santiago Morales",
    role: "superadmin",
    department: "Presidencia Ejecutiva & NOC Central",
    phone: "+593 99 876 5432",
    status: "activo",
    passwordHash: "SuperAdmin2026*",
    permissions: [
      "all",
      "manage_users",
      "manage_vault",
      "manage_clients",
      "manage_network",
      "manage_tickets",
      "manage_finance",
      "manage_policies",
      "export_reports",
    ],
    createdAt: "2024-01-01T08:00:00Z",
  },
  {
    uid: "usr-admin-01",
    email: "admin@inntelcorp.ec",
    displayName: "Ing. Diego Cárdenas",
    role: "admin",
    department: "Gerencia de Operaciones",
    phone: "+593 99 111 2233",
    status: "activo",
    passwordHash: "Admin2026*",
    permissions: [
      "manage_vault",
      "manage_clients",
      "manage_network",
      "manage_tickets",
      "manage_finance",
      "manage_policies",
      "export_reports",
    ],
    createdAt: "2024-02-15T09:30:00Z",
  },
  {
    uid: "usr-fin-02",
    email: "finanzas@inntelcorp.ec",
    displayName: "Lcda. Patricia Andrade",
    role: "finanzas",
    department: "Contabilidad & Cobranzas",
    phone: "+593 98 432 1098",
    status: "activo",
    passwordHash: "Finanzas2026*",
    permissions: ["manage_finance", "manage_clients", "export_reports"],
    createdAt: "2024-03-01T10:00:00Z",
  },
  {
    uid: "usr-tec-03",
    email: "tecnico@inntelcorp.ec",
    displayName: "Ing. Carlos Benítez",
    role: "tecnico",
    department: "Ingeniería NOC & MikroTik",
    phone: "+593 97 123 4567",
    status: "activo",
    passwordHash: "Tecnico2026*",
    permissions: ["manage_network", "manage_tickets", "manage_clients"],
    createdAt: "2024-03-10T11:15:00Z",
  },
  {
    uid: "usr-sop-04",
    email: "soporte@inntelcorp.ec",
    displayName: "Téc. Alex Mendoza",
    role: "soporte",
    department: "Mesa de Ayuda & Cuadrillas",
    phone: "+593 96 987 6543",
    status: "activo",
    passwordHash: "Soporte2026*",
    permissions: ["manage_tickets"],
    createdAt: "2024-04-05T08:45:00Z",
  },
  {
    uid: "usr-leg-05",
    email: "legal@inntelcorp.ec",
    displayName: "Abg. Fernando Viteri",
    role: "legal",
    department: "Asesoría Jurídica & ARCOTEL",
    phone: "+593 95 654 3210",
    status: "activo",
    passwordHash: "Arcotel2026*",
    permissions: ["manage_policies", "export_reports"],
    createdAt: "2024-04-20T14:00:00Z",
  },
];

export interface SystemAccount {
  user: UserProfile;
  passwordHash: string;
}

export const SYSTEM_ACCOUNTS: SystemAccount[] = INITIAL_SYSTEM_USERS.map((u) => ({
  user: {
    uid: u.uid,
    email: u.email,
    displayName: u.displayName,
    role: u.role,
    department: u.department,
    phone: u.phone,
    status: u.status,
    permissions: u.permissions,
  },
  passwordHash: u.passwordHash,
}));

export const INITIAL_USER: UserProfile = INITIAL_SYSTEM_USERS[0];

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

export const INITIAL_NODES: NodeLocation[] = [
  {
    id: "nodo-01",
    name: "POP Central - Quito Norte",
    address: "Av. Amazonas y Naciones Unidas, Edif. La Previsora",
    coordinates: { lat: -0.1786, lng: -78.4862 },
    upstreamProvider: "Telconet / CenturyLink",
    totalCapacityMbps: 10000,
    usedCapacityMbps: 2350,
    mikrotikIp: "10.0.0.1",
    status: "online",
    activeClientsCount: 0,
    notes: "Nodal principal con redundancia eléctrica y doble enlace BGP",
  },
  {
    id: "nodo-02",
    name: "POP Cumbayá - Valle de Tumbaco",
    address: "Av. Interoceánica km 11.5, Cumbayá",
    coordinates: { lat: -0.2033, lng: -78.4328 },
    upstreamProvider: "Claro Empresas",
    totalCapacityMbps: 5000,
    usedCapacityMbps: 1100,
    mikrotikIp: "10.0.0.2",
    status: "online",
    activeClientsCount: 0,
    notes: "Anillo óptico hacia Cumbayá y Tumbaco",
  },
  {
    id: "nodo-03",
    name: "POP Sur - El Recreo",
    address: "Av. Pedro Vicente Maldonado, C.C. El Recreo",
    coordinates: { lat: -0.2458, lng: -78.5192 },
    upstreamProvider: "Ufinet",
    totalCapacityMbps: 5000,
    usedCapacityMbps: 850,
    mikrotikIp: "10.0.0.3",
    status: "online",
    activeClientsCount: 0,
    notes: "Distribución FTTH para el sector sur de Quito",
  },
];

export const INITIAL_IP_POOLS: IpPool[] = [
  {
    id: "pool-01",
    name: "Pool CGNAT Clientes Residenciales",
    subnetCidr: "100.64.10.0/24",
    gateway: "100.64.10.1",
    type: "cgnat",
    totalIpsCount: 254,
    usableIpsCount: 252,
    assignedIpsCount: 0,
    nodeId: "nodo-01",
  },
  {
    id: "pool-02",
    name: "Pool IPs Públicas Fijas Corporativas",
    subnetCidr: "186.46.80.0/28",
    gateway: "186.46.80.1",
    type: "publica_fija",
    totalIpsCount: 16,
    usableIpsCount: 14,
    assignedIpsCount: 0,
    nodeId: "nodo-01",
  },
];

export const INITIAL_CLIENTS: Client[] = [];
export const INITIAL_CLIENT_SERVICES: ClientService[] = [];

export const INITIAL_POLICIES: ArcotelPolicy[] = [
  {
    id: "pol-01",
    policyNumber: "POL-SEGUROS-2026-8891",
    insuranceCompany: "Seguros Equinoccial S.A.",
    policyType: "fiel_cumplimiento",
    titleGrantCode: "TH-SAI-2024-0091",
    startDate: "2026-01-01",
    expirationDate: "2027-01-01",
    insuredAmount: 15000.0,
    status: "vigente",
    daysUntilExpiration: 104,
    notes: "Garantía bancaria / póliza de fiel cumplimiento depositada ante ARCOTEL",
  },
];

export const INITIAL_VAULT: VaultCredential[] = [
  {
    id: "vault-01",
    serviceName: "Router Core MikroTik NOC Central",
    serviceType: "mikrotik",
    portalUrl: "winbox://10.0.0.1",
    username: "admin_noc",
    encryptedPassword: "AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA=",
    notes: "Acceso Winbox/SSH con privilegios Full para administración BGP y OSPF",
    allowedRoles: ["superadmin", "tecnico"],
    updatedAt: "2026-01-15T10:00:00Z",
  },
  {
    id: "vault-02",
    serviceName: "Portal SIETEL ARCOTEL",
    serviceType: "sietel",
    portalUrl: "https://sietel.arcotel.gob.ec/",
    username: "operador_inntel",
    encryptedPassword: "AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA=",
    notes: "Carga de reportes trimestrales de calidad y abonados",
    allowedRoles: ["superadmin", "legal", "admin"],
    updatedAt: "2026-02-01T12:00:00Z",
  },
];

export const INITIAL_TICKETS: Ticket[] = [];
export const INITIAL_EXPENSES: Expense[] = [];
export const INITIAL_MONTHLY_CHARGES: MonthlyCharge[] = [];
