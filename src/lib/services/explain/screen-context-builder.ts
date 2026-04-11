import { prisma } from "@/lib/db";

// ── Types ──

export interface ScreenContext {
  page: string;
  role: string;
  companyId: string;
  companyName: string;
  period: { year: number; month: number } | null;
  metrics: Record<string, number>;
  alerts: string[];
  openTasks: number;
  blockers: string[];
}

export interface ScreenExplanation {
  currentState: string;
  criticalItems: string[];
  nextSteps: string[];
  insights: string[];
}

// ── Context Builder ──

export async function buildScreenContext(
  page: string,
  companyId: string,
  role: string,
  periodYear?: number,
  periodMonth?: number
): Promise<ScreenContext> {
  const now = new Date();
  const year = periodYear || now.getFullYear();
  const month = periodMonth || now.getMonth() + 1;
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true },
  });

  const taskCount = await prisma.task.count({
    where: { companyId, status: { in: ["open", "in_progress"] } },
  });

  const ctx: ScreenContext = {
    page,
    role,
    companyId,
    companyName: company?.name || "—",
    period: { year, month },
    metrics: {},
    alerts: [],
    openTasks: taskCount,
    blockers: [],
  };

  if (page === "dashboard") {
    const [totalDocs, needsReview, failed, overdue] = await Promise.all([
      prisma.document.count({ where: { companyId, invoiceDate: { gte: monthStart, lt: monthEnd } } }),
      prisma.document.count({ where: { companyId, status: "needs_review" } }),
      prisma.document.count({ where: { companyId, status: "failed" } }),
      prisma.document.count({ where: { companyId, dueDate: { lt: now }, status: { notIn: ["rejected", "failed", "archived"] } } }),
    ]);
    ctx.metrics = { documentCount: totalDocs, pendingReview: needsReview, failedDocs: failed, overdueItems: overdue };
    if (failed > 0) ctx.alerts.push(`${failed} Belege im Fehlerzustand`);
    if (needsReview > 0) ctx.alerts.push(`${needsReview} Belege warten auf Prüfung`);
    if (overdue > 0) ctx.alerts.push(`${overdue} überfällige Posten`);

    const urgentTasks = await prisma.task.findMany({
      where: { companyId, status: "open", priority: { in: ["urgent", "high"] } },
      select: { title: true },
      take: 3,
    });
    ctx.blockers = urgentTasks.map((t) => t.title);

  } else if (page === "documents") {
    const statuses = await prisma.document.groupBy({
      by: ["status"],
      where: { companyId },
      _count: true,
    });
    const counts: Record<string, number> = {};
    let total = 0;
    for (const s of statuses) { counts[s.status] = s._count; total += s._count; }
    ctx.metrics = {
      totalDocs: total,
      uploaded: counts.uploaded || 0,
      processing: counts.processing || 0,
      needsReview: counts.needs_review || 0,
      ready: (counts.ready || 0) + (counts.exported || 0),
      exported: counts.exported || 0,
      failed: counts.failed || 0,
    };
    if (ctx.metrics.failed > 0) ctx.alerts.push(`${ctx.metrics.failed} Belege im Fehlerzustand`);
    if (ctx.metrics.needsReview > 0) ctx.alerts.push(`${ctx.metrics.needsReview} Belege warten auf Prüfung`);

    const stuckCount = await prisma.document.count({
      where: { companyId, status: "processing", updatedAt: { lt: oneHourAgo } },
    });
    if (stuckCount > 0) ctx.blockers.push(`${stuckCount} Belege hängen in Verarbeitung (>1h)`);

  } else if (page === "periods") {
    const [openPeriods, closedPeriods] = await Promise.all([
      prisma.monthlyPeriod.count({ where: { companyId, status: { in: ["open", "incomplete", "review_ready", "closing"] } } }),
      prisma.monthlyPeriod.count({ where: { companyId, status: { in: ["closed", "locked"] } } }),
    ]);
    ctx.metrics = { openPeriods, closedPeriods };

    // Quality score for current month
    try {
      const { getQualityScore } = await import("@/lib/services/quality/period-quality");
      const score = await getQualityScore(companyId, year, month);
      ctx.metrics.qualityScore = score;
      if (score < 50) ctx.alerts.push(`Qualitätsscore kritisch: ${score}/100`);
    } catch {}

    const unexported = await prisma.document.count({
      where: { companyId, invoiceDate: { gte: monthStart, lt: monthEnd }, status: "ready", exportStatus: "not_exported" },
    });
    if (unexported > 0) ctx.alerts.push(`${unexported} Belege bereit aber nicht exportiert`);

  } else if (page === "vat") {
    const vatReturns = await prisma.vatReturn.findMany({
      where: { companyId },
      select: {
        status: true, quarter: true, year: true,
        steuer302: true, steuer312: true, steuer342: true, steuer382: true,
        ziffer400: true, ziffer405: true, ziffer410: true, ziffer415: true, ziffer420: true,
        warnings: true,
      },
    });
    const draft = vatReturns.filter((v) => v.status === "draft");
    const validated = vatReturns.filter((v) => v.status === "validated" || v.status === "approved");
    let totalZahllast = 0;
    for (const vr of vatReturns) {
      const tax = Number(vr.steuer302) + Number(vr.steuer312) + Number(vr.steuer342) + Number(vr.steuer382);
      const input = Number(vr.ziffer400) + Number(vr.ziffer405) + Number(vr.ziffer410) + Number(vr.ziffer415) - Number(vr.ziffer420);
      totalZahllast += tax - input;
    }
    ctx.metrics = { draftReturns: draft.length, validatedReturns: validated.length, totalZahllast: Math.round(totalZahllast * 100) / 100 };
    for (const d of draft) ctx.alerts.push(`Q${d.quarter}/${d.year} nicht validiert`);
    const withErrors = vatReturns.filter((v) => {
      const w = v.warnings as any[];
      return w && w.some((x: any) => x.severity === "error");
    });
    for (const v of withErrors) ctx.blockers.push(`Q${v.quarter}/${v.year}: Validierungsfehler`);

  } else if (page === "bank") {
    const [total, matched, unmatched] = await Promise.all([
      prisma.bankTransaction.count({ where: { companyId } }),
      prisma.bankTransaction.count({ where: { companyId, matchStatus: { in: ["auto_matched", "manual_matched"] } } }),
      prisma.bankTransaction.count({ where: { companyId, matchStatus: "unmatched" } }),
    ]);
    ctx.metrics = {
      totalTransactions: total,
      matched,
      unmatched,
      matchRate: total > 0 ? Math.round((matched / total) * 100) : 0,
    };
    if (unmatched > 0) ctx.alerts.push(`${unmatched} Transaktionen ungeklärt`);

  } else if (page === "suppliers") {
    const [totalSuppliers, unverified] = await Promise.all([
      prisma.supplier.count({ where: { companyId, isActive: true } }),
      prisma.supplier.count({ where: { companyId, isActive: true, isVerified: false } }),
    ]);
    const noVat = await prisma.supplier.count({
      where: { companyId, isActive: true, vatNumber: null },
    });
    ctx.metrics = { totalSuppliers, unverified, noVatNumber: noVat };
    if (unverified > 0) ctx.alerts.push(`${unverified} Lieferanten nicht verifiziert`);
    if (noVat > 0) ctx.alerts.push(`${noVat} Lieferanten ohne MwSt-Nr.`);

  } else {
    // Generic fallback
    const docCount = await prisma.document.count({
      where: { companyId, invoiceDate: { gte: monthStart, lt: monthEnd } },
    });
    ctx.metrics = { documentCount: docCount, openTasks: taskCount };
  }

  return ctx;
}

// ── Explanation Generator (rule-based, no AI call) ──

export function generateExplanation(ctx: ScreenContext): ScreenExplanation {
  const m = ctx.metrics;
  let currentState = "";
  const criticalItems: string[] = [...ctx.alerts];
  const nextSteps: string[] = [];
  const insights: string[] = [];

  // ── Current State ──
  switch (ctx.page) {
    case "dashboard":
      currentState = `Sie haben ${m.documentCount || 0} Belege im aktuellen Monat`;
      if (m.pendingReview) currentState += `, davon ${m.pendingReview} zur Prüfung`;
      if (m.qualityScore !== undefined) currentState += `. Qualitätsscore: ${m.qualityScore}/100`;
      currentState += ".";
      break;

    case "documents":
      currentState = `Insgesamt ${m.totalDocs || 0} Belege: ${m.ready || 0} bereit, ${m.needsReview || 0} zur Prüfung, ${m.processing || 0} in Verarbeitung, ${m.failed || 0} fehlgeschlagen.`;
      if (m.exported) currentState += ` ${m.exported} bereits exportiert.`;
      break;

    case "periods":
      currentState = `${m.openPeriods || 0} offene und ${m.closedPeriods || 0} abgeschlossene Perioden.`;
      if (m.qualityScore !== undefined) currentState += ` Aktuelle Periodenqualität: ${m.qualityScore}/100.`;
      break;

    case "vat":
      currentState = `${m.draftReturns || 0} Entwürfe, ${m.validatedReturns || 0} validierte Abrechnungen.`;
      if (m.totalZahllast) currentState += ` Gesamte Zahllast: CHF ${m.totalZahllast.toLocaleString("de-CH", { minimumFractionDigits: 2 })}.`;
      break;

    case "bank":
      currentState = `${m.totalTransactions || 0} Transaktionen, ${m.matched || 0} zugeordnet (${m.matchRate || 0}%), ${m.unmatched || 0} offen.`;
      break;

    case "suppliers":
      currentState = `${m.totalSuppliers || 0} aktive Lieferanten, ${m.unverified || 0} nicht verifiziert.`;
      break;

    default:
      currentState = `${m.documentCount || 0} Belege im aktuellen Monat, ${ctx.openTasks} offene Aufgaben.`;
  }

  // ── Critical Items ── (already populated from ctx.alerts)
  for (const b of ctx.blockers) {
    if (!criticalItems.includes(b)) criticalItems.push(b);
  }

  // ── Next Steps (priority order) ──
  if (m.failed > 0) nextSteps.push("Fehlgeschlagene Belege prüfen und erneut verarbeiten");
  if (m.needsReview > 0) nextSteps.push("Belege zur Prüfung freigeben");
  if (m.unmatched > 0) nextSteps.push("Bankabstimmung durchführen — ungeklärte Transaktionen zuordnen");
  if (m.draftReturns > 0) nextSteps.push("MwSt-Abrechnung validieren und freigeben");
  if (m.qualityScore !== undefined && m.qualityScore < 70) nextSteps.push("Periodenqualität verbessern (Score unter 70)");
  if (m.unverified > 0) nextSteps.push("Lieferanten verifizieren");
  if (ctx.openTasks > 0 && nextSteps.length < 3) nextSteps.push(`${ctx.openTasks} offene Aufgaben bearbeiten`);
  if (nextSteps.length === 0) nextSteps.push("Alles in Ordnung — keine dringenden Aufgaben");

  // ── Insights (only with real data) ──
  if (m.matchRate !== undefined && m.matchRate > 0) {
    if (m.matchRate >= 90) insights.push(`Ausgezeichnete Zuordnungsrate: ${m.matchRate}% der Transaktionen automatisch zugeordnet`);
    else if (m.matchRate < 50) insights.push(`Niedrige Zuordnungsrate: Nur ${m.matchRate}% — prüfen Sie die Matching-Regeln`);
  }

  if (m.totalSuppliers > 0 && m.noVatNumber > 0) {
    const pct = Math.round((m.noVatNumber / m.totalSuppliers) * 100);
    if (pct > 30) insights.push(`${pct}% Ihrer Lieferanten haben keine MwSt-Nummer hinterlegt`);
  }

  if (m.documentCount > 0 && m.exported !== undefined) {
    const exportRate = Math.round(((m.exported || 0) / m.documentCount) * 100);
    if (exportRate < 50 && m.documentCount > 5) insights.push(`Nur ${exportRate}% der Belege dieses Monats sind exportiert`);
  }

  return { currentState, criticalItems, nextSteps, insights };
}
