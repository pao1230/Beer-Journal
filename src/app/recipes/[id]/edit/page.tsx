import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { updateRecipe } from "../../actions";
import { editorOptions } from "../../editor-data";
import { RecipeEditor } from "../../recipe-editor";

export const metadata = { title: "Edit recipe" };

export default async function EditRecipePage(props: PageProps<"/recipes/[id]/edit">) {
  const id = Number((await props.params).id);
  const recipe = Number.isInteger(id)
    ? await db.recipe.findUnique({
        where: { id },
        include: {
          versions: {
            orderBy: { version: "desc" },
            take: 1,
            include: {
              ingredients: { orderBy: { sortOrder: "asc" } },
              mashSteps: { orderBy: { stepOrder: "asc" } },
              _count: { select: { sessions: true } },
            },
          },
        },
      })
    : null;
  const latest = recipe?.versions[0];
  if (!recipe || !latest) notFound();

  const { ingredients, equipment } = await editorOptions(latest.ingredients.map((i) => i.ingredientId));
  const s = (n: number | null) => (n == null ? "" : String(n));

  return (
    <>
      <PageHeader title={`Edit ${recipe.name}`} subtitle={`Currently v${latest.version}`} />
      <RecipeEditor
        action={updateRecipe.bind(null, id)}
        ingredients={ingredients}
        equipment={equipment}
        cancelHref={`/recipes/${id}`}
        versionInfo={{ current: latest.version, brewed: latest._count.sessions > 0 }}
        initial={{
          name: recipe.name,
          style: recipe.style ?? "",
          notes: recipe.notes ?? "",
          equipmentProfileId: latest.equipmentProfileId,
          batchSize: latest.batchSize,
          boilTime: latest.boilTime,
          targetOg: latest.targetOg,
          targetFg: latest.targetFg,
          targetIbu: latest.targetIbu,
          targetSrm: latest.targetSrm,
          targetCarbonation: latest.targetCarbonation,
          waterSource: latest.waterSource ?? "",
          mashWaterL: latest.mashWaterL,
          spargeWaterL: latest.spargeWaterL,
          targetMashPh: latest.targetMashPh,
          ingredients: latest.ingredients.map((i) => ({
            key: `i${i.id}`,
            ingredientId: i.ingredientId,
            amount: String(i.amount),
            unit: i.unit,
            stage: i.stage,
            additionTime: s(i.additionTime),
            notes: i.notes ?? "",
          })),
          mashSteps: latest.mashSteps.map((m) => ({
            key: `m${m.id}`,
            name: m.name,
            temperature: String(m.temperature),
            timeMin: String(m.timeMin),
          })),
        }}
      />
    </>
  );
}
