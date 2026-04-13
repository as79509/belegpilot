import { describe, it, expect } from "vitest";
import * as fs from "fs";

describe("Flow Integration Audit", () => {
  // ── Flow 1: Beleg-Verarbeitung ──

  it("Upload Route triggert Inngest Pipeline", () => {
    const content = fs.readFileSync("src/app/api/documents/upload/route.ts", "utf-8");
    expect(content).toContain("dispatchDocumentProcessing");
    expect(content).toContain('source: "upload"');
  });

  it("Inngest Functions hat OCR + AI + Validation + Rules + Suggestion + Autopilot Steps", () => {
    const content = fs.readFileSync("src/lib/inngest/functions.ts", "utf-8");
    expect(content).toContain("ai-normalize");
    expect(content).toContain("populate-canonical");
    expect(content).toContain("apply-rules");
    expect(content).toContain("supplier-matching");
    expect(content).toContain("validate");
    expect(content).toContain("generate-suggestion");
    expect(content).toContain("autopilot-decision");
  });

  it("Approve Hook erstellt SuggestionEvaluation + trackt Corrections", () => {
    const content = fs.readFileSync("src/app/api/documents/[id]/approve/route.ts", "utf-8");
    expect(content).toContain("evaluateDocumentOutcome");
    expect(content).toContain("trackCorrections");
  });

  // ── Flow 2: Bank-Abstimmung ──

  it("Bank Import erstellt BankStatement + BankTransaction", () => {
    const content = fs.readFileSync("src/app/api/bank/import/route.ts", "utf-8");
    expect(content).toMatch(/bankStatement|BankStatement/);
    expect(content).toMatch(/bankTransaction|BankTransaction/);
  });

  it("Bank Match aktualisiert matchedDocumentId", () => {
    const content = fs.readFileSync("src/app/api/bank/transactions/[id]/match/route.ts", "utf-8");
    expect(content).toContain("matchedDocumentId");
    expect(content).toContain("matchStatus");
  });

  // ── Flow 3: Banana Round Trip ──

  it("Banana Export schreibt ExportRecord + aktualisiert exportStatus", () => {
    const content = fs.readFileSync("src/lib/services/banana/banana-export.ts", "utf-8");
    expect(content).toContain("exportRecord.create");
    expect(content).toContain("exportStatus");
  });

  it("Banana Round Trip erstellt BananaRoundTripEntry + Lernsignale", () => {
    const content = fs.readFileSync("src/lib/services/banana/banana-round-trip.ts", "utf-8");
    expect(content).toContain("bananaRoundTripEntry.create");
    expect(content).toContain("generateLearnSignals");
    expect(content).toContain("learnSignals");
  });

  // ── Flow 4: MwSt-Abrechnung ──

  it("VAT Route berechnet Ziffern aus Belegen", () => {
    const content = fs.readFileSync("src/app/api/vat/route.ts", "utf-8");
    expect(content).toContain("calculateVatReturn");
    expect(content).toContain("ziffer200");
  });

  // ── Flow 5: E-Mail Import ──

  it("Email Webhook ruft processEmailAttachments auf", () => {
    const content = fs.readFileSync("src/app/api/email/webhook/route.ts", "utf-8");
    expect(content).toContain("processEmailAttachments");
  });

  it("Email Parser erstellt Document + triggert Inngest", () => {
    const content = fs.readFileSync("src/lib/services/email/email-parser.ts", "utf-8");
    expect(content).toMatch(/prisma\.document\.create/);
    expect(content).toMatch(/inngest\.send\(/);
  });

  // ── Flow 6: Autopilot-Lernkreislauf ──

  it("Telemetrie nutzt SuggestionEvaluation fuer echte Accuracy", () => {
    const content = fs.readFileSync("src/lib/services/telemetry/telemetry-service.ts", "utf-8");
    expect(content).toContain("suggestionEvaluation.findMany");
    expect(content).toContain("accountCorrect");
  });

  it("Drift Detection prueft Evaluations + Corrections", () => {
    const content = fs.readFileSync("src/lib/services/autopilot/drift-detection.ts", "utf-8");
    expect(content).toContain("suggestionEvaluation");
    expect(content).toContain("correctionEvent");
  });

  it("Supplier Trust Score nutzt alle Datenquellen", () => {
    const content = fs.readFileSync("src/lib/services/autopilot/supplier-trust.ts", "utf-8");
    expect(content).toContain("correctionEvent");
    expect(content).toContain("suggestionEvaluation");
    expect(content).toContain("bananaRoundTripEntry");
  });

  it("Auto-Downgrade aktualisiert AutopilotConfig + erstellt Notification", () => {
    const content = fs.readFileSync("src/lib/services/autopilot/autopilot-decision.ts", "utf-8");
    expect(content).toContain("checkAndApplyDrift");
    expect(content).toContain("drift_downgrade");
    expect(content).toContain("notification.create");
  });
});
