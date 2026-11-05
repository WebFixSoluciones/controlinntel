import type { ZodIssue } from "zod";

export interface FieldError { path: string; message: string }

/** Return field guidance, never the rejected values (which can be passwords). */
export function validationIssues(issues: ZodIssue[]): FieldError[] {
  return issues.slice(0, 25).map(issue => {
    let message = "Revisa este campo.";
    if (issue.code === "invalid_type") message = issue.expected === "number" ? "Ingresa un número válido." : "Completa este campo con un valor válido.";
    else if (issue.code === "invalid_enum_value") message = "Selecciona una opción válida.";
    else if (issue.code === "too_small") message = issue.type === "number" ? `El valor mínimo es ${issue.minimum}.` : issue.type === "array" ? `Agrega al menos ${issue.minimum} elemento(s).` : "Completa este campo.";
    else if (issue.code === "too_big") message = issue.type === "number" ? `El valor máximo es ${issue.maximum}.` : `El límite es ${issue.maximum} ${issue.type === "array" ? "elementos" : "caracteres"}.`;
    else if (issue.code === "custom") message = issue.message;
    else if (issue.code === "invalid_string") message = "Revisa el formato de este campo.";
    return { path: issue.path.map(String).join("."), message };
  });
}
