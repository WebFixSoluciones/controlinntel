import type { DocumentData, Firestore } from "firebase-admin/firestore";
import { z } from "zod";
import type { ClientService } from "@/types";
import { addDays, dateOnDay, validDate } from "../commercial-core.ts";
import { addMonthsSafely, diffInCalendarDays, formatDateEC, getEcuadorDate } from "../date-utils.ts";
import { adminServices } from "./admin.ts";
import {
  emailSettingsFromConfig, isEmailSettingsComplete, readEmailPassword, sendEmailDetailed, SmtpDeliveryError,
  type EmailSettings,
} from "./email-delivery.ts";
import { digest } from "./operation-log.ts";
import { readSriCompanyConfig } from "./sri-secrets.ts";

const collection = "renewalReminderEvents";
const defaultOffsets = [15, 7, 1];
const claimTimeoutMs = 120_000;
const maxConcurrentDeliveries = 4;
const email = z.string().trim().max(254).email();

type RenewalKind = "contract_expiration" | "cycle_renewal";
type Status = "processing" | "accepted" | "unconfirmed" | "failed" | "skipped";
type SkipReason = "client_missing" | "client_inactive" | "email_invalid";
type Reason = SkipReason | "smtp_rejected" | "smtp_unconfirmed" | "processing_expired";

interface RenewalReminder {
  id: string;
  serviceId: string;
  clientId: string;
  kind: RenewalKind;
  targetDate: string;
  scheduledDate: string;
  offsetDays: number;
}

export interface RenewalReminderHistoryEntry extends RenewalReminder {
  status: Status;
  updatedAt: string;
  reason?: Reason;
}

interface RenewalRun {
  date: string;
  mode: "disabled" | "dry-run" | "live";
  due: number;
  wouldSend: number;
  accepted: number;
  unconfirmed: number;
  failed: number;
  skipped: number;
  existing: number;
  smtp: "not-checked" | "disabled" | "incomplete" | "missing-password" | "ready";
}

function reminderOffsets(configured?: string) {
  if (configured === undefined) return defaultOffsets;
  const offsets = configured.split(",").map(value => Number(value.trim()));
  if (offsets.some(days => !Number.isInteger(days) || days < 1 || days > 60)) {
    throw new Error("RENEWAL_EMAIL_OFFSETS debe contener plazos de 1 a 60 días separados por comas.");
  }
  return [...new Set(offsets)];
}

function schedule(serviceId: string, service: Partial<ClientService>, today: string, offsets: number[]): RenewalReminder[] {
  const { clientId, status, contractEndDate, nextRenewalDate } = service;
  if (status !== "activo" || typeof clientId !== "string" || !clientId.trim() || clientId.includes("/")) return [];
  const start = service.contractStartDate || service.installationDate;
  if (start && validDate(start) && start > today) return [];

  const targets: { kind: RenewalKind; targetDate: string }[] = [];
  const endDate = typeof contractEndDate === "string" && validDate(contractEndDate) ? contractEndDate : "";
  if (endDate) targets.push({ kind: "contract_expiration", targetDate: endDate });
  if (typeof nextRenewalDate === "string" && validDate(nextRenewalDate) && (!endDate || nextRenewalDate < endDate)) {
    targets.push({ kind: "cycle_renewal", targetDate: nextRenewalDate });
  }

  const advanceDay = Number(service.advanceNoticeDay);
  const hasAdvanceDay = Number.isInteger(advanceDay) && advanceDay >= 1 && advanceDay <= 31;
  return targets.flatMap(({ kind, targetDate }) => {
    if (targetDate <= today) return [];
    let daysBefore = offsets;
    if (hasAdvanceDay) {
      let notice = dateOnDay(targetDate, advanceDay);
      if (notice >= targetDate) notice = dateOnDay(addMonthsSafely(targetDate, -1), advanceDay);
      daysBefore = [diffInCalendarDays(notice, targetDate)];
    }
    return daysBefore.filter(offsetDays => addDays(targetDate, -offsetDays) === today).map(offsetDays => ({
      id: digest([serviceId, targetDate, offsetDays]),
      serviceId, clientId, kind, targetDate, scheduledDate: today, offsetDays,
    }));
  });
}

type Contact = { recipient: string; name: string } | { reason: SkipReason };

function contact(client?: DocumentData): Contact {
  if (!client) return { reason: "client_missing" };
  if (client.status !== "activo") return { reason: "client_inactive" };
  const recipient = email.safeParse(client.email);
  if (!recipient.success) return { reason: "email_invalid" };
  return { recipient: recipient.data, name: typeof client.businessName === "string" ? client.businessName.trim() : "" };
}

async function expireClaims(db: Firestore, now: () => Date) {
  const snapshot = await db.collection(collection).where("status", "==", "processing").get();
  let expired = 0;
  for (const candidate of snapshot.docs) {
    if (candidate.data().leaseUntil > now().getTime()) continue;
    const updated = await db.runTransaction(async transaction => {
      const current = (await transaction.get(candidate.ref)).data();
      const timestamp = now();
      if (current?.status !== "processing" || current.leaseUntil > timestamp.getTime()) return false;
      // A terminated worker may have reached SMTP DATA. Close the claim for operator review.
      transaction.update(candidate.ref, { status: "unconfirmed", reason: "processing_expired", updatedAt: timestamp.toISOString(), leaseUntil: null });
      return true;
    });
    if (updated) expired++;
  }
  return expired;
}

type Attempt = "accepted" | "unconfirmed" | "failed" | "skipped" | "existing";
type DeliveryOutcome =
  | { status: "accepted"; messageId?: string }
  | { status: "failed"; reason: "smtp_rejected" }
  | { status: "unconfirmed"; reason: "smtp_unconfirmed" };

async function deliverReminder(
  db: Firestore, reminder: RenewalReminder, offsets: number[], now: () => Date,
  smtp: { settings: EmailSettings; password: string; companyName: string; send: typeof sendEmailDetailed },
): Promise<Attempt> {
  const eventRef = db.collection(collection).doc(reminder.id);
  const serviceRef = db.collection("clientServices").doc(reminder.serviceId);
  const clientRef = db.collection("clients").doc(reminder.clientId);
  const claim = await db.runTransaction(async transaction => {
    const event = await transaction.get(eventRef);
    if (event.exists) return { status: "existing" as const };

    const service = (await transaction.get(serviceRef)).data() as Partial<ClientService> | undefined;
    const stillDue = service && schedule(reminder.serviceId, service, reminder.scheduledDate, offsets)
      .some(item => item.id === reminder.id && item.clientId === reminder.clientId && item.kind === reminder.kind);
    if (!service || !stillDue) return { status: "skipped" as const };

    const recipient = contact((await transaction.get(clientRef)).data());
    const timestamp = now();
    const record = { ...reminder, updatedAt: timestamp.toISOString() };
    if ("reason" in recipient) {
      transaction.create(eventRef, { ...record, status: "skipped", reason: recipient.reason });
      return { status: "skipped" as const };
    }
    transaction.create(eventRef, { ...record, status: "processing", leaseUntil: timestamp.getTime() + claimTimeoutMs });
    return { status: "processing" as const, ...recipient, plan: service.planName || "servicio contratado" };
  });
  if (claim.status !== "processing") return claim.status;

  const contract = reminder.kind === "contract_expiration";
  const date = formatDateEC(reminder.targetDate);
  const subject = contract ? "Recordatorio de vencimiento de contrato" : "Recordatorio de renovación de servicio";
  const notice = contract
    ? `El contrato del servicio «${claim.plan}» vence el ${date}.`
    : `La próxima fecha de renovación del servicio «${claim.plan}» es el ${date}.`;
  let outcome: DeliveryOutcome;
  try {
    const receipt = await smtp.send({
      settings: smtp.settings,
      password: smtp.password,
      to: [claim.recipient],
      subject,
      text: [claim.name ? `Hola, ${claim.name}:` : "Hola:", "", notice, "", "Si necesitas revisar tu renovación, responde a este correo.", "", smtp.companyName].join("\n"),
    });
    const recipient = claim.recipient.toLowerCase();
    if (receipt.rejected.includes(recipient)) {
      outcome = { status: "failed", reason: "smtp_rejected" };
    } else if (receipt.accepted.includes(recipient)) {
      outcome = { status: "accepted", ...(receipt.messageId ? { messageId: receipt.messageId } : {}) };
    } else {
      outcome = { status: "unconfirmed", reason: "smtp_unconfirmed" };
    }
  } catch (error) {
    outcome = error instanceof SmtpDeliveryError && error.rejected
      ? { status: "failed", reason: "smtp_rejected" }
      : { status: "unconfirmed", reason: "smtp_unconfirmed" };
  }

  return db.runTransaction(async transaction => {
    const event = (await transaction.get(eventRef)).data();
    if (event?.status !== "processing") return "existing";
    transaction.update(eventRef, { ...outcome, updatedAt: now().toISOString(), leaseUntil: null });
    return outcome.status;
  });
}

export async function runScheduledRenewalReminders(
  options: { enabled: boolean; dryRun?: boolean; offsets?: string },
  dependencies: { db?: Firestore; now?: () => Date; send?: typeof sendEmailDetailed } = {},
): Promise<RenewalRun> {
  const now = dependencies.now ?? (() => new Date());
  const date = getEcuadorDate(now());
  const mode = options.dryRun ? "dry-run" : options.enabled ? "live" : "disabled";
  const result: RenewalRun = {
    date, mode, due: 0, wouldSend: 0, accepted: 0, unconfirmed: 0, failed: 0, skipped: 0, existing: 0, smtp: "not-checked",
  };
  if (mode === "disabled") return result;

  const offsets = reminderOffsets(options.offsets);
  const db = dependencies.db ?? adminServices().db;
  if (mode === "live") result.unconfirmed = await expireClaims(db, now);
  const active = await db.collection("clientServices").where("status", "==", "activo")
    .select("status", "clientId", "contractStartDate", "installationDate", "contractEndDate", "nextRenewalDate", "advanceNoticeDay").get();
  const reminders = active.docs.flatMap(doc => schedule(doc.id, doc.data() as Partial<ClientService>, date, offsets));
  result.due = reminders.length;
  if (!reminders.length) return result;

  if (mode === "dry-run") {
    for (const reminder of reminders) {
      const existing = await db.collection(collection).doc(reminder.id).get();
      if (existing.exists) {
        result.existing++;
      } else {
        const client = await db.collection("clients").doc(reminder.clientId).get();
        result["reason" in contact(client.data()) ? "skipped" : "wouldSend"]++;
      }
    }
    return result;
  }

  const config = await readSriCompanyConfig(db);
  const settings = emailSettingsFromConfig(config);
  if (!settings.enabled) return { ...result, smtp: "disabled" };
  if (!isEmailSettingsComplete(settings) || !email.safeParse(settings.fromEmail).success) {
    return { ...result, smtp: "incomplete", failed: 1 };
  }
  const password = await readEmailPassword(db);
  if (!password) return { ...result, smtp: "missing-password", failed: 1 };
  const smtp = {
    settings, password, companyName: config.nombreComercial || config.razonSocial || "INNTEL CORP",
    send: dependencies.send ?? sendEmailDetailed,
  };
  result.smtp = "ready";
  for (let index = 0; index < reminders.length; index += maxConcurrentDeliveries) {
    const outcomes = await Promise.allSettled(
      reminders.slice(index, index + maxConcurrentDeliveries).map(reminder => deliverReminder(db, reminder, offsets, now, smtp)),
    );
    for (const outcome of outcomes) result[outcome.status === "fulfilled" ? outcome.value : "failed"]++;
  }
  return result;
}

export async function readRenewalReminderHistory(db: Firestore = adminServices().db): Promise<RenewalReminderHistoryEntry[]> {
  const snapshot = await db.collection(collection).orderBy("updatedAt", "desc").limit(100).get();
  return snapshot.docs.map(doc => {
    const { serviceId, clientId, kind, targetDate, scheduledDate, offsetDays, status, updatedAt, reason } = doc.data();
    return { id: doc.id, serviceId, clientId, kind, targetDate, scheduledDate, offsetDays, status, updatedAt, ...(reason ? { reason } : {}) };
  });
}
