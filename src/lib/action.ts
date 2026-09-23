import { unstable_rethrow } from "next/navigation";
import type { ActionState } from "@/lib/form";
import { getI18n } from "@/lib/i18n/server";
import { UserError } from "@/lib/user-error";

/** Runs a mutation and turns thrown errors into form state; redirects still propagate. */
export async function run(fn: () => Promise<void>): Promise<ActionState> {
  try {
    await fn();
    return { ok: true };
  } catch (e) {
    unstable_rethrow(e);
    const { t } = await getI18n();
    if (e instanceof UserError) {
      // Field names and the like are English keys too.
      const vars = Object.fromEntries(Object.entries(e.vars ?? {}).map(([k, v]) => [k, typeof v === "string" ? t(v) : v]));
      return { error: t(e.key, vars) };
    }
    console.error(e);
    return { error: e instanceof Error ? t(e.message) : t("Something went wrong") };
  }
}
