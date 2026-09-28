"use client";

import { useI18n } from "@/lib/i18n/client";

/**
 * Every page is dynamic, so without this boundary links aren't prefetched and a click shows
 * nothing until the server has finished. This skeleton is prefetched and shown on click instead.
 */
export default function Loading() {
  const { t } = useI18n();
  return (
    <div role="status" aria-busy="true" className="animate-pulse">
      <span className="sr-only">{t("Loading…")}</span>
      <div className="mb-5 h-8 w-48 rounded-md bg-muted" />
      <div className="mb-3 h-9 w-full max-w-xs rounded-md bg-muted" />
      <div className="rounded-lg border border-border bg-card p-4">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="mb-3 h-5 rounded bg-muted last:mb-0" style={{ width: `${90 - (i % 3) * 15}%` }} />
        ))}
      </div>
    </div>
  );
}
