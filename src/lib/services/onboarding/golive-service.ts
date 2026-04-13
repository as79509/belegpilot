import { prisma } from "@/lib/db";
import { computeModuleReadiness, computeReadinessScore } from "./wizard-service";
import { checkGoLiveReadiness } from "./golive-check";
import { logAudit } from "@/lib/services/audit/audit-service";
import { createNotification } from "@/lib/services/notifications/notification-service";

export type GoLivePhase = "go_live_started" | "first_week" | "first_30_days" | "stabilized" | "normal";

export interface GoLiveConfig {
  autopilotMode: "shadow" | "prefill" | "auto_ready";
  reviewLevel: "strict" | "normal" | "minimal";
  monitoringLevel: "high" | "normal" | "low";
  activatedModules: string[];
  restrictedModules: string[];
  disabledModules: string[];
}

export interface GoLiveStatus {
  phase: GoLivePhase;
  startedAt: string;
  config: GoLiveConfig;
  daysActive: number;
  nextPhaseAt: string | null;
  nextPhaseLabel: string | null;
  readinessScore: number;
  moduleReadiness: Record<string, string>;
  openTasksCount: number;
  openUnknownsCount: number;
  recommendations: string[];
}

const PHASE_ORDER: GoLivePhase[] = ["go_live_started", "first_week", "first_30_days", "stabilized", "normal"];

const PHASE_LABELS: Record<GoLivePhase, string> = {
  go_live_started: "Go-Live gestartet",
  first_week: "Erste Woche",
  first_30_days: "Erste 30 Tage",
  stabilized: "Stabilisiert",
  normal: "Normaler Betrieb",
};

// Days after goLiveAt when each phase starts
const PHASE_THRESHOLDS: Record<GoLivePhase, number> = {
  go_live_started: 0,
  first_week: 1,
  first_30_days: 7,    // 7 Tage
  stabilized: 30,      // 30 Tage
  normal: 60,          // 60 Tage
};

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

function getExpectedPhase(daysActive: number): GoLivePhase {
  if (daysActive >= PHASE_THRESHOLDS.normal) return "normal";
  if (daysActive >= PHASE_THRESHOLDS.stabilized) return "stabilized";
  if (daysActive >= PHASE_THRESHOLDS.first_30_days) return "first_30_days";
  if (daysActive >= PHASE_THRESHOLDS.first_week) return "first_week";
  return "go_live_started";
}

function getNextPhaseDate(goLiveAt: Date, currentPhase: GoLivePhase): Date | null {
  const idx = PHASE_ORDER.indexOf(currentPhase);
  if (idx < 0 || idx >= PHASE_ORDER.length - 1) return null;
  const nextPhase = PHASE_ORDER[idx + 1];
  const daysUntil = PHASE_THRESHOLDS[nextPhase];
  const date = new Date(goLiveAt);
  date.setDate(date.getDate() + daysUntil);
  return date;
}

function buildConfigForPhase(phase: GoLivePhase, baseConfig: GoLiveConfig): GoLiveConfig {
  const config = { ...baseConfig, activatedModules: [...baseConfig.activatedModules], restrictedModules: [...baseConfig.restrictedModules], disabledModules: [...baseConfig.disabledModules] };
  switch (phase) {
    case "go_live_started":
    case "first_week":
      config.reviewLevel = "strict";
      config.monitoringLevel = "high";
      break;
    case "first_30_days":
      // first_week → first_30_days: reviewLevel strict → normal
      config.reviewLevel = "normal";
      config.monitoringLevel = "high";
      break;
    case "stabilized":
      // first_30_days → stabilized: monitoringLevel high → normal
      config.reviewLevel = "normal";
      config.monitoringLevel = "normal";
      break;
    case "normal":
      // stabilized → normal: alles auf normal/minimal
      config.reviewLevel = "minimal";
      config.monitoringLevel = "low";
      break;
  }
  return config;
}

function getRecommendations(phase: GoLivePhase): string[] {
  switch (phase) {
    case "go_live_started":
    case "first_week":
      return [
        "Alle Autopilot-Vorschläge manuell prüfen",
        "Erste Belege kontrollieren",
      ];
    case "first_30_days":
      return [
        "Drift-Detection beobachten",
        "Korrektur-Rate überwachen",
        "Offene Fragen klären",
      ];
    case "stabilized":
      return [
        "Autopilot-Modus erhöhen wenn Korrektur-Rate < 10%",
        "Banana Round Trip testen",
      ];
    case "normal":
      return [
        "Normaler Betrieb — alle Systeme aktiv",
      ];
  }
}

export async function startGoLive(companyId: string, sessionId: string): Promise<GoLiveStatus> {
  const check = await checkGoLiveReadiness(companyId, sessionId);
  if (!check.canGoLive) {
    throw new Error("Go-Live blockiert: " + check.blockers.join(", "));
  }

  const moduleReadiness = check.moduleReadiness;
  const readinessScore = check.readinessScore;

  // Categorize modules
  const activatedModules: string[] = [];
  const restrictedModules: string[] = [];
  const disabledModules: string[] = [];
  for (const [mod, level] of Object.entries(moduleReadiness)) {
    if (level === "not_started") {
      disabledModules.push(mod);
    } else if (level === "partial") {
      restrictedModules.push(mod);
    } else {
      activatedModules.push(mod);
    }
  }

  const config: GoLiveConfig = {
    autopilotMode: check.recommendedGoLiveConfig.autopilotMode,
    reviewLevel: check.recommendedGoLiveConfig.reviewLevel,
    monitoringLevel: check.recommendedGoLiveConfig.monitoringLevel,
    activatedModules,
    restrictedModules,
    disabledModules,
  };

  // Set AutopilotConfig to recommended mode
  await prisma.autopilotConfig.upsert({
    where: { companyId },
    update: { mode: config.autopilotMode, enabled: true },
    create: { companyId, mode: config.autopilotMode, enabled: true },
  });

  // Update OnboardingSession
  await prisma.onboardingSession.update({
    where: { id: sessionId },
    data: {
      status: "completed",
      goLiveAt: new Date(),
      goLivePhase: "go_live_started",
      goLiveConfig: config as any,
      readinessScore,
      moduleReadiness: moduleReadiness as any,
    },
  });

  // Notification
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } });
  await createNotification({
    companyId,
    type: "onboarding_go_live",
    title: "Go-Live gestartet",
    body: `Mandant ${company?.name || companyId} ist live — Hochlaufphase gestartet`,
    severity: "success",
    link: "/onboarding/wizard",
  });

  // Audit
  await logAudit({
    companyId,
    userId: null,
    action: "onboarding_go_live",
    entityType: "onboarding_session",
    entityId: sessionId,
    changes: { goLivePhase: { before: null, after: "go_live_started" } },
  });

  return (await getGoLiveStatus(companyId))!;
}

export async function getGoLiveStatus(companyId: string): Promise<GoLiveStatus | null> {
  const session = await prisma.onboardingSession.findUnique({ where: { companyId } });
  if (!session || !session.goLivePhase || !session.goLiveAt) return null;

  const daysActive = daysBetween(session.goLiveAt, new Date());
  const currentPhase = session.goLivePhase as GoLivePhase;
  const expectedPhase = getExpectedPhase(daysActive);

  // Auto-advance through all phases that should have been reached
  const currentIdx = PHASE_ORDER.indexOf(currentPhase);
  const expectedIdx = PHASE_ORDER.indexOf(expectedPhase);
  if (expectedIdx > currentIdx) {
    for (let i = currentIdx; i < expectedIdx; i++) {
      await advanceGoLivePhase(companyId);
    }
  }

  // Re-read session after potential advances
  const updated = await prisma.onboardingSession.findUnique({ where: { companyId } });
  return buildGoLiveStatus(updated!.id);
}

export async function advanceGoLivePhase(companyId: string): Promise<GoLiveStatus | null> {
  const session = await prisma.onboardingSession.findUniqueOrThrow({ where: { companyId } });
  const currentPhase = (session.goLivePhase || "go_live_started") as GoLivePhase;
  const currentIdx = PHASE_ORDER.indexOf(currentPhase);

  if (currentIdx >= PHASE_ORDER.length - 1) {
    return buildGoLiveStatus(session.id);
  }

  const newPhase = PHASE_ORDER[currentIdx + 1];
  const currentConfig = (session.goLiveConfig as any as GoLiveConfig) || {
    autopilotMode: "shadow",
    reviewLevel: "strict",
    monitoringLevel: "high",
    activatedModules: [],
    restrictedModules: [],
    disabledModules: [],
  };

  const newConfig = buildConfigForPhase(newPhase, currentConfig);

  // Update autopilot config if mode changed
  if (newConfig.autopilotMode !== currentConfig.autopilotMode) {
    const autopilot = await prisma.autopilotConfig.findUnique({ where: { companyId } });
    if (autopilot) {
      await prisma.autopilotConfig.update({
        where: { companyId },
        data: { mode: newConfig.autopilotMode },
      });
    }
  }

  await prisma.onboardingSession.update({
    where: { id: session.id },
    data: {
      goLivePhase: newPhase,
      goLiveConfig: newConfig as any,
    },
  });

  // Notification
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } });
  await createNotification({
    companyId,
    type: "onboarding_phase_advance",
    title: "Hochlaufphase aktualisiert",
    body: `Mandant ${company?.name || companyId}: Phase '${PHASE_LABELS[newPhase]}' erreicht`,
    severity: "info",
    link: "/onboarding/wizard",
  });

  // Audit
  await logAudit({
    companyId,
    userId: null,
    action: "onboarding_phase_advance",
    entityType: "onboarding_session",
    entityId: session.id,
    changes: { goLivePhase: { before: currentPhase, after: newPhase } },
  });

  return buildGoLiveStatus(session.id);
}

async function buildGoLiveStatus(sessionId: string): Promise<GoLiveStatus> {
  const session = await prisma.onboardingSession.findUniqueOrThrow({ where: { id: sessionId } });
  const phase = (session.goLivePhase || "go_live_started") as GoLivePhase;
  const goLiveAt = session.goLiveAt!;
  const daysActive = daysBetween(goLiveAt, new Date());
  const config = (session.goLiveConfig as any as GoLiveConfig) || {
    autopilotMode: "shadow", reviewLevel: "strict", monitoringLevel: "high",
    activatedModules: [], restrictedModules: [], disabledModules: [],
  };

  const nextPhaseDate = getNextPhaseDate(goLiveAt, phase);
  const nextIdx = PHASE_ORDER.indexOf(phase) + 1;
  const nextPhaseLabel = nextIdx < PHASE_ORDER.length ? PHASE_LABELS[PHASE_ORDER[nextIdx]] : null;

  // Open tasks + unknowns count
  const [openTasksCount, openUnknownsCount] = await Promise.all([
    prisma.task.count({ where: { companyId: session.companyId, status: "open" } }),
    prisma.onboardingKnownUnknown.count({ where: { sessionId, status: "open" } }),
  ]);

  return {
    phase,
    startedAt: goLiveAt.toISOString(),
    config,
    daysActive,
    nextPhaseAt: nextPhaseDate?.toISOString() || null,
    nextPhaseLabel,
    readinessScore: session.readinessScore || 0,
    moduleReadiness: (session.moduleReadiness as Record<string, string>) || {},
    openTasksCount,
    openUnknownsCount,
    recommendations: getRecommendations(phase),
  };
}
