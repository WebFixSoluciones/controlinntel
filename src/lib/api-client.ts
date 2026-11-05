import { auth } from "./firebase";
import { ApiError } from "./api-error";
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
  if (!response.ok) throw new ApiError(result.error || "No se pudo completar la operación.", response.status, Array.isArray(result.fieldErrors) ? result.fieldErrors : []);
  return result as T;
}

