import type { Context } from "./commercial.ts";
import { calculateLines, cents, money, validDate, type RecordData as Row } from "../commercial-core.ts";
import { canUser } from "../permissions.ts";
import { digest } from "./operation-log.ts";
import { HttpError } from "./security.ts";

export function assertPurchaseActive(invoice: Row) {
  if (["anulada", "anulado"].includes(invoice.status)) throw new HttpError(409, "La compra está eliminada y no admite pagos ni ajustes.");
}

function checkVersion(invoice: Row, data: Row) {
  if (!Number.isInteger(data.expectedVersion) || data.expectedVersion !== Number(invoice.version || 0)) {
    throw new HttpError(409, "La compra cambió. Actualiza el historial antes de continuar.");
  }
}

async function linkedDocuments(c: Context, id: string) {
  const result: Row[] = [];
  for (const collection of ["purchaseWithholdings", "billingWithholdings", "supplierCreditNotes", "supplierDebitNotes"]) {
    result.push(...await c.list(collection, "purchaseInvoiceId", id));
  }
  return result;
}

export async function editPurchase(c: Context, data: Row) {
  const old = await c.get("purchaseInvoices", data.id);
  assertPurchaseActive(old); checkVersion(old, data);
  const updates = data.updates;
  const allowed = ["supplierId", "documentNumber", "date", "items", "dueDate", "notes"];
  if (!updates || Array.isArray(updates) || typeof updates !== "object" || Object.keys(updates).some(key => !allowed.includes(key))) {
    throw new HttpError(400, "Selecciona únicamente los campos editables de la compra.");
  }
  if (updates.notes !== undefined && (typeof updates.notes !== "string" || updates.notes.length > 2000)) throw new HttpError(400, "Notas inválidas (máximo 2000 caracteres).");
  if (updates.dueDate !== undefined && updates.dueDate !== "" && !validDate(updates.dueDate)) throw new HttpError(400, "Fecha de vencimiento inválida.");
  const changesAccounting = ["supplierId", "documentNumber", "date", "items"].some(key => key in updates && digest(updates[key]) !== digest(old[key]));
  let invoice = { ...old, ...updates };
  if (changesAccounting) {
    const payments = await c.list("supplierPayments", "purchaseInvoiceId", old.id);
    const receipts = await c.list("inventoryKardex", "referenceId", old.id);
    if (cents(old.paidAmount || 0) || old.inventoryStatus === "ingresado" || old.xmlContent || old.claveAcceso
      || payments.length || receipts.length || (await linkedDocuments(c, old.id)).length || cents(old.adjustmentTotal || 0)) {
      throw new HttpError(409, "Esta compra tiene XML, pagos, inventario o documentos vinculados. Puedes editar notas y vencimiento; los importes y datos del comprobante requieren corregir su origen.");
    }
    const date = invoice.date;
    if (typeof date !== "string" || !validDate(date)) throw new HttpError(400, "Fecha de compra inválida.");
    const documentNumber = typeof invoice.documentNumber === "string" ? invoice.documentNumber.trim() : "";
    if (!/^\d{3}-\d{3}-\d{9}$/.test(documentNumber)) throw new HttpError(400, "Número de comprobante inválido: usa 001-001-000000001.");
    const supplier = await c.get("suppliers", invoice.supplierId);
    if (supplier.status !== "activo" && supplier.id !== old.supplierId) throw new HttpError(400, "Selecciona un proveedor activo.");
    const key = digest([supplier.id, documentNumber]), reservation = await c.get("purchaseUniqueness", key, false);
    if (reservation.id && !reservation.released && reservation.purchaseInvoiceId !== old.id) throw new HttpError(409, "Ya existe una compra con ese proveedor y número.");
    if ((await c.list("purchaseInvoices", "supplierId", supplier.id)).some(row => row.id !== old.id && row.documentNumber === documentNumber)) throw new HttpError(409, "Ya existe una compra con ese proveedor y número.");
    const calculation = calculateLines((invoice.items || []).map((item: Row) => ({ ...item, unitPrice: item.unitCost })));
    for (const item of calculation.items) {
      if (!String(item.name || "").trim()) throw new HttpError(400, "Indica la descripción de cada partida.");
      if (item.productId) {
        const product = await c.get("inventoryProducts", item.productId);
        if (product.tracksStock && product.type !== "servicio") throw new HttpError(409, "Para incorporar existencias registra una nueva compra con su recepción de inventario.");
      }
    }
    invoice = { ...invoice, ...calculation, documentNumber, date, supplierName: supplier.razonSocial, supplierRuc: supplier.ruc,
      ivaAmount: calculation.ivaTotal, balanceRemaining: calculation.total, paymentStatus: "pendiente" };
    const previousKey = digest([old.supplierId, old.documentNumber]);
    if (previousKey !== key) {
      const previous = await c.get("purchaseUniqueness", previousKey, false);
      if (previous.purchaseInvoiceId === old.id) c.put("purchaseUniqueness", { ...previous, released: true });
    }
    c.put("purchaseUniqueness", { ...reservation, id: key, purchaseInvoiceId: old.id, released: false });
  }
  c.put("purchaseInvoices", invoice);
  return c.writes.get("purchaseInvoices/" + old.id);
}

export async function deletePurchase(c: Context, data: Row) {
  const invoice = await c.get("purchaseInvoices", data.id);
  assertPurchaseActive(invoice); checkVersion(invoice, data);
  const reason = typeof data.reason === "string" ? data.reason.trim() : "";
  if (reason.length < 3 || reason.length > 500) throw new HttpError(400, "Indica el motivo de eliminación (3 a 500 caracteres).");
  if ((await linkedDocuments(c, invoice.id)).length || cents(invoice.adjustmentTotal || 0)) {
    throw new HttpError(409, "La compra tiene retenciones o notas vinculadas. Debes resolver esos documentos antes de eliminarla.");
  }
  const payments = (await c.list("supplierPayments", "purchaseInvoiceId", invoice.id)).filter(row => !["anulado", "reversed"].includes(row.status));
  const paid = cents(invoice.paidAmount || 0);
  if (paid < 0 || payments.reduce((sum, payment) => sum + cents(payment.amount), 0) !== paid) throw new HttpError(409, "Los pagos históricos no coinciden con el importe pagado. Se requiere conciliación; no se modificaron saldos.");
  if (payments.length && !canUser(c.user, "compras", "canApprovePayments")) throw new HttpError(403, "Necesitas autorización de pagos a proveedores para eliminar una compra pagada.");
  const cancellation = { status: "anulado", cancelledAt: new Date().toISOString(), cancelledBy: c.user.uid, cancellationReason: reason, cancellationOperationId: c.operationId };
  const movements = await c.list("financialMovements", "purchaseInvoiceId", invoice.id);
  const usedMovements = new Set<string>();
  for (const payment of payments) {
    const amount = cents(payment.amount);
    if (amount <= 0 || payment.supplierId !== invoice.supplierId) throw new HttpError(409, "Pago del proveedor inconsistente. Se requiere conciliación.");
    if (payment.supplierCreditId) {
      if (payment.movementId) throw new HttpError(409, "Pago con doble origen. Se requiere conciliación.");
      const credit = await c.get("supplierCredits", payment.supplierCreditId), restored = cents(credit.remaining) + amount;
      if (credit.supplierId !== invoice.supplierId || restored > cents(credit.amount) || restored < 0) throw new HttpError(409, "El saldo a favor del proveedor requiere conciliación.");
      c.put("supplierCredits", { ...credit, remaining: money(restored), status: "available" });
    } else {
      const movement = payment.movementId ? await c.get("financialMovements", payment.movementId, false) : {};
      if (!movement.id || usedMovements.has(movement.id) || movement.status === "anulado" || movement.type !== "egreso"
        || movement.purchaseInvoiceId !== invoice.id || movement.relatedEntityId !== payment.id
        || movement.bankAccountId !== payment.bankAccountId || cents(movement.amount) !== amount) {
        throw new HttpError(409, "No se puede verificar el movimiento bancario de un pago. Se requiere conciliación; no se modificaron saldos.");
      }
      usedMovements.add(movement.id);
      const bank = await c.get("bankAccounts", movement.bankAccountId);
      c.put("bankAccounts", { ...bank, currentBalance: money(cents(bank.currentBalance) + amount) });
      c.put("financialMovements", { ...movement, ...cancellation });
    }
    c.put("supplierPayments", { ...payment, ...cancellation });
  }
  if (movements.some(row => row.status !== "anulado" && !usedMovements.has(row.id))) throw new HttpError(409, "Existen movimientos bancarios sin pago asociado. Se requiere conciliación.");
  const receipts = await c.list("inventoryKardex", "referenceId", invoice.id);
  if (receipts.some(row => row.type !== "PURCHASE_RECEIPT" || row.reversedBy) || invoice.inventoryStatus === "ingresado" && !receipts.length) throw new HttpError(409, "La recepción de inventario requiere conciliación antes de eliminar la compra.");
  if (receipts.length && !canUser(c.user, "inventarios", "canAdjustStock")) throw new HttpError(403, "Necesitas permiso de ajuste de inventario para revertir la recepción.");
  for (const productId of new Set(receipts.map(row => row.productId))) {
    const own = receipts.filter(row => row.productId === productId);
    const earliest = own.map(row => row.createdAt).sort()[0];
    const history = await c.list("inventoryKardex", "productId", productId);
    if (!earliest || history.some(row => row.referenceId !== invoice.id && (!row.createdAt || row.createdAt >= earliest))) throw new HttpError(409, "El producto tiene movimientos posteriores o históricos sin fecha verificable. Corrige el inventario antes de eliminar la compra.");
  }
  for (const receipt of receipts) {
    const product = await c.get("inventoryProducts", receipt.productId);
    const qty = Number(receipt.entryQuantity), value = Number(receipt.entryTotalCost), current = Number(product.stockByWarehouse?.[receipt.warehouseId] || 0), stock = Number(product.stock) - qty;
    const remainingValue = Number(product.stock) * Number(product.baseCost) - value;
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(value) || value < 0 || current < qty || stock < 0 || remainingValue < -0.01 || stock === 0 && Math.abs(remainingValue) > 0.01) throw new HttpError(409, "Las existencias o su valoración no permiten revertir esta recepción.");
    // Use the receipt's historical net cost; the generic stock-out uses average cost.
    const average = stock ? Math.max(0, remainingValue) / stock : 0;
    const reversal = await c.stock(receipt.productId, receipt.warehouseId, -qty, value / qty, "PURCHASE_CANCELLATION", invoice.id, invoice.documentNumber, `Eliminación de compra: ${reason}`);
    c.put("inventoryProducts", { ...c.writes.get("inventoryProducts/" + product.id), baseCost: average });
    c.put("inventoryKardex", { ...reversal, balanceAverageCost: average, balanceTotalCost: money(cents((current - qty) * average)), reversesMovementId: receipt.id });
    c.put("inventoryKardex", { ...receipt, reversedBy: reversal.id });
  }
  const result = { ...invoice, ...cancellation, status: "anulada", cancelledPaidAmount: money(paid), paidAmount: 0, balanceRemaining: 0 };
  c.put("purchaseInvoices", result);
  return c.writes.get("purchaseInvoices/" + invoice.id);
}
