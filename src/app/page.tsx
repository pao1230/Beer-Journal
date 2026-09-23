import Link from "next/link";
import { BrewList } from "@/components/brew-list";
import { ButtonLink, Card, CardTitle, Empty, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";

export default async function Dashboard() {
  const { t } = await getI18n();
  const [recent, total, completed, fermenting, recipes, ingredients, lessons] = await Promise.all([
    db.brewSession.findMany({
      take: 5,
      orderBy: [{ brewDate: "desc" }, { batchNumber: "desc" }],
      include: { recipe: { select: { name: true, style: true } }, _count: { select: { problems: true } } },
    }),
    db.brewSession.count(),
    db.brewSession.count({ where: { status: "COMPLETED" } }),
    db.brewSession.count({ where: { status: "FERMENTING" } }),
    db.recipe.count(),
    db.ingredient.count({ where: { isArchived: false } }),
    db.lesson.findMany({ take: 5, orderBy: { createdAt: "desc" } }),
  ]);

  const stats = [
    { label: t("Total brews"), value: total, href: "/brews" },
    { label: t("Completed"), value: completed, href: "/brews?status=COMPLETED" },
    { label: t("Fermenting"), value: fermenting, href: "/brews?status=FERMENTING" },
    { label: t("Recipes"), value: recipes, href: "/recipes" },
  ];

  return (
    <>
      <PageHeader title={`🍺 ${t("Brewing Journal")}`} actions={<ButtonLink href="/brews/new">{t("+ New brew")}</ButtonLink>} />

      {ingredients === 0 && (
        <Card className="mb-4 border-warning-border bg-warning-bg text-sm">
          <strong>{t("Getting started:")}</strong> {t("add your")}{" "}
          <Link className="underline" href="/equipment/new">{t("equipment")}</Link>, {t("then")}{" "}
          <Link className="underline" href="/ingredients/new">{t("ingredients")}</Link>, {t("then create a")}{" "}
          <Link className="underline" href="/recipes/new">{t("recipe")}</Link> {t("and press Brew.")}
        </Card>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.href} href={s.href}>
            <Card className="hover:bg-muted/50">
              <div className="text-2xl font-bold tabular-nums">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardTitle action={<Link className="text-sm underline" href="/brews">{t("All brews")}</Link>}>{t("Recent brews")}</CardTitle>
          {recent.length === 0 ? <Empty>{t("No brews yet.")}</Empty> : <BrewList brews={recent} />}
        </Card>
        <Card>
          <CardTitle action={<Link className="text-sm underline" href="/lessons">{t("All")}</Link>}>{t("Latest lessons")}</CardTitle>
          {lessons.length === 0 ? (
            <Empty>{t("Lessons you log will show up here.")}</Empty>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {lessons.map((l) => (
                <li key={l.id}>💡 {l.text}</li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
