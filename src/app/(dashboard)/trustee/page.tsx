"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, CheckCircle2, AlertTriangle, Link2 } from "lucide-react";
import { de } from "@/lib/i18n/de";
import { formatRelativeTime } from "@/lib/i18n/format";
import { useCompany } from "@/lib/contexts/company-context";

interface CompanyOverview {
  id: string;
  name: string;
  stats: { needs_review: number; ready: number; failed: number; exported: number; total: number };
  progress: number;
  lastUpload: string | null;
  bexioConfigured: boolean;
  riskScore: number;
  overdueTasks: number;
  overdueContracts: number;
  currentPeriodStatus: string | null;
  criticalIssue: string | null;
}

function riskBarColor(score: number) {
  if (score <= 5) return "bg-green-500";
  if (score <= 15) return "bg-amber-500";
  return "bg-red-500";
}

function riskBadgeColor(score: number) {
  if (score <= 5) return "bg-green-100 text-green-800";
  if (score <= 15) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}

function periodStatusBadge(status: string | null) {
  if (!status) return "bg-slate-100 text-slate-600";
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

function getCriticalIssue(c: CompanyOverview): string | null {
  if (c.overdueContracts > 0) return `${c.overdueContracts} ${de.contracts.overdue}`;
  if (c.overdueTasks > 0) return `${c.overdueTasks} ${de.cockpit.overdueTasks}`;
  if (c.stats.failed > 0) return `${c.stats.failed} ${de.cockpit.failedDocs}`;
  if (c.stats.needs_review > 0) return `${c.stats.needs_review} ${de.cockpit.reviewNeeded}`;
  return null;
}

export default function TrusteePage() {
  const { switchCompany } = useCompany();
  const [companies, setCompanies] = useState<CompanyOverview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/trustee/overview")
      .then((r) => r.json())
      .then((d) => {
        const sorted = (d.companies || []).sort((a: CompanyOverview, b: CompanyOverview) => b.riskScore - a.riskScore);
        setCompanies(sorted);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const criticalCount = companies.filter((c) => c.riskScore >= 16).length;
  const okCount = companies.length - criticalCount;
  const totalOpen = companies.reduce((s, c) => s + c.stats.needs_review, 0);
  const totalReady = companies.reduce((s, c) => s + c.stats.ready, 0);
  const totalFailed = companies.reduce((s, c) => s + c.stats.failed, 0);

  if (loading) return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-10 w-full" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-48" /><Skeleton className="h-48" />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{de.trustee.overview}</h1>
        <Badge variant="secondary">{companies.length} {de.trustee.allCompanies}</Badge>
      </div>

      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-3 px-3 py-2 rounded-lg bg-[var(--surface-secondary)] text-sm">
        {criticalCount > 0 && (
          <Badge variant="destructive" className="text-xs">{criticalCount} {de.cockpit.criticalClients}</Badge>
        )}
        <Badge variant="secondary" className="text-xs">{okCount} {de.cockpit.clientsOk}</Badge>
        <span className="text-[var(--text-muted)]">&middot;</span>
        <span className="text-orange-600">{totalOpen} {de.trustee.openDocuments}</span>
        <span className="text-green-600">{totalReady} {de.trustee.readyDocuments}</span>
        {totalFailed > 0 && <span className="text-red-600">{totalFailed} fehlgeschlagen</span>}
      </div>

      {/* Company cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {companies.map((c) => {
          const criticalIssue = getCriticalIssue(c);

          return (
            <Card key={c.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-4 space-y-3">
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <button type="button" onClick={() => switchCompany(c.id)} className="text-lg font-semibold hover:text-blue-600 transition-colors text-left">
                    {c.name}
                  </button>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${riskBadgeColor(c.riskScore)}`}>
                      {de.cockpit.riskScore}: {c.riskScore}
                    </span>
                    {c.bexioConfigured ? (
                      <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs"><Link2 className="h-3 w-3 mr-0.5" />Bexio</Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-gray-100 text-xs">Kein Bexio</Badge>
                    )}
                  </div>
                </div>

                {/* Risk bar */}
                <div className={`h-1.5 rounded-full ${riskBarColor(c.riskScore)}`} style={{ width: `${Math.min(Math.max(c.riskScore * 3, 5), 100)}%` }} />

                {/* Stats row */}
                <div className="flex gap-4 text-sm">
                  <span className="text-orange-600 font-medium">{c.stats.needs_review} offen</span>
                  <span className="text-green-600">{c.stats.ready} bereit</span>
                  {c.stats.failed > 0 && <span className="text-red-600">{c.stats.failed} fehlgeschlagen</span>}
                  <span className="text-slate-500">{c.stats.exported} exportiert</span>
                </div>

                {/* Extended info: overdue tasks, period status, critical issue */}
                <div className="flex flex-wrap gap-3 text-xs">
                  {c.overdueTasks > 0 && (
                    <span className="text-red-600 font-medium">{c.overdueTasks} {de.cockpit.overdueTasks}</span>
                  )}
                  {c.currentPeriodStatus && (
                    <span className={`px-1.5 py-0.5 rounded ${periodStatusBadge(c.currentPeriodStatus)}`}>
                      {de.periods.status[c.currentPeriodStatus] || c.currentPeriodStatus}
                    </span>
                  )}
                </div>

                {/* Critical issue */}
                {criticalIssue && (
                  <div className="flex items-center gap-1.5 text-xs text-red-700 bg-red-50 rounded px-2 py-1">
                    <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                    <span>{de.cockpit.criticalIssue}: {criticalIssue}</span>
                  </div>
                )}

                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>{de.trustee.progress}</span>
                    <span>{c.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${c.progress}%` }} />
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{de.trustee.lastUpload}: {c.lastUpload ? formatRelativeTime(c.lastUpload) : de.trustee.never}</span>
                  {c.stats.needs_review > 0 && (
                    <Button size="sm" variant="outline" onClick={() => { switchCompany(c.id); }}>
                      {de.trustee.startReview}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
