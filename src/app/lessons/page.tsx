import Link from "next/link";
import { Card, CardTitle, Empty, Input, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { batchLabel, fmtDate, stepByType } from "@/lib/brewing";
import type { Prisma } from "@/generated/prisma/client";
import { LessonForm, LessonItem, ProblemCard } from "../brews/journal";

export const metadata = { title: "Lessons & Problems" };

export default async function LessonsPage(props: PageProps<"/lessons">) {
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const text = (field: string) => ({ [field]: { contains: q, mode: "insensitive" as const } });

  const lessonWhere: Prisma.LessonWhereInput = q
    ? { OR: [text("text"), { tags: { has: q.toLowerCase() } }, { problem: { is: text("title") } }] }
    : {};
  const problemWhere: Prisma.ProblemWhereInput = q
    ? { OR: ["title", "description", "cause", "action", "impact"].map(text) }
    : {};

  const sessionInclude = { select: { id: true, batchNumber: true, brewDate: true, recipe: { select: { name: true } } } };
  const [lessons, problems] = await Promise.all([
    db.lesson.findMany({
      where: lessonWhere,
      orderBy: { createdAt: "desc" },
      include: { brewSession: sessionInclude, problem: { select: { title: true } } },
    }),
    db.problem.findMany({
      where: problemWhere,
      orderBy: { createdAt: "desc" },
      include: { brewSession: sessionInclude, brewStep: { select: { type: true } }, lessons: true },
    }),
  ]);
  const sessionCount = new Set([
    ...problems.map((p) => p.brewSessionId),
    ...lessons.flatMap((l) => (l.brewSessionId ? [l.brewSessionId] : [])),
  ]).size;

  return (
    <>
      <PageHeader title="🧠 Lessons & Problems" subtitle="Everything you've learned, searchable across every batch." />
      <form className="mb-4 flex gap-2">
        <Input name="q" defaultValue={q} placeholder='Search e.g. "hydrometer" or "mash temperature"' />
        <button className="min-h-10 rounded-md border border-border px-3 text-sm hover:bg-muted">Search</button>
      </form>
      {q && (
        <p className="mb-4 text-sm text-muted-foreground">
          &ldquo;{q}&rdquo;: {problems.length} problem(s), {lessons.length} lesson(s) across {sessionCount} brew(s)
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>💡 Lessons</CardTitle>
          {lessons.length === 0 ? (
            <Empty>{q ? "No matching lessons." : "No lessons yet."}</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {lessons.map((l) => (
                <LessonItem
                  key={l.id}
                  lesson={l}
                  source={
                    l.brewSession
                      ? {
                          href: `/brews/${l.brewSession.id}`,
                          label: `${batchLabel(l.brewSession.recipe.name, l.brewSession.batchNumber)}${l.problem ? ` · from “${l.problem.title}”` : ""}`,
                        }
                      : undefined
                  }
                />
              ))}
            </ul>
          )}
          {!q && (
            <>
              <h3 className="mt-4 text-sm font-medium">Add a general lesson</h3>
              <LessonForm sessionId={null} />
            </>
          )}
        </Card>

        <Card>
          <CardTitle>⚠️ Problems</CardTitle>
          {problems.length === 0 ? (
            <Empty>{q ? "No matching problems." : "No problems logged yet."}</Empty>
          ) : (
            <div className="flex flex-col gap-3">
              {problems.map((p) => (
                <div key={p.id}>
                  <Link
                    href={p.brewStep ? `/brews/${p.brewSession.id}/steps/${stepByType(p.brewStep.type).slug}` : `/brews/${p.brewSession.id}`}
                    className="mb-1 block text-xs text-muted-foreground underline"
                  >
                    {batchLabel(p.brewSession.recipe.name, p.brewSession.batchNumber)} · {fmtDate(p.brewSession.brewDate)}
                  </Link>
                  <ProblemCard problem={p} showStep readOnly />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
