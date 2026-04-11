"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Building2, CheckCircle2, AlertTriangle, Link2, BarChart3, ChevronDown, ChevronRight } from "lucide-react";
import { de } from "@/lib/i18n/de";
import { formatRelativeTime } from "@/lib/i18n/format";
import { InfoPanel } from "@/components/ds";
import { useCompany } from "@/lib/contexts/company-context";
import { cn } from "@/lib/utils";

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

interface ClientAnalytics {
  companyId: string;
  companyName: string;
  totalDocuments: number;
  processedDocuments: number;
  needsReviewCount: number;
  failedCount: number;
  correctionRate: number;
  autopilotEligibleRate: number;
  avgConfidence: number;
  currentPeriodQuality: number | null;
  openPeriodsCount: number;
  unmatchedTransactions: number;
  overdueDocuments: number;
  bananaMappingRate: number;
  lastExportDate: string | null;
  riskScore: number;
  riskFactors: string[];
}

interface CrossClientSummary {
  clients: ClientAnalytics[];
  totalClients: number;
  avgCorrectionRate: number;
  avgAutopilotEligibleRate: number;
  avgPeriodQuality: number;
  clientsNeedingAttention: number;
  dataQualityGate: { sufficientData: boolean; message: string | null };
}

const RISK_FACTOR_LABELS: Record<string, string> = {
  highCorrectionRate: de.analytics.riskFactors.highCorrectionRate,
  manyNeedsReview: de.analytics.riskFactors.manyNeedsReview,
  overdueDocuments: de.analytics.riskFactors.overdueDocuments,
  unmatchedTransactions: de.analytics.riskFactors.unmatchedTransactions,
  lowPeriodQuality: de.analytics.riskFactors.lowPeriodQuality,
  lowBananaMapping: de.analytics.riskFactors.lowBananaMapping,
  lowConfidence: de.analytics.riskFactors.lowConfidence,
};

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

function riskBadgeAnalytics(score: number) {
  if (score < 30) return "bg-green-100 text-green-800";
  if (score < 60) return "bg-amber-100 text-amber-800";
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

const pct = (rate: number) => `${Math.round(rate * 100)}%`;

export default function TrusteePage() {
  const { switchCompany } = useCompany();
  const [companies, setCompanies] = useState<CompanyOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "analytics">("overview");

  // Analytics state
  const [analytics, setAnalytics] = useState<CrossClientSummary | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);

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

  const fetchAnalytics = useCallback(async () => {
    if (analytics) return;
    setAnalyticsLoading(true);
    try {
      const res = await fetch("/api/trustee/analytics");
      if (res.ok) setAnalytics(await res.json());
    } catch { /* non-critical */ }
    finally { setAnalyticsLoading(false); }
  }, [analytics]);

  function handleTabChange(tab: "overview" | "analytics") {
    setActiveTab(tab);
    if (tab === "analytics") fetchAnalytics();
  }

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

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button type="button" className={cn("px-4 py-2 text-sm font-medium border-b-2 transition-colors", activeTab === "overview" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")} onClick={() => handleTabChange("overview")}>
          {de.trustee.overview}
        </button>
        <button type="button" className={cn("px-4 py-2 text-sm font-medium border-b-2 transition-colors", activeTab === "analytics" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")} onClick={() => handleTabChange("analytics")}>
          <BarChart3 className="h-3.5 w-3.5 inline mr-1.5" />
          {de.analytics.title}
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <>
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
                    <div className={`h-1.5 rounded-full ${riskBarColor(c.riskScore)}`} style={{ width: `${Math.min(Math.max(c.riskScore * 3, 5), 100)}%` }} />
                    <div className="flex gap-4 text-sm">
                      <span className="text-orange-600 font-medium">{c.stats.needs_review} offen</span>
                      <span className="text-green-600">{c.stats.ready} bereit</span>
                      {c.stats.failed > 0 && <span className="text-red-600">{c.stats.failed} fehlgeschlagen</span>}
                      <span className="text-slate-500">{c.stats.exported} exportiert</span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs">
                      {c.overdueTasks > 0 && <span className="text-red-600 font-medium">{c.overdueTasks} {de.cockpit.overdueTasks}</span>}
                      {c.currentPeriodStatus && <span className={`px-1.5 py-0.5 rounded ${periodStatusBadge(c.currentPeriodStatus)}`}>{de.periods.status[c.currentPeriodStatus] || c.currentPeriodStatus}</span>}
                    </div>
                    {criticalIssue && (
                      <div className="flex items-center gap-1.5 text-xs text-red-700 bg-red-50 rounded px-2 py-1">
                        <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                        <span>{de.cockpit.criticalIssue}: {criticalIssue}</span>
                      </div>
                    )}
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1"><span>{de.trustee.progress}</span><span>{c.progress}%</span></div>
                      <div className="w-full bg-gray-200 rounded-full h-2"><div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${c.progress}%` }} /></div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{de.trustee.lastUpload}: {c.lastUpload ? formatRelativeTime(c.lastUpload) : de.trustee.never}</span>
                      {c.stats.needs_review > 0 && <Button size="sm" variant="outline" onClick={() => { switchCompany(c.id); }}>{de.trustee.startReview}</Button>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Analytics Tab */}
      {activeTab === "analytics" && (
        <div className="space-y-4">
          {analyticsLoading ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">{[1,2,3,4].map(i => <Card key={i}><CardContent className="pt-4"><Skeleton className="h-16 w-full" /></CardContent></Card>)}</div>
              <Skeleton className="h-64 w-full" />
            </div>
          ) : analytics ? (
            <>
              {/* Data quality gate */}
              {!analytics.dataQualityGate.sufficientData && (
                <InfoPanel tone="warning" icon={AlertTriangle}>
                  {de.analytics.insufficientData}
                </InfoPanel>
              )}

              {/* Summary cards */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardContent className="pt-4">
                    <h3 className="text-xs font-medium text-muted-foreground">{de.analytics.crossClient}</h3>
                    <p className="text-2xl font-bold mt-1">{analytics.totalClients}</p>
                    <p className="text-xs text-muted-foreground">Mandanten</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <h3 className="text-xs font-medium text-muted-foreground">{de.analytics.avgCorrectionRate}</h3>
                    <p className="text-2xl font-bold mt-1">{pct(analytics.avgCorrectionRate)}</p>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
                      <div className={cn("h-1.5 rounded-full", analytics.avgCorrectionRate > 0.3 ? "bg-red-500" : analytics.avgCorrectionRate > 0.15 ? "bg-amber-500" : "bg-green-500")} style={{ width: pct(Math.min(analytics.avgCorrectionRate, 1)) }} />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <h3 className="text-xs font-medium text-muted-foreground">{de.analytics.avgAutopilot}</h3>
                    <p className="text-2xl font-bold mt-1">{pct(analytics.avgAutopilotEligibleRate)}</p>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
                      <div className="h-1.5 rounded-full bg-blue-500" style={{ width: pct(analytics.avgAutopilotEligibleRate) }} />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <h3 className="text-xs font-medium text-muted-foreground">{de.analytics.clientsNeedingAttention}</h3>
                    <p className={cn("text-2xl font-bold mt-1", analytics.clientsNeedingAttention > 0 ? "text-red-600" : "text-green-600")}>
                      {analytics.clientsNeedingAttention}
                    </p>
                    <p className="text-xs text-muted-foreground">{de.analytics.riskScore} &gt; 60</p>
                  </CardContent>
                </Card>
              </div>

              {/* Client ranking table */}
              <Card>
                <CardContent className="pt-4">
                  <h3 className="text-sm font-semibold mb-3">{de.analytics.crossClient}</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead className="text-center">{de.analytics.totalDocuments}</TableHead>
                        <TableHead className="text-center">{de.analytics.needsReview}</TableHead>
                        <TableHead className="text-center">{de.analytics.correctionRate}</TableHead>
                        <TableHead className="text-center">{de.analytics.autopilotEligibility}</TableHead>
                        <TableHead className="text-center">{de.analytics.periodQuality}</TableHead>
                        <TableHead className="text-center">{de.analytics.bananaMappingRate}</TableHead>
                        <TableHead className="text-center">{de.analytics.riskScore}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analytics.clients.map((client) => {
                        const isExpanded = expandedClient === client.companyId;
                        return (
                          <>
                            <TableRow
                              key={client.companyId}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => setExpandedClient(isExpanded ? null : client.companyId)}
                            >
                              <TableCell className="w-8">
                                {client.riskFactors.length > 0 && (
                                  isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                              </TableCell>
                              <TableCell>
                                <button
                                  type="button"
                                  className="text-sm font-medium hover:text-blue-600 transition-colors text-left"
                                  onClick={(e) => { e.stopPropagation(); switchCompany(client.companyId); }}
                                >
                                  {client.companyName}
                                </button>
                              </TableCell>
                              <TableCell className="text-center text-sm">{client.totalDocuments}</TableCell>
                              <TableCell className="text-center text-sm">
                                <span className={client.needsReviewCount > 10 ? "text-red-600 font-medium" : ""}>{client.needsReviewCount}</span>
                              </TableCell>
                              <TableCell className="text-center text-sm">
                                <span className={client.correctionRate > 0.3 ? "text-red-600 font-medium" : ""}>{pct(client.correctionRate)}</span>
                              </TableCell>
                              <TableCell className="text-center text-sm">{pct(client.autopilotEligibleRate)}</TableCell>
                              <TableCell className="text-center text-sm">
                                {client.currentPeriodQuality !== null ? (
                                  <span className={client.currentPeriodQuality < 70 ? "text-amber-600" : ""}>{client.currentPeriodQuality}%</span>
                                ) : <span className="text-muted-foreground">\u2014</span>}
                              </TableCell>
                              <TableCell className="text-center text-sm">{pct(client.bananaMappingRate)}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant="secondary" className={cn("text-xs font-bold", riskBadgeAnalytics(client.riskScore))}>
                                  {client.riskScore}
                                </Badge>
                              </TableCell>
                            </TableRow>
                            {isExpanded && client.riskFactors.length > 0 && (
                              <TableRow key={`${client.companyId}-factors`}>
                                <TableCell></TableCell>
                                <TableCell colSpan={8}>
                                  <div className="flex flex-wrap gap-1.5 py-1">
                                    {client.riskFactors.map((f) => (
                                      <Badge key={f} variant="secondary" className="bg-red-50 text-red-700 text-xs">
                                        {RISK_FACTOR_LABELS[f] || f}
                                      </Badge>
                                    ))}
                                    {client.overdueDocuments > 0 && (
                                      <span className="text-xs text-muted-foreground">{client.overdueDocuments} {de.analytics.overdueDocuments}</span>
                                    )}
                                    {client.unmatchedTransactions > 0 && (
                                      <span className="text-xs text-muted-foreground">{client.unmatchedTransactions} {de.analytics.unmatchedTransactions}</span>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
