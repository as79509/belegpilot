"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle, CheckCircle2, XCircle, ArrowRight,
} from "lucide-react";
import { de } from "@/lib/i18n/de";
import { formatCurrency, formatRelativeTime, formatConfidence, getConfidenceColor } from "@/lib/i18n/format";
import { useCompany } from "@/lib/contexts/company-context";

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

interface CockpitData {
  alerts: Alert[];
  todayStats: { uploaded: number; reviewed: number; tasksDue: number; autoQuote: number };
  statusCounts: Record<string, number>;
  highRiskDocs: HighRiskDoc[];
  openTasks: OpenTask[];
  periods: { current: PeriodInfo | null; last: PeriodInfo | null };
  clientRiskBoard?: ClientRisk[];
}

const priorityOrder: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
const priorityColors: Record<string, string> = {
  urgent: "bg-red-100 text-red-800",
  high: "bg-orange-100 text-orange-800",
  medium: "bg-blue-100 text-blue-800",
  low: "bg-slate-100 text-slate-600",
};

const monthNames = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return de.greeting.morning;
  if (h < 18) return de.greeting.afternoon;
  return de.greeting.evening;
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

function periodStatusBadge(status: string) {
  const map: Record<string, string> = {
    open: "bg-blue-100 text-blue-800",
    incomplete: "bg-amber-100 text-amber-800",
    review_ready: "bg-purple-100 text-purple-800",
    closing: "bg-orange-100 text-orange-800",
    closed: "bg-green-100 text-green-800",
    locked: "bg-slate-100 text-slate-600",
  };
  return map[status] || "bg-slate-100 text-slate-600";
}

export default function DashboardPage() {
  const router = useRouter();
  const { switchCompany, isMultiCompany } = useCompany();
  const [data, setData] = useState<CockpitData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/cockpit")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch((e) => console.error("[Dashboard]", e))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-10 w-full" />
      <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-48" /><Skeleton className="h-48" /></div>
    </div>
  );

  const today = new Date().toLocaleDateString("de-CH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{getGreeting()}</h1>
        <p className="text-sm text-[var(--text-secondary)]">{today}</p>
      </div>

      {/* Bereich 1: Kritische Alerts-Leiste */}
      <AlertsBar alerts={data.alerts} />

      {/* Bereich 2: Mandanten-Risiko-Board (nur Multi-Company) */}
      {data.clientRiskBoard && data.clientRiskBoard.length > 1 && (
        <ClientRiskBoard clients={data.clientRiskBoard} onSwitch={switchCompany} />
      )}

      {/* Bereich 3: Heute-Panel */}
      <TodayPanel stats={data.todayStats} />

      {/* Bereich 4: Zwei-Spalten Arbeitsbereich */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <HighRiskDocsPanel docs={data.highRiskDocs} />
        <OpenTasksPanel tasks={data.openTasks} />
      </div>

      {/* Bereich 5: Perioden-Status */}
      <PeriodsPanel periods={data.periods} />
    </div>
  );
}

/* ---------- Bereich 1: Alerts ---------- */
function AlertsBar({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <span className="text-sm font-medium text-green-800">{de.cockpit.allGood}</span>
      </div>
    );
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
        <span className="font-medium text-[var(--text-secondary)]">Mandanten</span>
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
              {c.needsReview > 0 && <span className="text-orange-600">{c.needsReview} Belege</span>}
              {c.overdueTasks > 0 && <span className="text-red-600">{c.overdueTasks} Tasks</span>}
              <span className={`px-1 rounded ${periodStatusBadge(c.periodStatus)}`}>
                {de.periods.status[c.periodStatus] || c.periodStatus}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Bereich 3: Heute-Panel ---------- */
function TodayPanel({ stats }: { stats: CockpitData["todayStats"] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 rounded-lg bg-[var(--surface-secondary)] text-sm">
      <span><strong>{stats.uploaded}</strong> {de.cockpit.todayUploaded}</span>
      <span className="text-[var(--text-muted)]">&middot;</span>
      <span><strong>{stats.reviewed}</strong> {de.cockpit.todayReviewed}</span>
      <span className="text-[var(--text-muted)]">&middot;</span>
      <span><strong>{stats.tasksDue}</strong> {de.cockpit.tasksDueToday}</span>
      <span className="text-[var(--text-muted)]">&middot;</span>
      <span>{de.cockpit.autoQuote}: <strong>{stats.autoQuote}%</strong></span>
    </div>
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
          <p className="text-xs text-[var(--text-muted)] mt-1">Keine Periode angelegt</p>
        </CardContent>
      </Card>
    );
  }

  const monthName = monthNames[period.month - 1] || `Monat ${period.month}`;
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
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${periodStatusBadge(period.status)}`}>
            {de.periods.status[period.status] || period.status}
          </span>
        </div>

        {/* Mini checklist */}
        <div className="flex items-center gap-1">
          <span className={`h-2 w-2 rounded-full ${period.checklistComplete ? "bg-green-500" : "bg-amber-400"}`} />
          <span className="text-xs text-[var(--text-muted)]">
            {period.checklistComplete ? "Checkliste komplett" : "Checkliste offen"}
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
