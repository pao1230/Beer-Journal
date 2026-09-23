"use client";

import { useMemo, useState } from "react";
import { Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Button, ButtonLink, Card, CardTitle, Field, Input, Select, Textarea } from "@/components/ui";
import { abv, DEFAULT_STAGE, fmtAbv, INGREDIENT_TYPES, STAGES, UNITS } from "@/lib/brewing";
import { calcRecipe } from "@/lib/calc";
import { CalcTable } from "@/components/calc-card";
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

export type IngredientRow = {
  key: string;
  ingredientId: number;
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

const DEFAULT_UNIT: Record<IngredientType, string> = {
  GRAIN: "kg",
  HOP: "g",
  YEAST: "pkg",
  WATER: "g",
  OTHER: "g",
};

let keySeq = 0;
const newKey = () => `new-${++keySeq}`;

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
  const [pickId, setPickId] = useState("");
  const [pickAmount, setPickAmount] = useState("");

  const byId = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients]);
  const pickable = ingredients.filter((i) => i.type === pickType && !i.isArchived);
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
      const ing = byId.get(r.ingredientId);
      const amount = toNum(r.amount);
      if (!ing || amount == null) return [];
      return [{ ...ing, amount, unit: r.unit, stage: r.stage, additionTime: toNum(r.additionTime) }];
    }),
  });

  function addRow() {
    const id = Number(pickId || pickable[0]?.id);
    if (!id) return;
    setRows((r) => [
      ...r,
      {
        key: newKey(),
        ingredientId: id,
        amount: pickAmount,
        unit: DEFAULT_UNIT[pickType],
        stage: DEFAULT_STAGE[pickType],
        additionTime: pickType === "HOP" ? "60" : "",
        notes: "",
      },
    ]);
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
        <CardTitle>Basics</CardTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Recipe name">
            <Input name="name" required defaultValue={initial.name} placeholder="Sweet Stout" />
          </Field>
          <Field label="Style">
            <Input name="style" defaultValue={initial.style} placeholder="Sweet Stout" />
          </Field>
          <Field label="Equipment profile">
            <Select name="equipmentProfileId" value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)}>
              <option value="">None</option>
              {equipment.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Batch size (L)">
              <Input name="batchSize" type="number" step="0.1" min="0" required value={batchSize} onChange={(e) => setBatchSize(e.target.value)} />
            </Field>
            <Field label="Boil time (min)">
              <Input name="boilTime" type="number" step="1" min="0" defaultValue={initial.boilTime} />
            </Field>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>Targets</CardTitle>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="OG">
            <Input name="targetOg" type="number" step="0.001" min="0.99" max="1.2" value={og} onChange={(e) => setOg(e.target.value)} placeholder="1.074" />
          </Field>
          <Field label="FG">
            <Input name="targetFg" type="number" step="0.001" min="0.99" max="1.2" value={fg} onChange={(e) => setFg(e.target.value)} placeholder="1.026" />
          </Field>
          <Field label="ABV" hint="Calculated from OG/FG">
            <div className="flex min-h-10 items-center text-sm font-semibold">{fmtAbv(targetAbv)}</div>
          </Field>
          <Field label="IBU">
            <Input name="targetIbu" type="number" step="1" min="0" value={ibu} onChange={(e) => setIbu(e.target.value)} />
          </Field>
          <Field label="SRM">
            <Input name="targetSrm" type="number" step="1" min="0" value={srm} onChange={(e) => setSrm(e.target.value)} />
          </Field>
          <Field label="Carbonation (vol CO2)">
            <Input name="targetCarbonation" type="number" step="0.1" min="0" defaultValue={v(initial.targetCarbonation)} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardTitle>Ingredients</CardTitle>
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-[8rem_1fr_7rem_auto]">
          <Select
            aria-label="Type"
            value={pickType}
            onChange={(e) => {
              setPickType(e.target.value as IngredientType);
              setPickId("");
            }}
          >
            {INGREDIENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
          <Select aria-label="Ingredient" value={pickId} onChange={(e) => setPickId(e.target.value)}>
            {pickable.length === 0 && <option value="">No {pickType.toLowerCase()} ingredients yet</option>}
            {pickable.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
                {i.brand ? ` (${i.brand})` : ""}
              </option>
            ))}
          </Select>
          <Input
            aria-label="Amount"
            type="number"
            step="any"
            min="0"
            placeholder={`Amount (${DEFAULT_UNIT[pickType]})`}
            value={pickAmount}
            onChange={(e) => setPickAmount(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addRow();
              }
            }}
          />
          <Button type="button" variant="secondary" onClick={addRow} disabled={pickable.length === 0}>
            Add
          </Button>
        </div>
        <p className="-mt-2 mb-3 text-xs text-muted-foreground">
          Missing something? <a className="underline" href={`/ingredients/new?type=${pickType}`} target="_blank">Create an ingredient</a> in a new tab, then reload this page.
        </p>

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No ingredients yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row, idx) => {
              const ing = byId.get(row.ingredientId);
              return (
                <li key={row.key} className="grid grid-cols-2 gap-2 py-3 sm:grid-cols-[1fr_6rem_5rem_8rem_5rem_auto] sm:items-center">
                  <div className="col-span-2 sm:col-span-1">
                    <div className="font-medium">{ing?.name ?? "Unknown ingredient"}</div>
                    <div className="text-xs text-muted-foreground">
                      {ing && INGREDIENT_TYPES.find((t) => t.value === ing.type)?.label}
                      {ing?.brand ? ` · ${ing.brand}` : ""}
                      {ing?.isArchived ? " · archived" : ""}
                    </div>
                  </div>
                  <Input aria-label="Amount" type="number" step="any" min="0" required value={row.amount} onChange={(e) => update(row.key, { amount: e.target.value })} />
                  <Select aria-label="Unit" value={row.unit} onChange={(e) => update(row.key, { unit: e.target.value })}>
                    {UNITS.map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </Select>
                  <Select aria-label="Stage" value={row.stage} onChange={(e) => update(row.key, { stage: e.target.value as AdditionStage })}>
                    {STAGES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                  <Input
                    aria-label={row.stage === "DRY_HOP" ? "Day" : "Time (min)"}
                    type="number"
                    step="1"
                    min="0"
                    placeholder={row.stage === "DRY_HOP" ? "day" : "min"}
                    value={row.additionTime}
                    onChange={(e) => update(row.key, { additionTime: e.target.value })}
                  />
                  <div className="flex gap-1">
                    <Button type="button" variant="ghost" aria-label="Move up" disabled={idx === 0} onClick={() => setRows((r) => move(r, idx, -1))}>
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button type="button" variant="ghost" aria-label="Move down" disabled={idx === rows.length - 1} onClick={() => setRows((r) => move(r, idx, 1))}>
                      <ArrowDown className="size-4" />
                    </Button>
                    <Button type="button" variant="ghost" aria-label="Remove" onClick={() => setRows((r) => r.filter((x) => x.key !== row.key))}>
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
        <CardTitle>Calculated (live)</CardTitle>
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
              + Step
            </Button>
          }
        >
          Mash schedule
        </CardTitle>
        {mash.length === 0 && <p className="text-sm text-muted-foreground">No mash steps (extract brew?).</p>}
        <ol className="flex flex-col gap-2">
          {mash.map((m, idx) => (
            <li key={m.key} className="grid grid-cols-[1.5rem_1fr_5rem_5rem_auto] items-center gap-2">
              <span className="text-sm text-muted-foreground">{idx + 1}.</span>
              <Input aria-label="Step name" placeholder="Saccharification" required value={m.name} onChange={(e) => updateMash(m.key, { name: e.target.value })} />
              <Input aria-label="Temperature °C" type="number" step="0.1" placeholder="°C" required value={m.temperature} onChange={(e) => updateMash(m.key, { temperature: e.target.value })} />
              <Input aria-label="Time min" type="number" step="1" placeholder="min" required value={m.timeMin} onChange={(e) => updateMash(m.key, { timeMin: e.target.value })} />
              <Button type="button" variant="ghost" aria-label="Remove step" onClick={() => setMash((list) => list.filter((x) => x.key !== m.key))}>
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ol>
      </Card>

      <Card>
        <CardTitle>Water</CardTitle>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Source">
            <Select name="waterSource" defaultValue={initial.waterSource}>
              <option value="">–</option>
              <option>RO</option>
              <option>Tap</option>
              <option>Bottled</option>
            </Select>
          </Field>
          <Field label="Mash water (L)">
            <Input name="mashWaterL" type="number" step="0.1" min="0" value={mashWater} onChange={(e) => setMashWater(e.target.value)} />
          </Field>
          <Field label="Sparge water (L)">
            <Input name="spargeWaterL" type="number" step="0.1" min="0" value={spargeWater} onChange={(e) => setSpargeWater(e.target.value)} />
          </Field>
          <Field label="Target mash pH">
            <Input name="targetMashPh" type="number" step="0.01" min="0" max="14" defaultValue={v(initial.targetMashPh)} />
          </Field>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Water salts (CaCl2, NaHCO3, …) go in the ingredient list as &ldquo;Water agent&rdquo; with stage Mash or Sparge.
        </p>
      </Card>

      <Card>
        <CardTitle>Notes</CardTitle>
        <div className="grid gap-4">
          <Field label="Recipe notes">
            <Textarea name="notes" defaultValue={initial.notes} />
          </Field>
          {versionInfo && (
            <>
              <Field label="What changed in this version?" hint="Optional — shown in the version history">
                <Input name="versionNotes" placeholder="e.g. lowered strike temp by 1°C" />
              </Field>
              {versionInfo.brewed ? (
                <p className="rounded-md border border-warning-border bg-warning-bg p-3 text-sm">
                  v{versionInfo.current} has already been brewed, so saving creates <strong>v{versionInfo.current + 1}</strong>.
                  Past brews keep the targets and ingredients they were brewed with.
                </p>
              ) : (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="asNewVersion" /> Save as new version (v{versionInfo.current + 1}) instead of updating v{versionInfo.current}
                </label>
              )}
            </>
          )}
        </div>
      </Card>

      <div className="flex gap-2">
        <Button type="submit">Save recipe</Button>
        <ButtonLink href={cancelHref} variant="secondary">
          Cancel
        </ButtonLink>
      </div>
    </ActionForm>
  );
}
