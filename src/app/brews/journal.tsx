import Link from "next/link";
import { X } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Highlight } from "@/components/highlight";
import { Badge, Button, Field, Input, Textarea } from "@/components/ui";
import { stepByType } from "@/lib/brewing";
import type { StepType } from "@/generated/prisma/enums";
import { addLesson, addProblem, deleteLesson, deleteProblem } from "./actions";
import { getI18n } from "@/lib/i18n/server";

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

export async function ProblemForm({
  sessionId,
  stepId,
  prefill,
}: {
  sessionId: number;
  stepId: number | null;
  prefill?: { title?: string; description?: string };
}) {
  const { t } = await getI18n();
  return (
    <details open={!!prefill?.title} id="new-problem" className="rounded-md border border-dashed border-border p-3">
      <summary className="cursor-pointer text-sm font-medium">{t("+ Add problem")}</summary>
      <ActionForm action={addProblem.bind(null, sessionId, stepId)} resetOnSuccess className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label={t("Problem")} className="sm:col-span-2">
          <Input name="title" required defaultValue={prefill?.title} placeholder={t("Mash temperature higher than target")} />
        </Field>
        <Field label={t("Details")} className="sm:col-span-2">
          <Textarea name="description" rows={2} defaultValue={prefill?.description} />
        </Field>
        <Field label={t("Cause")}>
          <Input name="cause" placeholder={t("Strike water too hot")} />
        </Field>
        <Field label={t("Action taken")}>
          <Input name="action" placeholder={t("Added cold water")} />
        </Field>
        <Field label={t("Impact")}>
          <Input name="impact" placeholder={t("Came back to 69.5°C")} />
        </Field>
        <Field label={t("Lesson learned")} hint={t("Optional — saved as a searchable lesson")}>
          <Input name="lesson" placeholder={t("Lower strike temp by 1°C")} />
        </Field>
        <div className="sm:col-span-2">
          <Button type="submit">{t("Save problem")}</Button>
        </div>
      </ActionForm>
    </details>
  );
}

export async function ProblemCard({
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
  const { t } = await getI18n();
  const rows = [
    [t("Cause"), problem.cause],
    [t("Action"), problem.action],
    [t("Impact"), problem.impact],
  ].filter(([, value]) => value);
  return (
    <article className="rounded-md border border-warning-border bg-warning-bg p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="font-semibold">
            ⚠️ <Highlight text={problem.title} terms={terms} />
          </span>
          {showStep && problem.brewStep && (
            <Badge className="ml-2">{t(stepByType(problem.brewStep.type).label)}</Badge>
          )}
        </div>
        {!readOnly && (
          <form action={deleteProblem.bind(null, problem.id)}>
            <button aria-label={t("Delete problem")} className="rounded p-1 text-muted-foreground hover:bg-muted">
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

export async function LessonItem({
  lesson,
  source,
  terms,
}: {
  lesson: LessonData;
  source?: { href: string; label: string };
  terms?: string[];
}) {
  const { t } = await getI18n();
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
        <button aria-label={t("Delete lesson")} className="rounded p-1 text-muted-foreground hover:bg-muted">
          <X className="size-4" />
        </button>
      </form>
    </li>
  );
}

export async function LessonForm({ sessionId }: { sessionId: number | null }) {
  const { t } = await getI18n();
  return (
    <ActionForm action={addLesson.bind(null, sessionId)} resetOnSuccess className="mt-2 flex flex-col gap-2">
      <Input name="text" required placeholder={t("e.g. Don't measure OG while wort is ~70°C")} aria-label={t("Lesson")} />
      <div className="flex gap-2">
        <Input name="tags" placeholder={t("tags, comma separated")} aria-label={t("Tags")} />
        <Button type="submit" variant="secondary" className="shrink-0">
          {t("Add lesson")}
        </Button>
      </div>
    </ActionForm>
  );
}
