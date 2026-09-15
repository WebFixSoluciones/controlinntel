import {
  browserLocalPersistence, browserSessionPersistence, setPersistence,
  signInWithEmailAndPassword, signOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import type { UserProfile, UserRole, SystemPermission } from "@/types";

const roles: UserRole[] = ["superadmin", "admin", "finanzas", "tecnico", "soporte", "legal", "consulta"];
const permissions: SystemPermission[] = ["all", "manage_users", "manage_vault", "manage_clients", "manage_network", "manage_tickets", "manage_finance", "manage_policies", "export_reports"];

export async function loadFirebaseProfile(uid: string): Promise<UserProfile> {
  const snapshot = await getDoc(doc(db, "users", uid));
  const data = snapshot.data();
  if (!data || data.status !== "activo" || !roles.includes(data.role) ||
      typeof data.email !== "string" || typeof data.displayName !== "string" ||
      !Array.isArray(data.permissions) || !data.permissions.every((p: SystemPermission) => permissions.includes(p))) {
    throw new Error("La cuenta no tiene un perfil activo autorizado.");
  }
  // Explicit projection: never pass password fields from old documents into UI state.
  return {
    uid, email: data.email, displayName: data.displayName, role: data.role,
    status: "activo", permissions: data.permissions,
  };
}

export async function loginFirebase(email: string, password: string, remember = false): Promise<UserProfile> {
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  try {
    return await loadFirebaseProfile(credential.user.uid);
  } catch (error) {
    await signOut(auth);
    throw error;
  }
}

export const logoutFirebase = () => signOut(auth);
