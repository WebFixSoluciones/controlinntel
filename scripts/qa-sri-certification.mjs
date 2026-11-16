// Explicit opt-in: read live issuer configuration; all database writes go to a demo emulator.
import assert from "node:assert/strict";
import { randomInt, randomUUID } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { adminServices } from "../src/lib/server/admin.ts";
import { unseal, initializeVaultKey } from "../src/lib/server/vault.ts";
import { readSriCompanyConfig } from "../src/lib/server/sri-secrets.ts";
import { executeCommercial } from "../src/lib/server/commercial.ts";
import { reserveFiscalDocument, processFiscalDocument } from "../src/lib/server/sri-workflow.ts";
import { getEcuadorDate } from "../src/lib/date-utils.ts";
import { calculatePriceWithoutTax } from "../src/lib/pricing.ts";

process.loadEnvFile(".env.local");
if (process.env.SRI_QA_REAL_RECEPTION !== "1" || process.env.FIRESTORE_EMULATOR_HOST) throw Error("Explicit certification opt-in required, with live source reads and a separate local emulator.");
const source = adminServices().db;
assert.equal(source.projectId, "inntelcorp-45c89");
const originalConfig = await readSriCompanyConfig(source);
assert.equal(originalConfig.ambiente, "1", "Never run this certification script while the company is in production mode");
const secret = (await source.doc("sriSecrets/emisor").get()).data();
assert.equal(typeof secret?.sealed, "string", "Requires an already encrypted certificate; does not migrate live secrets");
await initializeVaultKey();
const material = JSON.parse(unseal(secret.sealed, "sriSecrets/emisor"));
assert.ok(material.pkcs12Base64 && material.password);
const trial = await source.collection("billingInvoices").where("documentType", "==", "factura").where("ambiente", "==", "1").limit(1).get();
const receiver = trial.docs[0]?.data();
assert.ok(receiver?.clientRuc, "Requires a recipient already used in the company's SRI test environment");

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
const db = getFirestore(initializeApp({ projectId: "demo-controlinntel-qa" }, "sri-certification-qa"));
assert.equal(db.projectId, "demo-controlinntel-qa");
const sequence = 950_000_000 + randomInt(1, 1_000_000);
const config = { ...originalConfig, ambiente: "1", emailEnabled: false, secuencialFactura: sequence, secuencialNotaCredito: sequence, secuencialNotaDebito: sequence, secuencialGuiaRemision: sequence };
delete config.certificadoBase64; delete config.certificadoClave;
await db.doc("sriCompanyConfig/sri-config-inntel").set(config);
await db.doc("sriSecrets/emisor").set(secret); // ciphertext only
const user = { uid: "sri-local-qa", email: "qa@example.test", displayName: "QA SRI AISLADO", role: "superadmin", status: "activo", permissions: ["all"] };
const run = (action, data) => executeCommercial(user, { action, data, operationId: randomUUID() }, db);
const client = await run("createClient", { client: { businessName: "PRUEBAS SERVICIO DE RENTAS INTERNAS", identificationType: "RUC", identificationNumber: receiver.clientRuc, status: "activo", email: "qa@example.test", phone: "0990000000", address: "DIRECCION EXCLUSIVA DE PRUEBAS QA" } });
const product = await run("createProduct", { type: "servicio", name: "SERVICIO EXCLUSIVO DE PRUEBAS QA", sku: "QA-SRI", salePrice: calculatePriceWithoutTax(1, 15), salePriceConIva: 1, ivaRate: 15, baseCost: 0, stock: 0, minStock: 0, tracksStock: false, stockByWarehouse: {}, status: "activo", unit: "servicio" });
const sale = await run("issueSale", { documentType: "nota_venta", status: "registrado", clientId: client.id, date: getEcuadorDate(), paymentMethod: "credito", notes: "QA AISLADO SIN EFECTOS EN LA BASE COMERCIAL", items: [{ id: "qa-item", productId: product.id, sku: product.sku, name: product.name, quantity: 2, unitPrice: product.salePrice, unitPriceWithTax: 1, ivaRate: 15, discount: 0 }] });
const output = join(tmpdir(), "inntel-sri-certification-" + Date.now()); mkdirSync(output);
const results = [];
async function emit(request) {
  const ref = await reserveFiscalDocument(db, user, config, request, randomUUID());
  const result = await processFiscalDocument(db, user, config, request.kind, ref, "emitir");
  const row = result.document;
  writeFileSync(join(output, request.kind + ".xml"), row.xmlFirmado);
  if (row.xmlAutorizado) writeFileSync(join(output, request.kind + "-autorizado.xml"), row.xmlAutorizado);
  const summary = { kind: request.kind, id: ref.id, number: row.documentNumber, environment: row.ambiente, state: row.estadoSRI, authorized: !!row.xmlAutorizado, messages: row.mensajesSRI };
  results.push(summary); console.log(JSON.stringify(summary));
  return { ref, row };
}
const invoice = await emit({ kind: "factura", saleId: sale.id });
if (invoice.row.estadoSRI === "AUTORIZADO") {
  await emit({ kind: "nota_credito", invoiceId: invoice.ref.id, reason: "DEVOLUCION PARCIAL EXCLUSIVA DE QA", items: [{ id: "qa-item", quantity: 1 }] });
  await emit({ kind: "nota_debito", invoiceId: invoice.ref.id, ivaRate: 15, paymentCode: "20", reasons: [{ reason: "AJUSTE EXCLUSIVO DE QA", amount: 0.1 }] });
  await emit({ kind: "guia_remision", invoiceId: invoice.ref.id, startDate: getEcuadorDate(), endDate: getEcuadorDate(), carrierName: "TRANSPORTISTA DE PRUEBAS QA", carrierRuc: receiver.clientRuc, licensePlate: "PAA1234", originAddress: "ORIGEN DE PRUEBAS", destAddress: "DESTINO DE PRUEBAS", destClientName: client.businessName, destClientRuc: receiver.clientRuc, route: "RUTA EXCLUSIVA DE PRUEBAS", reason: "TRASLADO DE PRUEBAS", items: [{ name: "ARTICULO DE PRUEBAS QA", quantity: 1, unit: "unidad", sku: "QA-SRI" }] });
}
writeFileSync(join(output, "results.json"), JSON.stringify({ results, liveDatabaseWrites: false, emailSent: false }, null, 2));
console.log(JSON.stringify({ output, liveDatabaseWrites: false, emailSent: false }));
await db.terminate(); await source.terminate();
