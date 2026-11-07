"use client";

import { useActionState, useState } from "react";
import { updateAllowance, type ActionState } from "../actions";
import { btnSecondary, FormError, numInputClass } from "@/components/ui";

type Row = { categoryId: string; categoryName: string; allowedWastagePct: string };

function AllowanceRow({ karigarId, row, editable }: { karigarId: string; row: Row; editable: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateAllowance, {});
  const [value, setValue] = useState(row.allowedWastagePct);
  const dirty = value !== row.allowedWastagePct;

  return (
    <form action={action} className="flex items-center justify-between gap-3 px-4 py-2.5">
      <input type="hidden" name="karigarId" value={karigarId} />
      <input type="hidden" name="categoryId" value={row.categoryId} />
      <span className="text-sm">{row.categoryName}</span>
      <div className="flex items-center gap-2">
        {state.error ? <FormError message={state.error} /> : null}
        {editable ? (
          <>
            <input
              name="allowedWastagePct"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              inputMode="decimal"
              pattern="\d{1,2}(\.\d{1,2})?"
              aria-label={`Agreed wastage for ${row.categoryName}`}
              className={`${numInputClass} w-24`}
            />
            <span className="text-sm text-ink-faint">%</span>
            <button type="submit" disabled={!dirty || pending} className={`${btnSecondary} px-2.5 py-1.5 text-xs`}>
              {pending ? "Saving…" : state.ok && !dirty ? "Saved" : "Save"}
            </button>
          </>
        ) : (
          <span className="num text-sm">{row.allowedWastagePct} %</span>
        )}
      </div>
    </form>
  );
}

export function AllowanceEditor({ karigarId, rows, editable }: { karigarId: string; rows: Row[]; editable: boolean }) {
  return (
    <div className="divide-y divide-line">
      {rows.map((row) => (
        <AllowanceRow key={row.categoryId} karigarId={karigarId} row={row} editable={editable} />
      ))}
    </div>
  );
}
