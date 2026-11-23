import test from "node:test";
import assert from "node:assert/strict";
import { updateNodeSystem } from "./node-system-editor.ts";
import { nodeSchema } from "./node-schema.ts";

const services = () => [{ id: "router", systemName: "Router", linkOrIp: "192.0.2.1", username: "before", hasPassword: true, notes: "Anterior" },
  { id: "olt", systemName: "OLT", linkOrIp: "192.0.2.2", username: "other", hasPassword: true }];
const changes = { systemName: " Router editado ", linkOrIp: " 192.0.2.3 ", username: " after ", password: "", notes: " Corregido " };

test("editar un sistema conserva su identidad, contraseña oculta y los otros sistemas", () => {
  const original = services(), before = structuredClone(original);
  const edited = updateNodeSystem(original, "router", changes);
  assert.equal(edited.length, 2); assert.equal(edited[0].id, "router");
  assert.equal(edited[0].systemName, "Router editado"); assert.equal(edited[0].username, "after");
  assert.equal(edited[0].linkOrIp, "192.0.2.3"); assert.equal(edited[0].notes, "Corregido");
  assert.equal(edited[0].hasPassword, true); assert.equal(edited[0].password, undefined);
  assert.deepEqual(edited[1], original[1]); assert.deepEqual(original, before);
});

test("una clave nueva reemplaza solo la seleccionada y conserva sus espacios", () => {
  const edited = updateNodeSystem(services(), "router", { ...changes, password: " NewSecret#42 " });
  assert.equal(edited[0].password, " NewSecret#42 ");
  assert.equal(edited[1].password, undefined);
});

test("editar de nuevo un borrador sin clave nueva conserva la clave aún no guardada", () => {
  const original = [{ ...services()[0], password: "DraftSecret#42" }];
  assert.equal(updateNodeSystem(original, "router", changes)[0].password, "DraftSecret#42");
});

test("no se añade un duplicado al editar un sistema inexistente o sin nombre", () => {
  assert.throws(() => updateNodeSystem(services(), "missing", changes), /seleccionado/);
  assert.throws(() => updateNodeSystem(services(), "router", { ...changes, systemName: " " }), /nombre/);
});

test("limpiar notas opcionales conserva un payload válido al enviarlo al servidor", () => {
  const edited = updateNodeSystem(services(), "router", { ...changes, notes: "" });
  const payload = JSON.parse(JSON.stringify({ name: "Nodo", address: "Quito", status: "activo", totalCapacityMbps: 0, usedCapacityMbps: 0, services: edited }, (_key, value) => value === undefined ? null : value));
  assert.equal(nodeSchema.safeParse(payload).success, true);
});
