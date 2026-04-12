import { describe, it, expect } from "vitest";
import * as fs from "fs";

describe("Phase 11 Wizard Architecture", () => {
  it("OnboardingSession Model mit First-Useful-State", () => {
    const schema = fs.readFileSync("prisma/schema.prisma", "utf-8");
    expect(schema).toContain("model OnboardingSession");
    expect(schema).toContain("firstUsefulState");
    expect(schema).toContain("moduleReadiness");
    expect(schema).toContain("goLivePhase");
  });

  it("BusinessProfile Model mit Insights + Empfehlungen", () => {
    const schema = fs.readFileSync("prisma/schema.prisma", "utf-8");
    expect(schema).toContain("model BusinessProfile");
    expect(schema).toContain("revenueModel");
    expect(schema).toContain("suggestedRules");
    expect(schema).toContain("confirmedItems");
  });

  it("OnboardingKnownUnknown Model", () => {
    const schema = fs.readFileSync("prisma/schema.prisma", "utf-8");
    expect(schema).toContain("model OnboardingKnownUnknown");
    expect(schema).toContain("blocksGoLive");
    expect(schema).toContain("reducesReadiness");
  });

  it("Wizard Service mit WIZARD_STEPS und READINESS_MODULES", () => {
    const content = fs.readFileSync("src/lib/services/onboarding/wizard-service.ts", "utf-8");
    expect(content).toContain("WIZARD_STEPS");
    expect(content).toContain("getOrCreateSession");
  });

  it("Document Classifier mit 6 Klassen und KnownUnknowns", () => {
    const content = fs.readFileSync("src/lib/services/onboarding/document-classifier.ts", "utf-8");
    expect(content).toContain("classifyBootstrapDocuments");
    expect(content).toContain("learning_base");
    expect(content).toContain("recurring");
    expect(content).toContain("contractual");
    expect(content).toContain("critical");
    expect(content).toContain("exception");
    expect(content).toContain("newKnownUnknowns");
    expect(content).toContain("contract_object");
  });

  it("Upload Guidance mit 6 Kategorien und Status", () => {
    const content = fs.readFileSync("src/lib/services/onboarding/upload-guidance.ts", "utf-8");
    expect(content).toContain("getUploadGuidance");
    expect(content).toContain("readyForBootstrapping");
    expect(content).toContain("totalDocuments");
    expect(content).toContain("totalCategories");
    expect(content).toContain('"empty"');
    expect(content).toContain('"insufficient"');
    expect(content).toContain('"sufficient"');
    expect(content).toContain('"good"');
  });

  it("Wizard Page existiert mit Upload-Guidance und Klassifikation", () => {
    expect(fs.existsSync("src/app/(dashboard)/onboarding/page.tsx")).toBe(true);
    const content = fs.readFileSync("src/app/(dashboard)/onboarding/page.tsx", "utf-8");
    expect(content).toContain("UploadZone");
    expect(content).toContain("fetchClassification");
    expect(content).toContain("handleStartAnalysis");
  });

  it("Step-Validatoren existieren", () => {
    const content = fs.readFileSync("src/lib/services/onboarding/step-validators.ts", "utf-8");
    expect(content).toContain("validateStep1");
    expect(content).toContain("validateStep2");
  });

  it("Classify API erstellt KnownUnknowns", () => {
    const content = fs.readFileSync("src/app/api/onboarding/classify/route.ts", "utf-8");
    expect(content).toContain("classifyBootstrapDocuments");
    expect(content).toContain("onboardingKnownUnknown");
  });

  it("i18n hat Step 3 in onboarding und onboardingWizard", () => {
    const content = fs.readFileSync("src/lib/i18n/de.ts", "utf-8");
    expect(content).toContain("Historische Belege hochladen");
    expect(content).toContain("Lernbasis");
    expect(content).toContain("bootstrapRunning");
    expect(content).toContain("missingTypesHint");
  });
});
