import test from "node:test";
import assert from "node:assert/strict";
import { vaultMetadata } from "./vault-metadata.ts";

test("credential state and cache keep metadata and version without plaintext or encrypted secret fields", () => {
  const input = { id: "qa", serviceName: "SIETEL", username: "admin", clientId: "client", version: 3, notes: "Referencia", password: "opaque-secret", secret: "v1.secret", encryptedPassword: "ENC_legacy", totpSecret: "otp" };
  const result = vaultMetadata(input);
  assert.deepEqual(result, { id: "qa", serviceName: "SIETEL", username: "admin", clientId: "client", version: 3, notes: "Referencia" });
  assert.equal(input.password, "opaque-secret");
  assert.equal(JSON.stringify(result).includes("opaque-secret"), false);
});
