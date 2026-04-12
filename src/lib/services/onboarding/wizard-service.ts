import { prisma } from "@/lib/db";

export const WIZARD_STEPS = [
  { step: 1, key: "basics",     label: "Grunddaten",           required: true  },
  { step: 2, key: "accounting", label: "Steuer & Buchhaltung", required: true  },
  { step: 3, key: "documents",  label: "Historische Belege",   required: false },
  { step: 4, key: "business",   label: "Gesch\u00e4ftsmodell", required: false },
  { step: 5, key: "review",     label: "Intelligenz pr\u00fcfen", required: true },
  { step: 6, key: "readiness",  label: "Readiness & Unknowns", required: true  },
  { step: 7, key: "golive",     label: "Go-Live",              required: true  },
] as const;

export type ReadinessLevel =
  | "not_started" | "partial" | "manual_ok" | "suggestions_ready"
  | "prefill_ready" | "shadow_ready" | "auto_ready";

const READINESS_VALUES: Record<ReadinessLevel, number> = {
  not_started: 0, partial: 0.2, manual_ok: 0.4, suggestions_ready: 0.6,
  prefill_ready: 0.7, shadow_ready: 0.85, auto_ready: 1.0,
};

export interface WizardState {
  sessionId: string;
  companyId: string;
  currentStep: number;
  completedSteps: number[];
  stepData: Record<string, any>;
  stepStatuses: Array<{ step: number; key: string; label: string; status: "not_started" | "in_progress" | "completed" | "blocked" }>;
  canProceed: boolean;
  firstUsefulState: boolean;
  readinessScore: number | null;
  moduleReadiness: Record<string, ReadinessLevel> | null;
  knownUnknownsCount: { open: number; blockers: number };
  goLivePhase: string | null;
  progress: number;
  lastActiveAt: string;
  status: string;
}

function buildStepStatuses(completedSteps: number[], currentStep: number) {
  return WIZARD_STEPS.map((s) => ({
    step: s.step,
    key: s.key,
    label: s.label,
    status: completedSteps.includes(s.step)
      ? "completed" as const
      : s.step === currentStep
        ? "in_progress" as const
        : "not_started" as const,
  }));
}

export async function getOrCreateSession(companyId: string, userId: string): Promise<WizardState> {
  let session = await prisma.onboardingSession.findUnique({
    where: { companyId },
  });

  if (!session || session.status === "abandoned") {
    if (session) {
      await prisma.onboardingSession.delete({ where: { id: session.id } });
    }
    session = await prisma.onboardingSession.create({
      data: { companyId, startedBy: userId },
    });
  } else {
    await prisma.onboardingSession.update({
      where: { id: session.id },
      data: { lastActiveAt: new Date() },
    });
  }

  const completedSteps = (session.completedSteps as number[]) || [];
  const stepData = (session.stepData as Record<string, any>) || {};

  // Check first useful state
  const fus = await checkFirstUsefulState(companyId, completedSteps);
  if (fus !== session.firstUsefulState) {
    await prisma.onboardingSession.update({
      where: { id: session.id },
      data: { firstUsefulState: fus },
    });
    session.firstUsefulState = fus;
  }

  // Known unknowns count
  const [openCount, blockerCount] = await Promise.all([
    prisma.onboardingKnownUnknown.count({ where: { sessionId: session.id, status: "open" } }),
    prisma.onboardingKnownUnknown.count({ where: { sessionId: session.id, status: "open", blocksGoLive: true } }),
  ]);

  // canProceed for current step
  let canProceed = true;
  if (session.currentStep === 1) {
    const d = stepData["1"] || {};
    canProceed = !!(d.name && d.legalName && d.industry && (d.vatNumber || d.uid));
  } else if (session.currentStep === 2) {
    const d = stepData["2"] || {};
    canProceed = d.vatLiable !== undefined;
  }

  return {
    sessionId: session.id,
    companyId: session.companyId,
    currentStep: session.currentStep,
    completedSteps,
    stepData,
    stepStatuses: buildStepStatuses(completedSteps, session.currentStep),
    canProceed,
    firstUsefulState: session.firstUsefulState,
    readinessScore: session.readinessScore,
    moduleReadiness: session.moduleReadiness as Record<string, ReadinessLevel> | null,
    knownUnknownsCount: { open: openCount, blockers: blockerCount },
    goLivePhase: session.goLivePhase,
    progress: completedSteps.length / WIZARD_STEPS.length,
    lastActiveAt: session.lastActiveAt.toISOString(),
    status: session.status,
  };
}

export async function completeStep(
  sessionId: string,
  step: number,
  data: Record<string, any>
): Promise<WizardState> {
  const session = await prisma.onboardingSession.findUniqueOrThrow({ where: { id: sessionId } });
  const completedSteps = (session.completedSteps as number[]) || [];
  if (!completedSteps.includes(step)) completedSteps.push(step);

  const stepData = (session.stepData as Record<string, any>) || {};
  stepData[String(step)] = data;

  const nextStep = Math.min(step + 1, WIZARD_STEPS.length);

  // Compute module readiness
  const moduleReadiness = await computeModuleReadiness(session.companyId);
  const readinessScore = computeReadinessScore(moduleReadiness);
  const fus = await checkFirstUsefulState(session.companyId, completedSteps);

  await prisma.onboardingSession.update({
    where: { id: sessionId },
    data: {
      completedSteps: completedSteps as any,
      stepData: stepData as any,
      currentStep: nextStep,
      readinessScore,
      moduleReadiness: moduleReadiness as any,
      firstUsefulState: fus,
      lastActiveAt: new Date(),
    },
  });

  return getOrCreateSession(session.companyId, session.startedBy);
}

export async function navigateToStep(sessionId: string, step: number): Promise<WizardState> {
  if (step < 1 || step > WIZARD_STEPS.length) throw new Error("Ung\u00fcltiger Schritt");
  const session = await prisma.onboardingSession.findUniqueOrThrow({ where: { id: sessionId } });
  const completedSteps = (session.completedSteps as number[]) || [];
  const maxAllowed = Math.max(...completedSteps, 0) + 1;
  if (step > maxAllowed) throw new Error("Schritt noch nicht freigeschaltet");

  await prisma.onboardingSession.update({
    where: { id: sessionId },
    data: { currentStep: step, lastActiveAt: new Date() },
  });

  return getOrCreateSession(session.companyId, session.startedBy);
}

export async function saveDraft(sessionId: string, step: number, data: Record<string, any>): Promise<void> {
  const session = await prisma.onboardingSession.findUniqueOrThrow({ where: { id: sessionId } });
  const stepData = (session.stepData as Record<string, any>) || {};
  stepData[String(step)] = { ...stepData[String(step)], ...data };
  await prisma.onboardingSession.update({
    where: { id: sessionId },
    data: { stepData: stepData as any, lastActiveAt: new Date() },
  });
}

export async function computeModuleReadiness(companyId: string): Promise<Record<string, ReadinessLevel>> {
  const [company, accountCount, bankCount, supplierCount, docCount, contractCount, expectedDocCount, vatReturnCount, evalCount] = await Promise.all([
    prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { name: true, industry: true, vatNumber: true, businessModel: true, vatLiable: true, vatMethod: true },
    }),
    prisma.account.count({ where: { companyId, isActive: true } }),
    prisma.bankAccount.count({ where: { companyId } }),
    prisma.supplier.count({ where: { companyId, isVerified: true } }),
    prisma.document.count({ where: { companyId } }),
    prisma.contract.count({ where: { companyId } }),
    prisma.expectedDocument.count({ where: { companyId, isActive: true } }),
    prisma.vatReturn.count({ where: { companyId } }),
    prisma.suggestionEvaluation.count({ where: { companyId } }),
  ]);

  // Banana mapping rate
  const totalAccounts = await prisma.account.count({ where: { companyId, isActive: true } });
  const mappedAccounts = await prisma.account.count({ where: { companyId, isActive: true, bananaAccountNumber: { not: null } } });
  const bananaRate = totalAccounts > 0 ? mappedAccounts / totalAccounts : 0;

  // Autopilot
  const autopilotConfig = await prisma.autopilotConfig.findUnique({ where: { companyId } });

  const r: Record<string, ReadinessLevel> = {};

  // stammdaten
  r.stammdaten = !company.name || !company.industry ? "not_started"
    : !company.vatNumber ? "partial"
    : !company.businessModel ? "manual_ok"
    : "suggestions_ready";

  // belege
  r.belege = docCount === 0 ? "not_started" : docCount < 20 ? "partial" : docCount < 50 ? "manual_ok" : "suggestions_ready";

  // lieferanten
  r.lieferanten = supplierCount === 0 ? "not_started" : supplierCount < 5 ? "partial" : supplierCount < 10 ? "manual_ok" : "suggestions_ready";

  // kontenplan
  r.kontenplan = accountCount === 0 ? "not_started" : accountCount < 10 ? "partial"
    : bananaRate >= 0.8 ? "prefill_ready" : "manual_ok";

  // bank
  r.bank = bankCount === 0 ? "not_started" : "manual_ok";

  // mwst
  r.mwst = !company.vatLiable && !company.vatMethod ? "not_started"
    : !company.vatMethod ? "partial"
    : vatReturnCount > 0 ? "suggestions_ready" : "manual_ok";

  // vertraege
  r.vertraege = contractCount === 0 ? "not_started" : "manual_ok";

  // expected_docs
  r.expected_docs = expectedDocCount === 0 ? "not_started" : "manual_ok";

  // banana
  r.banana = bananaRate === 0 ? "not_started" : bananaRate < 0.5 ? "partial" : bananaRate < 0.8 ? "manual_ok" : "prefill_ready";

  // autopilot
  r.autopilot = !autopilotConfig || !autopilotConfig.enabled ? "not_started"
    : evalCount > 10 ? "shadow_ready" : "manual_ok";

  return r;
}

export function computeReadinessScore(moduleReadiness: Record<string, ReadinessLevel>): number {
  const weights: Record<string, number> = {
    stammdaten: 2, belege: 2, lieferanten: 1, kontenplan: 2, bank: 1,
    mwst: 1, vertraege: 1, expected_docs: 1, banana: 1, autopilot: 1,
  };
  let totalWeight = 0;
  let weightedSum = 0;
  for (const [mod, level] of Object.entries(moduleReadiness)) {
    const w = weights[mod] || 1;
    totalWeight += w;
    weightedSum += READINESS_VALUES[level] * w;
  }
  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

async function checkFirstUsefulState(companyId: string, completedSteps: number[]): Promise<boolean> {
  if (!completedSteps.includes(1) || !completedSteps.includes(2)) return false;
  const [docCount, accountCount] = await Promise.all([
    prisma.document.count({ where: { companyId } }),
    prisma.account.count({ where: { companyId, isActive: true } }),
  ]);
  return docCount >= 20 && accountCount >= 10;
}
