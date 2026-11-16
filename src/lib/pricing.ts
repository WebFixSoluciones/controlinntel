// Preserve unit-price precision until the line has been extended and taxed.
// Currency totals, collections and balances always remain in cents.
export const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
export const roundUnitPrice = (value: number) => Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;

export function calculatePriceWithTax(base: number, rate = 15): number {
  return roundCurrency(Math.max(0, Number(base) || 0) * (1 + Math.max(0, Number(rate) || 0) / 100));
}

export function calculatePriceWithoutTax(total: number, rate = 15): number {
  return roundUnitPrice(Math.max(0, Number(total) || 0) / (1 + Math.max(0, Number(rate) || 0) / 100));
}

export function calculateLineAmounts(unitPrice: number, quantity: number, rate: number, discount = 0) {
  const net = Math.max(0, unitPrice * quantity - roundCurrency(discount));
  const subtotal = roundCurrency(net);
  const total = roundCurrency(net * (1 + rate / 100));
  // Extract tax from the extended total so rounding cannot lose a cent.
  return { subtotal, ivaAmount: roundCurrency(total - subtotal), total };
}
