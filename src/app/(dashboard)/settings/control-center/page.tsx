"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Activity, AlertTriangle, CheckCircle2, XCircle, Zap, ShieldAlert,
  TrendingUp, ListChecks, MessageSquarePlus, ArrowRight,
} from "lucide-react";
import { de } from "@/lib/i18n/de";
import { toast } from "sonner";

interface DriftAlert {
  supplierId: string;
  supplierName: string;
  type: string;
  detail: string;
  severity: "warning" | "critical";
}

interface TelemetrySnapshot {
  pipeline: {
    totalUploaded: number;
    totalProcessed: number;
    successRate: number;
    stuckProcessing: number;
    failedCount: number;
    avgProcessingTimeMs: number | null;
  };
  suggestions: {
    coverage: number;
    totalExposed: number;
    acceptedCount: number;
    rejectedCount: number;
    modifiedCount: number;
    acceptanceRate: number;
    modifiedRate: number;
  };
  autopilot: {
    totalEvents: number;
    eligibleCount: number;
    blockedCount: number;
    eligibleRate: number;
    topBlockReasons: Array<{ reason: string; count: number }>;
  };
  drift: { alerts: DriftAlert[] };
  calibration: {
    highConfidenceAccuracy: number;
    mediumConfidenceAccuracy: number;
    lowConfidenceAccuracy: number;
    isCalibrated: boolean;
  };
  corrections: {
    totalEvents: number;
    openPatterns: number;
    promotedPatterns: number;
    topCorrectedFields: Array<{ field: string; count: number }>;
    topCorrectedSuppliers: Array<{ name: string; count: number }>;
  };
  period: { from: string; to: string };
}

interface AutopilotConfigSnapshot {
  enabled: boolean;
  mode: string;
  killSwitchActive: boolean;
}

const FEEDBACK_TYPES = [
  "suggestion_good",
  "suggestion_wrong",
  "rule_missing",
  "knowledge_missing",
  "special_case",
] as const;

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export default function ControlCenterPage() {
  const [data, setData] = useState<TelemetrySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [killSwitch, setKillSwitch] = useState<AutopilotConfigSnapshot | null>(null);
  const [feedbackBusy, setFeedbackBusy] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [telRes, cockpitRes] = await Promise.all([
          fetch("/api/telemetry?days=30"),
          fetch("/api/dashboard/cockpit"),
        ]);
        if (telRes.ok) setData(await telRes.json());
        if (cockpitRes.ok) {
          const cockpit = await cockpitRes.json();
          if (cockpit?.autopilotStats?.config) setKillSwitch(cockpit.autopilotStats.config);
        }
      } catch (err) {
        console.error("[ControlCenter] Load error:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function sendFeedback(type: string) {
    setFeedbackBusy(type);
    try {
      const res = await fetch("/api/telemetry/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (res.ok) {
        toast.success(de.telemetry.feedbackSent);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.error || "Fehler beim Senden");
      }
    } catch {
      toast.error("Fehler beim Senden");
    } finally {
      setFeedbackBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 rounded-lg border border-red-200 bg-red-50 text-sm text-red-800">
        Telemetrie konnte nicht geladen werden.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-semibold tracking-tight">{de.controlCenter.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">{de.telemetry.last30days}</Badge>
          {killSwitch && (
            killSwitch.killSwitchActive ? (
              <Badge variant="destructive" className="text-xs">Kill-Switch aktiv</Badge>
            ) : !killSwitch.enabled ? (
              <Badge variant="secondary" className="text-xs bg-slate-200">Autopilot AUS</Badge>
            ) : (
              <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                {de.autopilot.mode[killSwitch.mode as "shadow" | "prefill" | "auto_ready"] || killSwitch.mode}
              </Badge>
            )
          )}
        </div>
      </div>

      {/* Bereich 1: Pipeline-Stabilität */}
      <PipelineHealthRow pipeline={data.pipeline} />

      {/* Two-column responsive grid */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <SuggestionQualityCard suggestions={data.suggestions} />
        <AutopilotPerformanceCard autopilot={data.autopilot} />
      </div>

      {/* Bereich 4: Drift Alerts (full width) */}
      {data.drift.alerts.length > 0 && <DriftAlertsCard alerts={data.drift.alerts} />}

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <CalibrationCard calibration={data.calibration} />
        <CorrectionsCard corrections={data.corrections} />
      </div>

      {/* Bereich 7: Feedback */}
      <FeedbackPanel busy={feedbackBusy} onFeedback={sendFeedback} />
    </div>
  );
}

/* ---------- Bereich 1: Pipeline ---------- */
function PipelineHealthRow({ pipeline }: { pipeline: TelemetrySnapshot["pipeline"] }) {
  const successPct = `${(pipeline.successRate * 100).toFixed(1)}%`;
  const avgSec = pipeline.avgProcessingTimeMs != null
    ? `${Math.round(pipeline.avgProcessingTimeMs / 1000)}s`
    : "—";

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Activity className="h-4 w-4 text-blue-600" />
        <h2 className="text-sm font-medium">{de.controlCenter.pipelineHealth}</h2>
      </div>
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <MetricCard
          label={de.controlCenter.success}
          value={successPct}
          tone={pipeline.successRate >= 0.95 ? "good" : pipeline.successRate >= 0.85 ? "warn" : "bad"}
        />
        <MetricCard
          label={de.controlCenter.stuck}
          value={String(pipeline.stuckProcessing)}
          tone={pipeline.stuckProcessing === 0 ? "good" : pipeline.stuckProcessing < 5 ? "warn" : "bad"}
        />
        <MetricCard
          label={de.controlCenter.failed}
          value={String(pipeline.failedCount)}
          tone={pipeline.failedCount === 0 ? "good" : pipeline.failedCount < 5 ? "warn" : "bad"}
        />
        <MetricCard label={de.controlCenter.avgTime} value={avgSec} tone="neutral" />
      </div>
    </div>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: "good" | "warn" | "bad" | "neutral" }) {
  const toneClass =
    tone === "good"
      ? "border-green-200 bg-green-50"
      : tone === "warn"
      ? "border-amber-200 bg-amber-50"
      : tone === "bad"
      ? "border-red-200 bg-red-50"
      : "border-slate-200 bg-white";
  return (
    <div className={`px-3 py-2 rounded-lg border ${toneClass}`}>
      <div className="text-xs text-[var(--text-muted)]">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

/* ---------- Bereich 2: Vorschlagsqualität ---------- */
function SuggestionQualityCard({ suggestions }: { suggestions: TelemetrySnapshot["suggestions"] }) {
  const total = suggestions.totalExposed || 1;
  const accPct = (suggestions.acceptedCount / total) * 100;
  const modPct = (suggestions.modifiedCount / total) * 100;
  const rejPct = (suggestions.rejectedCount / total) * 100;
  const pendingPct = Math.max(0, 100 - accPct - modPct - rejPct);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-blue-600" />
          {de.controlCenter.suggestionQuality}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <Stat label={de.controlCenter.coverage} value={pct(suggestions.coverage)} />
          <Stat label={de.controlCenter.accepted} value={pct(suggestions.acceptanceRate)} />
          <Stat label={de.controlCenter.modified} value={pct(suggestions.modifiedRate)} />
          <Stat
            label={de.controlCenter.rejected}
            value={
              suggestions.totalExposed > 0
                ? `${Math.round((suggestions.rejectedCount / suggestions.totalExposed) * 100)}%`
                : "0%"
            }
          />
        </div>
        <div>
          <div className="flex h-3 rounded-full overflow-hidden bg-slate-100">
            <div className="bg-green-500" style={{ width: `${accPct}%` }} title={`${de.controlCenter.accepted}: ${Math.round(accPct)}%`} />
            <div className="bg-amber-400" style={{ width: `${modPct}%` }} title={`${de.controlCenter.modified}: ${Math.round(modPct)}%`} />
            <div className="bg-red-400" style={{ width: `${rejPct}%` }} title={`${de.controlCenter.rejected}: ${Math.round(rejPct)}%`} />
            <div className="bg-slate-300" style={{ width: `${pendingPct}%` }} title={`${de.controlCenter.pending}: ${Math.round(pendingPct)}%`} />
          </div>
          <div className="flex flex-wrap gap-3 mt-1.5 text-[10px] text-[var(--text-muted)]">
            <LegendDot color="bg-green-500" label={de.controlCenter.accepted} />
            <LegendDot color="bg-amber-400" label={de.controlCenter.modified} />
            <LegendDot color="bg-red-400" label={de.controlCenter.rejected} />
            <LegendDot color="bg-slate-300" label={de.controlCenter.pending} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`h-2 w-2 rounded-full ${color}`} /> {label}
    </span>
  );
}

/* ---------- Bereich 3: Autopilot ---------- */
function AutopilotPerformanceCard({ autopilot }: { autopilot: TelemetrySnapshot["autopilot"] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" />
          {de.controlCenter.autopilotPerformance}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-xs">
          <span className="font-medium">{de.controlCenter.healthShort}: </span>
          <span className="text-base font-semibold">{pct(autopilot.eligibleRate)}</span>
          <span className="text-[var(--text-muted)] ml-2">
            ({autopilot.eligibleCount} {de.controlCenter.eligible} / {autopilot.totalEvents})
          </span>
        </div>
        {autopilot.topBlockReasons.length > 0 && (
          <div>
            <p className="text-xs font-medium text-[var(--text-muted)] mb-1">{de.controlCenter.blockReasons}</p>
            <div className="space-y-1">
              {autopilot.topBlockReasons.slice(0, 5).map((br) => (
                <div key={br.reason} className="flex items-center justify-between text-xs">
                  <span className="truncate">{br.reason}</span>
                  <span className="font-semibold tabular-nums">{br.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------- Bereich 4: Drift ---------- */
function DriftAlertsCard({ alerts }: { alerts: DriftAlert[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          {alerts.length} {de.controlCenter.driftAlerts}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {alerts.map((a, i) => (
            <Link
              key={`${a.supplierId}-${a.type}-${i}`}
              href={`/suppliers/${a.supplierId}`}
              className="flex items-center gap-2 text-xs p-1.5 rounded hover:bg-[var(--surface-secondary)]"
            >
              <Badge
                variant="secondary"
                className={`text-[10px] ${
                  a.severity === "critical"
                    ? "bg-red-100 text-red-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {a.severity === "critical" ? de.controlCenter.critical : "Warnung"}
              </Badge>
              <span className="font-medium">{a.supplierName}</span>
              <span className="text-[var(--text-muted)] truncate flex-1">{a.detail}</span>
              <ArrowRight className="h-3 w-3 text-[var(--text-muted)] shrink-0" />
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Bereich 5: Calibration ---------- */
function CalibrationCard({ calibration }: { calibration: TelemetrySnapshot["calibration"] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-blue-600" />
          {de.controlCenter.confidenceCalibration}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2 text-xs">
          {calibration.isCalibrated ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="font-medium text-green-700">{de.controlCenter.calibrated}</span>
            </>
          ) : (
            <>
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="font-medium text-red-700">{de.controlCenter.notCalibrated}</span>
            </>
          )}
        </div>
        <div className="space-y-1 text-xs">
          <CalibrationRow label={de.controlCenter.highConfidence} value={calibration.highConfidenceAccuracy} />
          <CalibrationRow label={de.controlCenter.mediumConfidence} value={calibration.mediumConfidenceAccuracy} />
          <CalibrationRow label={de.controlCenter.lowConfidence} value={calibration.lowConfidenceAccuracy} />
        </div>
        {!calibration.isCalibrated && (
          <p className="text-[10px] text-red-600">
            {de.telemetry.notCalibrated}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function CalibrationRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-32 text-[var(--text-muted)]">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-1.5 bg-blue-500" style={{ width: `${value * 100}%` }} />
      </div>
      <span className="font-semibold tabular-nums w-12 text-right">{pct(value)} {de.controlCenter.correct}</span>
    </div>
  );
}

/* ---------- Bereich 6: Korrekturen ---------- */
function CorrectionsCard({ corrections }: { corrections: TelemetrySnapshot["corrections"] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-purple-600" />
          {de.controlCenter.correctionsOverview}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-xs">
          <span className="text-base font-semibold">{corrections.totalEvents}</span>{" "}
          <span className="text-[var(--text-muted)]">{de.controlCenter.correctionsCount} ({de.telemetry.last30days})</span>
        </div>
        {corrections.topCorrectedFields.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{de.controlCenter.topFields}</p>
            <div className="text-xs">
              {corrections.topCorrectedFields.map((f, i) => (
                <span key={f.field}>
                  {i > 0 && ", "}
                  {f.field} ({f.count})
                </span>
              ))}
            </div>
          </div>
        )}
        {corrections.topCorrectedSuppliers.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{de.controlCenter.topSuppliers}</p>
            <div className="text-xs">
              {corrections.topCorrectedSuppliers.slice(0, 3).map((s, i) => (
                <span key={s.name}>
                  {i > 0 && ", "}
                  {s.name} ({s.count})
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="text-xs text-[var(--text-muted)]">
          {corrections.openPatterns} {de.controlCenter.openPatterns} · {corrections.promotedPatterns} {de.controlCenter.promotedPatterns}
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Bereich 7: Feedback ---------- */
function FeedbackPanel({
  busy,
  onFeedback,
}: {
  busy: string | null;
  onFeedback: (type: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <MessageSquarePlus className="h-4 w-4 text-blue-600" />
          {de.controlCenter.feedbackSection}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {FEEDBACK_TYPES.map((type) => (
            <Button
              key={type}
              variant="outline"
              size="sm"
              disabled={busy === type}
              onClick={() => onFeedback(type)}
            >
              {de.telemetry.feedbackTypes[type as keyof typeof de.telemetry.feedbackTypes]}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
