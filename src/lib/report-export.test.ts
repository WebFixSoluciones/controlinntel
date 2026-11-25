import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { downloadReport } from "./report-export.ts";

test("Excel conserva el número del comprobante como texto y el importe como número", async t => {
  let file: Blob | undefined;
  t.mock.method(URL, "createObjectURL", (blob: Blob) => {
    file = blob;
    return "blob:qa";
  });
  Object.defineProperty(globalThis, "document", { configurable: true, value: { createElement: () => ({ click() {} }) } });
  t.after(() => { Reflect.deleteProperty(globalThis, "document"); });

  await downloadReport([{ reference: "00007120", amount: 18.75 }], [
    { key: "reference", label: "Comprobante" }, { key: "amount", label: "Importe", money: true },
  ], "Pagos_QA", "xlsx", "Cuenta de prueba");

  assert.ok(file);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const row = workbook.getWorksheet("Reporte")?.getRow(2);
  assert.equal(row?.getCell(1).value, "00007120");
  assert.equal(row?.getCell(2).value, 18.75);
});
