"use client";

import { useOptimistic } from "react";
import { Star } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/** Star toggle; flips at once and lets the server action catch up. */
export function FavoriteButton({
  isFavorite,
  action,
  name,
}: {
  isFavorite: boolean;
  action: (isFavorite: boolean) => Promise<void>;
  name: string;
}) {
  const { t } = useI18n();
  const [fav, setFav] = useOptimistic(isFavorite);
  return (
    <form
      action={async () => {
        setFav(!fav);
        await action(!fav);
      }}
    >
      <button
        type="submit"
        aria-pressed={fav}
        aria-label={t(fav ? "Remove {name} from favorites" : "Add {name} to favorites", { name })}
        title={t(fav ? "Remove from favorites" : "Add to favorites")}
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-md hover:bg-muted",
          fav ? "text-primary" : "text-muted-foreground/60",
        )}
      >
        <Star className="size-5" fill={fav ? "currentColor" : "none"} />
      </button>
    </form>
  );
}
