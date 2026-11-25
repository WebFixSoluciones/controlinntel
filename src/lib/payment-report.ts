import { cents, externalCash, money, type RecordData as Row } from "./commercial-core.ts";

export type PaymentReportSource = Partial<Record<"financialMovements" | "monthlyCharges" | "clientAdvances" | "bankAccounts", Row[]>>;

type Receipt = {
  id: string;
  date: string;
  amount: number;
  reference: string;
  method: string;
  accountId: string;
  account: string;
  client: string;
  ruc: string;
  originDocument: string;
  documents: string;
  kind: "Cobro" | "Anticipo";
  movementId: string;
  status: "Con comprobante" | "Sin comprobante" | "Revisar referencia de venta" | "Sin movimiento vinculado";
};

const field = (value: unknown) => String(value ?? "").trim();

export function receivedPayments({ financialMovements = [], monthlyCharges = [], clientAdvances = [], bankAccounts = [] }: PaymentReportSource): Receipt[] {
  const charges = new Map(monthlyCharges.map(charge => [charge.id, charge]));
  const accounts = new Map(bankAccounts.map(account => [account.id, account]));
  const advances = new Map(clientAdvances.map(advance => [advance.id, advance]));
  const advancesByMovement = new Map(clientAdvances.filter(advance => advance.movementId).map(advance => [advance.movementId, advance]));
  const released = new Map(clientAdvances.filter(advance => advance.sourcePaymentId).map(advance => [advance.sourcePaymentId, advance]));
  const payments = monthlyCharges.flatMap(charge => (charge.payments || []).map((payment: Row) => ({ charge, payment })));
  const paymentsById = new Map(payments.map(entry => [entry.payment.id, entry]));
  const paymentsByMovement = new Map(payments.filter(entry => entry.payment.movementId).map(entry => [entry.payment.movementId, entry]));
  const linked = new Set<Row>();
  const movementsById = new Map(financialMovements.map(movement => [movement.id, movement]));

  function receipt({ charge, payment, advance, movement }: { charge?: Row; payment?: Row; advance?: Row; movement?: Row }): Receipt {
    const originDocument = field(charge?.invoiceNumber);
    const reference = field(movement?.referenceNumber) || field(payment?.reference) || field(advance?.reference);
    const accountId = field(movement?.bankAccountId || payment?.bankAccountId || advance?.bankAccountId);
    const destination = accounts.get(accountId);
    const accountName = field(movement?.bankAccountName || payment?.bankAccountName || advance?.bankAccountName || destination?.bankName);
    const suffix = field(destination?.accountNumber).slice(-4);
    const applied = new Set<string>();
    if (originDocument && payment?.status !== "reversed" && charge?.status !== "anulado") applied.add(originDocument);
    for (const application of advance?.applications || []) {
      if (application.status !== "reversed" && field(application.invoiceNumber)) applied.add(field(application.invoiceNumber));
    }
    return {
      id: field(movement?.id || payment?.id || advance?.id),
      movementId: field(movement?.id),
      date: field(movement?.date || payment?.date || advance?.date).slice(0, 10),
      amount: money(cents(movement?.amount ?? payment?.amount ?? advance?.amount)),
      reference,
      method: field(movement?.paymentMethod || payment?.method || advance?.method),
      accountId,
      account: accountName && suffix && destination?.accountType !== "caja_efectivo" ? accountName + " · ••••" + suffix : accountName,
      client: field(charge?.clientName || advance?.clientName || movement?.description),
      ruc: field(charge?.clientRuc || advance?.clientRuc),
      originDocument,
      documents: [...applied].join(", "),
      kind: movement?.category === "anticipo_cliente" || !movement && !payment ? "Anticipo" : "Cobro",
      status: !movement ? "Sin movimiento vinculado" : !reference ? "Sin comprobante" : reference === originDocument ? "Revisar referencia de venta" : "Con comprobante",
    };
  }

  const rows = externalCash(financialMovements)
    .filter(movement => movement.type === "ingreso" && cents(movement.amount) > 0 && ["cobro_cliente", "anticipo_cliente"].includes(movement.category))
    .map(movement => {
      const direct = movement.category === "cobro_cliente";
      const entry = direct ? paymentsByMovement.get(movement.id) || paymentsById.get(movement.relatedEntityId) : undefined;
      const advance = direct ? released.get(entry?.payment.id || movement.relatedEntityId) : advancesByMovement.get(movement.id) || advances.get(movement.relatedEntityId);
      if (entry) linked.add(entry.payment);
      if (advance) linked.add(advance);
      return receipt({ movement, charge: entry?.charge || charges.get(movement.chargeId), payment: entry?.payment, advance });
    });

  for (const { charge, payment } of payments) {
    if (!linked.has(payment) && !movementsById.has(payment.movementId) && !payment.advanceId && payment.status !== "reversed" && charge.status !== "anulado" && cents(payment.amount) > 0) {
      rows.push(receipt({ charge, payment }));
    }
  }
  for (const advance of clientAdvances) {
    if (!linked.has(advance) && !movementsById.has(advance.movementId) && !advance.sourcePaymentId && !advance.deletedAt && advance.status !== "anulado" && cents(advance.amount) > 0) {
      rows.push(receipt({ advance }));
    }
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}
