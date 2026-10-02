import Link from "next/link";
import { labelOf, STATUSES } from "@/lib/brewing";
import { getI18n } from "@/lib/i18n/server";
import type { ActiveUse } from "@/lib/active-brews";

/**
 * "🍺 Citra IPA #002 · Fermenting" links for the unfinished brews that use an ingredient.
 * `compact` shows just "🍺 #002" (full name on hover/long-press), for narrow table cells.
 */
export async function ActiveBrewBadges({ uses, compact = false }: { uses: ActiveUse[] | undefined; compact?: boolean }) {
  const { t } = await getI18n();
  if (!uses?.length) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {uses.map((u) => (
        <Link
          key={u.sessionId}
          href={`/brews/${u.sessionId}`}
          title={`${u.label} · ${t(labelOf(STATUSES, u.status))}`}
          className="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-foreground hover:bg-primary/25"
        >
          🍺 {compact ? u.batch : `${u.label} · ${t(labelOf(STATUSES, u.status))}`}
        </Link>
      ))}
    </span>
  );
}
