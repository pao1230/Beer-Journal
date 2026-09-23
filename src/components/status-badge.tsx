import { Badge } from "@/components/ui";
import { labelOf, STATUSES } from "@/lib/brewing";
import { cn } from "@/lib/utils";
import type { BrewStatus } from "@/generated/prisma/enums";

const colors: Record<BrewStatus, string> = {
  PLANNING: "bg-muted",
  BREWING: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200",
  FERMENTING: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  CONDITIONING: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  COMPLETED: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  CANCELLED: "bg-muted text-muted-foreground line-through",
};

export function StatusBadge({ status }: { status: BrewStatus }) {
  return <Badge className={cn(colors[status])}>{labelOf(STATUSES, status)}</Badge>;
}
