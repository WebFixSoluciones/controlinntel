import test from "node:test";
import assert from "node:assert/strict";
import { calculateSale, allocateDiscount, recalculateSaleLine } from "./sale-calculation.ts";
import { calculateLines, cents } from "./commercial-core.ts";
import { calculatePriceWithoutTax } from "./pricing.ts";

// Independent decimal oracle: integer fractions rather than the production rounding helper.
function fraction(value: number): [bigint, bigint] {
  const [whole, part = ""] = String(value).split(".");
  return [BigInt(whole + part), BigInt(10) ** BigInt(part.length)];
}
function expectedGross(price: number, qty: number, linePct: number, globalPct: number) {
  const factors = [price, qty, (100 - linePct), (100 - globalPct)].map(fraction);
  const n = factors.reduce((a, b) => a * b[0], BigInt(100)), d = factors.reduce((a, b) => a * b[1], BigInt(10000));
  return Number((n * BigInt(2) + d) / (d * BigInt(2))) / 100;
}

test("QA decimal: cantidades, precios cerrados/no cerrados, IVA y descuentos porcentuales combinados", () => {
  for (const gross of [0.01, 0.03, 1, 2, 5, 14.99, 80, 121.97, 140, 150, 199.99, 350, 575, 9999.99]) {
    for (const ivaRate of [0, 5, 12, 15]) for (const quantity of [0.125, 0.5, 1, 2, 3, 7, 12.345, 100, 1000]) {
      for (const pct of [0, 2, 10, 12.5, 25, 50, 100]) for (const global of [0, 10]) {
        const item = { id: "i", quantity, ivaRate, unitPrice: calculatePriceWithoutTax(gross, ivaRate), unitPriceWithTax: gross, discountType: "percentage", discountInput: pct };
        const result = calculateSale([item], "percentage", global);
        assert.equal(result.total, expectedGross(gross, quantity, pct, global), JSON.stringify({ gross, quantity, ivaRate, pct, global }));
        assert.equal(cents(result.subtotal) + cents(result.ivaTotal), cents(result.total));
        assert.equal(cents(item.unitPrice * quantity) - cents(result.items[0].discount), cents(result.items[0].subtotal), "El descuento publicado también cuadra con la base de la partida");
        assert.equal(calculateLines(result.items).total, result.total, "El servidor recalcula lo mostrado en pantalla");
      }
    }
  }
});

test("El descuento monetario global conserva cada centavo entre partidas e impuestos distintos", () => {
  assert.deepEqual(allocateDiscount([1, 1, 1], 0.01), [0.01, 0, 0]);
  assert.deepEqual(allocateDiscount([1, 1, 1], 0.02), [0.01, 0.01, 0]);
  const rows = [0, 5, 15].map((ivaRate, id) => ({ id: String(id), unitPrice: 10, quantity: 1, ivaRate }));
  for (const amount of [0.01, 0.02, 1, 7.77, 15, 30]) {
    const result = calculateSale(rows, "amount", amount);
    assert.equal(result.discountTotal, amount);
    assert.equal(calculateLines(result.items).total, result.total);
    assert.ok(result.items.every(line => line.total >= 0));
  }
});

test("Editar conserva el descuento preciso y recalcula la misma partida que el servidor", () => {
  const original = calculateSale([{ quantity: 0.5, unitPrice: calculatePriceWithoutTax(5, 15), unitPriceWithTax: 5, ivaRate: 15, discountType: "percentage", discountInput: 10 }]).items[0];
  const edited = recalculateSaleLine(original, { quantity: 1 });
  assert.equal(edited.discountExact, original.discountExact, "Editar cantidad conserva el descuento monetario ya concedido");
  assert.equal(edited.total, 4.75);
  assert.equal(calculateLines([edited]).total, edited.total);
  assert.equal(recalculateSaleLine(edited, { name: "Descripción corregida" }).total, edited.total);
  const changedDiscount = recalculateSaleLine(edited, { discount: 1 });
  assert.equal(changedDiscount.discountExact, undefined);
  assert.equal(calculateLines([changedDiscount]).total, changedDiscount.total);
  assert.throws(() => recalculateSaleLine(original, { discount: 99 }), /descuento/);
});

test("Descuentos excesivos se limitan al importe de la línea sin negativos ni NaN", () => {
  assert.equal(calculateSale([]).total, 0, "El formulario vacío debe poder abrirse antes de añadir partidas");
  for (const mode of ["percentage", "amount", "no_iva"] as const) {
    const result = calculateSale([{ quantity: 1, unitPrice: 5, ivaRate: 15, discountType: mode, discountInput: 1000 }]);
    assert.ok(result.total >= 0); assert.ok(Number.isFinite(result.total));
  }
  assert.throws(() => calculateLines([{ quantity: -1, unitPrice: 1, ivaRate: 15 }]));
  assert.throws(() => calculateLines([{ quantity: 1, unitPrice: 1, ivaRate: 15, discount: 0, discountExact: 0.5 }]));
});
