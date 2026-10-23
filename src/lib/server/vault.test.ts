import test from "node:test";
import assert from "node:assert/strict";
import { seal, unseal } from "./vault.ts";

test("Server Vault - AES-256-GCM seal and unseal", () => {
  const secret = "SuperSecretRouterKey2026!#$";
  const context = "vault/vlt-123";

  // Seal produces 4-part string: v1.iv.tag.payload
  const sealed = seal(secret, context);
  assert.equal(typeof sealed, "string");
  const parts = sealed.split(".");
  assert.equal(parts.length, 4);
  assert.equal(parts[0], "v1");

  // Unseal with same context recovers original secret
  const unsealed = unseal(sealed, context);
  assert.equal(unsealed, secret);
});

test("Server Vault - Context binding prevents replay in different record", () => {
  const secret = "SecretPasswordToProtect";
  const contextA = "vault/cred-A";
  const contextB = "vault/cred-B";

  const sealed = seal(secret, contextA);

  // Attempting to unseal with different context must fail (AAD mismatch)
  assert.throws(() => {
    unseal(sealed, contextB);
  }, /Unsupported state or unable to authenticate data|bad auth|authenticate/i);
});

test("Server Vault - Tampered payload or tag throws error", () => {
  const secret = "ImportantKey";
  const context = "vault/cred-01";
  const sealed = seal(secret, context);
  const parts = sealed.split(".");

  // Tamper with tag
  parts[2] = Buffer.from("tamperedtag12345").toString("base64");
  const tampered = parts.join(".");

  assert.throws(() => {
    unseal(tampered, context);
  });
});
