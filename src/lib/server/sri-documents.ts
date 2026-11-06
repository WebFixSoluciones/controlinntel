import { z } from "zod";
import type { Firestore, Transaction } from "firebase-admin/firestore";
import type { CreditNote, DebitNote, RemissionGuide, SriCompanyConfig, SriInvoice, WithholdingReceipt } from "@/types";
import { calculateLines, cents, money, validDate, type RecordData } from "../commercial-core.ts";
import { getEcuadorDate } from "../date-utils.ts";
import {
  generarFacturaXml, generarNotaCreditoXml, generarNotaDebitoXml, generarGuiaRemisionXml,
  generarComprobanteRetencionXml, validarClaveAccesoSRI, obtenerTipoIdentificacionSRI,
  validarConsumidorFinalMonto, validarIdentificacionEcuador, normalizarPagosFactura,
} from "../sri-service.ts";
import { HttpError } from "./security.ts";

const id = z.string().regex(/^[\w-]{1,150}$/);
const date = z.string().refine(validDate, "Fecha inválida.");
const amount = z.number().finite().positive().max(100_000_000);
const quantity = amount.refine(value => Number(value.toFixed(6)) === value, "La cantidad admite hasta seis decimales.");
const required = z.string().trim().min(1).max(300);
const rate = z.number().refine(value => [0, 5, 12, 13, 14, 15].includes(value), "Tarifa de IVA no admitida.");
const kind = z.enum(["factura", "nota_credito", "nota_debito", "guia_remision", "retencion"]);

export const sriRequest = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("factura"), saleId: id, clientId: id.optional(), clientRuc: z.string().max(20).optional(), clientEmail: z.string().trim().email().max(254).optional(), clientAddress: required.optional() }),
  z.object({ kind: z.literal("nota_credito"), invoiceId: id, reason: required, items: z.array(z.object({ id: z.string().min(1).max(150), quantity })).min(1).max(100) }),
  z.object({ kind: z.literal("nota_debito"), invoiceId: id, ivaRate: rate, paymentCode: z.enum(["01", "16", "19", "20"]), reasons: z.array(z.object({ reason: required, amount })).min(1).max(30) }),
  z.object({
    kind: z.literal("guia_remision"), invoiceId: id.optional(), startDate: date, endDate: date,
    carrierName: required, carrierRuc: z.string().trim().regex(/^\d{10}(\d{3})?$/),
    licensePlate: z.string().trim().regex(/^[A-Z0-9-]{5,20}$/i),
    originAddress: required, destAddress: required, destClientName: required,
    destClientRuc: z.string().trim().regex(/^\d{10}(\d{3})?$/),
    route: required, reason: required,
    items: z.array(z.object({ name: required, quantity, unit: required, sku: z.string().max(25).optional() })).min(1).max(100),
  }),
  z.object({
    kind: z.literal("retencion"), purchaseInvoiceId: id, supportCode: z.string().regex(/^\d{2}$/),
    relatedParty: z.boolean(), paymentCode: z.enum(["01", "16", "19", "20"]),
    items: z.array(z.object({
      taxType: z.enum(["RENTA", "IVA"]), code: z.string().regex(/^\d{1,4}[A-Z]?$/),
      percentage: z.number().finite().positive().max(100), taxBase: amount,
    })).min(1).max(30),
  }),
  z.object({ kind: z.literal("consultar"), documentKind: kind, id, retry: z.boolean().optional() }),
]);
export type SriRequest = z.infer<typeof sriRequest>;
export type SriNewDocument = Exclude<SriRequest, { kind: "consultar" }>;
export type FiscalKind = SriNewDocument["kind"];
export type SriSubmission = SriRequest & { correctionId?: string };

export const sriKinds = {
  factura: { collection: "billingInvoices", code: "01", sequence: "secuencialFactura", submodule: "facturas" },
  nota_credito: { collection: "billingCreditNotes", code: "04", sequence: "secuencialNotaCredito", submodule: "notas_credito" },
  nota_debito: { collection: "billingDebitNotes", code: "05", sequence: "secuencialNotaDebito", submodule: "notas_debito" },
  guia_remision: { collection: "billingRemissionGuides", code: "06", sequence: "secuencialGuiaRemision", submodule: "guias_remision" },
  retencion: { collection: "billingWithholdings", code: "07", sequence: "secuencialRetencion", submodule: "retenciones" },
} as const;

function baseXml(kind: FiscalKind, row: RecordData, config: SriCompanyConfig) {
  switch (kind) {
    case "factura": return generarFacturaXml(row as SriInvoice, config);
    case "nota_credito": return generarNotaCreditoXml(row as CreditNote, config);
    case "nota_debito": return generarNotaDebitoXml(row as DebitNote, config);
    case "guia_remision": return generarGuiaRemisionXml(row as RemissionGuide, config);
    case "retencion": return generarComprobanteRetencionXml(row as WithholdingReceipt, config);
  }
}

export function fiscalXml(kind: FiscalKind, row: RecordData, config: SriCompanyConfig) {
  const xml = baseXml(kind, row, config);
  const ruc = config.rucProveedorFacturacion?.trim();
  if (!ruc) return xml;
  if (!/^\d{13}$/.test(ruc) || ruc === "9999999999999") throw new HttpError(400, "Revisa el RUC del proveedor de facturación electrónica.");
  const field = `<campoAdicional nombre="RUC Proveedor">${ruc}</campoAdicional>`;
  return xml.includes("</infoAdicional>")
    ? xml.replace("</infoAdicional>", `${field}</infoAdicional>`)
    : xml.replace(/(<\/[A-Za-z]+>)\s*$/, `<infoAdicional>${field}</infoAdicional>$1`);
}

const rejected = (row: RecordData) => row.estadoSRI === "DEVUELTA" || row.estadoSRI === "NO AUTORIZADO";
const vatRetentionCodes: Record<number, string> = { 10: "9", 20: "10", 30: "1", 50: "11", 70: "2", 100: "3" };
const clean = (value: unknown) => String(value ?? "").trim();
const recipient = (row: RecordData) => ({
  clientId: row.clientId, clientName: row.clientName, clientRuc: row.clientRuc,
  clientEmail: row.clientEmail, clientAddress: row.clientAddress,
  tipoIdentificacion: row.tipoIdentificacion,
});

export async function fiscalContent(db: Firestore, tx: Transaction, request: SriNewDocument, config: SriCompanyConfig, correctionId?: string) {
  async function read(collection: string, key: string) {
    const snap = await tx.get(db.collection(collection).doc(key));
    if (!snap.exists) throw new HttpError(404, "No se encontró el comprobante o cliente de origen.");
    return { ...snap.data(), id: snap.id } as RecordData;
  }
  async function authorizedInvoice(key: string) {
    const original = await read("billingInvoices", key);
    const access = validarClaveAccesoSRI(original.claveAcceso || "");
    if (original.documentType === "nota_venta" || original.status !== "autorizada"
      || original.estadoSRI !== "AUTORIZADO" || !original.xmlAutorizado
      || !access.isValid || access.detalles?.tipoComprobante !== "01"
      || access.detalles.ruc !== config.ruc || access.detalles.ambiente !== config.ambiente) {
      throw new HttpError(409, "Selecciona una factura con autorización verificada del mismo emisor y ambiente.");
    }
    return original;
  }

  switch (request.kind) {
    case "factura": {
      const sale = await read("billingInvoices", request.saleId);
      if (sale.documentType !== "nota_venta" || !["registrado", "autorizada", "emitida"].includes(sale.status)) {
        throw new HttpError(409, "Selecciona una nota de venta registrada y vigente.");
      }
      const isFinal = sale.clientId === "cf-9999999999999";
      const client = isFinal ? null : await read("clients", sale.clientId);
      if (client?.status === "retirado") throw new HttpError(409, "El cliente está retirado.");
      const clientRuc = clean(client?.identificationNumber || sale.clientRuc);
      if (request.clientId && request.clientId !== sale.clientId || request.clientRuc && request.clientRuc !== clientRuc) {
        throw new HttpError(409, "La factura debe corresponder al cliente de la nota de venta.");
      }
      const tipoIdentificacion = obtenerTipoIdentificacionSRI(clientRuc, client?.identificationType);
      if (!validarIdentificacionEcuador(clientRuc, tipoIdentificacion, tipoIdentificacion === "04" || client?.isValidated === true)) {
        throw new HttpError(400, "Revisa la identificación del cliente en su ficha.");
      }
      if (!validarConsumidorFinalMonto(clientRuc, sale.total).valid) throw new HttpError(400, "La nota supera el límite de consumidor final.");
      const calculated = calculateLines(sale.items);
      calculated.items.forEach(item => {
        rate.parse(item.ivaRate);
        quantity.parse(item.quantity);
      });
      if (cents(calculated.total) !== cents(sale.total)) throw new HttpError(409, "El total de la nota de venta requiere conciliación.");
      const fiscal = {
        ...calculated, clientId: sale.clientId, clientName: client?.businessName || sale.clientName,
        clientRuc, tipoIdentificacion, clientEmail: request.clientEmail || clean(client?.email || sale.clientEmail),
        clientAddress: request.clientAddress || clean(client?.address || sale.clientAddress),
        clientPhone: client?.phone || sale.clientPhone, paymentMethod: sale.paymentMethod,
        paymentsBreakdown: sale.paymentsBreakdown, paymentTermDays: sale.paymentTermDays,
        subtotalNoObjeto: 0, subtotalExento: 0, warehouseId: sale.warehouseId, warehouseName: sale.warehouseName,
        relatedSaleId: sale.id, kardexRegistered: false, notes: sale.notes,
      };
      const payments = normalizarPagosFactura(fiscal as SriInvoice, fiscal.total);
      if (payments.reduce((sum, payment) => sum + cents(payment.monto), 0) !== cents(fiscal.total)) {
        throw new HttpError(409, "Los medios de pago de la nota requieren conciliación.");
      }
      return { data: fiscal, sale };
    }
    case "nota_credito": {
      const original = await authorizedInvoice(request.invoiceId);
      const notes = await tx.get(db.collection("billingCreditNotes").where("invoiceId", "==", original.id));
      const existing = notes.docs.filter(doc => doc.id !== correctionId).map(doc => doc.data())
        .filter(row => row.status !== "anulada" && !rejected(row));
      const ids = new Set<string>();
      const items = request.items.map(line => {
        const source = (original.items as RecordData[]).find(item => item.id === line.id);
        if (!source || ids.has(line.id)) throw new HttpError(400, "La partida no corresponde a la factura o está duplicada.");
        ids.add(line.id);
        const credited = existing.flatMap(row => row.items || []).filter(item => item.id === line.id)
          .reduce((sum, item) => sum + Number(item.quantity), 0);
        if (Math.round((credited + line.quantity - Number(source.quantity)) * 1e6) > 0) {
          throw new HttpError(409, "La cantidad supera lo disponible para acreditar en la factura.");
        }
        rate.parse(source.ivaRate);
        return { ...source, quantity: line.quantity, discount: money(cents(Number(source.discount || 0) * line.quantity / Number(source.quantity))) };
      });
      const totals = calculateLines(items);
      if (cents(totals.total) + existing.reduce((sum, row) => sum + cents(row.total), 0) > cents(original.total) || totals.total <= 0) {
        throw new HttpError(409, "El importe no puede superar el saldo disponible de la factura.");
      }
      return { data: { ...recipient(original), ...totals, invoiceId: original.id, invoiceNumber: original.documentNumber,
        invoiceDate: original.date, reason: request.reason, warehouseId: original.warehouseId, warehouseName: original.warehouseName,
        kardexReentered: false } };
    }
    case "nota_debito": {
      const original = await authorizedInvoice(request.invoiceId);
      const reasons = request.reasons.map(row => ({ ...row, amount: money(cents(row.amount)) }));
      if (reasons.some(row => row.amount <= 0)) throw new HttpError(400, "Cada motivo debe tener un importe de al menos un centavo.");
      const subtotal = reasons.reduce((sum, row) => sum + cents(row.amount), 0);
      const iva = Math.round(subtotal * request.ivaRate / 100);
      return { data: { ...recipient(original), reasons, invoiceId: original.id, modifiedInvoiceNumber: original.documentNumber,
        modifiedInvoiceDate: original.date, ivaRate: request.ivaRate, paymentCode: request.paymentCode,
        subtotal: money(subtotal), ivaAmount: money(iva), total: money(subtotal + iva) } };
    }
    case "guia_remision": {
      if (request.endDate < request.startDate || (!correctionId && request.startDate < getEcuadorDate())) throw new HttpError(400, "Revisa las fechas de inicio y fin del traslado.");
      if (![request.carrierRuc, request.destClientRuc].every(value => value !== "9999999999999" && validarIdentificacionEcuador(value, "", value.length === 13))) {
        throw new HttpError(400, "Revisa la identificación del transportista y del destinatario.");
      }
      const { kind, ...data } = request;
      const invoice = request.invoiceId ? await authorizedInvoice(request.invoiceId) : null;
      if (invoice && invoice.clientRuc !== request.destClientRuc) throw new HttpError(409, "El destinatario debe coincidir con la factura de sustento.");
      return { data: { ...data, licensePlate: data.licensePlate.toUpperCase().replaceAll("-", ""), ...(invoice ? {
        invoiceNumber: invoice.documentNumber, invoiceDate: invoice.date, invoiceAuthorization: invoice.numeroAutorizacion,
      } : {}) } };
    }
    case "retencion": {
      const purchase = await read("purchaseInvoices", request.purchaseInvoiceId);
      const access = validarClaveAccesoSRI(purchase.claveAcceso || "");
      if (!validarIdentificacionEcuador(purchase.supplierRuc, "04", true) || !validDate(purchase.date)
        || !/^\d{3}-\d{3}-\d{9}$/.test(purchase.documentNumber)
        || !access.isValid || access.detalles?.tipoComprobante !== "01" || access.detalles.ruc !== purchase.supplierRuc
        || access.detalles.ambiente !== config.ambiente
        || (access.detalles.serie + "-" + access.detalles.secuencial) !== purchase.documentNumber) {
        throw new HttpError(409, "Selecciona una factura electrónica de compra con clave y datos de sustento consistentes.");
      }
      const previous = await tx.get(db.collection("billingWithholdings").where("purchaseInvoiceId", "==", purchase.id));
      if (previous.docs.some(doc => doc.id !== correctionId && (doc.data().ambiente || doc.data().claveAcceso?.[23]) === config.ambiente)) {
        throw new HttpError(409, "La compra ya tiene una retención. Consulta su estado o corrige el comprobante existente.");
      }
      const taxes = new Map<number, { rate: number; base: number; value: number }>();
      for (const item of purchase.items as RecordData[]) {
        const iva = rate.parse(item.ivaRate);
        const tax = taxes.get(iva) || { rate: iva, base: 0, value: 0 };
        tax.base += cents(item.subtotal);
        tax.value += cents(item.ivaAmount);
        taxes.set(iva, tax);
      }
      const rows = request.items.map(item => ({ ...item, taxBase: money(cents(item.taxBase)), retainedAmount: money(Math.round(cents(item.taxBase) * item.percentage / 100)) }));
      if (rows.some(row => row.taxType === "IVA" && vatRetentionCodes[row.percentage] !== row.code)) {
        throw new HttpError(400, "El código de retención de IVA no corresponde al porcentaje seleccionado.");
      }
      const total = rows.reduce((sum, row) => sum + cents(row.retainedAmount), 0);
      if (!taxes.size || total <= 0 || total > cents(purchase.total)
        || rows.some(row => row.retainedAmount <= 0)
        || rows.filter(row => row.taxType === "RENTA").reduce((sum, row) => sum + cents(row.taxBase), 0) > cents(purchase.subtotal)
        || rows.filter(row => row.taxType === "IVA").reduce((sum, row) => sum + cents(row.taxBase), 0) > cents(purchase.ivaAmount)) {
        throw new HttpError(400, "Las bases y el valor retenido deben corresponder a los importes de la compra.");
      }
      const today = getEcuadorDate();
      if (today < purchase.date) throw new HttpError(400, "La fecha de la retención es anterior a la compra.");
      return { data: {
        purchaseInvoiceId: purchase.id, invoiceNumber: purchase.documentNumber, clientId: purchase.supplierId,
        clientName: purchase.supplierName, clientRuc: purchase.supplierRuc,
        fiscalPeriod: today.slice(5, 7) + "/" + today.slice(0, 4), items: rows, totalRetained: money(total),
        support: { date: purchase.date, authorization: purchase.claveAcceso, code: request.supportCode,
          relatedParty: request.relatedParty, paymentCode: request.paymentCode, subtotal: purchase.subtotal, total: purchase.total,
          taxes: [...taxes.values()].map(row => ({ ...row, base: money(row.base), value: money(row.value) })) },
      } };
    }
  }
}
