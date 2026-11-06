import type { TicketDepartmentRecord } from "@/types";

export const DEFAULT_TICKET_DEPARTMENT = "soporte_tecnico";
export const DEFAULT_TICKET_DEPARTMENTS: readonly TicketDepartmentRecord[] = [
  { id: DEFAULT_TICKET_DEPARTMENT, name: "Soporte Técnico NOC", active: true },
  { id: "noc_redes", name: "NOC / Planta Externa", active: true },
  { id: "facturacion", name: "Facturación y Cobranzas", active: true },
  { id: "ventas", name: "Ventas y Nuevos Servicios", active: true },
];

export function resolveTicketDepartments(rows: TicketDepartmentRecord[]) {
  const byId = new Map(DEFAULT_TICKET_DEPARTMENTS.map(row => [row.id, row]));
  rows.forEach(row => byId.set(row.id, row));
  return [...byId.values()];
}

export function departmentLabel(departments: TicketDepartmentRecord[], id = DEFAULT_TICKET_DEPARTMENT) {
  return departments.find(row => row.id === id)?.name || id.replaceAll("_", " ");
}
