import test from "node:test";
import assert from "node:assert/strict";
import { bankTransferDetailsSchema, emptyBankTransferDetails, printableBankTransferDetails } from "./bank-transfer-details.ts";
import { schemas } from "./server/schemas.ts";
import { quoteCompanyDetails } from "./quote-company.ts";

test("quotes omit unconfigured or disabled bank instructions", () => {
  assert.equal(printableBankTransferDetails(undefined), null);
  assert.equal(printableBankTransferDetails(emptyBankTransferDetails()), null);
  assert.equal(printableBankTransferDetails({ ...emptyBankTransferDetails(), enabled: true }), null);
});

test("commercial users receive printable company data without fiscal, certificate or SMTP settings", () => {
  const bank = { ...emptyBankTransferDetails(), bankName: "BANCO QA" };
  const company = quoteCompanyDetails({ id: "company", razonSocial: "QA", ruc: "0012345678001", bankTransferDetails: bank,
    obligadoContabilidad: true, tipoContribuyente: "general", certificadoBase64: "private-certificate", emailUser: "smtp-user", ambiente: "2" });
  assert.deepEqual(company, { id: "company", razonSocial: "QA", ruc: "0012345678001", bankTransferDetails: bank });
});

test("bank instructions preserve account leading zeros and are validated by the server", () => {
  const value = { enabled: true, bankName: " BANCO QA ", accountType: "ahorros" as const, accountNumber: "00123456",
    holderName: "TITULAR QA", holderIdentification: "0012345678", confirmationEmail: "qa@example.test" };
  const parsed = bankTransferDetailsSchema.parse(value);
  assert.equal(parsed.accountNumber, "00123456");
  assert.equal(parsed.bankName, "BANCO QA");
  assert.deepEqual(printableBankTransferDetails(value), parsed);
  assert.equal(schemas.sriCompanyConfig.safeParse({ ruc: "0012345678001", razonSocial: "QA", bankTransferDetails: value }).success, true);
  assert.equal(schemas.sriCompanyConfig.safeParse({ ruc: "0012345678001", razonSocial: "QA", bankTransferDetails: { ...value, accountNumber: "" } }).success, false);
  assert.equal(bankTransferDetailsSchema.safeParse({ ...value, confirmationEmail: "correo inválido" }).success, false);
});
