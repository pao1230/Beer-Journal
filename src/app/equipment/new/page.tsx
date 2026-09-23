import { Card, PageHeader } from "@/components/ui";
import { getI18n } from "@/lib/i18n/server";
import { createEquipment } from "../actions";
import { EquipmentForm } from "../equipment-form";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("New equipment profile") };
}

export default async function NewEquipmentPage() {
  const { t } = await getI18n();
  return (
    <>
      <PageHeader title={t("New equipment profile")} />
      <Card>
        <EquipmentForm action={createEquipment} />
      </Card>
    </>
  );
}
