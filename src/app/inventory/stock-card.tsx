import Link from "next/link";
import { X } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Button, Card, CardTitle, Field, Input, Stat } from "@/components/ui";
import { db } from "@/lib/db";
import { batchLabel, fmtNum } from "@/lib/brewing";
import { fmtMoney } from "@/lib/inventory";
import { loadStock } from "@/lib/inventory-data";
import { addPurchase, countStock, deleteTransaction } from "./actions";
import { getI18n } from "@/lib/i18n/server";

const REASON_LABEL = { PURCHASE: "Purchase", ADJUSTMENT: "Stock count", BREW: "Used in brew" } as const;

export async function StockCard({ ingredientId }: { ingredientId: number }) {
  const { t, date } = await getI18n();
  const [stock, history] = await Promise.all([
    loadStock([ingredientId]).then((m) => m.get(ingredientId)),
    db.inventoryTransaction.findMany({
      where: { ingredientId },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { brewSession: { select: { id: true, batchNumber: true, recipe: { select: { name: true } } } } },
    }),
  ]);
  const unit = stock?.stockUnit;
  if (!unit) {
    return (
      <Card className="mt-4">
        <CardTitle>{t("Inventory")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("Choose an inventory unit above to track stock and cost.")}</p>
      </Card>
    );
  }
  return (
    <Card className="mt-4">
      <CardTitle>{t("Inventory")}</CardTitle>
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label={t("In stock")} value={<span className={stock.onHand <= 0 ? "text-danger" : ""}>{fmtNum(Number(stock.onHand.toFixed(3)), unit)}</span>} />
        <Stat label={t("Avg cost / {unit}", { unit })} value={fmtMoney(stock.avgCost)} />
        <Stat label={t("Stock value")} value={fmtMoney(stock.avgCost == null ? null : Math.max(0, stock.onHand) * stock.avgCost)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ActionForm action={addPurchase.bind(null, ingredientId)} resetOnSuccess className="grid grid-cols-2 gap-2 rounded-md border border-border p-3">
          <h3 className="col-span-2 text-sm font-semibold">{t("Add purchase")}</h3>
          <Field label={t("Amount ({unit})", { unit })}>
            <Input name="amount" type="number" step="any" min="0" required />
          </Field>
          <Field label={t("Total price")}>
            <Input name="totalCost" type="number" step="0.01" min="0" />
          </Field>
          <Field label={t("Note")} className="col-span-2">
            <Input name="note" placeholder="Brew Shop A" />
          </Field>
          <div className="col-span-2">
            <Button type="submit" variant="secondary">{t("Add purchase")}</Button>
          </div>
        </ActionForm>
        <ActionForm action={countStock.bind(null, ingredientId)} resetOnSuccess className="grid content-start gap-2 rounded-md border border-border p-3">
          <h3 className="text-sm font-semibold">{t("Stock count")}</h3>
          <Field label={t("Counted amount ({unit})", { unit })} hint={t("Records the difference as an adjustment")}>
            <Input name="counted" type="number" step="any" min="0" required />
          </Field>
          <div>
            <Button type="submit" variant="secondary">{t("Save count")}</Button>
          </div>
        </ActionForm>
      </div>

      {history.length > 0 && (
        <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-1 pr-2 font-medium">{t("Date")}</th>
              <th className="py-1 pr-2 font-medium">{t("What")}</th>
              <th className="py-1 pr-2 text-right font-medium">{t("Amount")}</th>
              <th className="py-1 pr-2 text-right font-medium">{t("Price")}</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {history.map((tx) => (
              <tr key={tx.id}>
                <td className="py-1.5 pr-2 whitespace-nowrap">{date(tx.createdAt)}</td>
                <td className="py-1.5 pr-2">
                  {tx.brewSession ? (
                    <Link className="underline" href={`/brews/${tx.brewSession.id}`}>
                      {batchLabel(tx.brewSession.recipe.name, tx.brewSession.batchNumber)}
                    </Link>
                  ) : (
                    t(REASON_LABEL[tx.reason])
                  )}
                  {tx.note && <span className="ml-1 text-xs text-muted-foreground">{tx.note}</span>}
                </td>
                <td className="py-1.5 pr-2 text-right">
                  {tx.amount > 0 ? "+" : ""}
                  {fmtNum(Number(tx.amount.toFixed(3)), unit)}
                </td>
                <td className="py-1.5 pr-2 text-right">{tx.totalCost == null ? "" : fmtMoney(tx.totalCost)}</td>
                <td className="py-1.5 text-right">
                  {tx.reason !== "BREW" && (
                    <form action={deleteTransaction.bind(null, tx.id)}>
                      <button aria-label={t("Delete entry")} className="rounded p-1 text-muted-foreground hover:bg-muted">
                        <X className="size-4" />
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </Card>
  );
}
