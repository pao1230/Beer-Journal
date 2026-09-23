import { STAGES } from "@/lib/brewing";
import type { AdditionStage } from "@/generated/prisma/enums";
import type { ReactNode } from "react";

export type TableRow = {
  id: number;
  name: string;
  detail?: string | null;
  stage: AdditionStage;
  additionTime: number | null;
  amount: ReactNode;
};

function timeLabel(stage: AdditionStage, t: number | null) {
  if (t == null) return "";
  return stage === "DRY_HOP" ? `day ${t}` : `${t} min`;
}

export function IngredientTable({ rows }: { rows: TableRow[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No ingredients.</p>;
  return (
    <div className="flex flex-col gap-4">
      {STAGES.map((stage) => {
        const inStage = rows.filter((r) => r.stage === stage.value);
        if (inStage.length === 0) return null;
        const sorted =
          stage.value === "BOIL" || stage.value === "WHIRLPOOL"
            ? [...inStage].sort((a, b) => (b.additionTime ?? -1) - (a.additionTime ?? -1))
            : inStage;
        return (
          <div key={stage.value}>
            <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{stage.label}</h3>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border">
                {sorted.map((r) => (
                  <tr key={r.id}>
                    <td className="py-1.5 pr-2">
                      {r.name}
                      {r.detail && <span className="ml-2 text-xs text-muted-foreground">{r.detail}</span>}
                    </td>
                    <td className="w-20 py-1.5 pr-2 text-right text-muted-foreground tabular-nums">
                      {timeLabel(r.stage, r.additionTime)}
                    </td>
                    <td className="py-1.5 text-right tabular-nums whitespace-nowrap">{r.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
