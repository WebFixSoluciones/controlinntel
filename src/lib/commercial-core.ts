import { addMonthsSafely, diffInCalendarDays, formatDateEC, getEcuadorDate } from "./date-utils.ts";

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

export function serviceBillingStart(service: RecordData): string | undefined {
  return service.billingPeriodStartDate || service.contractStartDate || service.installationDate;
}

function servicePeriod(service: RecordData, month: number, year: number) {
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2020 || year > 2100) throw new CommercialValidationError("Período inválido.");
  const skip = (reason: string) => ({ eligible: false as const, serviceId: String(service.id), reason });
  if (service.status !== "activo" || service.isBillableInCurrentCycle === false) return skip("Servicio no activo o no facturable.");
  const start = serviceBillingStart(service);
  if (!start || !validDate(start)) return skip("Falta fecha válida de activación.");
  if (service.contractStartDate && start < service.contractStartDate) return skip("El inicio del período debe coincidir con el inicio del contrato o ser posterior.");
  if (service.contractEndDate && (!validDate(service.contractEndDate) || start > service.contractEndDate)) return skip("El inicio del período debe estar dentro de la vigencia del contrato.");
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
  const unitPrice = service.customPrice ?? service.basePrice;
  const rate = service.ivaRate;
  if (unitPrice === undefined || !Number.isFinite(Number(unitPrice)) || Number(unitPrice) < 0 ||
    rate === undefined || !Number.isFinite(Number(rate)) || Number(rate) < 0 || Number(rate) > 100) {
    return skip("Revisa la tarifa y el impuesto del servicio.");
  }
  if (cents(unitPrice) === 0 && !service.zeroPriceReason) return skip("La gratuidad requiere motivo.");
  const ratio = billingStart !== periodStart && service.firstPeriodPolicy === "prorrateo" ? diffInCalendarDays(billingStart, periodEnd) / diffInCalendarDays(periodStart, periodEnd) : 1;
  return { eligible: true as const, serviceId: String(service.id), periodStart, periodEnd, billingStart, issueDate,
    dueDate,noticeDate,
    key: `${service.id}_${periodStart}_${periodEnd}`,
    line: { id: `period-${service.id}`, serviceId: service.id, productId: service.inventoryProductId || service.planId,
      sku: service.inventorySku || "SRV", name: service.planName, description: `Período del ${formatDateEC(billingStart)} al ${formatDateEC(addDays(periodEnd, -1))} (${prepaid ? "PREPAGO" : "POSPAGO"})`,
      unit: "servicio", quantity: 1, unitPrice: money(cents(Number(unitPrice) * ratio)), ivaRate: Number(rate), discount: 0, periodStart, periodEnd, zeroPriceReason:service.zeroPriceReason||"" },
  };
}

export function planServicePeriod(service: RecordData, month: number, year: number, today: string) {
  const period = servicePeriod(service, month, year);
  return period.eligible && period.issueDate > today
    ? { eligible: false as const, serviceId: String(service.id), reason: "El período todavía no es exigible." }
    : period;
}

export function initialServicePeriod(service: RecordData) {
  const start = serviceBillingStart(service);
  if (!start || !validDate(start)) return { eligible: false as const, serviceId: String(service.id), reason: "Selecciona el inicio del período." };
  if (Number(start.slice(0, 4)) < 2020 || Number(start.slice(0, 4)) > 2100) {
    return { eligible: false as const, serviceId: String(service.id), reason: "El inicio del período debe estar entre 2020 y 2100." };
  }
  return servicePeriod(service, Number(start.slice(5, 7)), Number(start.slice(0, 4)));
}

export type EligibleServicePeriod = Extract<ReturnType<typeof planServicePeriod>, { eligible: true }>;

export function paymentDueOnIssue(plans: EligibleServicePeriod[], emissionDate: string): string {
  const earliestDue = plans.map(plan => plan.dueDate).sort()[0];
  return earliestDue < emissionDate ? emissionDate : earliestDue;
}

export function scheduledServicePeriods(service: RecordData, today: string): EligibleServicePeriod[] {
  if (!validDate(today) || !today.endsWith("-01")) return [];
  const previousRun = addMonthsSafely(today, -1);
  const registeredDate = typeof service.createdAt === "string" && Number.isFinite(Date.parse(service.createdAt))
    ? getEcuadorDate(service.createdAt) : "";
  const periods: EligibleServicePeriod[] = [];
  // Un ciclo anual pospago puede haberse iniciado hasta trece meses antes de la corrida.
  for (let offset = 13; offset >= 0; offset--) {
    const [year, month] = addMonthsSafely(today, -offset).split("-").map(Number);
    if (year < 2020 || year > 2100) continue;
    const plan = planServicePeriod(service, month, year, today);
    if (plan.eligible && (plan.issueDate > previousRun || (plan.issueDate === previousRun && registeredDate >= previousRun))) periods.push(plan);
  }
  return periods;
}

export function previewScheduledService(service: RecordData, today: string) {
  const start = serviceBillingStart(service);
  if (!start || !validDate(start)) return { reason: "Selecciona el inicio del período." };
  const [year, month] = start.split("-").map(Number);
  if (year < 2020 || year > 2100) return { reason: "La fecha de inicio debe estar entre 2020 y 2100." };
  if (service.contractEndDate && (!validDate(service.contractEndDate) || service.contractEndDate < start)) {
    return { reason: "La vigencia debe terminar en la fecha de inicio o después." };
  }
  const startMonth = start.slice(0, 7) + "-01";
  const nextRun = addMonthsSafely(today.slice(0, 7) + "-01", 1);
  const from = startMonth > nextRun ? startMonth : nextRun;
  for (let index = 0; index <= 13; index++) {
    const emissionDate = addMonthsSafely(from, index);
    const plans = scheduledServicePeriods(service, emissionDate).filter(plan => {
      const periodMonth = plan.periodStart.slice(0, 7);
      const annualAlreadyBilled = service.billingFrequency === "anual" && service.lastBilledPeriod === periodMonth.slice(0, 4);
      return !annualAlreadyBilled && (!service.lastBilledPeriod || periodMonth > service.lastBilledPeriod);
    });
    if (plans.length) {
      return { emissionDate, plans, dueDate: paymentDueOnIssue(plans, emissionDate) };
    }
  }
  const first = planServicePeriod(service, month, year, addMonthsSafely(start, 13));
  return { reason: first.eligible ? "No hay un período pendiente para las próximas corridas. Revisa la vigencia en Ventas recurrentes." : first.reason };
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
  return movements.filter(m => m.status !== "anulado" && !m.transferId && !String(m.category).startsWith("transferencia") && !["apertura","ajuste_conciliacion"].includes(m.category));
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
