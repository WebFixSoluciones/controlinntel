import test from "node:test";
import assert from "node:assert/strict";
import { nodeSchema, nodeField } from "./node-schema.ts";
import { validationIssues } from "./validation-issues.ts";

const valid = () => ({ name: "Sede Quito", address: "Carapungo, Quito, Pichincha", totalCapacityMbps: 0, usedCapacityMbps: 0, status: "activo", coordinates: { lat: 0, lng: -78.45 }, providers: [], services: [] });

test("the actual customer-node payload saves administrative and legacy network states, including latitude zero", () => {
  for (const status of ["activo", "suspendido", "retirado", "reportado", "no_reportado", "online", "offline", "warning"]) {
    assert.equal(nodeSchema.safeParse({ ...valid(), status }).success, true, status);
  }
});

test("missing fields identify the name and invalid state without echoing rejected values", () => {
  const parsed = nodeSchema.safeParse({ ...valid(), name: " ", status: "SECRET-NOT-FOR-ERROR-MESSAGES" });
  assert.equal(parsed.success, false); if (parsed.success) return;
  const fields = validationIssues(parsed.error.issues).map(nodeField);
  assert.ok(fields.some(field => field.path === "name" && field.label === "Nombre de la sede o nodo"));
  assert.ok(fields.some(field => field.path === "status" && field.tab === "general"));
  assert.equal(JSON.stringify(fields).includes("SECRET-NOT-FOR-ERROR-MESSAGES"), false);
});

test("a negative carrier capacity and incomplete system point to the correct tabs and row", () => {
  const parsed = nodeSchema.safeParse({ ...valid(), providers: [{ id: "provider", providerName: "Proveedor", capacityMbps: -1 }], services: [{ id: "system", systemName: "" }] });
  assert.equal(parsed.success, false); if (parsed.success) return;
  const fields = validationIssues(parsed.error.issues).map(nodeField);
  assert.ok(fields.some(field => field.path === "providers.0.capacityMbps" && field.tab === "portadores" && field.label.includes("Proveedor 1")));
  assert.ok(fields.some(field => field.path === "services.0.systemName" && field.tab === "servicios" && field.label.includes("Sistema 1")));
});

test("out-of-range coordinates and oversized secrets fail before persistence", () => {
  assert.equal(nodeSchema.safeParse({ ...valid(), coordinates: { lat: 91, lng: -78 } }).success, false);
  assert.equal(nodeSchema.safeParse({ ...valid(), services: [{ id: "system", systemName: "Router", password: "x".repeat(4097) }] }).success, false);
});
