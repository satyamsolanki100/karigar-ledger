import Decimal from "decimal.js";

// Brief constraint: weights to 3 decimals, purity to 2. Half-up matches how the
// workshop rounds by hand, and reproduces the client's sample rows exactly.
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export const WEIGHT_SCALE = 3;
export const PURITY_SCALE = 2;

export const ZERO = new Decimal(0);

export function grams(value: Decimal.Value): Decimal {
  return new Decimal(value).toDecimalPlaces(WEIGHT_SCALE, Decimal.ROUND_HALF_UP);
}

export function percent(value: Decimal.Value): Decimal {
  return new Decimal(value).toDecimalPlaces(PURITY_SCALE, Decimal.ROUND_HALF_UP);
}

export function fineWeight(grossWeight: Decimal.Value, purityPct: Decimal.Value): Decimal {
  return grams(new Decimal(grossWeight).mul(purityPct).div(100));
}

export function allowedWastage(issuedFine: Decimal.Value, allowedPct: Decimal.Value): Decimal {
  return grams(new Decimal(issuedFine).mul(allowedPct).div(100));
}

export function wastagePct(lossGrams: Decimal.Value, issuedFine: Decimal.Value): Decimal {
  const issued = new Decimal(issuedFine);
  if (issued.isZero()) return percent(0);
  return percent(new Decimal(lossGrams).div(issued).mul(100));
}

export type JobWastage = {
  issuedFine: Decimal;
  receivedFine: Decimal;
  loss: Decimal;
  allowed: Decimal;
  excess: Decimal;
  actualPct: Decimal;
  allowedPct: Decimal;
  overAllowance: boolean;
};

/**
 * Settles one job: what went out, what came back as pieces, scrap and filings,
 * and how the gap compares with the agreed allowance on the issued fine weight.
 */
export function settleJob(input: {
  issuedFine: Decimal.Value;
  receivedFine: Decimal.Value;
  allowedPct: Decimal.Value;
}): JobWastage {
  const issuedFine = grams(input.issuedFine);
  const receivedFine = grams(input.receivedFine);
  const loss = grams(issuedFine.minus(receivedFine));
  const allowed = allowedWastage(issuedFine, input.allowedPct);
  const excess = grams(loss.minus(allowed));
  return {
    issuedFine,
    receivedFine,
    loss,
    allowed,
    excess,
    actualPct: wastagePct(loss, issuedFine),
    allowedPct: percent(input.allowedPct),
    overAllowance: excess.greaterThan(0),
  };
}

export type BalanceStep = { fine: Decimal.Value; direction: "OUT" | "IN" };

/** Running fine-gold balance held by a karigar: issues add, receipts subtract. */
export function runningBalance(steps: BalanceStep[], opening: Decimal.Value = 0): Decimal[] {
  let balance = grams(opening);
  return steps.map((step) => {
    const fine = grams(step.fine);
    balance = grams(step.direction === "OUT" ? balance.plus(fine) : balance.minus(fine));
    return balance;
  });
}

export function sumGrams(values: Decimal.Value[]): Decimal {
  return grams(values.reduce<Decimal>((total, v) => total.plus(v), ZERO));
}

export function formatGrams(value: Decimal.Value): string {
  return grams(value).toFixed(WEIGHT_SCALE);
}

export function formatPct(value: Decimal.Value): string {
  return percent(value).toFixed(PURITY_SCALE);
}

const WEIGHT_INPUT = /^\d{1,7}(\.\d{1,3})?$/;
const PURITY_INPUT = /^\d{1,3}(\.\d{1,2})?$/;

export function parseWeightInput(raw: string): Decimal | null {
  const trimmed = raw.trim();
  if (!WEIGHT_INPUT.test(trimmed)) return null;
  const value = new Decimal(trimmed);
  return value.greaterThan(0) ? value : null;
}

export function parsePurityInput(raw: string): Decimal | null {
  const trimmed = raw.trim();
  if (!PURITY_INPUT.test(trimmed)) return null;
  const value = new Decimal(trimmed);
  return value.greaterThan(0) && value.lessThanOrEqualTo(100) ? value : null;
}
