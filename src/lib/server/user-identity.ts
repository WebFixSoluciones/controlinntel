import type { Auth } from "firebase-admin/auth";

export async function syncUserIdentity(auth: Pick<Auth, "updateUser" | "revokeRefreshTokens">, uid: string, profile: { status?: string; displayName: string }, password?: string) {
  await auth.updateUser(uid, { disabled: profile.status !== "activo", displayName: profile.displayName, ...(password ? { password } : {}) });
  if (profile.status !== "activo" || password) await auth.revokeRefreshTokens(uid);
}
