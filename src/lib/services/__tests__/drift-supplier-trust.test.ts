import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Drift Detection + Supplier Trust — Code Audit", () => {
  const servicesDir = path.resolve("src/lib/services");
  const apiDir = path.resolve("src/app/api");

  it("drift-detection.ts existiert und exportiert detectDrift", () => {
    const content = fs.readFileSync(
      path.join(servicesDir, "autopilot/drift-detection.ts"),
      "utf-8"
    );
    expect(content).toContain("export async function detectDrift");
    expect(content).toContain("correction_spike");
    expect(content).toContain("accuracy_drop");
    expect(content).toContain("overallScore");
    expect(content).toContain("recommendation");
  });

  it("supplier-trust.ts existiert und exportiert computeSupplierTrustScores", () => {
    const content = fs.readFileSync(
      path.join(servicesDir, "autopilot/supplier-trust.ts"),
      "utf-8"
    );
    expect(content).toContain("export async function computeSupplierTrustScores");
    expect(content).toContain("trustScore");
    expect(content).toContain("correctionRate");
    expect(content).toContain("accountStability");
    expect(content).toContain("vatStability");
    expect(content).toContain("autopilotAccuracy");
    expect(content).toContain("bananaChangeRate");
  });

  it("autopilot-decision.ts exportiert checkAndApplyDrift", () => {
    const content = fs.readFileSync(
      path.join(servicesDir, "autopilot/autopilot-decision.ts"),
      "utf-8"
    );
    expect(content).toContain("export async function checkAndApplyDrift");
    expect(content).toContain("drift_downgrade");
    expect(content).toContain("detectDrift");
  });

  it("autopilot/drift API route existiert mit GET und POST", () => {
    const content = fs.readFileSync(
      path.join(apiDir, "autopilot/drift/route.ts"),
      "utf-8"
    );
    expect(content).toContain("export async function GET");
    expect(content).toContain("export async function POST");
    expect(content).toContain("detectDrift");
    expect(content).toContain("checkAndApplyDrift");
  });

  it("suppliers/trust-scores API route existiert", () => {
    const content = fs.readFileSync(
      path.join(apiDir, "suppliers/trust-scores/route.ts"),
      "utf-8"
    );
    expect(content).toContain("export async function GET");
    expect(content).toContain("computeSupplierTrustScores");
  });
});
