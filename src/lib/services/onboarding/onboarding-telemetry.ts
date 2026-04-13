import { prisma } from "@/lib/db";

export interface OnboardingTelemetry {
  sessionId: string;
  companyId: string;

  // Wizard-Metriken
  totalDuration: number | null;
  timeToFirstUsefulState: number | null;
  stepsCompleted: number;
  stepsSkipped: number;
  stepDurations: Record<string, number>;

  // Chat-Metriken
  questionsAnswered: number;
  insightsGenerated: number;

  // Bootstrap-Metriken
  itemsGenerated: number;
  itemsConfirmed: number;
  itemsRejected: number;

  // Readiness
  finalReadinessScore: number;
  moduleReadinessAtGoLive: Record<string, string> | null;

  // Known Unknowns
  unknownsCreated: number;
  unknownsResolved: number;
  unknownsAccepted: number;
  unknownsOpenAtGoLive: number;

  // Post-Onboarding (erste 30 Tage)
  goLivePhase: string | null;
  correctionRateFirst30Days: number | null;
  suggestionAcceptanceRate: number | null;
}

export async function computeOnboardingTelemetry(companyId: string): Promise<OnboardingTelemetry> {
  const session = await prisma.onboardingSession.findUnique({ where: { companyId } });
  if (!session) {
    return emptyTelemetry(companyId);
  }

  const stepData = (session.stepData as Record<string, any>) || {};
  const completedSteps = (session.completedSteps as number[]) || [];

  // Total duration
  const totalDuration = session.goLiveAt
    ? Math.round((session.goLiveAt.getTime() - session.createdAt.getTime()) / 60000)
    : null;

  // Time to first useful state — estimate from step completion data
  let timeToFirstUsefulState: number | null = null;
  if (session.firstUsefulState) {
    // Approximate: time from creation to when steps 1+2 were completed
    const step2Data = stepData["2"];
    if (step2Data?.completedAt) {
      timeToFirstUsefulState = Math.round(
        (new Date(step2Data.completedAt).getTime() - session.createdAt.getTime()) / 60000
      );
    }
  }

  // Steps
  const totalSteps = 7;
  const stepsCompleted = completedSteps.length;
  const stepsSkipped = totalSteps - stepsCompleted;

  // Step durations
  const stepDurations: Record<string, number> = {};
  for (let i = 1; i <= totalSteps; i++) {
    const sd = stepData[String(i)];
    if (sd?.completedAt) {
      const prevStep = stepData[String(i - 1)];
      const startTime = prevStep?.completedAt
        ? new Date(prevStep.completedAt).getTime()
        : session.createdAt.getTime();
      stepDurations[String(i)] = Math.round(
        (new Date(sd.completedAt).getTime() - startTime) / 60000
      );
    }
  }

  // Chat metrics
  const chatData = stepData["4"] || {};
  const answeredQuestions = chatData.answeredQuestions || [];
  const questionsAnswered = answeredQuestions.length;

  // Insights from BusinessProfile
  const profile = await prisma.businessProfile.findUnique({ where: { companyId } });
  const insightsGenerated = Array.isArray(profile?.insights) ? (profile.insights as any[]).length : 0;

  // Bootstrap metrics
  const confirmedItems = Array.isArray(profile?.confirmedItems) ? (profile.confirmedItems as any[]).length : 0;
  const rejectedItems = Array.isArray(profile?.rejectedItems) ? (profile.rejectedItems as any[]).length : 0;
  const bootstrapSummary = stepData["5"]?.bootstrapSummary;
  const itemsGenerated = bootstrapSummary?.total || (confirmedItems + rejectedItems);

  // Known unknowns
  const [unknownsCreated, unknownsResolved, unknownsAccepted, unknownsOpenAtGoLive] = await Promise.all([
    prisma.onboardingKnownUnknown.count({ where: { sessionId: session.id } }),
    prisma.onboardingKnownUnknown.count({ where: { sessionId: session.id, status: "resolved" } }),
    prisma.onboardingKnownUnknown.count({ where: { sessionId: session.id, status: "accepted" } }),
    prisma.onboardingKnownUnknown.count({ where: { sessionId: session.id, status: "open" } }),
  ]);

  // Post-onboarding metrics (first 30 days since go-live)
  let correctionRateFirst30Days: number | null = null;
  let suggestionAcceptanceRate: number | null = null;

  if (session.goLiveAt) {
    const thirtyDaysAfter = new Date(session.goLiveAt.getTime() + 30 * 86400000);
    const cutoff = thirtyDaysAfter < new Date() ? thirtyDaysAfter : new Date();

    const [docCount, evalTotal, evalCorrect] = await Promise.all([
      prisma.document.count({
        where: { companyId, createdAt: { gte: session.goLiveAt, lte: cutoff } },
      }),
      prisma.suggestionEvaluation.count({
        where: { companyId, createdAt: { gte: session.goLiveAt, lte: cutoff } },
      }),
      prisma.suggestionEvaluation.count({
        where: { companyId, createdAt: { gte: session.goLiveAt, lte: cutoff }, overallCorrect: true },
      }),
    ]);

    if (docCount > 0 && evalTotal > 0) {
      correctionRateFirst30Days = Math.round((1 - evalCorrect / evalTotal) * 100);
    }
    if (evalTotal > 0) {
      suggestionAcceptanceRate = Math.round((evalCorrect / evalTotal) * 100);
    }
  }

  return {
    sessionId: session.id,
    companyId,
    totalDuration,
    timeToFirstUsefulState,
    stepsCompleted,
    stepsSkipped,
    stepDurations,
    questionsAnswered,
    insightsGenerated,
    itemsGenerated,
    itemsConfirmed: confirmedItems,
    itemsRejected: rejectedItems,
    finalReadinessScore: session.readinessScore || 0,
    moduleReadinessAtGoLive: (session.moduleReadiness as Record<string, string>) || null,
    unknownsCreated,
    unknownsResolved,
    unknownsAccepted,
    unknownsOpenAtGoLive,
    goLivePhase: session.goLivePhase,
    correctionRateFirst30Days,
    suggestionAcceptanceRate,
  };
}

function emptyTelemetry(companyId: string): OnboardingTelemetry {
  return {
    sessionId: "", companyId, totalDuration: null, timeToFirstUsefulState: null,
    stepsCompleted: 0, stepsSkipped: 7, stepDurations: {},
    questionsAnswered: 0, insightsGenerated: 0,
    itemsGenerated: 0, itemsConfirmed: 0, itemsRejected: 0,
    finalReadinessScore: 0, moduleReadinessAtGoLive: null,
    unknownsCreated: 0, unknownsResolved: 0, unknownsAccepted: 0, unknownsOpenAtGoLive: 0,
    goLivePhase: null, correctionRateFirst30Days: null, suggestionAcceptanceRate: null,
  };
}
