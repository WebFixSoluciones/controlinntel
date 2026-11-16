import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import forge from "node-forge";
import { SignedXml } from "xml-crypto";
import { DOMParser } from "@xmldom/xmldom";
import type { Firestore } from "firebase-admin/firestore";
import type { UserProfile } from "@/types";
import { getEcuadorDate } from "../date-utils.ts";
import { DEFAULT_INNTEL_SRI_CONFIG, generarClaveAccesoSRI } from "../sri-service.ts";
import { autorizacionComprobante } from "./sri-client.ts";
import { sriRequest, type FiscalKind, type SriNewDocument } from "./sri-documents.ts";
import { correctRejectedDocument, processFiscalDocument, reserveFiscalDocument, deleteTestInvoice } from "./sri-workflow.ts";
import { parsePkcs12, issuerRfc2253, verifySriSignedXml } from "./sri-signer.ts";
import { deliverFiscalInvoice, deliverFiscalDocument } from "./sri-email.ts";
import { invoiceRidePdf } from "./sri-ride-pdf.ts";
import { buildInvoiceHtml, sendInvoiceEmail, fiscalEmailRecipients } from "./email-delivery.ts";
import { initializeVaultKey, seal } from "./vault.ts";

type Row = Record<string, any>;
type Ref = { path: string; id: string; get: () => Promise<any>; update: (patch: Row) => Promise<void> };
type Filter = [string, string, unknown];

class FiscalDatabase {
  rows = new Map<string, Row>();
  tail = Promise.resolve();
  failNextCommit = false;
  asFirestore() { return this as unknown as Firestore; }
  read(path: string) { return structuredClone(this.rows.get(path)); }
  snap(path: string) {
    return { id: path.split("/").at(-1), exists: this.rows.has(path), data: () => this.read(path) };
  }
  doc(path: string): Ref {
    return { path, id: path.split("/").at(-1)!, get: async () => this.snap(path),
      update: async patch => { this.rows.set(path, { ...this.read(path), ...structuredClone(patch) }); } };
  }
  collection(name: string, filters: Filter[] = []) {
    return { doc: (id: string) => this.doc(name + "/" + id), name, filters,
      where: (key: string, op: string, value: unknown) => this.collection(name, [...filters, [key, op, value]]) };
  }
  async runTransaction<T>(work: (tx: any) => Promise<T>) {
    const previous = this.tail;
    let release!: () => void;
    this.tail = new Promise(resolve => { release = resolve; });
    await previous;
    const changes = new Map<string, Row>();
    const deleted = new Set<string>();
    const set = (ref: Ref, value: Row) => changes.set(ref.path, structuredClone(value));
    const tx = {
      get: async (ref: Ref | ReturnType<FiscalDatabase["collection"]>) => "path" in ref ? this.snap(ref.path) : ({
        docs: [...this.rows.entries()].filter(([path, row]) => path.startsWith(ref.name + "/") && ref.filters.every(([field, op, value]) => {
          if (op === ">=") return row[field] >= String(value);
          if (op === "<=") return row[field] <= String(value);
          return row[field] === value;
        })).map(([path]) => this.snap(path)),
      }),
      set,
      delete: (ref: Ref) => deleted.add(ref.path),
      create: (ref: Ref, row: Row) => { assert.ok(!this.rows.has(ref.path)); set(ref, row); },
      update: (ref: Ref, patch: Row) => set(ref, { ...this.read(ref.path), ...patch }),
    };
    try {
      const result = await work(tx);
      if (this.failNextCommit) { this.failNextCommit = false; throw new Error("Fallo de escritura inyectado"); }
      changes.forEach((row, path) => this.rows.set(path, row));
      deleted.forEach(path => this.rows.delete(path));
      return result;
    } finally {
      release();
    }
  }
}

const user: UserProfile = { uid: "qa", email: "qa@example.test", role: "superadmin", status: "activo", permissions: ["all"], displayName: "QA" };
const config = { ...DEFAULT_INNTEL_SRI_CONFIG, ruc: "1790016919001", razonSocial: "Emisor QA", direccionMatriz: "Quito QA",
  direccionEstablecimiento: "Sucursal QA", rucProveedorFacturacion: "1790012345001", certificadoFechaCarga: "qa" };
const password = "fixture-qa";
const fixture = (() => {
  const keys = forge.pki.rsa.generateKeyPair(1024);
  const certificate = forge.pki.createCertificate();
  certificate.publicKey = keys.publicKey;
  certificate.serialNumber = "01";
  certificate.validity.notBefore = new Date(Date.now() - 60_000);
  certificate.validity.notAfter = new Date(Date.now() + 86_400_000);
  certificate.setSubject([{ name: "commonName", value: "Emisor de prueba automatizada" }]);
  certificate.setIssuer(certificate.subject.attributes);
  certificate.sign(keys.privateKey, forge.md.sha256.create());
  const encode = () => forge.util.encode64(forge.asn1.toDer(forge.pkcs12.toPkcs12Asn1(keys.privateKey, [certificate], password)).getBytes());
  return { pkcs12Base64: encode(), future: () => {
    certificate.validity.notBefore = new Date(Date.now() + 60_000);
    certificate.sign(keys.privateKey, forge.md.sha256.create());
    return encode();
  } };
})();

async function setup() {
  process.env.VAULT_KEY_BASE64 = Buffer.alloc(32, 12).toString("base64");
  await initializeVaultKey();
  const storage = new FiscalDatabase();
  storage.rows.set("sriCompanyConfig/sri-config-inntel", config);
  storage.rows.set("sriSecrets/emisor", { sealed: seal(JSON.stringify({ pkcs12Base64: fixture.pkcs12Base64, password }), "sriSecrets/emisor") });
  storage.rows.set("clients/client-qa", { businessName: "Cliente QA", status: "activo", identificationNumber: "1710034065", identificationType: "CEDULA" });
  storage.rows.set("billingInvoices/sale-qa", { id: "sale-qa", documentType: "nota_venta", status: "registrado", clientId: "client-qa",
    documentNumber: "010-001-000000093", date: getEcuadorDate(), clientName: "Cliente QA", clientEmail: "cliente@example.test",
    items: [{ id: "part", sku: "EQUIPO-QA", name: "Equipo", quantity: 2, unitPrice: 100, discount: 10, ivaRate: 5 }],
    total: 199.5, paymentMethod: "transferencia", warehouseName: "Principal" });
  const db = storage.asFirestore();
  const reserve = (request: SriNewDocument) => reserveFiscalDocument(db, user, config, request);
  return { storage, db, reserve };
}

const envelope = (data: string) => new Response(`<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>${data}</soap:Body></soap:Envelope>`);
const reception = (status: string) => envelope(`<RespuestaRecepcionComprobante><estado>${status}</estado></RespuestaRecepcionComprobante>`);
const resultXml = (key: string, body = "", count = 0) => envelope(`<RespuestaAutorizacionComprobante><claveAccesoConsultada>${key}</claveAccesoConsultada><numeroComprobantes>${count}</numeroComprobantes><autorizaciones>${body}</autorizaciones></RespuestaAutorizacionComprobante>`);
const authorized = (key: string, signed: string, environment = "PRUEBAS") => `<autorizacion><estado>AUTORIZADO</estado><numeroAutorizacion>${key}</numeroAutorizacion><fechaAutorizacion>2026-11-05T12:00:00-05:00</fechaAutorizacion><ambiente>${environment}</ambiente><comprobante><![CDATA[${signed}]]></comprobante></autorizacion>`;
const rejected = '<autorizacion><estado>RECHAZADO</estado><mensajes><mensaje><identificador>46</identificador><mensaje>Inconsistencia QA</mensaje></mensaje></mensajes></autorizacion>';

test("PKCS#12 verifies password and validity before signing", () => {
  assert.equal(parsePkcs12(fixture.pkcs12Base64, password).expired, false);
  assert.throws(() => parsePkcs12(fixture.pkcs12Base64, "incorrecta"), /contraseña/i);
  assert.throws(() => parsePkcs12(fixture.future(), password), /todavía no está vigente/);
});

test("reserves exactly one signed invoice, ignores caller amounts and rejects unrelated or inactive sources", async () => {
  const { storage, reserve } = await setup();
  await assert.rejects(reserve({ kind: "factura", saleId: "missing" }), /origen/);
  await assert.rejects(reserve({ kind: "factura", saleId: "sale-qa", clientId: "otro" }), /cliente de la nota/);
  const source = storage.read("billingInvoices/sale-qa")!;
  storage.rows.set("billingInvoices/sale-qa", { ...source, status: "anulada" });
  await assert.rejects(reserve({ kind: "factura", saleId: "sale-qa" }), /vigente/);
  storage.rows.set("billingInvoices/sale-qa", source);
  const request = sriRequest.parse({ kind: "factura", saleId: "sale-qa", total: 1, status: "autorizada" }) as SriNewDocument;
  const refs = await Promise.all([reserve(request), reserve(request)]);
  assert.equal(refs[0].id, refs[1].id);
  const document = storage.read(refs[0].path)!;
  assert.equal(document.total, 199.5);
  assert.equal(document.status, "emitida");
  assert.match(document.xmlFirmado, /<ds:Signature[ >]/);
  assert.equal(storage.read("billingInvoices/sale-qa")!.sriStatus, "pendiente");
  assert.equal([...storage.rows.values()].filter(row => row.type === "SRI_RESERVA").length, 1);
});

test("verifies SOAP key and environment and prefers a matching authorization over a rejection", async t => {
  const key = "1".repeat(49);
  const signed = `<factura><infoTributaria><ambiente>1</ambiente><claveAcceso>${key}</claveAcceso></infoTributaria><Signature xmlns="http://www.w3.org/2000/09/xmldsig#"/></factura>`;
  const fetchMock = t.mock.method(globalThis, "fetch", async () => resultXml(key, rejected + authorized(key, signed), 2));
  assert.equal((await autorizacionComprobante(key, "1")).estado, "AUTORIZADO");
  fetchMock.mock.mockImplementation(async () => resultXml(key, authorized(key, signed, "PRODUCCIÓN"), 1));
  assert.equal((await autorizacionComprobante(key, "1")).estado, "ERROR_CONEXION");
  fetchMock.mock.mockImplementation(async () => resultXml("2".repeat(49), authorized(key, signed), 1));
  assert.equal((await autorizacionComprobante(key, "1")).estado, "ERROR_CONEXION");
  fetchMock.mock.mockImplementation(async () => { throw Error("Sin red"); });
  assert.equal((await autorizacionComprobante(key, "1")).estado, "ERROR_CONEXION");
});

test("a failed commit after SOAP is recovered by consulting the same key with no second transmission", async t => {
  const { storage, db, reserve } = await setup();
  const ref = await reserve({ kind: "factura", saleId: "sale-qa" });
  const row = storage.read(ref.path)!;
  let transmissions = 0;
  let authorizedQueries = 0;
  t.mock.method(globalThis, "fetch", async (url: string) => {
    if (url.includes("Recepcion")) {
      transmissions++;
      assert.equal(storage.read(ref.path)!.fiscalAttempts, 1);
      return reception("RECIBIDA");
    }
    if (++authorizedQueries === 1) storage.failNextCommit = true;
    return resultXml(row.claveAcceso, authorized(row.claveAcceso, row.xmlFirmado), 1);
  });
  await assert.rejects(processFiscalDocument(db, user, config, "factura", ref, "emitir"), /Fallo de escritura/);
  await assert.rejects(processFiscalDocument(db, user, config, "factura", ref, "reintentar"), /se está procesando/);
  storage.rows.get(ref.path)!.fiscalLeaseUntil = 0;
  const result = await processFiscalDocument(db, user, config, "factura", ref, "reintentar");
  assert.equal(result.document.estadoSRI, "AUTORIZADO");
  assert.equal(result.document.claveAcceso, row.claveAcceso);
  assert.match(result.document.xmlAutorizado, /<autorizacion>/);
  assert.equal(storage.read("billingInvoices/sale-qa")!.sriStatus, "facturada");
  assert.equal(transmissions, 1);
});

test("keeps test and production reservations separate for the same commercial sale", async () => {
  const { storage, db, reserve } = await setup();
  const trial = await reserve({ kind: "factura", saleId: "sale-qa" });
  const productionConfig = { ...config, ambiente: "2" as const };
  storage.rows.set("sriCompanyConfig/sri-config-inntel", productionConfig);
  const live = await reserveFiscalDocument(db, user, productionConfig, { kind: "factura", saleId: "sale-qa" });
  assert.notEqual(live.id, trial.id);
  assert.equal(storage.read(live.path)!.documentNumber, storage.read(trial.path)!.documentNumber, "El mismo número se admite en ambientes diferentes");
  assert.notEqual(storage.read(live.path)!.claveAcceso, storage.read(trial.path)!.claveAcceso);
  assert.deepEqual(storage.read("billingInvoices/sale-qa")!.sriInvoicesByEnvironment, { "1": trial.id, "2": live.id });
});

test("a definitively rejected invoice is corrected with the original sequence and access key", async t => {
  const { storage, db, reserve } = await setup();
  const ref = await reserve({ kind: "factura", saleId: "sale-qa" });
  const first = storage.read(ref.path)!;
  let receiptCalls = 0;
  t.mock.method(globalThis, "fetch", async (url: string) => {
    const row = storage.read(ref.path)!;
    if (url.includes("Recepcion")) return reception(++receiptCalls === 1 ? "DEVUELTA" : "RECIBIDA");
    return receiptCalls < 2 ? resultXml(row.claveAcceso) : resultXml(row.claveAcceso, authorized(row.claveAcceso, row.xmlFirmado), 1);
  });
  assert.equal((await processFiscalDocument(db, user, config, "factura", ref, "emitir")).document.estadoSRI, "DEVUELTA");
  const { document } = await correctRejectedDocument(db, user, config, "factura", ref,
    { kind: "factura", saleId: "sale-qa", clientAddress: "Dirección corregida QA" });
  assert.equal(document.estadoSRI, "AUTORIZADO");
  assert.equal(document.claveAcceso, first.claveAcceso);
  assert.equal(document.documentNumber, first.documentNumber);
  assert.match(document.xmlFirmado, /corregida QA/);
  assert.equal(receiptCalls, 2);
});

test("creates the five fiscal document types from source data and caps credit quantities", async t => {
  const { storage, db, reserve } = await setup();
  const ref = await reserve({ kind: "factura", saleId: "sale-qa" });
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    if (url.includes("Recepcion")) return reception("RECIBIDA");
    const key = String(init.body).match(/<claveAccesoComprobante>(\d{49})<\/claveAccesoComprobante>/)?.[1];
    const document = [...storage.rows.values()].find(row => row.fiscalWorkflowVersion === 1 && row.claveAcceso === key);
    assert.ok(key && document);
    return resultXml(key, authorized(key, document.xmlFirmado), 1);
  });
  await processFiscalDocument(db, user, config, "factura", ref, "emitir");
  const nc = await reserve({ kind: "nota_credito", invoiceId: ref.id, reason: "Devolución parcial QA", items: [{ id: "part", quantity: 1 }] });
  await assert.rejects(reserve({ kind: "nota_credito", invoiceId: ref.id, reason: "Excede QA", items: [{ id: "part", quantity: 2 }] }), /supera/);
  const nd = await reserve({ kind: "nota_debito", invoiceId: ref.id, ivaRate: 5, paymentCode: "20", reasons: [{ reason: "Ajuste QA", amount: 10 }] });
  const guide = await reserve({ kind: "guia_remision", invoiceId: ref.id, startDate: getEcuadorDate(), endDate: getEcuadorDate(),
    carrierName: "Transporte QA", carrierRuc: "1790016919001", licensePlate: "ABC1234", originAddress: "Origen QA",
    destAddress: "Destino QA", destClientName: "Cliente QA", destClientRuc: "1710034065", route: "Quito a Tumbaco",
    reason: "Entrega QA", items: [{ name: "Equipo", quantity: 1, unit: "unidad" }] });
  const claveAcceso = generarClaveAccesoSRI({ fechaEmision: getEcuadorDate(), tipoComprobante: "01",
    ruc: "1790012345001", ambiente: "1", establecimiento: "001", puntoEmision: "001", secuencial: 1, codigoNumerico: "87654321" });
  storage.rows.set("purchaseInvoices/purchase-qa", { supplierId: "supplier-qa", supplierName: "Proveedor QA",
    supplierRuc: "1790012345001", date: getEcuadorDate(), claveAcceso, documentNumber: "001-001-000000001",
    items: [{ ivaRate: 15, subtotal: 100, ivaAmount: 15 }], subtotal: 100, ivaAmount: 15, total: 115 });
  const retention = await reserve({ kind: "retencion", purchaseInvoiceId: "purchase-qa", supportCode: "01", relatedParty: false,
    paymentCode: "20", items: [{ taxType: "RENTA", code: "312", percentage: 1.75, taxBase: 100 }, { taxType: "IVA", code: "1", percentage: 30, taxBase: 15 }] });
  assert.equal(storage.read(nc.path)!.total, 99.75);
  assert.match(storage.read(nc.path)!.xmlFirmado, /<codigoPorcentaje>5<\/codigoPorcentaje>/);
  assert.match(storage.read(nd.path)!.xmlFirmado, /<codigoPorcentaje>5<\/codigoPorcentaje>/);
  assert.match(storage.read(guide.path)!.xmlFirmado, /<ruta>Quito a Tumbaco<\/ruta>/);
  assert.match(storage.read(retention.path)!.xmlFirmado, /<comprobanteRetencion id="comprobante" version="2.0.0">/);
  assert.equal(storage.read(retention.path)!.totalRetained, 6.25);
  assert.equal(storage.read(ref.path)!.estadoSRI, "AUTORIZADO");
  const samples: [FiscalKind, typeof ref][] = [["factura", ref], ["nota_credito", nc], ["nota_debito", nd], ["guia_remision", guide], ["retencion", retention]];
  for (const [kind, document] of samples.slice(1)) {
    const result = await processFiscalDocument(db, user, config, kind, document, "emitir");
    assert.equal(result.document.estadoSRI, "AUTORIZADO");
    assert.ok(result.document.xmlAutorizado);
    assert.equal(result.document.commercialReconciliationStatus, undefined, "Las pruebas no alteran la cartera real");
  }
  const exportPath = process.env.SRI_QA_XML_OUTPUT;
  if (exportPath) {
    mkdirSync(exportPath, { recursive: true });
    for (const [kind, document] of samples) writeFileSync(join(exportPath, kind + ".xml"), storage.read(document.path)!.xmlFirmado);
  }
});

test("eliminar una factura de prueba archiva auditoría, libera la nota y conserva secuencias y producción", async () => {
  const { storage, db, reserve } = await setup();
  const ref = await reserve({ kind: "factura", saleId: "sale-qa" });
  const original = storage.read(ref.path)!;
  assert.match(original.xmlFirmado, /Type="http:\/\/uri.etsi.org\/01903#SignedProperties"/);
  const productionConfig = { ...config, ambiente: "2" as const };
  storage.rows.set("sriCompanyConfig/sri-config-inntel", productionConfig);
  const live = await reserveFiscalDocument(db, user, productionConfig, { kind: "factura", saleId: "sale-qa" });
  const liveBefore = storage.read(live.path);
  const signature = new DOMParser().parseFromString(original.xmlFirmado, "text/xml").getElementsByTagNameNS("http://www.w3.org/2000/09/xmldsig#", "Signature")[0];
  const verifier = new SignedXml({ publicCert: parsePkcs12(fixture.pkcs12Base64, password).certificatePem });
  verifier.loadSignature(signature);
  assert.equal(verifier.checkSignature(original.xmlFirmado), true, "Un verificador independiente valida firma y referencias");
  await assert.rejects(deleteTestInvoice(db, user, productionConfig, live.id), { status: 409 });
  storage.rows.get(live.path)!.ambiente = "1";
  await assert.rejects(deleteTestInvoice(db, user, productionConfig, live.id), { status: 409 });
  storage.rows.set(live.path, liveBefore!);
  storage.rows.set("sriCompanyConfig/sri-config-inntel", config);
  await assert.rejects(deleteTestInvoice(db, user, config, live.id), { status: 409 });
  await assert.rejects(deleteTestInvoice(db, { ...user, role: "consulta", permissions: [] }, config, ref.id), { status: 403 });
  storage.rows.get(ref.path)!.fiscalLeaseUntil = Date.now() + 10000;
  await assert.rejects(deleteTestInvoice(db, user, config, ref.id), { status: 409 });
  storage.rows.get(ref.path)!.fiscalLeaseUntil = 0;
  storage.rows.set("billingCreditNotes/linked", { invoiceId: ref.id });
  await assert.rejects(deleteTestInvoice(db, user, config, ref.id), { status: 409 });
  storage.rows.delete("billingCreditNotes/linked");
  storage.rows.set("sriCompanyConfig/sri-config-inntel", productionConfig);
  await deleteTestInvoice(db, user, productionConfig, ref.id);
  assert.equal(storage.read(ref.path), undefined);
  assert.deepEqual(storage.read(live.path), liveBefore);
  assert.deepEqual(storage.read("billingInvoices/sale-qa")!.sriInvoicesByEnvironment, { "2": live.id });
  assert.ok([...storage.rows.keys()].some(key => key.startsWith("sriDeletedTests/")));
  storage.rows.set("sriCompanyConfig/sri-config-inntel", config);
  const regenerated = await reserve({ kind: "factura", saleId: "sale-qa" });
  assert.notEqual(storage.read(regenerated.path)!.documentNumber, original.documentNumber, "No se recicla el secuencial eliminado");
});

test("SOAP respeta soapAction vacío del WSDL oficial y DN admite OID de UANATACA", async t => {
  const key = generarClaveAccesoSRI({ fechaEmision: getEcuadorDate(), tipoComprobante: "01", ruc: config.ruc, ambiente: "1", establecimiento: "001", puntoEmision: "001", secuencial: 1, codigoNumerico: "12345678" });
  t.mock.method(globalThis, "fetch", async (_url: string, options: any) => {
    assert.equal(options.headers.SOAPAction, '\"\"');
    return resultXml(key);
  });
  assert.equal((await autorizacionComprobante(key, "1")).sinRegistro, true);
  const cert = forge.pki.createCertificate();
  cert.setIssuer([{ type: "2.5.4.97", value: "VATES-A66721499" }, { name: "commonName", value: "CA QA" }]);
  const dn = issuerRfc2253(cert);
  assert.ok(!dn.includes("undefined"));
  assert.match(dn, /2\.5\.4\.97=#0c/);
});

test("QA SRI: alterar el XML conservando SignatureValue nunca concede autorización", async t => {
  const { storage, db, reserve } = await setup();
  const ref = await reserve({ kind: "factura", saleId: "sale-qa" });
  const original = storage.read(ref.path)!;
  assert.equal(verifySriSignedXml(original.xmlFirmado, original.xmlFirmado), true);
  const altered = original.xmlFirmado.replace("<importeTotal>199.50</importeTotal>", "<importeTotal>0.01</importeTotal>");
  assert.notEqual(altered, original.xmlFirmado);
  assert.equal(verifySriSignedXml(altered, original.xmlFirmado), false);
  t.mock.method(globalThis, "fetch", async (url: string) => url.includes("Recepcion") ? reception("RECIBIDA") : resultXml(original.claveAcceso, authorized(original.claveAcceso, altered), 1));
  const result = await processFiscalDocument(db, user, config, "factura", ref, "emitir");
  assert.equal(result.document.estadoSRI, "ERROR_CONEXION");
  assert.equal(result.document.xmlAutorizado, null);
  assert.equal(result.document.numeroAutorizacion, null);
  assert.equal(storage.read("billingInvoices/sale-qa")!.sriStatus, "pendiente");
});

test("QA SRI: correo recuperable, bloqueo de duplicados y PDF RIDE con datos históricos", async t => {
  const { storage, db } = await setup();
  const production = { ...config, ambiente: "2" as const, emailEnabled: true };
  storage.rows.set("sriCompanyConfig/sri-config-inntel", production);
  const ref = await reserveFiscalDocument(db, user, production, { kind: "factura", saleId: "sale-qa" });
  const reserved = storage.read(ref.path)!;
  t.mock.method(globalThis, "fetch", async (url: string) => url.includes("Recepcion") ? reception("RECIBIDA") : resultXml(reserved.claveAcceso, authorized(reserved.claveAcceso, reserved.xmlFirmado, "PRODUCCIÓN"), 1));
  const result = await processFiscalDocument(db, user, production, "factura", ref, "emitir");
  const pdf = invoiceRidePdf(result.document as any, { ...production, razonSocial: "EMISOR NUEVO QUE NO DEBE APARECER" });
  assert.ok(pdf.length > 5000); assert.ok(pdf.subarray(0, 5).equals(Buffer.from("%PDF-")));
  assert.equal(pdf.toString("latin1").includes("EMISOR NUEVO QUE NO DEBE APARECER"), false);
  assert.ok(pdf.toString("latin1").includes("199.50"));
  assert.ok(pdf.toString("latin1").includes("Subtotal 5%"));
  const html = buildInvoiceHtml({ config: production, invoice: result.document as any });
  assert.match(html, /Subtotal 5%/); assert.match(html, /\$190\.00/); assert.doesNotMatch(html, /Subtotal 15%/);
  let attempts = 0;
  const failed = await deliverFiscalInvoice(db, user, production, ref.id, async () => { attempts++; return { sent: false, recipients: [], skippedReason: "SMTP sin configurar" }; });
  assert.equal(failed.sent, false); assert.equal(storage.read(ref.path)!.emailStatus, "error");
  await deliverFiscalInvoice(db, user, production, ref.id, async input => { attempts++; assert.equal(input.xmlFirmado, result.document.xmlAutorizado); assert.equal(input.config.razonSocial, production.razonSocial); return { sent: true, recipients: ["qa@example.test"], messageId: "local-accepted" }; });
  assert.equal(storage.read(ref.path)!.emailStatus, "enviado");
  await deliverFiscalInvoice(db, user, production, ref.id, async () => { throw Error("No debe volver a invocarse"); });
  assert.equal(attempts, 2);
  assert.equal(storage.read(ref.path)!.estadoSRI, "AUTORIZADO");
  assert.equal(storage.read(ref.path)!.total, 199.5);
});

test("QA SRI: no se envía correo de pruebas y un envío ambiguo exige confirmación", async () => {
  const { storage, db, reserve } = await setup();
  const ref = await reserve({ kind: "factura", saleId: "sale-qa" });
  await assert.rejects(deliverFiscalInvoice(db, user, config, ref.id, async () => { throw Error("No debe enviar"); }), { status: 409 });
  const row = storage.read(ref.path)!;
  storage.rows.set(ref.path, { ...row, ambiente: "2", claveAcceso: row.claveAcceso.slice(0, 23) + "2" + row.claveAcceso.slice(24), estadoSRI: "AUTORIZADO", xmlAutorizado: "fixture", emailStatus: "enviando", emailLeaseUntil: 0 });
  await assert.rejects(deliverFiscalInvoice(db, user, config, ref.id), { status: 409 });
  await deliverFiscalInvoice(db, user, config, ref.id, async () => ({ sent: true, recipients: [], messageId: "explicit-retry" }), true);
  assert.equal(storage.read(ref.path)!.emailStatus, "enviado");
});

test("QA SRI: documentos complementarios autorizados de producción requieren conciliación comercial explícita", async t => {
  const { storage, db } = await setup();
  const production = { ...config, ambiente: "2" as const };
  storage.rows.set("sriCompanyConfig/sri-config-inntel", production);
  const reserve = (request: SriNewDocument) => reserveFiscalDocument(db, user, production, request);
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    if (url.includes("Recepcion")) return reception("RECIBIDA");
    const key = String(init.body).match(/<claveAccesoComprobante>(\d{49})<\/claveAccesoComprobante>/)?.[1];
    const document = [...storage.rows.values()].find(row => row.fiscalWorkflowVersion === 1 && row.claveAcceso === key);
    return resultXml(key!, authorized(key!, document!.xmlFirmado, "PRODUCCIÓN"), 1);
  });
  const invoice = await reserve({ kind: "factura", saleId: "sale-qa" });
  await processFiscalDocument(db, user, production, "factura", invoice, "emitir");
  const credit = await reserve({ kind: "nota_credito", invoiceId: invoice.id, reason: "Ajuste QA", items: [{ id: "part", quantity: 1 }] });
  const debit = await reserve({ kind: "nota_debito", invoiceId: invoice.id, ivaRate: 5, paymentCode: "20", reasons: [{ reason: "Recargo QA", amount: 10 }] });
  const claveAcceso = generarClaveAccesoSRI({ fechaEmision: getEcuadorDate(), tipoComprobante: "01", ruc: "1790012345001", ambiente: "2", establecimiento: "001", puntoEmision: "001", secuencial: 1, codigoNumerico: "87654321" });
  storage.rows.set("purchaseInvoices/qa", { supplierRuc: "1790012345001", supplierName: "Proveedor QA", date: getEcuadorDate(), claveAcceso, documentNumber: "001-001-000000001", subtotal: 100, ivaAmount: 15, total: 115, items: [{ ivaRate: 15, subtotal: 100, ivaAmount: 15 }] });
  const retention = await reserve({ kind: "retencion", purchaseInvoiceId: "qa", supportCode: "01", relatedParty: false, paymentCode: "20", items: [{ taxType: "IVA", code: "1", percentage: 30, taxBase: 15 }] });
  for (const [kind, ref] of [["nota_credito", credit], ["nota_debito", debit], ["retencion", retention]] as const) {
    const { document } = await processFiscalDocument(db, user, production, kind, ref, "emitir");
    assert.equal(document.estadoSRI, "AUTORIZADO");
    assert.equal(document.commercialReconciliationStatus, "pendiente");
  }
});

test("QA SRI: precio no representable y compra anulada se rechazan antes de reservar números", async () => {
  const { storage, reserve } = await setup();
  storage.rows.get("billingInvoices/sale-qa")!.items[0].unitPrice = 100.0000001;
  await assert.rejects(reserve({ kind: "factura", saleId: "sale-qa" }), /seis decimales/);
  assert.equal([...storage.rows.keys()].some(key => key.startsWith("sequences/")), false);
  const claveAcceso = generarClaveAccesoSRI({ fechaEmision: getEcuadorDate(), tipoComprobante: "01", ruc: "1790012345001", ambiente: "1", establecimiento: "001", puntoEmision: "001", secuencial: 1, codigoNumerico: "87654321" });
  storage.rows.set("purchaseInvoices/void", { status: "anulada", supplierRuc: "1790012345001", date: getEcuadorDate(), claveAcceso, documentNumber: "001-001-000000001" });
  await assert.rejects(reserve({ kind: "retencion", purchaseInvoiceId: "void", supportCode: "01", relatedParty: false, paymentCode: "20", items: [{ taxType: "RENTA", code: "312", percentage: 1.75, taxBase: 100 }] }), /sustento consistentes/);
});

test("Correo SRI: cinco documentos autorizados entregan PDF/XML/logo al destinatario y copia privada a empresa", async t => {
  const { storage, db } = await setup();
  const production = { ...config, ambiente: "2" as const, emailEnabled: true, emailNotifyClient: true, emailNotifyCompany: true,
    emailHost: "smtp.example.test", emailUser: "facturacion@example.test", emailFrom: "facturacion@example.test", emailNotificaciones: "empresa@example.test", emailCopyTo: "auditoria@example.test" };
  storage.rows.set("sriCompanyConfig/sri-config-inntel", production);
  const reserve = (body: SriNewDocument) => reserveFiscalDocument(db, user, production, body);
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    if (url.includes("Recepcion")) return reception("RECIBIDA");
    const key = String(init.body).match(/<claveAccesoComprobante>(\d{49})<\/claveAccesoComprobante>/)?.[1];
    const document = [...storage.rows.values()].find(row => row.fiscalWorkflowVersion === 1 && row.claveAcceso === key);
    return resultXml(key!, authorized(key!, document!.xmlFirmado, "PRODUCCIÓN"), 1);
  });
  const invoice = await reserve({ kind: "factura", saleId: "sale-qa" });
  await processFiscalDocument(db, user, production, "factura", invoice, "emitir");
  const nc = await reserve({ kind: "nota_credito", invoiceId: invoice.id, reason: "Devolución QA", items: [{ id: "part", quantity: 1 }] });
  const nd = await reserve({ kind: "nota_debito", invoiceId: invoice.id, ivaRate: 5, paymentCode: "20", reasons: [{ reason: "Ajuste QA", amount: 10 }] });
  const guide = await reserve({ kind: "guia_remision", invoiceId: invoice.id, startDate: getEcuadorDate(), endDate: getEcuadorDate(), carrierName: "Transportista QA", carrierRuc: "1790016919001", licensePlate: "ABC1234", originAddress: "Quito QA", destAddress: "Destino QA", destClientName: "Cliente QA", destClientRuc: "1710034065", route: "Ruta QA", reason: "Entrega QA", items: [{ name: "Equipo", quantity: 1, unit: "unidad", sku: "QA" }] });
  const claveAcceso = generarClaveAccesoSRI({ fechaEmision: getEcuadorDate(), tipoComprobante: "01", ruc: "1790012345001", ambiente: "2", establecimiento: "001", puntoEmision: "001", secuencial: 1, codigoNumerico: "87654321" });
  storage.rows.set("suppliers/qa", { email: "proveedor@example.test" });
  storage.rows.set("purchaseInvoices/qa", { supplierId: "qa", supplierRuc: "1790012345001", supplierName: "Proveedor QA", date: getEcuadorDate(), claveAcceso, documentNumber: "001-001-000000001", subtotal: 100, ivaAmount: 15, total: 115, items: [{ ivaRate: 15, subtotal: 100, ivaAmount: 15 }] });
  const retention = await reserve({ kind: "retencion", purchaseInvoiceId: "qa", supportCode: "01", relatedParty: false, paymentCode: "20", items: [{ taxType: "IVA", code: "1", percentage: 30, taxBase: 15 }] });
  let deliveries = 0;
  for (const [kind, ref] of [["factura", invoice], ["nota_credito", nc], ["nota_debito", nd], ["guia_remision", guide], ["retencion", retention]] as const) {
    await processFiscalDocument(db, user, production, kind, ref, "emitir");
    const result = await deliverFiscalDocument(db, user, production, kind, ref.id, input => sendInvoiceEmail(input, {
      readPassword: async () => "SYNTHETIC-LOCAL-SMTP",
      send: async message => {
        deliveries++;
        assert.deepEqual(message.to, [kind === "retencion" ? "proveedor@example.test" : "cliente@example.test"]);
        assert.deepEqual(message.bcc, ["empresa@example.test", "auditoria@example.test"]); assert.equal(message.cc, undefined);
        assert.equal(message.attachments!.length, 3);
        const pdfBytes = message.attachments![0].content;
        assert.ok(Buffer.isBuffer(pdfBytes));
        assert.equal(pdfBytes.subarray(0, 5).toString(), "%PDF-");
        assert.match(String(message.attachments![1].content), /<estado>AUTORIZADO<\/estado>/);
        assert.equal(message.attachments![2].cid, "inntel-logo");
        assert.match(message.html!, /cid:inntel-logo/);
        assert.ok(message.subject.includes(storage.read(ref.path)!.documentNumber));
        const exportPath = process.env.SRI_QA_EMAIL_OUTPUT;
        if (exportPath) { mkdirSync(exportPath, { recursive: true }); writeFileSync(join(exportPath, kind + ".html"), message.html!); writeFileSync(join(exportPath, kind + ".pdf"), message.attachments![0].content); writeFileSync(join(exportPath, "logo.png"), message.attachments![2].content); }
        return { messageId: "local-accepted", accepted: [...message.to, ...message.bcc!], rejected: [] };
      },
    }));
    assert.equal(result.sent, true); assert.equal(storage.read(ref.path)!.emailStatus, "enviado");
    await deliverFiscalDocument(db, user, production, kind, ref.id, async () => { throw Error("No debe duplicar un envío confirmado"); });
  }
  assert.equal(deliveries, 5);
});

test("Correo SRI: faltan destinatarios, escape HTML y reintento de copia parcial sin repetir al cliente", async () => {
  const { storage, db } = await setup();
  const production = { ...config, emailEnabled: true, emailHost: "smtp.example.test", emailUser: "mail@example.test", emailNotifyClient: true, emailNotifyCompany: true, emailNotificaciones: "company@example.test" };
  assert.throws(() => fiscalEmailRecipients({ config: production, invoice: { clientEmail: "" } }), /correo válido/);
  const html = buildInvoiceHtml({ config: production, invoice: { clientName: '<img src=x onerror="alert(1)">', documentNumber: "QA", items: [], total: 12, date: "2026-11-16" } });
  assert.equal(html.includes('<img src=x'), false); assert.ok(html.includes("&lt;img"));
  const key = generarClaveAccesoSRI({ fechaEmision: getEcuadorDate(), tipoComprobante: "01", ruc: production.ruc, ambiente: "2", establecimiento: "001", puntoEmision: "001", secuencial: 1, codigoNumerico: "87654321" });
  storage.rows.set("billingInvoices/email-qa", { documentType: "factura", ambiente: "2", estadoSRI: "AUTORIZADO", claveAcceso: key, clientEmail: "client@example.test", xmlAutorizado: "local fixture" });
  await deliverFiscalInvoice(db, user, production, "email-qa", async () => ({ sent: false, partial: true, recipients: ["client@example.test"], rejected: ["company@example.test"] }));
  assert.equal(storage.read("billingInvoices/email-qa")!.emailStatus, "parcial");
  await deliverFiscalInvoice(db, user, production, "email-qa", async input => {
    const plan = fiscalEmailRecipients(input);
    assert.deepEqual(plan.to, []); assert.deepEqual(plan.bcc, ["company@example.test"]);
    return { sent: true, recipients: plan.bcc };
  });
  assert.deepEqual(storage.read("billingInvoices/email-qa")!.emailAcceptedRecipients, ["client@example.test", "company@example.test"]);
  storage.rows.get("billingInvoices/email-qa")!.status = "anulada";
  await assert.rejects(deliverFiscalInvoice(db, user, production, "email-qa"), { status: 409 });
});
