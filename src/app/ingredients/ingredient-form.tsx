"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Button, ButtonLink, Field, Input, Select, Textarea } from "@/components/ui";
import { DEFAULT_UNIT, INGREDIENT_TYPES, UNITS } from "@/lib/brewing";
import { WATER_SALTS } from "@/lib/calc";
import type { ActionState } from "@/lib/form";
import { useI18n } from "@/lib/i18n/client";
import type { Ingredient } from "@/generated/prisma/client";
import type { IngredientType } from "@/generated/prisma/enums";

export function IngredientForm({
  action,
  ingredient,
  defaultType,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  ingredient?: Ingredient;
  defaultType?: IngredientType;
}) {
  const { t } = useI18n();
  const [type, setType] = useState<IngredientType>(ingredient?.type ?? defaultType ?? "GRAIN");
  const i = ingredient;
  return (
    <ActionForm action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label={t("Type")}>
        <Select name="type" value={type} onChange={(e) => setType(e.target.value as IngredientType)}>
          {INGREDIENT_TYPES.map((x) => (
            <option key={x.value} value={x.value}>
              {t(x.label)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("Name")}>
        <Input name="name" required defaultValue={i?.name} placeholder="Pale Ale Malt" />
      </Field>
      <Field label={t("Brand")}>
        <Input name="brand" defaultValue={i?.brand ?? ""} placeholder="Simpsons" />
      </Field>
      <Field label={t("Supplier")}>
        <Input name="supplier" defaultValue={i?.supplier ?? ""} />
      </Field>

      {type === "GRAIN" && (
        <>
          <Field label={t("Color (°L)")}>
            <Input name="color" type="number" step="0.1" min="0" defaultValue={i?.color ?? ""} />
          </Field>
          <Field label={t("Potential (SG)")} hint={t("Extract potential, e.g. 1.037")}>
            <Input name="potential" type="number" step="0.001" min="1" max="1.1" defaultValue={i?.potential ?? ""} />
          </Field>
        </>
      )}
      {type === "OTHER" && (
        <>
          <Field label={t("Potential (SG)")} hint={t("Only for sugars/lactose that add gravity, e.g. 1.035")}>
            <Input name="potential" type="number" step="0.001" min="1" max="1.1" defaultValue={i?.potential ?? ""} />
          </Field>
          <label className="flex items-center gap-2 self-center text-sm">
            <input type="checkbox" name="unfermentable" defaultChecked={i?.unfermentable ?? false} /> {t("Unfermentable (e.g. lactose) — stays in FG")}
          </label>
        </>
      )}
      {type === "HOP" && (
        <>
          <Field label={t("Alpha acid (%)")}>
            <Input name="alphaAcid" type="number" step="0.1" min="0" max="30" defaultValue={i?.alphaAcid ?? ""} />
          </Field>
          <Field label={t("Form")}>
            <Select name="form" defaultValue={i?.form ?? "Pellet"}>
              <option value="Pellet">{t("Pellet")}</option>
              <option value="Leaf">{t("Leaf")}</option>
              <option value="Cryo">{t("Cryo")}</option>
            </Select>
          </Field>
        </>
      )}
      {type === "YEAST" && (
        <>
          <Field label={t("Attenuation (%)")}>
            <Input name="attenuation" type="number" step="1" min="0" max="100" defaultValue={i?.attenuation ?? ""} />
          </Field>
          <Field label={t("Form")}>
            <Select name="form" defaultValue={i?.form ?? "Dry"}>
              <option value="Dry">{t("Dry")}</option>
              <option value="Liquid">{t("Liquid")}</option>
            </Select>
          </Field>
          <Field label={t("Flocculation")}>
            <Select name="flocculation" defaultValue={i?.flocculation ?? ""}>
              <option value="">–</option>
              <option value="Low">{t("Low")}</option>
              <option value="Medium">{t("Medium")}</option>
              <option value="High">{t("High")}</option>
            </Select>
          </Field>
        </>
      )}

      {type === "WATER" && (
        <Field label={t("Salt")} hint={t("Used to calculate the water profile (ppm)")}>
          <Select name="waterSalt" defaultValue={i?.waterSalt ?? ""}>
            <option value="">{t("– not a brewing salt –")}</option>
            {Object.entries(WATER_SALTS).map(([key, s]) => (
              <option key={key} value={key}>
                {t(s.label)}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label={t("Inventory unit")} hint={t("Stock and cost are tracked in this unit")}>
        <Select name="stockUnit" defaultValue={i?.stockUnit ?? DEFAULT_UNIT[type]} key={type}>
          <option value="">{t("– don't track stock –")}</option>
          {UNITS.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </Select>
      </Field>

      <Field label={t("Notes")} className="sm:col-span-2">
        <Textarea name="notes" defaultValue={i?.notes ?? ""} />
      </Field>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit">{t("Save")}</Button>
        <ButtonLink href="/ingredients" variant="secondary">
          {t("Cancel")}
        </ButtonLink>
      </div>
    </ActionForm>
  );
}
