import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateWeightedAverageCost,
  calculatePriceWithTax,
  calculatePriceWithoutTax,
  validateStockAvailability,
  generateInventoryDocNumber,
  buildKardexEntry,
} from "./inventory-service.ts";
import type { InventoryProduct, Warehouse } from "../types";

test("Inventory Service - calculateWeightedAverageCost", () => {
  // Stock inicial: 10 unidades a $100 ($1000). Entrada: 10 unidades a $120 ($1200). Nuevo promedio: $110.
  const cost = calculateWeightedAverageCost(10, 100, 10, 120);
  assert.equal(cost, 110);

  // Entrada inicial en bodega vacía
  const initialCost = calculateWeightedAverageCost(0, 0, 5, 50);
  assert.equal(initialCost, 50);
});

test("Inventory Service - calculatePriceWithTax & calculatePriceWithoutTax", () => {
  // $100 sin IVA al 15% = $115
  assert.equal(calculatePriceWithTax(100, 15), 115);

  // $115 con IVA al 15% = $100
  assert.equal(calculatePriceWithoutTax(115, 15), 100);
});

test("Inventory Service - validateStockAvailability", () => {
  const product: InventoryProduct = {
    id: "prod-01",
    name: "Router MikroTik CCR2004",
    sku: "MTK-CCR2004",
    unit: "unidad",
    type: "producto",
    categoryId: "cat-01",
    baseCost: 450,
    salePrice: 650,
    salePriceConIva: 747.5,
    taxMode: "EXCLUIDO",
    ivaRate: 15,
    tracksStock: true,
    stock: 5,
    minStock: 2,
    stockByWarehouse: { "wh-matriz": 5 },
    status: "activo",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  };

  // Stock suficiente
  const validCheck = validateStockAvailability(product, "wh-matriz", 3);
  assert.equal(validCheck.valid, true);
  assert.equal(validCheck.currentStock, 5);

  // Stock insuficiente
  const invalidCheck = validateStockAvailability(product, "wh-matriz", 10);
  assert.equal(invalidCheck.valid, false);
});

test("Inventory Service - generateInventoryDocNumber", () => {
  const year = new Date().getFullYear();
  assert.equal(generateInventoryDocNumber("TRF", 1), `TRF-${year}-0002`);
  assert.equal(generateInventoryDocNumber("ADJ", 24), `ADJ-${year}-0025`);
});

test("Inventory Service - buildKardexEntry", () => {
  const product: InventoryProduct = {
    id: "prod-01",
    name: "Router MikroTik CCR2004",
    sku: "MTK-CCR2004",
    unit: "unidad",
    type: "producto",
    categoryId: "cat-01",
    baseCost: 450,
    salePrice: 650,
    salePriceConIva: 747.5,
    taxMode: "EXCLUIDO",
    ivaRate: 15,
    tracksStock: true,
    stock: 10,
    minStock: 2,
    stockByWarehouse: { "wh-matriz": 10 },
    status: "activo",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  };

  const warehouse: Warehouse = {
    id: "wh-matriz",
    name: "Bodega Matriz Quito",
    code: "BOD-01",
    address: "Av. Amazonas",
    isDefault: true,
    status: "activo",
    createdAt: "2026-01-01",
  };

  const entry = buildKardexEntry({
    product,
    warehouse,
    type: "PURCHASE_RECEIPT",
    referenceId: "pinv-101",
    referenceDocNumber: "001-001-000000100",
    concept: "Ingreso por Factura de Compra",
    quantity: 5,
    unitCost: 100,
    currentStock: 10,
    currentAvgCost: 100,
    userName: "admin@inntelcorp.com",
  });

  assert.equal(entry.productId, "prod-01");
  assert.equal(entry.type, "PURCHASE_RECEIPT");
  assert.equal(entry.balanceQuantity, 15);
  assert.equal(entry.entryQuantity, 5);
  assert.equal(entry.entryTotalCost, 500);
});
