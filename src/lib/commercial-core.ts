import { addMonthsSafely, diffInCalendarDays } from "./date-utils.ts";

export type RecordData = Record<string, any>;
export class CommercialValidationError extends Error {}
export const cents = (value: unknown): number => {
  const n = Number(value);
  if (!Number.isFinite(n) || Math.abs(n) > 100_000_000) throw new CommercialValidationError("Importe inválido.");
  return Math.round((n + Number.EPSILON) * 100);
};
export const money = (value: number) => value / 100;
export function calculateLines(items: RecordData[]) {
  if (!items?.length || items.length > 100) throw new CommercialValidationError("Selecciona entre 1 y 100 partidas.");
  const lines: RecordData[] = items.map(item => {
    const quantity = Number(item.quantity), unitPrice = Number(item.unitPrice), rate = Number(item.ivaRate);
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0 || !Number.isFinite(rate) || rate < 0 || rate > 100) throw new CommercialValidationError("Cantidad, precio o impuesto inválido.");
    const discount = cents(item.discount ?? 0), base = cents(quantity * unitPrice) - discount;
    if (discount < 0 || base < 0) throw new CommercialValidationError("El descuento excede el valor de la partida.");
    const tax = Math.round(base * rate / 100);
    return { ...item, quantity, unitPrice, ivaRate: rate, discount: money(discount), subtotal: money(base), ivaAmount: money(tax), total: money(base + tax) };
  });
  const subtotal = lines.reduce((s, i) => s + cents(i.subtotal), 0), iva = lines.reduce((s, i) => s + cents(i.ivaAmount), 0);
  return { items: lines, subtotal: money(subtotal), ivaTotal: money(iva), total: money(subtotal + iva), discountTotal:money(lines.reduce((sum,item)=>sum+cents(item.discount||0),0)),
    subtotal15: money(lines.filter(i => i.ivaRate === 15).reduce((s, i) => s + cents(i.subtotal), 0)),
    subtotal0: money(lines.filter(i => i.ivaRate === 0).reduce((s, i) => s + cents(i.subtotal), 0)),
    basesByRate: Object.fromEntries([...new Set(lines.map(i => i.ivaRate))].map(rate => [String(rate), money(lines.filter(i => i.ivaRate === rate).reduce((s, i) => s + cents(i.subtotal), 0))])),
  };
}

const frequencies: Record<string, number> = { mensual: 1, trimestral: 3, semestral: 6, anual: 12 };
const monthDifference = (a: string, b: string) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));
export function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value;
}
export function dateOnDay(month: string, day: number) {
  if (!Number.isInteger(day) || day < 1 || day > 31) throw new CommercialValidationError("Día de cobro inválido.");
  const [y, m] = month.split("-").map(Number);
  return `${month.slice(0, 7)}-${String(Math.min(day, new Date(Date.UTC(y, m, 0)).getUTCDate())).padStart(2, "0")}`;
}

export function planServicePeriod(service: RecordData, month: number, year: number, today: string) {
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2020 || year > 2100) throw new CommercialValidationError("Período inválido.");
  const skip = (reason: string) => ({ eligible: false as const, serviceId: String(service.id), reason });
  if (service.status !== "activo" || service.isBillableInCurrentCycle === false) return skip("Servicio no activo o no facturable.");
  const start = service.contractStartDate || service.installationDate;
  if (!start || !validDate(start)) return skip("Falta fecha válida de activación.");
  const months = frequencies[service.billingFrequency || "mensual"];
  if (!months) return skip("Frecuencia no válida.");
  const selected = `${year}-${String(month).padStart(2, "0")}-01`;
  const anchor = service.cycleAnchor || "aniversario";
  const origin = anchor === "calendario" ? start.slice(0, 7) + "-01" : start;
  const offset = monthDifference(origin, selected);
  if (offset < 0 || offset % months !== 0) return skip("No inicia un ciclo de este servicio en el mes elegido.");
  const periodStart = addMonthsSafely(origin, offset), periodEnd = addMonthsSafely(origin, offset + months);
  if (periodStart < start && !service.firstPeriodPolicy) return skip("Define la política del primer período parcial.");
  if (service.contractEndDate && periodStart > service.contractEndDate) return skip("Contrato vencido; requiere renovación.");
  if (service.contractEndDate && periodEnd > addDays(service.contractEndDate, 1)) return skip("El ciclo excede el contrato; requiere ajuste o renovación.");
  const prepaid = service.billingType === "prepago";
  const billingStart = periodStart < start ? start : periodStart;
  const issueDate = prepaid ? billingStart : periodEnd;
  let dueDate=addDays(issueDate,Number(service.creditDays??0));
  if(service.creditDays===undefined&&service.billingDay){dueDate=dateOnDay(issueDate,Number(service.billingDay));if(dueDate<issueDate)dueDate=dateOnDay(addMonthsSafely(issueDate,1),Number(service.billingDay));}
  let noticeDate=dueDate;
  if(service.advanceNoticeDay){noticeDate=dateOnDay(dueDate,Number(service.advanceNoticeDay));if(noticeDate>dueDate)noticeDate=dateOnDay(addMonthsSafely(dueDate,-1),Number(service.advanceNoticeDay));}
  if (issueDate > today) return skip("El período todavía no es exigible.");
  const unitPrice = service.customPrice ?? service.basePrice;
  const rate = service.ivaRate;
  if (unitPrice === undefined || rate === undefined) return skip("Revisa la tarifa y el impuesto del servicio.");
  if (cents(unitPrice) === 0 && !service.zeroPriceReason) return skip("La gratuidad requiere motivo.");
  const ratio = billingStart !== periodStart && service.firstPeriodPolicy === "prorrateo" ? diffInCalendarDays(billingStart, periodEnd) / diffInCalendarDays(periodStart, periodEnd) : 1;
  return { eligible: true as const, serviceId: String(service.id), periodStart, periodEnd, issueDate,
    dueDate,noticeDate,
    key: `${service.id}_${periodStart}_${periodEnd}`,
    line: { id: `period-${service.id}`, serviceId: service.id, productId: service.inventoryProductId || service.planId,
      sku: service.inventorySku || "SRV", name: service.planName, description: `${billingStart} al ${addDays(periodEnd, -1)} (${prepaid ? "PREPAGO" : "POSTPAGO"})`,
      unit: "servicio", quantity: 1, unitPrice: money(cents(Number(unitPrice) * ratio)), ivaRate: Number(rate), discount: 0, periodStart, periodEnd, zeroPriceReason:service.zeroPriceReason||"" },
  };
}
export function addDays(value: string, days: number) {
  if (!validDate(value) || !Number.isInteger(days) || Math.abs(days) > 3650) throw new CommercialValidationError("Fecha o plazo inválido.");
  const date = new Date(value + "T12:00:00Z"); date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function chargeBalance(charge: RecordData) {
  if (charge.status === "anulado") return 0;
  return charge.balanceRemaining === undefined ? Math.max(0, cents(charge.total) - cents(charge.paidAmount ?? (charge.status === "pagado" ? charge.total : 0))) : cents(charge.balanceRemaining);
}
export function externalCash(movements: RecordData[]) {
  return movements.filter(m => !m.transferId && !String(m.category).startsWith("transferencia") && !["apertura","ajuste_conciliacion"].includes(m.category));
}

export function monthlyCashSummary(movements: RecordData[], today: string) {
  const current=today.slice(0,7)+"-01", cash=externalCash(movements);
  return Array.from({length:6},(_,index)=>{
    const month=addMonthsSafely(current,index-5).slice(0,7), rows=cash.filter(m=>String(m.date).startsWith(month));
    const ingresos=money(rows.filter(m=>m.type==="ingreso").reduce((sum,m)=>sum+cents(m.amount),0));
    const egresos=money(rows.filter(m=>m.type==="egreso").reduce((sum,m)=>sum+cents(m.amount),0));
    return {mes:month,ingresos,egresos,neto:money(cents(ingresos)-cents(egresos))};
  });
}
