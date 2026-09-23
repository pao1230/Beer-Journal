import { fmtAbv, fmtSg } from "@/lib/brewing";
import { IONS, type calcRecipe } from "@/lib/calc";
import { cn } from "@/lib/utils";

type Calc = ReturnType<typeof calcRecipe>;

function Row({ label, est, target }: { label: string; est: string; target: string }) {
  return (
    <tr className="border-t border-border">
      <th scope="row" className="py-1.5 pr-3 text-left font-normal text-muted-foreground">
        {label}
      </th>
      <td className="py-1.5 pr-3 text-right font-semibold tabular-nums">{est}</td>
      <td className="py-1.5 text-right text-muted-foreground tabular-nums">{target}</td>
    </tr>
  );
}

const n = (v: number | null | undefined, d = 0) => (v == null ? "–" : v.toFixed(d));

/** Estimated numbers from the ingredient list, next to the recipe's targets. */
export function CalcTable({
  calc,
  targets,
  className,
}: {
  calc: Calc;
  targets: { og: number | null; fg: number | null; ibu: number | null; srm: number | null };
  className?: string;
}) {
  return (
    <div className={cn("text-sm", className)}>
      <table className="w-full">
        <thead className="text-xs text-muted-foreground">
          <tr>
            <th />
            <th className="pb-1 pr-3 text-right font-medium">Calculated</th>
            <th className="pb-1 text-right font-medium">Target</th>
          </tr>
        </thead>
        <tbody>
          <Row label="OG" est={fmtSg(calc.og)} target={fmtSg(targets.og)} />
          <Row label="FG" est={fmtSg(calc.fg)} target={fmtSg(targets.fg)} />
          <Row label="ABV" est={fmtAbv(calc.abv)} target={fmtAbv(targets.og != null && targets.fg != null ? (targets.og - targets.fg) * 131.25 : null)} />
          <Row label="IBU (Tinseth)" est={n(calc.ibu)} target={n(targets.ibu)} />
          <Row label="SRM (Morey)" est={n(calc.srm)} target={n(targets.srm)} />
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted-foreground">At {calc.efficiency}% brewhouse efficiency.</p>
      {calc.water && (
        <>
          <h3 className="mt-4 mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Water from salts (ppm, {calc.water.litres.toFixed(1)} L)
          </h3>
          <div className="grid grid-cols-6 gap-1 text-center tabular-nums">
            {IONS.map((ion) => (
              <div key={ion} className="rounded-md bg-muted px-1 py-1.5">
                <div className="text-xs text-muted-foreground">{ion}</div>
                <div className="font-semibold">{calc.water!.ppm[ion].toFixed(0)}</div>
              </div>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            SO₄:Cl {calc.water.sulfateToChloride == null ? "–" : calc.water.sulfateToChloride.toFixed(2)} · assumes RO or
            distilled base water
          </p>
        </>
      )}
      {calc.warnings.length > 0 && (
        <ul className="mt-3 list-disc pl-4 text-xs text-muted-foreground">
          {calc.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
