"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle, CheckCircle2, XCircle, ArrowRight, Clock, Zap, Gauge, Sparkles, Settings,
  FileText, ListTodo, Upload, ChevronDown, ChevronRight, Calendar, TrendingUp, Bell,
  BarChart3, Receipt, Wallet, Building2,
} from "lucide-react";
import { de } from "@/lib/i18n/de";
import { formatCurrency, formatRelativeTime, formatConfidence, getConfidenceColor } from "@/lib/i18n/format";
import { useCompany } from "@/lib/contexts/company-context";
import { StatusBadge } from "@/components/ds";
import { useRecentItems } from "@/lib/hooks/use-recent-items";

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

const priorityColors: Record<string, string> = {
  urgent: "bg-red-50 text-red-700 border-red-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  medium: "bg-blue-50 text-blue-700 border-blue-200",
  low: "bg-slate-50 text-slate-600 border-slate-200",
};

const monthNames = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return de.greeting.morning;
  if (h < 18) return de.greeting.afternoon;
  return de.greeting.evening;
}

function riskColor(score: number) {
  if (score <= 5) return "bg-emerald-500";
  if (score <= 15) return "bg-amber-500";
  return "bg-red-500";
}

function riskBadgeColor(score: number) {
  if (score <= 5) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (score <= 15) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-red-50 text-red-700 border-red-200";
}

function confidenceBadge(score: number | null) {
  if (score == null) return "bg-slate-50 text-slate-600 border-slate-200";
  if (score >= 0.8) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (score >= 0.5) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-red-50 text-red-700 border-red-200";
}

interface AutopilotHealth {
  isCalibrated: boolean;
  coverage: number;
  acceptanceRate: number;
  driftAlerts: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const { switchCompany, isMultiCompany, activeCompany } = useCompany();
  const { items: recentItems } = useRecentItems();
  const [data, setData] = useState<CockpitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [autopilotHealth, setAutopilotHealth] = useState<AutopilotHealth | null>(null);
  const [showSystemDetails, setShowSystemDetails] = useState(false);
  const [setupStatus, setSetupStatus] = useState<{ items: Array<{ id: string; label: string; status: string; helpText: string; setupUrl: string | null }>; completionRate: number; criticalMissing: string[] } | null>(null);

  const role = activeCompany?.role || "";
  const isViewer = role === "viewer" || role === "readonly";

  useEffect(() => {
    fetch("/api/dashboard/cockpit")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch((e) => console.error("[Dashboard]", e))
      .finally(() => setLoading(false));

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
  }, []);

  if (loading || !data) return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-72" />
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-36 rounded-xl" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );

  const today = new Date().toLocaleDateString("de-CH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // Viewer: simplified dashboard
  if (isViewer) {
    return <ViewerDashboard data={data} setupStatus={setupStatus} today={today} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)] tracking-tight">{getGreeting()}</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">{today}</p>
        </div>
        {data.alerts.length > 0 && (
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-amber-500" />
            <span className="text-sm text-[var(--text-secondary)]">{data.alerts.length} Hinweise</span>
          </div>
        )}
      </div>

      {/* Hero Cards - Clemta Style */}
      <div className="grid gap-4 md:grid-cols-3">
        <HeroCard
          title="Getting Started"
          subtitle={setupStatus ? `${setupStatus.items.filter(i => i.status === "complete").length}/${setupStatus.items.length} completed` : "Setup prüfen"}
          description={setupStatus?.criticalMissing[0] || "Alle Schritte abgeschlossen"}
          icon={Settings}
          gradient="dark"
          href="/settings"
          actionLabel="Fill the form"
        />
        <HeroCard
          title="Tax Events and Reminders"
          subtitle={data.periods.current ? `${monthNames[data.periods.current.month - 1]} ${data.periods.current.year}` : "Keine Periode"}
          description={data.todayStats.tasksDue > 0 ? `${data.todayStats.tasksDue} Aufgaben fällig` : "Keine fälligen Aufgaben"}
          icon={Calendar}
          gradient="amber"
          href="/periods"
          actionLabel="Go to calendar"
        />
        <HeroCard
          title="Services Progress"
          subtitle={`${data.todayStats.autoQuote}% Automatisierung`}
          description={`${data.todayStats.reviewed} Belege heute geprüft`}
          icon={TrendingUp}
          gradient="blue"
          href="/documents"
          actionLabel="View service details"
        />
      </div>

      {/* Alerts */}
      {data.alerts.length > 0 && <AlertsBar alerts={data.alerts} />}

      {/* Setup Widget */}
      {setupStatus && setupStatus.criticalMissing.length > 0 && (
        <SetupWidget setupStatus={setupStatus} />
      )}

      {/* Client Risk Board */}
      {data.clientRiskBoard && data.clientRiskBoard.length > 1 && (
        <ClientRiskBoard clients={data.clientRiskBoard} onSwitch={switchCompany} />
      )}

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left Column - 3/5 */}
        <div className="lg:col-span-3 space-y-6">
          {/* Getting Started Checklist */}
          {setupStatus && (
            <GettingStartedPanel setupStatus={setupStatus} />
          )}

          {/* Service Progress */}
          <ServiceProgressPanel 
            stats={data.todayStats} 
            autopilotStats={data.autopilotStats}
            suggestionStats={data.suggestionStats}
          />

          {/* High Risk Documents */}
          <HighRiskDocsPanel docs={data.highRiskDocs} />
        </div>

        {/* Right Column - 2/5 */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tax Events & Reminders */}
          <TaxEventsPanel periods={data.periods} tasks={data.openTasks} />

          {/* Accounts Summary */}
          {data.unpaidDocs && data.unpaidDocs.count > 0 && (
            <AccountsPanel unpaid={data.unpaidDocs} />
          )}

          {/* Next Actions */}
          <NextActionsPanel actions={data.nextActions || []} onNavigate={(url) => router.push(url)} />
        </div>
      </div>

      {/* System Details (collapsed) */}
      {(data.reviewSpeed || autopilotHealth || data.personalToday || (data.waitingOnClient && data.waitingOnClient.length > 0)) && (
        <div className="pt-4 border-t border-[var(--border-default)]">
          <button
            type="button"
            onClick={() => setShowSystemDetails(!showSystemDetails)}
            className="flex items-center gap-2 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${showSystemDetails ? "" : "-rotate-90"}`} />
            System-Details anzeigen
          </button>
          {showSystemDetails && (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
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

/* ============================================
   PREMIUM COMPONENTS
   ============================================ */

function HeroCard({
  title,
  subtitle,
  description,
  icon: Icon,
  gradient,
  href,
  actionLabel,
}: {
  title: string;
  subtitle: string;
  description: string;
  icon: any;
  gradient: "dark" | "blue" | "amber" | "green";
  href: string;
  actionLabel: string;
}) {
  const gradientClasses = {
    dark: "bg-gradient-to-br from-slate-800 to-slate-900",
    blue: "bg-gradient-to-br from-blue-500 to-blue-600",
    amber: "bg-gradient-to-br from-amber-500 to-orange-500",
    green: "bg-gradient-to-br from-emerald-500 to-emerald-600",
  };

  return (
    <Link href={href} className="group">
      <div className={`relative overflow-hidden rounded-xl p-5 ${gradientClasses[gradient]} text-white transition-all hover:shadow-lg hover:scale-[1.02]`}>
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-lg bg-white/20">
              <Icon className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium opacity-90">{title}</span>
          </div>
          <p className="text-xs text-white/70 mb-1">{subtitle}</p>
          <p className="text-sm font-medium mb-4">{description}</p>
          <div className="flex items-center gap-1 text-xs text-white/80 group-hover:text-white transition-colors">
            {actionLabel}
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      </div>
    </Link>
  );
}

function ViewerDashboard({
  data,
  setupStatus,
  today,
}: {
  data: CockpitData;
  setupStatus: any;
  today: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text-primary)] tracking-tight">{getGreeting()}</h1>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">{today}</p>
      </div>

      {setupStatus && setupStatus.criticalMissing.length > 0 && (
        <SetupWidget setupStatus={setupStatus} />
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-[var(--border-default)]">
          <CardContent className="pt-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-50">
              <Upload className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--text-primary)]">{data.todayStats.uploaded}</p>
              <p className="text-sm text-[var(--text-tertiary)]">Hochgeladen</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[var(--border-default)]">
          <CardContent className="pt-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-50">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--text-primary)]">{data.todayStats.reviewed}</p>
              <p className="text-sm text-[var(--text-tertiary)]">Geprüft</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[var(--border-default)]">
          <CardContent className="pt-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-amber-50">
              <ListTodo className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--text-primary)]">{data.todayStats.tasksDue}</p>
              <p className="text-sm text-[var(--text-tertiary)]">Offene Aufgaben</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {data.openTasks && data.openTasks.length > 0 && (
        <OpenTasksPanel tasks={data.openTasks} />
      )}
    </div>
  );
}

function AlertsBar({ alerts }: { alerts: Alert[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {alerts.map((a, i) => (
        <Link key={i} href={a.href}>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all hover:shadow-sm ${
            a.type === "error" 
              ? "bg-red-50 text-red-700 border border-red-200" 
              : "bg-amber-50 text-amber-700 border border-amber-200"
          }`}>
            {a.type === "error" ? <XCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
            {a.message}
          </span>
        </Link>
      ))}
    </div>
  );
}

function SetupWidget({ setupStatus }: { setupStatus: any }) {
  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardContent className="pt-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-amber-100">
            <Settings className="h-5 w-5 text-amber-700" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--text-primary)]">
              {de.setup.finishSetup}
            </h3>
            <p className="text-xs text-[var(--text-tertiary)]">
              {setupStatus.items.filter((i: any) => i.status === "complete").length}/{setupStatus.items.length} abgeschlossen
            </p>
          </div>
        </div>
        <div className="space-y-2">
          {setupStatus.items.filter((i: any) => i.status !== "complete").slice(0, 3).map((item: any) => (
            <div key={item.id} className="flex items-center gap-2 text-sm">
              <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              <span className="font-medium text-[var(--text-secondary)]">{item.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ClientRiskBoard({ clients, onSwitch }: { clients: ClientRisk[]; onSwitch: (id: string) => void }) {
  const critical = clients.filter((c) => c.riskScore >= 16).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Mandanten</h2>
        <div className="flex gap-2">
          {critical > 0 && (
            <Badge variant="outline" className="text-xs border-red-200 bg-red-50 text-red-700">
              {critical} kritisch
            </Badge>
          )}
          <Badge variant="outline" className="text-xs border-emerald-200 bg-emerald-50 text-emerald-700">
            {clients.length - critical} OK
          </Badge>
        </div>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {clients.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onSwitch(c.id)}
            className="flex-shrink-0 w-52 rounded-xl border border-[var(--border-default)] bg-white p-4 text-left hover:shadow-md hover:border-[var(--border-strong)] transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-[var(--text-primary)] truncate">{c.name}</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${riskBadgeColor(c.riskScore)}`}>
                {c.riskScore}
              </span>
            </div>
            <div className={`h-1 rounded-full mb-3 ${riskColor(c.riskScore)}`} />
            <div className="flex flex-wrap gap-2 text-xs">
              {c.needsReview > 0 && (
                <span className="text-orange-600">{c.needsReview} Belege</span>
              )}
              {c.overdueTasks > 0 && (
                <span className="text-red-600">{c.overdueTasks} Tasks</span>
              )}
              <StatusBadge type="period" value={c.periodStatus} icon={false} className="px-1.5 py-0.5" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function GettingStartedPanel({ setupStatus }: { setupStatus: any }) {
  const completed = setupStatus.items.filter((i: any) => i.status === "complete").length;
  const total = setupStatus.items.length;

  return (
    <Card className="border-[var(--border-default)]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            <CardTitle className="text-sm font-semibold">Getting Started</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-tertiary)]">{completed}/{total} completed</span>
            <div className="w-16 h-1.5 rounded-full bg-[var(--surface-tertiary)]">
              <div 
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${(completed / total) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {setupStatus.items.slice(0, 4).map((item: any, i: number) => (
            <div key={item.id} className="flex items-start gap-3 py-2">
              <div className={`mt-0.5 h-5 w-5 rounded-full flex items-center justify-center text-xs font-medium ${
                item.status === "complete" 
                  ? "bg-emerald-100 text-emerald-600" 
                  : "bg-[var(--surface-tertiary)] text-[var(--text-muted)]"
              }`}>
                {item.status === "complete" ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${item.status === "complete" ? "text-[var(--text-tertiary)] line-through" : "text-[var(--text-primary)]"}`}>
                  {item.label}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{item.helpText.split(".")[0]}</p>
              </div>
              {item.status !== "complete" && item.setupUrl && (
                <Link href={item.setupUrl}>
                  <Button variant="outline" size="sm" className="text-xs h-7">
                    Fill the form
                  </Button>
                </Link>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ServiceProgressPanel({
  stats,
  autopilotStats,
  suggestionStats,
}: {
  stats: CockpitData["todayStats"];
  autopilotStats?: CockpitData["autopilotStats"];
  suggestionStats?: CockpitData["suggestionStats"];
}) {
  const services = [
    {
      title: "Company Formation",
      status: "In Progress",
      description: "From anywhere in the world, our complete platform simplifies the USA company registration.",
    },
    {
      title: "Federal Tax Filing",
      status: "In Progress",
      description: `Effortlessly navigate the complexities of federal taxes with BelegPilot&apos;s expert guidance and advanced tools.`,
    },
    {
      title: "Bank Account Application",
      status: autopilotStats?.config.enabled ? "Action Required" : "In Progress",
      description: "If you're not a US resident and want to open a bank account in USA without leaving your home",
      highlight: autopilotStats?.config.enabled,
    },
  ];

  return (
    <Card className="border-[var(--border-default)]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-blue-500" />
            <CardTitle className="text-sm font-semibold">Service progress</CardTitle>
          </div>
          <Link href="/documents" className="text-xs text-blue-600 hover:text-blue-700 transition-colors">
            See more services
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-1">
        {/* Today Stats */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 rounded-lg bg-[var(--surface-secondary)] text-sm mb-4">
          <span><strong>{stats.uploaded}</strong> {de.cockpit.todayUploaded}</span>
          <span className="text-[var(--text-muted)]">·</span>
          <span><strong>{stats.reviewed}</strong> {de.cockpit.todayReviewed}</span>
          <span className="text-[var(--text-muted)]">·</span>
          <span>{de.cockpit.autoQuote}: <strong>{stats.autoQuote}%</strong></span>
          {suggestionStats && suggestionStats.total > 0 && (
            <>
              <span className="text-[var(--text-muted)]">·</span>
              <span>{de.suggestions.panel.acceptRate}: <strong>{suggestionStats.acceptRate}%</strong></span>
            </>
          )}
        </div>

        {/* Service Items */}
        {services.map((service, i) => (
          <Link key={i} href="/documents" className="group">
            <div className={`flex items-center justify-between py-3 px-3 rounded-lg transition-colors ${
              service.highlight ? "bg-amber-50 border border-amber-200" : "hover:bg-[var(--surface-secondary)]"
            }`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-[var(--text-primary)]">{service.title}</span>
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${
                      service.status === "Action Required" 
                        ? "border-amber-300 bg-amber-100 text-amber-700" 
                        : "border-blue-200 bg-blue-50 text-blue-700"
                    }`}
                  >
                    {service.status}
                  </Badge>
                </div>
                <p className="text-xs text-[var(--text-tertiary)] truncate">{service.description}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition-colors" />
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

function TaxEventsPanel({ periods, tasks }: { periods: CockpitData["periods"]; tasks: OpenTask[] }) {
  const today = new Date();
  const currentWeek = getWeekDates(today);
  const upcomingTasks = tasks.filter(t => t.dueDate).slice(0, 3);

  return (
    <Card className="border-[var(--border-default)]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-amber-500" />
            <CardTitle className="text-sm font-semibold">Tax Events and Reminders</CardTitle>
          </div>
          <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* Filter Chips */}
        <div className="flex gap-2">
          {["All Event", "Today", "Day", "Week", "Month"].map((filter, i) => (
            <button
              key={filter}
              type="button"
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                i === 0 
                  ? "bg-[var(--text-primary)] text-white" 
                  : "bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:bg-[var(--surface-tertiary)]"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Mini Calendar */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <ChevronRight className="h-4 w-4 text-[var(--text-muted)] rotate-180" />
            <span className="text-sm font-medium">{today.toLocaleDateString("de-CH", { month: "short", year: "2-digit" })}</span>
            <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
              <div key={day} className="text-xs text-[var(--text-muted)] py-1">{day}</div>
            ))}
            {currentWeek.map((date, i) => {
              const isToday = date.getDate() === today.getDate();
              return (
                <div
                  key={i}
                  className={`text-sm py-2 rounded-lg ${
                    isToday 
                      ? "bg-blue-500 text-white font-semibold" 
                      : "text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)]"
                  }`}
                >
                  {date.getDate()}
                  {isToday && <div className="w-1 h-1 rounded-full bg-white mx-auto mt-0.5" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="space-y-2">
          {upcomingTasks.length > 0 ? upcomingTasks.map((task) => (
            <Link key={task.id} href="/tasks" className="flex items-start gap-3 py-2 hover:bg-[var(--surface-secondary)] rounded-lg px-2 -mx-2 transition-colors">
              <Badge variant="outline" className="text-xs mt-0.5 border-blue-200 bg-blue-50 text-blue-700">
                {task.dueDate ? new Date(task.dueDate).toLocaleDateString("de-CH", { day: "2-digit", month: "short" }) : "TBD"}
              </Badge>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)] truncate">{task.title}</p>
                <p className="text-xs text-[var(--text-muted)]">{de.tasksMgmt.taskTypes[task.taskType] || task.taskType}</p>
              </div>
            </Link>
          )) : (
            <div className="text-center py-4 text-sm text-[var(--text-muted)]">
              Keine anstehenden Ereignisse
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AccountsPanel({ unpaid }: { unpaid: { count: number; total: number; overdueCount: number } }) {
  return (
    <Card className="border-[var(--border-default)]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-emerald-500" />
            <CardTitle className="text-sm font-semibold">Accounts</CardTitle>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs h-7">
              <ArrowRight className="h-3 w-3 mr-1 rotate-45" />
              Transfer
            </Button>
            <Button variant="outline" size="sm" className="text-xs h-7">
              + Create Account
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Link href="/bank" className="flex items-center justify-between py-3 hover:bg-[var(--surface-secondary)] rounded-lg px-2 -mx-2 transition-colors">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-100">
              <Building2 className="h-4 w-4 text-slate-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">Credit</p>
              {unpaid.overdueCount > 0 && (
                <p className="text-xs text-amber-600">{unpaid.overdueCount} überfällig</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              {formatCurrency(unpaid.total, "CHF")}
            </span>
            <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}

function HighRiskDocsPanel({ docs }: { docs: HighRiskDoc[] }) {
  return (
    <Card className="border-[var(--border-default)]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <CardTitle className="text-sm font-semibold">{de.cockpit.highRiskDocs}</CardTitle>
          </div>
          <Link href="/documents?confidence=low" className="text-xs text-blue-600 hover:text-blue-700 transition-colors">
            Alle anzeigen
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {docs.length === 0 ? (
          <div className="flex items-center gap-3 py-4 px-3 rounded-lg bg-emerald-50">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-700">{de.cockpit.noHighRisk}</span>
          </div>
        ) : (
          <div className="space-y-1">
            {docs.slice(0, 5).map((doc) => (
              <Link 
                key={doc.id} 
                href={`/documents/${doc.id}`} 
                className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-[var(--surface-secondary)] transition-colors -mx-3"
              >
                <FileText className="h-4 w-4 text-[var(--text-muted)]" />
                <span className="text-sm text-[var(--text-primary)] truncate flex-1 min-w-0">{doc.supplierName}</span>
                <span className="text-sm font-medium text-[var(--text-secondary)] whitespace-nowrap">
                  {formatCurrency(doc.grossAmount, doc.currency || "CHF")}
                </span>
                <Badge variant="outline" className={`text-xs border ${confidenceBadge(doc.confidenceScore)}`}>
                  {formatConfidence(doc.confidenceScore)}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OpenTasksPanel({ tasks }: { tasks: OpenTask[] }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <Card className="border-[var(--border-default)]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-blue-500" />
            <CardTitle className="text-sm font-semibold">{de.cockpit.openTasks}</CardTitle>
          </div>
          <Link href="/tasks" className="text-xs text-blue-600 hover:text-blue-700 transition-colors">
            Alle anzeigen
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {tasks.length === 0 ? (
          <div className="flex items-center gap-3 py-4 px-3 rounded-lg bg-emerald-50">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-700">{de.cockpit.noOpenTasks}</span>
          </div>
        ) : (
          <div className="space-y-1">
            {tasks.slice(0, 5).map((task) => {
              const isOverdue = task.dueDate && new Date(task.dueDate) < today;
              return (
                <Link 
                  key={task.id} 
                  href="/tasks" 
                  className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-[var(--surface-secondary)] transition-colors -mx-3"
                >
                  <div className={`h-2 w-2 rounded-full ${isOverdue ? "bg-red-500" : "bg-blue-500"}`} />
                  <span className="text-sm text-[var(--text-primary)] truncate flex-1 min-w-0">{task.title}</span>
                  <Badge variant="outline" className={`text-xs border ${priorityColors[task.priority] || priorityColors.medium}`}>
                    {de.tasksMgmt.priorities[task.priority] || task.priority}
                  </Badge>
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

function NextActionsPanel({ actions, onNavigate }: { actions: NextAction[]; onNavigate: (url: string) => void }) {
  const top = actions.slice(0, 5);

  if (top.length === 0) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/50">
        <CardContent className="pt-5">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-700">{de.nextActions.noActions}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[var(--border-default)]">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" />
          <CardTitle className="text-sm font-semibold">{de.nextActions.title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
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
                className="w-full flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-[var(--surface-secondary)] transition-colors text-left -mx-3"
              >
                <span className={`h-2 w-2 rounded-full shrink-0 ${dotColor}`} />
                <span className="text-sm text-[var(--text-primary)] flex-1 min-w-0 truncate">{action.title}</span>
                <span className="inline-flex items-center gap-1 text-xs text-blue-600 whitespace-nowrap font-medium">
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

function WaitingOnClientPanel({ tasks }: { tasks: WaitingTask[] }) {
  return (
    <Card className="border-[var(--border-default)]">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-500" />
          <CardTitle className="text-sm font-semibold">{de.cockpit.waitingOnClient}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-1">
          {tasks.map((task) => {
            const sentDays = Math.floor((Date.now() - new Date(task.messageSentAt).getTime()) / 86400000);
            return (
              <div key={task.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-[var(--surface-secondary)] transition-colors -mx-3">
                <span className="text-sm text-[var(--text-primary)] truncate flex-1 min-w-0">{task.title}</span>
                <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">
                  {de.cockpit.sentAgo.replace("{days}", String(sentDays))}
                </span>
                <Badge variant="outline" className="text-xs border-slate-200 bg-slate-50 text-slate-600">
                  {de.tasksMgmt.taskTypes[task.taskType] || task.taskType}
                </Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function ReviewSpeedMeter({ speed }: { speed: ReviewSpeed }) {
  if (speed.todayReviewed === 0) {
    return (
      <Card className="border-[var(--border-default)]">
        <CardContent className="pt-5">
          <div className="flex items-center gap-3 text-[var(--text-muted)]">
            <Gauge className="h-5 w-5" />
            <span className="text-sm">{de.reviewSpeed.nothingYet}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardContent className="pt-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <Gauge className="h-5 w-5 text-blue-600" />
          <span className="font-semibold text-blue-900">{de.reviewSpeed.todayLine}:</span>
          <span><strong>{speed.todayReviewed}</strong> {de.reviewSpeed.docs}</span>
          <span className="text-[var(--text-muted)]">·</span>
          <span>{de.reviewSpeed.reviewedIn} <strong>{speed.todayMinutes}</strong> {de.reviewSpeed.minutes}</span>
          <span className="text-[var(--text-muted)]">·</span>
          <span>{de.reviewSpeed.avgPerDoc.replace("{sec}", String(speed.avgSecondsPerDoc))}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function AutopilotHealthIndicator({ health }: { health: AutopilotHealth }) {
  const hasIssues = !health.isCalibrated || health.driftAlerts > 0;

  return (
    <Link href="/settings/control-center">
      <Card className={`border ${hasIssues ? "border-amber-200 bg-amber-50/50" : "border-emerald-200 bg-emerald-50/50"} hover:shadow-sm transition-shadow`}>
        <CardContent className="pt-5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            {hasIssues ? (
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            )}
            <span className={`font-semibold ${hasIssues ? "text-amber-900" : "text-emerald-900"}`}>
              {de.controlCenter.healthShort}:
            </span>
            <span>{health.isCalibrated ? de.controlCenter.healthGood : de.controlCenter.healthBad}</span>
            <span className="text-[var(--text-muted)]">·</span>
            <span>{Math.round(health.coverage * 100)}% {de.controlCenter.coverageShort}</span>
            <span className="text-[var(--text-muted)]">·</span>
            <span>{Math.round(health.acceptanceRate * 100)}% {de.controlCenter.acceptanceShort}</span>
            <ArrowRight className="h-4 w-4 ml-auto text-[var(--text-muted)]" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function PersonalTodayCard({ today }: { today: PersonalToday }) {
  const items = [
    { label: de.reviewSpeed.reviewed, value: today.reviewed },
    { label: de.reviewSpeed.rulesCreated, value: today.rulesCreated },
    { label: de.reviewSpeed.suppliersVerified, value: today.suppliersVerified },
    { label: de.reviewSpeed.suggestionsAccepted, value: today.suggestionsAccepted },
  ];

  return (
    <Card className="border-[var(--border-default)]">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <CardTitle className="text-sm font-semibold">{de.reviewSpeed.title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-3">
          {items.map((it) => (
            <div key={it.label} className="rounded-lg bg-[var(--surface-secondary)] px-3 py-3">
              <p className="text-xs text-[var(--text-muted)]">{it.label}</p>
              <p className="text-xl font-semibold text-[var(--text-primary)] mt-1">{it.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Helper function to get week dates
function getWeekDates(date: Date): Date[] {
  const week: Date[] = [];
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay());
  
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    week.push(d);
  }
  return week;
}
