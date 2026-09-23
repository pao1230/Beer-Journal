"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui";

export function PrintButton() {
  return (
    <Button type="button" onClick={() => window.print()} className="no-print">
      <Printer className="size-4" /> Print / Save as PDF
    </Button>
  );
}
