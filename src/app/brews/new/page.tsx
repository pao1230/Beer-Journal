import { ActionForm } from "@/components/action-form";
import { Button, ButtonLink, Card, Empty, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { abv, fmtAbv, fmtSg } from "@/lib/brewing";
import { startBrew } from "../actions";

export const metadata = { title: "New brew" };

export default async function NewBrewPage() {
  const recipes = await db.recipe.findMany({
    orderBy: { updatedAt: "desc" },
    include: { versions: { orderBy: { version: "desc" }, take: 1 }, _count: { select: { sessions: true } } },
  });
  return (
    <>
      <PageHeader title="Start a new brew" subtitle="Pick a recipe. The plan is copied into a new brew session; actuals start empty." />
      {recipes.length === 0 ? (
        <Card>
          <Empty>No recipes yet.</Empty>
          <div className="text-center">
            <ButtonLink href="/recipes/new">Create a recipe</ButtonLink>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {recipes.map((r) => {
            const v = r.versions[0];
            if (!v) return null;
            return (
              <Card key={r.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold">
                    {r.name} <span className="text-xs font-normal text-muted-foreground">v{v.version}</span>
                  </div>
                  <div className="text-sm text-muted-foreground tabular-nums">
                    {v.batchSize} L · OG {fmtSg(v.targetOg)} · {fmtAbv(abv(v.targetOg, v.targetFg))} · brewed {r._count.sessions}×
                  </div>
                </div>
                <ActionForm action={startBrew.bind(null, v.id)}>
                  <Button>Brew</Button>
                </ActionForm>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
