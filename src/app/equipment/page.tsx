import Link from "next/link";
import { ButtonLink, Card, Empty, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";

export const metadata = { title: "Equipment" };

export default async function EquipmentPage() {
  const profiles = await db.equipmentProfile.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { recipeVersions: true } } },
  });
  return (
    <>
      <PageHeader
        title="Equipment profiles"
        subtitle="Boil-off, losses and efficiency for your brew rig. Recipes use this to estimate volumes."
        actions={<ButtonLink href="/equipment/new">+ New profile</ButtonLink>}
      />
      {profiles.length === 0 ? (
        <Card>
          <Empty>No equipment profiles yet.</Empty>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {profiles.map((p) => (
            <Link key={p.id} href={`/equipment/${p.id}`}>
              <Card className="hover:bg-muted/50">
                <div className="font-semibold">{p.name}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {p.batchSize} L · {p.efficiency}% eff · boil-off {p.boilOffRate} L/hr · deadspace{" "}
                  {p.mashTunDeadspace} L · trub {p.trubLoss} L
                </div>
                <div className="mt-1 text-xs text-muted-foreground">Used by {p._count.recipeVersions} recipe version(s)</div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
