"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Upload, Loader2, AlertTriangle, CheckCircle2, XCircle, FileCheck,
  ClipboardCheck, UploadCloud, Cpu, Download,
} from "lucide-react";
import { DocumentStatusBadge } from "@/components/documents/document-status-badge";
import { de } from "@/lib/i18n/de";
import { formatCurrency, formatRelativeTime, formatConfidence, getConfidenceColor } from "@/lib/i18n/format";

const cardConfig = [
  { key: "uploaded", label: de.dashboard.uploaded, icon: Upload, color: "text-blue-600", bg: "bg-blue-50" },
  { key: "processing", label: de.dashboard.processing, icon: Loader2, color: "text-amber-600", bg: "bg-amber-50" },
  { key: "needs_review", label: de.dashboard.needsReview, icon: AlertTriangle, color: "text-orange-600", bg: "bg-orange-50" },
  { key: "ready", label: de.dashboard.ready, icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
  { key: "failed", label: de.dashboard.failed, icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
  { key: "exported", label: de.dashboard.exported, icon: FileCheck, color: "text-slate-600", bg: "bg-slate-50" },
] as const;

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return de.greeting.morning;
  if (h < 18) return de.greeting.afternoon;
  return de.greeting.evening;
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Record<string, any>>({});
  const [recentDocs, setRecentDocs] = useState<any[]>([]);
  const [auditEntries, setAuditEntries] = useState<any[]>([]);
  const [aiCosts, setAiCosts] = useState<any>(null);
  const [systemAlerts, setSystemAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard/stats").then((r) => r.json()).catch(() => ({})),
      fetch("/api/documents?pageSize=8&sortBy=createdAt&sortOrder=desc").then((r) => r.json()).catch(() => ({ documents: [] })),
      fetch("/api/audit-log?pageSize=5").then((r) => r.json()).catch(() => ({ entries: [] })),
      fetch("/api/dashboard/ai-costs").then((r) => r.json()).catch(() => null),
      fetch("/api/alerts/system").then((r) => r.json()).catch(() => ({ alerts: [] })),
    ]).then(([s, d, a, c, al]) => {
      setStats(s); setRecentDocs(d.documents || []); setAuditEntries(a.entries || []);
      setAiCosts(c); setSystemAlerts(al?.alerts || []);
    }).catch((e) => console.error("[Dashboard]", e)).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-72" />
      <div className="grid gap-4 md:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => (<Skeleton key={i} className="h-24" />))}</div>
      <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-48" /><Skeleton className="h-48" /></div>
    </div>
  );

  const today = new Date().toLocaleDateString("de-CH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{getGreeting()}</h1>
        <p className="text-sm text-[var(--text-secondary)]">{today}</p>
      </div>

      {/* Alerts */}
      {systemAlerts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {systemAlerts.map((a: any, i: number) => (
            <span key={i} className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${a.type === "error" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>
              {a.type === "error" ? <XCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
              {a.message}
            </span>
          ))}
        </div>
      )}

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => router.push("/documents?upload=true")}>
          <UploadCloud className="h-4 w-4 mr-2" />{de.dashboard.upload}
        </Button>
        <Button variant="outline" onClick={() => router.push("/documents?status=needs_review")}>
          <ClipboardCheck className="h-4 w-4 mr-2" />Prüfung starten
          {(stats.needs_review || 0) > 0 && (
            <span className="ml-1.5 bg-orange-100 text-orange-800 text-xs px-1.5 rounded-full">{stats.needs_review}</span>
          )}
        </Button>
        <Button variant="outline" onClick={() => router.push("/exports")}>
          <Download className="h-4 w-4 mr-2" />Exportieren
        </Button>
      </div>

      {/* Status cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
        {cardConfig.map((card) => {
          const Icon = card.icon;
          const count = stats[card.key] ?? 0;
          return (
            <Link key={card.key} href={`/documents?status=${card.key}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="pt-4 pb-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-[var(--text-secondary)]">{card.label}</p>
                    <p className="text-2xl font-bold">{count}</p>
                  </div>
                  <div className={`rounded-md p-2 ${card.bg}`}><Icon className={`h-4 w-4 ${card.color}`} /></div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Secondary stats */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card><CardContent className="pt-3 pb-2">
          <p className="text-xs text-[var(--text-muted)]">Heute</p>
          <p className="text-xl font-bold">{stats.today_uploaded || 0}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-3 pb-2">
          <p className="text-xs text-[var(--text-muted)]">Ø Konfidenz</p>
          <p className={`text-xl font-bold ${getConfidenceColor(stats.avg_confidence)}`}>{formatConfidence(stats.avg_confidence)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-3 pb-2">
          <p className="text-xs text-[var(--text-muted)]">Total</p>
          <p className="text-xl font-bold">{stats.total || 0}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-3 pb-2">
          <p className="text-xs text-[var(--text-muted)] flex items-center gap-1"><Cpu className="h-3 w-3" />KI-Kosten</p>
          <p className="text-xl font-bold">{aiCosts ? `~CHF ${aiCosts.estimatedCostChf.toFixed(2)}` : "—"}</p>
        </CardContent></Card>
      </div>

      {/* Two columns */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{de.dashboard.recentDocuments}</CardTitle></CardHeader>
          <CardContent>
            {recentDocs.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)] py-4">{de.dashboard.noDocuments}</p>
            ) : (
              <div className="space-y-1">
                {recentDocs.map((doc: any) => (
                  <Link key={doc.id} href={`/documents/${doc.id}`} className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-[var(--surface-secondary)] transition-colors">
                    <DocumentStatusBadge status={doc.status} />
                    <span className="text-xs truncate flex-1">{doc.supplierNameNormalized || doc.supplierNameRaw || "—"}</span>
                    <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">{formatCurrency(doc.grossAmount, doc.currency || "CHF")}</span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Letzte Aktivität</CardTitle></CardHeader>
          <CardContent>
            {auditEntries.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)] py-4">Noch keine Aktivität</p>
            ) : (
              <div className="space-y-3">
                {auditEntries.map((entry: any) => (
                  <div key={entry.id} className="flex gap-3">
                    <div className="w-1 rounded-full bg-[var(--border-default)] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium">{de.auditLog.actions[entry.action] || entry.action}</p>
                      <p className="text-xs text-[var(--text-muted)]">{entry.user?.name || "System"} · {formatRelativeTime(entry.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
