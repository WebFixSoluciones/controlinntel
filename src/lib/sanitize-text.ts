/**
 * Limpia y repara caracteres corruptos / mojibake (doble codificación UTF-8 interpretada en Latin-1 / Windows-1252)
 * que afectan textos en español: acentos, eñes, diéresis y signos especiales.
 */
export function cleanMojibake(text: string): string {
  if (!text || typeof text !== "string") return text;

  return text
    // Mayúsculas con tilde y virgulilla
    .replace(/\u00C3\u0161/g, "Ú") // Ãš
    .replace(/\u00C3\u201C/g, "Ó") // Ã“
    .replace(/\u00C3\u2030/g, "É") // Ã‰
    .replace(/\u00C3\u0081/g, "Á") // Ã
    .replace(/\u00C3\u008D/g, "Í") // ÃÍ
    .replace(/\u00C3\u2018/g, "Ñ") // Ã‘
    .replace(/\u00C3\u0153/g, "Ü") // Ãœ
    // Minúsculas con tilde y virgulilla
    .replace(/\u00C3\u00A1/g, "á") // Ã¡
    .replace(/\u00C3\u00A9/g, "é") // Ã©
    .replace(/\u00C3\u00AD/g, "í") // Ã­
    .replace(/\u00C3\u00B3/g, "ó") // Ã³
    .replace(/\u00C3\u00BA/g, "ú") // Ãº
    .replace(/\u00C3\u00B1/g, "ñ") // Ã±
    .replace(/\u00C3\u00BC/g, "ü") // Ã¼
    // Signos especiales
    .replace(/\u00C2\u00B0/g, "°") // Â°
    .replace(/\u00C2\u00BF/g, "¿") // Â¿
    .replace(/\u00C2\u00A1/g, "¡"); // Â¡
}

/**
 * Sanitiza recursivamente cualquier objeto o array de datos
 */
export function sanitizeObjectTexts<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return cleanMojibake(obj) as unknown as T;
  if (Array.isArray(obj)) return obj.map((item) => sanitizeObjectTexts(item)) as unknown as T;
  if (typeof obj === "object") {
    const copy: any = { ...obj };
    for (const key of Object.keys(copy)) {
      copy[key] = sanitizeObjectTexts(copy[key]);
    }
    return copy;
  }
  return obj;
}
