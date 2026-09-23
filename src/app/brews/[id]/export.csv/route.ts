import { db } from "@/lib/db";
import { batchLabel, daysSince, labelOf, STAGES, stepByType, STEPS } from "@/lib/brewing";
import { csvResponse, toCsv } from "@/lib/csv";

/** One long table with every recorded fact about a brew, grouped by section. */
export async function GET(_req: Request, ctx: RouteContext<"/brews/[id]/export.csv">) {
  const id = Number((await ctx.params).id);
  const b = Number.isInteger(id)
    ? await db.brewSession.findUnique({
        where: { id },
        include: {
          recipe: true,
          recipeVersion: true,
          ingredients: { orderBy: { sortOrder: "asc" } },
          steps: {
            include: {
              measurements: { orderBy: { recordedAt: "asc" } },
              fermentationLog: { orderBy: { date: "asc" } },
            },
          },
          problems: { orderBy: { createdAt: "asc" }, include: { brewStep: { select: { type: true } }, lessons: true } },
          lessons: { where: { problemId: null } },
        },
      })
    : null;
  if (!b) return new Response("Not found", { status: 404 });

  const v = b.recipeVersion;
  type Row = [string, string | null, string, number | string | null, string | null, string | null];
  const rows: Row[] = [
    ["Brew", null, "Recipe", `${b.recipe.name} v${v.version}`, null, null],
    ["Brew", null, "Brew date", b.brewDate.toISOString().slice(0, 10), null, null],
    ["Brew", null, "Volume", b.actualVolume, "L", `target ${v.batchSize} L`],
    ["Brew", null, "OG", b.actualOg, null, v.targetOg == null ? null : `target ${v.targetOg}`],
    ["Brew", null, "FG", b.actualFg, null, v.targetFg == null ? null : `target ${v.targetFg}`],
    ["Brew", null, "Packaging", b.packagingMethod, null, null],
    ["Brew", null, "Notes", b.notes, null, null],
    ...b.ingredients.map((i): Row => [
      "Ingredient",
      labelOf(STAGES, i.stage) + (i.additionTime != null ? ` ${i.additionTime}` : ""),
      i.nameSnapshot,
      i.actualAmount ?? i.plannedAmount,
      i.unit,
      [i.actualAmount != null && i.actualAmount !== i.plannedAmount ? `planned ${i.plannedAmount}` : null, i.substitutedForName && `swapped for ${i.substitutedForName}`]
        .filter(Boolean)
        .join("; ") || null,
    ]),
  ];
  const order = (t: string) => STEPS.findIndex((d) => d.type === t);
  for (const s of [...b.steps].sort((x, y) => order(x.type) - order(y.type))) {
    const label = stepByType(s.type).label;
    for (const m of s.measurements) rows.push(["Reading", label, m.type, m.value, m.unit, m.notes]);
    for (const l of s.fermentationLog) {
      const day = `Day ${daysSince(b.brewDate, l.date)}`;
      if (l.gravity != null) rows.push(["Fermentation", day, "Gravity", l.gravity, null, null]);
      if (l.temperature != null) rows.push(["Fermentation", day, "Temperature", l.temperature, "°C", null]);
      if (l.ph != null) rows.push(["Fermentation", day, "pH", l.ph, null, null]);
      if (l.activity || l.notes) rows.push(["Fermentation", day, "Notes", [l.activity, l.notes].filter(Boolean).join(" · "), null, null]);
    }
    if (s.notes) rows.push(["Step notes", label, "Notes", s.notes, null, null]);
  }
  for (const p of b.problems) {
    const detail = [p.cause && `cause: ${p.cause}`, p.action && `action: ${p.action}`, p.impact && `impact: ${p.impact}`].filter(Boolean).join("; ");
    rows.push(["Problem", p.brewStep ? stepByType(p.brewStep.type).label : null, p.title, p.description, null, detail || null]);
    for (const l of p.lessons) rows.push(["Lesson", null, l.text, null, null, `from: ${p.title}`]);
  }
  for (const l of b.lessons) rows.push(["Lesson", null, l.text, null, null, l.tags.join(", ") || null]);

  const name = batchLabel(b.recipe.name, b.batchNumber);
  return csvResponse(toCsv(["Section", "Step", "Item", "Value", "Unit", "Detail"], rows), `${name}.csv`);
}
