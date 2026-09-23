/** Splits a query into terms; "quoted phrases" stay together. */
export function parseQuery(q: string): string[] {
  const terms: string[] = [];
  for (const m of q.matchAll(/"([^"]+)"|(\S+)/g)) {
    const t = (m[1] ?? m[2]).trim();
    if (t && !terms.some((x) => x.toLowerCase() === t.toLowerCase())) terms.push(t);
  }
  return terms.slice(0, 8);
}

/** Prisma filter: every term must appear in at least one of the fields (case-insensitive substring). */
export function allTermsIn(terms: string[], fields: string[]) {
  return {
    AND: terms.map((t) => ({
      OR: fields.map((f) => ({ [f]: { contains: t, mode: "insensitive" as const } })),
    })),
  };
}

/** Splits text into [plain, match, plain, ...] segments for highlighting. */
export function splitMatches(text: string, terms: string[]): { text: string; match: boolean }[] {
  if (terms.length === 0 || !text) return [{ text, match: false }];
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(${escaped.join("|")})`, "gi");
  return text
    .split(re)
    .filter(Boolean)
    .map((part) => ({ text: part, match: terms.some((t) => t.toLowerCase() === part.toLowerCase()) }));
}
