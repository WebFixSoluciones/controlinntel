import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { VaultKeyProvider, parseVaultKey } from "./vault-key.ts";

test("a configured 256-bit key does not require a cloud call", async () => {
  const key = randomBytes(32).toString("base64"); let calls = 0;
  const provider = new VaultKeyProvider(() => key, async () => { calls++; return ""; });
  await provider.ready(); assert.equal(calls, 0); assert.deepEqual(provider.get(), parseVaultKey(key));
});

test("missing keys fail closed; concurrent initialization loads the same managed key once", async () => {
  const key = randomBytes(32).toString("base64"); let calls = 0;
  const provider = new VaultKeyProvider(() => undefined, async () => { calls++; return key; });
  assert.throws(() => provider.get(), { code: "VAULT_KEY_NOT_READY" });
  await Promise.all([provider.ready(), provider.ready(), provider.ready()]);
  assert.equal(calls, 1); assert.deepEqual(provider.get(), Buffer.from(key, "base64"));
  await provider.ready(); assert.equal(calls, 1);
});

test("a temporary manager failure can be retried without generating a replacement key", async () => {
  const key = randomBytes(32).toString("base64"); let calls = 0;
  const provider = new VaultKeyProvider(() => undefined, async () => { if (++calls === 1) throw Error("Unavailable"); return key; });
  await assert.rejects(provider.ready(), { code: "VAULT_KEY_UNAVAILABLE" });
  assert.throws(() => provider.get(), { code: "VAULT_KEY_NOT_READY" });
  await provider.ready(); assert.equal(calls, 2); assert.deepEqual(provider.get(), Buffer.from(key, "base64"));
});

test("an invalid configured key never falls back to another key", async () => {
  let calls = 0;
  const provider = new VaultKeyProvider(() => "invalid-key", async () => { calls++; return randomBytes(32).toString("base64"); });
  await assert.rejects(provider.ready(), { code: "VAULT_KEY_INVALID" }); assert.equal(calls, 0);
  assert.throws(() => parseVaultKey(randomBytes(16).toString("base64")), { code: "VAULT_KEY_INVALID" });
  assert.throws(() => parseVaultKey("?" + randomBytes(32).toString("base64")), { code: "VAULT_KEY_INVALID" });
});
