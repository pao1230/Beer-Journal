import { Card, PageHeader } from "@/components/ui";
import { INGREDIENT_TYPES } from "@/lib/brewing";
import { createIngredient } from "../actions";
import { IngredientForm } from "../ingredient-form";
import type { IngredientType } from "@/generated/prisma/enums";

export const metadata = { title: "New ingredient" };

export default async function NewIngredientPage(props: PageProps<"/ingredients/new">) {
  const { type } = await props.searchParams;
  const defaultType = INGREDIENT_TYPES.find((t) => t.value === type)?.value as IngredientType | undefined;
  return (
    <>
      <PageHeader title="New ingredient" />
      <Card>
        <IngredientForm action={createIngredient} defaultType={defaultType} />
      </Card>
    </>
  );
}
