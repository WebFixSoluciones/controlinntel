import { auth } from "./firebase";

export async function uploadStoredFile(file: File, folder: string): Promise<{ url: string; size: number; sha256: string }> {
  const user = auth.currentUser;
  if (!user) throw new Error("Inicia sesión para cargar archivos.");
  const form = new FormData();
  form.append("file", file); form.append("folder", folder);
  const response = await fetch("/api/blob/upload", {
    method: "POST", headers: { Authorization: "Bearer " + await user.getIdToken() }, body: form,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.url) throw new Error(result.error || "No se pudo cargar el archivo original.");
  return result;
}
