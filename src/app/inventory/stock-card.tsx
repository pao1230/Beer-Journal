import Link from "next/link";
import { X } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Button, Card, CardTitle, Field, Input, Stat } from "@/components/ui";
import { db } from "@/lib/db";
import { batchLabel, fmtDate, fmtNum } from "@/lib/brewing";
import { fmtMoney } from "@/lib/inventory";
import { loadStock } from "@/lib/inventory-data";
import { addPurchase, countStock, deleteTransaction } from "./actions";

const REASON_LABEL = { PURCHASE: "Purchase", ADJUSTMENT: "Stock count", BREW: "Used in brew" } as const;

export async function StockCard({ ingredientId }: { ingredientId: number }) {
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
        <CardTitle>Inventory</CardTitle>
        <p className="text-sm text-muted-foreground">Choose an inventory unit above to track stock and cost.</p>
      </Card>
    );
  }
  return (
    <Card className="mt-4">
      <CardTitle>Inventory</CardTitle>
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="In stock" value={<span className={stock.onHand <= 0 ? "text-danger" : ""}>{fmtNum(Number(stock.onHand.toFixed(3)), unit)}</span>} />
        <Stat label={`Avg cost / ${unit}`} value={fmtMoney(stock.avgCost)} />
        <Stat label="Stock value" value={fmtMoney(stock.avgCost == null ? null : Math.max(0, stock.onHand) * stock.avgCost)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ActionForm action={addPurchase.bind(null, ingredientId)} resetOnSuccess className="grid grid-cols-2 gap-2 rounded-md border border-border p-3">
          <h3 className="col-span-2 text-sm font-semibold">Add purchase</h3>
          <Field label={`Amount (${unit})`}>
            <Input name="amount" type="number" step="any" min="0" required />
          </Field>
          <Field label="Total price">
            <Input name="totalCost" type="number" step="0.01" min="0" />
          </Field>
          <Field label="Note" className="col-span-2">
            <Input name="note" placeholder="Brew Shop A" />
          </Field>
          <div className="col-span-2">
            <Button type="submit" variant="secondary">Add purchase</Button>
          </div>
        </ActionForm>
        <ActionForm action={countStock.bind(null, ingredientId)} resetOnSuccess className="grid content-start gap-2 rounded-md border border-border p-3">
          <h3 className="text-sm font-semibold">Stock count</h3>
          <Field label={`Counted amount (${unit})`} hint="Records the difference as an adjustment">
            <Input name="counted" type="number" step="any" min="0" required />
          </Field>
          <div>
            <Button type="submit" variant="secondary">Save count</Button>
          </div>
        </ActionForm>
      </div>

      {history.length > 0 && (
        <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-1 pr-2 font-medium">Date</th>
              <th className="py-1 pr-2 font-medium">What</th>
              <th className="py-1 pr-2 text-right font-medium">Amount</th>
              <th className="py-1 pr-2 text-right font-medium">Price</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {history.map((t) => (
              <tr key={t.id}>
                <td className="py-1.5 pr-2 whitespace-nowrap">{fmtDate(t.createdAt)}</td>
                <td className="py-1.5 pr-2">
                  {t.brewSession ? (
                    <Link className="underline" href={`/brews/${t.brewSession.id}`}>
                      {batchLabel(t.brewSession.recipe.name, t.brewSession.batchNumber)}
                    </Link>
                  ) : (
                    REASON_LABEL[t.reason]
                  )}
                  {t.note && <span className="ml-1 text-xs text-muted-foreground">{t.note}</span>}
                </td>
                <td className="py-1.5 pr-2 text-right">
                  {t.amount > 0 ? "+" : ""}
                  {fmtNum(Number(t.amount.toFixed(3)), unit)}
                </td>
                <td className="py-1.5 pr-2 text-right">{t.totalCost == null ? "" : fmtMoney(t.totalCost)}</td>
                <td className="py-1.5 text-right">
                  {t.reason !== "BREW" && (
                    <form action={deleteTransaction.bind(null, t.id)}>
                      <button aria-label="Delete entry" className="rounded p-1 text-muted-foreground hover:bg-muted">
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
