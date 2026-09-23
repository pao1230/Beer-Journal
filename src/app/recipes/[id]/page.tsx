import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { IngredientTable } from "@/components/ingredient-table";
import { StatusBadge } from "@/components/status-badge";
import { Badge, Button, ButtonLink, Card, CardTitle, Empty, PageHeader, Stat } from "@/components/ui";
import { db } from "@/lib/db";
import { abv, batchLabel, fmtAbv, fmtDate, fmtNum, fmtSg, preBoilVolume } from "@/lib/brewing";
import { startBrew } from "@/app/brews/actions";
import { deleteRecipe } from "../actions";

export async function generateMetadata(props: PageProps<"/recipes/[id]">) {
  const id = Number((await props.params).id);
  const recipe = Number.isInteger(id) ? await db.recipe.findUnique({ where: { id }, select: { name: true } }) : null;
  return { title: recipe?.name ?? "Recipe" };
}

export default async function RecipePage(props: PageProps<"/recipes/[id]">) {
  const id = Number((await props.params).id);
  const { v } = await props.searchParams;
  const recipe = Number.isInteger(id)
    ? await db.recipe.findUnique({
        where: { id },
        include: {
          versions: {
            orderBy: { version: "desc" },
            include: { _count: { select: { sessions: true } } },
          },
          sessions: { orderBy: { batchNumber: "desc" }, include: { recipeVersion: { select: { version: true } } } },
        },
      })
    : null;
  if (!recipe || recipe.versions.length === 0) notFound();

  const latest = recipe.versions[0];
  const selectedMeta = recipe.versions.find((x) => String(x.version) === v) ?? latest;
  const version = await db.recipeVersion.findUniqueOrThrow({
    where: { id: selectedMeta.id },
    include: {
      equipmentProfile: true,
      ingredients: { orderBy: { sortOrder: "asc" } },
      mashSteps: { orderBy: { stepOrder: "asc" } },
    },
  });
  const isLatest = version.id === latest.id;
  const preBoil = preBoilVolume(version.batchSize, version.boilTime, version.equipmentProfile);

  return (
    <>
      <PageHeader
        title={recipe.name}
        subtitle={
          <>
            {recipe.style && <span>{recipe.style} · </span>}v{version.version}
            {!isLatest && <Badge className="ml-2">Older version — latest is v{latest.version}</Badge>}
          </>
        }
        actions={
          <>
            <ActionForm action={startBrew.bind(null, version.id)}>
              <Button>{isLatest ? "🍺 Brew Again" : `Brew v${version.version}`}</Button>
            </ActionForm>
            <ButtonLink href={`/recipes/${recipe.id}/edit`} variant="secondary">
              Edit
            </ButtonLink>
            <ButtonLink href={`/recipes/${recipe.id}/scale${isLatest ? "" : `?v=${version.version}`}`} variant="secondary">
              Scale
            </ButtonLink>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 md:col-span-2">
          <Card>
            <CardTitle>Targets</CardTitle>
            <div className="grid grid-cols-3 gap-4 sm:grid-cols-4">
              <Stat label="Batch" value={fmtNum(version.batchSize, "L")} />
              <Stat label="Boil" value={fmtNum(version.boilTime, "min")} />
              <Stat label="OG" value={fmtSg(version.targetOg)} />
              <Stat label="FG" value={fmtSg(version.targetFg)} />
              <Stat label="ABV" value={fmtAbv(abv(version.targetOg, version.targetFg))} />
              <Stat label="IBU" value={fmtNum(version.targetIbu)} />
              <Stat label="SRM" value={fmtNum(version.targetSrm)} />
              <Stat label="CO2" value={fmtNum(version.targetCarbonation, "vol")} />
            </div>
          </Card>

          <Card>
            <CardTitle>Ingredients</CardTitle>
            <IngredientTable
              rows={version.ingredients.map((i) => ({
                id: i.id,
                name: i.nameSnapshot,
                detail: [
                  i.brandSnapshot,
                  i.alphaAcidSnapshot != null && `${i.alphaAcidSnapshot}% AA`,
                  i.colorSnapshot != null && `${i.colorSnapshot}°L`,
                ]
                  .filter(Boolean)
                  .join(" · "),
                stage: i.stage,
                additionTime: i.additionTime,
                amount: fmtNum(i.amount, i.unit),
              }))}
            />
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardTitle>Mash</CardTitle>
              {version.mashSteps.length === 0 ? (
                <p className="text-sm text-muted-foreground">No mash steps.</p>
              ) : (
                <ol className="flex flex-col gap-1 text-sm">
                  {version.mashSteps.map((m, idx) => (
                    <li key={m.id} className="flex justify-between gap-2">
                      <span>
                        {idx + 1}. {m.name}
                      </span>
                      <span className="tabular-nums">
                        {m.temperature}°C · {m.timeMin} min
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
            <Card>
              <CardTitle>Water & volumes</CardTitle>
              <dl className="grid grid-cols-2 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Source</dt>
                <dd>{version.waterSource ?? "–"}</dd>
                <dt className="text-muted-foreground">Mash water</dt>
                <dd>{fmtNum(version.mashWaterL, "L")}</dd>
                <dt className="text-muted-foreground">Sparge water</dt>
                <dd>{fmtNum(version.spargeWaterL, "L")}</dd>
                <dt className="text-muted-foreground">Target mash pH</dt>
                <dd>{fmtNum(version.targetMashPh)}</dd>
                <dt className="text-muted-foreground">Est. pre-boil</dt>
                <dd>{preBoil == null ? "–" : `${preBoil.toFixed(1)} L`}</dd>
                <dt className="text-muted-foreground">Equipment</dt>
                <dd>{version.equipmentProfile?.name ?? "–"}</dd>
              </dl>
            </Card>
          </div>

          {(recipe.notes || version.notes) && (
            <Card>
              <CardTitle>Notes</CardTitle>
              {recipe.notes && <p className="text-sm whitespace-pre-wrap">{recipe.notes}</p>}
              {version.notes && (
                <p className="mt-2 text-sm text-muted-foreground">
                  v{version.version}: {version.notes}
                </p>
              )}
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardTitle
              action={
                recipe.sessions.length >= 2 && (
                  <Link className="text-sm underline" href={`/compare?recipe=${recipe.id}`}>
                    Compare
                  </Link>
                )
              }
            >
              Brews
            </CardTitle>
            {recipe.sessions.length === 0 ? (
              <Empty>Not brewed yet.</Empty>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {recipe.sessions.map((s) => (
                  <li key={s.id}>
                    <Link href={`/brews/${s.id}`} className="flex flex-col gap-0.5 py-2 hover:bg-muted/50">
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-medium">{batchLabel(recipe.name, s.batchNumber)}</span>
                        <StatusBadge status={s.status} />
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {fmtDate(s.brewDate)} · v{s.recipeVersion.version} · OG {fmtSg(s.actualOg)} · FG {fmtSg(s.actualFg)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardTitle>Versions</CardTitle>
            <ul className="flex flex-col gap-1 text-sm">
              {recipe.versions.map((rv) => (
                <li key={rv.id}>
                  <Link
                    href={`/recipes/${recipe.id}?v=${rv.version}`}
                    className={`block rounded px-2 py-1 hover:bg-muted ${rv.id === version.id ? "bg-muted font-semibold" : ""}`}
                  >
                    v{rv.version} · {fmtDate(rv.createdAt)} · {rv._count.sessions} brew(s)
                    {rv.notes && <span className="block text-xs font-normal text-muted-foreground">{rv.notes}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          {recipe.sessions.length === 0 && (
            <ActionForm action={deleteRecipe.bind(null, recipe.id)} confirm={`Delete ${recipe.name} and all its versions?`}>
              <Button variant="danger" className="w-full">
                Delete recipe
              </Button>
            </ActionForm>
          )}
        </div>
      </div>
    </>
  );
}
