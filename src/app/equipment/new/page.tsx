import { Card, PageHeader } from "@/components/ui";
import { createEquipment } from "../actions";
import { EquipmentForm } from "../equipment-form";

export const metadata = { title: "New equipment profile" };

export default function NewEquipmentPage() {
  return (
    <>
      <PageHeader title="New equipment profile" />
      <Card>
        <EquipmentForm action={createEquipment} />
      </Card>
    </>
  );
}
