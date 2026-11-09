export interface SearchableClient {
  id: string;
  businessName: string;
  identificationNumber: string;
  tradeName?: string;
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("es").trim();
}

export function searchClients<T extends SearchableClient>(clients: readonly T[], query: string): T[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  return clients.filter(client => {
    const text = normalize(`${client.businessName} ${client.tradeName || ""} ${client.identificationNumber}`);
    return terms.every(term => text.includes(term));
  }).sort((a, b) => a.businessName.localeCompare(b.businessName, "es", { numeric: true }));
}
