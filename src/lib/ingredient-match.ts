import type { IngredientType } from "@/generated/prisma/enums";

// Words that describe the form of an ingredient rather than which one it is.
const GENERIC = new Set(["hop", "hops", "pellet", "pellets", "malt", "malts", "yeast", "dry", "ฮอป", "มอลต์", "ยีสต์"]);

export function normalizeName(s: string) {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function core(s: string) {
  const tokens = normalizeName(s).split(" ").filter(Boolean);
  const kept = tokens.filter((t) => !GENERIC.has(t));
  return kept.length ? kept : tokens;
}

/** How alike two ingredient names are, 0–1. "Citra Hop" vs "Citra" is 1; "US05" vs "US-05" is 0.95. */
export function nameScore(a: string, b: string) {
  const ca = core(a);
  const cb = core(b);
  if (ca.length === 0 || cb.length === 0) return 0;
  if (ca.join(" ") === cb.join(" ")) return 1;
  if (ca.join("") === cb.join("")) return 0.95;
  const sb = new Set(cb);
  const shared = new Set(ca.filter((t) => sb.has(t))).size;
  return (2 * shared) / (new Set(ca).size + sb.size);
}

export type MatchCandidate = { id: number; name: string; type: IngredientType; brand: string | null; isArchived: boolean };

const scored = <T extends MatchCandidate>(name: string, list: T[]) =>
  list.map((c) => ({ c, score: Math.max(nameScore(name, c.name), c.brand ? nameScore(name, `${c.brand} ${c.name}`) : 0) }));

/** The ingredient this name almost certainly means (same type, near-identical name), if any. */
export function findMatch<T extends MatchCandidate>(name: string, type: IngredientType, list: T[]): T | null {
  const best = scored(
    name,
    list.filter((c) => c.type === type),
  )
    .filter((x) => x.score >= 0.95)
    .sort((a, b) => b.score - a.score || Number(a.c.isArchived) - Number(b.c.isArchived));
  return best[0]?.c ?? null;
}

/** Similar ingredients of the same type, best first, for "Did you mean…?". */
export function suggestMatches<T extends MatchCandidate>(name: string, type: IngredientType, list: T[], limit = 3): T[] {
  return scored(
    name,
    list.filter((c) => c.type === type && !c.isArchived),
  )
    .filter((x) => x.score >= 0.5)
    .sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name))
    .slice(0, limit)
    .map((x) => x.c);
}
