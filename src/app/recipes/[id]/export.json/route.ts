import { toRecipeFile } from "@/lib/recipe-file";
import { parseExportOptions } from "../export/options";
import { fileSlug, loadExportData } from "../export/data";

/** The recipe as a Brewing Journal recipe file, for importing elsewhere. */
export async function GET(req: Request, ctx: RouteContext<"/recipes/[id]/export.json">) {
  const id = Number((await ctx.params).id);
  const opts = parseExportOptions(Object.fromEntries(new URL(req.url).searchParams));
  const loaded = await loadExportData(id, opts.v, opts.size);
  if (!loaded) return new Response("Not found", { status: 404 });
  const filename = `${fileSlug(loaded.data.name, loaded.version.version, loaded.data.batchSize)}.recipe.json`;
  return new Response(JSON.stringify(toRecipeFile(loaded.data), null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
