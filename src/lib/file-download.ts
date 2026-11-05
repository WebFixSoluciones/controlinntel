import { auth } from "./firebase";

/** Download the real bytes, never generate substitute content with an Office extension. */
export async function openStoredFile(url: string | undefined, fallbackName = "documento") {
  if (!url || url === "#") throw new Error("El registro no tiene el archivo original. Vuelve a cargarlo.");
  const resolved = new URL(url, window.location.origin);
  const privateEndpoint = resolved.origin === window.location.origin && resolved.pathname === "/api/blob/download";
  if (!privateEndpoint && resolved.protocol !== "https:" && resolved.protocol !== "data:") throw new Error("Referencia de archivo no permitida.");
  const headers: Record<string, string> = {};
  if (privateEndpoint) {
    const user = auth.currentUser;
    if (!user) throw new Error("Inicia sesión para descargar el archivo.");
    headers.Authorization = "Bearer " + await user.getIdToken();
  }
  const response = await fetch(resolved.href, { headers, cache: "no-store" });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error || "No se pudo descargar el archivo original.");
  }
  const bytes = await response.arrayBuffer();
  if (!bytes.byteLength) throw new Error("El archivo almacenado está vacío. Vuelve a cargar el original.");
  const expectedHash = privateEndpoint ? response.headers.get("X-Content-SHA256") : null;
  if (expectedHash) {
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))).map(value => value.toString(16).padStart(2, "0")).join("");
    if (hash !== expectedHash) throw new Error("La descarga no está completa. Intenta nuevamente.");
  }
  const blob = new Blob([bytes], { type: response.headers.get("Content-Type") || "application/octet-stream" });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fallbackName;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
}
