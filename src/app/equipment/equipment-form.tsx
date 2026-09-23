import { ActionForm } from "@/components/action-form";
import { Button, ButtonLink, Field, Input } from "@/components/ui";
import { getI18n } from "@/lib/i18n/server";
import type { ActionState } from "@/lib/form";
import type { EquipmentProfile } from "@/generated/prisma/client";

export async function EquipmentForm({
  action,
  profile: p,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  profile?: EquipmentProfile;
}) {
  const { t } = await getI18n();
  return (
    <ActionForm action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label={t("Name")} className="sm:col-span-2">
        <Input name="name" required defaultValue={p?.name} placeholder="Home 3-Vessel" />
      </Field>
      <Field label={t("Default batch size (L)")}>
        <Input name="batchSize" type="number" step="0.1" min="0" required defaultValue={p?.batchSize ?? 20} />
      </Field>
      <Field label={t("Brewhouse efficiency (%)")}>
        <Input name="efficiency" type="number" step="0.1" min="0" max="100" required defaultValue={p?.efficiency ?? 72} />
      </Field>
      <Field label={t("Boil-off rate (L/hr)")}>
        <Input name="boilOffRate" type="number" step="0.1" min="0" required defaultValue={p?.boilOffRate ?? 2.5} />
      </Field>
      <Field label={t("Mash tun deadspace (L)")}>
        <Input name="mashTunDeadspace" type="number" step="0.1" min="0" defaultValue={p?.mashTunDeadspace ?? 0.5} />
      </Field>
      <Field label={t("Trub / chiller loss (L)")}>
        <Input name="trubLoss" type="number" step="0.1" min="0" defaultValue={p?.trubLoss ?? 1} />
      </Field>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit">{t("Save")}</Button>
        <ButtonLink href="/equipment" variant="secondary">
          {t("Cancel")}
        </ButtonLink>
      </div>
    </ActionForm>
  );
}
