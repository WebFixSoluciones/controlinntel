export type DocumentArea = "clients" | "arcotel" | "templates";

export function documentArea(path: string): DocumentArea {
  if (path.length > 700 || /[\\\x00-\x1f?#%]/.test(path) || path.split("/").some(part => !part || part === "." || part === "..")) {
    throw new Error("Ruta de archivo inválida.");
  }
  if (/^clients\/[\w-]+\/documents\//.test(path)) return "clients";
  if (/^arcotel\/[\w-]+\/[\w-]+\//.test(path)) return "arcotel";
  if (path.startsWith("templates/")) return "templates";
  throw new Error("Carpeta de archivo no permitida.");
}

export function documentFolder(folder: string) {
  documentArea(`${folder}/archivo`);
  return folder;
}

export function attachmentDisposition(name: string) {
  const safe = name.replace(/["\\\r\n\x00-\x1f]/g, "_").slice(0, 220) || "documento";
  const ascii = safe.replace(/[^\x20-\x7e]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe).replace(/['()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)}`;
}
