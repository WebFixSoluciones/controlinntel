import { auth } from "./firebase";

/**
 * Abre o descarga un archivo del expediente.
 *
 * Los documentos de cliente viven en blobs privados y se sirven por
 * /api/blob/download, que exige un ID token. Por eso no se puede usar un <a href>
 * directo: se descarga con cabecera Authorization y se abre el objeto resultante.
 */
export async function openStoredFile(url: string | undefined, fallbackName = "documento") {
  if (!url) throw new Error("El registro no tiene archivo asociado.");

  const isPrivateEndpoint = url.startsWith("/api/blob/download");
  if (!isPrivateEndpoint) {
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) throw new Error("El navegador bloqueó la ventana emergente.");
    return;
  }

  const user = auth.currentUser;
  if (!user) throw new Error("Inicia sesión para descargar el archivo.");

  const response = await fetch(url, {
    headers: { Authorization: "Bearer " + (await user.getIdToken()) },
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error || "No se pudo descargar el archivo.");
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = match?.[1] || fallbackName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
}
