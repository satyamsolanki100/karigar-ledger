"use client";

import { useActionState, useMemo, useState } from "react";
import Decimal from "decimal.js";
import { recordReceiptAction, type ReceiptState } from "./actions";
import { fineWeight, parsePurityInput, parseWeightInput, settleJob } from "@/lib/gold/fine-gold";
import { btnPrimary, Card, Field, FormError, Grams, inputClass, numInputClass } from "@/components/ui";
import { ScalePhotoCapture, type ConfirmedReading } from "@/components/ScalePhotoCapture";
import { fmtDate } from "@/lib/format";

export type OpenJobOption = {
  id: string;
  karigarId: string;
  karigarLabel: string;
  jobNumber: string;
  description: string;
  allowedPct: string;
  issuedFine: string;
  receivedFine: string;
  issuePurity: string | null;
  openedAt: string;
};

const KINDS = [
  { value: "RECEIPT_PIECE", label: "Finished piece" },
  { value: "RECEIPT_SCRAP", label: "Scrap" },
  { value: "RECEIPT_FILINGS", label: "Filings" },
] as const;

export function ReceiptForm({
  jobs,
  preselectedKarigarId,
  preselectedJobId,
}: {
  jobs: OpenJobOption[];
  preselectedKarigarId?: string;
  preselectedJobId?: string;
}) {
  const [state, action, pending] = useActionState<ReceiptState, FormData>(recordReceiptAction, {});
  const karigars = useMemo(() => {
    const seen = new Map<string, string>();
    for (const j of jobs) seen.set(j.karigarId, j.karigarLabel);
    return [...seen.entries()].map(([id, label]) => ({ id, label }));
  }, [jobs]);

  const initialJob = jobs.find((j) => j.id === preselectedJobId);
  const [karigarId, setKarigarId] = useState(initialJob?.karigarId ?? preselectedKarigarId ?? "");
  const [jobId, setJobId] = useState(initialJob?.id ?? "");
  const [kind, setKind] = useState<(typeof KINDS)[number]["value"]>("RECEIPT_PIECE");
  const [gross, setGross] = useState("");
  const [purity, setPurity] = useState(initialJob?.issuePurity ?? "91.60");
  const [closeJob, setCloseJob] = useState(false);
  const [reading, setReading] = useState<ConfirmedReading | null>(null);

  const job = jobs.find((j) => j.id === jobId);
  const jobsForKarigar = jobs.filter((j) => j.karigarId === karigarId);
  const grossValue = parseWeightInput(gross);
  const purityValue = parsePurityInput(purity);
  const fine = grossValue && purityValue ? fineWeight(grossValue, purityValue) : null;

  const preview = job
    ? settleJob({ issuedFine: job.issuedFine, receivedFine: new Decimal(job.receivedFine).plus(fine ?? 0), allowedPct: job.allowedPct })
    : null;

  const weightMismatch = Boolean(reading?.weight && grossValue && !grossValue.equals(reading.weight));
  const purityMismatch = Boolean(reading?.purity && purityValue && !purityValue.equals(reading.purity));
  const blocked = weightMismatch || purityMismatch;

  function applyReading(r: ConfirmedReading | null) {
    setReading(r);
    if (r?.weight) setGross(r.weight);
    if (r?.purity) setPurity(r.purity);
  }

  function chooseJob(id: string) {
    setJobId(id);
    const next = jobs.find((j) => j.id === id);
    if (next?.issuePurity) setPurity(next.issuePurity);
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="readingId" value={reading?.id ?? ""} />

      <Card className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Karigar" htmlFor="karigarPick">
            <select
              id="karigarPick"
              value={karigarId}
              onChange={(e) => {
                setKarigarId(e.target.value);
                setJobId("");
              }}
              className={inputClass}
            >
              <option value="">Choose…</option>
              {karigars.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Open job" htmlFor="jobId" hint={karigarId && jobsForKarigar.length === 0 ? "No open jobs for this karigar" : undefined}>
            <select id="jobId" name="jobId" required value={jobId} onChange={(e) => chooseJob(e.target.value)} className={inputClass} disabled={!karigarId}>
              <option value="">Choose…</option>
              {jobsForKarigar.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.jobNumber} · {j.description}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {job ? (
          <div className="grid grid-cols-3 gap-3 rounded-md bg-paper px-4 py-3 text-sm">
            <div>
              <p className="text-xs text-ink-faint">Issued</p>
              <Grams value={job.issuedFine} tone="gold" />
            </div>
            <div>
              <p className="text-xs text-ink-faint">Back so far</p>
              <Grams value={job.receivedFine} tone="ok" />
            </div>
            <div>
              <p className="text-xs text-ink-faint">Allowed wastage</p>
              <span className="num">{job.allowedPct} %</span>
              <span className="ml-1 text-xs text-ink-faint">since {fmtDate(new Date(job.openedAt))}</span>
            </div>
          </div>
        ) : null}

        <fieldset>
          <legend className="text-sm font-medium">What came back</legend>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {KINDS.map((k) => (
              <label
                key={k.value}
                className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm ${
                  kind === k.value ? "border-ink bg-ink text-white" : "border-line-strong text-ink-soft"
                }`}
              >
                <input type="radio" name="kind" value={k.value} checked={kind === k.value} onChange={() => setKind(k.value)} className="sr-only" />
                {k.label}
              </label>
            ))}
          </div>
        </fieldset>

        {kind === "RECEIPT_PIECE" ? (
          <Field label="HUID" htmlFor="huid" hint="6-character hallmark ID, if already stamped">
            <input id="huid" name="huid" maxLength={6} className={`${inputClass} num uppercase sm:w-48`} placeholder="4K7P2M" />
          </Field>
        ) : null}
      </Card>

      <Card className="p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <ScalePhotoCapture kind="scale" reading={reading} onReading={applyReading} />
          <div className="space-y-4">
            <Field
              label={kind === "RECEIPT_PIECE" ? "Net weight" : "Weight"}
              htmlFor="grossWeight"
              hint="Grams, 3 decimals"
              error={weightMismatch ? `Photo reads ${reading?.weight}. Fix the typed value or retake.` : undefined}
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
              hint={job?.issuePurity ? `Issued at ${job.issuePurity} %` : undefined}
              error={purityMismatch ? `Photo reads ${reading?.purity} %. Fix the typed value or retake.` : undefined}
            >
              <div className="relative sm:w-40">
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
            </Field>
            <div className="rounded-md bg-ok-soft px-4 py-3">
              <p className="text-xs font-medium text-ok">Fine gold coming back</p>
              <div className="mt-0.5">{fine ? <Grams value={fine} size="xl" tone="ok" /> : <span className="num text-2xl text-ink-faint">0.000</span>}</div>
            </div>
          </div>
        </div>

        {preview ? (
          <div className="mt-4 grid grid-cols-2 gap-3 rounded-md border border-line px-4 py-3 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-ink-faint">Still with karigar</p>
              <Grams value={preview.loss} size="lg" />
            </div>
            <div>
              <p className="text-xs text-ink-faint">Allowed</p>
              <Grams value={preview.allowed} />
            </div>
            <div>
              <p className="text-xs text-ink-faint">Loss if closed now</p>
              <span className="num">{preview.actualPct.toFixed(2)} %</span>
              <span className="ml-1 text-xs text-ink-faint">of {preview.allowedPct.toFixed(2)}</span>
            </div>
            <div>
              <p className="text-xs text-ink-faint">Over allowance</p>
              <Grams value={preview.excess} signed tone={preview.overAllowance ? "bad" : "ok"} size="lg" />
            </div>
          </div>
        ) : null}

        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label="Note" htmlFor="note" hint="Optional">
            <input id="note" name="note" maxLength={200} className={inputClass} />
          </Field>
          <label className="flex items-center gap-2 pb-5 text-sm">
            <input type="checkbox" name="closeJob" checked={closeJob} onChange={(e) => setCloseJob(e.target.checked)} className="h-4 w-4 accent-ink" />
            Close the job after this receipt
          </label>
        </div>
        {closeJob && preview?.overAllowance ? (
          <p className="mt-2 text-xs text-warn">
            Closing now settles the job {preview.excess.toFixed(3)} g over allowance. The finance head will see it as an item to review.
          </p>
        ) : null}
      </Card>

      <FormError message={state.error} />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending || blocked || !fine || !jobId} className={btnPrimary}>
          {pending ? "Saving…" : closeJob ? "Save and close job" : "Save and print slip"}
        </button>
        {blocked ? <span className="text-sm text-bad">Typed value differs from the photo reading.</span> : null}
      </div>
    </form>
  );
}
