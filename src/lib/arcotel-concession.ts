import type { ArcotelConcessionInfo } from "@/types";

export function emptyConcession(): ArcotelConcessionInfo {
  return { titleName: "", titleDate: "", concessionaireCode: "", lastPolicyDate: "", reminderDays: 0, websiteUrl: "", additionalFields: [] };
}

/** Omit only the exact legacy demo fingerprint; never clear real concession data. */
export function normalizeConcession(value?: Partial<ArcotelConcessionInfo> | null): ArcotelConcessionInfo {
  if (!value) return emptyConcession();
  const demo = value.titleName === "Permiso Único para Prestación de Servicios del Régimen General de Telecomunicaciones"
    && value.titleDate === "2020-08-15" && value.concessionaireCode === "CON-SVA-2024-089"
    && value.lastPolicyDate === "2026-06-15" && value.websiteUrl === "https://www.inntelcorp.com";
  if (!demo) return { ...emptyConcession(), ...value };
  const additionalFields = (value.additionalFields || []).filter(field => !(
    field.id === "f-1" && field.label === "Número de Trámite Quipux" && field.value === "ARCOTEL-CZT4-2026-0422-M"
    || field.id === "f-2" && field.label === "Resolución ARCOTEL Matriz" && field.value === "ARCOTEL-2020-0582-R"
  ));
  return { ...emptyConcession(), additionalFields };
}
