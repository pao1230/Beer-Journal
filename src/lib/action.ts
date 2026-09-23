import { unstable_rethrow } from "next/navigation";
import type { ActionState } from "@/lib/form";

/** Runs a mutation and turns thrown errors into form state; redirects still propagate. */
export async function run(fn: () => Promise<void>): Promise<ActionState> {
  try {
    await fn();
    return { ok: true };
  } catch (e) {
    unstable_rethrow(e);
    console.error(e);
    return { error: e instanceof Error ? e.message : "Something went wrong" };
  }
}
