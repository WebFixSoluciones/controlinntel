import test from "node:test";
import assert from "node:assert/strict";
import { receivedPayments, type PaymentReportSource } from "./payment-report.ts";

const source: PaymentReportSource = {
  financialMovements: [
    { id: "m1", type: "ingreso", category: "cobro_cliente", relatedEntityId: "p1", date: "2026-11-02", amount: 25, bankAccountId: "bank", referenceNumber: "000123" },
    { id: "m2", type: "ingreso", category: "anticipo_cliente", relatedEntityId: "a1", date: "2026-11-04", amount: 100, bankAccountId: "bank", referenceNumber: "TX-400" },
    { id: "m3", type: "ingreso", category: "cobro_cliente", relatedEntityId: "p3", date: "2026-11-03", amount: 10, bankAccountId: "bank", referenceNumber: "001-010-000000031" },
    { id: "m4", type: "ingreso", category: "cobro_cliente", date: "2026-11-05", amount: 99, status: "anulado" },
    { id: "m5", type: "ingreso", category: "transferencia_interna", date: "2026-11-05", amount: 999 },
    { id: "m6", type: "egreso", category: "devolucion_anticipo", date: "2026-11-05", amount: 20 },
  ],
  monthlyCharges: [{ id: "c1", clientName: "Cliente QA", clientRuc: "001", invoiceNumber: "001-010-000000031", payments: [
    { id: "p1", amount: 25, date: "2026-11-02", movementId: "m1", status: "reversed" },
    { id: "p2", amount: 40, date: "2026-11-04", advanceId: "a1" },
    { id: "p3", amount: 10, date: "2026-11-03" },
    { id: "p4", amount: 5, date: "2026-11-01", bankAccountId: "bank", reference: "000099" },
  ] }],
  clientAdvances: [
    { id: "a1", clientName: "Cliente QA", amount: 100, applications: [{ invoiceNumber: "NV-31" }, { invoiceNumber: "NV-32" }, { invoiceNumber: "NV-33", status: "reversed" }] },
    { id: "released-p1", sourcePaymentId: "p1", applications: [{ invoiceNumber: "NV-34" }] },
  ],
  bankAccounts: [{ id: "bank", bankName: "Banco QA", accountNumber: "00123456" }],
};

test("el reporte conserva ceros y cuenta una vez los ingresos, incluidas las aplicaciones y reversiones", () => {
  const rows = receivedPayments(source);
  assert.deepEqual(rows.map(row => row.id), ["m2", "m3", "m1", "p4"]);
  assert.equal(rows[0].documents, "NV-31, NV-32");
  assert.equal(rows[0].amount, 100);
  assert.equal(rows[1].status, "Revisar referencia de venta");
  assert.equal(rows[2].reference, "000123");
  assert.equal(rows[2].originDocument, "001-010-000000031");
  assert.equal(rows[2].documents, "NV-34");
  assert.equal(rows[2].account, "Banco QA · ••••3456");
  assert.equal(rows[3].status, "Sin movimiento vinculado");
  assert.equal(rows[3].reference, "000099");
});

test("una entrada válida sin número conserva el importe y queda identificada para revisión", () => {
  const [row] = receivedPayments({ financialMovements: [{ id: "old", type: "ingreso", category: "cobro_cliente", date: "2026-11-05", amount: 15, description: "Abono histórico" }] });
  assert.equal(row.amount, 15);
  assert.equal(row.status, "Sin comprobante");
  assert.equal(row.reference, "");
});
