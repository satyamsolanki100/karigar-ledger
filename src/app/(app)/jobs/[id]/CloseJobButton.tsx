"use client";

import { useActionState } from "react";
import { closeJobAction, type CloseJobState } from "../actions";
import { btnSecondary, FormError } from "@/components/ui";

export function CloseJobButton({ jobId, overAllowance }: { jobId: string; overAllowance: boolean }) {
  const [state, action, pending] = useActionState<CloseJobState, FormData>(closeJobAction, {});
  return (
    <form action={action} className="flex flex-col items-end gap-2">
      <input type="hidden" name="jobId" value={jobId} />
      <button type="submit" disabled={pending} className={btnSecondary}>
        {pending ? "Closing…" : "Close job and settle"}
      </button>
      {overAllowance ? <p className="text-xs text-warn">Closing now records a loss over allowance for review.</p> : null}
      <FormError message={state.error} />
    </form>
  );
}
