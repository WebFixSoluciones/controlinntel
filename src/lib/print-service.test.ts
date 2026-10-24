import { test } from "node:test";
import assert from "node:assert/strict";
import { safeNumber, safeFloat } from "./print-service.ts";

test("Print Service - safeNumber parses various inputs reliably without throwing", () => {
  assert.equal(safeNumber(123.456), "123.46");
  assert.equal(safeNumber("123.456"), "123.46");
  assert.equal(safeNumber("1,234.50"), "1234.50");
  assert.equal(safeNumber(undefined), "0.00");
  assert.equal(safeNumber(null), "0.00");
  assert.equal(safeNumber(""), "0.00");
  assert.equal(safeNumber(NaN), "0.00");
  assert.equal(safeNumber("invalido"), "0.00");
  assert.equal(safeNumber(0), "0.00");
  assert.equal(safeNumber(28), "28.00");
  assert.equal(safeNumber(5.5, 3), "5.500");
});

test("Print Service - safeFloat extracts numeric values safely", () => {
  assert.equal(safeFloat(28.5), 28.5);
  assert.equal(safeFloat("28.50"), 28.5);
  assert.equal(safeFloat(undefined), 0);
  assert.equal(safeFloat(null), 0);
  assert.equal(safeFloat("abc"), 0);
});
