import Link from "next/link";
import { BrewList } from "@/components/brew-list";
import { ButtonLink, Card, CardTitle, Empty, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";

export default async function Dashboard() {
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
    { label: "Total brews", value: total, href: "/brews" },
    { label: "Completed", value: completed, href: "/brews?status=COMPLETED" },
    { label: "Fermenting", value: fermenting, href: "/brews?status=FERMENTING" },
    { label: "Recipes", value: recipes, href: "/recipes" },
  ];

  return (
    <>
      <PageHeader title="🍺 Brewing Journal" actions={<ButtonLink href="/brews/new">+ New brew</ButtonLink>} />

      {ingredients === 0 && (
        <Card className="mb-4 border-warning-border bg-warning-bg text-sm">
          <strong>Getting started:</strong> add your{" "}
          <Link className="underline" href="/equipment/new">equipment</Link>, then{" "}
          <Link className="underline" href="/ingredients/new">ingredients</Link>, then create a{" "}
          <Link className="underline" href="/recipes/new">recipe</Link> and press Brew.
        </Card>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="hover:bg-muted/50">
              <div className="text-2xl font-bold tabular-nums">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardTitle action={<Link className="text-sm underline" href="/brews">All brews</Link>}>Recent brews</CardTitle>
          {recent.length === 0 ? <Empty>No brews yet.</Empty> : <BrewList brews={recent} />}
        </Card>
        <Card>
          <CardTitle action={<Link className="text-sm underline" href="/lessons">All</Link>}>Latest lessons</CardTitle>
          {lessons.length === 0 ? (
            <Empty>Lessons you log will show up here.</Empty>
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
