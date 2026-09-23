"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui";
import { useI18n } from "@/lib/i18n/client";

export function PrintButton() {
  const { t } = useI18n();
  return (
    <Button type="button" onClick={() => window.print()} className="no-print">
      <Printer className="size-4" /> {t("Print / Save as PDF")}
    </Button>
  );
}
