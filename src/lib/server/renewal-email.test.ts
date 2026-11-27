import test from "node:test";
import assert from "node:assert/strict";
import type { DocumentData, Firestore } from "firebase-admin/firestore";
import { Database } from "./testing/commercial-database.ts";
import { readRenewalReminderHistory, runScheduledRenewalReminders } from "./renewal-email.ts";
import type { SendEmailInput } from "./email-delivery.ts";

const now = () => new Date("2026-11-26T13:00:00Z");
const historyCollection = "renewalReminderEvents";
const service = { id: "service", clientId: "client", planName: "Dominio empresarial", status: "activo", nextRenewalDate: "2026-12-11" };
const client = { id: "client", businessName: "Cliente QA", status: "activo", email: "client@example.test" };
const config = {
  id: "sri-config-inntel", emailEnabled: true, emailHost: "smtp.example.test", emailUser: "sender@example.test",
  emailFrom: "sender@example.test", emailNotifyCompany: true, emailCopyTo: "internal@example.test",
};

class RenewalDatabase extends Database {
  doc(path: string) {
    const ref = super.doc(path);
    return { ...ref, get: async () => {
      const data = this.rows.get(path);
      return { ...ref, exists: Boolean(data), data: () => structuredClone(data) };
    } };
  }

  collection(name: string): any {
    const query = (field?: string, value?: unknown, sort?: string, descending = false, limit?: number): any => ({
      name, field, value,
      doc: (id: string) => this.doc(name + "/" + id),
      where: (key: string, _op: string, equals: unknown) => query(key, equals, sort, descending, limit),
      select: () => query(field, value, sort, descending, limit),
      orderBy: (key: string, order: string) => query(field, value, key, order === "desc", limit),
      limit: (count: number) => query(field, value, sort, descending, count),
      get: async () => {
        const rows = this.list(name).filter(row => !field || row[field] === value);
        if (sort) rows.sort((a, b) => String(a[sort]).localeCompare(String(b[sort])) * (descending ? -1 : 1));
        return { docs: rows.slice(0, limit).map(row => ({ id: row.id, ref: this.doc(name + "/" + row.id), data: () => structuredClone(row) })) };
      },
    });
    return query();
  }
}

function fixture(services: DocumentData[] = [service], clients: DocumentData[] = [client]) {
  return new RenewalDatabase({
    clientServices: services, clients, sriCompanyConfig: [config], sriSecrets: [{ id: "email", password: "only-in-memory" }],
  });
}

function job(db: RenewalDatabase, send?: (input: SendEmailInput) => Promise<{ messageId: string; accepted: string[]; rejected: string[] }>, options: {
  enabled?: boolean; dryRun?: boolean; offsets?: string; now?: () => Date;
} = {}) {
  return runScheduledRenewalReminders({ enabled: true, ...options }, {
    db: db as unknown as Firestore,
    now: options.now ?? now,
    send: send ?? (async input => ({ messageId: "accepted-in-memory", accepted: input.to, rejected: [] })),
  });
}

test("renewal email is opt-in, and dry runs perform no writes or delivery", async () => {
  const db = fixture();
  const before = structuredClone(db.rows);
  const noSend = async () => { assert.fail("dry run called SMTP"); };
  const disabled = await job(db, noSend, { enabled: false });
  assert.equal(disabled.mode, "disabled");
  assert.equal(disabled.due, 0);
  const dry = await job(db, noSend, { enabled: false, dryRun: true });
  assert.equal(dry.mode, "dry-run");
  assert.equal(dry.wouldSend, 1);
  assert.deepEqual(db.rows, before);
});

test("renewal email applies Ecuador dates, configured offsets and service advance days without duplicating equal milestones", async () => {
  const db = fixture([
    { ...service, id: "both-dates", contractEndDate: "2026-12-11" },
    { ...service, id: "advance-day", nextRenewalDate: "2026-12-01", advanceNoticeDay: 26 },
    { ...service, id: "next-cycles", nextRenewalDate: "2026-12-11", contractEndDate: "2027-12-31" },
    { ...service, id: "after-contract", contractEndDate: "2026-12-01" },
    { ...service, id: "not-due", nextRenewalDate: "2026-12-10" },
    { ...service, id: "inactive", status: "suspendido" },
    { ...service, id: "not-started", contractStartDate: "2026-11-27" },
  ]);
  const result = await job(db, undefined, { now: () => new Date("2026-11-27T02:00:00Z"), offsets: "15,1,15" });
  assert.equal(result.date, "2026-11-26");
  assert.equal(result.accepted, 3);
  assert.deepEqual(db.list(historyCollection).map(event => [event.serviceId, event.kind, event.targetDate, event.scheduledDate, event.offsetDays]).sort(), [
    ["advance-day", "cycle_renewal", "2026-12-01", "2026-11-26", 5],
    ["both-dates", "contract_expiration", "2026-12-11", "2026-11-26", 15],
    ["next-cycles", "cycle_renewal", "2026-12-11", "2026-11-26", 15],
  ]);
});

test("concurrent runs claim a renewal once and send privately to the current client", async () => {
  const db = fixture();
  let reportStarted!: (message: SendEmailInput) => void;
  const started = new Promise<SendEmailInput>(resolve => { reportStarted = resolve; });
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const first = job(db, async input => {
    reportStarted(input);
    await held;
    return { messageId: "accepted-in-memory", accepted: input.to, rejected: [] };
  });
  const message = await started;
  try {
    assert.deepEqual(message.to, ["client@example.test"]);
    assert.equal(message.cc, undefined);
    assert.equal(message.bcc, undefined);
    assert.match(message.text, /Dominio empresarial/);
    assert.match(message.text, /11\/12\/2026/);
    assert.doesNotMatch(message.text, /factura|only-in-memory/i);
    const overlap = await job(db, async () => { assert.fail("concurrent run sent a duplicate"); });
    assert.equal(overlap.existing, 1);
  } finally {
    release();
  }
  const result = await first;
  assert.equal(result.accepted, 1);
  const [event] = db.list(historyCollection);
  assert.equal(event.status, "accepted");
  assert.equal(event.messageId, "accepted-in-memory");
  assert.doesNotMatch(JSON.stringify(event), /client@example\.test|only-in-memory/);
  const history = await readRenewalReminderHistory(db as unknown as Firestore);
  assert.deepEqual(history, [{
    id: event.id, clientId: "client", serviceId: "service", kind: "cycle_renewal", targetDate: "2026-12-11",
    scheduledDate: "2026-11-26", offsetDays: 15, updatedAt: now().toISOString(), status: "accepted",
  }]);
});

test("unconfirmed or rejected deliveries remain reviewable and never repeat automatically", async () => {
  const db = fixture([{ ...service, id: "uncertain" }, { ...service, id: "rejected", clientId: "second" }], [
    client, { ...client, id: "second", email: "reject@example.test" },
  ]);
  const first = await job(db, async input => {
    if (input.to[0] === client.email) throw Error("connection interrupted after SMTP DATA");
    return { messageId: "", accepted: [], rejected: input.to };
  });
  assert.equal(first.unconfirmed, 1);
  assert.equal(first.failed, 1);
  assert.deepEqual(db.list(historyCollection).map(event => [event.status, event.reason]).sort(), [
    ["failed", "smtp_rejected"], ["unconfirmed", "smtp_unconfirmed"],
  ]);
  const repeated = await job(db, async () => { assert.fail("terminal delivery was retried"); });
  assert.equal(repeated.existing, 2);
});

test("an interrupted claim is marked unconfirmed after expiry without resending", async () => {
  const db = fixture();
  const first = await job(db, async input => {
    db.failCommit = true;
    return { messageId: "accepted-in-memory", accepted: input.to, rejected: [] };
  });
  assert.equal(first.failed, 1);
  assert.equal(db.list(historyCollection)[0].status, "processing");
  db.failCommit = false;
  const later = await job(db, async () => { assert.fail("interrupted claim was delivered twice"); }, {
    now: () => new Date("2026-11-27T13:00:00Z"),
  });
  assert.equal(later.unconfirmed, 1);
  assert.equal(db.list(historyCollection)[0].reason, "processing_expired");
});

test("inactive clients and malformed or multiple recipient addresses are recorded as skipped", async () => {
  const db = fixture([
    { ...service, id: "inactive", clientId: "inactive" },
    { ...service, id: "missing", clientId: "missing" },
    { ...service, id: "bad-email", clientId: "bad-email" },
  ], [
    { ...client, id: "inactive", status: "retirado" },
    { ...client, id: "bad-email", email: "one@example.test,two@example.test" },
  ]);
  const result = await job(db, async () => { assert.fail("ineligible customer received a message"); });
  assert.equal(result.skipped, 3);
  assert.deepEqual(db.list(historyCollection).map(event => event.reason).sort(), [
    "client_inactive", "client_missing", "email_invalid",
  ]);
});
