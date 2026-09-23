import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Button, Card, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { deleteEquipment, updateEquipment } from "../actions";
import { EquipmentForm } from "../equipment-form";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Edit equipment profile") };
}

export default async function EditEquipmentPage(props: PageProps<"/equipment/[id]">) {
  const { t } = await getI18n();
  const id = Number((await props.params).id);
  const profile = Number.isInteger(id) ? await db.equipmentProfile.findUnique({ where: { id } }) : null;
  if (!profile) notFound();
  return (
    <>
      <PageHeader title={t("Edit {name}", { name: profile.name })} />
      <Card>
        <EquipmentForm action={updateEquipment.bind(null, id)} profile={profile} />
      </Card>
      <Card className="mt-4">
        <ActionForm
          action={deleteEquipment.bind(null, id)}
          confirm={t("Delete this equipment profile? Recipes using it will keep their volumes but lose the link.")}
        >
          <Button variant="danger">{t("Delete")}</Button>
        </ActionForm>
      </Card>
    </>
  );
}
