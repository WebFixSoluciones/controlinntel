import test from "node:test";
import assert from "node:assert/strict";
import { getRecurringRunSummary, getRenewalAlerts } from "./renewal-alerts.ts";

const clients = [{ id: "client", businessName: "Cliente Demo", status: "activo" as const }];
const service = { id: "service", clientId: "client", planName: "Internet", status: "activo" as const };

test("keeps overdue, same-day and 15-day deadlines ordered by urgency", () => {
  const alerts = getRenewalAlerts(clients, [
    { ...service, id: "later", nextRenewalDate: "2026-12-17" },
    { ...service, id: "boundary", contractEndDate: "2026-12-16" },
    { ...service, id: "today", status: "por_renovar", nextRenewalDate: "2026-12-01" },
    { ...service, id: "overdue", contractEndDate: "2026-11-29" },
  ], "2026-12-01");

  assert.deepEqual(alerts.map(({ serviceId, deadlines }) => [serviceId, deadlines[0].daysRemaining]), [
    ["overdue", -2], ["today", 0], ["boundary", 15],
  ]);
});

test("distinguishes the contract end from the renewal date on the same service", () => {
  const [alert] = getRenewalAlerts(clients, [
    { ...service, nextRenewalDate: "2026-12-04", contractEndDate: "2026-12-05" },
  ], "2026-12-01");

  assert.deepEqual(alert, {
    serviceId: "service", clientId: "client", clientName: "Cliente Demo", serviceName: "Internet",
    deadlines: [
      { kind: "renewal", date: "2026-12-04", daysRemaining: 3 },
      { kind: "contractEnd", date: "2026-12-05", daysRemaining: 4 },
    ],
  });
});

test("excludes closed services, unavailable clients and invalid deadlines", () => {
  const retiredClient = { ...clients[0], id: "retired", status: "retirado" as const };
  const alerts = getRenewalAlerts([...clients, retiredClient], [
    { ...service, id: "retired-service", status: "retirado", nextRenewalDate: "2026-12-03" },
    { ...service, id: "inactive-service", status: "inactivo", nextRenewalDate: "2026-12-03" },
    { ...service, id: "suspended-service", status: "suspendido", nextRenewalDate: "2026-12-03" },
    { ...service, id: "retired-client", clientId: "retired", nextRenewalDate: "2026-12-03" },
    { ...service, id: "unknown-client", clientId: "missing", nextRenewalDate: "2026-12-03" },
    { ...service, id: "invalid", nextRenewalDate: "2026-02-31" },
  ], "2026-12-01");

  assert.deepEqual(alerts, []);
});

test("the scheduled run summary omits account details and failure messages", () => {
  const run = {
    date: "2026-12-01", status: "partial", issued: 4, reviewCount: 2,
    failures: [{ clientId: "client", error: "Private accounting details" }],
    completedAt: "2026-12-01T05:22:00Z",
  };

  assert.deepEqual(getRecurringRunSummary(run), {
    date: "2026-12-01", status: "partial", issued: 4, reviewCount: 2, failureCount: 1,
  });
  assert.equal(getRecurringRunSummary({ ...run, status: "invalid" }), null);
});
