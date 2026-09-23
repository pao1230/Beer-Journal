"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Button, ButtonLink, Field, Input, Select, Textarea } from "@/components/ui";
import { INGREDIENT_TYPES } from "@/lib/brewing";
import type { ActionState } from "@/lib/form";
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
  const [type, setType] = useState<IngredientType>(ingredient?.type ?? defaultType ?? "GRAIN");
  const i = ingredient;
  return (
    <ActionForm action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Type">
        <Select name="type" value={type} onChange={(e) => setType(e.target.value as IngredientType)}>
          {INGREDIENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Name">
        <Input name="name" required defaultValue={i?.name} placeholder="Pale Ale Malt" />
      </Field>
      <Field label="Brand">
        <Input name="brand" defaultValue={i?.brand ?? ""} placeholder="Simpsons" />
      </Field>
      <Field label="Supplier">
        <Input name="supplier" defaultValue={i?.supplier ?? ""} />
      </Field>

      {type === "GRAIN" && (
        <>
          <Field label="Color (°L)">
            <Input name="color" type="number" step="0.1" min="0" defaultValue={i?.color ?? ""} />
          </Field>
          <Field label="Potential (SG)" hint="Extract potential, e.g. 1.037">
            <Input name="potential" type="number" step="0.001" min="1" max="1.1" defaultValue={i?.potential ?? ""} />
          </Field>
        </>
      )}
      {type === "HOP" && (
        <>
          <Field label="Alpha acid (%)">
            <Input name="alphaAcid" type="number" step="0.1" min="0" max="30" defaultValue={i?.alphaAcid ?? ""} />
          </Field>
          <Field label="Form">
            <Select name="form" defaultValue={i?.form ?? "Pellet"}>
              <option>Pellet</option>
              <option>Leaf</option>
              <option>Cryo</option>
            </Select>
          </Field>
        </>
      )}
      {type === "YEAST" && (
        <>
          <Field label="Attenuation (%)">
            <Input name="attenuation" type="number" step="1" min="0" max="100" defaultValue={i?.attenuation ?? ""} />
          </Field>
          <Field label="Form">
            <Select name="form" defaultValue={i?.form ?? "Dry"}>
              <option>Dry</option>
              <option>Liquid</option>
            </Select>
          </Field>
          <Field label="Flocculation">
            <Select name="flocculation" defaultValue={i?.flocculation ?? ""}>
              <option value="">–</option>
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </Select>
          </Field>
        </>
      )}

      <Field label="Notes" className="sm:col-span-2">
        <Textarea name="notes" defaultValue={i?.notes ?? ""} />
      </Field>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit">Save</Button>
        <ButtonLink href="/ingredients" variant="secondary">
          Cancel
        </ButtonLink>
      </div>
    </ActionForm>
  );
}
