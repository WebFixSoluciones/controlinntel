import type { Firestore, Transaction } from "firebase-admin/firestore";
import type { UserProfile } from "@/types";
import { recordOperation } from "./operation-log.ts";

const sequencePath = "sequences/supportTickets";
const batchSize = 75;
const ticketSerial = (number: unknown) => Number(/^TK-(\d{3,})$/.exec(String(number || ""))?.[1] || 0);
const formatTicket = (serial: number) => `TK-${String(serial).padStart(3, "0")}`;

export async function nextTicketNumber(db: Firestore, tx: Transaction) {
  const counter = db.doc(sequencePath);
  const previous = (await tx.get(counter)).data();
  let serial = Number(previous?.value || 0);
  if (!previous) {
    const tickets = await tx.get(db.collection("tickets").select("ticketNumber"));
    for (const doc of tickets.docs) serial = Math.max(serial, ticketSerial(doc.data().ticketNumber));
  }
  tx.set(counter, { value: serial + 1 }, { merge: true });
  return formatTicket(serial + 1);
}

export async function numberHistoricalTickets(db: Firestore, user: UserProfile) {
  return db.runTransaction(async tx => {
    const counter = db.doc(sequencePath);
    const previous = (await tx.get(counter)).data();
    const tickets = await tx.get(db.collection("tickets").select("ticketNumber", "createdAt"));
    const historical = tickets.docs.filter(doc => !ticketSerial(doc.data().ticketNumber))
      .sort((a, b) => String(a.data().createdAt || "").localeCompare(String(b.data().createdAt || "")) || a.id.localeCompare(b.id));
    if (!historical.length) return { updated: 0, remaining: 0 };
    let serial = Number(previous?.value || 0);
    for (const doc of tickets.docs) serial = Math.max(serial, ticketSerial(doc.data().ticketNumber));
    const selected = historical.slice(0, batchSize);
    const originals = await tx.getAll(...selected.map(doc => doc.ref));
    const now = new Date().toISOString();
    for (const original of originals) {
      const old = original.data()!;
      const patch = { ticketNumber: formatTicket(++serial),
        ...(old.ticketNumber ? { previousTicketNumber: old.ticketNumber } : {}),
        updatedAt: now, version: Number(old.version || 0) + 1 };
      tx.update(original.ref, patch);
      recordOperation(tx, db, user, "NUMBER_HISTORICAL_TICKET", [
        { collection: "tickets", id: original.id, beforeVersion: old.version ?? null, after: { ...old, ...patch } },
      ]);
    }
    tx.set(counter, { value: serial }, { merge: true });
    return { updated: selected.length, remaining: historical.length - selected.length };
  });
}
