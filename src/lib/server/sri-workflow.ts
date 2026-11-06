import { randomInt, randomUUID } from "node:crypto";
import type { Firestore, DocumentReference } from "firebase-admin/firestore";
import type { SriCompanyConfig, SriEnvironment, UserProfile } from "@/types";
import { getEcuadorDate } from "../date-utils.ts";
import { escaparXml, formatearSecuencialSRI, generarClaveAccesoSRI, validarClaveAccesoSRI } from "../sri-service.ts";
import type { RecordData } from "../commercial-core.ts";
import { digest, recordOperation, type Effect } from "./operation-log.ts";
import { autorizacionComprobante, enviarComprobante, sriSignatureValue, type SriAutorizacionResult } from "./sri-client.ts";
import { fiscalContent, fiscalXml, sriKinds, type FiscalKind, type SriNewDocument } from "./sri-documents.ts";
import { materialFromStored, signSriXml } from "./sri-signer.ts";
import { readEmitterSecret, SRI_CONFIG_PATH } from "./sri-secrets.ts";
import { HttpError } from "./security.ts";

const cleanRow = (row: RecordData): RecordData => JSON.parse(JSON.stringify(row));
const leaseMs = 75_000;
const xmlLimit = 175_000;

async function signingMaterial(db: Firestore) {
  const secret = await readEmitterSecret(db);
  if (!secret) throw new HttpError(400, "Carga una firma electrónica vigente en Configuración SRI.");
  try {
    const material = materialFromStored(secret.pkcs12Base64, secret.password);
    if (material.expired) throw new Error("La firma electrónica está vencida.");
    return material;
  } catch (error) {
    throw new HttpError(400, error instanceof Error ? error.message : "Firma electrónica inválida.");
  }
}

function signDocument(kind: FiscalKind, document: RecordData, config: SriCompanyConfig, material: Awaited<ReturnType<typeof signingMaterial>>) {
  const signed = signSriXml(fiscalXml(kind, document, config), material);
  if (Buffer.byteLength(signed.xml) > xmlLimit) throw new HttpError(413, "El comprobante excede el tamaño admitido.");
  const fiscalIssuer = {
    ruc: config.ruc, razonSocial: config.razonSocial, nombreComercial: config.nombreComercial,
    direccionMatriz: config.direccionMatriz, direccionEstablecimiento: config.direccionEstablecimiento,
    obligadoContabilidad: config.obligadoContabilidad, resolucionAgenteRetencion: config.resolucionAgenteRetencion,
    contribuyenteEspecial: config.contribuyenteEspecial, rucProveedorFacturacion: config.rucProveedorFacturacion,
  };
  return cleanRow({ xmlFirmado: signed.xml, fiscalIssuer,
    certificadoFirma: { huellaSha1: material.fingerprintSha1, firmadoEn: signed.signingTime } });
}

function keyOf(row: RecordData, kind: FiscalKind, config: SriCompanyConfig) {
  const key = validarClaveAccesoSRI(String(row.claveAcceso || ""));
  const details = key.detalles;
  if (!key.isValid || !details || details.tipoComprobante !== sriKinds[kind].code || details.ruc !== config.ruc
    || (details.serie + "-" + details.secuencial) !== row.documentNumber
    || !["1", "2"].includes(details.ambiente)) {
    throw new HttpError(409, "El comprobante guardado no corresponde a este emisor, tipo o numeración.");
  }
  return details;
}

export async function reserveFiscalDocument(db: Firestore, user: UserProfile, config: SriCompanyConfig, request: SriNewDocument, operationId?: string) {
  const kind = request.kind;
  const spec = sriKinds[kind];
  const docId = kind === "factura" ? `sri-factura-${config.ambiente}-${request.saleId}`
    : `sri-${kind}-${digest({ ambiente: config.ambiente, ruc: config.ruc, operation: operationId || request })}`;
  const collection = db.collection(spec.collection);
  const requestDigest = digest(request);
  const checkOperation = (existing: RecordData) => {
    if (kind !== "factura" && operationId && existing.fiscalRequestDigest !== requestDigest) {
      throw new HttpError(409, "El intento guardado corresponde a otros datos del comprobante.");
    }
  };
  const existing = await collection.doc(docId).get();
  if (existing.exists) {
    checkOperation(existing.data()!);
    return collection.doc(docId);
  }
  if (!/^\d{13}$/.test(config.ruc) || !config.razonSocial.trim() || !config.direccionMatriz.trim()
    || !/^\d{3}$/.test(config.establecimiento) || !/^\d{3}$/.test(config.puntoEmision)
    || !["1", "2"].includes(config.ambiente)) {
    throw new HttpError(400, "Completa los datos del emisor, dirección, serie y ambiente en Configuración SRI.");
  }
  const material = await signingMaterial(db);
  const date = getEcuadorDate();
  const numericCode = String(randomInt(10_000_000, 100_000_000));
  const fiscalRef = collection.doc(docId);
  return db.runTransaction(async tx => {
    const prior = (await tx.get(fiscalRef)).data();
    if (prior) {
      checkOperation(prior);
      return fiscalRef;
    }
    const currentConfig = (await tx.get(db.doc(SRI_CONFIG_PATH))).data();
    if (!currentConfig || currentConfig.ruc !== config.ruc || currentConfig.ambiente !== config.ambiente
      || currentConfig.establecimiento !== config.establecimiento || currentConfig.puntoEmision !== config.puntoEmision
      || currentConfig.certificadoFechaCarga !== config.certificadoFechaCarga) {
      throw new HttpError(409, "La configuración SRI cambió. Revisa los datos del emisor y vuelve a intentar.");
    }
    // The commercial document is also the lock against concurrent editing or cancellation.
    const saleRef = kind === "factura" ? collection.doc(request.saleId) : null;
    let legacyLink: RecordData | undefined;
    if (saleRef) {
      const source = (await tx.get(saleRef)).data();
      const linkedId = source?.sriInvoicesByEnvironment?.[config.ambiente] || source?.sriInvoiceId;
      if (linkedId) {
        const linkedRef = collection.doc(linkedId);
        legacyLink = (await tx.get(linkedRef)).data();
        if (!legacyLink || legacyLink.relatedSaleId !== saleRef.id) throw new HttpError(409, "El vínculo fiscal de la nota requiere conciliación.");
        const key = keyOf(legacyLink, kind, config);
        if (key.ambiente === config.ambiente) return linkedRef;
      }
    }
    const { data, sale } = await fiscalContent(db, tx, request, config);
    const establishment = config.establecimiento;
    const point = sale?.saleChannel === "servicio" && config.puntoEmisionServicios ? config.puntoEmisionServicios : config.puntoEmision;
    if (!/^\d{3}$/.test(point)) throw new HttpError(400, "Configura un punto de emisión válido para servicios.");
    const series = `${establishment}-${point}`;
    const counterRef = db.collection("sequences").doc(`sri_${config.ruc}_${config.ambiente}_${spec.code}_${series}`);
    const counter = (await tx.get(counterRef)).data();
    let last = Math.max(Number(counter?.value || 0), Number(config[spec.sequence] || 1) - 1);
    if (!counter) {
      const sameSeries = await tx.get(collection.where("documentNumber", ">=", series + "-000000001").where("documentNumber", "<=", series + "-999999999"));
      for (const snap of sameSeries.docs) {
        const old = snap.data();
        if (old.documentType === "nota_venta" || old.status === "borrador") continue;
        const key = validarClaveAccesoSRI(old.claveAcceso || "").detalles;
        if (key && (key.ruc !== config.ruc || key.ambiente !== config.ambiente)) continue;
        last = Math.max(last, Number(old.documentNumber.slice(-9)) || 0);
      }
    }
    const next = last + 1;
    if (!Number.isSafeInteger(next) || next < 1 || next > 999_999_999) throw new HttpError(409, "Secuencia fiscal inválida o agotada.");
    const documentNumber = formatearSecuencialSRI(next, establishment, point);
    const claveAcceso = generarClaveAccesoSRI({ fechaEmision: date, tipoComprobante: spec.code,
      ruc: config.ruc, ambiente: config.ambiente, establecimiento: establishment, puntoEmision: point,
      secuencial: next, codigoNumerico: numericCode });
    const now = new Date().toISOString();
    const document = cleanRow({ ...data, id: docId, documentType: kind, version: 1, date, createdAt: now, updatedAt: now,
      status: "emitida", estadoSRI: "EN PROCESO", ambiente: config.ambiente, documentNumber, claveAcceso });
    const reserved = { ...document, ...signDocument(kind, document, config, material),
      fiscalWorkflowVersion: 1, fiscalAttempts: 0, fiscalInput: request, fiscalRequestDigest: requestDigest };
    const counterRow = { id: counterRef.id, value: next, lastDate: date, version: Number(counter?.version || 0) + 1 };
    const effects: Effect[] = [
      { collection: spec.collection, id: docId, beforeVersion: null, after: reserved },
      { collection: "sequences", id: counterRef.id, beforeVersion: counter?.version ?? null, after: counterRow },
    ];
    tx.set(counterRef, counterRow);
    tx.create(fiscalRef, reserved);
    if (saleRef && sale) {
      const previous = legacyLink ? { [String(legacyLink.ambiente || legacyLink.claveAcceso[23])]: legacyLink.id } : {};
      const linked = { ...sale, sriStatus: "pendiente", sriInvoiceId: docId, sriDocumentNumber: documentNumber,
        sriInvoicesByEnvironment: { ...previous, ...sale.sriInvoicesByEnvironment, [config.ambiente]: docId },
        version: Number(sale.version || 0) + 1, updatedAt: now };
      tx.set(saleRef, linked);
      effects.push({ collection: "billingInvoices", id: saleRef.id, beforeVersion: sale.version ?? null, after: linked });
    }
    recordOperation(tx, db, user, "SRI_RESERVA", effects, randomUUID(), { kind, claveAcceso });
    return fiscalRef;
  });
}

export async function correctRejectedDocument(db: Firestore, user: UserProfile, config: SriCompanyConfig, kind: FiscalKind,
  ref: DocumentReference, correction?: SriNewDocument,
) {
  const result = await processFiscalDocument(db, user, config, kind, ref, "consultar");
  if (result.document.estadoSRI === "AUTORIZADO") return result;
  if (!result.document.sriCorrectionReady) throw new HttpError(409, "Confirma el rechazo en el SRI antes de corregir el comprobante.");
  const material = await signingMaterial(db);
  await db.runTransaction(async tx => {
    const row = (await tx.get(ref)).data();
    if (!row || row.fiscalWorkflowVersion !== 1 || row.version !== result.document.version || !row.sriCorrectionReady
      || Number(row.fiscalLeaseUntil || 0) > Date.now()) throw new HttpError(409, "El estado del comprobante cambió. Consulta de nuevo.");
    const key = keyOf(row, kind, config);
    if (key.ambiente !== config.ambiente) throw new HttpError(409, "Selecciona el ambiente original antes de volver a firmar.");
    const request = correction || row.fiscalInput as SriNewDocument;
    if (!request || request.kind !== kind) throw new HttpError(409, "El comprobante no tiene datos de emisión recuperables.");
    const original = row.fiscalInput as RecordData;
    const revised = request as RecordData;
    if (["saleId", "invoiceId", "purchaseInvoiceId"].some(field => original[field] !== revised[field])) {
      throw new HttpError(409, "La corrección debe conservar el comprobante de origen.");
    }
    const { data } = await fiscalContent(db, tx, request, config, ref.id);
    const now = new Date().toISOString();
    const document = cleanRow({ ...row, ...data, fiscalInput: request, updatedAt: now, version: Number(row.version || 0) + 1,
      estadoSRI: "EN PROCESO", status: "emitida", sriReceived: false, sriCorrectionReady: false, fiscalNeedsSend: true,
      mensajesSRI: [], xmlAutorizado: null, numeroAutorizacion: null, authorizationDate: null });
    const updated = { ...document, ...signDocument(kind, document, config, material) };
    tx.set(ref, updated);
    recordOperation(tx, db, user, "SRI_CORRECCION", [{ collection: sriKinds[kind].collection, id: ref.id,
      beforeVersion: row.version ?? null, after: updated }], randomUUID(), { kind, claveAcceso: row.claveAcceso });
  });
  return processFiscalDocument(db, user, config, kind, ref, "reintentar");
}

export async function processFiscalDocument(
  db: Firestore, user: UserProfile, config: SriCompanyConfig, kind: FiscalKind,
  ref: DocumentReference, mode: "emitir" | "consultar" | "reintentar",
) {
  const lease = randomUUID();
  const claim = await db.runTransaction(async tx => {
    const row = (await tx.get(ref)).data();
    if (!row || row.documentType === "nota_venta" || row.status === "borrador") throw new HttpError(404, "Comprobante fiscal inexistente.");
    const details = keyOf(row, kind, config);
    if (row.estadoSRI === "AUTORIZADO" && row.xmlAutorizado && row.status === "autorizada") return { row, details, done: true };
    if (Number(row.fiscalLeaseUntil || 0) > Date.now()) throw new HttpError(409, "Este comprobante ya se está procesando. Consulta en un momento.");
    tx.update(ref, { fiscalLease: lease, fiscalLeaseUntil: Date.now() + leaseMs });
    return { row, details, done: false };
  });
  const { row, details } = claim;
  if (claim.done) return { document: row, newlyAuthorized: false };

  const ambiente = details.ambiente as SriEnvironment;
  const sendable = row.fiscalWorkflowVersion === 1 && typeof row.xmlFirmado === "string"
    && !row.sriReceived && !["DEVUELTA", "NO AUTORIZADO"].includes(row.estadoSRI);
  let authorization: SriAutorizacionResult | undefined;
  let emission: Awaited<ReturnType<typeof enviarComprobante>> | undefined;
  const firstSend = mode !== "consultar" && sendable && (!row.fiscalAttempts || row.fiscalNeedsSend);
  if (!firstSend) authorization = await autorizacionComprobante(row.claveAcceso, ambiente);
  if (firstSend || (mode !== "consultar" && sendable && authorization?.sinRegistro)) {
    // Record the attempted transmission before leaving Firestore. If this process dies,
    // the next worker consults the same access key before resubmitting the same bytes.
    await db.runTransaction(async tx => {
      const current = (await tx.get(ref)).data();
      if (!current || current.fiscalLease !== lease) throw new HttpError(409, "El comprobante cambió antes del envío.");
      const now = new Date().toISOString();
      const sending = { ...current, version: Number(current.version || 0) + 1, updatedAt: now,
        fiscalAttempts: Number(current.fiscalAttempts || 0) + 1, fiscalNeedsSend: false, ultimoEnvioSRI: now };
      tx.set(ref, sending);
      recordOperation(tx, db, user, "SRI_ENVIO_INICIADO", [{ collection: sriKinds[kind].collection, id: ref.id,
        beforeVersion: current.version ?? null, after: sending }], randomUUID(), { kind, claveAcceso: row.claveAcceso });
    });
    emission = await enviarComprobante(row.claveAcceso, row.xmlFirmado, ambiente, { onReception: async receipt => {
      const received = receipt.estado === "RECIBIDA" || receipt.mensajes.some(message => ["43", "70"].includes(message.identificador || ""));
      if (received) await ref.update({ sriReceived: true });
    } });
    authorization = emission.autorizacion;
  }
  const authorizedXml = authorization?.estado === "AUTORIZADO" ? authorization.comprobanteXml : undefined;
  const returnedSignature = authorizedXml ? sriSignatureValue(authorizedXml) : "";
  const verified = Boolean(authorizedXml && Buffer.byteLength(authorizedXml) <= xmlLimit && returnedSignature
    && (row.fiscalWorkflowVersion !== 1 || returnedSignature === sriSignatureValue(row.xmlFirmado)));
  const xmlAutorizado = verified && authorization ? `<?xml version="1.0" encoding="UTF-8"?>
<autorizacion><estado>AUTORIZADO</estado><numeroAutorizacion>${escaparXml(authorization.numeroAutorizacion)}</numeroAutorizacion><fechaAutorizacion>${escaparXml(authorization.fechaAutorizacion)}</fechaAutorizacion><ambiente>${escaparXml(authorization.ambiente)}</ambiente><comprobante><![CDATA[${authorizedXml!.replaceAll("]]>", "]]]]><![CDATA[>")}]]></comprobante><mensajes/></autorizacion>` : undefined;
  const reported = emission?.estado || authorization?.estado || "ERROR_CONEXION";
  const state = verified ? "AUTORIZADO" : reported === "AUTORIZADO" ? "ERROR_CONEXION"
    : !emission && ["DEVUELTA", "NO AUTORIZADO"].includes(row.estadoSRI) && ["EN PROCESO", "ERROR_CONEXION"].includes(reported)
      ? row.estadoSRI : reported;
  const messages = reported === "AUTORIZADO" && !verified
    ? [{ mensaje: "El XML devuelto por el SRI requiere conciliación con el comprobante firmado.", tipo: "ERROR" }]
    : state === row.estadoSRI && !emission && authorization?.sinRegistro && row.mensajesSRI?.length
    ? row.mensajesSRI : emission?.mensajes || authorization?.mensajes || [];
  const document = await db.runTransaction(async tx => {
    const current = (await tx.get(ref)).data();
    if (!current || current.fiscalLease !== lease) throw new HttpError(409, "El comprobante cambió durante la consulta. Actualiza el listado.");
    const linkedRef = kind === "factura" && current.relatedSaleId ? db.collection("billingInvoices").doc(current.relatedSaleId) : null;
    const linked = linkedRef ? (await tx.get(linkedRef)).data() : null;
    const now = new Date().toISOString();
    const updated = cleanRow({ ...current, id: ref.id, version: Number(current.version || 0) + 1, updatedAt: now,
      documentType: kind, status: verified ? "autorizada" : current.status === "anulada" ? "anulada" : "emitida",
      ambiente, estadoSRI: state, mensajesSRI: messages.slice(0, 30).map((m: RecordData) => ({
        identificador: String(m.identificador || "").slice(0, 50), mensaje: String(m.mensaje || "").slice(0, 1000),
        informacionAdicional: String(m.informacionAdicional || "").slice(0, 1000), tipo: String(m.tipo || "").slice(0, 50),
      })), fiscalLease: null, fiscalLeaseUntil: 0,
      sriReceived: Boolean(current.sriReceived || emission?.recepcion.estado === "RECIBIDA"
        || emission?.recepcion.mensajes.some(m => ["43", "70"].includes(m.identificador || ""))),
      sriCorrectionReady: current.fiscalWorkflowVersion === 1 && (authorization?.estado === "NO AUTORIZADO"
        || (state === "DEVUELTA" && authorization?.sinRegistro === true)),
      xmlAutorizado: xmlAutorizado || null, numeroAutorizacion: verified ? authorization?.numeroAutorizacion : null,
      authorizationDate: verified ? authorization?.fechaAutorizacion : null,
    });
    const effects: Effect[] = [{ collection: sriKinds[kind].collection as string, id: ref.id, beforeVersion: current.version ?? null, after: updated }];
    tx.set(ref, updated);
    if (linkedRef && linked?.sriInvoiceId === ref.id && linked.sriStatus !== (verified ? "facturada" : "pendiente")) {
      const sale = { ...linked, sriStatus: verified ? "facturada" : "pendiente", version: Number(linked.version || 0) + 1, updatedAt: now };
      tx.set(linkedRef, sale);
      effects.push({ collection: "billingInvoices", id: linkedRef.id, beforeVersion: linked.version ?? null, after: sale });
    }
    recordOperation(tx, db, user, "SRI_RESPUESTA", effects, randomUUID(), { kind, claveAcceso: row.claveAcceso, state });
    return updated;
  });
  return { document, newlyAuthorized: verified };
}
