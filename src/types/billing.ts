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

/**
 * Canal comercial del documento. Ambos producen NOTA DE VENTA, pero se distinguen
 * para trazabilidad y, si el negocio lo configura, para usar una serie distinta.
 *  - mostrador: venta puntual o administrativa (Nueva Venta).
 *  - servicio : emisión derivada de un servicio contratado (alta y recurrencia).
 */
export type SaleChannel = "mostrador" | "servicio";

export interface BankTransferDetails {
  enabled: boolean;
  bankName: string;
  accountType: "" | "corriente" | "ahorros";
  accountNumber: string;
  holderName: string;
  holderIdentification: string;
  confirmationEmail: string;
}

export interface SriCompanyConfig {
  bankTransferDetails?: BankTransferDetails;
  representanteLegal?: string;
  website?: string;
  id: string;
  ruc: string;
  razonSocial: string;
  nombreComercial: string;
  direccionMatriz: string;
  direccionEstablecimiento: string;
  establecimiento: string; // ej. "001"
  puntoEmision: string;    // ej. "001"
  /** Punto de emisión para documentos derivados de servicios. Si se omite, comparte puntoEmision. */
  puntoEmisionServicios?: string;
  obligadoContabilidad: boolean;
  tipoContribuyente: "general" | "rimpe_emprendedor" | "rimpe_popular";
  ambiente: SriEnvironment;
  resolucionAgenteRetencion?: string;
  contribuyenteEspecial?: string;
  rucProveedorFacturacion?: string;
  emailNotificaciones?: string;
  telefonoContacto?: string;
  logoUrl?: string;

  // Entrega de documentos electrónicos por correo (la contraseña SMTP se
  // guarda en el servidor, en sriSecrets/email, y nunca viaja al navegador).
  emailEnabled?: boolean;
  emailHost?: string;
  emailPort?: number;
  emailSecure?: boolean;
  emailUser?: string;
  emailFromName?: string;
  emailFrom?: string;
  emailReplyTo?: string;
  emailCopyTo?: string;
  emailNotifyClient?: boolean;
  emailNotifyCompany?: boolean;
  // Certificado digital de firma electrónica PKCS#12 (.p12 / .pfx)
  certificadoNombre?: string;
  certificadoVencimiento?: string;
  certificadoEmisor?: string;
  certificadoClave?: string;
  certificadoCargado?: boolean;
  certificadoBase64?: string;
  certificadoTamano?: number;
  certificadoFechaCarga?: string;

  // Control de Secuencias de Comprobantes SRI
  secuencialFactura?: number;
  secuencialNotaVenta?: number;
  secuencialNotaCredito?: number;
  secuencialNotaDebito?: number;
  secuencialRetencion?: number;
  secuencialGuiaRemision?: number;
  secuencialCotizacion?: number;
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

export interface SriFiscalEvidence {
  estadoSRI?: SriWsResponse["estado"];
  numeroAutorizacion?: string;
  authorizationDate?: string;
  ambiente?: SriEnvironment;
  xmlFirmado?: string;
  xmlAutorizado?: string;
  authorizationVerified?: boolean;
  mensajesSRI?: SriWsResponse["mensajes"];
  fiscalIssuer?: Partial<SriCompanyConfig>;
}


export interface InvoiceItem {
  serviceId?: string;
  periodStart?: string;
  periodEnd?: string;
  zeroPriceReason?: string;
  id: string;
  productId: string;
  sku: string;
  name: string;
  description?: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  discount: number;      // Valor en dólares de descuento
  discountType?: "percentage" | "amount" | "no_iva";
  discountInput?: number;
  ivaRate: number;       // 15, 0, 5
  subtotal: number;      // (unitPrice * quantity) - discount
  ivaAmount: number;     // subtotal * (ivaRate / 100)
  total: number;         // subtotal + ivaAmount
  warehouseId?: string;
  serialNumbers?: string[]; // Números de serie / MAC para equipos como ONTs y routers
}

export interface SriInvoice extends SriFiscalEvidence {
  subtotal?: number;
  basesByRate?: Record<string, number>;
  id: string;
  documentType?: "factura" | "nota_venta";
  /** Canal que originó el documento; por defecto "mostrador". */
  saleChannel?: SaleChannel;
  documentNumber: string; // ej. "001-001-000000045"
  /** Serie usada (establecimiento-punto de emisión) y establecimiento solicitado. */
  series?: string;
  establishment?: string;
  claveAcceso: string;    // 49 dígitos oficiales del SRI (vacío o "NO_APLICA_SRI" si es nota_venta)
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
  paymentsBreakdown?: {
    efectivo: number;
    transferencia: number;
    tarjeta: number;
    credito: number;
  };
  transferenciaRef?: string;
  tarjetaRef?: string;
  bankAccountId?: string;
  creditDueDate?: string;
  creditNotes?: string;
  orderNumber?: string;
  sriPaymentCode?: string; // "01", "19", "20"
  paymentTermDays?: number;

  status: "borrador" | "emitida" | "autorizada" | "anulada" | "registrado";
  ultimoEnvioSRI?: string;

  warehouseId: string;
  warehouseName: string;
  kardexRegistered: boolean;

  sriStatus?: "pendiente" | "facturada" | "no_aplica";
  sriInvoiceId?: string;
  sriInvoicesByEnvironment?: Partial<Record<SriEnvironment, string>>;
  sriDocumentNumber?: string;
  relatedSaleId?: string;

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

export interface CreditNote extends SriFiscalEvidence {
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
  tipoIdentificacion?: string;
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

export interface WithholdingReceipt extends SriFiscalEvidence {
  id: string;
  documentNumber: string; // ej. "001-001-000000012"
  claveAcceso: string;
  date: string;
  clientId: string;
  clientName: string;
  clientRuc: string;
  invoiceNumber: string;
  purchaseInvoiceId?: string;
  support?: {
    date: string;
    authorization: string;
    code: string;
    relatedParty: boolean;
    paymentCode: string;
    subtotal: number;
    total: number;
    taxes: { rate: number; base: number; value: number }[];
  };
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

export interface RemissionGuide extends SriFiscalEvidence {
  id: string;
  documentNumber: string; // ej. "001-001-000000008"
  claveAcceso: string;
  date: string;
  startDate: string;
  endDate: string;
  invoiceId?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  invoiceAuthorization?: string;
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
  status: "emitida" | "autorizada" | "en_transito" | "entregada";
  createdAt: string;
}

export interface DebitNoteReason {
  reason: string;
  amount: number;
}

export interface DebitNote extends SriFiscalEvidence {
  id: string;
  documentNumber: string; // ej. "001-001-000000010"
  claveAcceso: string;    // 49 dígitos oficiales del SRI
  date: string;
  modifiedInvoiceNumber: string;
  invoiceId?: string;
  modifiedInvoiceDate: string;
  clientId: string;
  clientName: string;
  clientRuc: string;
  tipoIdentificacion?: string;
  paymentCode?: "01" | "16" | "19" | "20";
  clientEmail: string;
  clientAddress?: string;
  reasons: DebitNoteReason[];
  subtotal: number;
  ivaRate: number;
  ivaAmount: number;
  total: number;
  status: "emitida" | "autorizada" | "anulada";
  createdAt: string;
}
