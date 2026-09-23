import { ActionForm } from "@/components/action-form";
import { Button, ButtonLink, Field, Input } from "@/components/ui";
import type { ActionState } from "@/lib/form";
import type { EquipmentProfile } from "@/generated/prisma/client";

export function EquipmentForm({
  action,
  profile: p,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  profile?: EquipmentProfile;
}) {
  return (
    <ActionForm action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Name" className="sm:col-span-2">
        <Input name="name" required defaultValue={p?.name} placeholder="Home 3-Vessel" />
      </Field>
      <Field label="Default batch size (L)">
        <Input name="batchSize" type="number" step="0.1" min="0" required defaultValue={p?.batchSize ?? 20} />
      </Field>
      <Field label="Brewhouse efficiency (%)">
        <Input name="efficiency" type="number" step="0.1" min="0" max="100" required defaultValue={p?.efficiency ?? 72} />
      </Field>
      <Field label="Boil-off rate (L/hr)">
        <Input name="boilOffRate" type="number" step="0.1" min="0" required defaultValue={p?.boilOffRate ?? 2.5} />
      </Field>
      <Field label="Mash tun deadspace (L)">
        <Input name="mashTunDeadspace" type="number" step="0.1" min="0" defaultValue={p?.mashTunDeadspace ?? 0.5} />
      </Field>
      <Field label="Trub / chiller loss (L)">
        <Input name="trubLoss" type="number" step="0.1" min="0" defaultValue={p?.trubLoss ?? 1} />
      </Field>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit">Save</Button>
        <ButtonLink href="/equipment" variant="secondary">
          Cancel
        </ButtonLink>
      </div>
    </ActionForm>
  );
}
