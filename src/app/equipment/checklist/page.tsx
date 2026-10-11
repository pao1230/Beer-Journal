import { PageHeader } from "@/components/ui";
import { getI18n } from "@/lib/i18n/server";
import { loadChecklist } from "./actions";
import { Checklist } from "./checklist";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Equipment checklist") };
}

export default async function ChecklistPage(props: PageProps<"/equipment/checklist">) {
  const { t } = await getI18n();
  const { tab } = await props.searchParams;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={t("Equipment checklist")}
        subtitle={t("Tap an item to cycle: have it ✓, missing !, not used this batch –.")}
      />
      <Checklist initial={await loadChecklist()} initialTab={tab === "manage" ? "manage" : "check"} />
    </div>
  );
}
