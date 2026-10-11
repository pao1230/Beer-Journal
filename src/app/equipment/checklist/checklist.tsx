"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { Button, Card, Input, Textarea } from "@/components/ui";
import { useI18n } from "@/lib/i18n/client";
import {
  exportChecklist,
  moveItem,
  moveSection,
  nextStatus,
  summarize,
  type ChecklistSection,
  type ChecklistStatus,
} from "@/lib/checklist";
import { cn } from "@/lib/utils";
import * as actions from "./actions";

type Tab = "check" | "manage";

const GLYPH: Record<ChecklistStatus, string> = { TODO: "", OK: "✓", MISSING: "!", SKIP: "–" };
const LABEL: Record<ChecklistStatus, string> = { TODO: "Not checked", OK: "Have it", MISSING: "Missing", SKIP: "Not used" };
const BOX: Record<ChecklistStatus, string> = {
  TODO: "border-border bg-card",
  OK: "border-ok bg-ok-bg text-ok",
  MISSING: "border-danger bg-danger-bg text-danger",
  SKIP: "border-skip bg-skip-bg text-skip",
};
const CHIP: Record<ChecklistStatus, string> = {
  TODO: "border-border",
  OK: "border-transparent bg-ok-bg text-ok",
  MISSING: "border-transparent bg-danger-bg text-danger",
  SKIP: "border-transparent bg-skip-bg text-skip",
};

const step = (i: number) => `STEP ${String(i + 1).padStart(2, "0")}`;

/**
 * Brew-day equipment checklist. The page keeps the whole list in state and saves each change in
 * the background, so ticking and editing never wait on the server.
 */
export function Checklist({ initial, initialTab }: { initial: ChecklistSection[]; initialTab: Tab }) {
  const { t } = useI18n();
  const [sections, setSections] = useState(initial);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [failed, setFailed] = useState(false);

  const fail = () => setFailed(true);
  const persist = (p: Promise<unknown>) => void p.catch(fail);

  function show(next: Tab) {
    setTab(next);
    window.history.replaceState(null, "", next === "manage" ? "?tab=manage" : window.location.pathname);
    window.scrollTo(0, 0);
  }

  return (
    <>
      <div role="tablist" aria-label={t("Checklist")} className="flex gap-2">
        {(["check", "manage"] as const).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => show(key)}
            className={cn(
              "min-h-11 flex-1 rounded-lg border px-3 font-display font-semibold",
              tab === key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted",
            )}
          >
            {t(key === "check" ? "Check equipment" : "Manage list")}
          </button>
        ))}
      </div>

      {failed && (
        <div role="alert" className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-danger bg-danger-bg p-3 text-sm text-danger">
          <span className="flex-1">{t("Some changes weren't saved. Reload to see what's saved.")}</span>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            {t("Reload")}
          </Button>
        </div>
      )}

      {tab === "check" ? (
        <CheckView sections={sections} setSections={setSections} persist={persist} fail={fail} onManage={() => show("manage")} />
      ) : (
        <ManageView sections={sections} setSections={setSections} persist={persist} fail={fail} />
      )}
    </>
  );
}

type ViewProps = {
  sections: ChecklistSection[];
  setSections: (update: (prev: ChecklistSection[]) => ChecklistSection[]) => void;
  /** Saves in the background; a failure shows the reload banner. */
  persist: (p: Promise<unknown>) => void;
  fail: () => void;
};

function CheckView({ sections, setSections, persist, fail, onManage }: ViewProps & { onManage: () => void }) {
  const { t } = useI18n();
  const sum = summarize(sections);

  function setStatus(itemId: number, status: ChecklistStatus) {
    setSections((prev) =>
      prev.map((s) => ({ ...s, items: s.items.map((i) => (i.id === itemId ? { ...i, status } : i)) })),
    );
    persist(actions.setItemStatus(itemId, status));
  }

  function allHere(sectionId: number) {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId ? { ...s, items: s.items.map((i) => (i.status === "TODO" ? { ...i, status: "OK" } : i)) } : s,
      ),
    );
    persist(actions.markSectionOk(sectionId));
  }

  function reset() {
    setSections((prev) => prev.map((s) => ({ ...s, items: s.items.map((i) => ({ ...i, status: "TODO" })) })));
    persist(actions.resetStatuses());
    window.scrollTo(0, 0);
  }

  if (!sections.length) return <EmptyChecklist setSections={setSections} persist={persist} fail={fail} onManage={onManage} />;

  const verdict = !sum.total
    ? { text: t("No items yet"), cls: "" }
    : sum.MISSING
      ? { text: t("Missing {n} item(s)", { n: sum.MISSING }), cls: "text-danger" }
      : !sum.TODO
        ? { text: t("All equipment here, ready to brew"), cls: "text-ok" }
        : { text: t("Checked {done} of {total}", { done: sum.total - sum.TODO, total: sum.total }), cls: "" };

  return (
    <>
      <div
        aria-live="polite"
        className="sticky top-14 z-10 mt-4 grid gap-2.5 rounded-lg border border-border bg-card px-3.5 py-3"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <span className={cn("font-display text-[1.05rem] font-semibold", verdict.cls)}>{verdict.text}</span>
          <div className="flex flex-wrap gap-1.5 font-mono text-xs">
            <Chip status="OK">{t("Have {n}", { n: sum.OK })}</Chip>
            <Chip status="MISSING">{t("Missing {n}", { n: sum.MISSING })}</Chip>
            <Chip status="SKIP">{t("Not used {n}", { n: sum.SKIP })}</Chip>
            <Chip status="TODO">{t("To check {n}", { n: sum.TODO })}</Chip>
          </div>
        </div>
        <div
          role="progressbar"
          aria-label={t("Checklist progress")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={sum.percent}
          className="h-1.5 overflow-hidden rounded-full bg-border"
        >
          <i
            className="block h-full bg-primary transition-[width] duration-200 motion-reduce:transition-none"
            style={{ width: `${sum.percent}%` }}
          />
        </div>
      </div>

      <ul className="mt-3.5 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
        {(["TODO", "OK", "MISSING", "SKIP"] as const).map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <Chip status={s}>{GLYPH[s] || t("blank")}</Chip>
            {t(s === "MISSING" ? "Missing / need to get" : s === "SKIP" ? "Not used this batch" : LABEL[s])}
          </li>
        ))}
      </ul>

      {sum.missing.length > 0 && <ShoppingList missing={sum.missing} />}

      {sections.map((sec, si) => {
        const done = sec.items.filter((i) => i.status !== "TODO").length;
        return (
          <section key={sec.id} className="mt-7">
            <div className="flex flex-wrap items-baseline gap-3 border-b-2 border-foreground pb-2">
              <span className="font-mono text-sm text-muted-foreground">{step(si)}</span>
              <h2 className="min-w-0 flex-[1_1_12ch] text-xl font-semibold break-words">{sec.title || t("(untitled)")}</h2>
              <div className="ml-auto flex items-center gap-2.5">
                <span className="font-mono text-sm text-muted-foreground tabular-nums">
                  {done}/{sec.items.length}
                </span>
                {sec.items.length > 0 && (
                  <Button variant="secondary" onClick={() => allHere(sec.id)}>
                    {t("All here")}
                  </Button>
                )}
              </div>
            </div>
            {sec.description && <p className="mt-2 text-sm text-muted-foreground break-words">{sec.description}</p>}
            {sec.items.length === 0 ? (
              <p className="mt-2.5 rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                {t("No items in this section yet. Add them under Manage list.")}
              </p>
            ) : (
              <ul className="mt-2">
                {sec.items.map((it) => (
                  <li key={it.id}>
                    <button
                      type="button"
                      onClick={() => setStatus(it.id, nextStatus(it.status))}
                      aria-label={t("{name}, status: {status}", { name: it.name, status: t(LABEL[it.status]) })}
                      className="grid min-h-13 w-full grid-cols-[40px_1fr] items-start gap-3 border-b border-border px-1 py-2.5 text-left hover:bg-card"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "grid size-9 place-items-center rounded-lg border-2 font-mono text-lg font-semibold",
                          BOX[it.status],
                        )}
                      >
                        {GLYPH[it.status]}
                      </span>
                      <span className="min-w-0">
                        <span
                          className={cn(
                            "block font-medium break-words",
                            it.status === "SKIP" && "text-muted-foreground line-through decoration-border",
                          )}
                        >
                          {it.name}
                        </span>
                        {it.note && <span className="block text-sm text-muted-foreground break-words">{it.note}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <div className="mt-8">
        <ConfirmButton armedLabel={t("Tap again to clear every status")} onConfirm={reset}>
          {t("Start a new batch (clear all statuses)")}
        </ConfirmButton>
      </div>
      <p className="mt-7 max-w-prose text-sm text-muted-foreground">
        {t("Values in the notes are general guidance; adjust them to your recipe and equipment.")}
      </p>
    </>
  );
}

function Chip({ status, children }: { status: ChecklistStatus; children: ReactNode }) {
  return <span className={cn("rounded-full border px-2 py-0.5 tabular-nums", CHIP[status])}>{children}</span>;
}

function ShoppingList({ missing }: { missing: ReturnType<typeof summarize>["missing"] }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState<string | null>(null);
  async function copy() {
    const text = `${t("Need to get")}\n${missing.map((m) => `- ${m.name}`).join("\n")}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(t("Copied"));
    } catch {
      setCopied(t("Couldn't copy; select the text instead"));
    }
    setTimeout(() => setCopied(null), 1800);
  }
  return (
    <div className="mt-4 grid gap-2.5 rounded-lg border border-danger bg-card p-3.5">
      <h2 className="font-semibold text-danger">{t("Get these before you start")}</h2>
      <ul className="grid list-disc gap-0.5 pl-5">
        {missing.map((m, i) => (
          <li key={i}>
            {m.name}{" "}
            <span className="font-mono text-xs text-muted-foreground">
              {step(m.step - 1)} {m.section}
            </span>
          </li>
        ))}
      </ul>
      <div>
        <Button variant="secondary" onClick={copy}>
          {copied ?? t("Copy list")}
        </Button>
      </div>
    </div>
  );
}

function EmptyChecklist({ setSections, persist, onManage }: Omit<ViewProps, "sections"> & { onManage: () => void }) {
  const { t } = useI18n();
  const [pending, setPending] = useState(false);
  return (
    <Card className="mt-4 grid justify-items-start gap-3">
      <p className="text-sm text-muted-foreground">
        {t("No checklist yet. Start from the starter list (sanitising through kegging) or build your own.")}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={pending}
          onClick={() => {
            setPending(true);
            persist(actions.restoreDefaultChecklist().then((list) => setSections(() => list)));
          }}
        >
          {t("Use the starter list")}
        </Button>
        <Button variant="secondary" onClick={onManage}>
          {t("Build my own")}
        </Button>
      </div>
    </Card>
  );
}

function ManageView({ sections, setSections, persist, fail }: ViewProps) {
  const { t } = useI18n();
  const [adding, setAdding] = useState(false);
  // Field to focus once the section or item just added has rendered.
  const focusNext = useRef<string | null>(null);

  useEffect(() => {
    if (!focusNext.current) return;
    const el = document.getElementById(focusNext.current);
    el?.focus();
    el?.scrollIntoView({ block: "center" });
    focusNext.current = null;
  }, [sections]);

  function reorder(next: ChecklistSection[] | null) {
    if (!next) return;
    setSections(() => next);
    persist(actions.saveOrder(next.map((s) => ({ id: s.id, itemIds: s.items.map((i) => i.id) }))));
  }

  function patchSection(id: number, patch: Partial<ChecklistSection>) {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function patchItem(id: number, patch: { name?: string; note?: string }) {
    setSections((prev) =>
      prev.map((s) => ({ ...s, items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),
    );
  }

  async function addSection() {
    setAdding(true);
    const title = t("New section");
    try {
      const id = await actions.addSection(title);
      setSections((prev) => [...prev, { id, title, description: "", items: [] }]);
      focusNext.current = `section-title-${id}`;
    } catch {
      fail();
    }
    setAdding(false);
  }

  return (
    <>
      <p className="mt-4 max-w-prose text-sm text-muted-foreground">
        {t("Edit names right in the fields; changes save automatically. The order here is the order on the checklist. Moving an item past the top or bottom of its section moves it to the next section.")}
      </p>

      {sections.map((sec, si) => (
        <Card key={sec.id} className="mt-4 grid gap-3 p-3.5">
          <div className="grid gap-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-muted-foreground">{step(si)}</span>
              <div className="ml-auto flex gap-1">
                <IconButton label={t("Move section up")} disabled={si === 0} onClick={() => reorder(moveSection(sections, si, -1))}>
                  <ArrowUp className="size-4" />
                </IconButton>
                <IconButton
                  label={t("Move section down")}
                  disabled={si === sections.length - 1}
                  onClick={() => reorder(moveSection(sections, si, 1))}
                >
                  <ArrowDown className="size-4" />
                </IconButton>
                <ConfirmButton
                  compact
                  label={t("Delete section {name}", { name: sec.title })}
                  armedLabel={t("Delete section?")}
                  onConfirm={() => {
                    setSections((prev) => prev.filter((s) => s.id !== sec.id));
                    persist(actions.deleteSection(sec.id));
                  }}
                >
                  <X className="size-4" />
                </ConfirmButton>
              </div>
            </div>
            <AutoInput
              id={`section-title-${sec.id}`}
              className="font-display font-semibold"
              value={sec.title}
              placeholder={t("Section name")}
              aria-label={t("Section name")}
              onChange={(title) => patchSection(sec.id, { title })}
              onSave={(title) => persist(actions.updateSection(sec.id, { title }))}
            />
            <AutoInput
              className="text-sm"
              value={sec.description}
              placeholder={t("Short description (optional)")}
              aria-label={t("Section description")}
              onChange={(description) => patchSection(sec.id, { description })}
              onSave={(description) => persist(actions.updateSection(sec.id, { description }))}
            />
          </div>

          {sec.items.length > 0 && (
            <ul className="grid gap-2">
              {sec.items.map((it, ii) => (
                <li
                  key={it.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 rounded-lg border border-border bg-background p-2"
                >
                  <div className="grid min-w-0 gap-1.5">
                    <AutoInput
                      value={it.name}
                      placeholder={t("Equipment name")}
                      aria-label={t("Equipment name")}
                      onChange={(name) => patchItem(it.id, { name })}
                      onSave={(name) => persist(actions.updateItem(it.id, { name }))}
                    />
                    <AutoInput
                      className="text-sm"
                      value={it.note}
                      placeholder={t("Note (optional)")}
                      aria-label={t("Note for {name}", { name: it.name })}
                      onChange={(note) => patchItem(it.id, { note })}
                      onSave={(note) => persist(actions.updateItem(it.id, { note }))}
                    />
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    <IconButton
                      label={t("Move up")}
                      disabled={si === 0 && ii === 0}
                      onClick={() => reorder(moveItem(sections, si, ii, -1))}
                    >
                      <ArrowUp className="size-4" />
                    </IconButton>
                    <IconButton
                      label={t("Move down")}
                      disabled={si === sections.length - 1 && ii === sec.items.length - 1}
                      onClick={() => reorder(moveItem(sections, si, ii, 1))}
                    >
                      <ArrowDown className="size-4" />
                    </IconButton>
                    <ConfirmButton
                      compact
                      label={t("Delete {name}", { name: it.name })}
                      armedLabel={t("Delete?")}
                      onConfirm={() => {
                        setSections((prev) =>
                          prev.map((s) => (s.id === sec.id ? { ...s, items: s.items.filter((i) => i.id !== it.id) } : s)),
                        );
                        persist(actions.deleteItem(it.id));
                      }}
                    >
                      <X className="size-4" />
                    </ConfirmButton>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <AddItem
            sectionId={sec.id}
            sectionTitle={sec.title}
            onAdded={(item) => {
              setSections((prev) => prev.map((s) => (s.id === sec.id ? { ...s, items: [...s.items, item] } : s)));
              focusNext.current = `add-item-${sec.id}`;
            }}
            onError={fail}
          />
        </Card>
      ))}

      {!sections.length && (
        <p className="mt-4 rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
          {t("No sections yet. Tap “New section” below.")}
        </p>
      )}

      <div className="mt-5">
        <Button onClick={addSection} disabled={adding}>
          <Plus className="size-4" />
          {t("New section")}
        </Button>
      </div>

      <Backup sections={sections} setSections={setSections} persist={persist} fail={fail} />
    </>
  );
}

function AddItem({
  sectionId,
  sectionTitle,
  onAdded,
  onError,
}: {
  sectionId: number;
  sectionTitle: string;
  onAdded: (item: ChecklistSection["items"][number]) => void;
  onError: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  async function add() {
    const n = name.trim();
    if (!n) return nameRef.current?.focus();
    setPending(true);
    try {
      const id = await actions.addItem(sectionId, n, note);
      onAdded({ id, name: n, note: note.trim(), status: "TODO" });
      setName("");
      setNote("");
    } catch {
      onError();
    }
    setPending(false);
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void add();
    }
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 pt-1">
      <div className="grid min-w-0 gap-1.5">
        <Input
          ref={nameRef}
          id={`add-item-${sectionId}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t("Add equipment")}
          aria-label={t("New equipment in {name}", { name: sectionTitle })}
          autoComplete="off"
          className="bg-background"
        />
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t("Note (optional)")}
          aria-label={t("Note for the new equipment")}
          autoComplete="off"
          className="bg-background text-sm"
        />
      </div>
      <Button onClick={add} disabled={pending}>
        {t("Add")}
      </Button>
    </div>
  );
}

function Backup({ sections, setSections, persist, fail }: ViewProps) {
  const { t } = useI18n();
  const [json, setJson] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [pending, setPending] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);

  async function copy() {
    const text = json.trim() ? json : exportChecklist(sections);
    setJson(text);
    try {
      await navigator.clipboard.writeText(text);
      setMsg({ text: t("Copied"), ok: true });
    } catch {
      box.current?.select();
      setMsg({ text: t("Couldn't copy automatically. The text is selected; copy it yourself."), ok: false });
    }
  }

  async function runImport() {
    if (!json.trim()) return setMsg({ text: t("Paste JSON first."), ok: false });
    setPending(true);
    try {
      const res = await actions.importChecklist(json);
      if (res.error) setMsg({ text: t("Couldn't import: {error}", { error: res.error }), ok: false });
      else if (res.sections) {
        setSections(() => res.sections!);
        setMsg({ text: t("Imported {n} section(s).", { n: res.sections.length }), ok: true });
      }
    } catch {
      fail();
    }
    setPending(false);
  }

  function restore() {
    setPending(true);
    persist(
      actions.restoreDefaultChecklist().then((list) => {
        setSections(() => list);
        setMsg({ text: t("Starter list restored."), ok: true });
        setPending(false);
      }),
    );
  }

  return (
    <Card className="mt-6 grid gap-2.5 p-3.5">
      <h2 className="font-semibold">{t("Back up and move the list")}</h2>
      <p className="text-sm text-muted-foreground">
        {t("Copy the JSON to keep it, or paste a backup to import it. Importing replaces every section and clears the ticks. Backups from the stand-alone checklist page work too.")}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            setJson(exportChecklist(sections));
            setMsg({ text: t("Showing the current list as JSON."), ok: true });
          }}
        >
          {t("Show JSON")}
        </Button>
        <Button variant="secondary" onClick={copy}>
          {t("Copy")}
        </Button>
      </div>
      <Textarea
        ref={box}
        value={json}
        onChange={(e) => setJson(e.target.value)}
        spellCheck={false}
        placeholder={t("Paste JSON here to import")}
        aria-label="JSON"
        className="min-h-30 bg-background font-mono text-xs"
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={runImport} disabled={pending}>
          {t("Import from text")}
        </Button>
        <ConfirmButton armedLabel={t("Tap again to confirm (all edits will be lost)")} onConfirm={restore} disabled={pending}>
          {t("Restore the starter list")}
        </ConfirmButton>
      </div>
      <p role="status" className={cn("min-h-5 text-sm", msg && (msg.ok ? "text-ok" : "text-danger"))}>
        {msg?.text}
      </p>
    </Card>
  );
}

/** Text field that updates the page at once and saves after a pause in typing (or on leaving it). */
function AutoInput({
  value,
  onChange,
  onSave,
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
  onSave: (value: string) => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pending = useRef<string | null>(null);
  const save = useRef(onSave);
  useEffect(() => {
    save.current = onSave;
  });

  const flush = () => {
    clearTimeout(timer.current);
    if (pending.current !== null) save.current(pending.current);
    pending.current = null;
  };
  useEffect(() => flush, []);

  return (
    <Input
      {...props}
      value={value}
      autoComplete="off"
      className={cn("bg-card", className)}
      onChange={(e) => {
        onChange(e.target.value);
        pending.current = e.target.value;
        clearTimeout(timer.current);
        timer.current = setTimeout(flush, 600);
      }}
      onBlur={flush}
    />
  );
}

function IconButton({
  label,
  children,
  ...props
}: React.ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="grid size-10 place-items-center rounded-md border border-border bg-card hover:border-primary disabled:pointer-events-none disabled:opacity-35"
      {...props}
    >
      {children}
    </button>
  );
}

/** Destructive button that needs a second tap within a few seconds. */
function ConfirmButton({
  children,
  armedLabel,
  onConfirm,
  label,
  compact,
  disabled,
}: {
  children: ReactNode;
  armedLabel: string;
  onConfirm: () => void;
  /** Accessible name when the idle content is only an icon. */
  label?: string;
  compact?: boolean;
  disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={armed ? armedLabel : label}
      title={armed ? undefined : label}
      onClick={() => {
        clearTimeout(timer.current);
        if (!armed) {
          setArmed(true);
          timer.current = setTimeout(() => setArmed(false), 3500);
          return;
        }
        setArmed(false);
        onConfirm();
      }}
      className={cn(
        "inline-flex min-h-10 items-center justify-center rounded-md border text-sm disabled:opacity-50",
        compact ? "min-w-10 px-2" : "px-3.5",
        armed ? "border-danger bg-danger text-background font-semibold" : "border-border bg-card hover:border-primary",
      )}
    >
      {armed ? armedLabel : children}
    </button>
  );
}
