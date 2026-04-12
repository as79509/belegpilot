import { describe, it, expect } from "vitest";
import * as fs from "fs";

describe("Phase 10 Final Audit", () => {
  it("SupplierAutopilotOverride Model existiert", () => {
    const schema = fs.readFileSync("prisma/schema.prisma", "utf-8");
    expect(schema).toContain("model SupplierAutopilotOverride");
    expect(schema).toContain("supplier_autopilot_overrides");
    expect(schema).toContain("@@unique([companyId, supplierId])");
  });

  it("evaluateAutopilot prueft Supplier Override", () => {
    const content = fs.readFileSync("src/lib/services/autopilot/autopilot-decision.ts", "utf-8");
    expect(content).toContain("supplierAutopilotOverride");
    expect(content).toContain("effectiveMode");
    expect(content).toContain("supplier_override_disabled");
  });

  it("Confidence Calibration Service existiert", () => {
    const content = fs.readFileSync("src/lib/services/autopilot/confidence-calibration.ts", "utf-8");
    expect(content).toContain("calibrateConfidence");
    expect(content).toContain("actualAccuracy");
    expect(content).toContain("overallCalibration");
  });

  it("Supplier Autopilot Override API existiert", () => {
    const content = fs.readFileSync("src/app/api/suppliers/[id]/autopilot-override/route.ts", "utf-8");
    expect(content).toContain("export async function GET");
    expect(content).toContain("export async function PUT");
    expect(content).toContain("supplierAutopilotOverride");
  });

  it("Calibration API existiert", () => {
    const content = fs.readFileSync("src/app/api/autopilot/calibration/route.ts", "utf-8");
    expect(content).toContain("calibrateConfidence");
  });

  it("README hat aktuelle Stats und Phase 10", () => {
    const readme = fs.readFileSync("README.md", "utf-8");
    expect(readme).toContain("Phase 10");
    expect(readme).toContain("Banana");
    expect(readme).toContain("Drift");
    expect(readme).toContain("Trust");
    expect(readme).toContain("Calibration");
  });

  it("CLAUDE.md hat aktuelle Stats", () => {
    const claude = fs.readFileSync("CLAUDE.md", "utf-8");
    expect(claude).toContain("Phase 10");
    expect(claude).toContain("39 Prisma-Models");
  });
});
