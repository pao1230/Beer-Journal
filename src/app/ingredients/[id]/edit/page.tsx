import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Button, Card, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { StockCard } from "@/app/inventory/stock-card";
import { deleteIngredient, setArchived, updateIngredient } from "../../actions";
import { IngredientForm } from "../../ingredient-form";

export const metadata = { title: "Edit ingredient" };

export default async function EditIngredientPage(props: PageProps<"/ingredients/[id]/edit">) {
  const id = Number((await props.params).id);
  const ingredient = Number.isInteger(id) ? await db.ingredient.findUnique({ where: { id } }) : null;
  if (!ingredient) notFound();
  const usedIn = await db.recipeIngredient.count({ where: { ingredientId: id } });

  return (
    <>
      <PageHeader
        title={`Edit ${ingredient.name}`}
        subtitle={
          usedIn > 0
            ? `Used in ${usedIn} recipe line(s). Existing recipes keep the name/specs they were saved with.`
            : "Not used in any recipe yet."
        }
      />
      <Card>
        <IngredientForm action={updateIngredient.bind(null, id)} ingredient={ingredient} />
      </Card>
      <StockCard ingredientId={id} />
      <Card className="mt-4 flex flex-wrap items-center gap-3">
        <form action={setArchived.bind(null, id, !ingredient.isArchived)}>
          <Button variant="secondary">{ingredient.isArchived ? "Unarchive" : "Archive"}</Button>
        </form>
        <ActionForm action={deleteIngredient.bind(null, id)} confirm="Delete this ingredient permanently?">
          <Button variant="danger">Delete</Button>
        </ActionForm>
        <p className="w-full text-xs text-muted-foreground">
          Archived ingredients are hidden from recipe pickers but stay attached to old recipes.
        </p>
      </Card>
    </>
  );
}
