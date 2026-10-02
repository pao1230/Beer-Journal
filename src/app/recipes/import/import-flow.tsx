"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardPaste, FileUp, Link2, Loader2, Plus, RotateCcw, ShoppingCart } from "lucide-react";
import { Button, Card, CardTitle, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import { fmtNum, fmtSg } from "@/lib/brewing";
import { calcRecipe } from "@/lib/calc";
import { findMatch, normalizeName } from "@/lib/ingredient-match";
import { shortages, type Stock } from "@/lib/inventory";
import { useI18n } from "@/lib/i18n/client";
import type { ImportCheck } from "@/lib/import/parse-text";
import { readRecipeFile, readText, type ImportResult } from "@/lib/import/read-file";
import { decodeRecipePayload, type RecipeData } from "@/lib/recipe-file";
import { importRecipe } from "../actions";
import { RecipeEditor, type PickerIngredient, type RecipeInitial } from "../recipe-editor";

type Equipment = { id: number; name: string; batchSize: number; efficiency: number; trubLoss: number };
type ExistingRecipe = { id: number; name: string; version: number };

const s = (n: number | null | undefined) => (n == null ? "" : String(n));

/** Editor rows for imported data: each ingredient linked to one in the list when the name matches. */
function toInitial(data: RecipeData, ingredients: PickerIngredient[], equipment: Equipment[]) {
  const matched: { from: string; to: string }[] = [];
  const rows = data.ingredients.map((i, idx) => {
    const match = findMatch(i.name, i.type, ingredients);
    if (match && match.name !== i.name && !matched.some((m) => m.from === i.name)) matched.push({ from: i.name, to: match.name });
    return {
      key: `imp${idx}`,
      ingredientId: match?.id ?? null,
      newIngredient: match
        ? undefined
        : {
            name: i.name,
            type: i.type,
            specs: {
              brand: i.brand,
              alphaAcid: i.alphaAcid,
              color: i.color,
              potential: i.potential,
              attenuation: i.attenuation,
              unfermentable: i.unfermentable,
            },
          },
      amount: String(i.amount),
      unit: i.unit,
      stage: i.stage,
      additionTime: s(i.additionTime),
      notes: i.notes ?? "",
    };
  });
  const eq = equipment.find((e) => normalizeName(e.name) === normalizeName(data.equipment ?? "")) ?? equipment[0];
  const initial: RecipeInitial = {
    name: data.name,
    style: data.style ?? "",
    notes: data.notes ?? "",
    equipmentProfileId: eq?.id ?? null,
    batchSize: data.batchSize,
    boilTime: data.boilTime,
    targetOg: data.targetOg,
    targetFg: data.targetFg,
    targetIbu: data.targetIbu,
    targetSrm: data.targetSrm,
    targetCarbonation: data.targetCarbonation,
    waterSource: data.waterSource ?? "",
    mashWaterL: data.mashWaterL,
    spargeWaterL: data.spargeWaterL,
    targetMashPh: data.targetMashPh,
    ingredients: rows,
    mashSteps: data.mashSteps.map((m, idx) => ({ key: `impm${idx}`, name: m.name, temperature: String(m.temperature), timeMin: String(m.timeMin) })),
    fermentationSteps: data.fermentationSteps.map((f, idx) => ({
      key: `impf${idx}`,
      name: f.name,
      temperature: s(f.temperature),
      days: s(f.days),
      notes: f.notes ?? "",
    })),
  };
  return { initial, matched, equipment: eq ?? null };
}

export function ImportFlow({
  ingredients,
  equipment,
  stock,
  recipes,
}: {
  ingredients: PickerIngredient[];
  equipment: Equipment[];
  stock: Record<number, Pick<Stock, "stockUnit" | "onHand">>;
  recipes: ExistingRecipe[];
}) {
  const { t } = useI18n();
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pasted, setPasted] = useState("");
  const [dragging, setDragging] = useState(false);
  const [readCount, setReadCount] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const known = useMemo(() => ingredients.map((i) => ({ name: i.name, type: i.type })), [ingredients]);

  async function run(fn: () => Promise<ImportResult>) {
    setBusy(true);
    setError(null);
    try {
      setResult(await fn());
      setReadCount((n) => n + 1);
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError(t(e instanceof Error ? e.message : "Couldn't read this recipe"));
    } finally {
      setBusy(false);
    }
  }

  // A scanned QR code opens this page with the recipe in the link (#code=…), which never reaches the server.
  useEffect(() => {
    const m = /[#&]code=([A-Za-z0-9_-]+)/.exec(window.location.hash);
    if (!m) return;
    history.replaceState(null, "", window.location.pathname);
    void Promise.resolve().then(() =>
      run(async () => ({ data: await decodeRecipePayload(m[1]), checks: [], source: "code", fileName: null })),
    );
    // Only on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (result) {
    return (
      <Review
        key={readCount}
        result={result}
        ingredients={ingredients}
        equipment={equipment}
        stock={stock}
        recipes={recipes}
        onRestart={() => {
          setResult(null);
          setPasted("");
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground" aria-label={t("Steps")}>
        <li className="font-semibold text-foreground">① {t("Choose")}</li>
        <li>② {t("Review & fix")}</li>
        <li>③ {t("Save")}</li>
      </ol>

      <Card>
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) run(() => readRecipeFile(file, known));
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border px-4 py-10 text-center transition hover:bg-muted/50",
            dragging && "border-primary bg-muted",
          )}
        >
          {busy ? <Loader2 className="size-8 animate-spin text-primary" aria-hidden /> : <FileUp className="size-8 text-primary" aria-hidden />}
          <span className="text-base font-semibold">{busy ? t("Reading…") : t("Drop a file here or tap to choose")}</span>
          <span className="text-sm text-muted-foreground">{t("PDF recipe sheet · Brewing Journal recipe file (.json) · text file")}</span>
          <input
            ref={fileInput}
            type="file"
            accept=".pdf,.json,.txt,application/pdf,application/json,text/plain"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) run(() => readRecipeFile(file, known));
            }}
          />
        </label>

        <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> {t("or")} <span className="h-px flex-1 bg-border" />
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t("Paste a recipe")}</span>
          <Textarea
            rows={7}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder={"Galaxy Pale — 23 L, OG 1.050, FG 1.011\nPilsner Malt 4 kg\nMagnum 10 g @ 60 min\nGalaxy 50 g dry hop day 5\nMash 66°C 60 min\nUS-05 1 pack"}
          />
        </label>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{t("From LINE, a website or a note — one ingredient per line works best.")}</span>
          <Button type="button" variant="secondary" disabled={busy || !pasted.trim()} onClick={() => run(() => readText(pasted, known, null, "text"))}>
            <ClipboardPaste className="size-4" /> {t("Read text")}
          </Button>
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded-md border border-warning-border bg-warning-bg p-3 text-sm">
            {error}
          </p>
        )}
      </Card>

      <p className="text-sm text-muted-foreground">
        💡 {t("Nothing is saved until you press Save. Sheets exported from this app import exactly — other PDFs are read as best we can, and you can fix anything in the next step.")}
      </p>
    </div>
  );
}

function Review({
  result,
  ingredients,
  equipment,
  stock,
  recipes,
  onRestart,
}: {
  result: ImportResult;
  ingredients: PickerIngredient[];
  equipment: Equipment[];
  stock: Record<number, Pick<Stock, "stockUnit" | "onHand">>;
  recipes: ExistingRecipe[];
  onRestart: () => void;
}) {
  const { t } = useI18n();
  const { data } = result;
  const { initial, matched, equipment: eq } = useMemo(() => toInitial(data, ingredients, equipment), [data, ingredients, equipment]);
  const existing = recipes.find((r) => normalizeName(r.name) === normalizeName(data.name));
  const [target, setTarget] = useState<number | null>(existing?.id ?? null);

  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const newNames = [...new Set(initial.ingredients.filter((r) => r.newIngredient).map((r) => r.newIngredient!.name))];

  // Does the sheet's OG/IBU agree with what these ingredients give on this equipment?
  const calc = calcRecipe({
    batchSize: data.batchSize,
    targetOg: data.targetOg,
    efficiency: eq?.efficiency ?? null,
    trubLoss: eq?.trubLoss ?? null,
    mashWaterL: data.mashWaterL,
    spargeWaterL: data.spargeWaterL,
    ingredients: data.ingredients.map((i, idx) => {
      const ing = initial.ingredients[idx].ingredientId != null ? byId.get(initial.ingredients[idx].ingredientId!) : undefined;
      return {
        ...i,
        alphaAcid: ing?.alphaAcid ?? i.alphaAcid,
        color: ing?.color ?? i.color,
        potential: ing?.potential ?? i.potential,
        attenuation: ing?.attenuation ?? i.attenuation,
        waterSalt: ing?.waterSalt ?? null,
        unfermentable: ing?.unfermentable ?? i.unfermentable,
      };
    }),
  });
  const numberChecks: ImportCheck[] = [];
  if (data.targetOg != null && calc.og != null && Math.abs(calc.og - data.targetOg) > 0.005) {
    numberChecks.push({
      key: "The sheet says OG {target}, but these grains give {calc} at {eff}% efficiency.",
      vars: { target: fmtSg(data.targetOg), calc: fmtSg(calc.og), eff: calc.efficiency },
    });
  }
  if (data.targetIbu != null && calc.ibu != null && Math.abs(calc.ibu - data.targetIbu) > Math.max(5, data.targetIbu * 0.15)) {
    numberChecks.push({
      key: "The sheet says {target} IBU, but your hops calculate to {calc} IBU — check their alpha acid.",
      vars: { target: Math.round(data.targetIbu), calc: Math.round(calc.ibu) },
    });
  }
  const short = shortages(
    initial.ingredients.flatMap((r, idx) => {
      const ing = r.ingredientId != null ? byId.get(r.ingredientId) : undefined;
      return ing ? [{ ingredientId: ing.id, name: ing.name, amount: data.ingredients[idx].amount, unit: r.unit }] : [];
    }),
    (id) => stock[id],
  );
  const toCheck = [...result.checks, ...numberChecks];
  const sourceLabel = {
    file: t("recipe file"),
    code: t("exported sheet (exact)"),
    pdf: t("PDF"),
    text: t("text"),
  }[result.source];

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground" aria-label={t("Steps")}>
        <li>① {t("Choose")} ✓</li>
        <li className="font-semibold text-foreground">② {t("Review & fix")}</li>
        <li>③ {t("Save")}</li>
      </ol>

      <Card>
        <CardTitle
          action={
            <Button type="button" variant="ghost" onClick={onRestart}>
              <RotateCcw className="size-4" /> {t("Start over")}
            </Button>
          }
        >
          {t("What we found")}
        </CardTitle>
        <p className="flex items-start gap-2 text-sm">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <span>
            {t("Read {i} ingredients, {m} mash steps and {f} fermentation steps from the {source}.", {
              i: data.ingredients.length,
              m: data.mashSteps.length,
              f: data.fermentationSteps.length,
              source: sourceLabel,
            })}
            {result.fileName && <span className="text-muted-foreground"> ({result.fileName})</span>}
          </span>
        </p>

        {toCheck.length > 0 && (
          <div className="mt-3 rounded-md border border-warning-border bg-warning-bg p-3 text-sm">
            <div className="mb-1 flex items-center gap-1.5 font-medium">
              <AlertTriangle className="size-4" aria-hidden /> {t("{n} thing(s) to check", { n: toCheck.length })}
            </div>
            <ul className="list-disc pl-5">
              {toCheck.map((c, idx) => (
                <li key={idx}>
                  {t(c.key, c.vars && Object.fromEntries(Object.entries(c.vars).map(([k, v]) => [k, typeof v === "string" && (k === "field" || k === "type") ? t(v) : v])))}
                </li>
              ))}
            </ul>
          </div>
        )}

        <ul className="mt-3 flex flex-col gap-1.5 text-sm">
          {matched.map((m) => (
            <li key={m.from} className="flex items-start gap-2">
              <Link2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              {t("“{from}” matched to your “{to}”", m)}
            </li>
          ))}
          {newNames.length > 0 && (
            <li className="flex items-start gap-2">
              <Plus className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              {t("{n} new ingredient(s): {names} — you'll confirm them when you save.", { n: newNames.length, names: newNames.join(", ") })}
            </li>
          )}
          {short.length > 0 && (
            <li className="flex items-start gap-2">
              <ShoppingCart className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              {t("Short in stock: {list}", {
                list: short.map((x) => `${x.name} ${fmtNum(Math.round(x.short * 100) / 100, x.unit)}`).join(", "),
              })}
            </li>
          )}
        </ul>
      </Card>

      {existing && (
        <Card>
          <CardTitle>{t("“{name}” is already in your recipes", { name: existing.name })}</CardTitle>
          <div className="flex flex-col gap-2 text-sm">
            <label className="flex items-start gap-2">
              <input type="radio" name="import-target" checked={target === existing.id} onChange={() => setTarget(existing.id)} className="mt-1" />
              <span>
                <b>{t("Save as v{n} of the existing recipe", { n: existing.version + 1 })}</b>
                <span className="block text-muted-foreground">{t("Keeps past brews linked to the same recipe. Its name, style and notes are updated too.")}</span>
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input type="radio" name="import-target" checked={target === null} onChange={() => setTarget(null)} className="mt-1" />
              <b>{t("Create a separate recipe")}</b>
            </label>
          </div>
        </Card>
      )}

      <RecipeEditor
        action={importRecipe}
        initial={initial}
        ingredients={ingredients}
        equipment={equipment}
        stock={stock}
        cancelHref="/recipes"
        hiddenFields={{
          importTarget: target == null ? "" : String(target),
          versionNotes: result.fileName ? `Imported from ${result.fileName}` : "Imported",
        }}
      />
    </div>
  );
}
