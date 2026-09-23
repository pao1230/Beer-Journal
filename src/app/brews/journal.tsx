import Link from "next/link";
import { X } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Highlight } from "@/components/highlight";
import { Badge, Button, Field, Input, Textarea } from "@/components/ui";
import { stepByType } from "@/lib/brewing";
import type { StepType } from "@/generated/prisma/enums";
import { addLesson, addProblem, deleteLesson, deleteProblem } from "./actions";

type LessonData = { id: number; text: string; tags: string[] };

type ProblemData = {
  id: number;
  title: string;
  description: string | null;
  cause: string | null;
  action: string | null;
  impact: string | null;
  brewStep: { type: StepType } | null;
  lessons: LessonData[];
};

export function ProblemForm({
  sessionId,
  stepId,
  prefill,
}: {
  sessionId: number;
  stepId: number | null;
  prefill?: { title?: string; description?: string };
}) {
  return (
    <details open={!!prefill?.title} id="new-problem" className="rounded-md border border-dashed border-border p-3">
      <summary className="cursor-pointer text-sm font-medium">+ Add problem</summary>
      <ActionForm action={addProblem.bind(null, sessionId, stepId)} resetOnSuccess className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Problem" className="sm:col-span-2">
          <Input name="title" required defaultValue={prefill?.title} placeholder="Mash temperature higher than target" />
        </Field>
        <Field label="Details" className="sm:col-span-2">
          <Textarea name="description" rows={2} defaultValue={prefill?.description} />
        </Field>
        <Field label="Cause">
          <Input name="cause" placeholder="Strike water too hot" />
        </Field>
        <Field label="Action taken">
          <Input name="action" placeholder="Added cold water" />
        </Field>
        <Field label="Impact">
          <Input name="impact" placeholder="Came back to 69.5°C" />
        </Field>
        <Field label="Lesson learned" hint="Optional — saved as a searchable lesson">
          <Input name="lesson" placeholder="Lower strike temp by 1°C" />
        </Field>
        <div className="sm:col-span-2">
          <Button type="submit">Save problem</Button>
        </div>
      </ActionForm>
    </details>
  );
}

export function ProblemCard({
  problem,
  showStep,
  readOnly,
  terms,
}: {
  problem: ProblemData;
  showStep?: boolean;
  readOnly?: boolean;
  terms?: string[];
}) {
  const rows = [
    ["Cause", problem.cause],
    ["Action", problem.action],
    ["Impact", problem.impact],
  ].filter(([, value]) => value);
  return (
    <article className="rounded-md border border-warning-border bg-warning-bg p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="font-semibold">
            ⚠️ <Highlight text={problem.title} terms={terms} />
          </span>
          {showStep && problem.brewStep && (
            <Badge className="ml-2">{stepByType(problem.brewStep.type).label}</Badge>
          )}
        </div>
        {!readOnly && (
          <form action={deleteProblem.bind(null, problem.id)}>
            <button aria-label="Delete problem" className="rounded p-1 text-muted-foreground hover:bg-muted">
              <X className="size-4" />
            </button>
          </form>
        )}
      </div>
      {problem.description && (
        <p className="mt-1 whitespace-pre-wrap">
          <Highlight text={problem.description} terms={terms} />
        </p>
      )}
      {rows.length > 0 && (
        <dl className="mt-2 grid grid-cols-[5rem_1fr] gap-x-2 gap-y-0.5">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd>
                <Highlight text={value!} terms={terms} />
              </dd>
            </div>
          ))}
        </dl>
      )}
      {problem.lessons.map((l) => (
        <p key={l.id} className="mt-2">
          💡 <Highlight text={l.text} terms={terms} />
        </p>
      ))}
    </article>
  );
}

export function LessonItem({
  lesson,
  source,
  terms,
}: {
  lesson: LessonData;
  source?: { href: string; label: string };
  terms?: string[];
}) {
  return (
    <li className="flex items-start justify-between gap-2 py-2 text-sm">
      <div>
        <p>
          💡 <Highlight text={lesson.text} terms={terms} />
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          {lesson.tags.map((t) => (
            <Badge key={t}>#{t}</Badge>
          ))}
          {source && (
            <Link href={source.href} className="text-xs text-muted-foreground underline">
              {source.label}
            </Link>
          )}
        </div>
      </div>
      <form action={deleteLesson.bind(null, lesson.id)}>
        <button aria-label="Delete lesson" className="rounded p-1 text-muted-foreground hover:bg-muted">
          <X className="size-4" />
        </button>
      </form>
    </li>
  );
}

export function LessonForm({ sessionId }: { sessionId: number | null }) {
  return (
    <ActionForm action={addLesson.bind(null, sessionId)} resetOnSuccess className="mt-2 flex flex-col gap-2 sm:flex-row">
      <Input name="text" required placeholder="e.g. Don't measure OG while wort is ~70°C" />
      <Input name="tags" placeholder="tags, comma separated" className="sm:max-w-48" />
      <Button type="submit" variant="secondary">
        Add lesson
      </Button>
    </ActionForm>
  );
}
