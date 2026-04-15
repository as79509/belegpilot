"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle, CheckCircle2, XCircle, ArrowRight, Clock, Zap, Gauge, Sparkles, Settings,
  FileText, ListTodo, Upload, ChevronDown, Rocket, ScrollText, Brain, FileBarChart,
} from "lucide-react";
import { DashboardSkeleton } from "@/components/ds/page-skeleton";
import { de } from "@/lib/i18n/de";
import { formatCurrency, formatRelativeTime, formatConfidence, getConfidenceColor } from "@/lib/i18n/format";
import { useCompany } from "@/lib/contexts/company-context";
import { EntityHeader, StatusBadge, InfoPanel } from "@/components/ds";
import { useRecentItems } from "@/lib/hooks/use-recent-items";
import { useRole } from "@/lib/hooks/use-role";
import { typo } from "@/lib/design-tokens";

interface Alert {
  type: "error" | "warning";
  message: string;
  count: number;
  href: string;
}

interface HighRiskDoc {
  id: string;
  supplierName: string;
  grossAmount: number | null;
  currency: string | null;
  confidenceScore: number | null;
  createdAt: string;
  escalationReasons: string[];
}

interface OpenTask {
  id: string;
  title: string;
  taskType: string;
  priority: string;
  dueDate: string | null;
  relatedDocumentId: string | null;
}

interface PeriodInfo {
  month: number;
  year: number;
  status: string;
  documentsReceived: number;
  documentsExpected: number;
  checklistComplete: boolean;
}

interface ClientRisk {
  id: string;
  name: string;
  riskScore: number;
  needsReview: number;
  overdueTasks: number;
  overdueContracts: number;
  periodStatus: string;
  lastActivity: string | null;
}

interface WaitingTask {
  id: string;
  title: string;
  taskType: string;
  messageSentAt: string;
}

interface NextAction {
  type: string;
  priority: "high" | "medium" | "low";
  title: string;
  detail: string;
  targetType: string;
  targetId: string;
  targetUrl: string;
}

interface ReviewSpeed {
  todayReviewed: number;
  todayMinutes: number;
  avgSecondsPerDoc: number;
}

interface PersonalToday {
  reviewed: number;
  rulesCreated: number;
  suppliersVerified: number;
  suggestionsAccepted: number;
}

interface CockpitData {
  alerts: Alert[];
  todayStats: { uploaded: number; reviewed: number; tasksDue: number; autoQuote: number };
  statusCounts: Record<string, number>;
  highRiskDocs: HighRiskDoc[];
  openTasks: OpenTask[];
  periods: { current: PeriodInfo | null; last: PeriodInfo | null };
  clientRiskBoard?: ClientRisk[];
  waitingOnClient?: WaitingTask[];
  suggestionStats?: { total: number; accepted: number; rejected: number; modified: number; acceptRate: number };
  autopilotStats?: {
    eligible: number; blocked: number; total: number; eligibleRate: number;
    config: { enabled: boolean; mode: string; killSwitchActive: boolean };
  };
  nextActions?: NextAction[];
  reviewSpeed?: ReviewSpeed;
  personalToday?: PersonalToday;
  unpaidDocs?: { count: number; total: number; overdueCount: number };
  qualityScore?: number | null;
}

const priorityOrder: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
const priorityColors: Record<string, string> = {
  urgent: "bg-red-100 text-red-800",
  high: "bg-orange-100 text-orange-800",
  medium: "bg-blue-100 text-blue-800",
  low: "bg-slate-100 text-slate-600",
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return de.greeting.morning;
  if (h < 18) return de.greeting.afternoon;
  return de.greeting.evening;
}

function getGoLiveAutopilotLabel(mode: string | null | undefined): string {
  if (!mode) return de.common.noData;
  return de.autopilot.mode[mode as keyof typeof de.autopilot.mode] || mode;
}

function getGoLiveReviewLabel(level: string | null | undefined): string {
  if (!level) return de.common.noData;
  return de.dashboard.reviewLevels[level] || level;
}

function riskColor(score: number) {
  if (score <= 5) return "bg-green-500";
  if (score <= 15) return "bg-amber-500";
  return "bg-red-500";
}

function riskBadgeColor(score: number) {
  if (score <= 5) return "bg-green-100 text-green-800";
  if (score <= 15) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}

function confidenceBadge(score: number | null) {
  if (score == null) return "bg-slate-100 text-slate-600";
  if (score >= 0.8) return "bg-green-100 text-green-800";
  if (score >= 0.5) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}

interface AutopilotHealth {
  isCalibrated: boolean;
  coverage: number;
  acceptanceRate: number;
  driftAlerts: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const { switchCompany, isMultiCompany, activeCompany, capabilities } = useCompany();
  const { items: recentItems } = useRecentItems();
  const [data, setData] = useState<CockpitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [autopilotHealth, setAutopilotHealth] = useState<AutopilotHealth | null>(null);
  const [showSystemDetails, setShowSystemDetails] = useState(false);
  const [setupStatus, setSetupStatus] = useState<{ items: Array<{ id: string; label: string; status: string; helpText: string; setupUrl: string | null }>; completionRate: number; criticalMissing: string[] } | null>(null);
  const [goLiveStatus, setGoLiveStatus] = useState<any>(null);

  const { isViewer, isReviewer, isTrustee } = useRole();
  const canUseWorkQueues = isReviewer || isTrustee;
  const canUploadDocuments = capabilities?.canMutate?.documents ?? !isViewer;

  useEffect(() => {
    fetch("/api/dashboard/cockpit")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch((e) => console.error("[Dashboard]", e))
      .finally(() => setLoading(false));

    // Lightweight Autopilot Health snapshot from telemetry
    fetch("/api/telemetry?days=30")
      .then((r) => (r.ok ? r.json() : null))
      .then((t) => {
        if (!t) return;
        setAutopilotHealth({
          isCalibrated: !!t.calibration?.isCalibrated,
          coverage: t.suggestions?.coverage ?? 0,
          acceptanceRate: t.suggestions?.acceptanceRate ?? 0,
          driftAlerts: Array.isArray(t.drift?.alerts) ? t.drift.alerts.length : 0,
        });
      })
      .catch((e) => console.error("[Dashboard][Telemetry]", e));

    fetch("/api/setup/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => { if (s) setSetupStatus(s); })
      .catch(() => {});

    fetch("/api/onboarding/golive")
      .then((r) => r.ok ? r.json() : null)
      .then(setGoLiveStatus)
      .catch(() => {});
  }, []);

  if (loading || !data) return <DashboardSkeleton />;

  const today = new Date().toLocaleDateString("de-CH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const setupItems = Array.isArray(setupStatus?.items) ? setupStatus.items : [];
  const criticalMissingItems = Array.isArray(setupStatus?.criticalMissing) ? setupStatus.criticalMissing : [];
  const hasCriticalSetupItems = criticalMissingItems.length > 0;

  // Viewer: focused dashboard — upload, tasks, deadlines
  if (isViewer) {
    const uploaded = data.todayStats?.uploaded ?? 0;
    const reviewed = data.todayStats?.reviewed ?? 0;
    const tasksDue = data.todayStats?.tasksDue ?? 0;
    return (
      <div className="space-y-5">
        <EntityHeader title={getGreeting()} subtitle={today} />

        {/* Upload CTA */}
        {canUploadDocuments ? (
          <Link href="/documents">
            <Card className="border-blue-200 bg-blue-50 hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="pt-5 pb-5 flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <Upload className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-blue-900">{de.dashboard.uploadCtaTitle}</p>
                  <p className="text-sm text-blue-700">
                    {de.dashboard.uploadCtaSubtitle.replace("{count}", String(uploaded))}
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-blue-400" />
              </CardContent>
            </Card>
          </Link>
        ) : (
          <Card className="border-slate-200 bg-slate-50">
            <CardContent className="pt-5 pb-5 flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center">
                <FileText className="h-6 w-6 text-slate-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900">{de.dashboard.uploadReadOnlyTitle}</p>
                <p className="text-sm text-slate-700">{de.dashboard.uploadReadOnlySubtitle}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 3 Stat-Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-4 flex items-center gap-3">
              <ListTodo className="h-8 w-8 text-amber-500" />
              <div>
                <p className={typo("stat")}>{tasksDue}</p>
                <p className={typo("statLabel")}>{de.dashboard.tasksOpen}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <div>
                <p className={typo("stat")}>{reviewed}</p>
                <p className={typo("statLabel")}>{de.dashboard.processedDocuments}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 flex items-center gap-3">
              <Clock className="h-8 w-8 text-blue-500" />
              <div>
                <p className={typo("stat")}>{uploaded}</p>
                <p className={typo("statLabel")}>{de.dashboard.uploadedCount}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Setup-Widget */}
        {setupStatus && hasCriticalSetupItems && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Settings className="h-4 w-4" />
                {de.setup.finishSetup} ({setupItems.filter(i => i.status === "complete").length}/{setupItems.length})
              </h3>
              <div className="mt-2 space-y-1.5">
                {setupItems.filter(i => i.status !== "complete").map(item => (
                  <div key={item.id} className="flex items-center gap-2 text-sm">
                    <XCircle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span className="font-medium">{item.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Aufgaben-Liste (max 5) */}
        {data.openTasks && data.openTasks.length > 0 && (
          <OpenTasksPanel tasks={data.openTasks.slice(0, 5)} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Hero */}
      <EntityHeader title={getGreeting()} subtitle={today} />

      {/* Go-Live Hochlauf-Widget (prominent oben) */}
      {goLiveStatus && goLiveStatus.phase && goLiveStatus.phase !== "normal" && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Rocket className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-800">
                  {de.dashboard.phaseTitle}: {
                    de.dashboard.phases[goLiveStatus.phase as keyof typeof de.dashboard.phases] || goLiveStatus.phase
                  }
                </span>
              </div>
              <Badge variant="secondary">
                {de.dashboard.dayLabel.replace("{days}", String(goLiveStatus.daysActive))}
              </Badge>
            </div>
            <p className="text-xs text-blue-700 mt-1">
              {de.dashboard.autopilotLabel}: {getGoLiveAutopilotLabel(goLiveStatus.config.autopilotMode)} {" · "}
              {de.dashboard.reviewLabel}: {getGoLiveReviewLabel(goLiveStatus.config.reviewLevel)}
              {goLiveStatus.config.restrictedModules?.length > 0 && ` · ${de.dashboard.restrictedModules.replace("{count}", String(goLiveStatus.config.restrictedModules.length))}`}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Schnellzugriff (nur für Treuhänder/Admin) */}
      {canUseWorkQueues && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { label: de.dashboard.quickLinks.corrections, href: "/corrections", icon: AlertTriangle },
            { label: de.dashboard.quickLinks.auditLog, href: "/audit-log", icon: ScrollText },
            { label: de.dashboard.quickLinks.aiConfig, href: "/settings/ai", icon: Brain },
            { label: de.dashboard.quickLinks.monthlyReport, href: "/reports/monthly-summary", icon: FileBarChart },
          ].map(link => (
            <Link key={link.href} href={link.href}>
              <Card className="p-3 hover:shadow-sm transition-shadow cursor-pointer">
                <div className="flex items-center gap-2">
                  <link.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{link.label}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Heute erledigen (Treuhänder/Admin) */}
      {canUseWorkQueues && (
        <Card>
          <CardContent className="pt-4">
            <h3 className="text-sm font-semibold mb-3">{de.dashboard.todayHeading}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { label: de.dashboard.todayCards.needsReview, value: data.statusCounts?.needs_review ?? 0, href: "/documents?status=needs_review", color: (data.statusCounts?.needs_review ?? 0) > 0 ? "text-amber-600" : "text-muted-foreground" },
                { label: de.dashboard.todayCards.openTasks, value: data.todayStats?.tasksDue ?? 0, href: "/tasks", color: (data.todayStats?.tasksDue ?? 0) > 0 ? "text-blue-600" : "text-muted-foreground" },
                { label: de.dashboard.todayCards.uploaded, value: data.todayStats?.uploaded ?? 0, href: "/documents", color: "text-muted-foreground" },
                { label: de.dashboard.todayCards.exportReady, value: data.statusCounts?.ready ?? 0, href: "/exports", color: "text-muted-foreground" },
              ].map(item => (
                <Link key={item.href} href={item.href}>
                  <div className="p-3 rounded-md border hover:shadow-sm transition-shadow cursor-pointer text-center">
                    <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Kritische Alerts */}
      <AlertsBar alerts={data.alerts} />

      {/* Setup-Widget (nur wenn kritische Items fehlen) */}
      {setupStatus && hasCriticalSetupItems && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Settings className="h-4 w-4" />
              {de.setup.finishSetup} ({setupItems.filter(i => i.status === "complete").length}/{setupItems.length})
            </h3>
            <div className="mt-2 space-y-1.5">
              {setupItems.filter(i => i.status !== "complete").map(item => (
                <div key={item.id} className="flex items-center gap-2 text-sm">
                  <XCircle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span className="font-medium">{item.label}</span>
                  <span className="text-muted-foreground">{"\u2014"} {item.helpText.split(".")[0]}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bereich 2: Mandanten-Risiko-Board (nur Multi-Company) */}
      {data.clientRiskBoard && data.clientRiskBoard.length > 1 && (
        <ClientRiskBoard clients={data.clientRiskBoard} onSwitch={switchCompany} />
      )}

      {/* Bereich 3: Heute-Panel */}
      <TodayPanel stats={data.todayStats} suggestionStats={data.suggestionStats} autopilotStats={data.autopilotStats} />

      {/* Unbezahlte Belege (Phase 9.2.2) */}
      {data.unpaidDocs && data.unpaidDocs.count > 0 && (
        <UnpaidDocsPanel unpaid={data.unpaidDocs} />
      )}

      {/* Abschlussbereitschaft (Quality Score) */}
      {data.qualityScore != null && data.qualityScore < 70 && (
        <QualityScorePanel score={data.qualityScore} />
      )}

      {/* Bereich 3b: Empfohlene Aktionen */}
      <NextActionsPanel actions={data.nextActions || []} onNavigate={(url) => router.push(url)} />

      {/* Bereich 3c: Weiter wo du aufgehört hast */}
      {recentItems.length > 0 && (
        <RecentItemsPanel items={recentItems.slice(0, 3)} onNavigate={(url) => router.push(url)} />
      )}

      {/* Bereich 4: Zwei-Spalten Arbeitsbereich */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <HighRiskDocsPanel docs={data.highRiskDocs} />
        <OpenTasksPanel tasks={data.openTasks} />
      </div>

      {/* Bereich 5: Perioden-Status */}
      <PeriodsPanel periods={data.periods} />

      {/* System-Details (eingeklappt) */}
      {(data.reviewSpeed || autopilotHealth || data.personalToday || (data.waitingOnClient && data.waitingOnClient.length > 0)) && (
        <div>
          <button
            type="button"
            onClick={() => setShowSystemDetails(!showSystemDetails)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${showSystemDetails ? "" : "-rotate-90"}`} />
            {de.dashboard.systemDetails}
          </button>
          {showSystemDetails && (
            <div className="mt-3 space-y-4">
              {data.reviewSpeed && <ReviewSpeedMeter speed={data.reviewSpeed} />}
              {autopilotHealth && <AutopilotHealthIndicator health={autopilotHealth} />}
              {data.personalToday && <PersonalTodayCard today={data.personalToday} />}
              {data.waitingOnClient && data.waitingOnClient.length > 0 && (
                <WaitingOnClientPanel tasks={data.waitingOnClient} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Bereich 1: Alerts ---------- */
function AlertsBar({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) {
    return <InfoPanel tone="success" title={de.cockpit.allGood} />;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {alerts.map((a, i) => (
        <Link key={i} href={a.href}>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-opacity hover:opacity-80 ${
            a.type === "error" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
          }`}>
            {a.type === "error" ? <XCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
            {a.message}
          </span>
        </Link>
      ))}
    </div>
  );
}

/* ---------- Bereich 2: Client Risk Board ---------- */
function ClientRiskBoard({ clients, onSwitch }: { clients: ClientRisk[]; onSwitch: (id: string) => void }) {
  const critical = clients.filter((c) => c.riskScore >= 16).length;
  const ok = clients.length - critical;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 text-sm">
        <span className="font-medium text-[var(--text-secondary)]">{de.clients.title}</span>
        {critical > 0 && <Badge variant="destructive" className="text-xs">{critical} {de.cockpit.criticalClients}</Badge>}
        <Badge variant="secondary" className="text-xs">{ok} {de.cockpit.clientsOk}</Badge>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {clients.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onSwitch(c.id)}
            className="flex-shrink-0 w-48 rounded-lg border bg-white p-3 text-left hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium truncate">{c.name}</span>
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold ${riskBadgeColor(c.riskScore)}`}>
                {c.riskScore}
              </span>
            </div>
            <div className={`h-1 rounded-full mb-2 ${riskColor(c.riskScore)}`} />
            <div className="flex gap-2 text-xs text-[var(--text-muted)]">
              {c.needsReview > 0 && <span className="text-orange-600">{c.needsReview} {de.documentList.totalDocs}</span>}
              {c.overdueTasks > 0 && <span className="text-red-600">{c.overdueTasks} {de.dashboard.todayCards.openTasks}</span>}
              <StatusBadge type="period" value={c.periodStatus} icon={false} className="px-1 py-0" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Bereich 3: Heute-Panel ---------- */
function TodayPanel({
  stats,
  suggestionStats,
  autopilotStats,
}: {
  stats: CockpitData["todayStats"];
  suggestionStats?: CockpitData["suggestionStats"];
  autopilotStats?: CockpitData["autopilotStats"];
}) {
  const apLabel = !autopilotStats
    ? null
    : autopilotStats.config.killSwitchActive
    ? de.autopilot.killSwitchActive
    : !autopilotStats.config.enabled
    ? de.autopilot.disabled
    : `${de.autopilot.mode[autopilotStats.config.mode as "shadow" | "prefill" | "auto_ready"]} (${autopilotStats.eligibleRate}% ${de.autopilot.eligible.toLowerCase()})`;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 rounded-lg bg-[var(--surface-secondary)] text-sm">
      <span><strong>{stats.uploaded}</strong> {de.cockpit.todayUploaded}</span>
      <span className="text-[var(--text-muted)]">&middot;</span>
      <span><strong>{stats.reviewed}</strong> {de.cockpit.todayReviewed}</span>
      <span className="text-[var(--text-muted)]">&middot;</span>
      <span><strong>{stats.tasksDue}</strong> {de.cockpit.tasksDueToday}</span>
      <span className="text-[var(--text-muted)]">&middot;</span>
      <span>{de.cockpit.autoQuote}: <strong>{stats.autoQuote}%</strong></span>
      {suggestionStats && suggestionStats.total > 0 && (
        <>
          <span className="text-[var(--text-muted)]">&middot;</span>
          <span>{de.suggestions.panel.acceptRate}: <strong>{suggestionStats.acceptRate}%</strong></span>
        </>
      )}
      {apLabel && (
        <>
          <span className="text-[var(--text-muted)]">&middot;</span>
          <span>{de.autopilot.title}: <strong>{apLabel}</strong></span>
        </>
      )}
    </div>
  );
}

/* ---------- Bereich 3a: Autopilot Health Indikator ---------- */
function AutopilotHealthIndicator({ health }: { health: AutopilotHealth }) {
  const hasIssues = !health.isCalibrated || health.driftAlerts > 0;
  const toneClass = hasIssues
    ? "bg-amber-50 border-amber-200 text-amber-800"
    : "bg-green-50 border-green-200 text-green-800";
  const Icon = hasIssues ? AlertTriangle : CheckCircle2;
  const iconColor = hasIssues ? "text-amber-600" : "text-green-600";

  return (
    <Link
      href="/settings/control-center"
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 rounded-lg border text-xs font-medium transition-opacity hover:opacity-90 ${toneClass}`}
    >
      <Icon className={`h-4 w-4 ${iconColor}`} />
      <span className="font-semibold">{de.controlCenter.healthShort}:</span>
      <span>
        {health.isCalibrated ? de.controlCenter.healthGood : de.controlCenter.healthBad}
      </span>
      <span className="opacity-50">·</span>
      <span>
        {Math.round(health.coverage * 100)}% {de.controlCenter.coverageShort}
      </span>
      <span className="opacity-50">·</span>
      <span>
        {Math.round(health.acceptanceRate * 100)}% {de.controlCenter.acceptanceShort}
      </span>
      <span className="opacity-50">·</span>
      <span>
        {health.driftAlerts === 0
          ? de.controlCenter.noDriftShort
          : `${health.driftAlerts} ${de.controlCenter.driftShort}`}
      </span>
      <ArrowRight className="h-3 w-3 ml-auto" />
    </Link>
  );
}

/* ---------- Bereich 3b: Empfohlene Aktionen ---------- */
function NextActionsPanel({ actions, onNavigate }: { actions: NextAction[]; onNavigate: (url: string) => void }) {
  const top = actions.slice(0, 5);

  if (top.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <span className="text-sm font-medium text-green-800">{de.nextActions.noActions}</span>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" />
          {de.nextActions.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {top.map((action, i) => {
            const dotColor =
              action.priority === "high"
                ? "bg-red-500"
                : action.priority === "medium"
                ? "bg-amber-500"
                : "bg-slate-400";
            return (
              <button
                key={`${action.type}-${i}`}
                type="button"
                onClick={() => onNavigate(action.targetUrl)}
                className="w-full flex items-center gap-3 py-1.5 px-2 rounded hover:bg-[var(--surface-secondary)] transition-colors text-left"
              >
                <span className={`h-2 w-2 rounded-full shrink-0 ${dotColor}`} />
                <span className="text-xs flex-1 min-w-0 truncate">{action.title}</span>
                <span className="inline-flex items-center gap-1 text-xs text-blue-600 whitespace-nowrap">
                  {de.nextActions.goTo} <ArrowRight className="h-3 w-3" />
                </span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Bereich 3c: Weiter wo du aufgehört hast ---------- */
function RecentItemsPanel({
  items,
  onNavigate,
}: {
  items: { type: string; id: string; title: string; url: string; timestamp: number }[];
  onNavigate: (url: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-500" />
          {de.recentItems.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {items.map((item) => (
            <button
              key={`${item.type}-${item.id}`}
              type="button"
              onClick={() => onNavigate(item.url)}
              className="w-full flex items-center gap-3 py-1.5 px-2 rounded hover:bg-[var(--surface-secondary)] transition-colors text-left"
            >
              <span className="text-xs text-muted-foreground uppercase tracking-wide w-16 shrink-0">
                {item.type === "document"
                  ? de.dashboard.recentItemTypes.document
                  : item.type === "supplier"
                  ? de.dashboard.recentItemTypes.supplier
                  : item.type}
              </span>
              <span className="text-xs flex-1 min-w-0 truncate">{item.title}</span>
              <ArrowRight className="h-3 w-3 text-blue-600" />
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Bereich 4a: Hochrisiko-Belege ---------- */
function HighRiskDocsPanel({ docs }: { docs: HighRiskDoc[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{de.cockpit.highRiskDocs}</CardTitle>
      </CardHeader>
      <CardContent>
        {docs.length === 0 ? (
          <div className="flex items-center gap-2 py-3 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            {de.cockpit.noHighRisk}
          </div>
        ) : (
          <div className="space-y-1">
            {docs.map((doc) => (
              <Link key={doc.id} href={`/documents/${doc.id}`} className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-[var(--surface-secondary)] transition-colors">
                <span className="text-xs truncate flex-1 min-w-0">{doc.supplierName}</span>
                <span className="text-xs font-medium whitespace-nowrap">{formatCurrency(doc.grossAmount, doc.currency || "CHF")}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${confidenceBadge(doc.confidenceScore)}`}>
                  {formatConfidence(doc.confidenceScore)}
                </span>
                {doc.escalationReasons.length > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 truncate max-w-[120px]">
                    {doc.escalationReasons[0]}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------- Bereich 4b: Offene Pendenzen ---------- */
function OpenTasksPanel({ tasks }: { tasks: OpenTask[] }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{de.cockpit.openTasks}</CardTitle>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <div className="flex items-center gap-2 py-3 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            {de.cockpit.noOpenTasks}
          </div>
        ) : (
          <div className="space-y-1">
            {tasks.map((task) => {
              const isOverdue = task.dueDate && new Date(task.dueDate) < today;
              return (
                <Link key={task.id} href="/tasks" className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-[var(--surface-secondary)] transition-colors">
                  <span className="text-xs truncate flex-1 min-w-0">{task.title}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${priorityColors[task.priority] || priorityColors.medium}`}>
                    {de.tasksMgmt.priorities[task.priority] || task.priority}
                  </span>
                  {task.dueDate && (
                    <span className={`text-xs whitespace-nowrap ${isOverdue ? "text-red-600 font-medium" : "text-[var(--text-muted)]"}`}>
                      {new Date(task.dueDate).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit" })}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------- Wartet auf Mandant ---------- */
function WaitingOnClientPanel({ tasks }: { tasks: WaitingTask[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-500" />
          {de.cockpit.waitingOnClient}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {tasks.map((task) => {
            const sentDays = Math.floor((Date.now() - new Date(task.messageSentAt).getTime()) / 86400000);
            return (
              <div key={task.id} className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-[var(--surface-secondary)] transition-colors">
                <span className="text-xs truncate flex-1 min-w-0">{task.title}</span>
                <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">
                  {de.cockpit.sentAgo.replace("{days}", String(sentDays))}
                </span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                  {de.tasksMgmt.taskTypes[task.taskType] || task.taskType}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Bereich 5: Perioden-Status ---------- */
function PeriodsPanel({ periods }: { periods: CockpitData["periods"] }) {
  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
      <PeriodCard label={de.cockpit.currentPeriod} period={periods.current} />
      <PeriodCard label={de.cockpit.lastPeriod} period={periods.last} />
    </div>
  );
}

function PeriodCard({ label, period }: { label: string; period: PeriodInfo | null }) {
  if (!period) {
    return (
      <Card>
        <CardContent className="py-3">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">{de.dashboard.noPeriod}</p>
        </CardContent>
      </Card>
    );
  }

  const monthName =
    de.dashboard.monthNames[period.month - 1] ||
    de.dashboard.monthFallback.replace("{month}", String(period.month));
  const progress = period.documentsExpected > 0
    ? Math.round((period.documentsReceived / period.documentsExpected) * 100)
    : 0;

  return (
    <Card>
      <CardContent className="py-3 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{label}</p>
            <p className="text-xs text-[var(--text-muted)]">{monthName} {period.year}</p>
          </div>
          <StatusBadge type="period" value={period.status} />
        </div>

        {/* Mini checklist */}
        <div className="flex items-center gap-1">
          <span className={`h-2 w-2 rounded-full ${period.checklistComplete ? "bg-green-500" : "bg-amber-400"}`} />
          <span className="text-xs text-[var(--text-muted)]">
            {period.checklistComplete ? de.dashboard.checklistComplete : de.dashboard.checklistOpen}
          </span>
        </div>

        {/* Document progress */}
        {period.documentsExpected > 0 && (
          <div>
            <div className="flex justify-between text-xs text-[var(--text-muted)] mb-0.5">
              <span>{de.periods.documentsProgress}</span>
              <span>{period.documentsReceived}/{period.documentsExpected}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
            </div>
          </div>
        )}

        <Link href="/periods" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors">
          {de.periods.title} <ArrowRight className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  );
}

/* ---------- Review Speed Meter ---------- */
function ReviewSpeedMeter({ speed }: { speed: ReviewSpeed }) {
  if (speed.todayReviewed === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--surface-secondary)] text-sm text-[var(--text-muted)]">
        <Gauge className="h-4 w-4" />
        <span>{de.reviewSpeed.nothingYet}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-sm">
      <Gauge className="h-4 w-4 text-blue-600" />
      <span className="font-semibold text-blue-900">{de.reviewSpeed.todayLine}:</span>
      <span>
        <strong>{speed.todayReviewed}</strong> {de.reviewSpeed.docs}
      </span>
      <span className="text-[var(--text-muted)]">·</span>
      <span>
        {de.reviewSpeed.reviewedIn} <strong>{speed.todayMinutes}</strong> {de.reviewSpeed.minutes}
      </span>
      <span className="text-[var(--text-muted)]">·</span>
      <span>{de.reviewSpeed.avgPerDoc.replace("{sec}", String(speed.avgSecondsPerDoc))}</span>
    </div>
  );
}

/* ---------- Personal Today Cockpit ---------- */
function PersonalTodayCard({ today }: { today: PersonalToday }) {
  const items: Array<{ label: string; value: number }> = [
    { label: de.reviewSpeed.reviewed, value: today.reviewed },
    { label: de.reviewSpeed.rulesCreated, value: today.rulesCreated },
    { label: de.reviewSpeed.suppliersVerified, value: today.suppliersVerified },
    { label: de.reviewSpeed.suggestionsAccepted, value: today.suggestionsAccepted },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          {de.reviewSpeed.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {items.map((it) => (
            <div key={it.label} className="rounded-md bg-[var(--surface-secondary)] px-3 py-2">
              <p className="text-xs text-[var(--text-muted)]">{it.label}</p>
              <p className="text-lg font-semibold mt-0.5">{it.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Phase 9.2.2: Unpaid Documents Panel
function UnpaidDocsPanel({ unpaid }: { unpaid: { count: number; total: number; overdueCount: number } }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{de.payment.unpaidDocs}</p>
            <p className={`${typo("stat")} mt-1`}>
              {unpaid.count} <span className={typo("statLabel")}>({formatCurrency(unpaid.total, "CHF")})</span>
            </p>
          </div>
          {unpaid.overdueCount > 0 && (
            <div className="flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <div className="text-sm">
                <span className="font-medium text-amber-800">{unpaid.overdueCount} {de.payment.overdueWarning}</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Phase 9.5.2: Quality Score Panel
function QualityScorePanel({ score }: { score: number }) {
  const isCritical = score < 50;
  return (
    <Card className={isCritical ? "border-red-200" : "border-amber-200"}>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{de.quality.closingReadiness}</p>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex h-2 w-24 rounded-full overflow-hidden bg-gray-100">
                <div
                  className={isCritical ? "bg-red-500" : "bg-amber-500"}
                  style={{ width: `${score}%` }}
                />
              </div>
              <span className={`${typo("sectionTitle")} font-mono`}>{score}/100</span>
            </div>
          </div>
          {isCritical ? (
            <div className="flex items-center gap-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium text-red-800">{de.quality.levels.critical}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-800">{de.quality.levels.acceptable}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
