import { cents, money, CommercialValidationError, type RecordData } from "./commercial-core.ts";

/** Only unspent advances belonging to this customer can settle their receivables. */
export function availableClientCredit(advances: RecordData[], clientId: string) {
  const available = advances.filter(advance => advance.clientId === clientId && advance.status !== "anulado" && cents(advance.remaining || 0) > 0)
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")) || String(a.id).localeCompare(String(b.id)));
  return { advances: available, total: money(available.reduce((sum, advance) => sum + cents(advance.remaining), 0)) };
}

export function allocateClientCredit(advances: RecordData[], clientId: string, amount: number) {
  let pending = cents(amount);
  const available = availableClientCredit(advances, clientId);
  if (pending <= 0 || pending > cents(available.total)) throw new CommercialValidationError("El importe debe ser mayor que cero y no superar el saldo a favor disponible.");
  const applications: { advanceId: string; amount: number }[] = [];
  for (const advance of available.advances) {
    if (!pending) break;
    const used = Math.min(pending, cents(advance.remaining));
    applications.push({ advanceId: advance.id, amount: money(used) });
    pending -= used;
  }
  return applications;
}
