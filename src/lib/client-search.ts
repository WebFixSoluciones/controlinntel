import { createSearchMatcher } from "./search.ts";

export interface SearchableClient {
  id: string;
  businessName: string;
  identificationNumber: string;
  tradeName?: string;
  legalRepresentative?: string;
}

export function clientSearchFields(client?: SearchableClient) {
  return [client?.businessName, client?.tradeName, client?.legalRepresentative, client?.identificationNumber];
}

export function searchClients<T extends SearchableClient>(clients: readonly T[], query: string): T[] {
  const matches = createSearchMatcher(query);
  return clients.filter(client => matches(...clientSearchFields(client)))
    .sort((a, b) => (a.businessName || "").localeCompare(b.businessName || "", "es", { numeric: true }));
}
