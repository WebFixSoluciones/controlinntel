import type { NodeSystemService } from "@/types";

export type NodeSystemChanges = Pick<NodeSystemService, "systemName" | "linkOrIp" | "username" | "password" | "notes">;

export function updateNodeSystem(services: NodeSystemService[], id: string, changes: NodeSystemChanges): NodeSystemService[] {
  if (!services.some(service => service.id === id)) throw new Error("El sistema seleccionado ya no está disponible.");
  if (!changes.systemName.trim()) throw new Error("Ingresa el nombre del sistema o equipo.");
  return services.map(service => service.id !== id ? service : {
    ...service,
    systemName: changes.systemName.trim(),
    linkOrIp: changes.linkOrIp.trim(),
    username: changes.username?.trim() || "",
    notes: changes.notes?.trim() || "",
    // An empty field means keep the existing sealed or unsaved password.
    ...(changes.password ? { password: changes.password, hasPassword: true } : {}),
  });
}
