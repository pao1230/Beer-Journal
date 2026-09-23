import Link from "next/link";
import { ButtonLink, Card, Empty, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { abv, fmtAbv, fmtSg } from "@/lib/brewing";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Recipes") };
}

export default async function RecipesPage() {
  const { t } = await getI18n();
  const recipes = await db.recipe.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      versions: { orderBy: { version: "desc" }, take: 1 },
      _count: { select: { sessions: true } },
    },
  });
  return (
    <>
      <PageHeader title={t("Recipes")} actions={<ButtonLink href="/recipes/new">{t("+ New recipe")}</ButtonLink>} />
      {recipes.length === 0 ? (
        <Card>
          <Empty>{t("No recipes yet. Add a few ingredients first, then create your first recipe.")}</Empty>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {recipes.map((r) => {
            const v = r.versions[0];
            return (
              <Link key={r.id} href={`/recipes/${r.id}`}>
                <Card className="h-full hover:bg-muted/50">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">{r.name}</span>
                    <span className="text-xs text-muted-foreground">v{v?.version}</span>
                  </div>
                  {r.style && <div className="text-sm text-muted-foreground">{r.style}</div>}
                  {v && (
                    <div className="mt-2 text-sm tabular-nums">
                      {v.batchSize} L · OG {fmtSg(v.targetOg)} · FG {fmtSg(v.targetFg)} · {fmtAbv(abv(v.targetOg, v.targetFg))}
                    </div>
                  )}
                  <div className="mt-1 text-xs text-muted-foreground">{t("{n} brew(s)", { n: r._count.sessions })}</div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
