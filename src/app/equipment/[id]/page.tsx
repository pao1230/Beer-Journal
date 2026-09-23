import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Button, Card, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { deleteEquipment, updateEquipment } from "../actions";
import { EquipmentForm } from "../equipment-form";

export const metadata = { title: "Edit equipment profile" };

export default async function EditEquipmentPage(props: PageProps<"/equipment/[id]">) {
  const id = Number((await props.params).id);
  const profile = Number.isInteger(id) ? await db.equipmentProfile.findUnique({ where: { id } }) : null;
  if (!profile) notFound();
  return (
    <>
      <PageHeader title={`Edit ${profile.name}`} />
      <Card>
        <EquipmentForm action={updateEquipment.bind(null, id)} profile={profile} />
      </Card>
      <Card className="mt-4">
        <ActionForm action={deleteEquipment.bind(null, id)} confirm="Delete this equipment profile? Recipes using it will keep their volumes but lose the link.">
          <Button variant="danger">Delete</Button>
        </ActionForm>
      </Card>
    </>
  );
}
