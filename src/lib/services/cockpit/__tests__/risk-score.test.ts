import { describe, it, expect } from "vitest";
import { computeRiskScore, riskLevel } from "../risk-score";

describe("computeRiskScore", () => {
  it("alles OK → Score 0", () => {
    expect(computeRiskScore({ needsReview: 0, overdueTasks: 0, overdueContracts: 0, periodStatus: "closed" })).toBe(0);
  });

  it("5 needs_review → Score 15", () => {
    expect(computeRiskScore({ needsReview: 5, overdueTasks: 0, overdueContracts: 0, periodStatus: "closed" })).toBe(15);
  });

  it("Periode offen → +10 Penalty", () => {
    expect(computeRiskScore({ needsReview: 0, overdueTasks: 0, overdueContracts: 0, periodStatus: "open" })).toBe(10);
  });

  it("Periode locked → kein Penalty", () => {
    expect(computeRiskScore({ needsReview: 0, overdueTasks: 0, overdueContracts: 0, periodStatus: "locked" })).toBe(0);
  });

  it("Periode incomplete → +5 Penalty", () => {
    expect(computeRiskScore({ needsReview: 0, overdueTasks: 0, overdueContracts: 0, periodStatus: "incomplete" })).toBe(5);
  });

  it("Kombination → korrekte Summe", () => {
    expect(computeRiskScore({ needsReview: 2, overdueTasks: 3, overdueContracts: 1, periodStatus: "incomplete" })).toBe(2 * 3 + 3 * 2 + 1 * 5 + 5);
  });
});

describe("riskLevel", () => {
  it("0-5 → ok", () => {
    expect(riskLevel(0)).toBe("ok");
    expect(riskLevel(3)).toBe("ok");
    expect(riskLevel(5)).toBe("ok");
  });

  it("6-15 → warning", () => {
    expect(riskLevel(6)).toBe("warning");
    expect(riskLevel(10)).toBe("warning");
    expect(riskLevel(15)).toBe("warning");
  });

  it("16+ → critical", () => {
    expect(riskLevel(16)).toBe("critical");
    expect(riskLevel(20)).toBe("critical");
    expect(riskLevel(100)).toBe("critical");
  });
});
