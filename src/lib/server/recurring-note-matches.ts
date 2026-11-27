import { addDays, validDate, type EligibleServicePeriod, type RecordData as Row } from "../commercial-core.ts";
import { addMonthsSafely } from "../date-utils.ts";
import { normalizeSearchText } from "../search.ts";

/**
 * Las notas sin período explícito requieren revisión. Nunca se vinculan solo
 * por una coincidencia de nombre, producto o fecha.
 */
export function recurringNoteMatches(notes: Row[], service: Row, plan: EligibleServicePeriod, byDate: string) {
  const productIds = [service.inventoryProductId, service.planId].filter(Boolean);
  const serviceName = normalizeSearchText(service.planName);
  const firstOfMonth = `${plan.issueDate.slice(0, 7)}-01`;
  const scheduledDate = plan.issueDate === firstOfMonth ? firstOfMonth : addMonthsSafely(firstOfMonth, 1);
  const lastScheduledDay = addDays(scheduledDate, 6);
  const cutoff = byDate < lastScheduledDay ? byDate : lastScheduledDay;

  return notes.flatMap(note => {
    if (note.documentType !== "nota_venta" || note.clientId !== service.clientId || note.status === "borrador") return [];
    return (Array.isArray(note.items) ? note.items : []).flatMap((item: Row, itemIndex: number) => {
      if (item.serviceId && item.serviceId !== service.id) return [];
      if (item.serviceId === service.id && item.periodStart === plan.periodStart && item.periodEnd === plan.periodEnd) {
        return [{ note, itemIndex, exact: true }];
      }
      if (note.status === "anulada") return [];
      const sameService = item.serviceId === service.id || productIds.includes(item.productId)
        || Boolean(service.inventorySku && item.sku === service.inventorySku)
        || Boolean(serviceName && normalizeSearchText(item.name) === serviceName);
      if (!sameService) return [];
      const overlaps = validDate(item.periodStart) && validDate(item.periodEnd)
        ? item.periodStart < plan.periodEnd && item.periodEnd > plan.periodStart
        : validDate(note.date) && note.date >= plan.billingStart && note.date <= cutoff;
      return overlaps ? [{ note, itemIndex, exact: false }] : [];
    });
  });
}
