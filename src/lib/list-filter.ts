import { INGREDIENT_TYPES } from "@/lib/brewing";
import type { IngredientType } from "@/generated/prisma/enums";

type Param = string | string[] | undefined;

/** Selected ingredient types from `?type=GRAIN&type=HOP`, in display order; unknown values are dropped. */
export function parseTypes(param: Param): IngredientType[] {
  const values = new Set(typeof param === "string" ? [param] : (param ?? []));
  return INGREDIENT_TYPES.map((x) => x.value).filter((v) => values.has(v));
}

/** The type selection after tapping one chip: adds it, or removes it when it was already selected. */
export function toggleType(selected: IngredientType[], type: IngredientType): IngredientType[] {
  const next = selected.includes(type) ? selected.filter((t) => t !== type) : [...selected, type];
  return parseTypes(next);
}

/** `path?…` keeping the other filters, with `type` repeated once per selected type. */
export function filterHref(path: string, params: Record<string, string | undefined>, types: IngredientType[]) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
  for (const t of types) qs.append("type", t);
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}
