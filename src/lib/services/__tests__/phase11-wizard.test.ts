import { describe, it, expect } from "vitest";
import * as fs from "fs";

describe("Phase 11 Wizard", () => {
  it("OnboardingSession Model existiert", () => {
    const schema = fs.readFileSync("prisma/schema.prisma", "utf-8");
    expect(schema).toContain("model OnboardingSession");
    expect(schema).toContain("currentStep");
    expect(schema).toContain("completedSteps");
  });

  it("BusinessProfile Model existiert", () => {
    const schema = fs.readFileSync("prisma/schema.prisma", "utf-8");
    expect(schema).toContain("model BusinessProfile");
    expect(schema).toContain("revenueModel");
    expect(schema).toContain("suggestedRules");
  });

  it("Document Classifier existiert mit allen Exports", () => {
    const content = fs.readFileSync("src/lib/services/onboarding/document-classifier.ts", "utf-8");
    expect(content).toContain("classifyBootstrapDocuments");
    expect(content).toContain("learning_base");
    expect(content).toContain("recurring");
    expect(content).toContain("contractual");
    expect(content).toContain("critical");
    expect(content).toContain("exception");
  });

  it("Upload Guidance Service existiert", () => {
    const content = fs.readFileSync("src/lib/services/onboarding/upload-guidance.ts", "utf-8");
    expect(content).toContain("getUploadGuidance");
    expect(content).toContain("readyForBootstrapping");
    expect(content).toContain("overallProgress");
  });

  it("Onboarding Analyzer existiert", () => {
    const content = fs.readFileSync("src/lib/services/onboarding/onboarding-analyzer.ts", "utf-8");
    expect(content).toContain("analyzeNewClient");
  });

  it("Wizard Page existiert", () => {
    expect(fs.existsSync("src/app/(dashboard)/onboarding/page.tsx")).toBe(true);
  });

  it("Classify API Route existiert", () => {
    expect(fs.existsSync("src/app/api/onboarding/classify/route.ts")).toBe(true);
    const content = fs.readFileSync("src/app/api/onboarding/classify/route.ts", "utf-8");
    expect(content).toContain("classifyBootstrapDocuments");
  });

  it("Guidance API Route existiert", () => {
    expect(fs.existsSync("src/app/api/onboarding/guidance/route.ts")).toBe(true);
    const content = fs.readFileSync("src/app/api/onboarding/guidance/route.ts", "utf-8");
    expect(content).toContain("getUploadGuidance");
  });

  it("i18n hat Step 3 Translations", () => {
    const content = fs.readFileSync("src/lib/i18n/de.ts", "utf-8");
    expect(content).toContain("Historische Belege hochladen");
    expect(content).toContain("Lernbasis");
    expect(content).toContain("Wiederkehrend");
    expect(content).toContain("Vertraglich");
  });
});
