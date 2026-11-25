export function normalizeSearchText(value: unknown): string {
  return String(value ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("es").trim();
}

const compactIdentifier = (value: string) => value.replace(/[\s./_-]+/g, "");

export function createSearchMatcher(query: string): (...values: unknown[]) => boolean {
  const text = normalizeSearchText(query);
  if (!text) return () => true;

  const terms = text.split(/\s+/);
  const identifier = /\d/.test(text) ? compactIdentifier(text) : "";
  const numbersOnly = /^[\d\s./_-]+$/.test(text) && Boolean(identifier);

  return (...values) => {
    const fields = values.map(normalizeSearchText);
    if (fields.some(field => field.includes(text) || Boolean(identifier && compactIdentifier(field).includes(identifier)))) return true;
    return !numbersOnly && terms.length > 1 && terms.every(term => fields.some(field => field.includes(term)));
  };
}
