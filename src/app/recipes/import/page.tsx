import { PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { editorOptions } from "../editor-data";
import { ImportFlow } from "./import-flow";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Import recipe") };
}

export default async function ImportRecipePage() {
  const { t } = await getI18n();
  const [{ ingredients, equipment, stock }, recipes] = await Promise.all([
    editorOptions(),
    db.recipe.findMany({
      select: { id: true, name: true, versions: { orderBy: { version: "desc" }, take: 1, select: { version: true } } },
    }),
  ]);
  return (
    <>
      <PageHeader title={t("Import recipe")} subtitle={t("From a PDF recipe sheet, a recipe file, or pasted text.")} />
      <ImportFlow
        ingredients={ingredients}
        equipment={equipment}
        stock={stock}
        recipes={recipes.map((r) => ({ id: r.id, name: r.name, version: r.versions[0]?.version ?? 0 }))}
      />
    </>
  );
}
