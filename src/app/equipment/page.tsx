import Link from "next/link";
import { ButtonLink, Card, Empty, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Equipment") };
}

export default async function EquipmentPage() {
  const { t } = await getI18n();
  const profiles = await db.equipmentProfile.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { recipeVersions: true } } },
  });
  return (
    <>
      <PageHeader
        title={t("Equipment profiles")}
        subtitle={t("Boil-off, losses and efficiency for your brew rig. Recipes use this to estimate volumes.")}
        actions={<ButtonLink href="/equipment/new">{t("+ New profile")}</ButtonLink>}
      />
      {profiles.length === 0 ? (
        <Card>
          <Empty>{t("No equipment profiles yet.")}</Empty>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {profiles.map((p) => (
            <Link key={p.id} href={`/equipment/${p.id}`}>
              <Card className="hover:bg-muted/50">
                <div className="font-semibold">{p.name}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {t("{batch} L · {eff}% eff · boil-off {boil} L/hr · deadspace {dead} L · trub {trub} L", {
                    batch: p.batchSize,
                    eff: p.efficiency,
                    boil: p.boilOffRate,
                    dead: p.mashTunDeadspace,
                    trub: p.trubLoss,
                  })}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {t("Used by {n} recipe version(s)", { n: p._count.recipeVersions })}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
