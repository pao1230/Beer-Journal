import Link from "next/link";
import { notFound } from "next/navigation";
import { IngredientTable } from "@/components/ingredient-table";
import { LineChart } from "@/components/line-chart";
import { db } from "@/lib/db";
import {
  abv,
  batchLabel,
  daysSince,
  fermentationSeries,
  fmtAbv,
  fmtDate,
  fmtNum,
  fmtSg,
  labelOf,
  STATUSES,
  STEPS,
} from "@/lib/brewing";
import { PrintButton } from "./print-button";

export const metadata = { title: "Brew report" };

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-6 mb-2 border-b border-border pb-1 text-lg font-semibold">{children}</h2>;
}

export default async function PrintPage(props: PageProps<"/brews/[id]/print">) {
  const id = Number((await props.params).id);
  const b = Number.isInteger(id)
    ? await db.brewSession.findUnique({
        where: { id },
        include: {
          recipe: true,
          recipeVersion: { include: { mashSteps: { orderBy: { stepOrder: "asc" } } } },
          ingredients: { orderBy: { sortOrder: "asc" } },
          steps: {
            include: {
              measurements: { orderBy: { recordedAt: "asc" } },
              fermentationLog: { orderBy: { date: "asc" } },
              problems: { include: { lessons: true } },
              photos: { select: { id: true, caption: true } },
            },
          },
          problems: { where: { brewStepId: null }, include: { lessons: true } },
          lessons: { where: { problemId: null } },
        },
      })
    : null;
  if (!b) notFound();
  const v = b.recipeVersion;
  const title = batchLabel(b.recipe.name, b.batchNumber);
  const ferm = b.steps.find((s) => s.type === "FERMENTATION");
  const gravity = fermentationSeries(b.brewDate, b.actualOg, ferm?.fermentationLog ?? []).gravity;

  return (
    <article className="mx-auto max-w-3xl text-sm">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href={`/brews/${b.id}`} className="underline">
          ← Back to brew
        </Link>
        <PrintButton />
      </div>

      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-muted-foreground">
        {b.recipe.style && `${b.recipe.style} · `}Recipe v{v.version} · Brewed {fmtDate(b.brewDate)} · {labelOf(STATUSES, b.status)}
        {b.packagingMethod && ` · ${b.packagingMethod}`}
      </p>

      <H2>Target vs actual</H2>
      <table className="w-full tabular-nums">
        <thead className="text-left text-xs text-muted-foreground">
          <tr>
            <th className="font-medium" />
            <th className="font-medium">Volume</th>
            <th className="font-medium">OG</th>
            <th className="font-medium">FG</th>
            <th className="font-medium">ABV</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="text-muted-foreground">Target</td>
            <td>{fmtNum(v.batchSize, "L")}</td>
            <td>{fmtSg(v.targetOg)}</td>
            <td>{fmtSg(v.targetFg)}</td>
            <td>{fmtAbv(abv(v.targetOg, v.targetFg))}</td>
          </tr>
          <tr className="font-semibold">
            <td>Actual</td>
            <td>{fmtNum(b.actualVolume, "L")}</td>
            <td>{fmtSg(b.actualOg)}</td>
            <td>{fmtSg(b.actualFg)}</td>
            <td>{fmtAbv(abv(b.actualOg, b.actualFg))}</td>
          </tr>
        </tbody>
      </table>
      {b.notes && <p className="mt-2 whitespace-pre-wrap">{b.notes}</p>}

      <H2>Ingredients</H2>
      <IngredientTable
        rows={b.ingredients.map((i) => ({
          id: i.id,
          name: i.nameSnapshot,
          detail: i.substitutedForName ? `swapped for ${i.substitutedForName}` : null,
          stage: i.stage,
          additionTime: i.additionTime,
          amount: fmtNum(i.actualAmount ?? i.plannedAmount, i.unit),
        }))}
      />
      {v.mashSteps.length > 0 && (
        <p className="mt-2 text-muted-foreground">
          Mash: {v.mashSteps.map((m) => `${m.name} ${m.temperature}°C/${m.timeMin} min`).join(" → ")}
        </p>
      )}

      {STEPS.map((def) => {
        const s = b.steps.find((x) => x.type === def.type);
        if (!s) return null;
        const empty = !s.measurements.length && !s.notes && !s.problems.length && !s.photos.length && !s.fermentationLog.length;
        if (empty) return null;
        return (
          <section key={def.type}>
            <H2>
              {def.label} {s.completedAt ? "✓" : ""}
            </H2>
            {s.measurements.length > 0 && (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-0.5 sm:grid-cols-3">
                {s.measurements.map((m) => (
                  <div key={m.id} className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">{m.type}</dt>
                    <dd className="font-semibold tabular-nums">{fmtNum(m.value, m.unit ?? undefined)}</dd>
                  </div>
                ))}
              </dl>
            )}
            {def.type === "FERMENTATION" && s.fermentationLog.length > 0 && (
              <>
                {gravity.length > 1 && (
                  <div className="my-3">
                    <LineChart title="Gravity" series={[{ name: title, points: gravity }]} yDecimals={3} height={180} />
                  </div>
                )}
                <table className="w-full tabular-nums">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="font-medium">Day</th>
                      <th className="font-medium">Temp</th>
                      <th className="font-medium">Gravity</th>
                      <th className="font-medium">pH</th>
                      <th className="font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.fermentationLog.map((l) => (
                      <tr key={l.id}>
                        <td>{daysSince(b.brewDate, l.date)}</td>
                        <td>{l.temperature == null ? "–" : `${l.temperature}°C`}</td>
                        <td>{fmtSg(l.gravity)}</td>
                        <td>{fmtNum(l.ph)}</td>
                        <td>{[l.activity, l.notes].filter(Boolean).join(" · ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            {s.notes && <p className="mt-2 whitespace-pre-wrap">📝 {s.notes}</p>}
            {s.problems.map((p) => (
              <div key={p.id} className="mt-2 rounded-md border border-warning-border bg-warning-bg p-2">
                <strong>⚠️ {p.title}</strong>
                {[p.description, p.cause && `Cause: ${p.cause}`, p.action && `Action: ${p.action}`, p.impact && `Impact: ${p.impact}`]
                  .filter(Boolean)
                  .map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                {p.lessons.map((l) => (
                  <p key={l.id}>💡 {l.text}</p>
                ))}
              </div>
            ))}
            {s.photos.length > 0 && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {s.photos.map((ph) => (
                  <figure key={ph.id}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- served from our own route */}
                    <img src={`/photos/${ph.id}`} alt={ph.caption ?? def.label} className="w-full rounded border border-border" />
                    {ph.caption && <figcaption className="text-xs text-muted-foreground">{ph.caption}</figcaption>}
                  </figure>
                ))}
              </div>
            )}
          </section>
        );
      })}

      {(b.problems.length > 0 || b.lessons.length > 0) && (
        <section>
          <H2>Other problems & lessons</H2>
          {b.problems.map((p) => (
            <p key={p.id}>
              ⚠️ <strong>{p.title}</strong>
              {p.cause && ` — ${p.cause}`}
              {p.lessons.map((l) => ` 💡 ${l.text}`)}
            </p>
          ))}
          {b.lessons.map((l) => (
            <p key={l.id}>💡 {l.text}</p>
          ))}
        </section>
      )}

      <p className="mt-8 text-xs text-muted-foreground">Brewing Journal · exported {fmtDate(new Date())}</p>
    </article>
  );
}
