import { BrewList } from "@/components/brew-list";
import { ButtonLink, Card, DownloadLink, Empty, Input, PageHeader, Select } from "@/components/ui";
import { db } from "@/lib/db";
import { STATUSES } from "@/lib/brewing";
import type { Prisma } from "@/generated/prisma/client";
import type { BrewStatus } from "@/generated/prisma/enums";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("My Brews") };
}

export default async function BrewsPage(props: PageProps<"/brews">) {
  const { t } = await getI18n();
  const sp = await props.searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : "");
  const q = one("q");
  const style = one("style");
  const recipeId = Number(one("recipe")) || undefined;
  const status = STATUSES.find((s) => s.value === one("status"))?.value as BrewStatus | undefined;
  const year = Number(one("year")) || undefined;

  const where: Prisma.BrewSessionWhereInput = {
    ...(recipeId && { recipeId }),
    ...(status && { status }),
    ...(year && { brewDate: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } }),
    ...(style && { recipe: { style } }),
    ...(q && {
      OR: [
        { recipe: { name: { contains: q, mode: "insensitive" } } },
        { notes: { contains: q, mode: "insensitive" } },
        { problems: { some: { title: { contains: q, mode: "insensitive" } } } },
        { steps: { some: { notes: { contains: q, mode: "insensitive" } } } },
      ],
    }),
  };

  const [brews, recipes, years] = await Promise.all([
    db.brewSession.findMany({
      where,
      orderBy: [{ brewDate: "desc" }, { batchNumber: "desc" }],
      include: { recipe: { select: { name: true, style: true } }, _count: { select: { problems: true } } },
    }),
    db.recipe.findMany({ select: { id: true, name: true, style: true }, orderBy: { name: "asc" } }),
    db.$queryRaw<{ year: number }[]>`SELECT DISTINCT EXTRACT(YEAR FROM "brewDate")::int AS year FROM "BrewSession" ORDER BY year DESC`,
  ]);
  const styles = [...new Set(recipes.map((r) => r.style).filter((s): s is string => !!s))].sort();
  const filtered = !!(q || style || recipeId || status || year);

  return (
    <>
      <PageHeader title={`🍺 ${t("My Brews")}`} actions={
          <>
            <DownloadLink href="/brews/export.csv" variant="ghost">
              {t("Export CSV")}
            </DownloadLink>
            <ButtonLink href="/compare" variant="secondary">
              {t("Compare")}
            </ButtonLink>
            <ButtonLink href="/brews/new">{t("+ New brew")}</ButtonLink>
          </>
        } />
      <form className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Input name="q" defaultValue={q} placeholder={t("Search recipe, notes, problems")} className="col-span-2 sm:max-w-xs" />
        <Select name="style" defaultValue={style} className="sm:w-auto">
          <option value="">{t("All styles")}</option>
          {styles.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
        <Select name="recipe" defaultValue={recipeId ?? ""} className="sm:w-auto">
          <option value="">{t("All recipes")}</option>
          {recipes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
        <Select name="status" defaultValue={status ?? ""} className="sm:w-auto">
          <option value="">{t("Any status")}</option>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {t(s.label)}
            </option>
          ))}
        </Select>
        <Select name="year" defaultValue={year ?? ""} className="sm:w-auto">
          <option value="">{t("Any year")}</option>
          {years.map((y) => (
            <option key={y.year}>{y.year}</option>
          ))}
        </Select>
        <button className="min-h-10 rounded-md border border-border px-3 text-sm hover:bg-muted">{t("Filter")}</button>
      </form>
      <Card>
        {brews.length === 0 ? (
          <Empty>{filtered ? t("No brews match these filters.") : t("No brews yet — start one from a recipe.")}</Empty>
        ) : (
          <BrewList brews={brews} />
        )}
      </Card>
    </>
  );
}
