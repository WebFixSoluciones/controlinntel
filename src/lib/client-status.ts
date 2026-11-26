export function matchesClientStatus(client: { status: string }, filter: string = "vigentes") {
  if (filter === "vigentes") return client.status !== "retirado";
  return filter === "todos" || client.status === filter;
}

export function clientStatusLabel(status: string) {
  return ({ activo: "Activo", suspendido: "Suspendido", retirado: "Retirado", inactivo: "Inactivo" } as Record<string, string>)[status] || "Sin estado";
}

export function activeClientServices<T extends { clientId: string; status: string }>(services: readonly T[], clientId: string) {
  return services.filter(service => service.clientId === clientId && service.status === "activo");
}
