// ==========================================
// INNTEL CORP - ERP BILLING & SRI MODULE TYPES
// ==========================================

export type SriDocumentType =
  | "factura"
  | "nota_credito"
  | "nota_debito"
  | "retencion"
  | "guia_remision"
  | "cotizacion";

export type SriEnvironment = "1" | "2"; // 1: Pruebas, 2: Producción

export interface SriCompanyConfig {
  id: string;
  ruc: string;
  razonSocial: string;
  nombreComercial: string;
  direccionMatriz: string;
  direccionEstablecimiento: string;
  establecimiento: string; // ej. "001"
  puntoEmision: string;    // ej. "001"
  obligadoContabilidad: boolean;
  tipoContribuyente: "general" | "rimpe_emprendedor" | "rimpe_popular";
  ambiente: SriEnvironment;
  resolucionAgenteRetencion?: string;
  contribuyenteEspecial?: string;
  emailNotificaciones?: string;
  telefonoContacto?: string;
  logoUrl?: string;
  // Certificado digital de firma electrónica PKCS#12 (.p12 / .pfx)
  certificadoNombre?: string;
  certificadoVencimiento?: string;
  certificadoEmisor?: string;
  certificadoClave?: string;
  certificadoCargado?: boolean;
}

export interface SriWsResponse {
  success: boolean;
  estado: "AUTORIZADO" | "EN PROCESO" | "DEVUELTA" | "NO AUTORIZADO" | "ERROR_CONEXION";
  claveAcceso: string;
  numeroAutorizacion?: string;
  fechaAutorizacion?: string;
  ambiente: SriEnvironment;
  mensajes?: Array<{
    identificador?: string;
    mensaje: string;
    informacionAdicional?: string;
    tipo?: string;
  }>;
  xmlFirmado?: string;
}

export interface SriConnectionTestResult {
  online: boolean;
  ambiente: SriEnvironment;
  recepcionWsUrl: string;
  autorizacionWsUrl: string;
  recepcionStatus: "disponible" | "inaccesible";
  autorizacionStatus: "disponible" | "inaccesible";
  latencyMs: number;
  checkedAt: string;
  message: string;
}


export interface InvoiceItem {
  id: string;
  productId: string;
  sku: string;
  name: string;
  description?: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  discount: number;      // Valor en dólares de descuento
  ivaRate: number;       // 15, 0, 5
  subtotal: number;      // (unitPrice * quantity) - discount
  ivaAmount: number;     // subtotal * (ivaRate / 100)
  total: number;         // subtotal + ivaAmount
  warehouseId?: string;
  serialNumbers?: string[]; // Números de serie / MAC para equipos como ONTs y routers
}

export interface SriInvoice {
  id: string;
  documentNumber: string; // ej. "001-001-000000045"
  claveAcceso: string;    // 49 dígitos oficiales del SRI
  date: string;           // YYYY-MM-DD
  time?: string;
  clientId: string;
  clientName: string;
  clientRuc: string;
  clientEmail: string;
  clientPhone?: string;
  clientAddress: string;
  tipoIdentificacion: string; // "04" RUC, "05" Cédula, "06" Pasaporte, "07" Consumidor Final

  items: InvoiceItem[];

  subtotal15: number;
  subtotal0: number;
  subtotalNoObjeto: number;
  subtotalExento: number;
  discountTotal: number;
  ivaTotal: number;
  total: number;

  paymentMethod: "efectivo" | "transferencia" | "tarjeta" | "credito";
  sriPaymentCode?: string; // "01", "19", "20"
  paymentTermDays?: number;

  status: "borrador" | "emitida" | "autorizada" | "anulada";
  authorizationDate?: string;

  warehouseId: string;
  warehouseName: string;
  kardexRegistered: boolean;

  notes?: string;
  createdAt: string;
}

export interface ClientQuote {
  id: string;
  quoteNumber: string; // ej. "COT-2026-0001"
  date: string;
  validUntil: string;
  clientId: string;
  clientName: string;
  clientRuc: string;
  clientEmail: string;
  clientPhone?: string;
  clientAddress?: string;

  items: InvoiceItem[];

  subtotal15: number;
  subtotal0: number;
  discountTotal: number;
  ivaTotal: number;
  total: number;

  status: "borrador" | "enviada" | "aprobada" | "facturada" | "rechazada";
  invoicedAt?: string;
  invoiceId?: string;
  invoiceNumber?: string;

  notes?: string;
  createdAt: string;
}

export interface CreditNote {
  id: string;
  documentNumber: string; // ej. "001-001-000000005"
  claveAcceso: string;    // 49 dígitos
  date: string;
  invoiceId: string;
  invoiceNumber: string;  // Factura que modifica
  invoiceDate: string;
  clientId: string;
  clientName: string;
  clientRuc: string;
  reason: string;         // Motivo de anulación o descuento

  items: InvoiceItem[];

  subtotal15: number;
  subtotal0: number;
  ivaTotal: number;
  total: number;

  warehouseId: string;
  warehouseName: string;
  kardexReentered: boolean; // Si los ítems físicos reingresaron al stock

  status: "emitida" | "autorizada" | "anulada";
  createdAt: string;
}

export interface WithholdingItem {
  taxType: "RENTA" | "IVA";
  code: string;           // Código SRI (ej. 312, 332, 70%, 100%)
  percentage: number;
  taxBase: number;
  retainedAmount: number;
}

export interface WithholdingReceipt {
  id: string;
  documentNumber: string; // ej. "001-001-000000012"
  claveAcceso: string;
  date: string;
  clientId: string;
  clientName: string;
  clientRuc: string;
  invoiceNumber: string;
  fiscalPeriod: string;   // MM/YYYY
  items: WithholdingItem[];
  totalRetained: number;
  status: "emitida" | "autorizada" | "anulada";
  createdAt: string;
}

export interface RemissionGuideItem {
  name: string;
  quantity: number;
  unit: string;
  sku?: string;
}

export interface RemissionGuide {
  id: string;
  documentNumber: string; // ej. "001-001-000000008"
  claveAcceso: string;
  date: string;
  startDate: string;
  endDate: string;
  invoiceNumber?: string;
  carrierName: string;
  carrierRuc: string;
  licensePlate: string;
  originAddress: string;
  destAddress: string;
  destClientName: string;
  destClientRuc: string;
  route: string;
  reason: string;
  items: RemissionGuideItem[];
  status: "emitida" | "en_transito" | "entregada";
  createdAt: string;
}
