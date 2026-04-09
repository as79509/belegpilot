"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, Database, Workflow, Zap, Download, RefreshCw, Loader2 } from "lucide-react";
import { SectionCard } from "@/components/ds/section-card";
import { StatusBadge } from "@/components/ds/status-badge";
import { InfoPanel } from "@/components/ds/info-panel";
import { de } from "@/lib/i18n/de";
import { formatDate, formatRelativeTime } from "@/lib/i18n/format";
import { toast } from "sonner";

interface HealthCheck {
  status: "ok" | "error";
  latencyMs?: number;
  error?: string;
}

interface HealthResponse {
  status: "healthy" | "degraded";
  timestamp: string;
  checks: Record<string, HealthCheck>;
}

interface AutopilotConfigSnapshot {
  mode: string;
  enabled: boolean;
  killSwitchActive: boolean;
  killSwitchAt?: string | null;
  killSwitchReason?: string | null;
}

interface AutopilotEventRow {
  id: string;
  decision: string;
  mode: string;
  blockedBy: string | null;
  supplierName: string | null;
  documentId: string;
  createdAt: string;
}

interface ExportSummary {
  batches: Array<{
    batchId: string;
    createdAt: string;
    exportTarget: string;
    count: number;
    status: string;
    failures: Array<{
      documentId: string;
      documentNumber: string | null;
      supplierName: string | null;
      errorMessage: string | null;
    }>;
  }>;
  notExported: Array<{
    id: string;
    documentNumber: string | null;
    supplierName: string | null;
    reason: string;
  }>;
}

interface BexioStatus {
  configured: boolean;
  isEnabled: boolean;
  lastTestedAt?: string | null;
  lastTestStatus?: string | null;
}

interface DocRow {
  id: string;
  documentNumber: string | null;
  supplierNameNormalized: string | null;
  supplierNameRaw: string | null;
  status: string;
  createdAt: string;
  reviewNotes?: string | null;
}

export default function SystemHealthPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [autopilotConfig, setAutopilotConfig] = useState<AutopilotConfigSnapshot | null>(null);
  const [autopilotEvents, setAutopilotEvents] = useState<AutopilotEventRow[]>([]);
  const [exports, setExports] = useState<ExportSummary | null>(null);
  const [bexio, setBexio] = useState<BexioStatus | null>(null);
  const [stuckDocs, setStuckDocs] = useState<DocRow[]>([]);
  const [failedDocs, setFailedDocs] = useState<DocRow[]>([]);
  const [retrying, setRetrying] = useState<string | null>(null);

  async function loadAll() {
    setRefreshing(true);
    try {
      const [
        healthRes,
        autopilotRes,
        eventsRes,
        exportsRes,
        bexioRes,
        stuckRes,
        failedRes,
      ] = await Promise.all([
        fetch("/api/health"),
        fetch("/api/autopilot/config"),
        fetch("/api/autopilot/events?limit=10").catch(() => null),
        fetch("/api/exports"),
        fetch("/api/bexio/settings"),
        fetch("/api/documents?status=processing&pageSize=20"),
        fetch("/api/documents?status=failed&pageSize=20"),
      ]);

      if (healthRes.ok) setHealth(await healthRes.json());
      else if (healthRes.status === 503) setHealth(await healthRes.json());

      if (autopilotRes.ok) setAutopilotConfig(await autopilotRes.json());

      if (eventsRes?.ok) {
        const data = await eventsRes.json();
        const rows = Array.isArray(data?.events)
          ? (data.events as AutopilotEventRow[])
          : [];
        setAutopilotEvents(rows);
      }

      if (exportsRes.ok) setExports(await exportsRes.json());
      if (bexioRes.ok) setBexio(await bexioRes.json());

      if (stuckRes.ok) {
        const data = await stuckRes.json();
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        const all = (data?.documents || []) as DocRow[];
        setStuckDocs(all.filter((d) => new Date(d.createdAt).getTime() < oneHourAgo));
      }

      if (failedRes.ok) {
        const data = await failedRes.json();
        setFailedDocs((data?.documents || []) as DocRow[]);
      }
    } catch (err) {
      console.error("[SystemHealth] load error", err);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function retryExport(documentId: string) {
    setRetrying(documentId);
    try {
      const res = await fetch("/api/bexio/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, force: true }),
      });
      const data = await res.json();
      if (data.results?.[0]?.success) {
        toast.success(de.bexio.exportSuccess);
        loadAll();
      } else {
        toast.error(data.results?.[0]?.error || de.bexio.exportFailed);
      }
    } catch {
      toast.error(de.bexio.exportFailed);
    } finally {
      setRetrying(null);
    }
  }

  const overallStatus: "healthy" | "degraded" | "down" =
    !health
      ? "down"
      : health.status === "healthy"
        ? "healthy"
        : "degraded";

  const overallTone =
    overallStatus === "healthy" ? "success" : overallStatus === "degraded" ? "warning" : "error";

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const failedExports = (exports?.batches || []).filter((b) => b.status === "failed");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Activity className="h-6 w-6" />
          {de.systemHealth.title}
        </h1>
        <Button variant="outline" size="sm" onClick={loadAll} disabled={refreshing}>
          {refreshing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          Aktualisieren
        </Button>
      </div>

      <InfoPanel tone={overallTone}>
        <div className="flex flex-wrap items-center gap-2">
          <strong>
            {overallStatus === "healthy"
              ? de.systemHealth.healthy
              : overallStatus === "degraded"
                ? de.systemHealth.degraded
                : de.systemHealth.down}
          </strong>
          {health?.timestamp && (
            <span className="text-xs">
              {de.systemHealth.lastCheck}: {formatRelativeTime(health.timestamp)}
            </span>
          )}
        </div>
      </InfoPanel>

      {/* API Health */}
      <SectionCard title={de.systemHealth.apiHealth} icon={Database}>
        {health ? (
          <ul className="space-y-1 text-xs">
            {Object.entries(health.checks).map(([key, check]) => (
              <li key={key} className="flex items-center gap-2">
                <span className={check.status === "ok" ? "text-green-600" : "text-red-600"}>
                  {check.status === "ok" ? "✓" : "✗"}
                </span>
                <span className="font-mono">
                  {key === "database" ? de.systemHealth.dbConnection : key}
                </span>
                {check.latencyMs != null && (
                  <span className="text-muted-foreground">{check.latencyMs}ms</span>
                )}
                {check.error && <span className="text-red-700 ml-auto">{check.error}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">{de.systemHealth.down}</p>
        )}
      </SectionCard>

      {/* Pipeline */}
      <SectionCard title={de.systemHealth.pipeline} icon={Workflow}>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="bg-muted/40 rounded p-2">
              <div className="text-muted-foreground">{de.systemHealth.activeJobs}</div>
              <div className="text-base font-semibold">{stuckDocs.length + failedDocs.length === 0 ? "0" : "—"}</div>
            </div>
            <div className="bg-amber-50 rounded p-2">
              <div className="text-amber-700">{de.systemHealth.stuckDocs}</div>
              <div className="text-base font-semibold text-amber-900">{stuckDocs.length}</div>
            </div>
            <div className="bg-red-50 rounded p-2">
              <div className="text-red-700">{de.systemHealth.failedDocs}</div>
              <div className="text-base font-semibold text-red-900">{failedDocs.length}</div>
            </div>
          </div>

          {stuckDocs.length > 0 && (
            <div>
              <div className="text-xs font-medium mb-1">{de.systemHealth.stuckDocs}</div>
              <ul className="space-y-1 text-xs">
                {stuckDocs.slice(0, 10).map((d) => (
                  <li key={d.id} className="flex items-center gap-2">
                    <Link href={`/documents/${d.id}`} className="text-blue-600 hover:underline font-mono">
                      {d.documentNumber || d.id.slice(0, 8)}
                    </Link>
                    <span className="text-muted-foreground truncate">
                      {d.supplierNameNormalized || d.supplierNameRaw || "—"}
                    </span>
                    <span className="text-muted-foreground ml-auto">{formatRelativeTime(d.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {failedDocs.length > 0 && (
            <div>
              <div className="text-xs font-medium mb-1">{de.systemHealth.failedDocs}</div>
              <ul className="space-y-1 text-xs">
                {failedDocs.slice(0, 10).map((d) => (
                  <li key={d.id} className="flex items-center gap-2">
                    <Link href={`/documents/${d.id}`} className="text-blue-600 hover:underline font-mono">
                      {d.documentNumber || d.id.slice(0, 8)}
                    </Link>
                    <span className="text-muted-foreground truncate">
                      {d.supplierNameNormalized || d.supplierNameRaw || "—"}
                    </span>
                    {d.reviewNotes && (
                      <span className="text-red-700 truncate ml-2">{d.reviewNotes}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {stuckDocs.length === 0 && failedDocs.length === 0 && (
            <p className="text-xs text-muted-foreground">{de.systemHealth.noIssues}</p>
          )}
        </div>
      </SectionCard>

      {/* Autopilot */}
      <SectionCard title={de.systemHealth.autopilotState} icon={Zap}>
        <div className="space-y-3">
          {autopilotConfig ? (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">Modus:</span>
              <StatusBadge type="autopilot" value={autopilotConfig.mode} />
              <span className="text-muted-foreground">·</span>
              <span>Kill-Switch:</span>
              {autopilotConfig.killSwitchActive ? (
                <span className="text-red-700 font-medium">Aktiv</span>
              ) : (
                <span className="text-green-700">Inaktiv</span>
              )}
              {autopilotConfig.killSwitchActive && autopilotConfig.killSwitchReason && (
                <span className="text-muted-foreground">— {autopilotConfig.killSwitchReason}</span>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{de.common.noData}</p>
          )}

          {autopilotEvents.length > 0 && (
            <div>
              <div className="text-xs font-medium mb-1">Letzte 10 Autopilot-Entscheidungen</div>
              <ul className="space-y-1 text-xs">
                {autopilotEvents.map((e) => (
                  <li key={e.id} className="flex items-center gap-2">
                    <span className="text-muted-foreground">{formatDate(e.createdAt)}</span>
                    <Link href={`/documents/${e.documentId}`} className="text-blue-600 hover:underline font-mono">
                      {e.documentId.slice(0, 8)}
                    </Link>
                    <span className="font-mono">{e.mode}</span>
                    <span className={e.decision === "eligible" ? "text-green-700" : "text-amber-700"}>
                      {e.decision}
                    </span>
                    {e.blockedBy && <span className="text-muted-foreground">— {e.blockedBy}</span>}
                    {e.supplierName && <span className="text-muted-foreground ml-auto truncate">{e.supplierName}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Exports */}
      <SectionCard title={de.systemHealth.exportState} icon={Download}>
        <div className="space-y-3">
          {bexio && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">{de.exportsDeep.bexioStatus}:</span>
              {bexio.configured && bexio.lastTestStatus === "connected" ? (
                <span className="text-green-700 font-medium">{de.exportsDeep.connected}</span>
              ) : bexio.configured ? (
                <span className="text-amber-700 font-medium">{de.exportsDeep.disconnected}</span>
              ) : (
                <span className="text-muted-foreground">{de.exportsDeep.notConfigured}</span>
              )}
              {bexio.lastTestedAt && (
                <span className="text-muted-foreground ml-auto">
                  {de.exportsDeep.lastSync}: {formatRelativeTime(bexio.lastTestedAt)}
                </span>
              )}
            </div>
          )}

          {exports && exports.batches.length > 0 && (
            <div>
              <div className="text-xs font-medium mb-1">Letzte Exporte</div>
              <ul className="space-y-1 text-xs">
                {exports.batches.slice(0, 5).map((b) => (
                  <li key={b.batchId} className="flex items-center gap-2">
                    <span className="text-muted-foreground">{formatDate(b.createdAt)}</span>
                    <span className="font-mono">{b.exportTarget}</span>
                    <span className="text-muted-foreground">{b.count} Belege</span>
                    <StatusBadge type="export" value={b.status === "failed" ? "export_failed" : "exported"} size="sm" />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {failedExports.length > 0 && (
            <div>
              <div className="text-xs font-medium mb-1 text-red-700">Fehlgeschlagene Exporte</div>
              <ul className="space-y-1 text-xs">
                {failedExports.flatMap((b) =>
                  b.failures.map((f) => (
                    <li key={`${b.batchId}-${f.documentId}`} className="flex items-center gap-2">
                      <Link href={`/documents/${f.documentId}`} className="text-blue-600 hover:underline font-mono">
                        {f.documentNumber || f.documentId.slice(0, 8)}
                      </Link>
                      <span className="text-muted-foreground truncate">{f.supplierName || "—"}</span>
                      <span className="text-red-700 truncate">{f.errorMessage || "—"}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-auto h-6 text-xs"
                        disabled={retrying === f.documentId}
                        onClick={() => retryExport(f.documentId)}
                      >
                        {retrying === f.documentId ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : null}
                        {de.exportsDeep.retry}
                      </Button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}

          {(!exports || exports.batches.length === 0) && (
            <p className="text-xs text-muted-foreground">{de.systemHealth.noIssues}</p>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
