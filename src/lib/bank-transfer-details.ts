import { z } from "zod";
import type { BankTransferDetails } from "@/types";

export const emptyBankTransferDetails = (): BankTransferDetails => ({ enabled: false, bankName: "", accountType: "", accountNumber: "", holderName: "", holderIdentification: "", confirmationEmail: "" });

export const bankTransferDetailsSchema = z.object({
  enabled: z.boolean(), bankName: z.string().trim().max(150), accountType: z.enum(["", "corriente", "ahorros"]),
  accountNumber: z.string().trim().max(60), holderName: z.string().trim().max(200),
  holderIdentification: z.string().trim().max(30), confirmationEmail: z.string().trim().max(254).email().or(z.literal("")),
}).superRefine((value, context) => {
  if (!value.enabled) return;
  for (const field of ["bankName", "accountType", "accountNumber", "holderName", "holderIdentification"] as const) {
    if (!value[field]) context.addIssue({ code: "custom", path: [field], message: "Completa los datos bancarios antes de mostrarlos en cotizaciones." });
  }
});

export function printableBankTransferDetails(value?: BankTransferDetails) {
  const parsed = bankTransferDetailsSchema.safeParse(value);
  return parsed.success && parsed.data.enabled ? parsed.data : null;
}
