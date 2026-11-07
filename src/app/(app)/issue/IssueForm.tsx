"use client";

import { useActionState, useMemo, useState } from "react";
import { recordIssueAction, type IssueState } from "./actions";
import { fineWeight, parsePurityInput, parseWeightInput } from "@/lib/gold/fine-gold";
import { btnPrimary, Card, Field, FormError, Grams, inputClass, numInputClass } from "@/components/ui";
import { ScalePhotoCapture, type ConfirmedReading } from "@/components/ScalePhotoCapture";

type Karigar = { id: string; code: string; name: string; balance: string };
type Category = { id: string; name: string };
type OpenJob = { id: string; karigarId: string; jobNumber: string; label: string };

const PURITY_PRESETS = [
  { label: "22K", value: "91.60" },
  { label: "18K", value: "75.00" },
  { label: "24K", value: "99.50" },
];

export function IssueForm({
  preselectedKarigarId,
  karigars,
  categories,
  openJobs,
}: {
  preselectedKarigarId?: string;
  karigars: Karigar[];
  categories: Category[];
  openJobs: OpenJob[];
}) {
  const [state, action, pending] = useActionState<IssueState, FormData>(recordIssueAction, {});
  const [karigarId, setKarigarId] = useState(preselectedKarigarId ?? "");
  const [jobMode, setJobMode] = useState<"new" | "existing">("new");
  const [gross, setGross] = useState("");
  const [purity, setPurity] = useState("91.60");
  const [reading, setReading] = useState<ConfirmedReading | null>(null);

  const karigar = karigars.find((k) => k.id === karigarId);
  const jobsForKarigar = openJobs.filter((j) => j.karigarId === karigarId);
  const grossValue = parseWeightInput(gross);
  const purityValue = parsePurityInput(purity);
  const fine = useMemo(() => (grossValue && purityValue ? fineWeight(grossValue, purityValue) : null), [grossValue, purityValue]);

  const readingWeight = reading?.weight ?? null;
  const weightMismatch = Boolean(readingWeight && grossValue && !grossValue.equals(readingWeight));
  const purityMismatch = Boolean(reading?.purity && purityValue && !purityValue.equals(reading.purity));
  const blocked = weightMismatch || purityMismatch;

  function applyReading(r: ConfirmedReading | null) {
    setReading(r);
    if (r?.weight) setGross(r.weight);
    if (r?.purity) setPurity(r.purity);
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="readingId" value={reading?.id ?? ""} />

      <Card className="space-y-4 p-5">
        <Field label="Karigar" htmlFor="karigarId">
          <select
            id="karigarId"
            name="karigarId"
            required
            value={karigarId}
            onChange={(e) => {
              setKarigarId(e.target.value);
              setJobMode("new");
            }}
            className={inputClass}
          >
            <option value="">Choose…</option>
            {karigars.map((k) => (
              <option key={k.id} value={k.id}>
                {k.code} · {k.name}
              </option>
            ))}
          </select>
        </Field>
        {karigar ? (
          <p className="text-sm text-ink-soft">
            Holding now <Grams value={karigar.balance} tone="gold" />
          </p>
        ) : null}

        <fieldset>
          <legend className="text-sm font-medium">Job</legend>
          <div className="mt-1.5 flex gap-2">
            {(["new", "existing"] as const).map((mode) => (
              <label
                key={mode}
                className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm ${
                  jobMode === mode ? "border-ink bg-ink text-white" : "border-line-strong text-ink-soft"
                } ${mode === "existing" && jobsForKarigar.length === 0 ? "opacity-50" : ""}`}
              >
                <input
                  type="radio"
                  name="jobMode"
                  value={mode}
                  checked={jobMode === mode}
                  disabled={mode === "existing" && jobsForKarigar.length === 0}
                  onChange={() => setJobMode(mode)}
                  className="sr-only"
                />
                {mode === "new" ? "New job" : `Add to open job (${jobsForKarigar.length})`}
              </label>
            ))}
          </div>
        </fieldset>

        {jobMode === "new" ? (
          <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
            <Field label="Item category" htmlFor="categoryId" hint="Sets the agreed wastage">
              <select id="categoryId" name="categoryId" required className={inputClass} defaultValue="">
                <option value="" disabled>
                  Choose…
                </option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Description" htmlFor="description" hint="What the karigar is making">
              <input id="description" name="description" placeholder="Temple necklace, 22K" maxLength={120} className={inputClass} />
            </Field>
          </div>
        ) : (
          <Field label="Open job" htmlFor="jobId">
            <select id="jobId" name="jobId" required className={inputClass} defaultValue="">
              <option value="" disabled>
                Choose…
              </option>
              {jobsForKarigar.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.label}
                </option>
              ))}
            </select>
          </Field>
        )}
      </Card>

      <Card className="p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <ScalePhotoCapture kind="scale" reading={reading} onReading={applyReading} />
          <div className="space-y-4">
            <Field
              label="Gross weight"
              htmlFor="grossWeight"
              hint="Grams, 3 decimals"
              error={weightMismatch ? `Photo reads ${readingWeight}. Fix the typed value or retake.` : undefined}
            >
              <div className="relative">
                <input
                  id="grossWeight"
                  name="grossWeight"
                  value={gross}
                  onChange={(e) => setGross(e.target.value)}
                  inputMode="decimal"
                  placeholder="0.000"
                  required
                  aria-invalid={weightMismatch}
                  className={`${numInputClass} pr-8 text-lg ${weightMismatch ? "border-bad" : ""}`}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-ink-faint">g</span>
              </div>
            </Field>
            <Field
              label="Purity"
              htmlFor="purityPct"
              error={purityMismatch ? `Photo reads ${reading?.purity} %. Fix the typed value or retake.` : undefined}
            >
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    id="purityPct"
                    name="purityPct"
                    value={purity}
                    onChange={(e) => setPurity(e.target.value)}
                    inputMode="decimal"
                    required
                    aria-invalid={purityMismatch}
                    className={`${numInputClass} pr-8 ${purityMismatch ? "border-bad" : ""}`}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-ink-faint">%</span>
                </div>
                {PURITY_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPurity(p.value)}
                    className={`rounded-md border px-2.5 text-xs ${
                      purity === p.value ? "border-ink bg-ink text-white" : "border-line-strong text-ink-soft"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </Field>
            <div className="rounded-md bg-gold-soft px-4 py-3">
              <p className="text-xs font-medium text-gold">Fine gold to issue</p>
              <div className="mt-0.5">{fine ? <Grams value={fine} size="xl" tone="gold" /> : <span className="num text-2xl text-ink-faint">0.000</span>}</div>
              {karigar && fine ? (
                <p className="mt-1 text-xs text-ink-soft">
                  Balance after: <Grams value={fine.plus(karigar.balance)} />
                </p>
              ) : null}
            </div>
          </div>
        </div>
        <div className="mt-4">
          <Field label="Note" htmlFor="note" hint="Optional">
            <input id="note" name="note" maxLength={200} className={inputClass} />
          </Field>
        </div>
      </Card>

      <FormError message={state.error} />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending || blocked || !fine} className={btnPrimary}>
          {pending ? "Saving…" : "Save and print slip"}
        </button>
        {blocked ? <span className="text-sm text-bad">Typed value differs from the photo reading.</span> : null}
      </div>
    </form>
  );
}
