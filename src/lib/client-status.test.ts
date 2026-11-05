import test from "node:test";
import assert from "node:assert/strict";
import { matchesClientStatus, clientStatusLabel } from "./client-status.ts";

test("retiring a customer removes it immediately from the default directory while keeping the retired filter and history", () => {
  const clients = [{ id: "a", status: "activo" }, { id: "b", status: "suspendido" }];
  assert.equal(clients.filter(client => matchesClientStatus(client)).length, 2);
  clients[0].status = "retirado";
  assert.deepEqual(clients.filter(client => matchesClientStatus(client)).map(client => client.id), ["b"]);
  assert.deepEqual(clients.filter(client => matchesClientStatus(client, "retirado")).map(client => client.id), ["a"]);
  assert.equal(clients.filter(client => matchesClientStatus(client, "todos")).length, 2);
  assert.equal(clientStatusLabel(clients[0].status), "Retirado");
});
