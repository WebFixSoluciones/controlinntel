import test from "node:test";
import assert from "node:assert/strict";
import { calculatePriceWithoutTax, calculatePriceWithTax, calculateLineAmounts, roundCurrency } from "./pricing.ts";
import { calculateLines, planManualServicePeriod, planServicePeriod } from "./commercial-core.ts";

test("Los precios finales conservan sus centavos al desglosar IVA, vender y multiplicar cantidades", () => {
  for (const rate of [0, 5, 12, 15]) {
    for (const final of [0.01, 0.04, 1, 10, 40.25, 100, 140, 149.99, 150, 575]) {
      const base = calculatePriceWithoutTax(final, rate);
      assert.equal(calculatePriceWithTax(base, rate), final);
      for (const quantity of [1, 2, 3, 12]) {
        const line = calculateLineAmounts(base, quantity, rate);
        const expected = roundCurrency(final * quantity);
        assert.equal(line.total, expected, `${final}, IVA ${rate}%, cantidad ${quantity}`);
        assert.equal(roundCurrency(line.subtotal + line.ivaAmount), expected);
        assert.equal(calculateLines([{ quantity, unitPrice: base, ivaRate: rate }]).total, expected);
      }
    }
  }
  assert.deepEqual(calculateLineAmounts(calculatePriceWithoutTax(150, 15), 1, 15), { subtotal: 130.43, ivaAmount: 19.57, total: 150 });
  assert.equal(calculateLineAmounts(130.43, 1, 15).total, 149.99, "Un precio sin IVA ingresado explícitamente no se infla a 150");
});

test("La emisión manual anticipa postpago; la automática conserva exigibilidad, vigencia y estado", () => {
  const service = { id: "s", status: "activo", billingType: "postpago", billingFrequency: "mensual", customPrice: 100,
    ivaRate: 15, contractStartDate: "2026-10-01", contractEndDate: "2027-09-30", cycleAnchor: "calendario" };
  assert.equal(planServicePeriod(service, 10, 2026, "2026-10-15").eligible, false);
  assert.equal(planManualServicePeriod(service, 10, 2026).eligible, true);
  assert.equal(planManualServicePeriod(service, 9, 2026).eligible, false);
  assert.equal(planManualServicePeriod({ ...service, status: "suspendido" }, 10, 2026).eligible, false);
  assert.equal(planManualServicePeriod({ ...service, isBillableInCurrentCycle: false }, 10, 2026).eligible, false);
});
