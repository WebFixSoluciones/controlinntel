// Preserve unit-price precision until the line has been extended and taxed.
// Currency totals, collections and balances always remain in cents.
export const roundCurrency = (value: number) => Math.round((value + Number.EPSILON * Math.max(1, Math.abs(value)) * 4) * 100) / 100;
export const roundUnitPrice = (value: number) => Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;

export function calculatePriceWithTax(base: number, rate = 15): number {
  return roundCurrency(Math.max(0, Number(base) || 0) * (1 + Math.max(0, Number(rate) || 0) / 100));
}

export function calculatePriceWithoutTax(total: number, rate = 15): number {
  return roundUnitPrice(Math.max(0, Number(total) || 0) / (1 + Math.max(0, Number(rate) || 0) / 100));
}

export function inclusiveUnitPrice(base: number, gross: unknown, rate: number): number | undefined {
  const value = Number(gross);
  return gross !== undefined && Number.isFinite(value) && value >= 0 && value === roundCurrency(value) && Math.abs(base - calculatePriceWithoutTax(value, rate)) <= 0.000001
    ? roundCurrency(value) : undefined;
}

export function calculateLineAmounts(unitPrice: number, quantity: number, rate: number, discount = 0, options: { discountExact?: number; unitPriceWithTax?: number } = {}) {
  const grossBase = unitPrice * quantity;
  const preciseDiscount = options.discountExact ?? roundCurrency(discount);
  const net = Math.max(0, grossBase - preciseDiscount);
  const subtotal = roundCurrency(net);
  const inclusive = inclusiveUnitPrice(unitPrice, options.unitPriceWithTax, rate);
  const total = roundCurrency(inclusive !== undefined && grossBase > 0 ? inclusive * quantity * (1 - Math.min(1, preciseDiscount / grossBase)) : net * (1 + rate / 100));
  // Extract tax from the extended total so rounding cannot lose a cent.
  return { subtotal, ivaAmount: roundCurrency(total - subtotal), total };
}
