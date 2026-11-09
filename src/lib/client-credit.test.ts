import test from "node:test";
import assert from "node:assert/strict";
import { availableClientCredit, allocateClientCredit } from "./client-credit.ts";

test("El saldo a favor suma solo anticipos disponibles del cliente y se aplica desde el más antiguo", () => {
  const advances = [
    { id: "new", clientId: "a", date: "2026-11-09", remaining: 40.25, status: "vigente" },
    { id: "old", clientId: "a", date: "2026-11-01", remaining: 60, status: "vigente" },
    { id: "other", clientId: "b", date: "2026-10-01", remaining: 500, status: "vigente" },
    { id: "cancelled", clientId: "a", remaining: 100, status: "anulado" },
    { id: "spent", clientId: "a", remaining: 0, status: "aplicado" },
  ];
  assert.equal(availableClientCredit(advances, "a").total, 100.25);
  assert.deepEqual(allocateClientCredit(advances, "a", 80.1), [{ advanceId: "old", amount: 60 }, { advanceId: "new", amount: 20.1 }]);
  assert.equal(availableClientCredit(advances, "missing").total, 0);
  assert.throws(() => allocateClientCredit(advances, "a", 100.26), /saldo a favor/);
  assert.throws(() => allocateClientCredit(advances, "a", 0), /mayor que cero/);
  assert.equal(advances[0].remaining, 40.25);
});
