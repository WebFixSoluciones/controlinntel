import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import forge from "node-forge";
import type { Firestore } from "firebase-admin/firestore";
import type { UserProfile } from "@/types";
import { getEcuadorDate } from "../date-utils.ts";
import { DEFAULT_INNTEL_SRI_CONFIG, generarClaveAccesoSRI } from "../sri-service.ts";
import { autorizacionComprobante } from "./sri-client.ts";
import { sriRequest, type FiscalKind, type SriNewDocument } from "./sri-documents.ts";
import { correctRejectedDocument, processFiscalDocument, reserveFiscalDocument } from "./sri-workflow.ts";
import { parsePkcs12 } from "./sri-signer.ts";
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
      create: (ref: Ref, row: Row) => { assert.ok(!this.rows.has(ref.path)); set(ref, row); },
      update: (ref: Ref, patch: Row) => set(ref, { ...this.read(ref.path), ...patch }),
    };
    try {
      const result = await work(tx);
      if (this.failNextCommit) { this.failNextCommit = false; throw new Error("Fallo de escritura inyectado"); }
      changes.forEach((row, path) => this.rows.set(path, row));
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
  }
  const exportPath = process.env.SRI_QA_XML_OUTPUT;
  if (exportPath) {
    mkdirSync(exportPath, { recursive: true });
    for (const [kind, document] of samples) writeFileSync(join(exportPath, kind + ".xml"), storage.read(document.path)!.xmlFirmado);
  }
});
