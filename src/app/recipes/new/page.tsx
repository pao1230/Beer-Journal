import { PageHeader } from "@/components/ui";
import { createRecipe } from "../actions";
import { editorOptions } from "../editor-data";
import { RecipeEditor } from "../recipe-editor";

export const metadata = { title: "New recipe" };

export default async function NewRecipePage() {
  const { ingredients, equipment } = await editorOptions();
  const eq = equipment[0];
  return (
    <>
      <PageHeader title="New recipe" />
      <RecipeEditor
        action={createRecipe}
        ingredients={ingredients}
        equipment={equipment}
        cancelHref="/recipes"
        initial={{
          name: "",
          style: "",
          notes: "",
          equipmentProfileId: eq?.id ?? null,
          batchSize: eq?.batchSize ?? 20,
          boilTime: 60,
          targetOg: null,
          targetFg: null,
          targetIbu: null,
          targetSrm: null,
          targetCarbonation: null,
          waterSource: "",
          mashWaterL: null,
          spargeWaterL: null,
          targetMashPh: null,
          ingredients: [],
          mashSteps: [
            { key: "m1", name: "Saccharification", temperature: "67", timeMin: "60" },
            { key: "m2", name: "Mash out", temperature: "75", timeMin: "10" },
          ],
        }}
      />
    </>
  );
}
