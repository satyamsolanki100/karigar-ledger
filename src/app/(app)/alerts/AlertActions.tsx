"use client";

import { useActionState, useState } from "react";
import { reviewAlertAction, type ReviewState } from "./actions";
import { btnPrimary, btnSecondary, FormError, inputClass } from "@/components/ui";

export function AlertActions({ alertId }: { alertId: string }) {
  const [state, action, pending] = useActionState<ReviewState, FormData>(reviewAlertAction, {});
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${btnSecondary} px-2.5 py-1.5 text-xs`}>
        Review
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-2 sm:min-w-72">
      <input type="hidden" name="alertId" value={alertId} />
      <input name="note" placeholder="What you found (optional)" maxLength={300} className={`${inputClass} text-xs`} />
      <div className="flex gap-2">
        <button type="submit" name="outcome" value="REVIEWED" disabled={pending} className={`${btnPrimary} px-2.5 py-1.5 text-xs`}>
          Mark reviewed
        </button>
        <button type="submit" name="outcome" value="DISMISSED" disabled={pending} className={`${btnSecondary} px-2.5 py-1.5 text-xs`}>
          Dismiss
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-ink-soft hover:underline">
          Cancel
        </button>
      </div>
      <FormError message={state.error} />
    </form>
  );
}
