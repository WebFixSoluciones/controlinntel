import { auth } from "./firebase";
export async function api<T = unknown>(path: string, body?: unknown): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("Inicia sesión para continuar.");
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    cache: "no-store",
    headers: { "Authorization": "Bearer " + await user.getIdToken(), "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "No se pudo completar la operación.");
  return result as T;
}

