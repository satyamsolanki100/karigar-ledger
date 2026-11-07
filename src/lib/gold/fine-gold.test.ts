import { describe, expect, it } from "vitest";
import {
  fineWeight,
  formatGrams,
  parsePurityInput,
  parseWeightInput,
  runningBalance,
  settleJob,
  wastagePct,
} from "./fine-gold";

// The three rows the client gave us for Murugesan S.
const issue = { gross: "120.000", purity: "91.60" };
const necklace = { gross: "112.450", purity: "91.60" };
const scrap = { gross: "3.300", purity: "91.60" };

describe("fineWeight", () => {
  it("reproduces the client's sample fine weights to 3 decimals", () => {
    expect(formatGrams(fineWeight(issue.gross, issue.purity))).toBe("109.920");
    expect(formatGrams(fineWeight(necklace.gross, necklace.purity))).toBe("103.004");
    expect(formatGrams(fineWeight(scrap.gross, scrap.purity))).toBe("3.023");
  });

  it("rounds half up at the third decimal", () => {
    // 1.000 * 91.65% = 0.9165 -> 0.917, not banker's 0.916
    expect(formatGrams(fineWeight("1.000", "91.65"))).toBe("0.917");
    expect(formatGrams(fineWeight("0.005", "50.00"))).toBe("0.003");
  });

  it("does not accumulate binary float error", () => {
    expect(formatGrams(fineWeight("0.1", "30.00"))).toBe("0.030");
    expect(formatGrams(fineWeight("1234567.891", "99.99"))).toBe("1234444.434");
  });
});

describe("runningBalance", () => {
  it("matches the sample ledger's fine balance column", () => {
    const balances = runningBalance([
      { fine: fineWeight(issue.gross, issue.purity), direction: "OUT" },
      { fine: fineWeight(necklace.gross, necklace.purity), direction: "IN" },
      { fine: fineWeight(scrap.gross, scrap.purity), direction: "IN" },
    ]);
    expect(balances.map(formatGrams)).toEqual(["109.920", "6.916", "3.893"]);
  });

  it("starts from an opening balance when given one", () => {
    const [after] = runningBalance([{ fine: "10.000", direction: "IN" }], "25.500");
    expect(formatGrams(after)).toBe("15.500");
  });
});

describe("settleJob", () => {
  it("shows Murugesan's job 0.595 g over the 3% allowance", () => {
    const settled = settleJob({
      issuedFine: "109.920",
      receivedFine: "106.027",
      allowedPct: "3.00",
    });
    expect(formatGrams(settled.loss)).toBe("3.893");
    expect(formatGrams(settled.allowed)).toBe("3.298");
    expect(formatGrams(settled.excess)).toBe("0.595");
    expect(settled.actualPct.toFixed(2)).toBe("3.54");
    expect(settled.overAllowance).toBe(true);
  });

  it("reports a negative excess when the karigar returns more than allowed", () => {
    const settled = settleJob({ issuedFine: "100.000", receivedFine: "98.500", allowedPct: "2.00" });
    expect(formatGrams(settled.excess)).toBe("-0.500");
    expect(settled.overAllowance).toBe(false);
  });

  it("treats a loss exactly on the allowance as within", () => {
    const settled = settleJob({ issuedFine: "100.000", receivedFine: "97.000", allowedPct: "3.00" });
    expect(formatGrams(settled.excess)).toBe("0.000");
    expect(settled.overAllowance).toBe(false);
  });
});

describe("wastagePct", () => {
  it("is zero when nothing was issued", () => {
    expect(wastagePct("1.000", "0").toFixed(2)).toBe("0.00");
  });
});

describe("input parsing", () => {
  it("accepts weights up to 3 decimals and rejects more", () => {
    expect(parseWeightInput("120.000")?.toString()).toBe("120");
    expect(parseWeightInput("0.5")?.toString()).toBe("0.5");
    expect(parseWeightInput("120.0001")).toBeNull();
    expect(parseWeightInput("-1")).toBeNull();
    expect(parseWeightInput("0")).toBeNull();
    expect(parseWeightInput("12,000")).toBeNull();
  });

  it("accepts purity between 0 and 100 with 2 decimals", () => {
    expect(parsePurityInput("91.60")?.toString()).toBe("91.6");
    expect(parsePurityInput("100")?.toString()).toBe("100");
    expect(parsePurityInput("100.01")).toBeNull();
    expect(parsePurityInput("91.605")).toBeNull();
    expect(parsePurityInput("")).toBeNull();
  });
});
