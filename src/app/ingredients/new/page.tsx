import { Card, PageHeader } from "@/components/ui";
import { INGREDIENT_TYPES } from "@/lib/brewing";
import { createIngredient } from "../actions";
import { IngredientForm } from "../ingredient-form";
import type { IngredientType } from "@/generated/prisma/enums";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("New ingredient") };
}

export default async function NewIngredientPage(props: PageProps<"/ingredients/new">) {
  const { t } = await getI18n();
  const { type } = await props.searchParams;
  const defaultType = INGREDIENT_TYPES.find((x) => x.value === type)?.value as IngredientType | undefined;
  return (
    <>
      <PageHeader title={t("New ingredient")} />
      <Card>
        <IngredientForm action={createIngredient} defaultType={defaultType} />
      </Card>
    </>
  );
}
