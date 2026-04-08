import { describe, it, expect } from "vitest";
import { makeProcessingDecision } from "../decision";
import type { ValidationResult } from "../validation-engine";

function makeResult(overrides: Partial<ValidationResult> = {}): ValidationResult {
  return {
    checks: [],
    overallPassed: true,
    errorCount: 0,
    warningCount: 0,
    ...overrides,
  };
}

describe("makeProcessingDecision", () => {
  it("errorCount > 0 → needs_review", () => {
    const result = makeProcessingDecision(makeResult({ errorCount: 1 }), 0.9);
    expect(result).toBe("needs_review");
  });

  it("compositeConfidence < 0.65 → needs_review", () => {
    const result = makeProcessingDecision(makeResult(), 0.5);
    expect(result).toBe("needs_review");
  });

  it("warningCount > 3 → needs_review", () => {
    const result = makeProcessingDecision(makeResult({ warningCount: 4 }), 0.8);
    expect(result).toBe("needs_review");
  });

  it("alles gut → auto_ready", () => {
    const result = makeProcessingDecision(makeResult({ warningCount: 1 }), 0.8);
    expect(result).toBe("auto_ready");
  });

  it("genau an der Grenze: confidence = 0.65, 0 errors, 3 warnings → auto_ready", () => {
    const result = makeProcessingDecision(makeResult({ warningCount: 3 }), 0.65);
    expect(result).toBe("auto_ready");
  });

  // Escalation tests
  it("escalations nicht leer → immer needs_review (auch bei hoher Confidence)", () => {
    const result = makeProcessingDecision(makeResult(), 0.95, ["Neuer Lieferant"]);
    expect(result).toBe("needs_review");
  });

  it("escalations leer + hohe Confidence → auto_ready", () => {
    const result = makeProcessingDecision(makeResult(), 0.85, []);
    expect(result).toBe("auto_ready");
  });

  it("escalations undefined + hohe Confidence → auto_ready", () => {
    const result = makeProcessingDecision(makeResult(), 0.85, undefined);
    expect(result).toBe("auto_ready");
  });

  // Custom threshold tests
  it("custom threshold 0.8 → needs_review bei 0.75", () => {
    const result = makeProcessingDecision(makeResult(), 0.75, [], 0.8);
    expect(result).toBe("needs_review");
  });

  it("custom threshold 0.8 → auto_ready bei 0.85", () => {
    const result = makeProcessingDecision(makeResult(), 0.85, [], 0.8);
    expect(result).toBe("auto_ready");
  });

  it("default threshold 0.65 used when not specified", () => {
    const result = makeProcessingDecision(makeResult(), 0.6);
    expect(result).toBe("needs_review");
  });
});
