import Decimal from "decimal.js";
import { grams, percent } from "./fine-gold";

export type SettledJobSample = {
  jobId: string;
  closedAt: Date;
  actualPct: Decimal.Value;
  allowedPct: Decimal.Value;
  excessGrams: Decimal.Value;
};

export type DriftPolicy = {
  /** Jobs needed before a karigar has a history worth comparing against. */
  minHistoryJobs: number;
  /** Percentage points above the karigar's own usual gap that count as drift. */
  driftPoints: Decimal.Value;
};

export const DEFAULT_DRIFT_POLICY: DriftPolicy = { minHistoryJobs: 3, driftPoints: "0.50" };

export type LossFinding =
  | { kind: "OVER_ALLOWANCE"; actualPct: Decimal; allowedPct: Decimal; excessGrams: Decimal }
  | {
      kind: "DRIFT";
      actualPct: Decimal;
      allowedPct: Decimal;
      /** The karigar's usual gap to allowance in points; negative means usually under. */
      baselinePct: Decimal;
      excessGrams: Decimal;
    };

export function median(values: Decimal.Value[]): Decimal {
  const sorted = values.map((v) => new Decimal(v)).sort((a, b) => a.comparedTo(b));
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return sorted[mid - 1].plus(sorted[mid]).div(2);
}

/** Loss relative to what was agreed for that job, so a ring job and a necklace job compare fairly. */
export function gapToAllowance(sample: Pick<SettledJobSample, "actualPct" | "allowedPct">): Decimal {
  return percent(new Decimal(sample.actualPct).minus(sample.allowedPct));
}

/**
 * Brief: "flags karigars whose loss drifts from their own history". Two findings can come
 * out of one job: over the agreed allowance, and drifting above the karigar's own median
 * gap to allowance, which catches a slow rise long before it crosses the allowance.
 */
export function evaluateLoss(
  current: SettledJobSample,
  history: SettledJobSample[],
  policy: DriftPolicy = DEFAULT_DRIFT_POLICY,
): LossFinding[] {
  const actualPct = percent(current.actualPct);
  const allowedPct = percent(current.allowedPct);
  const excessGrams = grams(current.excessGrams);
  const findings: LossFinding[] = [];

  if (excessGrams.greaterThan(0)) {
    findings.push({ kind: "OVER_ALLOWANCE", actualPct, allowedPct, excessGrams });
  }

  const earlier = history.filter((h) => h.jobId !== current.jobId && h.closedAt < current.closedAt);
  if (earlier.length >= policy.minHistoryJobs) {
    const baselinePct = percent(median(earlier.map(gapToAllowance)));
    const currentGap = gapToAllowance(current);
    if (currentGap.minus(baselinePct).greaterThanOrEqualTo(policy.driftPoints)) {
      findings.push({ kind: "DRIFT", actualPct, allowedPct, baselinePct, excessGrams });
    }
  }

  return findings;
}
