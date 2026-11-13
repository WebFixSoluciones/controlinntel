import type { UserProfile } from "@/types";
import { canAccessSubmodule, canUser } from "./permissions.ts";

export interface ExpenseCategory {
  id: string;
  name: string;
  active: boolean;
}

export const defaultExpenseCategories: ExpenseCategory[] = [
  { id: "enlace_transito", name: "Tránsito IP", active: true },
  { id: "alquiler_nodo", name: "Alquiler de torre o nodo", active: true },
  { id: "fibra_equipos", name: "Fibra y equipos", active: true },
  { id: "mantenimiento", name: "Mantenimiento", active: true },
  { id: "seguros", name: "Seguros", active: true },
  { id: "otro", name: "Otros gastos", active: true },
];

export function expenseCategoriesWithDefaults(records: ExpenseCategory[] = []): ExpenseCategory[] {
  return [...new Map([...defaultExpenseCategories, ...records].map(category => [category.id, category])).values()];
}

export function canManageExpenseCategories(user: UserProfile): boolean {
  if (user.accessRoleId) return canAccessSubmodule(user,"finanzas","gastos") && canUser(user,"finanzas","canManageExpenseCategories");
  return (user.role === "superadmin" || user.role === "admin") &&
    canAccessSubmodule(user, "finanzas", "gastos") && canUser(user, "finanzas", "canRegisterExpenses");
}

export function expenseCategoryKey(name: string): string {
  return name.trim().normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("es");
}
