"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Upload, Loader2, AlertTriangle, CheckCircle2, XCircle, FileCheck,
  ClipboardCheck, UploadCloud, Cpu,
} from "lucide-react";
import { DocumentStatusBadge } from "@/components/documents/document-status-badge";
import { de } from "@/lib/i18n/de";
import { formatCurrency, formatRelativeTime, formatConfidence, getConfidenceColor } from "@/lib/i18n/format";
import { toast } from "sonner";

const cardConfig = [
  { key: "uploaded", label: de.dashboard.uploaded, icon: Upload, color: "text-blue-600", bg: "bg-blue-50" },
  { key: "processing", label: de.dashboard.processing, icon: Loader2, color: "text-amber-600", bg: "bg-amber-50" },
  { key: "needs_review", label: de.dashboard.needsReview, icon: AlertTriangle, color: "text-orange-600", bg: "bg-orange-50" },
  { key: "ready", label: de.dashboard.ready, icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
  { key: "failed", label: de.dashboard.failed, icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
  { key: "exported", label: de.dashboard.exported, icon: FileCheck, color: "text-slate-600", bg: "bg-slate-50" },
] as const;

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Record<string, any>>({});
  const [recentDocs, setRecentDocs] = useState<any[]>([]);
  const [topSuppliers, setTopSuppliers] = useState<any[]>([]);
  const [aiCosts, setAiCosts] = useState<any>(null);
  const [auditEntries, setAuditEntries] = useState<any[]>([]);
  const [stuckCount, setStuckCount] = useState(0);

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard/stats").then((r) => r.json()).catch(() => ({})),
      fetch("/api/documents?pageSize=10&sortBy=createdAt&sortOrder=desc").then((r) => r.json()).catch(() => ({ documents: [] })),
      fetch("/api/suppliers?pageSize=5&sortBy=documentCount&sortOrder=desc").then((r) => r.json()).catch(() => ({ suppliers: [] })),
      fetch("/api/dashboard/ai-costs").then((r) => r.json()).catch(() => null),
      fetch("/api/audit-log?pageSize=5").then((r) => r.json()).catch(() => ({ entries: [] })),
    ]).then(([statsData, docsData, suppData, costs, auditData]) => {
      setStats(statsData);
      setRecentDocs(docsData.documents || []);
      setTopSuppliers(suppData.suppliers || []);
      setAiCosts(costs);
      setAuditEntries(auditData.entries || []);
      setStuckCount((statsData.uploaded || 0) + (statsData.failed || 0));
    });
  }, []);

  async function handleReprocessStuck() {
    const res = await fetch("/api/documents?status=uploaded&pageSize=100");
    const failedRes = await fetch("/api/documents?status=failed&pageSize=100");
    const data = await res.json();
    const failedData = await failedRes.json();
    const ids = [...(data.documents || []), ...(failedData.documents || [])].map((d: any) => d.id);
    if (!ids.length) return;
    const r = await fetch("/api/documents/bulk-reprocess", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentIds: ids }),
    });
    if (r.ok) { const result = await r.json(); toast.success(`${result.submitted} ${de.bulk.reprocessSubmitted}`); }
  }

  console.log("[Dashboard] Loaded with clickable cards, top suppliers, AI costs");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{de.dashboard.title}</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push("/documents?status=needs_review")}>
            <ClipboardCheck className="h-4 w-4 mr-2" />Prüfung starten
          </Button>
          <Button size="sm" onClick={() => router.push("/documents")}>
            <UploadCloud className="h-4 w-4 mr-2" />{de.dashboard.upload}
          </Button>
        </div>
      </div>

      {/* Stuck alert */}
      {stuckCount > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="text-sm text-amber-800">{stuckCount} feststeckende Belege</span>
            </div>
            <Button variant="outline" size="sm" onClick={handleReprocessStuck}>{de.bulk.reprocess}</Button>
          </CardContent>
        </Card>
      )}

      {/* Clickable status cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {cardConfig.map((card) => {
          const Icon = card.icon;
          const count = stats[card.key] ?? 0;
          return (
            <Link key={card.key} href={`/documents?status=${card.key}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
                  <div className={`rounded-md p-2 ${card.bg}`}><Icon className={`h-4 w-4 ${card.color}`} /></div>
                </CardHeader>
                <CardContent><div className="text-3xl font-bold">{count}</div></CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Secondary stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Heute hochgeladen</p>
            <p className="text-2xl font-bold">{stats.today_uploaded || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Ø Konfidenz</p>
            <p className={`text-2xl font-bold ${getConfidenceColor(stats.avg_confidence)}`}>{formatConfidence(stats.avg_confidence)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{stats.total || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Cpu className="h-3 w-3" />KI-Kosten (Monat)</p>
            <p className="text-2xl font-bold">
              {aiCosts ? `~CHF ${aiCosts.estimatedCostChf.toFixed(2)}` : "—"}
            </p>
            {aiCosts && <p className="text-xs text-muted-foreground">{aiCosts.documentCount} Belege</p>}
          </CardContent>
        </Card>
      </div>

      {/* Two columns */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent documents */}
        <Card>
          <CardHeader><CardTitle className="text-sm">{de.dashboard.recentDocuments}</CardTitle></CardHeader>
          <CardContent>
            {recentDocs.length === 0 ? (
              <p className="text-sm text-muted-foreground">{de.dashboard.noDocuments}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{de.documents.status}</TableHead>
                    <TableHead>{de.documents.supplier}</TableHead>
                    <TableHead>{de.documents.amount}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentDocs.slice(0, 8).map((doc: any) => (
                    <TableRow key={doc.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/documents/${doc.id}`)}>
                      <TableCell><DocumentStatusBadge status={doc.status} /></TableCell>
                      <TableCell className="truncate max-w-[150px] text-xs">{doc.supplierNameNormalized || doc.supplierNameRaw || de.common.noData}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{formatCurrency(doc.grossAmount, doc.currency || "CHF")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Top suppliers + Recent activity */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Top Lieferanten</CardTitle></CardHeader>
            <CardContent>
              {topSuppliers.length === 0 ? (
                <p className="text-sm text-muted-foreground">{de.suppliers.noSuppliers}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{de.suppliers.name}</TableHead>
                      <TableHead>{de.suppliers.documentCount}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topSuppliers.map((s: any) => (
                      <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/suppliers/${s.id}`)}>
                        <TableCell className="text-xs">{s.nameNormalized}</TableCell>
                        <TableCell className="text-xs">{s.documentCount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {auditEntries.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Letzte Aktivität</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {auditEntries.map((entry: any) => (
                    <div key={entry.id} className="flex items-center gap-3 text-xs py-1 border-b last:border-0">
                      <span className="text-muted-foreground w-16">{formatRelativeTime(entry.createdAt)}</span>
                      <span>{entry.user?.name || "System"}</span>
                      <span className="text-muted-foreground">{de.auditLog.actions[entry.action] || entry.action}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
