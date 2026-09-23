import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { LineChart, type ChartSeries } from "@/components/line-chart";
import { Button, ButtonLink, Card, CardTitle, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { db } from "@/lib/db";
import {
  batchLabel,
  daysSince,
  fermentationSeries,
  fmtNum,
  fmtSg,
  PACKAGING_METHODS,
  preBoilVolume,
  STEPS,
  stepBySlug,
  tempWarning,
  type Deviation,
} from "@/lib/brewing";
import type { AdditionStage, IngredientType, StepType } from "@/generated/prisma/enums";
import {
  addFermentationLog,
  addMeasurement,
  deleteFermentationLog,
  deletePhoto,
  uploadPhoto,
  deleteMeasurement,
  saveStepActuals,
  saveStepNotes,
  setStepComplete,
} from "../../../actions";
import { ProblemCard, ProblemForm } from "../../../journal";
import { PrimingCalculator } from "./priming-calculator";
import { PhotoUploader } from "./photo-uploader";
import { getI18n } from "@/lib/i18n/server";
import type { T } from "@/lib/i18n/core";

type Line = { label: string; value: string };
type Addition = {
  id: number;
  name: string;
  amount: string;
  time: number | null;
  stage: AdditionStage;
  type: IngredientType | null;
};

function targetsFor(
  type: StepType,
  v: {
    batchSize: number;
    boilTime: number;
    targetOg: number | null;
    targetFg: number | null;
    targetCarbonation: number | null;
    waterSource: string | null;
    mashWaterL: number | null;
    spargeWaterL: number | null;
    targetMashPh: number | null;
    equipmentProfile: { boilOffRate: number; trubLoss: number } | null;
    mashSteps: { id: number; name: string; temperature: number; timeMin: number }[];
  },
  additions: Addition[],
  t: T,
): { lines: Line[]; additions: Addition[]; additionsTitle?: string } {
  const at = (...stages: AdditionStage[]) => additions.filter((a) => stages.includes(a.stage));
  const totalWater = v.mashWaterL != null || v.spargeWaterL != null ? (v.mashWaterL ?? 0) + (v.spargeWaterL ?? 0) : null;
  switch (type) {
    case "WATER_PREP":
      return {
        lines: [
          { label: t("Source"), value: v.waterSource ?? "–" },
          { label: t("Total water"), value: fmtNum(totalWater, "L") },
          { label: t("Mash / sparge"), value: `${fmtNum(v.mashWaterL, "L")} / ${fmtNum(v.spargeWaterL, "L")}` },
          { label: t("Target mash pH"), value: fmtNum(v.targetMashPh) },
        ],
        additions: additions.filter((a) => a.type === "WATER"),
        additionsTitle: t("Water additions"),
      };
    case "MASHING":
      return {
        lines: [
          ...v.mashSteps.map((m, i) => ({ label: `${i + 1}. ${m.name}`, value: `${m.temperature}°C · ${t("{n} min", { n: m.timeMin })}` })),
          { label: t("Mash water"), value: fmtNum(v.mashWaterL, "L") },
          { label: t("Target pH"), value: fmtNum(v.targetMashPh) },
        ],
        additions: at("MASH").filter((a) => a.type !== "WATER"),
        additionsTitle: t("Grain bill & mash additions"),
      };
    case "SPARGING":
      return {
        lines: [{ label: t("Sparge water"), value: fmtNum(v.spargeWaterL, "L") }],
        additions: at("SPARGE"),
      };
    case "BOILING": {
      const pre = preBoilVolume(v.batchSize, v.boilTime, v.equipmentProfile);
      return {
        lines: [
          { label: t("Boil time"), value: t("{n} min", { n: v.boilTime }) },
          { label: t("Est. pre-boil volume"), value: pre == null ? t("– (no equipment profile)") : `${pre.toFixed(1)} L` },
          { label: t("Target OG"), value: fmtSg(v.targetOg) },
        ],
        additions: at("BOIL", "WHIRLPOOL").sort((a, b) => (b.time ?? -1) - (a.time ?? -1)),
        additionsTitle: t("Boil timeline"),
      };
    }
    case "COOLING":
      return {
        lines: [{ label: t("Target volume"), value: fmtNum(v.batchSize, "L") }],
        additions: additions.filter((a) => a.type === "YEAST"),
        additionsTitle: t("Yeast to pitch"),
      };
    case "FERMENTATION":
      return {
        lines: [
          { label: t("Target OG"), value: fmtSg(v.targetOg) },
          { label: t("Target FG"), value: fmtSg(v.targetFg) },
        ],
        additions: at("FERMENTATION", "DRY_HOP"),
      };
    case "PACKAGING":
      return {
        lines: [
          { label: t("Target carbonation"), value: fmtNum(v.targetCarbonation, "vol CO2") },
          { label: t("Batch size"), value: fmtNum(v.batchSize, "L") },
        ],
        additions: at("PACKAGING"),
      };
  }
}

function stepWarnings(
  type: StepType,
  readings: Map<string, number>,
  v: { targetMashPh: number | null; targetOg: number | null; mashSteps: { temperature: number; timeMin: number }[] },
): Deviation[] {
  const out: Deviation[] = [];
  if (type === "MASHING") {
    const main = [...v.mashSteps].sort((a, b) => b.timeMin - a.timeMin)[0];
    const temp = readings.get("Mash temp");
    if (main && temp != null) {
      const w = tempWarning("Mash temp", main.temperature, temp);
      if (w) out.push(w);
    }
  }
  if (type === "MASHING" || type === "WATER_PREP") {
    const ph = readings.get(type === "MASHING" ? "Post-mash pH" : "pH");
    if (v.targetMashPh != null && ph != null && Math.abs(ph - v.targetMashPh) > 0.2) {
      out.push({
        label: "pH",
        target: String(v.targetMashPh),
        actual: String(ph),
        message: `pH ${ph > v.targetMashPh ? "higher" : "lower"} than target`,
      });
    }
  }
  if (type === "BOILING") {
    const sg = readings.get("Post-boil SG");
    if (v.targetOg != null && sg != null && Math.abs(sg - v.targetOg) > 0.005) {
      out.push({
        label: "Post-boil SG",
        target: fmtSg(v.targetOg),
        actual: fmtSg(sg),
        message: `Post-boil gravity ${sg > v.targetOg ? "higher" : "lower"} than target OG`,
      });
    }
  }
  return out;
}

export default async function StepPage(props: PageProps<"/brews/[id]/steps/[step]">) {
  const params = await props.params;
  const sp = await props.searchParams;
  const def = stepBySlug(params.step);
  const sessionId = Number(params.id);
  if (!def || !Number.isInteger(sessionId)) notFound();
  const { t, date } = await getI18n();

  const session = await db.brewSession.findUnique({
    where: { id: sessionId },
    include: {
      recipe: { select: { name: true } },
      recipeVersion: {
        include: { equipmentProfile: true, mashSteps: { orderBy: { stepOrder: "asc" } } },
      },
      ingredients: { orderBy: { sortOrder: "asc" }, include: { ingredient: { select: { type: true } } } },
    },
  });
  if (!session) notFound();

  const step = await db.brewStep.findUnique({
    where: { brewSessionId_type: { brewSessionId: sessionId, type: def.type } },
    include: {
      measurements: { orderBy: { recordedAt: "asc" } },
      problems: { orderBy: { createdAt: "asc" }, include: { lessons: true, brewStep: { select: { type: true } } } },
      fermentationLog: { orderBy: { date: "asc" } },
      photos: { orderBy: { createdAt: "asc" }, select: { id: true, caption: true, width: true, height: true } },
    },
  });
  if (!step) notFound();

  const previous = await db.brewSession.findFirst({
    where: { recipeId: session.recipeId, batchNumber: { lt: session.batchNumber } },
    orderBy: { batchNumber: "desc" },
    include: {
      steps: {
        where: { type: def.type },
        include: {
          measurements: { orderBy: { recordedAt: "asc" } },
          problems: { include: { lessons: true, brewStep: { select: { type: true } } } },
          fermentationLog: { orderBy: { date: "asc" } },
        },
      },
    },
  });
  const prevStep = previous?.steps[0];

  const v = session.recipeVersion;
  const additions: Addition[] = session.ingredients.map((i) => ({
    id: i.id,
    name: i.nameSnapshot,
    amount: fmtNum(i.actualAmount ?? i.plannedAmount, i.unit),
    time: i.additionTime,
    stage: i.stage,
    type: i.ingredient?.type ?? null,
  }));
  const target = targetsFor(def.type, v, additions, t);
  const presetTypes = new Set(def.presets.map((p) => p.type));
  const readings = new Map(step.measurements.map((m) => [m.type, m.value]));
  const extraMeasurements = step.measurements.filter((m) => !presetTypes.has(m.type));
  const warnings = stepWarnings(def.type, readings, v);
  const prefill =
    typeof sp.problem === "string"
      ? { title: sp.problem, description: typeof sp.detail === "string" ? sp.detail : undefined }
      : undefined;

  const idx = STEPS.findIndex((s) => s.type === def.type);
  const prevDef = STEPS[idx - 1];
  const nextDef = STEPS[idx + 1];
  const base = `/brews/${session.id}`;
  const title = batchLabel(session.recipe.name, session.batchNumber);
  const today = new Date().toISOString().slice(0, 10);
  const dayOf = (d: Date) => daysSince(session.brewDate, d);
  const primingDefaults =
    def.type === "PACKAGING"
      ? await (async () => {
          const ferm = await db.brewStep.findUnique({
            where: { brewSessionId_type: { brewSessionId: sessionId, type: "FERMENTATION" } },
            include: { fermentationLog: { select: { temperature: true } }, measurements: { where: { type: "Ferment temp" } } },
          });
          const temps = [
            ...(ferm?.fermentationLog.flatMap((l) => (l.temperature == null ? [] : [l.temperature])) ?? []),
            ...(ferm?.measurements.map((m) => m.value) ?? []),
          ];
          return {
            volumeL: readings.get("Final volume") ?? session.actualVolume ?? v.batchSize,
            targetCo2: v.targetCarbonation ?? 2.4,
            maxTempC: temps.length ? Math.max(...temps) : 20,
          };
        })()
      : null;

  const current = fermentationSeries(session.brewDate, session.actualOg, step.fermentationLog);
  const prior = previous && prevStep ? fermentationSeries(previous.brewDate, previous.actualOg, prevStep.fermentationLog) : null;
  const withPrevious = (key: "gravity" | "temperature" | "ph"): ChartSeries[] => [
    { name: t("{name} (this batch)", { name: title }), points: current[key] },
    ...(prior && prior[key].length > 0
      ? [{ name: batchLabel(session.recipe.name, previous!.batchNumber), points: prior[key] }]
      : []),
  ];

  return (
    <>
      <PageHeader
        title={`${idx + 1}. ${t(def.label)}`}
        subtitle={
          <Link href={base} className="underline">
            {title}
          </Link>
        }
        actions={
          <form action={setStepComplete.bind(null, step.id, !step.completedAt)}>
            <Button variant={step.completedAt ? "secondary" : "primary"}>
              {step.completedAt ? t("✓ Completed — reopen") : t("Complete step")}
            </Button>
          </form>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 md:col-span-2">
          <Card>
            <CardTitle>{t("Target")}</CardTitle>
            <dl className="grid grid-cols-2 gap-y-1 text-sm">
              {target.lines.map((l) => (
                <div key={l.label} className="contents">
                  <dt className="text-muted-foreground">{l.label}</dt>
                  <dd className="tabular-nums">{l.value}</dd>
                </div>
              ))}
            </dl>
            {target.additions.length > 0 && (
              <>
                <h3 className="mt-3 mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {target.additionsTitle ?? t("Additions")}
                </h3>
                <ul className="text-sm">
                  {target.additions.map((a) => (
                    <li key={a.id} className="flex justify-between gap-2 py-0.5">
                      <span>
                        {a.time != null && (
                          <span className="mr-2 inline-block w-14 text-muted-foreground tabular-nums">
                            {a.stage === "DRY_HOP" ? t("day {n}", { n: a.time }) : t("{n} min", { n: a.time })}
                          </span>
                        )}
                        {a.name}
                      </span>
                      <span className="tabular-nums">{a.amount}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          <Card>
            <CardTitle>{t("Actual")}</CardTitle>
            {warnings.map((w) => (
              <div
                key={w.label}
                className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning-border bg-warning-bg px-3 py-2 text-sm"
              >
                <span>
                  ⚠️ {t(w.message)}: {t("target {target}, actual {actual}", { target: w.target, actual: w.actual })}
                </span>
                <Link
                  className="font-medium underline"
                  href={`${base}/steps/${def.slug}?problem=${encodeURIComponent(t(w.message))}&detail=${encodeURIComponent(t("Target {target}, actual {actual}", { target: w.target, actual: w.actual }))}#new-problem`}
                >
                  {t("Log as problem")}
                </Link>
              </div>
            ))}
            <ActionForm action={saveStepActuals.bind(null, step.id)} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {def.type === "PACKAGING" && (
                <Field label={t("Method")}>
                  <Select name="packagingMethod" defaultValue={session.packagingMethod ?? ""}>
                    <option value="">–</option>
                    {PACKAGING_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {t(m)}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              {def.presets.map((p, i) => (
                <Field key={p.type} label={p.unit ? `${t(p.type)} (${p.unit})` : t(p.type)}>
                  <Input name={`preset-${i}`} type="number" step={p.step ?? "any"} inputMode="decimal" defaultValue={readings.get(p.type) ?? ""} />
                </Field>
              ))}
              <div className="col-span-2 sm:col-span-3">
                <Button type="submit">{t("Save readings")}</Button>
              </div>
            </ActionForm>

            {extraMeasurements.length > 0 && (
              <ul className="mt-4 divide-y divide-border text-sm">
                {extraMeasurements.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2 py-1.5">
                    <span>
                      {t(m.type)}: <strong className="tabular-nums">{fmtNum(m.value, m.unit ?? undefined)}</strong>
                      {m.notes && <span className="ml-2 text-muted-foreground">{m.notes}</span>}
                    </span>
                    <form action={deleteMeasurement.bind(null, m.id)}>
                      <button aria-label={t("Delete measurement")} className="rounded p-1 text-muted-foreground hover:bg-muted">
                        <X className="size-4" />
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium">{t("+ Add another measurement")}</summary>
              <ActionForm action={addMeasurement.bind(null, step.id)} resetOnSuccess className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_6rem_5rem_1fr_auto] sm:items-end">
                <Field label={t("Name")}>
                  <Input name="type" required placeholder={t("Grain bed temp")} />
                </Field>
                <Field label={t("Value")}>
                  <Input name="value" type="number" step="any" required />
                </Field>
                <Field label={t("Unit")}>
                  <Input name="unit" placeholder="°C" />
                </Field>
                <Field label={t("Note")}>
                  <Input name="notes" />
                </Field>
                <Button type="submit" variant="secondary">
                  {t("Add")}
                </Button>
              </ActionForm>
            </details>
          </Card>

          {def.type === "FERMENTATION" && current.gravity.length + current.temperature.length > 0 && (
            <Card className="flex flex-col gap-6">
              {current.gravity.length > 0 && (
                <LineChart
                  title={t("Gravity")}
                  series={withPrevious("gravity")}
                  yDecimals={3}
                  referenceLines={v.targetFg != null ? [{ y: v.targetFg, label: t("Target FG {fg}", { fg: fmtSg(v.targetFg) }) }] : []}
                />
              )}
              {current.temperature.length > 0 && (
                <LineChart title={t("Temperature (°C)")} series={withPrevious("temperature")} yDecimals={1} yUnit="°C" height={180} />
              )}
              {current.ph.length > 0 && <LineChart title="pH" series={withPrevious("ph")} yDecimals={2} height={160} />}
            </Card>
          )}

          {def.type === "FERMENTATION" && (
            <Card>
              <CardTitle>{t("Daily log")}</CardTitle>
              {step.fermentationLog.length > 0 && (
                <div className="mb-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="py-1 pr-2 font-medium">{t("Day")}</th>
                        <th className="py-1 pr-2 font-medium">{t("Temp")}</th>
                        <th className="py-1 pr-2 font-medium">{t("Gravity")}</th>
                        <th className="py-1 pr-2 font-medium">pH</th>
                        <th className="py-1 pr-2 font-medium">{t("Activity / notes")}</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border tabular-nums">
                      {step.fermentationLog.map((e) => (
                        <tr key={e.id}>
                          <td className="py-1.5 pr-2">
                            {dayOf(e.date)} <span className="text-xs text-muted-foreground">{date(e.date)}</span>
                          </td>
                          <td className="py-1.5 pr-2">{e.temperature == null ? "–" : `${e.temperature}°C`}</td>
                          <td className="py-1.5 pr-2">{fmtSg(e.gravity)}</td>
                          <td className="py-1.5 pr-2">{fmtNum(e.ph)}</td>
                          <td className="py-1.5 pr-2">{[e.activity && t(e.activity), e.notes].filter(Boolean).join(" · ")}</td>
                          <td className="py-1.5 text-right">
                            <form action={deleteFermentationLog.bind(null, e.id)}>
                              <button aria-label={t("Delete entry")} className="rounded p-1 text-muted-foreground hover:bg-muted">
                                <X className="size-4" />
                              </button>
                            </form>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <ActionForm action={addFermentationLog.bind(null, step.id)} resetOnSuccess className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Field label={t("Date")}>
                  <Input name="date" type="date" required defaultValue={today} />
                </Field>
                <Field label={t("Temp (°C)")}>
                  <Input name="temperature" type="number" step="0.1" inputMode="decimal" />
                </Field>
                <Field label={t("Gravity")}>
                  <Input name="gravity" type="number" step="0.001" min="0.99" max="1.2" inputMode="decimal" />
                </Field>
                <Field label="pH">
                  <Input name="ph" type="number" step="0.01" inputMode="decimal" />
                </Field>
                <Field label={t("Activity")}>
                  <Select name="activity" defaultValue="">
                    <option value="">–</option>
                    {["None", "Low", "Medium", "High"].map((a) => (
                      <option key={a} value={a}>
                        {t(a)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t("Notes")}>
                  <Input name="notes" placeholder={t("Lots of krausen")} />
                </Field>
                <div className="col-span-2 sm:col-span-3">
                  <Button type="submit" variant="secondary">
                    {t("Add log entry")}
                  </Button>
                </div>
              </ActionForm>
            </Card>
          )}

          {primingDefaults && (
            <Card>
              <CardTitle>{t("Priming sugar")}</CardTitle>
              <PrimingCalculator {...primingDefaults} />
            </Card>
          )}

          <Card>
            <CardTitle>{t("Photos")}</CardTitle>
            {step.photos.length > 0 && (
              <ul className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {step.photos.map((p) => (
                  <li key={p.id} className="relative">
                    <a href={`/photos/${p.id}`} target="_blank" rel="noopener" className="block overflow-hidden rounded-md border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element -- served from our own route; already resized */}
                      <img
                        src={`/photos/${p.id}`}
                        alt={p.caption ?? t("{step} photo", { step: t(def.label) })}
                        width={p.width ?? undefined}
                        height={p.height ?? undefined}
                        loading="lazy"
                        className="aspect-square w-full object-cover"
                      />
                    </a>
                    {p.caption && <p className="mt-1 truncate text-xs text-muted-foreground">{p.caption}</p>}
                    <form action={deletePhoto.bind(null, p.id)} className="absolute top-1 right-1">
                      <button aria-label={t("Delete photo")} className="rounded-full bg-card/90 p-1 text-muted-foreground shadow hover:bg-muted">
                        <X className="size-4" />
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <PhotoUploader action={uploadPhoto.bind(null, step.id)} />
          </Card>

          <Card>
            <CardTitle>{t("Notes")}</CardTitle>
            <ActionForm action={saveStepNotes.bind(null, step.id)} className="flex flex-col gap-2">
              <Textarea name="notes" rows={4} defaultValue={step.notes ?? ""} placeholder={t("What happened? Anything a number can't capture.")} />
              <div>
                <Button type="submit" variant="secondary">
                  {t("Save notes")}
                </Button>
              </div>
            </ActionForm>
          </Card>

          <Card>
            <CardTitle>{t("Problems")}</CardTitle>
            <div className="flex flex-col gap-2">
              {step.problems.map((p) => (
                <ProblemCard key={p.id} problem={p} />
              ))}
              <ProblemForm sessionId={session.id} stepId={step.id} prefill={prefill} />
            </div>
          </Card>
        </div>

        <aside className="flex flex-col gap-4">
          <Card className="border-dashed">
            <CardTitle>{t("Previous brew")}</CardTitle>
            {!previous || !prevStep ? (
              <p className="text-sm text-muted-foreground">{t("No earlier batch of this recipe yet.")}</p>
            ) : (
              <div className="flex flex-col gap-3 text-sm">
                <Link href={`/brews/${previous.id}/steps/${def.slug}`} className="font-medium underline">
                  {batchLabel(session.recipe.name, previous.batchNumber)} · {date(previous.brewDate)}
                </Link>
                {prevStep.measurements.length === 0 ? (
                  <p className="text-muted-foreground">{t("No readings recorded.")}</p>
                ) : (
                  <dl className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-0.5">
                    <dt className="text-xs text-muted-foreground" />
                    <dd className="text-xs text-muted-foreground">{t("Then")}</dd>
                    <dd className="text-xs text-muted-foreground">{t("Now")}</dd>
                    {prevStep.measurements.map((m) => (
                      <div key={m.id} className="contents">
                        <dt className="text-muted-foreground">{t(m.type)}</dt>
                        <dd className="tabular-nums">{fmtNum(m.value, m.unit ?? undefined)}</dd>
                        <dd className="font-semibold tabular-nums">{fmtNum(readings.get(m.type), m.unit ?? undefined)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {prevStep.notes && <p className="whitespace-pre-wrap text-muted-foreground">“{prevStep.notes}”</p>}
                {prevStep.problems.map((p) => (
                  <ProblemCard key={p.id} problem={p} readOnly />
                ))}
              </div>
            )}
          </Card>

          <nav className="flex justify-between gap-2">
            {prevDef ? (
              <ButtonLink variant="secondary" href={`${base}/steps/${prevDef.slug}`}>
                <ChevronLeft className="size-4" /> {t(prevDef.label)}
              </ButtonLink>
            ) : (
              <ButtonLink variant="secondary" href={base}>
                <ChevronLeft className="size-4" /> {t("Overview")}
              </ButtonLink>
            )}
            {nextDef ? (
              <ButtonLink variant="secondary" href={`${base}/steps/${nextDef.slug}`}>
                {t(nextDef.label)} <ChevronRight className="size-4" />
              </ButtonLink>
            ) : (
              <ButtonLink variant="secondary" href={base}>
                {t("Overview")} <ChevronRight className="size-4" />
              </ButtonLink>
            )}
          </nav>
        </aside>
      </div>
    </>
  );
}
