import { prisma } from "@/lib/db";

export const WIZARD_STEPS = [
  { step: 1, key: "basics",     label: "Grunddaten",           required: true },
  { step: 2, key: "accounting", label: "Steuer & Buchhaltung", required: true },
  { step: 3, key: "documents",  label: "Historische Belege",   required: false },
  { step: 4, key: "contracts",  label: "Vertr\u00e4ge",       required: false },
  { step: 5, key: "business",   label: "Gesch\u00e4ftsmodell", required: false },
  { step: 6, key: "review",     label: "Intelligenz pr\u00fcfen", required: true },
  { step: 7, key: "golive",     label: "Go-Live",              required: true },
] as const;

export interface WizardState {
  session: {
    id: string;
    companyId: string;
    currentStep: number;
    completedSteps: number[];
    stepData: Record<string, any>;
    status: string;
    readinessScore: number | null;
    lastActiveAt: string;
  };
  profile: any | null;
  currentStep: typeof WIZARD_STEPS[number];
  completedSteps: number[];
  canProceed: boolean;
  canGoLive: boolean;
  progress: number;
}

function buildState(
  session: any,
  profile: any | null
): WizardState {
  const completedSteps = (session.completedSteps as number[]) || [];
  const stepData = (session.stepData as Record<string, any>) || {};
  const currentStepDef = WIZARD_STEPS.find((s) => s.step === session.currentStep) || WIZARD_STEPS[0];

  // canProceed: check required fields for current step
  let canProceed = true;
  if (currentStepDef.step === 1) {
    const d = stepData["1"] || {};
    canProceed = !!(d.name && d.legalName && d.industry);
  } else if (currentStepDef.step === 2) {
    const d = stepData["2"] || {};
    canProceed = d.vatLiable !== undefined;
  } else if (currentStepDef.step === 6) {
    canProceed = !!profile;
  } else if (currentStepDef.step === 7) {
    canProceed = (session.readinessScore ?? 0) >= 0.3;
  }
  // Steps 3-5 are optional, always can proceed

  const canGoLive = (session.readinessScore ?? 0) >= 0.3 && completedSteps.includes(1) && completedSteps.includes(2);

  return {
    session: {
      id: session.id,
      companyId: session.companyId,
      currentStep: session.currentStep,
      completedSteps,
      stepData,
      status: session.status,
      readinessScore: session.readinessScore,
      lastActiveAt: session.lastActiveAt.toISOString(),
    },
    profile,
    currentStep: currentStepDef,
    completedSteps,
    canProceed,
    canGoLive,
    progress: completedSteps.length / WIZARD_STEPS.length,
  };
}

export async function getOrCreateSession(companyId: string, userId: string): Promise<WizardState> {
  let session = await prisma.onboardingSession.findUnique({
    where: { companyId },
    include: { businessProfile: true },
  });

  if (!session) {
    session = await prisma.onboardingSession.create({
      data: { companyId, startedBy: userId },
      include: { businessProfile: true },
    });
  } else {
    // Update lastActiveAt
    await prisma.onboardingSession.update({
      where: { id: session.id },
      data: { lastActiveAt: new Date() },
    });
  }

  return buildState(session, session.businessProfile);
}

export async function completeStep(
  sessionId: string,
  step: number,
  data: Record<string, any>
): Promise<WizardState> {
  const session = await prisma.onboardingSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: { businessProfile: true },
  });

  const completedSteps = (session.completedSteps as number[]) || [];
  if (!completedSteps.includes(step)) {
    completedSteps.push(step);
  }

  const stepData = (session.stepData as Record<string, any>) || {};
  stepData[String(step)] = data;

  const nextStep = Math.min(step + 1, WIZARD_STEPS.length);

  // Calculate readiness score
  const requiredSteps = WIZARD_STEPS.filter((s) => s.required).map((s) => s.step);
  const completedRequired = requiredSteps.filter((s) => completedSteps.includes(s)).length;
  const readinessScore = completedRequired / requiredSteps.length;

  const updated = await prisma.onboardingSession.update({
    where: { id: sessionId },
    data: {
      completedSteps: completedSteps as any,
      stepData: stepData as any,
      currentStep: nextStep,
      readinessScore,
      lastActiveAt: new Date(),
    },
    include: { businessProfile: true },
  });

  return buildState(updated, updated.businessProfile);
}

export async function navigateToStep(sessionId: string, step: number): Promise<WizardState> {
  if (step < 1 || step > WIZARD_STEPS.length) {
    throw new Error("Ung\u00fcltiger Schritt");
  }

  const session = await prisma.onboardingSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: { businessProfile: true },
  });

  const completedSteps = (session.completedSteps as number[]) || [];
  // Allow navigating to completed steps or the next uncompleted step
  const maxAllowed = Math.max(...completedSteps, 0) + 1;
  if (step > maxAllowed) {
    throw new Error("Schritt noch nicht freigeschaltet");
  }

  const updated = await prisma.onboardingSession.update({
    where: { id: sessionId },
    data: { currentStep: step, lastActiveAt: new Date() },
    include: { businessProfile: true },
  });

  return buildState(updated, updated.businessProfile);
}

export async function getSessionProgress(sessionId: string): Promise<WizardState> {
  const session = await prisma.onboardingSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: { businessProfile: true },
  });

  return buildState(session, session.businessProfile);
}
