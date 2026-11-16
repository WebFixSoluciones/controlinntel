import { auth } from "./firebase";
import { ApiError } from "./api-error";
import { descargarXmlArchivo } from "./sri-service";
import type { FiscalKind } from "./server/sri-documents";
export async function api<T = unknown>(path: string, body?: unknown, method?: "DELETE"): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("Inicia sesión para continuar.");
  const response = await fetch(path, {
    method: method || (body === undefined ? "GET" : "POST"),
    cache: "no-store",
    headers: { "Authorization": "Bearer " + await user.getIdToken(), "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok) throw new ApiError(result.error || "No se pudo completar la operación.", response.status, Array.isArray(result.fieldErrors) ? result.fieldErrors : []);
  return result as T;
}

export async function downloadAuthorizedFiscalXml(kind: FiscalKind, id: string, documentNumber: string) {
  const params = new URLSearchParams({ kind, id });
  const { xml } = await api<{ xml: string }>(`/api/sri/emitir?${params}`);
  descargarXmlArchivo(xml, `SRI-${documentNumber}.xml`);
}

export async function authorizedFiscalPdf(kind: FiscalKind, id: string, signal?: AbortSignal): Promise<Blob> {
  const user = auth.currentUser;
  if (!user) throw new Error("Inicia sesión para continuar.");
  const query = new URLSearchParams({ kind, id, format: "pdf", encoding: "base64" });
  const response = await fetch(`/api/sri/emitir?${query}`, { signal, cache: "no-store", headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
  if (!response.ok) { const result = await response.json(); throw new ApiError(result.error || "No se pudo cargar el PDF autorizado.", response.status); }
  const result = await response.json();
  if (typeof result.data !== "string" || !result.data.startsWith("JVBERi0")) throw new Error("El servidor no devolvió un PDF válido.");
  return new Blob([Uint8Array.from(atob(result.data), char => char.charCodeAt(0))], { type: "application/pdf" });
}

