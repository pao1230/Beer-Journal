import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Circle } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { IngredientTable } from "@/components/ingredient-table";
import { StatusBadge } from "@/components/status-badge";
import { Button, ButtonLink, Card, CardTitle, Field, Input, PageHeader, Select, Stat, Textarea } from "@/components/ui";
import { db } from "@/lib/db";
import {
  abv,
  batchLabel,
  daysSince,
  fmtAbv,
  fmtDate,
  fmtNum,
  fmtSg,
  gravityWarnings,
  STATUSES,
  STEPS,
} from "@/lib/brewing";
import { cloneBrew, deleteSession, updateBrewIngredient, updateSession } from "../actions";
import { LessonForm, LessonItem, ProblemCard, ProblemForm } from "../journal";

async function load(idParam: string) {
  const id = Number(idParam);
  if (!Number.isInteger(id)) return null;
  return db.brewSession.findUnique({
    where: { id },
    include: {
      recipe: true,
      recipeVersion: true,
      clonedFrom: { select: { id: true, batchNumber: true } },
      ingredients: { orderBy: { sortOrder: "asc" }, include: { ingredient: { select: { type: true } } } },
      steps: {
        include: {
          _count: { select: { measurements: true, problems: true, fermentationLog: true } },
          measurements: { where: { type: { contains: "pH", mode: "insensitive" } }, orderBy: { recordedAt: "asc" } },
          fermentationLog: { where: { ph: { not: null } }, orderBy: { date: "asc" } },
        },
      },
      problems: {
        orderBy: { createdAt: "asc" },
        include: { brewStep: { select: { type: true } }, lessons: true },
      },
      lessons: { where: { problemId: null }, orderBy: { createdAt: "asc" } },
    },
  });
}

export async function generateMetadata(props: PageProps<"/brews/[id]">) {
  const s = await load((await props.params).id);
  return { title: s ? batchLabel(s.recipe.name, s.batchNumber) : "Brew" };
}

export default async function BrewPage(props: PageProps<"/brews/[id]">) {
  const session = await load((await props.params).id);
  if (!session) notFound();
  const sp = await props.searchParams;
  const prefill =
    typeof sp.problem === "string"
      ? { title: sp.problem, description: typeof sp.detail === "string" ? sp.detail : undefined }
      : undefined;

  const v = session.recipeVersion;
  const previous = await db.brewSession.findFirst({
    where: { recipeId: session.recipeId, batchNumber: { lt: session.batchNumber } },
    orderBy: { batchNumber: "desc" },
    select: { id: true, batchNumber: true },
  });
  const swapOptions = await db.ingredient.findMany({
    where: { isArchived: false },
    select: { id: true, name: true, type: true },
    orderBy: { name: "asc" },
  });
  const warnings = gravityWarnings({
    targetOg: v.targetOg,
    targetFg: v.targetFg,
    actualOg: session.actualOg,
    actualFg: session.actualFg,
  });
  const title = batchLabel(session.recipe.name, session.batchNumber);
  const stepsByType = new Map(session.steps.map((s) => [s.type, s]));
  const phReadings = STEPS.flatMap((def) => {
    const step = stepsByType.get(def.type);
    if (!step) return [];
    return [
      ...step.measurements.map((m) => ({ key: `m${m.id}`, step: def.label, label: m.type, value: m.value })),
      ...step.fermentationLog.map((l) => ({
        key: `f${l.id}`,
        step: def.label,
        label: `Day ${daysSince(session.brewDate, l.date)}`,
        value: l.ph!,
      })),
    ];
  });

  return (
    <>
      <PageHeader
        title={title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={session.status} />
            {fmtDate(session.brewDate)} ·
            <Link className="underline" href={`/recipes/${session.recipeId}?v=${v.version}`}>
              {session.recipe.name} v{v.version}
            </Link>
            {session.clonedFrom && (
              <>
                · Based on
                <Link className="underline" href={`/brews/${session.clonedFrom.id}`}>
                  {batchLabel(session.recipe.name, session.clonedFrom.batchNumber)}
                </Link>
              </>
            )}
          </span>
        }
        actions={
          <>
            {previous && (
              <ButtonLink variant="secondary" href={`/compare?id=${previous.id}&id=${session.id}`}>
                Compare with #{String(previous.batchNumber).padStart(3, "0")}
              </ButtonLink>
            )}
            <ActionForm action={cloneBrew.bind(null, session.id)}>
              <Button variant="secondary">Clone this brew</Button>
            </ActionForm>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 md:col-span-2">
          <Card>
            <CardTitle>Target vs actual</CardTitle>
            <div className="mb-4 grid grid-cols-4 gap-3 text-sm">
              <span />
              <span className="text-xs text-muted-foreground">Volume</span>
              <span className="text-xs text-muted-foreground">OG / FG</span>
              <span className="text-xs text-muted-foreground">ABV</span>
              <span className="text-muted-foreground">Target</span>
              <span className="tabular-nums">{fmtNum(v.batchSize, "L")}</span>
              <span className="tabular-nums">
                {fmtSg(v.targetOg)} / {fmtSg(v.targetFg)}
              </span>
              <span className="tabular-nums">{fmtAbv(abv(v.targetOg, v.targetFg))}</span>
              <span className="font-semibold">Actual</span>
              <span className="font-semibold tabular-nums">{fmtNum(session.actualVolume, "L")}</span>
              <span className="font-semibold tabular-nums">
                {fmtSg(session.actualOg)} / {fmtSg(session.actualFg)}
              </span>
              <span className="font-semibold tabular-nums">{fmtAbv(abv(session.actualOg, session.actualFg))}</span>
            </div>

            {warnings.map((w) => (
              <div
                key={w.label}
                className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning-border bg-warning-bg px-3 py-2 text-sm"
              >
                <span>
                  ⚠️ {w.message}: target {w.target}, actual {w.actual}
                </span>
                <Link
                  className="font-medium underline"
                  href={`/brews/${session.id}?problem=${encodeURIComponent(w.message)}&detail=${encodeURIComponent(`Target ${w.target}, actual ${w.actual}`)}#new-problem`}
                >
                  Log as problem
                </Link>
              </div>
            ))}

            <ActionForm action={updateSession.bind(null, session.id)} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Status">
                <Select name="status" defaultValue={session.status}>
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Brew date">
                <Input name="brewDate" type="date" required defaultValue={session.brewDate.toISOString().slice(0, 10)} />
              </Field>
              <Field label="Volume into fermenter (L)">
                <Input name="actualVolume" type="number" step="0.1" min="0" defaultValue={session.actualVolume ?? ""} />
              </Field>
              <Field label="Actual OG">
                <Input name="actualOg" type="number" step="0.001" min="0.99" max="1.2" defaultValue={session.actualOg ?? ""} />
              </Field>
              <Field label="Actual FG">
                <Input name="actualFg" type="number" step="0.001" min="0.99" max="1.2" defaultValue={session.actualFg ?? ""} />
              </Field>
              <Field label="Notes" className="col-span-2 sm:col-span-3">
                <Textarea name="notes" rows={2} defaultValue={session.notes ?? ""} />
              </Field>
              <div className="col-span-2 sm:col-span-3">
                <Button type="submit">Save</Button>
              </div>
            </ActionForm>
          </Card>

          <Card>
            <CardTitle>Brew steps</CardTitle>
            <ol className="divide-y divide-border">
              {STEPS.map((def, idx) => {
                const step = stepsByType.get(def.type);
                if (!step) return null;
                const counts = [
                  step._count.measurements && `${step._count.measurements} reading(s)`,
                  step._count.fermentationLog && `${step._count.fermentationLog} log entr${step._count.fermentationLog === 1 ? "y" : "ies"}`,
                  step._count.problems && `⚠️ ${step._count.problems}`,
                ].filter(Boolean);
                return (
                  <li key={def.type}>
                    <Link href={`/brews/${session.id}/steps/${def.slug}`} className="flex items-center gap-3 py-2.5 hover:bg-muted/50">
                      {step.completedAt ? (
                        <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
                      ) : (
                        <Circle className="size-5 shrink-0 text-muted-foreground" />
                      )}
                      <span className="font-medium">
                        {idx + 1}. {def.label}
                      </span>
                      <span className="ml-auto text-xs text-muted-foreground">{counts.join(" · ")}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </Card>

          <Card>
            <CardTitle>Ingredients — planned vs actual</CardTitle>
            <IngredientTable
              rows={session.ingredients.map((i) => ({
                id: i.id,
                name: i.nameSnapshot,
                detail: i.substitutedForName ? `swapped for ${i.substitutedForName}` : i.notes,
                stage: i.stage,
                additionTime: i.additionTime,
                amount:
                  i.actualAmount != null && i.actualAmount !== i.plannedAmount ? (
                    <span>
                      <span className="text-muted-foreground line-through">{fmtNum(i.plannedAmount)}</span>{" "}
                      <strong>{fmtNum(i.actualAmount, i.unit)}</strong>
                    </span>
                  ) : (
                    fmtNum(i.plannedAmount, i.unit)
                  ),
              }))}
            />
            {session.ingredients.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-medium">Record actual amounts / substitutions</summary>
                <ul className="mt-2 divide-y divide-border">
                  {session.ingredients.map((i) => (
                    <li key={i.id} className="py-2">
                      <ActionForm action={updateBrewIngredient.bind(null, i.id)} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_7rem_1fr_auto]">
                        <div className="col-span-2 text-sm sm:col-span-1">
                          <div className="font-medium">{i.nameSnapshot}</div>
                          <div className="text-xs text-muted-foreground">
                            planned {fmtNum(i.plannedAmount, i.unit)}
                          </div>
                        </div>
                        <Field label={`Actual (${i.unit})`}>
                          <Input name="actualAmount" type="number" step="any" min="0" defaultValue={i.actualAmount ?? ""} />
                        </Field>
                        <Field label="Swap for">
                          <Select name="swapTo" defaultValue="">
                            <option value="">— keep —</option>
                            {swapOptions
                              .filter((o) => o.type === i.ingredient?.type && o.id !== i.ingredientId)
                              .map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.name}
                                </option>
                              ))}
                          </Select>
                        </Field>
                        <Button type="submit" variant="secondary">
                          Save
                        </Button>
                      </ActionForm>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardTitle>Problems</CardTitle>
            <div className="flex flex-col gap-2">
              {session.problems.length === 0 && <p className="text-sm text-muted-foreground">No problems logged. 🎉</p>}
              {session.problems.map((p) => (
                <ProblemCard key={p.id} problem={p} showStep />
              ))}
              <ProblemForm sessionId={session.id} stepId={null} prefill={prefill} />
            </div>
          </Card>

          <Card>
            <CardTitle>Lessons learned</CardTitle>
            {session.lessons.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Lessons from problems show on the problem. Add general takeaways here.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {session.lessons.map((l) => (
                  <LessonItem key={l.id} lesson={l} />
                ))}
              </ul>
            )}
            <LessonForm sessionId={session.id} />
          </Card>

          <Card>
            <CardTitle>pH through the brew</CardTitle>
            {phReadings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pH readings yet — record them on each step.</p>
            ) : (
              <table className="w-full text-sm tabular-nums">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-2 font-medium">Step</th>
                    <th className="py-1 pr-2 font-medium">Reading</th>
                    <th className="py-1 text-right font-medium">pH</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {phReadings.map((r) => {
                    const mashRelevant = r.step === "Mashing" || r.step === "Water Preparation";
                    const off = mashRelevant && v.targetMashPh != null && Math.abs(r.value - v.targetMashPh) > 0.2;
                    return (
                      <tr key={r.key}>
                        <td className="py-1.5 pr-2 text-muted-foreground">{r.step}</td>
                        <td className="py-1.5 pr-2">{r.label}</td>
                        <td className="py-1.5 text-right font-semibold">
                          {off && <span title={`Target mash pH ${v.targetMashPh}`}>⚠️ </span>}
                          {r.value.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {v.targetMashPh != null && <p className="mt-2 text-xs text-muted-foreground">Target mash pH {v.targetMashPh}</p>}
          </Card>

          <Card>
            <Stat label="Packaging" value={session.packagingMethod ?? "–"} />
          </Card>

          <ActionForm action={deleteSession.bind(null, session.id)} confirm={`Delete ${title} and everything logged for it?`}>
            <Button variant="danger" className="w-full">
              Delete brew
            </Button>
          </ActionForm>
        </div>
      </div>
    </>
  );
}
