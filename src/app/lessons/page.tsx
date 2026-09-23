import Link from "next/link";
import { Highlight } from "@/components/highlight";
import { Card, CardTitle, Empty, Input, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { batchLabel, daysSince, fmtDate, stepByType } from "@/lib/brewing";
import { allTermsIn, parseQuery } from "@/lib/search";
import type { Prisma } from "@/generated/prisma/client";
import { LessonForm, LessonItem, ProblemCard } from "../brews/journal";

export const metadata = { title: "Lessons & Problems" };

const sessionSelect = { select: { id: true, batchNumber: true, brewDate: true, recipe: { select: { name: true } } } };

type NoteHit = { key: string; href: string; source: string; where: string; text: string; sessionId: number };

export default async function LessonsPage(props: PageProps<"/lessons">) {
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const terms = parseQuery(q);
  const searching = terms.length > 0;

  const lessonWhere: Prisma.LessonWhereInput = searching
    ? {
        AND: terms.map((t) => ({
          OR: [
            { text: { contains: t, mode: "insensitive" as const } },
            { tags: { has: t.toLowerCase() } },
            { problem: { is: { title: { contains: t, mode: "insensitive" as const } } } },
          ],
        })),
      }
    : {};
  const problemWhere: Prisma.ProblemWhereInput = searching
    ? allTermsIn(terms, ["title", "description", "cause", "action", "impact"])
    : {};

  const [lessons, problems, stepNotes, sessionNotes, logNotes] = await Promise.all([
    db.lesson.findMany({
      where: lessonWhere,
      orderBy: { createdAt: "desc" },
      include: { brewSession: sessionSelect, problem: { select: { title: true } } },
    }),
    db.problem.findMany({
      where: problemWhere,
      orderBy: { createdAt: "desc" },
      include: { brewSession: sessionSelect, brewStep: { select: { type: true } }, lessons: true },
    }),
    searching
      ? db.brewStep.findMany({ where: allTermsIn(terms, ["notes"]), include: { brewSession: sessionSelect } })
      : [],
    searching
      ? db.brewSession.findMany({
          where: allTermsIn(terms, ["notes"]),
          select: { ...sessionSelect.select, notes: true },
        })
      : [],
    searching
      ? db.fermentationLog.findMany({
          where: allTermsIn(terms, ["notes", "activity"]),
          include: { brewStep: { include: { brewSession: sessionSelect } } },
        })
      : [],
  ]);

  const label = (s: { recipe: { name: string }; batchNumber: number }) => batchLabel(s.recipe.name, s.batchNumber);
  const notes: NoteHit[] = [
    ...sessionNotes.map((s) => ({
      key: `s${s.id}`,
      href: `/brews/${s.id}`,
      source: label(s),
      where: "Brew notes",
      text: s.notes ?? "",
      sessionId: s.id,
    })),
    ...stepNotes.map((st) => ({
      key: `st${st.id}`,
      href: `/brews/${st.brewSession.id}/steps/${stepByType(st.type).slug}`,
      source: label(st.brewSession),
      where: stepByType(st.type).label,
      text: st.notes ?? "",
      sessionId: st.brewSession.id,
    })),
    ...logNotes.map((l) => ({
      key: `f${l.id}`,
      href: `/brews/${l.brewStep.brewSession.id}/steps/fermentation`,
      source: label(l.brewStep.brewSession),
      where: `Fermentation day ${daysSince(l.brewStep.brewSession.brewDate, l.date)}`,
      text: [l.activity, l.notes].filter(Boolean).join(" · "),
      sessionId: l.brewStep.brewSession.id,
    })),
  ];
  const sessionCount = new Set([
    ...problems.map((p) => p.brewSessionId),
    ...lessons.flatMap((l) => (l.brewSessionId ? [l.brewSessionId] : [])),
    ...notes.map((n) => n.sessionId),
  ]).size;

  return (
    <>
      <PageHeader title="🧠 Lessons & Problems" subtitle="Your brewing knowledge base — search every problem, lesson and note across all batches." />
      <form className="mb-2 flex gap-2">
        <Input name="q" defaultValue={q} placeholder='e.g. hydrometer, "mash temp", อุณหภูมิ' aria-label="Search" />
        <button className="min-h-10 rounded-md border border-border px-3 text-sm hover:bg-muted">Search</button>
      </form>
      <p className="mb-4 text-xs text-muted-foreground">
        All words must match. Use &ldquo;quotes&rdquo; for an exact phrase. Works for Thai and English.
      </p>
      {searching && (
        <p className="mb-4 text-sm" role="status">
          <strong>{problems.length}</strong> problem(s) · <strong>{lessons.length}</strong> lesson(s) ·{" "}
          <strong>{notes.length}</strong> note(s) — across <strong>{sessionCount}</strong> brew(s)
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>💡 Lessons</CardTitle>
          {lessons.length === 0 ? (
            <Empty>{searching ? "No matching lessons." : "No lessons yet."}</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {lessons.map((l) => (
                <LessonItem
                  key={l.id}
                  lesson={l}
                  terms={terms}
                  source={
                    l.brewSession
                      ? {
                          href: `/brews/${l.brewSession.id}`,
                          label: `${label(l.brewSession)}${l.problem ? ` · from “${l.problem.title}”` : ""}`,
                        }
                      : undefined
                  }
                />
              ))}
            </ul>
          )}
          {!searching && (
            <>
              <h3 className="mt-4 text-sm font-medium">Add a general lesson</h3>
              <LessonForm sessionId={null} />
            </>
          )}
        </Card>

        <Card>
          <CardTitle>⚠️ Problems</CardTitle>
          {problems.length === 0 ? (
            <Empty>{searching ? "No matching problems." : "No problems logged yet."}</Empty>
          ) : (
            <div className="flex flex-col gap-3">
              {problems.map((p) => (
                <div key={p.id}>
                  <Link
                    href={p.brewStep ? `/brews/${p.brewSession.id}/steps/${stepByType(p.brewStep.type).slug}` : `/brews/${p.brewSession.id}`}
                    className="mb-1 block text-xs text-muted-foreground underline"
                  >
                    {label(p.brewSession)} · {fmtDate(p.brewSession.brewDate)}
                  </Link>
                  <ProblemCard problem={p} showStep readOnly terms={terms} />
                </div>
              ))}
            </div>
          )}
        </Card>

        {searching && (
          <Card className="md:col-span-2">
            <CardTitle>📝 Notes</CardTitle>
            {notes.length === 0 ? (
              <Empty>No matching notes.</Empty>
            ) : (
              <ul className="divide-y divide-border">
                {notes.map((n) => (
                  <li key={n.key} className="py-2 text-sm">
                    <Link href={n.href} className="text-xs text-muted-foreground underline">
                      {n.source} · {n.where}
                    </Link>
                    <p className="mt-0.5 whitespace-pre-wrap">
                      <Highlight text={n.text} terms={terms} />
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
