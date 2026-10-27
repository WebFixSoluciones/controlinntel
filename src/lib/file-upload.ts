/**
 * Política de carga de archivos para expedientes de cliente.
 *
 * Reglas:
 *  - Se admite cualquier tipo de documento, incluidos certificados (.p12, .pfx, .pem).
 *  - Solo se bloquean ejecutables y scripts.
 *  - Tope duro de 15 MB por archivo (límite del endpoint de carga).
 *  - Las imágenes por encima del umbral se optimizan en el navegador antes de subir.
 */

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const IMAGE_COMPRESS_THRESHOLD = 1.5 * 1024 * 1024;
export const IMAGE_MAX_SIDE = 2000;
export const IMAGE_QUALITY = 0.82;

/** Ejecutables, scripts y documentos activos: no se aceptan aunque el usuario los arrastre. */
export const BLOCKED_EXTENSIONS = new Set([
  "exe", "bat", "cmd", "sh", "msi", "vbs", "ps1", "scr", "jar", "bin", "com", "dll",
  "html", "htm", "xhtml",
]);

/** Firmas que nunca deben ofrecerse como descarga directa desde el navegador. */
export const NON_INLINE_EXTENSIONS = new Set(["html", "htm", "svg", "xhtml", "js", "mjs"]);

export type UploadKind = "imagen" | "pdf" | "certificado" | "otro";

export interface UploadPlan {
  ok: boolean;
  kind: UploadKind;
  /** true si conviene optimizar la imagen antes de subir. */
  compress: boolean;
  /** Motivo accionable cuando ok es false. */
  reason?: string;
}

export function extensionOf(name: string): string {
  const clean = String(name || "").trim().toLowerCase();
  const dot = clean.lastIndexOf(".");
  return dot > -1 ? clean.slice(dot + 1) : "";
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function planUpload(input: { name: string; size: number; type?: string }): UploadPlan {
  const name = String(input.name || "");
  const size = Number(input.size || 0);
  const type = String(input.type || "");
  const extension = extensionOf(name);

  if (!name.trim()) {
    return { ok: false, kind: "otro", compress: false, reason: "El archivo no tiene nombre válido." };
  }
  if (!Number.isFinite(size) || size <= 0) {
    return { ok: false, kind: "otro", compress: false, reason: "El archivo está vacío." };
  }
  if (BLOCKED_EXTENSIONS.has(extension)) {
    return {
      ok: false,
      kind: "otro",
      compress: false,
      reason: `Por seguridad no se admiten archivos .${extension}. Sube un documento, una imagen o un certificado.`,
    };
  }
  if (size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      kind: "otro",
      compress: false,
      reason: `El archivo pesa ${formatBytes(size)} y el máximo es ${formatBytes(MAX_UPLOAD_BYTES)}.`,
    };
  }

  const isImage = type.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "bmp", "gif"].includes(extension);
  const isPdf = type === "application/pdf" || extension === "pdf";
  const isCertificate = ["p12", "pfx", "pem", "cer", "crt", "key"].includes(extension);

  let kind: UploadKind = "otro";
  if (isCertificate) kind = "certificado";
  else if (isImage) kind = "imagen";
  else if (isPdf) kind = "pdf";

  return {
    ok: true,
    kind,
    compress: isImage && size > IMAGE_COMPRESS_THRESHOLD,
  };
}

/**
 * Optimiza una imagen en el navegador antes de subirla.
 * No toca PDF ni certificados: devuelve el archivo original en esos casos.
 * Si el navegador no permite procesar la imagen, también devuelve el original.
 */
export async function compressImageFile(file: File): Promise<File> {
  if (typeof document === "undefined" || typeof createImageBitmap !== "function") return file;
  if (!String(file.type || "").startsWith("image/")) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((result) => resolve(result), "image/jpeg", IMAGE_QUALITY)
    );
    if (!blob || blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^/.]+$/, "");
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}
