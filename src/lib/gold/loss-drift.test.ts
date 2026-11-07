import { describe, expect, it } from "vitest";
import { evaluateLoss, median, type SettledJobSample } from "./loss-drift";

const day = (n: number) => new Date(Date.UTC(2026, 9, n));

function job(id: string, closedOn: number, actualPct: string, excessGrams = "0.000"): SettledJobSample {
  return { jobId: id, closedAt: day(closedOn), actualPct, allowedPct: "3.00", excessGrams };
}

describe("median", () => {
  it("handles odd and even counts", () => {
    expect(median(["2.1", "1.9", "2.5"]).toString()).toBe("2.1");
    expect(median(["2.0", "3.0"]).toString()).toBe("2.5");
  });
});

describe("evaluateLoss", () => {
  const steadyHistory = [job("J1", 1, "2.10"), job("J2", 5, "2.20"), job("J3", 9, "2.05")];

  it("flags a job over its agreed allowance even with no history", () => {
    const findings = evaluateLoss(job("J9", 20, "3.54", "0.595"), []);
    expect(findings).toHaveLength(1);
    expect(findings[0].kind).toBe("OVER_ALLOWANCE");
    expect(findings[0].excessGrams.toFixed(3)).toBe("0.595");
  });

  it("flags drift when a job rises half a point above the karigar's own median", () => {
    const findings = evaluateLoss(job("J4", 15, "2.60"), steadyHistory);
    expect(findings.map((f) => f.kind)).toEqual(["DRIFT"]);
    const drift = findings[0];
    expect(drift.kind === "DRIFT" && drift.baselinePct.toFixed(2)).toBe("2.10");
  });

  it("stays quiet for a job within allowance and in line with history", () => {
    expect(evaluateLoss(job("J4", 15, "2.30"), steadyHistory)).toEqual([]);
  });

  it("needs at least three earlier jobs before judging drift", () => {
    expect(evaluateLoss(job("J3", 9, "2.90"), steadyHistory.slice(0, 2))).toEqual([]);
  });

  it("ignores the current job and later jobs when building the baseline", () => {
    const history = [...steadyHistory, job("J4", 15, "2.60"), job("J5", 25, "4.00")];
    const findings = evaluateLoss(job("J4", 15, "2.60"), history);
    expect(findings.map((f) => f.kind)).toEqual(["DRIFT"]);
  });

  it("raises both findings when a drifting job also breaks the allowance", () => {
    const findings = evaluateLoss(job("J4", 15, "3.40", "0.400"), steadyHistory);
    expect(findings.map((f) => f.kind)).toEqual(["OVER_ALLOWANCE", "DRIFT"]);
  });
});
