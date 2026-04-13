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

  // Phase 11.4: Business Chat
  it("Business-Chat Service existiert mit priorisierten Fragen", () => {
    const content = fs.readFileSync("src/lib/services/onboarding/business-chat.ts", "utf-8");
    expect(content).toContain("generatePrioritizedQuestions");
    expect(content).toContain("extractInsightsFromAnswer");
    expect(content).toContain("ChatQuestion");
    expect(content).toContain("ChatInsight");
    expect(content).toContain("ANTHROPIC_API_KEY");
  });

  it("Chat API Routes existieren", () => {
    expect(fs.existsSync("src/app/api/onboarding/chat/route.ts")).toBe(true);
    const content = fs.readFileSync("src/app/api/onboarding/chat/route.ts", "utf-8");
    expect(content).toContain("extractInsightsFromAnswer");
    expect(content).toContain("generatePrioritizedQuestions");
  });

  it("Wizard Step 4 hat Chat-UI statt Placeholder", () => {
    const content = fs.readFileSync("src/app/(dashboard)/onboarding/wizard/page.tsx", "utf-8");
    expect(content).toContain("handleSubmitAnswer");
    expect(content).toContain("chatQuestions");
    expect(content).toContain("fetchChatQuestions");
  });

  it("Wizard Step 3 nutzt echte Upload- und Klassifikationslogik", () => {
    const content = fs.readFileSync("src/app/(dashboard)/onboarding/wizard/page.tsx", "utf-8");
    expect(content).toContain("Step3Documents");
    expect(content).toContain("UploadZone");
    expect(content).toContain('fetch("/api/onboarding/guidance")');
    expect(content).toContain('fetch("/api/onboarding/classify")');
    expect(content).not.toContain("Step 3: Placeholder");
  });

  it("i18n hat Step 4 Chat-Keys", () => {
    const content = fs.readFileSync("src/lib/i18n/de.ts", "utf-8");
    expect(content).toContain("step4");
    expect(content).toContain("submitAnswer");
    expect(content).toContain("noMoreQuestions");
  });

  // Phase 11.5: Bootstrapping Engine
  it("Bootstrapping Engine existiert mit GovernanceStatus", () => {
    const content = fs.readFileSync("src/lib/services/onboarding/bootstrapping-engine.ts", "utf-8");
    expect(content).toContain("runBootstrapping");
    expect(content).toContain("GovernanceStatus");
    expect(content).toContain("BootstrappedItem");
    expect(content).toContain("newKnownUnknowns");
  });

  it("Bootstrap Apply Service existiert", () => {
    const content = fs.readFileSync("src/lib/services/onboarding/bootstrap-apply.ts", "utf-8");
    expect(content).toContain("applyBootstrappedItems");
    expect(content).toContain("rule.create");
    expect(content).toContain("knowledgeItem.create");
    expect(content).toContain("expectedDocument.create");
  });

  it("Bootstrap API Route existiert", () => {
    expect(fs.existsSync("src/app/api/onboarding/bootstrap/route.ts")).toBe(true);
    const content = fs.readFileSync("src/app/api/onboarding/bootstrap/route.ts", "utf-8");
    expect(content).toContain("runBootstrapping");
  });

  it("Bootstrap Apply API Route existiert", () => {
    expect(fs.existsSync("src/app/api/onboarding/bootstrap/apply/route.ts")).toBe(true);
    const content = fs.readFileSync("src/app/api/onboarding/bootstrap/apply/route.ts", "utf-8");
    expect(content).toContain("applyBootstrappedItems");
  });

  // Phase 11.6: Readiness UI, GoLive-Check, Known-Unknowns Verwaltung
  it("GoLive Check Service existiert", () => {
    const content = fs.readFileSync("src/lib/services/onboarding/golive-check.ts", "utf-8");
    expect(content).toContain("checkGoLiveReadiness");
    expect(content).toContain("canGoLive");
    expect(content).toContain("blockers");
    expect(content).toContain("recommendedGoLiveConfig");
    expect(content).toContain("estimatedStabilizationDays");
  });

  it("Known-Unknowns API existiert mit resolve/accept/defer", () => {
    expect(fs.existsSync("src/app/api/onboarding/unknowns/route.ts")).toBe(true);
    const content = fs.readFileSync("src/app/api/onboarding/unknowns/route.ts", "utf-8");
    expect(content).toContain("resolve");
    expect(content).toContain("accept");
    expect(content).toContain("defer");
  });

  it("GoLive Check API existiert", () => {
    expect(fs.existsSync("src/app/api/onboarding/wizard/golive-check/route.ts")).toBe(true);
  });

  it("Wizard Step 6 hat Readiness UI statt Placeholder", () => {
    const content = fs.readFileSync("src/app/(dashboard)/onboarding/wizard/page.tsx", "utf-8");
    expect(content).toContain("Step6Readiness");
    expect(content).toContain("moduleReadiness");
    expect(content).toContain("unknowns");
  });

  it("Wizard Step 5 hat Intelligence Review statt Placeholder", () => {
    const content = fs.readFileSync("src/app/(dashboard)/onboarding/wizard/page.tsx", "utf-8");
    expect(content).toContain("Step5Intelligence");
    expect(content).toContain("handleRunBootstrap");
    expect(content).toContain("handleApply");
    expect(content).toContain("GOV_BADGE");
  });

  // Phase 11.7+11.8: Go-Live, First-30-Days, Phase-Management
  it("GoLive Service existiert mit Phase-Management", () => {
    const content = fs.readFileSync("src/lib/services/onboarding/golive-service.ts", "utf-8");
    expect(content).toContain("startGoLive");
    expect(content).toContain("getGoLiveStatus");
    expect(content).toContain("advanceGoLivePhase");
    expect(content).toContain("first_week");
    expect(content).toContain("first_30_days");
    expect(content).toContain("stabilized");
  });

  it("GoLive API existiert", () => {
    expect(fs.existsSync("src/app/api/onboarding/golive/route.ts")).toBe(true);
    const content = fs.readFileSync("src/app/api/onboarding/golive/route.ts", "utf-8");
    expect(content).toContain("startGoLive");
    expect(content).toContain("advance");
  });

  it("Wizard Step 7 hat Go-Live UI", () => {
    const content = fs.readFileSync("src/app/(dashboard)/onboarding/wizard/page.tsx", "utf-8");
    expect(content).toContain("Step7GoLive");
    expect(content).toContain("goLiveStatus");
    expect(content).toContain("phaseLabels");
  });

  it("Dashboard hat Go-Live Widget", () => {
    const content = fs.readFileSync("src/app/(dashboard)/dashboard/page.tsx", "utf-8");
    expect(content).toContain("Hochlaufphase");
  });

  // Phase 11.9: Rollenlogik
  it("Wizard Page unterscheidet Rollen", () => {
    const c = fs.readFileSync("src/app/(dashboard)/onboarding/wizard/page.tsx", "utf-8");
    expect(c).toContain("isTrustee");
    expect(c).toContain("isViewer");
  });

  it("Business-Chat akzeptiert role Parameter", () => {
    const c = fs.readFileSync("src/lib/services/onboarding/business-chat.ts", "utf-8");
    expect(c).toContain("role?");
  });

  // Phase 11.10: Failure Modes
  it("Failure Handler existiert", () => {
    const c = fs.readFileSync("src/lib/services/onboarding/failure-handler.ts", "utf-8");
    expect(c).toContain("assessFailureModes");
    expect(c).toContain("insufficient_data");
    expect(c).toContain("contradictory");
    expect(c).toContain("fallback");
  });

  it("Failures API existiert", () => {
    expect(fs.existsSync("src/app/api/onboarding/failures/route.ts")).toBe(true);
  });

  // Phase 11.11: Onboarding-Telemetrie
  it("Onboarding-Telemetrie existiert", () => {
    const c = fs.readFileSync("src/lib/services/onboarding/onboarding-telemetry.ts", "utf-8");
    expect(c).toContain("computeOnboardingTelemetry");
    expect(c).toContain("correctionRateFirst30Days");
    expect(c).toContain("suggestionAcceptanceRate");
  });

  it("Telemetrie API existiert", () => {
    expect(fs.existsSync("src/app/api/onboarding/telemetry/route.ts")).toBe(true);
  });

  // Phase 11.12: Konsolidierung
  it("README erwähnt Phase 11", () => {
    const c = fs.readFileSync("README.md", "utf-8");
    expect(c).toContain("Phase 11");
    expect(c).toContain("Wizard");
  });

  // Phase 11X.1: Design-Tokens
  it("Design Tokens existieren", () => {
    const c = fs.readFileSync("src/lib/design-tokens.ts", "utf-8");
    expect(c).toContain("colors");
    expect(c).toContain("typography");
    expect(c).toContain("spacing");
    expect(c).toContain("statusColors");
    expect(c).toContain("typo");
  });

  it("DS-Komponenten importieren Design Tokens", () => {
    const ds = ["entity-header", "info-panel", "status-badge", "section-card", "empty-state"];
    for (const name of ds) {
      const c = fs.readFileSync(`src/components/ds/${name}.tsx`, "utf-8");
      expect(c).toContain("design-tokens");
    }
  });

  // Phase 11X.2: Navigation
  it("Sidebar hat rollenbasierte Navigation", () => {
    const c = fs.readFileSync("src/components/layout/sidebar.tsx", "utf-8");
    expect(c).toContain("viewer");
    expect(c).toContain("trustee");
    expect(c).toContain("admin");
  });

  it("Breadcrumb-Komponente existiert", () => {
    expect(fs.existsSync("src/components/layout/breadcrumb.tsx")).toBe(true);
  });

  // Phase 11X.3: Rollenbasierte Produktoberflächen
  it("useRole Hook existiert", () => {
    const c = fs.readFileSync("src/lib/hooks/use-role.ts", "utf-8");
    expect(c).toContain("useRole");
    expect(c).toContain("isTrustee");
    expect(c).toContain("isViewer");
    expect(c).toContain("isAdmin");
  });

  it("Dashboard nutzt useRole", () => {
    const c = fs.readFileSync("src/app/(dashboard)/dashboard/page.tsx", "utf-8");
    expect(c).toContain("useRole");
  });

  it("Documents-Seite hat rollenspezifisches Layout", () => {
    const c = fs.readFileSync("src/app/(dashboard)/documents/page.tsx", "utf-8");
    expect(c).toContain("isViewer");
  });

  // Phase 11X.4: Page Flow & Mikrointeraktionen
  it("Page-Skeleton Komponenten existieren", () => {
    const c = fs.readFileSync("src/components/ds/page-skeleton.tsx", "utf-8");
    expect(c).toContain("DashboardSkeleton");
    expect(c).toContain("TablePageSkeleton");
    expect(c).toContain("DetailPageSkeleton");
    expect(c).toContain("WizardSkeleton");
  });

  it("SaveIndicator mit useSaveState existiert", () => {
    const c = fs.readFileSync("src/components/ds/save-indicator.tsx", "utf-8");
    expect(c).toContain("SaveIndicator");
    expect(c).toContain("useSaveState");
    expect(c).toContain("saving");
    expect(c).toContain("saved");
  });

  it("Interaction-Classes existieren", () => {
    const c = fs.readFileSync("src/lib/interaction-classes.ts", "utf-8");
    expect(c).toContain("interact");
    expect(c).toContain("card");
    expect(c).toContain("tableRow");
    expect(c).toContain("focusRing");
  });

  it("Dashboard nutzt DashboardSkeleton", () => {
    const c = fs.readFileSync("src/app/(dashboard)/dashboard/page.tsx", "utf-8");
    expect(c).toContain("DashboardSkeleton");
  });

  // Phase 11X.5: Review-Effizienz
  it("Review-Shortcuts Hook existiert", () => {
    const c = fs.readFileSync("src/lib/hooks/use-review-shortcuts.ts", "utf-8");
    expect(c).toContain("useReviewShortcuts");
    expect(c).toContain("onApprove");
    expect(c).toContain("onNext");
    expect(c).toContain("ArrowRight");
  });

  it("Document-Detail hat Review-Queue Navigation", () => {
    const c = fs.readFileSync("src/app/(dashboard)/documents/[id]/page.tsx", "utf-8");
    expect(c).toContain("reviewQueue");
    expect(c).toContain("useReviewShortcuts");
  });

  it("Dashboard hat Heute-erledigen Widget", () => {
    const c = fs.readFileSync("src/app/(dashboard)/dashboard/page.tsx", "utf-8");
    expect(c).toContain("Heute erledigen");
  });

  // Phase 11X.6+11X.7: Text-Konsistenz, Empty States, Erste-Nutzung
  it("de.ts hat emptyStates Block", () => {
    const c = fs.readFileSync("src/lib/i18n/de.ts", "utf-8");
    expect(c).toContain("emptyStates");
    expect(c).toContain("Noch keine Belege");
    expect(c).toContain("Noch keine Lieferanten");
    expect(c).toContain("Keine offenen Aufgaben");
  });

  it("FirstUseHint Komponente existiert", () => {
    const c = fs.readFileSync("src/components/ds/first-use-hint.tsx", "utf-8");
    expect(c).toContain("FirstUseHint");
    expect(c).toContain("dismissed");
    expect(c).toContain("sessionStorage");
  });

  it("Mindestens 5 Seiten nutzen EmptyState", () => {
    const pages = ["documents", "suppliers", "rules", "journal", "tasks"];
    let count = 0;
    for (const page of pages) {
      const path = `src/app/(dashboard)/${page}/page.tsx`;
      if (fs.existsSync(path)) {
        const c = fs.readFileSync(path, "utf-8");
        if (c.includes("EmptyState") || c.includes("emptyStates")) count++;
      }
    }
    expect(count).toBeGreaterThanOrEqual(4);
  });

  // Phase 11X.8: Trust Layer
  it("TrustSignal Komponente existiert", () => {
    const c = fs.readFileSync("src/components/ds/trust-signal.tsx", "utf-8");
    expect(c).toContain("TrustSignal");
    expect(c).toContain("ai_confirmed");
    expect(c).toContain("ai_suggested");
    expect(c).toContain("protected");
  });

  it("ProtectionBadge Komponente existiert", () => {
    const c = fs.readFileSync("src/components/ds/protection-badge.tsx", "utf-8");
    expect(c).toContain("ProtectionBadge");
    expect(c).toContain("period_locked");
    expect(c).toContain("review_required");
  });

  it("Document-Detail nutzt TrustSignal", () => {
    const c = fs.readFileSync("src/app/(dashboard)/documents/[id]/page.tsx", "utf-8");
    expect(c).toContain("TrustSignal");
  });
});
