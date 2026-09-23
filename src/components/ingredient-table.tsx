import { STAGES } from "@/lib/brewing";
import { getI18n } from "@/lib/i18n/server";
import type { T } from "@/lib/i18n/core";
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

function timeLabel(stage: AdditionStage, time: number | null, t: T) {
  if (time == null) return "";
  return stage === "DRY_HOP" ? t("day {n}", { n: time }) : t("{n} min", { n: time });
}

export async function IngredientTable({ rows }: { rows: TableRow[] }) {
  const { t } = await getI18n();
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{t("No ingredients.")}</p>;
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
            <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t(stage.label)}</h3>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border">
                {sorted.map((r) => (
                  <tr key={r.id}>
                    <td className="py-1.5 pr-2">
                      {r.name}
                      {r.detail && <span className="ml-2 text-xs text-muted-foreground">{r.detail}</span>}
                    </td>
                    <td className="w-20 py-1.5 pr-2 text-right text-muted-foreground tabular-nums">
                      {timeLabel(r.stage, r.additionTime, t)}
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
