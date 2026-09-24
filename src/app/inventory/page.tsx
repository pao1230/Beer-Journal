import Link from "next/link";
import { Badge, ButtonLink, Card, Empty, Input, PageHeader } from "@/components/ui";
import { FavoriteButton } from "@/components/favorite-button";
import { TypeChips } from "@/components/type-chips";
import { db } from "@/lib/db";
import { fmtNum, INGREDIENT_TYPES, labelOf } from "@/lib/brewing";
import { fmtMoney } from "@/lib/inventory";
import { loadStock } from "@/lib/inventory-data";
import { getI18n } from "@/lib/i18n/server";
import { filterHref, parseTypes } from "@/lib/list-filter";
import { setFavorite } from "@/app/ingredients/actions";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Inventory") };
}

export default async function InventoryPage(props: PageProps<"/inventory">) {
  const { t } = await getI18n();
  const sp = await props.searchParams;
  const search = typeof sp.q === "string" ? sp.q.trim() : "";
  const q = search.toLowerCase();
  const types = parseTypes(sp.type);
  const showOut = sp.out === "1";

  const [ingredients, stock] = await Promise.all([
    db.ingredient.findMany({
      where: { stockUnit: { not: null } },
      orderBy: [{ isFavorite: "desc" }, { type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true, brand: true, supplier: true, isArchived: true, isFavorite: true },
    }),
    loadStock(),
  ]);
  const tracked = ingredients
    .map((i) => ({ ...i, stock: stock.get(i.id)! }))
    .filter((r) => !r.isArchived || r.stock.onHand !== 0);
  const totalValue = tracked.reduce(
    (sum, r) => sum + (r.stock.avgCost == null ? 0 : Math.max(0, r.stock.onHand) * r.stock.avgCost),
    0,
  );
  const matching = tracked.filter(
    (r) =>
      (types.length === 0 || types.includes(r.type)) &&
      (!q || [r.name, r.brand, r.supplier].some((f) => f?.toLowerCase().includes(q))),
  );
  // Out-of-stock items stay hidden unless asked for; favorites always show so they can be restocked.
  const rows = matching.filter((r) => showOut || r.isFavorite || r.stock.onHand > 0);
  const hiddenOut = matching.length - rows.length;
  const params = { q: search || undefined, out: showOut ? "1" : undefined };

  return (
    <>
      <PageHeader
        title={t("Inventory")}
        subtitle={t("Stock on hand, valued at average purchase cost: {v}", { v: fmtMoney(totalValue) })}
        actions={<ButtonLink href="/ingredients" variant="secondary">{t("Ingredients")}</ButtonLink>}
      />
      <form className="mb-3 flex flex-wrap gap-2">
        <Input name="q" defaultValue={search} placeholder={t("Search name, brand, supplier")} className="max-w-xs" />
        {types.map((x) => (
          <input key={x} type="hidden" name="type" value={x} />
        ))}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="out" value="1" defaultChecked={showOut} /> {t("Show out of stock")}
        </label>
        <button className="rounded-md border border-border px-3 text-sm hover:bg-muted">{t("Filter")}</button>
      </form>
      <TypeChips path="/inventory" params={params} selected={types} />
      <Card>
        {tracked.length === 0 ? (
          <Empty>{t("No ingredients are tracked yet. Set an inventory unit on an ingredient, then add a purchase.")}</Empty>
        ) : rows.length === 0 ? (
          <Empty>{t("Nothing in stock matches.")}</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[22rem] sm:min-w-[28rem] text-sm tabular-nums">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="w-9 py-1">
                    <span className="sr-only">{t("Favorite")}</span>
                  </th>
                  <th className="py-1 pr-3 font-medium">{t("Ingredient")}</th>
                  <th className="hidden py-1 pr-3 font-medium sm:table-cell">{t("Type")}</th>
                  <th className="py-1 pr-3 text-right font-medium">{t("In stock")}</th>
                  <th className="py-1 pr-3 text-right font-medium">{t("Avg cost")}</th>
                  <th className="py-1 text-right font-medium">{t("Value")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="py-1">
                      <FavoriteButton isFavorite={r.isFavorite} action={setFavorite.bind(null, r.id)} name={r.name} />
                    </td>
                    <td className="py-2 pr-3">
                      <Link href={`/ingredients/${r.id}/edit`} className="font-medium underline">
                        {r.name}
                      </Link>
                      {r.brand && <span className="ml-2 text-xs text-muted-foreground">{r.brand}</span>}
                    </td>
                    <td className="hidden py-2 pr-3 text-muted-foreground sm:table-cell">{t(labelOf(INGREDIENT_TYPES, r.type))}</td>
                    <td className="py-2 pr-3 text-right">
                      {r.stock.onHand <= 0 && <Badge className="mr-2 bg-warning-bg">⚠️ {t("Out")}</Badge>}
                      {fmtNum(Number(r.stock.onHand.toFixed(3)), r.stock.stockUnit!)}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {r.stock.avgCost == null ? "–" : `${fmtMoney(r.stock.avgCost)}/${r.stock.stockUnit}`}
                    </td>
                    <td className="py-2 text-right">
                      {r.stock.avgCost == null ? "–" : fmtMoney(Math.max(0, r.stock.onHand) * r.stock.avgCost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {hiddenOut > 0 && (
          <p className="mt-3 text-sm text-muted-foreground">
            {t("{n} out-of-stock item(s) hidden.", { n: hiddenOut })}{" "}
            <Link className="underline" href={filterHref("/inventory", { ...params, out: "1" }, types)} scroll={false}>
              {t("Show them")}
            </Link>
          </p>
        )}
      </Card>
    </>
  );
}
