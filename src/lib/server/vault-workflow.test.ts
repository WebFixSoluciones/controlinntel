import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { save, remove, reveal } from "./operations.ts";
import type { Firestore } from "firebase-admin/firestore";
import type { UserProfile } from "@/types";

const previousKey = process.env.VAULT_KEY_BASE64;
before(() => { process.env.VAULT_KEY_BASE64 = randomBytes(32).toString("base64"); });
after(() => { if (previousKey === undefined) delete process.env.VAULT_KEY_BASE64; else process.env.VAULT_KEY_BASE64 = previousKey; });

class VaultDatabase {
  rows = new Map<string, any>([["clients/a", { id: "a" }], ["clients/b", { id: "b" }]]);
  failCommit = false;
  snap(path: string): any { return { exists: this.rows.has(path), id: path.split("/").pop(), data: () => structuredClone(this.rows.get(path)) }; }
  doc(path: string): any { return { path, id: path.split("/").pop(), parent: { id: path.split("/")[0] }, get: async () => this.snap(path), create: async (row: any) => { if (this.rows.has(path)) throw Error("Already exists"); this.rows.set(path, structuredClone(row)); } }; }
  collection(name: string): any { return { doc: (id: string) => this.doc(name + "/" + id) }; }
  async runTransaction(fn: (tx: any) => Promise<any>) {
    const writes = new Map<string, any>(); let writing = false;
    const tx = {
      get: async (ref: any) => { assert.equal(writing, false, "Firestore requires reads before writes"); return this.snap(ref.path); },
      set: (ref: any, row: any) => { writing = true; writes.set(ref.path, structuredClone(row)); },
      create: (ref: any, row: any) => { writing = true; if (this.rows.has(ref.path)) throw Error("Already exists"); writes.set(ref.path, structuredClone(row)); },
      delete: (ref: any) => { writing = true; writes.set(ref.path, null); },
    };
    const result = await fn(tx);
    if (this.failCommit) throw Error("Injected failure");
    for (const [path, row] of writes) { if (row === null) this.rows.delete(path); else this.rows.set(path, row); }
    return result;
  }
  get db() { return this as unknown as Firestore; }
}
const admin: UserProfile = { uid: "qa", email: "qa@example.test", displayName: "QA", role: "superadmin", status: "activo", permissions: ["all"] };
const data = () => ({ clientId: "a", serviceName: "SIETEL", username: "admin", category: "otro", password: " Clave×Δ$Secreta#42 ", notes: "Referencia" });

test("client vault creates an encrypted record, preserves password on metadata edits, replaces it explicitly, audits and deletes", async () => {
  const database = new VaultDatabase(), input = data();
  const created = await save(admin, "clientVaultItems", input, "credential", undefined, database.db);
  assert.equal(created.password, undefined); assert.equal(created.secret, undefined);
  assert.match(database.rows.get("clientVaultItems/credential").secret, /^v1\./);
  assert.equal(JSON.stringify([...database.rows]).includes(input.password), false);
  assert.equal(await reveal(admin, "clientVaultItems", "credential", database.db), input.password);
  const encrypted = database.rows.get("clientVaultItems/credential").secret;
  const updated = await save(admin, "clientVaultItems", { notes: "Nueva referencia" }, "credential", 1, database.db);
  assert.equal(updated.version, 2); assert.equal(database.rows.get("clientVaultItems/credential").secret, encrypted);
  await assert.rejects(save(admin, "clientVaultItems", { notes: "Stale edit" }, "credential", 1, database.db), { status: 409 });
  await save(admin, "clientVaultItems", { password: "Replacement#2" }, "credential", 2, database.db);
  assert.equal(await reveal(admin, "clientVaultItems", "credential", database.db), "Replacement#2");
  assert.ok([...database.rows].some(([path, row]) => path.startsWith("auditLogs/") && row.action === "VIEW_VAULT_PASSWORD"));
  await remove(admin, "clientVaultItems", "credential", 3, database.db);
  assert.equal(database.rows.has("clientVaultItems/credential"), false);
  assert.ok([...database.rows].some(([path, row]) => path.startsWith("operationLog/") && row.type === "DELETE"));
});

test("failed writes do not create credentials or success audit records", async () => {
  const database = new VaultDatabase(), original = JSON.stringify([...database.rows]); database.failCommit = true;
  await assert.rejects(save(admin, "clientVaultItems", data(), "credential", undefined, database.db), /Injected failure/);
  assert.equal(JSON.stringify([...database.rows]), original);
});

test("a credential cannot be moved to another customer by editing the request", async () => {
  const database = new VaultDatabase(); await save(admin, "clientVaultItems", data(), "credential", undefined, database.db);
  await assert.rejects(save(admin, "clientVaultItems", { clientId: "b" }, "credential", 1, database.db), /vinculada a su cliente/);
});

test("granular reveal and delete denials apply even with manage_vault", async () => {
  const database = new VaultDatabase(); await save(admin, "clientVaultItems", data(), "credential", undefined, database.db);
  const restricted: UserProfile = { ...admin, role: "admin", modulePermissions: { boveda: { enabled: true, actions: { canViewClientVault: true, canViewInternalVault: true, canRevealPasswords: false, canDeleteCredentials: false } } } };
  await assert.rejects(reveal(restricted, "clientVaultItems", "credential", database.db), { status: 403 });
  await assert.rejects(remove(restricted, "clientVaultItems", "credential", 1, database.db), { status: 403 });
  await assert.rejects(save({ ...restricted, status: "inactivo" }, "clientVaultItems", data(), "other", undefined, database.db), { status: 403 });
});

test("internal vault enforces allowedRoles and rejects customer-only accounts", async () => {
  const database = new VaultDatabase();
  await save(admin, "vault", { serviceName: "Router", username: "qa", password: "Secret#1", allowedRoles: ["superadmin"] }, "internal", undefined, database.db);
  await assert.rejects(reveal({ ...admin, role: "admin" }, "vault", "internal", database.db), { status: 403 });
  const customerOnly: UserProfile = { ...admin, role: "soporte", permissions: ["manage_vault"] };
  await assert.rejects(reveal(customerOnly, "vault", "internal", database.db), { status: 403 });
});

test("a mismatched encryption key returns a recoverable error without replacing the stored secret", async () => {
  const database = new VaultDatabase(); await save(admin, "clientVaultItems", data(), "credential", undefined, database.db);
  const original = database.rows.get("clientVaultItems/credential").secret, key = process.env.VAULT_KEY_BASE64;
  try { process.env.VAULT_KEY_BASE64 = randomBytes(32).toString("base64"); await assert.rejects(reveal(admin, "clientVaultItems", "credential", database.db), { status: 409 }); }
  finally { process.env.VAULT_KEY_BASE64 = key; }
  assert.equal(database.rows.get("clientVaultItems/credential").secret, original);
});

test("a customer node with estado activo is saved with encrypted service credentials and can be edited without losing them", async () => {
  const database = new VaultDatabase();
  const created = await save(admin, "nodes", { clientId: "a", name: "Sede Quito", address: "Quito, Pichincha", totalCapacityMbps: 100, usedCapacityMbps: 0, status: "activo", coordinates: { lat: 0, lng: -78.45 }, providers: [{ id: "p", providerName: "Proveedor", capacityMbps: 100 }], services: [{ id: "router", systemName: "Router", username: "admin", password: "NodeSecret#42" }] }, "node", undefined, database.db);
  assert.equal(created.status, "activo");
  assert.equal(created.services[0].password, undefined); assert.equal(created.services[0].passwordSealed, undefined);
  assert.equal(created.services[0].hasPassword, true);
  const encrypted = database.rows.get("nodes/node").services[0].passwordSealed;
  assert.match(encrypted, /^v1\./);
  await save(admin, "nodes", { name: "Sede renombrada" }, "node", 1, database.db);
  assert.equal(database.rows.get("nodes/node").services[0].passwordSealed, encrypted);
});
