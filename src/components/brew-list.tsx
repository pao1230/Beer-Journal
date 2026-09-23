import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { abv, batchLabel, fmtAbv, fmtDate, fmtSg } from "@/lib/brewing";
import type { BrewStatus } from "@/generated/prisma/enums";

export type BrewListItem = {
  id: number;
  batchNumber: number;
  brewDate: Date;
  status: BrewStatus;
  actualOg: number | null;
  actualFg: number | null;
  recipe: { name: string; style: string | null };
  _count?: { problems: number };
};

export function BrewList({ brews }: { brews: BrewListItem[] }) {
  return (
    <ul className="divide-y divide-border">
      {brews.map((b) => (
        <li key={b.id}>
          <Link href={`/brews/${b.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 hover:bg-muted/50">
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{batchLabel(b.recipe.name, b.batchNumber)}</div>
              <div className="text-xs text-muted-foreground">
                {fmtDate(b.brewDate)}
                {b.recipe.style && ` · ${b.recipe.style}`}
              </div>
            </div>
            <div className="text-sm tabular-nums">
              OG {fmtSg(b.actualOg)} · FG {fmtSg(b.actualFg)}
              {b.actualOg != null && b.actualFg != null && ` · ${fmtAbv(abv(b.actualOg, b.actualFg))}`}
            </div>
            {b._count && b._count.problems > 0 && (
              <span className="text-xs text-muted-foreground">⚠️ {b._count.problems}</span>
            )}
            <StatusBadge status={b.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
