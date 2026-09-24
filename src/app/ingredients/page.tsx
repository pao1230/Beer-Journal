import Link from "next/link";
import { Badge, Button, ButtonLink, Card, Empty, Input, PageHeader, Select } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { db } from "@/lib/db";
import { INGREDIENT_TYPES, labelOf } from "@/lib/brewing";
import type { Prisma } from "@/generated/prisma/client";
import type { IngredientType } from "@/generated/prisma/enums";
import { getI18n } from "@/lib/i18n/server";
import { CATALOG_SUPPLIER, missingFromCatalog } from "@/lib/catalog";
import { importStarterCatalog } from "./actions";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Ingredients") };
}

function specs(i: {
  color: number | null;
  potential: number | null;
  alphaAcid: number | null;
  attenuation: number | null;
  form: string | null;
}) {
  return [
    i.color != null && `${i.color}°L`,
    i.potential != null && `${i.potential.toFixed(3)} SG`,
    i.alphaAcid != null && `${i.alphaAcid}% AA`,
    i.attenuation != null && `${i.attenuation}% att.`,
    i.form,
  ]
    .filter(Boolean)
    .join(" · ");
}

export default async function IngredientsPage(props: PageProps<"/ingredients">) {
  const { t } = await getI18n();
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const type = INGREDIENT_TYPES.find((x) => x.value === sp.type)?.value as IngredientType | undefined;
  const showArchived = sp.archived === "1";

  const where: Prisma.IngredientWhereInput = {
    ...(type && { type }),
    ...(!showArchived && { isArchived: false }),
    ...(q && {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { brand: { contains: q, mode: "insensitive" } },
        { supplier: { contains: q, mode: "insensitive" } },
      ],
    }),
  };
  const ingredients = await db.ingredient.findMany({ where, orderBy: [{ type: "asc" }, { name: "asc" }] });
  const missing = missingFromCatalog(
    await db.ingredient.findMany({ select: { name: true, type: true, waterSalt: true } }),
  ).length;
  const imported = typeof sp.imported === "string" ? Number(sp.imported) : null;

  return (
    <>
      <PageHeader
        title={t("Ingredients")}
        actions={
          <>
            <ButtonLink href="/inventory" variant="secondary">
              {t("Inventory")}
            </ButtonLink>
            <ButtonLink href={`/ingredients/new${type ? `?type=${type}` : ""}`}>{t("+ New ingredient")}</ButtonLink>
          </>
        }
      />
      {imported != null && (
        <p role="status" className="mb-4 rounded-md border border-border bg-muted px-3 py-2 text-sm">
          {t("Added {n} ingredient(s) from {supplier}.", { n: imported, supplier: CATALOG_SUPPLIER })}
        </p>
      )}
      {missing > 0 && (
        <Card className="mb-4 flex flex-wrap items-center gap-3">
          <p className="min-w-0 flex-1 text-sm">
            <span className="font-medium">{t("Starter ingredients")}</span>
            <span className="block text-muted-foreground">
              {t("{n} malts, hops, yeasts and water salts from {supplier} aren't in your list yet.", {
                n: missing,
                supplier: CATALOG_SUPPLIER,
              })}
            </span>
          </p>
          <ActionForm action={importStarterCatalog}>
            <Button variant="secondary">{t("Add them")}</Button>
          </ActionForm>
        </Card>
      )}
      <form className="mb-4 flex flex-wrap gap-2">
        <Input name="q" defaultValue={q} placeholder={t("Search name, brand, supplier")} className="max-w-xs" />
        <Select name="type" defaultValue={type ?? ""} className="w-auto">
          <option value="">{t("All types")}</option>
          {INGREDIENT_TYPES.map((x) => (
            <option key={x.value} value={x.value}>
              {t(x.label)}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="archived" value="1" defaultChecked={showArchived} /> {t("Show archived")}
        </label>
        <button className="rounded-md border border-border px-3 text-sm hover:bg-muted">{t("Filter")}</button>
      </form>

      {INGREDIENT_TYPES.filter((x) => !type || x.value === type).map((x) => {
        const rows = ingredients.filter((i) => i.type === x.value);
        if (rows.length === 0 && (type || q)) return null;
        return (
          <Card key={x.value} className="mb-4">
            <h2 className="mb-2 font-semibold">{t(labelOf(INGREDIENT_TYPES, x.value))}</h2>
            {rows.length === 0 ? (
              <Empty>
                {t("None yet.")}{" "}
                <Link className="underline" href={`/ingredients/new?type=${x.value}`}>
                  {t("Add one")}
                </Link>
              </Empty>
            ) : (
              <ul className="divide-y divide-border">
                {rows.map((i) => (
                  <li key={i.id}>
                    <Link
                      href={`/ingredients/${i.id}/edit`}
                      className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 hover:bg-muted/50"
                    >
                      <span className="font-medium">{i.name}</span>
                      {i.brand && <span className="text-sm text-muted-foreground">{i.brand}</span>}
                      <span className="text-xs text-muted-foreground">{specs(i)}</span>
                      {i.isArchived && <Badge>{t("Archived")}</Badge>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })}
      {ingredients.length === 0 && (type || q) && <Empty>{t("No ingredients match.")}</Empty>}
    </>
  );
}
