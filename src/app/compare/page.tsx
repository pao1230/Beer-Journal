import Link from "next/link";
import type { ReactNode } from "react";
import { LineChart } from "@/components/line-chart";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardTitle, Empty, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import {
  abv,
  attenuation,
  batchLabel,
  fermentationSeries,
  fmtAbv,
  fmtNum,
  fmtSg,
  STAGES,
  STEPS,
} from "@/lib/brewing";
import { cn } from "@/lib/utils";
import { brewhouseEfficiency } from "@/lib/calc";
import { fmtMoney, lineCost } from "@/lib/inventory";
import { loadStock } from "@/lib/inventory-data";
import { INGREDIENT_SPECS } from "@/lib/recipe-calc";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Compare brews") };
}

const MAX = 4;

type Row = { label: ReactNode; values: (string | null)[]; always?: boolean };

function differs(values: (string | null)[]) {
  const present = values.filter((v) => v != null && v !== "–");
  return new Set(present).size > 1 || (present.length > 0 && present.length < values.length);
}

async function Section({
  title,
  rows,
  columns,
  onlyDiff,
  footer,
}: {
  title: string;
  rows: Row[];
  columns: number;
  onlyDiff: boolean;
  footer?: ReactNode;
}) {
  const { t } = await getI18n();
  const shown = rows.filter((r) => r.always || !onlyDiff || differs(r.values));
  if (shown.length === 0 && !footer) return null;
  return (
    <>
      <tr>
        <th colSpan={columns + 1} className="bg-card pt-5 pb-1 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {title}
        </th>
      </tr>
      {shown.map((r, i) => {
        const diff = differs(r.values);
        return (
          <tr key={i} className={cn("border-t border-border", diff && "bg-warning-bg")}>
            <th
              scope="row"
              className={cn("sticky left-0 py-1.5 pr-3 pl-1 text-left font-normal text-muted-foreground", diff ? "bg-warning-bg" : "bg-card")}
            >
              {r.label}
              {diff && (
                <span className="ml-1 font-semibold text-foreground" title={t("Differs between brews")}>
                  ≠<span className="sr-only"> {t("differs")}</span>
                </span>
              )}
            </th>
            {r.values.map((v, j) => (
              <td key={j} className="py-1.5 pr-3 tabular-nums">
                {v ?? "–"}
              </td>
            ))}
          </tr>
        );
      })}
      {footer && (
        <tr>
          <td colSpan={columns + 1} className="pt-1 text-xs text-muted-foreground">
            {footer}
          </td>
        </tr>
      )}
    </>
  );
}

export default async function ComparePage(props: PageProps<"/compare">) {
  const sp = await props.searchParams;
  const { t, date } = await getI18n();
  const onlyDiff = sp.diff === "1";
  let ids = [sp.id].flat().map(Number).filter(Number.isInteger);
  const recipeId = Number(sp.recipe);
  if (ids.length === 0 && Number.isInteger(recipeId)) {
    const latest = await db.brewSession.findMany({
      where: { recipeId },
      orderBy: { batchNumber: "desc" },
      take: MAX,
      select: { id: true },
    });
    ids = latest.map((b) => b.id);
  }
  const truncated = ids.length > MAX;
  ids = [...new Set(ids)].slice(0, MAX);

  const [brews, choices] = await Promise.all([
    db.brewSession.findMany({
      where: { id: { in: ids } },
      orderBy: [{ brewDate: "asc" }, { batchNumber: "asc" }],
      include: {
        recipe: { select: { name: true } },
        recipeVersion: { select: { version: true, targetOg: true, targetFg: true } },
        ingredients: { orderBy: { sortOrder: "asc" }, include: { ingredient: INGREDIENT_SPECS } },
        steps: { include: { measurements: { orderBy: { recordedAt: "asc" } }, fermentationLog: { orderBy: { date: "asc" } } } },
        problems: { orderBy: { createdAt: "asc" }, select: { title: true } },
        _count: { select: { lessons: true } },
      },
    }),
    db.brewSession.findMany({
      orderBy: [{ brewDate: "desc" }, { batchNumber: "desc" }],
      take: 40,
      select: { id: true, batchNumber: true, brewDate: true, recipe: { select: { name: true } } },
    }),
  ]);

  const label = (b: (typeof brews)[number]) => batchLabel(b.recipe.name, b.batchNumber);
  const stock = await loadStock([...new Set(brews.flatMap((b) => b.ingredients.flatMap((i) => (i.ingredientId ? [i.ingredientId] : []))))]);
  const economics = brews.map((b) => {
    const used = b.ingredients.map((i) => ({ i, amount: i.actualAmount ?? i.plannedAmount }));
    const efficiency = brewhouseEfficiency(
      b.actualOg,
      b.actualVolume,
      used.flatMap(({ i, amount }) =>
        amount == null || !i.ingredient
          ? []
          : [{ ...i.ingredient, name: i.nameSnapshot, amount, unit: i.unit, stage: i.stage, additionTime: i.additionTime }],
      ),
    );
    const costs = used.map(({ i, amount }) => (i.ingredientId ? lineCost(amount, i.unit, stock.get(i.ingredientId)) : null));
    const cost = costs.some((c) => c != null) ? costs.reduce<number>((s, c) => s + (c ?? 0), 0) : null;
    return { efficiency, cost };
  });
  const n = brews.length;

  const overview: Row[] = [
    { label: t("Recipe"), values: brews.map((b) => `${b.recipe.name} v${b.recipeVersion.version}`) },
    { label: t("Brew date"), values: brews.map((b) => date(b.brewDate)), always: true },
    { label: t("Volume"), values: brews.map((b) => fmtNum(b.actualVolume, "L")) },
    { label: t("Target OG / FG"), values: brews.map((b) => `${fmtSg(b.recipeVersion.targetOg)} / ${fmtSg(b.recipeVersion.targetFg)}`) },
    { label: t("OG"), values: brews.map((b) => fmtSg(b.actualOg)), always: true },
    { label: t("FG"), values: brews.map((b) => fmtSg(b.actualFg)), always: true },
    { label: t("ABV"), values: brews.map((b) => fmtAbv(abv(b.actualOg, b.actualFg))), always: true },
    {
      label: t("Apparent attenuation"),
      values: brews.map((b) => {
        const a = attenuation(b.actualOg, b.actualFg);
        return a == null ? null : `${a.toFixed(0)}%`;
      }),
    },
    { label: t("Brewhouse efficiency"), values: economics.map((e) => (e.efficiency == null ? null : `${e.efficiency.toFixed(0)}%`)) },
    { label: t("Batch cost"), values: economics.map((e) => (e.cost == null ? null : fmtMoney(e.cost))) },
    { label: t("Packaging"), values: brews.map((b) => (b.packagingMethod ? t(b.packagingMethod) : null)) },
    { label: t("Problems"), values: brews.map((b) => String(b.problems.length)), always: true },
    { label: t("Lessons"), values: brews.map((b) => String(b._count.lessons)) },
  ];

  const readings: Row[] = STEPS.flatMap((def) => {
    const types = new Map<string, string | null>();
    for (const p of def.presets) types.set(p.type, p.unit ?? null);
    for (const b of brews)
      for (const m of b.steps.find((s) => s.type === def.type)?.measurements ?? [])
        if (!types.has(m.type)) types.set(m.type, m.unit);
    return [...types].flatMap(([type, unit]) => {
      const values = brews.map((b) => {
        const m = b.steps.find((s) => s.type === def.type)?.measurements.find((x) => x.type === type);
        return m ? fmtNum(m.value, unit ?? m.unit ?? undefined) : null;
      });
      if (values.every((v) => v == null)) return [];
      return [{ label: <><span className="text-xs">{t(def.label)}</span> · {t(type)}</>, values }];
    });
  });

  const ingredientKeys = new Map<string, { name: string; stage: string; time: number | null }>();
  for (const b of brews)
    for (const i of b.ingredients) {
      const key = `${i.nameSnapshot}|${i.stage}|${i.additionTime ?? ""}`;
      if (!ingredientKeys.has(key)) ingredientKeys.set(key, { name: i.nameSnapshot, stage: i.stage, time: i.additionTime });
    }
  const ingredientRows: Row[] = [...ingredientKeys].map(([key, meta]) => ({
    label: (
      <>
        {meta.name}{" "}
        <span className="text-xs">
          ({t(STAGES.find((s) => s.value === meta.stage)?.label ?? meta.stage)}
          {meta.time != null && ` ${meta.time}${meta.stage === "DRY_HOP" ? "d" : "′"}`})
        </span>
      </>
    ),
    values: brews.map((b) => {
      const i = b.ingredients.find((x) => `${x.nameSnapshot}|${x.stage}|${x.additionTime ?? ""}` === key);
      return i ? fmtNum(i.actualAmount ?? i.plannedAmount, i.unit) : null;
    }),
  }));
  const sameIngredients = ingredientRows.filter((r) => !differs(r.values)).length;

  const curves = brews.map((b, slot) => {
    const ferm = b.steps.find((s) => s.type === "FERMENTATION");
    return { name: label(b), slot, ...fermentationSeries(b.brewDate, b.actualOg, ferm?.fermentationLog ?? []) };
  });
  const gravityCurves = curves.filter((c) => c.gravity.length > 0).map((c) => ({ name: c.name, slot: c.slot, points: c.gravity }));
  const tempCurves = curves.filter((c) => c.temperature.length > 0).map((c) => ({ name: c.name, slot: c.slot, points: c.temperature }));

  const query = (extra: Record<string, string>) => {
    const q = new URLSearchParams();
    ids.forEach((id) => q.append("id", String(id)));
    Object.entries(extra).forEach(([k, v]) => v && q.set(k, v));
    return `/compare?${q}`;
  };

  return (
    <>
      <PageHeader
        title={t("Compare brews")}
        subtitle={t("Side by side, to see what changed between batches — not to rank them.")}
      />

      <details open={n === 0} className="mb-4 rounded-lg border border-border bg-card p-4">
        <summary className="cursor-pointer text-sm font-medium">
          {n === 0 ? t("Choose brews to compare") : t("Change selection ({n} of max {max})", { n, max: MAX })}
        </summary>
        {choices.length === 0 ? (
          <Empty>{t("No brews yet.")}</Empty>
        ) : (
          <form className="mt-3 flex flex-col gap-3">
            <div className="grid gap-1 sm:grid-cols-2">
              {choices.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="id" value={c.id} defaultChecked={ids.includes(c.id)} />
                  {batchLabel(c.recipe.name, c.batchNumber)}
                  <span className="text-xs text-muted-foreground">{date(c.brewDate)}</span>
                </label>
              ))}
            </div>
            <div>
              <button className="min-h-10 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">{t("Compare")}</button>
            </div>
          </form>
        )}
      </details>

      {truncated && <p className="mb-3 text-sm text-muted-foreground">{t("Showing the first {n} selected brews.", { n: MAX })}</p>}

      {n > 0 && (
        <>
          {n < 2 && <p className="mb-3 text-sm text-muted-foreground">{t("Pick at least two brews to see differences.")}</p>}
          <Card className="mb-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">{t("Side by side")}</h2>
              <div className="flex gap-1 text-sm">
                <Link href={query({})} className={cn("rounded-md px-2 py-1 hover:bg-muted", !onlyDiff && "bg-muted font-semibold")}>
                  {t("All rows")}
                </Link>
                <Link href={query({ diff: "1" })} className={cn("rounded-md px-2 py-1 hover:bg-muted", onlyDiff && "bg-muted font-semibold")}>
                  {t("Only differences")}
                </Link>
              </div>
            </div>
            <p className="mb-2 text-xs text-muted-foreground">{t("Rows marked ≠ differ between the selected brews.")}</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-sm">
                <thead>
                  <tr className="text-left align-bottom">
                    <th className="sticky left-0 bg-card pr-3" />
                    {brews.map((b) => (
                      <th key={b.id} className="pr-3 pb-1 font-semibold">
                        <Link href={`/brews/${b.id}`} className="underline">
                          {label(b)}
                        </Link>
                        <div className="mt-1 font-normal">
                          <StatusBadge status={b.status} />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <Section title={t("Overview")} rows={overview} columns={n} onlyDiff={onlyDiff} />
                  <Section title={t("Readings")} rows={readings} columns={n} onlyDiff={onlyDiff} />
                  <Section
                    title={t("Ingredients (actual amounts)")}
                    rows={ingredientRows}
                    columns={n}
                    onlyDiff={onlyDiff}
                    footer={onlyDiff && sameIngredients > 0 ? t("{n} ingredient line(s) identical across brews.", { n: sameIngredients }) : undefined}
                  />
                  <tr>
                    <th colSpan={n + 1} className="pt-5 pb-1 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      {t("Problems")}
                    </th>
                  </tr>
                  <tr className="border-t border-border align-top">
                    <th className="sticky left-0 bg-card py-1.5 pr-3" />
                    {brews.map((b) => (
                      <td key={b.id} className="py-1.5 pr-3">
                        {b.problems.length === 0 ? (
                          <span className="text-muted-foreground">{t("None")}</span>
                        ) : (
                          <ul className="flex flex-col gap-1">
                            {b.problems.map((p, i) => (
                              <li key={i}>⚠️ {p.title}</li>
                            ))}
                          </ul>
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          {(gravityCurves.length > 0 || tempCurves.length > 0) && (
            <Card className="flex flex-col gap-6">
              <CardTitle>{t("Fermentation curves")}</CardTitle>
              {gravityCurves.length > 0 && <LineChart title={t("Gravity by day")} series={gravityCurves} yDecimals={3} />}
              {tempCurves.length > 0 && (
                <LineChart title={t("Temperature by day (°C)")} series={tempCurves} yDecimals={1} yUnit="°C" height={180} />
              )}
            </Card>
          )}
        </>
      )}
    </>
  );
}
