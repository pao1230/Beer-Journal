import Link from "next/link";
import { INGREDIENT_TYPES } from "@/lib/brewing";
import { filterHref, toggleType } from "@/lib/list-filter";
import { getI18n } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";
import type { IngredientType } from "@/generated/prisma/enums";

const chip = "rounded-full px-4 py-2 text-sm whitespace-nowrap transition";
const on = "bg-foreground text-background";
const off = "bg-muted hover:bg-border";

/** Tap to add or remove a type; "All" clears the selection. Other filters are kept. */
export async function TypeChips({
  path,
  params,
  selected,
}: {
  path: string;
  params: Record<string, string | undefined>;
  selected: IngredientType[];
}) {
  const { t } = await getI18n();
  return (
    <nav aria-label={t("Filter by type")} className="mb-4 flex flex-wrap gap-2">
      <Link
        href={filterHref(path, params, [])}
        scroll={false}
        aria-current={selected.length === 0 ? "true" : undefined}
        className={cn(chip, selected.length === 0 ? on : off)}
      >
        {t("All")}
      </Link>
      {INGREDIENT_TYPES.map((x) => {
        const active = selected.includes(x.value);
        return (
          <Link
            key={x.value}
            href={filterHref(path, params, toggleType(selected, x.value))}
            scroll={false}
            aria-current={active ? "true" : undefined}
            className={cn(chip, active ? on : off)}
          >
            {t(x.label)}
          </Link>
        );
      })}
    </nav>
  );
}
