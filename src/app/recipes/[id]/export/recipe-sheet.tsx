import type { ReactNode } from "react";
import { abv, fmtNum, fmtSg } from "@/lib/brewing";
import { convertUnit, kegPsi, primingSugar, srmColor, strikeTemp, toKg } from "@/lib/calc";
import { translate } from "@/lib/i18n/core";
import type { RecipeData, RecipeDataIngredient } from "@/lib/recipe-file";
import type { ExportOptions, Section, SheetLang } from "./options";

type Vars = Record<string, string | number>;

// Grain sits at room temperature; in Thailand that's about 28°C.
const GRAIN_TEMP_C = 28;
const SERVING_TEMPS = [2, 4, 6];
const DAY_MS = 86_400_000;

/**
 * Labels in the sheet's own language (independent of the app's). "both" shows Thai with the
 * English in brackets, like Thai brewing sheets usually do; longer sentences use Thai only.
 */
function sheetText(lang: SheetLang) {
  const th = (key: string, vars?: Vars) => translate("th", key, vars);
  const en = (key: string, vars?: Vars) => translate("en", key, vars);
  const label = (key: string, vars?: Vars): ReactNode => {
    if (lang === "en") return en(key, vars);
    if (lang === "th") return th(key, vars);
    const a = th(key, vars);
    const b = en(key, vars);
    return a === b ? b : (
      <>
        {a} <span className="font-normal text-stone-500">({b})</span>
      </>
    );
  };
  const text = (key: string, vars?: Vars) => (lang === "en" ? en(key, vars) : th(key, vars));
  return { label, text };
}

function H({ n, children }: { n: number; children: ReactNode }) {
  return (
    <h2 className="mb-1.5 border-b border-amber-700/40 pb-0.5 text-[13px] font-bold text-amber-800">
      {n}. {children}
    </h2>
  );
}

function Blank({ w = "w-16" }: { w?: string }) {
  return <span className={`inline-block ${w} translate-y-0.5 border-b border-stone-400`} aria-hidden />;
}

function Box() {
  return <span className="mr-1 inline-block size-3 translate-y-0.5 rounded-[2px] border border-stone-500" aria-hidden />;
}

const grams = (i: RecipeDataIngredient) => convertUnit(i.amount, i.unit, "g");
const amountText = (i: RecipeDataIngredient) => fmtNum(i.amount, i.unit);
const r1 = (n: number) => Math.round(n * 10) / 10;

export type SheetProps = {
  data: RecipeData;
  version: number;
  options: ExportOptions;
  calc: { og: number | null; fg: number | null; ibu: number | null; srm: number | null };
  preBoilL: number | null;
  scaledFrom: number | null;
  qrSvg: string | null;
  code: string | null;
  exportedOn: string;
  formatDate: (d: Date) => string;
};

export function RecipeSheet({ data, version, options, calc, preBoilL, scaledFrom, qrSvg, code, exportedOn, formatDate }: SheetProps) {
  const { label: L, text: P } = sheetText(options.lang);
  const show = (s: Section) => !options.hide.includes(s);
  const brewDay = options.style === "brewday";
  const brewDate = options.date ? new Date(`${options.date}T12:00:00`) : null;
  const dayDate = (day: number) => (brewDate ? formatDate(new Date(brewDate.getTime() + day * DAY_MS)) : null);

  const og = data.targetOg ?? calc.og;
  const fg = data.targetFg ?? calc.fg;
  const ibu = data.targetIbu ?? calc.ibu;
  const srm = data.targetSrm ?? calc.srm;
  const at = (...stages: RecipeDataIngredient["stage"][]) => data.ingredients.filter((i) => stages.includes(i.stage));

  const grains = data.ingredients.filter((i) => i.type === "GRAIN");
  const grainKg = grains.reduce((sum, g) => sum + (toKg(g.amount, g.unit) ?? 0), 0);
  const yeasts = data.ingredients.filter((i) => i.type === "YEAST");
  const others = data.ingredients.filter((i) => i.type === "WATER" || i.type === "OTHER");
  const hopTotals = new Map<string, number>();
  for (const h of data.ingredients.filter((i) => i.type === "HOP")) {
    const g = grams(h);
    if (g != null) hopTotals.set(h.name, (hopTotals.get(h.name) ?? 0) + g);
  }
  const allGrain = grains.some((g) => g.stage === "MASH");

  // Mash: first step gets the strike temperature.
  const ratio = data.mashWaterL != null && grainKg > 0 ? data.mashWaterL / grainKg : null;
  const mainMash = data.mashSteps[0];
  const strike = mainMash && ratio ? strikeTemp(mainMash.temperature, GRAIN_TEMP_C, ratio) : null;

  // Boil timeline: additions grouped by minutes left, longest first.
  const boilGroups = new Map<string, { title: ReactNode; when: ReactNode; items: RecipeDataIngredient[] }>();
  for (const i of at("BOIL", "WHIRLPOOL").sort((a, b) => (b.additionTime ?? -1) - (a.additionTime ?? -1))) {
    const t = i.additionTime;
    const key = `${i.stage}|${t}`;
    const group =
      boilGroups.get(key) ??
      (i.stage === "WHIRLPOOL"
        ? { title: L("Flameout / whirlpool"), when: t ? L("{n} min", { n: t }) : L("Flameout"), items: [] }
        : {
            title: t != null ? `${P("Boil")} – ${t} min` : P("Boil"),
            when: t == null ? "" : t === data.boilTime ? L("Start of boil") : L("{n} min before end", { n: t }),
            items: [],
          });
    group.items.push(i);
    boilGroups.set(key, group);
  }

  // Fermentation plan with day ranges; dry hops and other additions land on the step that covers their day.
  const plan = data.fermentationSteps.reduce<(RecipeData["fermentationSteps"][number] & { start: number; end: number })[]>((out, f) => {
    const start = out.at(-1)?.end ?? 0;
    return [...out, { ...f, start, end: start + (f.days ?? 0) }];
  }, []);
  const dayAdds = at("DRY_HOP", "FERMENTATION").filter((i) => i.type !== "YEAST");
  const addsFor = (start: number, end: number, last: boolean) =>
    dayAdds.filter((i) => i.additionTime != null && i.additionTime >= start && (i.additionTime < end || (last && i.additionTime >= end)));
  const unplaced = plan.length ? dayAdds.filter((i) => i.additionTime == null) : dayAdds;

  const co2 = data.targetCarbonation;
  const servePsi = co2 != null ? kegPsi(4, co2) : null;
  const maxFermentTemp = Math.max(20, ...data.fermentationSteps.map((f) => f.temperature ?? 0));

  // Section numbers follow what is actually shown.
  const showFerment = show("ferment") && (plan.length > 0 || dayAdds.length > 0 || yeasts.length > 0);
  const shown = [
    ["grain", true],
    ["yeast", true],
    ["hops", true],
    ["others", others.length > 0],
    ["water", true],
    ["schedule", true],
    ["ferment", showFerment],
    ["keg", show("keg") && co2 != null],
    ["serving", show("serving") && co2 != null],
    ["readings", brewDay],
  ].flatMap(([key, on]) => (on ? [key] : []));
  const num = (key: string) => shown.indexOf(key) + 1;

  // A note shared by every addition in a row ("80–85°C for 15–20 min") is printed once.
  const joinAdds = (items: RecipeDataIngredient[]) => {
    const shared = items.length > 1 && items.every((i) => i.notes && i.notes === items[0].notes) ? items[0].notes : null;
    const list = items.map((i) => `${i.name} ${amountText(i)}${i.notes && !shared ? ` (${i.notes})` : ""}`).join(" + ");
    return shared ? `${list} — ${shared}` : list;
  };

  return (
    <article className="recipe-sheet mx-auto w-full max-w-[210mm] bg-white p-5 text-[12px] leading-snug text-stone-900 shadow-lg ring-1 ring-stone-200 sm:p-[12mm] print:max-w-none print:p-0 print:shadow-none print:ring-0">
      {/* Not <header>: the app hides headers when printing. */}
      <div className="flex items-start justify-between gap-4 border-b-2 border-amber-700 pb-2">
        <div className="min-w-0">
          <h1 className="text-2xl leading-tight font-bold">{data.name}</h1>
          <p className="text-stone-600">
            {[data.style, allGrain ? "All-Grain" : null, `v${version}`].filter(Boolean).join(" · ")}
            {scaledFrom != null && ` · ${P("scaled from {n} L", { n: fmtNum(scaledFrom) })}`}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[10px] tracking-wide text-stone-500 uppercase">{L("Batch volume")}</div>
          <div className="text-xl font-bold tabular-nums">{fmtNum(data.batchSize, "L")}</div>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6 print:grid-cols-6">
        {[
          ["Original gravity", fmtSg(og)],
          ["Final gravity", fmtSg(fg)],
          ["ABV", og != null && fg != null ? `${abv(og, fg)!.toFixed(1)}%` : "–"],
          ["Bitterness", ibu != null ? `${Math.round(ibu)} IBU` : "–"],
          ["Color", srm != null ? `${Math.round(srm)} SRM` : "–"],
          ["Carbonation", co2 != null ? `${fmtNum(co2)} vol` : "–"],
        ].map(([k, v]) => (
          <div key={k} className="rounded border border-stone-200 bg-stone-50 px-2 py-1.5">
            <dt className="text-[9px] tracking-wide text-stone-500 uppercase">{L(k)}</dt>
            <dd className="flex items-center gap-1.5 text-[15px] font-bold tabular-nums">
              {k === "Color" && srm != null && (
                <span className="inline-block size-3 rounded-full ring-1 ring-black/20" style={{ background: srmColor(srm) }} aria-hidden />
              )}
              {v}
            </dd>
          </div>
        ))}
      </dl>

      {brewDay && (
        <p className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
          <span>
            {L("Brew date")}: {brewDate ? formatDate(brewDate) : <Blank w="w-24" />}
          </span>
          <span>
            {L("Batch no.")}: <Blank w="w-12" />
          </span>
          <span>
            {L("Brewer")}: <Blank w="w-28" />
          </span>
        </p>
      )}

      <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2 print:grid-cols-2">
        <section>
          <H n={num("grain")}>{L("Malts & grains")}</H>
          <table className="w-full tabular-nums">
            <thead className="text-left text-[10px] text-stone-500">
              <tr>
                <th className="font-medium">{L("Item")}</th>
                <th className="text-right font-medium">%</th>
                <th className="text-right font-medium">{L("Weight")}</th>
              </tr>
            </thead>
            <tbody>
              {grains.map((g, idx) => {
                const kg = toKg(g.amount, g.unit);
                return (
                  <tr key={idx} className="border-t border-stone-100">
                    <td className="py-0.5 pr-2">
                      {brewDay && <Box />}
                      {g.name}
                      {g.stage !== "MASH" && <span className="text-stone-500"> · {P(g.stage === "BOIL" ? "Boil" : "Kettle")}</span>}
                    </td>
                    <td className="text-right">{kg != null && grainKg > 0 ? `${Math.round((kg / grainKg) * 100)}%` : ""}</td>
                    <td className="text-right whitespace-nowrap">{amountText(g)}</td>
                  </tr>
                );
              })}
              {grains.length === 0 && (
                <tr>
                  <td className="text-stone-500">–</td>
                </tr>
              )}
              {grains.length > 1 && (
                <tr className="border-t border-stone-300 font-semibold">
                  <td>{L("Total grain")}</td>
                  <td />
                  <td className="text-right">{fmtNum(r1(grainKg * 100) / 100, "kg")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <div className="flex flex-col gap-4">
          <section>
            <H n={num("yeast")}>{L("Yeast")}</H>
            <ul>
              {yeasts.map((y, idx) => (
                <li key={idx} className="flex justify-between gap-2">
                  <span>
                    {brewDay && <Box />}
                    {y.name}
                    {y.attenuation != null && <span className="text-stone-500"> · {y.attenuation}% {P("attenuation")}</span>}
                  </span>
                  <span className="tabular-nums">{amountText(y)}</span>
                </li>
              ))}
              {yeasts.length === 0 && <li className="text-stone-500">–</li>}
            </ul>
          </section>
          <section>
            <H n={num("hops")}>{L("Total hops")}</H>
            <ul>
              {[...hopTotals].map(([name, g]) => (
                <li key={name} className="flex justify-between gap-2">
                  <span>{name}</span>
                  <span className="tabular-nums">{fmtNum(r1(g), "g")}</span>
                </li>
              ))}
              {hopTotals.size === 0 && <li className="text-stone-500">–</li>}
            </ul>
          </section>
          {others.length > 0 && (
            <section>
              <H n={num("others")}>{L("Water salts & other additions")}</H>
              <ul>
                {others.map((o, idx) => (
                  <li key={idx} className="flex justify-between gap-2">
                    <span>
                      {brewDay && <Box />}
                      {o.name}
                      <span className="text-stone-500"> · {P(stageLabel(o.stage))}</span>
                    </span>
                    <span className="tabular-nums">{amountText(o)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      <section className="mt-4">
        <H n={num("water")}>{L("Water & volumes")}</H>
        <ul className="grid gap-x-6 gap-y-0.5 sm:grid-cols-2 print:grid-cols-2">
          <li>
            • {L("Mash water")}: <b>{fmtNum(data.mashWaterL, "L")}</b>
            {ratio != null && <span className="text-stone-500"> ({fmtNum(r1(ratio))} L/kg)</span>}
            {strike != null && (
              <div className="pl-3 text-stone-600">
                {P("Strike water ≈ {t}°C (grain at {g}°C)", { t: Math.round(strike), g: GRAIN_TEMP_C })}
              </div>
            )}
          </li>
          <li>
            • {L("Pre-boil volume")}: <b>{preBoilL != null ? `${r1(preBoilL)} L` : "–"}</b>
          </li>
          <li>
            • {L("Sparge water")}: <b>{fmtNum(data.spargeWaterL, "L")}</b>
            {data.spargeWaterL != null && <div className="pl-3 text-stone-600">{P("Sparge at 75–78°C")}</div>}
          </li>
          <li>
            • {L("Into fermenter")}: <b>{fmtNum(data.batchSize, "L")}</b>
          </li>
          {(data.waterSource || data.targetMashPh != null) && (
            <li>
              • {L("Water source")}: <b>{data.waterSource ?? "–"}</b>
              {data.targetMashPh != null && <span> · {P("target mash pH {n}", { n: data.targetMashPh })}</span>}
            </li>
          )}
        </ul>
      </section>

      <section className="mt-4">
        <H n={num("schedule")}>{L("Mash & boil schedule")}</H>
        <table className="w-full">
          <thead className="text-left text-[10px] text-stone-500">
            <tr>
              <th className="w-[28%] font-medium">{L("Step")}</th>
              <th className="w-[24%] font-medium">{L("Time / temperature")}</th>
              <th className="font-medium">{L("What to do")}</th>
              {brewDay && <th className="w-[16%] font-medium">{L("Actual")}</th>}
            </tr>
          </thead>
          <tbody className="align-top">
            {data.mashSteps.map((m, idx) => {
              const adds = idx === 0 ? at("MASH").filter((i) => i.type !== "GRAIN") : [];
              return (
                <tr key={`m${idx}`} className="border-t border-stone-100">
                  <td className="py-1 pr-2 font-medium">
                    {brewDay && <Box />}
                    {m.name}
                  </td>
                  <td className="pr-2 tabular-nums">
                    {m.temperature}°C · {m.timeMin} min
                  </td>
                  <td className="pr-2">{adds.length > 0 && `${P("Add")}: ${joinAdds(adds)}`}</td>
                  {brewDay && (
                    <td>
                      <Blank w="w-10" />
                      °C
                    </td>
                  )}
                </tr>
              );
            })}
            {at("SPARGE").length > 0 && (
              <tr className="border-t border-stone-100">
                <td className="py-1 pr-2 font-medium">
                  {brewDay && <Box />}
                  {P("Sparge")}
                </td>
                <td />
                <td className="pr-2">{`${P("Add")}: ${joinAdds(at("SPARGE"))}`}</td>
                {brewDay && <td />}
              </tr>
            )}
            {[...boilGroups.values()].map((g, idx) => (
              <tr key={`b${idx}`} className="border-t border-stone-100">
                <td className="py-1 pr-2 font-medium">
                  {brewDay && <Box />}
                  {g.title}
                </td>
                <td className="pr-2">{g.when}</td>
                <td className="pr-2">{joinAdds(g.items)}</td>
                {brewDay && <td />}
              </tr>
            ))}
            {boilGroups.size === 0 && (
              <tr className="border-t border-stone-100">
                <td className="py-1 font-medium">{P("Boil")}</td>
                <td>{data.boilTime} min</td>
                <td />
                {brewDay && <td />}
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {showFerment && (
        <section className="mt-4">
          <H n={num("ferment")}>{L("Fermentation & dry hopping")}</H>
          {plan.length > 0 ? (
            <table className="w-full">
              <thead className="text-left text-[10px] text-stone-500">
                <tr>
                  <th className="w-[18%] font-medium">{L("Day")}</th>
                  <th className="w-[26%] font-medium">{L("Step")}</th>
                  <th className="w-[12%] font-medium">{L("Temp")}</th>
                  <th className="font-medium">{L("Details")}</th>
                </tr>
              </thead>
              <tbody className="align-top">
                {plan.map((f, idx) => {
                  const adds = addsFor(f.start, f.end, idx === plan.length - 1);
                  const details = [
                    idx === 0 && yeasts.length > 0 && `${P("Pitch")} ${yeasts.map((y) => `${y.name} ${amountText(y)}`).join(" + ")}`,
                    ...adds.map((a) => `${P("Day {n}", { n: a.additionTime! })}: ${a.name} ${amountText(a)}`),
                    f.notes,
                  ].filter(Boolean);
                  const dates = [dayDate(f.start), f.end > f.start ? dayDate(f.end) : null].filter(Boolean);
                  return (
                    <tr key={idx} className="border-t border-stone-100">
                      <td className="py-1 pr-2 tabular-nums">
                        {brewDay && <Box />}
                        {f.end > f.start ? `${fmtNum(f.start)}–${fmtNum(f.end)}` : fmtNum(f.start)}
                        {dates.length > 0 && <div className="text-[10px] text-stone-500">{dates.join(" → ")}</div>}
                      </td>
                      <td className="pr-2 font-medium">
                        {f.name}
                        {f.days != null && <span className="font-normal text-stone-500"> · {P(f.days === 1 ? "{n} day" : "{n} days", { n: fmtNum(f.days) })}</span>}
                      </td>
                      <td className="pr-2 tabular-nums">{f.temperature != null ? `${fmtNum(f.temperature)}°C` : "–"}</td>
                      <td>
                        {details.map((d, i) => (
                          <div key={i}>{d}</div>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            yeasts.length > 0 && <p>{`${P("Pitch")} ${yeasts.map((y) => `${y.name} ${amountText(y)}`).join(" + ")}`}</p>
          )}
          {unplaced.length > 0 && (
            <ul className="mt-1">
              {unplaced.map((a, idx) => (
                <li key={idx}>
                  {brewDay && <Box />}
                  {a.additionTime != null ? `${P("Day {n}", { n: a.additionTime })}: ` : ""}
                  {a.name} {amountText(a)} <span className="text-stone-500">· {P(stageLabel(a.stage))}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {show("notes") && (data.notes || data.versionNotes) && (
        <section className="mt-4 rounded border border-amber-200 bg-amber-50 p-2.5 print:break-inside-avoid">
          <h2 className="mb-1 font-bold">💡 {L("Notes")}</h2>
          {data.notes && <p className="whitespace-pre-wrap">{data.notes}</p>}
          {data.versionNotes && <p className="mt-1 text-stone-600">v{version}: {data.versionNotes}</p>}
        </section>
      )}

      {show("keg") && co2 != null && servePsi != null && (
        <section className="mt-4 print:break-inside-avoid">
          <H n={num("keg")}>{L("Kegging & carbonation")}</H>
          <p className="mb-2">
            <b>{P("Purge oxygen first")}:</b> {P("Close the keg, pressurise to 10–12 PSI, open the relief valve for 2–3 seconds; repeat 3–5 times.")}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 print:grid-cols-2">
            <div className="rounded border border-stone-200 p-2">
              <div className="font-bold">
                {P("Method 1: Set & forget")} <span className="font-normal text-amber-800">· {P("recommended")}</span>
              </div>
              <ol className="list-decimal pl-4">
                <li>{P("Chill the keg to 2–4°C.")}</li>
                <li>{P("Set CO₂ to {psi} PSI and leave it connected.", { psi: Math.round(servePsi) })}</li>
                <li>{P("Ready in 5–7 days.")}</li>
              </ol>
            </div>
            <div className="rounded border border-stone-200 p-2">
              <div className="font-bold">{P("Method 2: 24-hour burst")}</div>
              <ol className="list-decimal pl-4">
                <li>{P("Chill the keg to 2–4°C.")}</li>
                <li>{P("Set CO₂ to 30 PSI for 24 hours.")}</li>
                <li>{P("Vent, then set {psi} PSI for 12 more hours.", { psi: Math.round(servePsi) })}</li>
              </ol>
            </div>
          </div>
          <p className="mt-2 text-stone-600">
            {P("Bottling instead: {g} g dextrose for {l} L ({co2} vol).", {
              g: Math.round(primingSugar(data.batchSize, co2, maxFermentTemp, "dextrose")),
              l: fmtNum(data.batchSize),
              co2: fmtNum(co2),
            })}
            {at("PACKAGING").length > 0 && ` ${P("At packaging")}: ${joinAdds(at("PACKAGING"))}`}
          </p>
        </section>
      )}

      {show("serving") && co2 != null && (
        <section className="mt-4 print:break-inside-avoid">
          <H n={num("serving")}>{L("Serving pressure")}</H>
          <table className="w-full tabular-nums">
            <thead className="text-left text-[10px] text-stone-500">
              <tr>
                <th className="font-medium">{L("Beer temperature")}</th>
                <th className="font-medium">{L("Keg pressure")}</th>
                <th className="font-medium">CO₂</th>
              </tr>
            </thead>
            <tbody>
              {SERVING_TEMPS.map((t) => (
                <tr key={t} className={t === 4 ? "border-t border-stone-100 font-semibold" : "border-t border-stone-100"}>
                  <td className="py-0.5">
                    {t}°C {t === 4 && <span className="font-normal text-amber-800">· {P("recommended")}</span>}
                  </td>
                  <td>{Math.round(kegPsi(t, co2))} PSI</td>
                  <td>{fmtNum(co2)} vol</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {brewDay && (
        <section className="mt-4 print:break-inside-avoid">
          <H n={num("readings")}>{L("Brew-day readings")}</H>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4 print:grid-cols-4">
            {[
              ["Strike temp", "°C"],
              ["Mash pH", ""],
              ["Pre-boil volume", "L"],
              ["Pre-boil SG", ""],
              ["OG", ""],
              ["Into fermenter", "L"],
              ["FG", ""],
              ["Packaged on", ""],
            ].map(([k, unit]) => (
              <div key={k}>
                <dt className="text-[10px] text-stone-500">{L(k)}</dt>
                <dd>
                  <Blank w="w-20" /> {unit}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <footer className="mt-6 flex items-end justify-between gap-4 border-t border-stone-200 pt-2 text-[10px] text-stone-500 print:break-inside-avoid">
        <div className="min-w-0">
          <div>
            {data.name} · v{version} · {P("Recipe sheet")} · Brewing Journal · {exportedOn}
          </div>
          {show("code") && code && (
            <>
              <div className="mt-1">{P("Import this sheet: scan the QR code, or open Recipes → Import and choose this PDF.")}</div>
              <div className="mt-0.5 font-mono text-[6px] leading-tight break-all text-stone-400">{code}</div>
            </>
          )}
        </div>
        {show("code") && qrSvg && (
          <div className="size-[26mm] shrink-0 [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
        )}
      </footer>
    </article>
  );
}

function stageLabel(stage: RecipeDataIngredient["stage"]) {
  const labels: Record<RecipeDataIngredient["stage"], string> = {
    MASH: "Mash",
    SPARGE: "Sparge",
    BOIL: "Boil",
    WHIRLPOOL: "Whirlpool",
    FERMENTATION: "Fermentation",
    DRY_HOP: "Dry hop",
    PACKAGING: "Packaging",
  };
  return labels[stage];
}
