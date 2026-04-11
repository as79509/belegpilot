import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Autopilot Konto-Governance Code Audit
 *
 * Verifiziert dass die Governance-Luecke geschlossen ist:
 * Der Autopilot muss das VORGESCHLAGENE Konto (suggestedAccount)
 * gegen die Konto-Governance pruefen, nicht nur document.accountCode.
 */

describe("Autopilot Konto-Governance (Code Audit)", () => {
  const decisionPath = path.resolve(
    __dirname, "../autopilot/autopilot-decision.ts"
  );
  const safetyPath = path.resolve(
    __dirname, "../autopilot/safety-check.ts"
  );

  const decisionContent = fs.readFileSync(decisionPath, "utf-8");
  const safetyContent = fs.readFileSync(safetyPath, "utf-8");

  it("autopilot-decision prueft suggestedAccount Governance", () => {
    expect(decisionContent).toContain("suggestedAccountGovernance");
  });

  it("Governance-Check prueft aiGovernance !== ai_autopilot", () => {
    expect(decisionContent).toContain("ai_autopilot");
    expect(decisionContent).toContain("suggestedAccount");
  });

  it("blockiert Autopilot wenn Governance fehlschlaegt", () => {
    // Must set eligible = false when governance fails
    expect(decisionContent).toContain("safetyResult.eligible = false");
    expect(decisionContent).toContain("suggestedAccountGovernance");
  });

  it("Check wird in safetyResult.checks gespeichert", () => {
    expect(decisionContent).toContain("safetyResult.checks.suggestedAccountGovernance");
  });

  it("Governance-Check kommt NACH generateSuggestion", () => {
    const suggestionCallIndex = decisionContent.indexOf("generateSuggestion");
    const governanceCheckIndex = decisionContent.indexOf("suggestedAccountGovernance");
    expect(suggestionCallIndex).toBeGreaterThan(-1);
    expect(governanceCheckIndex).toBeGreaterThan(-1);
    expect(governanceCheckIndex).toBeGreaterThan(suggestionCallIndex);
  });

  it("Governance-Check kommt VOR dem Decision Snapshot", () => {
    const governanceCheckIndex = decisionContent.indexOf("suggestedAccountGovernance");
    const snapshotIndex = decisionContent.indexOf("decisionSnapshot");
    expect(governanceCheckIndex).toBeGreaterThan(-1);
    expect(snapshotIndex).toBeGreaterThan(-1);
    expect(governanceCheckIndex).toBeLessThan(snapshotIndex);
  });

  it("safety-check.ts hat den originalen accountGovernance Check", () => {
    // Der bestehende Check in safety-check.ts prueft document.accountCode
    expect(safetyContent).toContain("accountGovernance");
    expect(safetyContent).toContain("document.accountCode");
  });

  it("suggestion wird auf null gesetzt wenn Governance blockiert", () => {
    // After governance block, suggestion must be nulled
    expect(decisionContent).toContain("suggestion = null");
  });
});
