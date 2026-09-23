"use client";

import { useMemo, useState } from "react";
import { Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Badge, Button, ButtonLink, Card, CardTitle, Field, Input, Select, Textarea } from "@/components/ui";
import { abv, DEFAULT_STAGE, DEFAULT_UNIT, fmtAbv, INGREDIENT_TYPES, STAGES, UNITS } from "@/lib/brewing";
import { calcRecipe } from "@/lib/calc";
import { CalcTable } from "@/components/calc-card";
import { useI18n } from "@/lib/i18n/client";
import type { ActionState } from "@/lib/form";
import type { AdditionStage, IngredientType } from "@/generated/prisma/enums";

export type PickerIngredient = {
  id: number;
  name: string;
  type: IngredientType;
  brand: string | null;
  isArchived: boolean;
  potential: number | null;
  waterSalt: string | null;
  alphaAcid: number | null;
  color: number | null;
  attenuation: number | null;
  unfermentable: boolean;
};

/** A row points at an existing ingredient, or carries a name to create when the recipe is saved. */
export type IngredientRow = {
  key: string;
  ingredientId: number | null;
  newIngredient?: { name: string; type: IngredientType };
  amount: string;
  unit: string;
  stage: AdditionStage;
  additionTime: string;
  notes: string;
};

export type MashRow = { key: string; name: string; temperature: string; timeMin: string };

export type RecipeInitial = {
  name: string;
  style: string;
  notes: string;
  equipmentProfileId: number | null;
  batchSize: number | null;
  boilTime: number;
  targetOg: number | null;
  targetFg: number | null;
  targetIbu: number | null;
  targetSrm: number | null;
  targetCarbonation: number | null;
  waterSource: string;
  mashWaterL: number | null;
  spargeWaterL: number | null;
  targetMashPh: number | null;
  ingredients: IngredientRow[];
  mashSteps: MashRow[];
};

let keySeq = 0;
const newKey = () => `new-${++keySeq}`;

const NO_SPECS = { brand: null, isArchived: false, potential: null, waterSalt: null, alphaAcid: null, color: null, attenuation: null, unfermentable: false };

const toNum = (s: string) => (s.trim() === "" ? null : Number(s));
const v = (n: number | null | undefined) => (n == null ? "" : String(n));

export function RecipeEditor({
  action,
  initial,
  ingredients,
  equipment,
  versionInfo,
  cancelHref,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  initial: RecipeInitial;
  ingredients: PickerIngredient[];
  equipment: { id: number; name: string; batchSize: number; efficiency: number; trubLoss: number }[];
  versionInfo?: { current: number; brewed: boolean };
  cancelHref: string;
}) {
  const { t } = useI18n();
  const [rows, setRows] = useState<IngredientRow[]>(initial.ingredients);
  const [mash, setMash] = useState<MashRow[]>(initial.mashSteps);
  const [og, setOg] = useState(v(initial.targetOg));
  const [fg, setFg] = useState(v(initial.targetFg));
  const [batchSize, setBatchSize] = useState(v(initial.batchSize));
  const [equipmentId, setEquipmentId] = useState(v(initial.equipmentProfileId));
  const [ibu, setIbu] = useState(v(initial.targetIbu));
  const [srm, setSrm] = useState(v(initial.targetSrm));
  const [mashWater, setMashWater] = useState(v(initial.mashWaterL));
  const [spargeWater, setSpargeWater] = useState(v(initial.spargeWaterL));
  const [pickType, setPickType] = useState<IngredientType>("GRAIN");
  const [pickName, setPickName] = useState("");
  const [pickAmount, setPickAmount] = useState("");
  const [pickUnit, setPickUnit] = useState(DEFAULT_UNIT.GRAIN);

  const byId = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients]);
  const pickable = ingredients.filter((i) => i.type === pickType && !i.isArchived);
  const optionLabel = (i: PickerIngredient) => (i.brand ? `${i.name} (${i.brand})` : i.name);
  const typedName = pickName.trim();
  const typed = typedName.toLowerCase();
  const pickMatch =
    pickable.find((i) => optionLabel(i).toLowerCase() === typed) ?? pickable.find((i) => i.name.toLowerCase() === typed);
  const typeLabel = t(INGREDIENT_TYPES.find((x) => x.value === pickType)?.label ?? pickType).toLowerCase();
  const targetAbv = abv(toNum(og), toNum(fg));
  const selectedEquipment = equipment.find((e) => String(e.id) === equipmentId) ?? null;
  const calc = calcRecipe({
    batchSize: toNum(batchSize) ?? 0,
    targetOg: toNum(og),
    efficiency: selectedEquipment?.efficiency ?? null,
    trubLoss: selectedEquipment?.trubLoss ?? null,
    mashWaterL: toNum(mashWater),
    spargeWaterL: toNum(spargeWater),
    ingredients: rows.flatMap((r) => {
      const ing = r.ingredientId != null ? byId.get(r.ingredientId) : undefined;
      const specs = ing ?? (r.newIngredient && { ...NO_SPECS, ...r.newIngredient });
      const amount = toNum(r.amount);
      if (!specs || amount == null) return [];
      return [{ ...specs, amount, unit: r.unit, stage: r.stage, additionTime: toNum(r.additionTime) }];
    }),
  });

  function addRow() {
    if (!typedName) return;
    setRows((r) => [
      ...r,
      {
        key: newKey(),
        ingredientId: pickMatch?.id ?? null,
        newIngredient: pickMatch ? undefined : { name: typedName, type: pickType },
        amount: pickAmount,
        unit: pickUnit,
        stage: DEFAULT_STAGE[pickType],
        additionTime: pickType === "HOP" ? "60" : "",
        notes: "",
      },
    ]);
    setPickName("");
    setPickAmount("");
  }

  const update = (key: string, patch: Partial<IngredientRow>) =>
    setRows((r) => r.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const updateMash = (key: string, patch: Partial<MashRow>) =>
    setMash((m) => m.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const move = <T,>(list: T[], idx: number, dir: -1 | 1) => {
    const next = [...list];
    const [item] = next.splice(idx, 1);
    next.splice(idx + dir, 0, item);
    return next;
  };

  const serializedRows = JSON.stringify(
    rows.map((r) => ({
      ingredientId: r.ingredientId,
      newIngredient: r.newIngredient ?? null,
      amount: toNum(r.amount) ?? 0,
      unit: r.unit,
      stage: r.stage,
      additionTime: toNum(r.additionTime),
      notes: r.notes.trim() || null,
    })),
  );
  const serializedMash = JSON.stringify(
    mash.map((m) => ({
      name: m.name.trim(),
      temperature: toNum(m.temperature) ?? 0,
      timeMin: toNum(m.timeMin) ?? 0,
    })),
  );

  return (
    <ActionForm action={action} className="flex flex-col gap-4">
      <input type="hidden" name="ingredients" value={serializedRows} />
      <input type="hidden" name="mashSteps" value={serializedMash} />

      <Card>
        <CardTitle>{t("Basics")}</CardTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("Recipe name")}>
            <Input name="name" required defaultValue={initial.name} placeholder="Sweet Stout" />
          </Field>
          <Field label={t("Style")}>
            <Input name="style" defaultValue={initial.style} placeholder="Sweet Stout" />
          </Field>
          <Field label={t("Equipment profile")}>
            <Select name="equipmentProfileId" value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)}>
              <option value="">{t("None")}</option>
              {equipment.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("Batch size (L)")}>
              <Input name="batchSize" type="number" step="0.1" min="0" required value={batchSize} onChange={(e) => setBatchSize(e.target.value)} />
            </Field>
            <Field label={t("Boil time (min)")}>
              <Input name="boilTime" type="number" step="1" min="0" defaultValue={initial.boilTime} />
            </Field>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>{t("Targets")}</CardTitle>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="OG">
            <Input name="targetOg" type="number" step="0.001" min="0.99" max="1.2" value={og} onChange={(e) => setOg(e.target.value)} placeholder="1.074" />
          </Field>
          <Field label="FG">
            <Input name="targetFg" type="number" step="0.001" min="0.99" max="1.2" value={fg} onChange={(e) => setFg(e.target.value)} placeholder="1.026" />
          </Field>
          <Field label="ABV" hint={t("Calculated from OG/FG")}>
            <div className="flex min-h-10 items-center text-sm font-semibold">{fmtAbv(targetAbv)}</div>
          </Field>
          <Field label="IBU">
            <Input name="targetIbu" type="number" step="1" min="0" value={ibu} onChange={(e) => setIbu(e.target.value)} />
          </Field>
          <Field label="SRM">
            <Input name="targetSrm" type="number" step="1" min="0" value={srm} onChange={(e) => setSrm(e.target.value)} />
          </Field>
          <Field label={t("Carbonation (vol CO2)")}>
            <Input name="targetCarbonation" type="number" step="0.1" min="0" defaultValue={v(initial.targetCarbonation)} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardTitle>{t("Ingredients")}</CardTitle>
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-[8rem_1fr_6rem_5rem_auto]">
          <Select
            aria-label={t("Type")}
            value={pickType}
            onChange={(e) => {
              const t = e.target.value as IngredientType;
              setPickType(t);
              setPickUnit(DEFAULT_UNIT[t]);
              setPickName("");
            }}
          >
            {INGREDIENT_TYPES.map((x) => (
              <option key={x.value} value={x.value}>
                {t(x.label)}
              </option>
            ))}
          </Select>
          <Input
            aria-label={t("Ingredient")}
            list="ingredient-options"
            autoComplete="off"
            placeholder={pickable.length ? t("Pick or type a {type}", { type: typeLabel }) : t("Type a new {type} name", { type: typeLabel })}
            value={pickName}
            onChange={(e) => setPickName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addRow();
              }
            }}
          />
          <datalist id="ingredient-options">
            {pickable.map((i) => (
              <option key={i.id} value={optionLabel(i)} />
            ))}
          </datalist>
          <Input
            aria-label={t("Amount")}
            type="number"
            step="any"
            min="0"
            placeholder={t("Amount")}
            value={pickAmount}
            onChange={(e) => setPickAmount(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addRow();
              }
            }}
          />
          <Select aria-label={t("Add unit")} value={pickUnit} onChange={(e) => setPickUnit(e.target.value)}>
            {UNITS.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </Select>
          <Button type="button" variant="secondary" onClick={addRow} disabled={!typedName} className="col-span-2 sm:col-span-1">
            {t("Add")}
          </Button>
        </div>
        <p className="-mt-2 mb-3 text-xs text-muted-foreground" aria-live="polite">
          {typedName && !pickMatch ? (
            t("“{name}” will be created as a new {type} when you save. Add its specs (color, alpha acid…) later on the Ingredients page for calculations.", {
              name: typedName,
              type: typeLabel,
            })
          ) : pickable.length ? (
            t("Pick from your ingredients, or type a new name to create one.")
          ) : (
            t("No {type} ingredients yet — type a name to create one.", { type: typeLabel })
          )}
        </p>

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("No ingredients yet.")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row, idx) => {
              const ing = row.ingredientId != null ? byId.get(row.ingredientId) : undefined;
              const rowType = ing?.type ?? row.newIngredient?.type;
              return (
                <li key={row.key} className="grid grid-cols-2 gap-2 py-3 sm:grid-cols-[1fr_6rem_5rem_8rem_5rem_auto] sm:items-center">
                  <div className="col-span-2 sm:col-span-1">
                    <div className="font-medium">
                      {ing?.name ?? row.newIngredient?.name ?? t("Unknown ingredient")}
                      {row.newIngredient && <Badge className="ml-2 align-middle">{t("new")}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {rowType && t(INGREDIENT_TYPES.find((x) => x.value === rowType)?.label ?? rowType)}
                      {ing?.brand ? ` · ${ing.brand}` : ""}
                      {ing?.isArchived ? ` · ${t("archived")}` : ""}
                    </div>
                  </div>
                  <Input aria-label={t("Amount")} type="number" step="any" min="0" required value={row.amount} onChange={(e) => update(row.key, { amount: e.target.value })} />
                  <Select aria-label={t("Unit")} value={row.unit} onChange={(e) => update(row.key, { unit: e.target.value })}>
                    {UNITS.map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </Select>
                  <Select aria-label={t("Stage")} value={row.stage} onChange={(e) => update(row.key, { stage: e.target.value as AdditionStage })}>
                    {STAGES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {t(s.label)}
                      </option>
                    ))}
                  </Select>
                  <Input
                    aria-label={row.stage === "DRY_HOP" ? t("Day") : t("Time (min)")}
                    type="number"
                    step="1"
                    min="0"
                    placeholder={row.stage === "DRY_HOP" ? t("day") : t("min")}
                    value={row.additionTime}
                    onChange={(e) => update(row.key, { additionTime: e.target.value })}
                  />
                  <div className="flex gap-1">
                    <Button type="button" variant="ghost" aria-label={t("Move up")} disabled={idx === 0} onClick={() => setRows((r) => move(r, idx, -1))}>
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button type="button" variant="ghost" aria-label={t("Move down")} disabled={idx === rows.length - 1} onClick={() => setRows((r) => move(r, idx, 1))}>
                      <ArrowDown className="size-4" />
                    </Button>
                    <Button type="button" variant="ghost" aria-label={t("Remove")} onClick={() => setRows((r) => r.filter((x) => x.key !== row.key))}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <CardTitle>{t("Calculated (live)")}</CardTitle>
        <CalcTable calc={calc} targets={{ og: toNum(og), fg: toNum(fg), ibu: toNum(ibu), srm: toNum(srm) }} />
      </Card>

      <Card>
        <CardTitle
          action={
            <Button
              type="button"
              variant="secondary"
              onClick={() => setMash((m) => [...m, { key: newKey(), name: "", temperature: "", timeMin: "" }])}
            >
              {t("+ Step")}
            </Button>
          }
        >
          {t("Mash schedule")}
        </CardTitle>
        {mash.length === 0 && <p className="text-sm text-muted-foreground">{t("No mash steps (extract brew?).")}</p>}
        <ol className="flex flex-col gap-2">
          {mash.map((m, idx) => (
            <li key={m.key} className="grid grid-cols-[1.5rem_1fr_5rem_5rem_auto] items-center gap-2">
              <span className="text-sm text-muted-foreground">{idx + 1}.</span>
              <Input aria-label={t("Step name")} placeholder={t("Saccharification")} required value={m.name} onChange={(e) => updateMash(m.key, { name: e.target.value })} />
              <Input aria-label={t("Temperature °C")} type="number" step="0.1" placeholder="°C" required value={m.temperature} onChange={(e) => updateMash(m.key, { temperature: e.target.value })} />
              <Input aria-label={t("Time min")} type="number" step="1" placeholder={t("min")} required value={m.timeMin} onChange={(e) => updateMash(m.key, { timeMin: e.target.value })} />
              <Button type="button" variant="ghost" aria-label={t("Remove step")} onClick={() => setMash((list) => list.filter((x) => x.key !== m.key))}>
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ol>
      </Card>

      <Card>
        <CardTitle>{t("Water")}</CardTitle>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label={t("Source")}>
            <Select name="waterSource" defaultValue={initial.waterSource}>
              <option value="">–</option>
              <option value="RO">RO</option>
              <option value="Tap">{t("Tap")}</option>
              <option value="Bottled">{t("Bottled")}</option>
            </Select>
          </Field>
          <Field label={t("Mash water (L)")}>
            <Input name="mashWaterL" type="number" step="0.1" min="0" value={mashWater} onChange={(e) => setMashWater(e.target.value)} />
          </Field>
          <Field label={t("Sparge water (L)")}>
            <Input name="spargeWaterL" type="number" step="0.1" min="0" value={spargeWater} onChange={(e) => setSpargeWater(e.target.value)} />
          </Field>
          <Field label={t("Target mash pH")}>
            <Input name="targetMashPh" type="number" step="0.01" min="0" max="14" defaultValue={v(initial.targetMashPh)} />
          </Field>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {t("Water salts (CaCl2, NaHCO3, …) go in the ingredient list as “Water agent” with stage Mash or Sparge.")}
        </p>
      </Card>

      <Card>
        <CardTitle>{t("Notes")}</CardTitle>
        <div className="grid gap-4">
          <Field label={t("Recipe notes")}>
            <Textarea name="notes" defaultValue={initial.notes} />
          </Field>
          {versionInfo && (
            <>
              <Field label={t("What changed in this version?")} hint={t("Optional — shown in the version history")}>
                <Input name="versionNotes" placeholder={t("e.g. lowered strike temp by 1°C")} />
              </Field>
              {versionInfo.brewed ? (
                <p className="rounded-md border border-warning-border bg-warning-bg p-3 text-sm">
                  {t("v{n} has already been brewed, so saving creates v{next}. Past brews keep the targets and ingredients they were brewed with.", {
                    n: versionInfo.current,
                    next: versionInfo.current + 1,
                  })}
                </p>
              ) : (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="asNewVersion" />{" "}
                  {t("Save as new version (v{next}) instead of updating v{n}", { next: versionInfo.current + 1, n: versionInfo.current })}
                </label>
              )}
            </>
          )}
        </div>
      </Card>

      <div className="flex gap-2">
        <Button type="submit">{t("Save recipe")}</Button>
        <ButtonLink href={cancelHref} variant="secondary">
          {t("Cancel")}
        </ButtonLink>
      </div>
    </ActionForm>
  );
}
