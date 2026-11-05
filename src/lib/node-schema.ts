import { z } from "zod";
import type { FieldError } from "./validation-issues.ts";

const text = z.string().trim().min(1).max(500);
const capacity = z.number().finite().nonnegative().max(100000000);

export const nodeSchema = z.object({
  name: text,
  address: text,
  totalCapacityMbps: capacity,
  usedCapacityMbps: capacity,
  // Administrative status and legacy network status are both used by existing forms.
  status: z.enum(["activo", "suspendido", "retirado", "reportado", "no_reportado", "online", "offline", "warning"]),
  coordinates: z.object({ lat: z.number().finite().min(-90).max(90), lng: z.number().finite().min(-180).max(180) }).optional(),
  providers: z.array(z.object({ id: text, providerName: text, capacityMbps: capacity }).passthrough()).max(100).optional(),
  services: z.array(z.object({ id: text, systemName: text, linkOrIp: z.string().max(2000).optional(), username: z.string().max(500).optional(), password: z.string().max(4096).optional(), notes: z.string().max(2000).optional() }).passthrough()).max(100).optional(),
}).passthrough();

const labels: Record<string, string> = {
  name: "Nombre de la sede o nodo", address: "Dirección o referencia", status: "Estado",
  province: "Provincia", canton: "Cantón", parish: "Parroquia", detailedAddress: "Dirección detallada",
  totalCapacityMbps: "Capacidad total (Mbps)", usedCapacityMbps: "Capacidad utilizada (Mbps)",
  "coordinates.lat": "Latitud", "coordinates.lng": "Longitud", providerName: "Nombre del proveedor",
  capacityMbps: "Capacidad (Mbps)", systemName: "Nombre del sistema", linkOrIp: "Enlace o IP",
  username: "Usuario", password: "Contraseña", notes: "Notas", clientId: "Cliente",
};
export function nodeField(error: FieldError) {
  const nested = error.path.match(/^(providers|services)\.(\d+)\.(.+)$/);
  const label = nested ? `${nested[1] === "providers" ? "Proveedor" : "Sistema"} ${Number(nested[2]) + 1}: ${labels[nested[3]] || "datos"}` : labels[error.path] || "Datos del nodo";
  const tab = error.path.startsWith("providers") || error.path === "totalCapacityMbps" ? "portadores" : error.path.startsWith("services") ? "servicios" : "general";
  return { ...error, label, tab: tab as "general" | "portadores" | "servicios" };
}
