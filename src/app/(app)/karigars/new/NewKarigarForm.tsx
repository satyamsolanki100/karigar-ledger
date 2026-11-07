"use client";

import { useActionState } from "react";
import { createKarigar, type ActionState } from "../actions";
import { btnPrimary, Card, Field, FormError, inputClass, numInputClass } from "@/components/ui";

type Category = { id: string; name: string; defaultWastagePct: string };

export function NewKarigarForm({ suggestedCode, categories }: { suggestedCode: string; categories: Category[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createKarigar, {});

  return (
    <form action={action} className="space-y-4">
      <Card className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Code" htmlFor="code" hint="Printed on every slip">
            <input id="code" name="code" defaultValue={suggestedCode} required className={inputClass} />
          </Field>
          <Field label="Phone" htmlFor="phone" hint="Optional">
            <input id="phone" name="phone" inputMode="tel" placeholder="+91 98430 00000" className={inputClass} />
          </Field>
        </div>
        <Field label="Name" htmlFor="name">
          <input id="name" name="name" required minLength={2} className={inputClass} />
        </Field>
      </Card>

      <Card>
        <div className="border-b border-line px-5 py-3">
          <h2 className="text-sm font-semibold">Agreed wastage</h2>
          <p className="mt-0.5 text-xs text-ink-soft">Percent of issued fine gold allowed as loss, per item category.</p>
        </div>
        <div className="divide-y divide-line">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-4 px-5 py-2.5">
              <label htmlFor={`allowance:${c.id}`} className="text-sm">
                {c.name}
              </label>
              <div className="flex items-center gap-2">
                <input
                  id={`allowance:${c.id}`}
                  name={`allowance:${c.id}`}
                  defaultValue={c.defaultWastagePct}
                  inputMode="decimal"
                  pattern="\d{1,2}(\.\d{1,2})?"
                  required
                  className={`${numInputClass} w-24`}
                />
                <span className="text-sm text-ink-faint">%</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <FormError message={state.error} />
      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? "Saving…" : "Save karigar"}
      </button>
    </form>
  );
}
