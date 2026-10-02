"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Download, Printer, Settings2, Share2, ShoppingCart } from "lucide-react";
import { Button, Field, Input, Select } from "@/components/ui";
import { cn } from "@/lib/utils";
import { fmtNum } from "@/lib/brewing";
import { useI18n } from "@/lib/i18n/client";
import type { Shortage } from "@/lib/inventory";
import { exportSearch, SECTIONS, type ExportOptions, type Section } from "./options";

const STORAGE_KEY = "recipe-export-options";

const SECTION_LABELS: Record<Section, string> = {
  notes: "Notes & highlights",
  ferment: "Fermentation & dry hop",
  keg: "Kegging guide",
  serving: "Serving pressure table",
  code: "QR code for importing",
};

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-1 text-sm">
      <legend className="mb-1 font-medium">{label}</legend>
      <div className="flex rounded-md border border-border bg-muted p-0.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "min-h-9 flex-1 rounded px-2 text-sm transition",
              value === o.value ? "bg-card font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function ExportPanel({
  options,
  versions,
  latestVersion,
  originalBatch,
  shortages,
  jsonHref,
  fileName,
}: {
  options: ExportOptions;
  versions: number[];
  latestVersion: number;
  originalBatch: number;
  shortages: Shortage[];
  jsonHref: string;
  fileName: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState(String(options.size ?? originalBatch));
  const canShare = useSyncExternalStore(
    () => () => {},
    () => typeof navigator.share === "function",
    () => false,
  );

  const apply = (patch: Partial<ExportOptions>) => {
    const next = { ...options, ...patch };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ lang: next.lang, style: next.style, hide: next.hide }));
    } catch {
      // Private mode: options just aren't remembered.
    }
    const q = exportSearch(next);
    startTransition(() => router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false }));
  };

  // Restore the last-used language, style and sections when opening the screen fresh.
  useEffect(() => {
    if (window.location.search.match(/[?&](lang|style|hide)=/)) return;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<ExportOptions> | null;
      if (saved && (saved.lang !== options.lang || saved.style !== options.style || (saved.hide ?? []).length > 0)) {
        const q = exportSearch({ ...options, ...saved, hide: (saved.hide ?? []).filter((s) => SECTIONS.includes(s)) });
        router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
      }
    } catch {
      // Ignore unreadable saved options.
    }
    // Only on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply the batch size once typing pauses.
  useEffect(() => {
    const n = Number(size);
    const wanted = Number.isFinite(n) && n > 0 && n <= 2000 && n !== originalBatch ? n : null;
    if (wanted === options.size) return;
    const timer = setTimeout(() => apply({ size: wanted }), 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  async function share() {
    try {
      const blob = await (await fetch(jsonHref)).blob();
      const file = new File([blob], fileName, { type: "application/json" });
      const text = t("Recipe file for Brewing Journal — import it under Recipes → Import.");
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: fileName, text });
      else await navigator.share({ title: fileName, text, url: window.location.href });
    } catch {
      // Cancelled or not allowed; nothing to do.
    }
  }

  const toggle = (s: Section, on: boolean) => apply({ hide: on ? options.hide.filter((x) => x !== s) : [...options.hide, s] });

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => window.print()} className="flex-1">
          <Printer className="size-4" /> {t("Save as PDF")}
        </Button>
        <Button type="button" variant="secondary" className="lg:hidden" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <Settings2 className="size-4" /> {t("Options")}
        </Button>
      </div>
      <p className="-mt-1 text-xs text-muted-foreground">{t("Opens the print dialog — choose “Save as PDF” as the printer.")}</p>

      <div className={cn("flex-col gap-4", open ? "flex" : "hidden lg:flex")}>
        {versions.length > 1 && (
          <Field label={t("Version")}>
            <Select value={options.v ?? latestVersion} onChange={(e) => apply({ v: Number(e.target.value) === latestVersion ? null : Number(e.target.value) })}>
              {versions.map((v) => (
                <option key={v} value={v}>
                  v{v}
                  {v === latestVersion ? ` (${t("latest")})` : ""}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label={t("Batch size (L)")} hint={Number(size) !== originalBatch ? t("Amounts are scaled; the recipe itself doesn't change.") : undefined}>
          <div className="flex gap-2">
            <Input type="number" min="0.1" step="0.1" value={size} onChange={(e) => setSize(e.target.value)} />
            {Number(size) !== originalBatch && (
              <Button type="button" variant="ghost" onClick={() => setSize(String(originalBatch))}>
                {t("Reset")}
              </Button>
            )}
          </div>
        </Field>
        <Segmented
          label={t("Sheet language")}
          value={options.lang}
          onChange={(lang) => apply({ lang })}
          options={[
            { value: "both", label: "ไทย + EN" },
            { value: "th", label: "ไทย" },
            { value: "en", label: "EN" },
          ]}
        />
        <Segmented
          label={t("Style")}
          value={options.style}
          onChange={(style) => apply({ style })}
          options={[
            { value: "recipe", label: t("Recipe sheet") },
            { value: "brewday", label: t("Brew-day sheet") },
          ]}
        />
        <Field label={t("Brew date (optional)")} hint={t("Prints real dates on the fermentation plan.")}>
          <Input type="date" value={options.date ?? ""} onChange={(e) => apply({ date: e.target.value || null })} />
        </Field>
        <fieldset className="flex flex-col gap-1.5 text-sm">
          <legend className="mb-1 font-medium">{t("Sections")}</legend>
          {SECTIONS.map((s) => (
            <label key={s} className="flex items-center gap-2">
              <input type="checkbox" checked={!options.hide.includes(s)} onChange={(e) => toggle(s, e.target.checked)} />
              {t(SECTION_LABELS[s])}
            </label>
          ))}
        </fieldset>
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <a href={jsonHref} download={fileName} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted">
          <Download className="size-4" /> {t("Recipe file (.json)")}
        </a>
        {canShare && (
          <Button type="button" variant="secondary" onClick={share}>
            <Share2 className="size-4" /> {t("Share (LINE, …)")}
          </Button>
        )}
        <p className="text-xs text-muted-foreground">{t("The recipe file imports back exactly, here or in another brewer's Brewing Journal.")}</p>
      </div>

      {shortages.length > 0 ? (
        <div className="rounded-md border border-warning-border bg-warning-bg p-3 text-sm">
          <div className="mb-1 flex items-center gap-1.5 font-medium">
            <ShoppingCart className="size-4" aria-hidden /> {t("Short in stock")}
          </div>
          <ul className="tabular-nums">
            {shortages.map((s) => (
              <li key={s.ingredientId}>
                {s.name}: {fmtNum(Math.round(s.short * 100) / 100, s.unit)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p aria-live="polite" className="text-xs text-muted-foreground">
        {pending ? t("Updating preview…") : ""}
      </p>
    </div>
  );
}
