import Link from "next/link";
import { Badge, ButtonLink, Card, Empty, Input, PageHeader, Select } from "@/components/ui";
import { db } from "@/lib/db";
import { INGREDIENT_TYPES, labelOf } from "@/lib/brewing";
import type { Prisma } from "@/generated/prisma/client";
import type { IngredientType } from "@/generated/prisma/enums";

export const metadata = { title: "Ingredients" };

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
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const type = INGREDIENT_TYPES.find((t) => t.value === sp.type)?.value as IngredientType | undefined;
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

  return (
    <>
      <PageHeader
        title="Ingredients"
        actions={<ButtonLink href={`/ingredients/new${type ? `?type=${type}` : ""}`}>+ New ingredient</ButtonLink>}
      />
      <form className="mb-4 flex flex-wrap gap-2">
        <Input name="q" defaultValue={q} placeholder="Search name, brand, supplier" className="max-w-xs" />
        <Select name="type" defaultValue={type ?? ""} className="w-auto">
          <option value="">All types</option>
          {INGREDIENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="archived" value="1" defaultChecked={showArchived} /> Show archived
        </label>
        <button className="rounded-md border border-border px-3 text-sm hover:bg-muted">Filter</button>
      </form>

      {INGREDIENT_TYPES.filter((t) => !type || t.value === type).map((t) => {
        const rows = ingredients.filter((i) => i.type === t.value);
        if (rows.length === 0 && (type || q)) return null;
        return (
          <Card key={t.value} className="mb-4">
            <h2 className="mb-2 font-semibold">{labelOf(INGREDIENT_TYPES, t.value)}</h2>
            {rows.length === 0 ? (
              <Empty>
                None yet. <Link className="underline" href={`/ingredients/new?type=${t.value}`}>Add one</Link>
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
                      {i.isArchived && <Badge>Archived</Badge>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })}
      {ingredients.length === 0 && (type || q) && <Empty>No ingredients match.</Empty>}
    </>
  );
}
