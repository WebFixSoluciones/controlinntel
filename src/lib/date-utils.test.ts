import test from "node:test";
import assert from "node:assert/strict";
import {
  getEcuadorDate,
  addMonthsSafely,
  diffInCalendarDays,
  formatDateEC,
  calculateContractEndDate,
  calculateNextRenewalDate,
} from "./date-utils.ts";

test("Date Utils - getEcuadorDate avoids UTC tomorrow shift", () => {
  // Simular las 20:00 en Ecuador (01:00 UTC del día siguiente)
  // 2026-10-23T20:30:00-05:00 = 2026-10-24T01:30:00Z
  const nightTime = new Date("2026-10-24T01:30:00Z");
  const ecuadorDate = getEcuadorDate(nightTime);
  assert.equal(ecuadorDate, "2026-10-23", "Debe ser 2026-10-23 en Ecuador, no 2026-10-24");
});

test("Date Utils - addMonthsSafely handles month-end overflow", () => {
  // 31 de Enero + 1 mes en año no bisiesto 2025 -> 28 de Febrero
  assert.equal(addMonthsSafely("2025-01-31", 1), "2025-02-28");

  // 31 de Enero + 1 mes en año bisiesto 2024 -> 29 de Febrero
  assert.equal(addMonthsSafely("2024-01-31", 1), "2024-02-29");

  // 31 de Marzo + 1 mes -> 30 de Abril
  assert.equal(addMonthsSafely("2026-03-31", 1), "2026-04-30");

  // Sumar 12 meses
  assert.equal(addMonthsSafely("2026-10-23", 12), "2027-10-23");
});

test("Date Utils - diffInCalendarDays", () => {
  assert.equal(diffInCalendarDays("2026-10-23", "2026-10-28"), 5);
  assert.equal(diffInCalendarDays("2026-10-28", "2026-10-23"), -5);
  assert.equal(diffInCalendarDays("2026-10-23", "2026-10-23"), 0);
});

test("Date Utils - formatDateEC", () => {
  assert.equal(formatDateEC("2026-10-23", "short"), "23/10/2026");
  assert.equal(formatDateEC("2026-10-23", "human"), "23 oct 2026");
});

test("Date Utils - calculateContractEndDate & calculateNextRenewalDate", () => {
  // Contratos
  assert.equal(calculateContractEndDate("2026-10-26", "mensual"), "2026-11-26");
  assert.equal(calculateContractEndDate("2026-10-26", "trimestral"), "2027-01-26");
  assert.equal(calculateContractEndDate("2026-10-26", "semestral"), "2027-04-26");
  assert.equal(calculateContractEndDate("2026-10-26", "anual"), "2027-10-26");
  assert.equal(calculateContractEndDate("2026-10-26", "bianual"), "2028-10-26");
  assert.equal(calculateContractEndDate("2026-10-26", "indefinido"), "");

  // Frecuencias de cobro
  assert.equal(calculateNextRenewalDate("2026-10-26", "mensual"), "2026-11-26");
  assert.equal(calculateNextRenewalDate("2026-10-26", "trimestral"), "2027-01-26");
  assert.equal(calculateNextRenewalDate("2026-10-26", "semestral"), "2027-04-26");
  assert.equal(calculateNextRenewalDate("2026-10-26", "anual"), "2027-10-26");
});

