"use client";

import { startTransition, useActionState, useEffect, useRef, type ReactNode } from "react";
import type { ActionState } from "@/lib/form";
import { cn } from "@/lib/utils";

/**
 * Submits via a transition instead of `<form action>` so React doesn't reset the
 * fields when the server returns a validation error.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  confirm,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  confirm?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (confirm && !window.confirm(confirm)) return;
        const fd = new FormData(e.currentTarget);
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        if (submitter?.name) fd.set(submitter.name, submitter.value);
        startTransition(() => formAction(fd));
      }}
    >
      <fieldset disabled={pending} className={cn("contents", pending && "opacity-70")}>
        {children}
      </fieldset>
      {state.error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
