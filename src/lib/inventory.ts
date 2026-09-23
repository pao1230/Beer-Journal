import { convertUnit } from "@/lib/calc";

export type Stock = { stockUnit: string | null; onHand: number; avgCost: number | null };

export function fmtMoney(n: number | null | undefined) {
  if (n == null) return "–";
  const symbol = process.env.CURRENCY ?? "฿";
  return `${symbol}${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Cost of using `amount unit` of an ingredient, or null if it can't be priced. */
export function lineCost(amount: number | null, unit: string, stock: Stock | undefined) {
  if (amount == null || !stock?.stockUnit || stock.avgCost == null) return null;
  const inStockUnit = convertUnit(amount, unit, stock.stockUnit);
  return inStockUnit == null ? null : inStockUnit * stock.avgCost;
}

/** How much of `amount unit` is missing from stock (in the line's unit); null if not tracked. */
export function shortfall(amount: number, unit: string, stock: Stock | undefined) {
  if (!stock?.stockUnit) return null;
  const onHand = convertUnit(stock.onHand, stock.stockUnit, unit);
  if (onHand == null) return null;
  return Math.max(0, amount - onHand);
}

export function summarize(
  rows: { ingredientId: number; amount: number; totalCost: number | null; reason: string }[],
  units: Map<number, string | null>,
) {
  const out = new Map<number, Stock>();
  const purchased = new Map<number, { amount: number; cost: number }>();
  for (const r of rows) {
    const s = out.get(r.ingredientId) ?? { stockUnit: units.get(r.ingredientId) ?? null, onHand: 0, avgCost: null };
    s.onHand += r.amount;
    out.set(r.ingredientId, s);
    if (r.reason === "PURCHASE" && r.totalCost != null && r.amount > 0) {
      const p = purchased.get(r.ingredientId) ?? { amount: 0, cost: 0 };
      p.amount += r.amount;
      p.cost += r.totalCost;
      purchased.set(r.ingredientId, p);
    }
  }
  for (const [id, p] of purchased) out.get(id)!.avgCost = p.cost / p.amount;
  for (const [id, unit] of units) if (!out.has(id)) out.set(id, { stockUnit: unit, onHand: 0, avgCost: null });
  return out;
}
