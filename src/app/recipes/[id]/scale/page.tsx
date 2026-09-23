import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Button, ButtonLink, Card, CardTitle, Field, Input, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { fmtNum, preBoilVolume, roundAmount, scaleWater, STAGES } from "@/lib/brewing";
import { saveScaledRecipe } from "../../actions";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Scale recipe") };
}

export default async function ScaleRecipePage(props: PageProps<"/recipes/[id]/scale">) {
  const { t } = await getI18n();
  const id = Number((await props.params).id);
  const sp = await props.searchParams;
  const version = Number.isInteger(id)
    ? await db.recipeVersion.findFirst({
        where: { recipeId: id, ...(typeof sp.v === "string" && { version: Number(sp.v) || undefined }) },
        orderBy: { version: "desc" },
        include: { recipe: true, equipmentProfile: true, ingredients: { orderBy: { sortOrder: "asc" } } },
      })
    : null;
  if (!version) notFound();
  const latest = await db.recipeVersion.aggregate({ where: { recipeId: id }, _max: { version: true } });
  const nextVersion = (latest._max.version ?? version.version) + 1;

  const size = Number(sp.size);
  const valid = Number.isFinite(size) && size > 0 && size <= 2000;
  const ratio = valid ? size / version.batchSize : 1;
  const water = scaleWater(version, version.equipmentProfile, ratio);
  const preBoil = (batch: number) => preBoilVolume(batch, version.boilTime, version.equipmentProfile);

  return (
    <>
      <PageHeader
        title={t("Scale {name}", { name: version.recipe.name })}
        subtitle={t("From v{v} · {size} L. Gravity and bitterness targets stay the same; hop timing and mash temperatures are unchanged.", { v: version.version, size: version.batchSize })}
      />

      <Card className="mb-4">
        <form className="flex flex-wrap items-end gap-2">
          {typeof sp.v === "string" && <input type="hidden" name="v" value={sp.v} />}
          <Field label={t("New batch size (L)")}>
            <Input name="size" type="number" step="0.1" min="0.1" max="2000" required defaultValue={valid ? size : ""} className="w-40" />
          </Field>
          <Button type="submit" variant="secondary">
            {t("Preview")}
          </Button>
          {[0.5, 2].map((f) => (
            <ButtonLink key={f} variant="ghost" href={`/recipes/${id}/scale?size=${version.batchSize * f}${typeof sp.v === "string" ? `&v=${sp.v}` : ""}`}>
              ×{f} ({version.batchSize * f} L)
            </ButtonLink>
          ))}
        </form>
      </Card>

      {valid && (
        <>
          <Card className="mb-4">
            <CardTitle>
              {t("Preview")} · ×{Number(ratio.toFixed(3))}
            </CardTitle>
            <div className="overflow-x-auto">
              <table className="w-full text-sm tabular-nums">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-3 font-medium">{t("Ingredient")}</th>
                    <th className="py-1 pr-3 font-medium">{t("Stage")}</th>
                    <th className="py-1 pr-3 text-right font-medium">{version.batchSize} L</th>
                    <th className="py-1 text-right font-medium">{size} L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {version.ingredients.map((i) => (
                    <tr key={i.id}>
                      <td className="py-1.5 pr-3">{i.nameSnapshot}</td>
                      <td className="py-1.5 pr-3 text-muted-foreground">
                        {t(STAGES.find((s) => s.value === i.stage)?.label ?? i.stage)}
                        {i.additionTime != null &&
                          ` · ${i.stage === "DRY_HOP" ? t("day {n}", { n: i.additionTime }) : t("{n} min", { n: i.additionTime })}`}
                      </td>
                      <td className="py-1.5 pr-3 text-right text-muted-foreground">{fmtNum(i.amount, i.unit)}</td>
                      <td className="py-1.5 text-right font-semibold">{fmtNum(roundAmount(i.amount * ratio, i.unit), i.unit)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="py-1.5 pr-3">{t("Mash water")}</td>
                    <td />
                    <td className="py-1.5 pr-3 text-right text-muted-foreground">{fmtNum(version.mashWaterL, "L")}</td>
                    <td className="py-1.5 text-right font-semibold">{fmtNum(water.mashWaterL, "L")}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 pr-3">{t("Sparge water")}</td>
                    <td />
                    <td className="py-1.5 pr-3 text-right text-muted-foreground">{fmtNum(version.spargeWaterL, "L")}</td>
                    <td className="py-1.5 text-right font-semibold">{fmtNum(water.spargeWaterL, "L")}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 pr-3">{t("Est. pre-boil volume")}</td>
                    <td />
                    <td className="py-1.5 pr-3 text-right text-muted-foreground">{fmtNum(preBoil(version.batchSize) && Number(preBoil(version.batchSize)!.toFixed(1)), "L")}</td>
                    <td className="py-1.5 text-right font-semibold">{fmtNum(preBoil(size) && Number(preBoil(size)!.toFixed(1)), "L")}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {version.equipmentProfile
                ? t("Boil-off, trub loss and deadspace from “{name}” stay fixed, so sparge water doesn't scale 1:1.", { name: version.equipmentProfile.name })
                : t("No equipment profile on this recipe, so water is scaled 1:1.")}{" "}
              {t("Yeast packs round up. Check hop utilisation if you change kettle size a lot.")}
            </p>
          </Card>

          <ActionForm action={saveScaledRecipe.bind(null, version.id)} className="flex flex-wrap gap-2">
            <input type="hidden" name="size" value={size} />
            <Button type="submit" name="mode" value="copy">
              {t("Save as new recipe")}
            </Button>
            <Button type="submit" name="mode" value="version" variant="secondary">
              {t("Save as v{n} of this recipe", { n: nextVersion })}
            </Button>
          </ActionForm>
        </>
      )}
    </>
  );
}
