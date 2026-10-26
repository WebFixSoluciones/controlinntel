/**
 * Utilidades de fecha libres de desplazamientos por zona horaria UTC (Ecuador UTC-5)
 * Soluciona P1-07: new Date().toISOString().slice(0,10) generaba fecha de mañana después de las 19h00.
 */

const ECUADOR_TZ = "America/Guayaquil";

/**
 * Obtiene la fecha de hoy o de un timestamp en formato "YYYY-MM-DD" en la zona horaria de Ecuador.
 */
export function getEcuadorDate(dateInput: Date | string | number = new Date()): string {
  const date = typeof dateInput === "string" && !dateInput.includes("T") && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)
    ? parseLocalDate(dateInput)
    : new Date(dateInput);

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  // Usar Intl.DateTimeFormat para garantizar la fecha precisa de Ecuador (UTC-5)
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: ECUADOR_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(date); // Retorna formato ISO YYYY-MM-DD
}

/**
 * Parsea un string YYYY-MM-DD en fecha local sin corrimiento de hora
 */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = (dateStr || "").split("-").map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d, 12, 0, 0, 0); // Mediodía para evitar cualquier desplazamiento
}

/**
 * Añade meses de forma segura a una fecha YYYY-MM-DD evitando desbordes (ej. 31 Enero + 1 mes -> 28/29 Feb)
 */
export function addMonthsSafely(dateStr: string, months: number): string {
  const [year, month, day] = (dateStr || getEcuadorDate()).split("-").map(Number);
  const targetMonthIndex = (month - 1) + months;
  
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12; // 0 a 11
  
  // Días máximos del mes destino
  const daysInTargetMonth = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  const adjustedDay = Math.min(day, daysInTargetMonth);
  
  const yStr = String(targetYear).padStart(4, "0");
  const mStr = String(normalizedMonth + 1).padStart(2, "0");
  const dStr = String(adjustedDay).padStart(2, "0");
  
  return `${yStr}-${mStr}-${dStr}`;
}

/**
 * Calcula la diferencia exacta en días de calendario entre dos fechas YYYY-MM-DD
 */
export function diffInCalendarDays(dateFrom: string, dateTo: string): number {
  const [y1, m1, d1] = dateFrom.split("-").map(Number);
  const [y2, m2, d2] = dateTo.split("-").map(Number);
  
  const utc1 = Date.UTC(y1, (m1 || 1) - 1, d1 || 1);
  const utc2 = Date.UTC(y2, (m2 || 1) - 1, d2 || 1);
  
  return Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24));
}

/**
 * Formato amigable de fecha para visualización en Ecuador: "23 oct 2026" o "23/10/2026"
 */
export function formatDateEC(dateStr: string, style: "short" | "human" = "short"): string {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("T")[0].split("-");
  if (!y || !m || !d) return dateStr;

  if (style === "short") {
    return `${d}/${m}/${y}`;
  }

  const months = [
    "ene", "feb", "mar", "abr", "may", "jun",
    "jul", "ago", "sep", "oct", "nov", "dic"
  ];
  const mIndex = Number(m) - 1;
  return `${d} ${months[mIndex] || m} ${y}`;
}

/**
 * Calcula la fecha de finalización de un contrato a partir de la fecha de inicio y la duración
 */
export function calculateContractEndDate(
  startDate: string,
  duration: "mensual" | "trimestral" | "semestral" | "anual" | "bianual" | "indefinido"
): string {
  if (duration === "indefinido") return "";
  let months = 12;
  if (duration === "mensual") months = 1;
  else if (duration === "trimestral") months = 3;
  else if (duration === "semestral") months = 6;
  else if (duration === "anual") months = 12;
  else if (duration === "bianual") months = 24;
  return addMonthsSafely(startDate, months);
}

/**
 * Calcula la siguiente fecha de cobro recurrente a partir de la fecha base y la frecuencia
 */
export function calculateNextRenewalDate(
  startDate: string,
  frequency: "mensual" | "trimestral" | "semestral" | "anual"
): string {
  let months = 1;
  if (frequency === "trimestral") months = 3;
  else if (frequency === "semestral") months = 6;
  else if (frequency === "anual") months = 12;
  return addMonthsSafely(startDate, months);
}

