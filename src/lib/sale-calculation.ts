import { calculateLines, cents, money, type RecordData } from "./commercial-core.ts";

type Mode = "none" | "percentage" | "amount" | "no_iva";
export function recalculateSaleLine(item: RecordData, changes: RecordData) {
  const line = { ...item, ...changes };
  if (changes.discount !== undefined) delete line.discountExact;
  if (changes.unitPrice !== undefined || changes.ivaRate !== undefined) delete line.unitPriceWithTax;
  return calculateLines([line]).items[0];
}

function discountFor(base: number, rate: number, mode: Mode, value: number) {
  if (mode === "percentage") return base * Math.min(100, Math.max(0, value || 0)) / 100;
  if (mode === "amount") return Math.min(base, Math.max(0, value || 0));
  if (mode === "no_iva") return rate > 0 ? base - base / (1 + rate / 100) : 0;
  return 0;
}

// Allocate a monetary discount in cents, retaining the requested amount rather
// than rounding every proportional share independently.
export function allocateDiscount(bases: number[], requested: number): number[] {
  const weights = bases.map(base => Math.max(0, base)), sum = weights.reduce((a, b) => a + b, 0);
  const target = Math.min(cents(Math.max(0, requested)), weights.reduce((total, base) => total + Math.floor((base + 1e-8) * 100), 0));
  if (!sum || !target) return bases.map(() => 0);
  const shares = weights.map((weight, index) => ({ index, value: Math.min(Math.floor(weight * 100 + 1e-8), Math.floor(target * weight / sum)), fraction: target * weight / sum % 1 }));
  let remaining = target - shares.reduce((sum, share) => sum + share.value, 0);
  for (const share of [...shares].sort((a, b) => b.fraction - a.fraction || a.index - b.index)) {
    if (remaining && share.value < Math.floor(weights[share.index] * 100 + 1e-8)) { share.value++; remaining--; }
  }
  if (remaining) throw Error("El descuento no se puede distribuir en estas partidas.");
  return shares.map(share => money(share.value));
}

export function calculateSale(items: RecordData[], globalMode: Mode = "none", globalValue = 0) {
  if (!items.length) return { items: [] as RecordData[], subtotal: 0, subtotal15: 0, subtotal0: 0, ivaTotal: 0, total: 0, discountTotal: 0, basesByRate: { "0": 0, "15": 0 } as Record<string, number> };
  const rows = items.map(item => {
    const base = Number(item.quantity) * Number(item.unitPrice);
    const lineDiscount = discountFor(base, Number(item.ivaRate), item.discountType || "none", Number(item.discountInput));
    return { item, base, lineDiscount, net: base - lineDiscount };
  });
  const amounts = globalMode === "amount" ? allocateDiscount(rows.map(row => row.net), globalValue) : rows.map(() => 0);
  return calculateLines(rows.map((row, index) => {
    const extra = globalMode === "amount" ? amounts[index] : discountFor(row.net, Number(row.item.ivaRate), globalMode, globalValue);
    const discountExact = Math.min(row.base, row.lineDiscount + extra);
    return { ...row.item, discountExact, discount: money(cents(discountExact)) };
  }));
}
