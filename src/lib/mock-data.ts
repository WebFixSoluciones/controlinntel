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
  ClientProjectTask,
  ClientQuoteOrder,
  ClientVaultItem,
  ClientContractInfo,
  AuditLog,
} from "@/types";
import { simpleEncrypt } from "./crypto-vault";

export const INITIAL_SYSTEM_USERS: SystemUser[] = [
  {
    uid: "usr-superadmin-00",
    email: "superadmin@inntelcorp.com",
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
    email: "admin@inntelcorp.com",
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
    email: "finanzas@inntelcorp.com",
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
    email: "tecnico@inntelcorp.com",
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
    email: "soporte@inntelcorp.com",
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
    email: "legal@inntelcorp.com",
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

// ============================================================================
// CLIENTE DEMO 360° CON PROCESO OPERATIVO COMPLETO (END-TO-END)
// ============================================================================

export const DEMO_CLIENT: Client = {
  id: "cli-demo-corp-01",
  identificationType: "RUC",
  identificationNumber: "1792345678001",
  businessName: "CORPORACIÓN INDUSTRIAL Y LOGÍSTICA ECUATORIANA C.A.",
  legalRepresentative: "Ing. Patricio Echeverría",
  email: "gerencia@corpecuador.com",
  phone: "+593 2 298 7654",
  address: "Av. República de El Salvador N36-140 y Naciones Unidas, Edificio Platinum Plaza, Piso 8, Quito",
  sector: "Quito Norte - Distrito Financiero",
  requiresSriBilling: true,
  status: "activo",
  totalActiveServices: 1,
  currentBalance: 109.25,
  createdAt: "2024-01-15T08:00:00Z",
  updatedAt: "2026-09-18T10:00:00Z",
  contactName: "Ing. Patricio Echeverría",
  contactRole: "Director de Operaciones & IT",
  contactPhone: "0998451234",
  contactAddress: "Av. República de El Salvador N36-140, Quito",
};

export const DEMO_NODE: NodeLocation = {
  id: "nodo-quito-norte",
  name: "POP 01 - Telepuerto Quito Norte (MikroTik CCR2004)",
  address: "Av. 6 de Diciembre y Eloy Alfaro, Quito",
  coordinates: { lat: -0.180653, lng: -78.484215 },
  upstreamProvider: "Telconet / CenturyLink - Enlace STM-16",
  totalCapacityMbps: 10000,
  usedCapacityMbps: 2450,
  mikrotikIp: "10.200.1.1",
  status: "online",
  activeClientsCount: 1,
  notes: "Router de borde MikroTik CCR2004-1G-12S+2XS con RouterOS v7 y BGP peering activo.",
};

export const DEMO_IP_POOL: IpPool = {
  id: "pool-corp-public",
  name: "Pool Corporativo IPs Públicas Fijas /28 (ARCOTEL)",
  subnetCidr: "186.42.110.0/28",
  gateway: "186.42.110.1",
  type: "publica_fija",
  totalIpsCount: 16,
  usableIpsCount: 14,
  assignedIpsCount: 1,
  nodeId: "nodo-quito-norte",
};

export const DEMO_CLIENT_SERVICE: ClientService = {
  id: "srv-demo-01",
  clientId: "cli-demo-corp-01",
  planId: "plan-500m",
  planName: "Fibra Óptica Dedicado 500M",
  downloadMbps: 500,
  uploadMbps: 500,
  basePrice: 95.0,
  customPrice: 95.0,
  billingType: "pospago",
  cutoffDay: 1,
  nodeId: "nodo-quito-norte",
  nodeName: "POP 01 - Telepuerto Quito Norte (MikroTik CCR2004)",
  ipv4Address: "186.42.110.5",
  ipv6Prefix: "2800:3f0:4000:100::/64",
  pppoeUser: "corpecuador_corp",
  pppoePassword: "CorpSecurePppoe2026*",
  status: "activo",
  installationDate: "2024-01-20",
  installationAddress: "Av. República de El Salvador N36-140 y Naciones Unidas, Edificio Platinum Plaza, Piso 8, Quito",
  coordinates: { lat: -0.179854, lng: -78.483214 },
  ontSerialNumber: "HWTCD928B104",
  notes: "Enlace simétrico 1:1 corporativo. Pigtail monomodo LC-APC con OLT Huawei SmartAX y ONU Huawei EchoLife.",
};

export const DEMO_QUOTE_ORDER: ClientQuoteOrder = {
  id: "ord-2024-001",
  clientId: "cli-demo-corp-01",
  clientName: "CORPORACIÓN INDUSTRIAL Y LOGÍSTICA ECUATORIANA C.A.",
  clientRuc: "1792345678001",
  quoteNumber: "COT-2024-0089",
  title: "Orden de Pedido: Conectividad Fibra Óptica 500M Simétrica + Router Wi-Fi 6 Corporativo",
  items: [
    {
      id: "itm-01",
      description: "Acometida e Instalación Fibra Óptica Monomodo 2 Hilos (150m)",
      quantity: 1,
      unitPrice: 120.0,
      total: 120.0,
    },
    {
      id: "itm-02",
      description: "Router de Borde MikroTik hEX S + ONU GPON Huawei EchoLife",
      quantity: 1,
      unitPrice: 150.0,
      total: 150.0,
    },
    {
      id: "itm-03",
      description: "Mensualidad Plan Dedicado 500 Mbps Simétrico (Mes de Inicio)",
      quantity: 1,
      unitPrice: 95.0,
      total: 95.0,
    },
  ],
  subtotal: 365.0,
  ivaAmount: 54.75,
  total: 419.75,
  status: "facturada",
  validUntil: "2024-02-15",
  notes: "Aprobado por Gerencia General. Cumple especificaciones técnicas ARCOTEL.",
  createdAt: "2024-01-16T10:30:00Z",
};

export const DEMO_PROJECT_TASKS: ClientProjectTask[] = [
  {
    id: "tsk-2024-01",
    clientId: "cli-demo-corp-01",
    clientName: "CORPORACIÓN INDUSTRIAL Y LOGÍSTICA ECUATORIANA C.A.",
    title: "Factibilidad y Estudio de Campo - Platinum Plaza",
    description: "Inspección de ductería vertical y niveles de potencia óptica en mufa de distribución.",
    column: "completado",
    priority: "alta",
    assignedTo: "Ing. Carlos Benítez",
    dueDate: "2024-01-17",
    checklist: [
      { id: "chk-01", text: "Verificación de poste y caja NAP más cercana", done: true },
      { id: "chk-02", text: "Medición de potencia óptica en splitter (-18 dBm)", done: true },
      { id: "chk-03", text: "Validación de ruta de ingreso a sala de servidores", done: true },
    ],
    notes: "Factibilidad 100% aprobada. Capacidad disponible en puerto PON 3.",
    createdAt: "2024-01-16T11:00:00Z",
    updatedAt: "2024-01-17T16:00:00Z",
  },
  {
    id: "tsk-2024-02",
    clientId: "cli-demo-corp-01",
    clientName: "CORPORACIÓN INDUSTRIAL Y LOGÍSTICA ECUATORIANA C.A.",
    title: "Tendido y Fusión de Fibra Óptica 2 Hilos",
    description: "Tendido de acometida dieléctrica de 150 metros y conectorización SC/APC.",
    column: "completado",
    priority: "alta",
    assignedTo: "Téc. Alex Mendoza",
    dueDate: "2024-01-19",
    checklist: [
      { id: "chk-04", text: "Tendido canalizado por tubería EMT", done: true },
      { id: "chk-05", text: "Fusión en ODF central y roseta óptica de cliente", done: true },
      { id: "chk-06", text: "Certificación reflectométrica OTDR", done: true },
    ],
    notes: "Atenuación certificada en 0.28 dB/km. Señal final en ONT: -18.4 dBm.",
    createdAt: "2024-01-18T08:00:00Z",
    updatedAt: "2024-01-19T17:30:00Z",
  },
  {
    id: "tsk-2024-03",
    clientId: "cli-demo-corp-01",
    clientName: "CORPORACIÓN INDUSTRIAL Y LOGÍSTICA ECUATORIANA C.A.",
    title: "Aprovisionamiento de Router MikroTik & ONU",
    description: "Configuración de credenciales PPPoE, IP estática 186.42.110.5 y QoS simétrico.",
    column: "completado",
    priority: "urgente",
    assignedTo: "Ing. Carlos Benítez",
    dueDate: "2024-01-20",
    checklist: [
      { id: "chk-07", text: "Configuración de perfil PPPoE con cola simple 500M/500M", done: true },
      { id: "chk-08", text: "Asignación de IP pública fija 186.42.110.5/28", done: true },
      { id: "chk-09", text: "Test de rendimiento RFC 2544 (latencia < 4ms)", done: true },
    ],
    notes: "Enlace activado y sincronizado con NOC Central.",
    createdAt: "2024-01-20T09:00:00Z",
    updatedAt: "2024-01-20T13:00:00Z",
  },
  {
    id: "tsk-2024-04",
    clientId: "cli-demo-corp-01",
    clientName: "CORPORACIÓN INDUSTRIAL Y LOGÍSTICA ECUATORIANA C.A.",
    title: "Monitoreo Preventivo de Latencia y Calidad de Enlace",
    description: "Validación de parámetros de disponibilidad exigidos por ARCOTEL.",
    column: "pruebas_homologacion",
    priority: "media",
    assignedTo: "Ing. Carlos Benítez",
    dueDate: "2026-10-01",
    checklist: [
      { id: "chk-10", text: "Monitoreo ICMP en Zabbix / Grafana", done: true },
      { id: "chk-11", text: "Comprobación de pérdida de paquetes 0.00%", done: true },
      { id: "chk-12", text: "Auditoría de retención de logs de tráfico IP", done: false },
    ],
    notes: "SLA garantizado del 99.8%. Rendimiento impecable durante los últimos 30 días.",
    createdAt: "2026-08-01T08:00:00Z",
    updatedAt: "2026-09-18T12:00:00Z",
  },
];

export const DEMO_CONTRACT: ClientContractInfo = {
  id: "con-2024-001",
  clientId: "cli-demo-corp-01",
  contractNumber: "INNTEL-SAI-2024-0412",
  arcotelHomologationCode: "ARCOTEL-CPO-2023-0981",
  planName: "Fibra Óptica Dedicado 500M Simétrico",
  signedDate: "2024-01-20",
  expirationDate: "2026-01-20",
  renewalDate: "2026-01-05",
  status: "vigente",
  monthlyPrice: 95.0,
  notes: "Contrato homologado por ARCOTEL bajo el Régimen General de Telecomunicaciones SAI. Cláusula de SLA 99.8% de disponibilidad.",
};

export const DEMO_CLIENT_VAULT_ITEMS: ClientVaultItem[] = [
  {
    id: "vlt-cli-01",
    clientId: "cli-demo-corp-01",
    serviceName: "Router de Borde MikroTik Platinum Plaza",
    category: "ont_router",
    username: "admin_inntel",
    encryptedPassword: simpleEncrypt("MikroTik#Corp2026"),
    ipAddress: "186.42.110.5",
    port: 8291,
    notes: "Winbox port 8291 protegido por Firewall filter rules. Solo accesible desde IP NOC INNTEL.",
    updatedAt: "2024-01-20T14:00:00Z",
  },
  {
    id: "vlt-cli-02",
    clientId: "cli-demo-corp-01",
    serviceName: "Red Wi-Fi 6 Corporativa (SSID: CorpEcuador_5G)",
    category: "wifi",
    username: "WPA3-Enterprise",
    encryptedPassword: simpleEncrypt("WiFi#Corp2026*Secure"),
    notes: "Red con aislamiento de clientes (AP Isolation) y ancho de canal 80MHz.",
    updatedAt: "2024-01-20T14:00:00Z",
  },
  {
    id: "vlt-cli-03",
    clientId: "cli-demo-corp-01",
    serviceName: "Túnel de Acceso PPPoE / Radius",
    category: "pppoe",
    username: "corpecuador_corp",
    encryptedPassword: simpleEncrypt("CorpSecurePppoe2026*"),
    notes: "Autenticación Radius centralizada con asignación de IP estática.",
    updatedAt: "2024-01-20T14:00:00Z",
  },
];

export const DEMO_TICKETS: Ticket[] = [
  {
    id: "tkt-2024-01",
    ticketNumber: "TKT-8901",
    clientId: "cli-demo-corp-01",
    clientName: "CORPORACIÓN INDUSTRIAL Y LOGÍSTICA ECUATORIANA C.A.",
    title: "Instalación, Fusión y Certificación de Enlace Dedicado 500M",
    description: "Instalación de acometida de fibra óptica desde el splitter 1:8 de Platinum Plaza hasta rack de servidores en piso 8.",
    category: "configuracion_ip",
    priority: "alta",
    status: "resuelto",
    assignedToId: "usr-tec-03",
    assignedToName: "Ing. Carlos Benítez",
    createdAt: "2024-01-20T08:30:00Z",
    resolvedAt: "2024-01-20T14:15:00Z",
    resolutionNotes: "Fusión realizada con 0.02 dB de pérdida en 1310/1550nm. Potencia óptica recibida: -18.4 dBm. Enlace 100% operativo con 500 Mbps simétricos comprobados.",
    nodeName: "POP 01 - Telepuerto Quito Norte (MikroTik CCR2004)",
  },
];

export const DEMO_MONTHLY_CHARGES: MonthlyCharge[] = [
  {
    id: "chg-2024-08",
    clientId: "cli-demo-corp-01",
    clientName: "CORPORACIÓN INDUSTRIAL Y LOGÍSTICA ECUATORIANA C.A.",
    clientRuc: "1792345678001",
    month: 8,
    year: 2026,
    serviceDescription: "Servicio de Internet Dedicado Simétrico 500M - Agosto 2026",
    subtotal: 95.0,
    ivaAmount: 14.25,
    total: 109.25,
    status: "pagado",
    paymentDate: "2026-08-05T11:20:00Z",
    paymentMethod: "Transferencia Banco Pichincha",
    invoiceNumber: "001-010-0004521",
  },
  {
    id: "chg-2024-09",
    clientId: "cli-demo-corp-01",
    clientName: "CORPORACIÓN INDUSTRIAL Y LOGÍSTICA ECUATORIANA C.A.",
    clientRuc: "1792345678001",
    month: 9,
    year: 2026,
    serviceDescription: "Servicio de Internet Dedicado Simétrico 500M - Septiembre 2026",
    subtotal: 95.0,
    ivaAmount: 14.25,
    total: 109.25,
    status: "pendiente",
    invoiceNumber: "001-010-0004780",
  },
];

export const DEMO_POLICIES: ArcotelPolicy[] = [
  {
    id: "pol-arcotel-01",
    policyNumber: "POL-SEG-2026-00452",
    insuranceCompany: "Seguros Sucre / Seguros del Pichincha",
    policyType: "fiel_cumplimiento",
    titleGrantCode: "CON-INNTEL-SAI-2018-04",
    startDate: "2024-01-01",
    expirationDate: "2026-12-31",
    insuredAmount: 25000.0,
    status: "vigente",
    daysUntilExpiration: 280,
    notes: "Póliza de fiel cumplimiento del contrato de concesión del Servicio de Acceso a Internet (SAI) otorgado por ARCOTEL.",
  },
];

export const DEMO_VAULT: VaultCredential[] = [
  {
    id: "vlt-gen-01",
    serviceName: "Portal SIETEL - Carga Mensual ARCOTEL",
    serviceType: "sietel",
    portalUrl: "https://sietel.arcotel.gob.ec/",
    username: "INNTEL_CORP_RUC1793211553001",
    encryptedPassword: simpleEncrypt("Arcotel#Sietel2026*"),
    notes: "Acceso institucional para reporte de abonados, capacidad de tráfico internacional y calidad de servicio.",
    allowedRoles: ["superadmin", "admin", "legal"],
    updatedAt: "2024-01-01T08:00:00Z",
  },
];

export const DEMO_AUDIT_LOGS: AuditLog[] = [
  {
    id: "log-demo-01",
    userId: "usr-admin-01",
    userEmail: "admin@inntelcorp.com",
    userRole: "admin",
    action: "CREATE_CLIENT",
    resource: "CORPORACIÓN INDUSTRIAL Y LOGÍSTICA ECUATORIANA C.A.",
    details: "Alta de nuevo cliente corporativo RUC: 1792345678001 en Telepuerto Quito Norte.",
    timestamp: "2024-01-15T08:30:00Z",
  },
  {
    id: "log-demo-02",
    userId: "usr-tec-03",
    userEmail: "tecnico@inntelcorp.com",
    userRole: "tecnico",
    action: "UPDATE_VAULT",
    resource: "Router de Borde MikroTik Platinum Plaza",
    details: "Almacenamiento cifrado de credenciales de acceso Winbox y PPPoE.",
    timestamp: "2024-01-20T14:05:00Z",
  },
  {
    id: "log-demo-03",
    userId: "usr-leg-05",
    userEmail: "legal@inntelcorp.com",
    userRole: "legal",
    action: "GENERATE_DOC",
    resource: "Contrato INNTEL-SAI-2024-0412",
    details: "Generación y archivo de contrato homologado ARCOTEL con cláusula de SLA 99.8%.",
    timestamp: "2024-01-20T15:00:00Z",
  },
  {
    id: "log-demo-04",
    userId: "usr-fin-02",
    userEmail: "finanzas@inntelcorp.com",
    userRole: "finanzas",
    action: "EXPORT_FINANCE",
    resource: "Factura 001-010-0004521",
    details: "Emisión de comprobante mensual de cobro por $109.25 (Plan 500M + IVA).",
    timestamp: "2026-08-05T11:25:00Z",
  },
];

// Exportaciones iniciales para el estado de la aplicación
export const INITIAL_NODES: NodeLocation[] = [DEMO_NODE];
export const INITIAL_IP_POOLS: IpPool[] = [DEMO_IP_POOL];
export const INITIAL_CLIENTS: Client[] = [DEMO_CLIENT];
export const INITIAL_CLIENT_SERVICES: ClientService[] = [DEMO_CLIENT_SERVICE];
export const INITIAL_POLICIES: ArcotelPolicy[] = DEMO_POLICIES;
export const INITIAL_VAULT: VaultCredential[] = DEMO_VAULT;
export const INITIAL_TICKETS: Ticket[] = DEMO_TICKETS;
export const INITIAL_EXPENSES: Expense[] = [];
export const INITIAL_MONTHLY_CHARGES: MonthlyCharge[] = DEMO_MONTHLY_CHARGES;
export const INITIAL_PROJECT_TASKS: ClientProjectTask[] = DEMO_PROJECT_TASKS;
export const INITIAL_QUOTES: ClientQuoteOrder[] = [DEMO_QUOTE_ORDER];
export const INITIAL_CLIENT_VAULT: ClientVaultItem[] = DEMO_CLIENT_VAULT_ITEMS;
export const INITIAL_CONTRACTS: ClientContractInfo[] = [DEMO_CONTRACT];
export const INITIAL_AUDIT_LOGS: AuditLog[] = DEMO_AUDIT_LOGS;
