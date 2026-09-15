import {
  collection, doc, onSnapshot, runTransaction, serverTimestamp,
  type DocumentData, type FirestoreError,
} from "firebase/firestore";
import { db } from "./firebase";

export type OperationalCollection =
  | "clients" | "clientServices" | "plans" | "clientProjects"
  | "clientContracts" | "clientQuotes" | "nodes" | "ipPools"
  | "policies" | "tickets" | "expenses" | "monthlyCharges";

// Individual documents prevent one browser from overwriting another's entire state.
export function subscribeRecords(
  name: OperationalCollection,
  receive: (records: DocumentData[]) => void,
  fail: (error: FirestoreError) => void,
) {
  return onSnapshot(collection(db, name), (snapshot) => {
    receive(snapshot.docs.map((record) => ({ ...record.data(), id: record.id })));
  }, fail);
}

export async function createRecord(name: OperationalCollection, data: DocumentData, id = crypto.randomUUID()) {
  const reference = doc(db, name, id);
  await runTransaction(db, async (transaction) => {
    if ((await transaction.get(reference)).exists()) throw new Error("El registro ya existe.");
    transaction.set(reference, { ...data, id, createdAt: serverTimestamp(), version: 1 });
  });
  return id;
}

export async function updateRecord(name: OperationalCollection, id: string, version: number, data: DocumentData) {
  const reference = doc(db, name, id);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) throw new Error("El registro no existe.");
    if (snapshot.data().version !== version) throw new Error("Otro usuario modificó el registro. Actualiza antes de guardar.");
    transaction.update(reference, { ...data, id, version: version + 1, updatedAt: serverTimestamp() });
  });
}
