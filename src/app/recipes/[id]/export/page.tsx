import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { fmtDate, preBoilVolume } from "@/lib/brewing";
import { calcRecipe } from "@/lib/calc";
import { shortages } from "@/lib/inventory";
import { loadStock } from "@/lib/inventory-data";
import { encodeRecipeCode, encodeRecipePayload } from "@/lib/recipe-file";
import { getI18n } from "@/lib/i18n/server";
import { exportSearch, parseExportOptions } from "./options";
import { fileSlug, loadExportData } from "./data";
import { ExportPanel } from "./export-panel";
import { RecipeSheet } from "./recipe-sheet";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Export recipe") };
}

/** Where this app is being served from, for the QR link back to the import screen. */
async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto.split(",")[0]}://${host.split(",")[0]}`;
}

export default async function ExportRecipePage(props: PageProps<"/recipes/[id]/export">) {
  const { t } = await getI18n();
  const id = Number((await props.params).id);
  const options = parseExportOptions(await props.searchParams);
  const loaded = await loadExportData(id, options.v, options.size);
  if (!loaded) notFound();
  const { data, version, recipe } = loaded;
  const eq = version.equipmentProfile;

  const calc = calcRecipe({
    batchSize: data.batchSize,
    targetOg: data.targetOg,
    efficiency: eq?.efficiency ?? null,
    trubLoss: eq?.trubLoss ?? null,
    mashWaterL: data.mashWaterL,
    spargeWaterL: data.spargeWaterL,
    ingredients: data.ingredients.map((i, idx) => ({ ...i, waterSalt: loaded.waterSalts[idx] })),
  });
  const stock = await loadStock([...new Set(loaded.ingredientIds)]);
  const short = shortages(
    data.ingredients.map((i, idx) => ({ ingredientId: loaded.ingredientIds[idx], name: i.name, amount: i.amount, unit: i.unit })),
    (ingredientId) => stock.get(ingredientId),
  );

  const showCode = !options.hide.includes("code");
  const code = showCode ? await encodeRecipeCode(data) : null;
  const qrSvg = showCode
    ? await QRCode.toString(`${await origin()}/recipes/import#code=${await encodeRecipePayload(data)}`, {
        type: "svg",
        errorCorrectionLevel: "L",
        margin: 0,
      }).catch(() => null)
    : null;

  const sheetLocale = options.lang === "en" ? "en" : "th";
  const q = exportSearch({ ...options, lang: "both", style: "recipe", date: null, hide: [] });

  return (
    <>
      <div className="no-print mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <Link href={`/recipes/${recipe.id}${options.v ? `?v=${options.v}` : ""}`} className="text-sm underline">
            {t("← Back to recipe")}
          </Link>
          <h1 className="text-2xl font-bold">{t("Export {name}", { name: recipe.name })}</h1>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="no-print self-start lg:sticky lg:top-4">
          <ExportPanel
            options={options}
            versions={loaded.versions}
            latestVersion={loaded.versions[0]}
            originalBatch={loaded.scaledFrom ?? data.batchSize}
            shortages={short}
            jsonHref={`/recipes/${recipe.id}/export.json${q ? `?${q}` : ""}`}
            fileName={`${fileSlug(data.name, version.version, data.batchSize)}.recipe.json`}
          />
        </aside>
        <div className="sheet-preview min-w-0 rounded-lg bg-stone-300/50 p-2 sm:p-5 dark:bg-stone-800 print:rounded-none print:bg-transparent print:p-0">
          <RecipeSheet
            data={data}
            version={version.version}
            options={options}
            calc={calc}
            preBoilL={preBoilVolume(data.batchSize, data.boilTime, eq)}
            scaledFrom={loaded.scaledFrom}
            qrSvg={qrSvg}
            code={code}
            exportedOn={fmtDate(new Date(), sheetLocale)}
            formatDate={(d) => fmtDate(d, sheetLocale)}
          />
        </div>
      </div>
    </>
  );
}
