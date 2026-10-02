"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Plus, ShoppingCart } from "lucide-react";
import { Badge, Button, Input, Select } from "@/components/ui";
import { DEFAULT_UNIT, fmtNum, INGREDIENT_TYPES } from "@/lib/brewing";
import { findMatch, suggestMatches } from "@/lib/ingredient-match";
import type { Shortage } from "@/lib/inventory";
import { useI18n } from "@/lib/i18n/client";
import type { IngredientType } from "@/generated/prisma/enums";
import type { PickerIngredient } from "./recipe-editor";

/** One ingredient name the recipe uses that isn't in the ingredient list yet. */
export type NewItem = { key: string; name: string; type: IngredientType; uses: number };

export type NewItemResult = {
  key: string;
  name: string;
  type: IngredientType;
  /** Use this existing ingredient instead of creating one. */
  matchId: number | null;
  /** "I have it": amount on hand, in the type's default unit. */
  have: number | null;
};

type Draft = NewItemResult & { original: string; uses: number; haveOn: boolean; haveText: string };

/**
 * Shown before saving a recipe that would create ingredients: fix names, link to an existing
 * ingredient instead, and optionally record how much is already on hand.
 */
export function NewIngredientsDialog({
  open,
  items,
  ingredients,
  shortages,
  onConfirm,
  onClose,
}: {
  open: boolean;
  items: NewItem[];
  ingredients: PickerIngredient[];
  shortages: Shortage[];
  onConfirm: (results: NewItemResult[]) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setDrafts(items.map((i) => ({ ...i, original: i.name, matchId: null, have: null, haveOn: false, haveText: "" })));
      d.showModal();
    } else if (!open && d.open) d.close();
  }, [open, items]);

  const update = (key: string, patch: Partial<Draft>) =>
    setDrafts((list) => list.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const label = (i: PickerIngredient) => (i.brand ? `${i.name} (${i.brand})` : i.name);
  const typeLabel = (type: IngredientType) => t(INGREDIENT_TYPES.find((x) => x.value === type)?.label ?? type);
  const invalid = drafts.some((d) => d.matchId == null && !d.name.trim());

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="new-ingredients-title"
      className="m-auto w-[calc(100%-2rem)] max-w-xl rounded-lg border border-border bg-card p-0 text-foreground backdrop:bg-black/50"
    >
      <div className="flex max-h-[85vh] flex-col">
        <div className="border-b border-border p-4">
          <h2 id="new-ingredients-title" className="text-lg font-semibold">
            {t("{n} ingredient(s) not in your list", { n: drafts.length })}
          </h2>
          <p className="text-sm text-muted-foreground">{t("Check the names, then confirm to add them.")}</p>
        </div>

        <ul className="flex flex-col divide-y divide-border overflow-y-auto px-4">
          {drafts.map((d) => {
            const matched = d.matchId != null ? byId.get(d.matchId) : undefined;
            const exact = matched ? null : findMatch(d.name, d.type, ingredients);
            const similar = matched ? [] : suggestMatches(d.name, d.type, ingredients).filter((s) => s.id !== exact?.id);
            return (
              <li key={d.key} className="flex flex-col gap-2 py-3">
                <div className="text-xs text-muted-foreground">
                  {t("Name in recipe")}: <span className="font-medium text-foreground">{d.original}</span>
                  {d.uses > 1 && ` · ${t("used {n} times", { n: d.uses })}`}
                </div>
                {matched ? (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Check className="size-4 text-primary" aria-hidden />
                    {t("Use “{name}” from your list", { name: label(matched) })}
                    <Button type="button" variant="ghost" className="min-h-8 px-2 text-xs underline" onClick={() => update(d.key, { matchId: null })}>
                      {t("Create new instead")}
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-[1fr_8rem] gap-2">
                      <Input
                        aria-label={t("Ingredient name")}
                        value={d.name}
                        required
                        onChange={(e) => update(d.key, { name: e.target.value })}
                      />
                      <Select aria-label={t("Type")} value={d.type} onChange={(e) => update(d.key, { type: e.target.value as IngredientType })}>
                        {INGREDIENT_TYPES.map((x) => (
                          <option key={x.value} value={x.value}>
                            {t(x.label)}
                          </option>
                        ))}
                      </Select>
                    </div>
                    {(exact || similar.length > 0) && (
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="text-muted-foreground">💡 {exact ? t("Found in your list:") : t("Similar:")}</span>
                        {[exact, ...similar].filter(Boolean).map((s) => (
                          <Button
                            key={s!.id}
                            type="button"
                            variant="secondary"
                            className="min-h-8 px-2 text-xs"
                            onClick={() => update(d.key, { matchId: s!.id })}
                          >
                            {t("Use “{name}”", { name: label(s!) })}
                          </Button>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge>
                        <Plus className="mr-0.5 size-3" aria-hidden />
                        {t("new {type}", { type: typeLabel(d.type).toLowerCase() })}
                      </Badge>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={d.haveOn} onChange={(e) => update(d.key, { haveOn: e.target.checked })} />
                        {t("I have it:")}
                      </label>
                      {d.haveOn && (
                        <span className="flex items-center gap-1">
                          <Input
                            aria-label={t("Amount on hand")}
                            type="number"
                            step="any"
                            min="0"
                            className="w-24"
                            value={d.haveText}
                            onChange={(e) => update(d.key, { haveText: e.target.value })}
                          />
                          {DEFAULT_UNIT[d.type]}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>

        {shortages.length > 0 && (
          <div className="border-t border-border bg-warning-bg p-4 text-sm">
            <div className="mb-1 flex items-center gap-1.5 font-medium">
              <ShoppingCart className="size-4" aria-hidden /> {t("Short in stock")}
            </div>
            <ul>
              {shortages.map((s) => (
                <li key={s.ingredientId} className="tabular-nums">
                  {t("{name}: have {have} · need {need} · short {short}", {
                    name: s.name,
                    have: fmtNum(Math.round(s.have * 100) / 100, s.unit),
                    need: fmtNum(Math.round(s.need * 100) / 100, s.unit),
                    short: fmtNum(Math.round(s.short * 100) / 100, s.unit),
                  })}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 border-t border-border p-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("Back to edit")}
          </Button>
          <Button
            type="button"
            disabled={invalid}
            onClick={() =>
              onConfirm(
                drafts.map((d) => {
                  const have = d.haveOn && d.haveText.trim() !== "" ? Number(d.haveText) : null;
                  return {
                    key: d.key,
                    name: d.name.trim(),
                    type: d.type,
                    matchId: d.matchId,
                    have: have != null && Number.isFinite(have) && have >= 0 ? have : null,
                  };
                }),
              )
            }
          >
            {t("Confirm & save recipe")}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
