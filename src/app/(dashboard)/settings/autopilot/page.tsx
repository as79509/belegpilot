"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Zap, AlertOctagon, Power, Save, Activity, ArrowRight, TrendingDown, ShieldCheck, BarChart3 } from "lucide-react";
import { de } from "@/lib/i18n/de";
import { InfoPanel } from "@/components/ds";
import { TrustSignal } from "@/components/ds/trust-signal";
import { ProtectionBadge } from "@/components/ds/protection-badge";
import { toast } from "sonner";
import Link from "next/link";

const DOC_TYPES = ["invoice", "credit_note", "receipt", "reminder", "other"];
const CURRENCIES = ["CHF", "EUR", "USD", "GBP"];

interface AutopilotConfig {
  enabled: boolean;
  mode: "shadow" | "prefill" | "auto_ready";
  minHistoryMatches: number;
  minStabilityScore: number;
  maxAmount: number | null;
  minConfidence: number;
  allowedDocTypes: string[] | null;
  allowedCurrencies: string[] | null;
  killSwitchActive: boolean;
  killSwitchAt: string | null;
  killSwitchReason: string | null;
}

export default function AutopilotSettingsPage() {
  const [config, setConfig] = useState<AutopilotConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [killDialogOpen, setKillDialogOpen] = useState(false);
  const [killReason, setKillReason] = useState("");
  const [driftReport, setDriftReport] = useState<any>(null);
  const [driftLoading, setDriftLoading] = useState(false);
  const [downgrading, setDowngrading] = useState(false);
  const [calibration, setCalibration] = useState<any>(null);
  const [calibrationLoading, setCalibrationLoading] = useState(false);

  useEffect(() => {
    fetch("/api/autopilot/config")
      .then((r) => r.json())
      .then((data) => setConfig(data))
      .catch((err) => console.error("[Autopilot]", err))
      .finally(() => setLoading(false));
  }, []);

  function update<K extends keyof AutopilotConfig>(field: K, value: AutopilotConfig[K]) {
    setConfig((c) => (c ? { ...c, [field]: value } : c));
  }

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    try {
      const res = await fetch("/api/autopilot/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: config.enabled,
          mode: config.mode,
          minHistoryMatches: config.minHistoryMatches,
          minStabilityScore: config.minStabilityScore,
          maxAmount: config.maxAmount,
          minConfidence: config.minConfidence,
          allowedDocTypes: config.allowedDocTypes,
          allowedCurrencies: config.allowedCurrencies,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const updated = await res.json();
      setConfig({ ...config, ...updated });
      toast.success(de.autopilot.configSaved);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleKillSwitch(active: boolean) {
    if (active && !killReason.trim()) return;
    try {
      const res = await fetch("/api/autopilot/kill-switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active, reason: active ? killReason : undefined }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const updated = await res.json();
      setConfig((c) => (c ? { ...c, ...updated } : c));
      toast.success(active ? de.autopilot.killSwitchActive : de.autopilot.deactivateKillSwitch);
      setKillDialogOpen(false);
      setKillReason("");
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function fetchDrift() {
    setDriftLoading(true);
    try {
      const res = await fetch("/api/autopilot/drift");
      if (res.ok) setDriftReport(await res.json());
    } catch { /* non-critical */ }
    finally { setDriftLoading(false); }
  }

  async function fetchCalibration() {
    setCalibrationLoading(true);
    try {
      const res = await fetch("/api/autopilot/calibration");
      if (res.ok) setCalibration(await res.json());
    } catch { /* non-critical */ }
    finally { setCalibrationLoading(false); }
  }

  async function handleAutoDowngrade() {
    setDowngrading(true);
    try {
      const res = await fetch("/api/autopilot/drift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check_and_apply" }),
      });
      if (res.ok) {
        const result = await res.json();
        if (result.downgraded) {
          toast.success(de.drift.downgraded.replace("{from}", result.from).replace("{to}", result.to));
          setConfig((c) => c ? { ...c, mode: result.to } : c);
          fetchDrift();
        } else {
          toast.success(de.drift.noDrift);
        }
      }
    } catch (err: any) { toast.error(err.message); }
    finally { setDowngrading(false); }
  }

  function toggleListItem(field: "allowedDocTypes" | "allowedCurrencies", value: string) {
    if (!config) return;
    const current = config[field] || [];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    update(field, next.length > 0 ? next : null);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!config) return <p>Fehler beim Laden</p>;

  const statusBadge = config.killSwitchActive
    ? { label: de.autopilot.killSwitchActive, color: "bg-red-100 text-red-800" }
    : config.enabled
    ? { label: de.autopilot.enabled, color: "bg-green-100 text-green-800" }
    : { label: de.autopilot.disabled, color: "bg-gray-100 text-gray-700" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Zap className="h-6 w-6 text-amber-500" />
          <h1 className="text-2xl font-semibold tracking-tight">{de.autopilot.title}</h1>
          <Badge className={statusBadge.color}>{statusBadge.label}</Badge>
          {config.mode === "shadow" && config.enabled && !config.killSwitchActive && (
            <TrustSignal level="protected" reason="Beobachtungsmodus — Vorschläge werden nur angezeigt, nicht angewendet" />
          )}
          {config.mode === "prefill" && config.enabled && !config.killSwitchActive && (
            <TrustSignal level="ai_suggested" reason="Vorausfüllungsmodus — Felder werden vorausgefüllt, Prüfung erforderlich" />
          )}
          {config.mode === "auto_ready" && config.enabled && !config.killSwitchActive && (
            <TrustSignal level="ai_confirmed" reason="Automatik — Belege werden bei hoher Sicherheit automatisch genehmigt" />
          )}
          {config.killSwitchActive && (
            <ProtectionBadge type="autopilot_blocked" detail={config.killSwitchReason || undefined} />
          )}
        </div>
      </div>

      {/* Kill Switch */}
      {config.killSwitchActive ? (
        <Card className="border-2 border-red-300 bg-red-50">
          <CardContent className="py-4 space-y-2">
            <div className="flex items-center gap-2">
              <AlertOctagon className="h-5 w-5 text-red-700" />
              <strong className="text-red-900">{de.autopilot.killSwitchActive}</strong>
            </div>
            {config.killSwitchReason && (
              <p className="text-sm text-red-800">
                {de.autopilot.killSwitchReason}: {config.killSwitchReason}
              </p>
            )}
            {config.killSwitchAt && (
              <p className="text-xs text-red-700">
                {new Date(config.killSwitchAt).toLocaleString("de-CH")}
              </p>
            )}
            <Button
              size="sm"
              variant="outline"
              className="border-green-300 text-green-700 hover:bg-green-50"
              onClick={() => handleKillSwitch(false)}
            >
              <Power className="h-4 w-4 mr-1" />
              {de.autopilot.deactivateKillSwitch}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-2 border-green-200">
          <CardContent className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Power className="h-5 w-5 text-green-700" />
              <span className="text-sm font-medium text-green-900">Autopilot l\u00e4uft</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-red-300 text-red-700 hover:bg-red-50"
              onClick={() => setKillDialogOpen(true)}
            >
              <AlertOctagon className="h-4 w-4 mr-1" />
              {de.autopilot.activateKillSwitch}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Modus */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Modus</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={config.enabled}
              onCheckedChange={(c) => update("enabled", !!c)}
            />
            <Label className="text-sm">{de.autopilot.enabled}</Label>
          </div>

          <div className="space-y-2">
            {(["shadow", "prefill", "auto_ready"] as const).map((mode) => (
              <label key={mode} className="flex items-start gap-2 p-3 border rounded-md cursor-pointer hover:bg-muted/50">
                <input
                  type="radio"
                  name="mode"
                  checked={config.mode === mode}
                  onChange={() => update("mode", mode)}
                  className="mt-1"
                />
                <div>
                  <div className="text-sm font-medium">{de.autopilot.mode[mode]}</div>
                  <p className="text-xs text-muted-foreground">{de.autopilot.configPage.modeDescription[mode]}</p>
                </div>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Safety Gates */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{de.autopilot.configPage.safetyGates}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{de.autopilot.minHistory}</Label>
              <Input
                type="number"
                min={1}
                value={config.minHistoryMatches}
                onChange={(e) => update("minHistoryMatches", parseInt(e.target.value) || 1)}
              />
            </div>
            <div>
              <Label className="text-xs">{de.autopilot.minStability} ({Math.round(config.minStabilityScore * 100)}%)</Label>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(config.minStabilityScore * 100)}
                onChange={(e) => update("minStabilityScore", parseInt(e.target.value) / 100)}
                className="w-full"
              />
            </div>
            <div>
              <Label className="text-xs">{de.autopilot.maxAmount} (CHF, optional)</Label>
              <Input
                type="number"
                min={0}
                value={config.maxAmount ?? ""}
                onChange={(e) => update("maxAmount", e.target.value ? parseFloat(e.target.value) : null)}
              />
            </div>
            <div>
              <Label className="text-xs">{de.autopilot.minConfidence} ({Math.round(config.minConfidence * 100)}%)</Label>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(config.minConfidence * 100)}
                onChange={(e) => update("minConfidence", parseInt(e.target.value) / 100)}
                className="w-full"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs mb-2 block">{de.autopilot.allowedDocTypes}</Label>
            <div className="flex flex-wrap gap-2">
              {DOC_TYPES.map((dt) => (
                <label key={dt} className="flex items-center gap-1 text-xs">
                  <Checkbox
                    checked={(config.allowedDocTypes || []).includes(dt)}
                    onCheckedChange={() => toggleListItem("allowedDocTypes", dt)}
                  />
                  {de.documentType[dt as keyof typeof de.documentType] || dt}
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs mb-2 block">{de.autopilot.allowedCurrencies}</Label>
            <div className="flex flex-wrap gap-2">
              {CURRENCIES.map((cur) => (
                <label key={cur} className="flex items-center gap-1 text-xs">
                  <Checkbox
                    checked={(config.allowedCurrencies || []).includes(cur)}
                    onCheckedChange={() => toggleListItem("allowedCurrencies", cur)}
                  />
                  {cur}
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Drift Detection */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><TrendingDown className="h-4 w-4" />{de.drift.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!driftReport ? (
            <Button variant="outline" size="sm" onClick={fetchDrift} disabled={driftLoading}>
              {driftLoading ? "Pr\u00fcfe..." : de.drift.title + " pr\u00fcfen"}
            </Button>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className={"inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium " + (driftReport.overallScore >= 70 ? "bg-green-100 text-green-800" : driftReport.overallScore >= 40 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800")}>
                  <ShieldCheck className="h-4 w-4" />
                  {de.drift.score}: {driftReport.overallScore}/100
                </div>
                <span className="text-sm text-muted-foreground">
                  {driftReport.recommendation === "keep" ? de.drift.recommendation.keep : driftReport.recommendation === "downgrade" ? de.drift.recommendation.downgrade : de.drift.recommendation.emergency_stop}
                </span>
              </div>
              {driftReport.signals.length === 0 && (
                <InfoPanel tone="success" icon={ShieldCheck}>{de.drift.noDrift}</InfoPanel>
              )}
              {driftReport.signals.map((s: any, i: number) => (
                <InfoPanel key={i} tone={s.severity === "critical" ? "error" : "warning"} icon={TrendingDown}>
                  {s.message} ({de.drift.signals[s.type as keyof typeof de.drift.signals] || s.type})
                </InfoPanel>
              ))}
              {driftReport.recommendation !== "keep" && (
                <Button variant="destructive" size="sm" onClick={handleAutoDowngrade} disabled={downgrading}>
                  {downgrading ? "Pr\u00fcfe..." : de.drift.autoDowngrade}
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={fetchDrift} disabled={driftLoading}>Aktualisieren</Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Confidence Calibration */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4" />{de.calibration.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!calibration ? (
            <Button variant="outline" size="sm" onClick={fetchCalibration} disabled={calibrationLoading}>
              {calibrationLoading ? "Lade..." : de.calibration.title + " laden"}
            </Button>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-2">
                <Badge className={calibration.overallCalibration >= 0.7 ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}>
                  {calibration.overallCalibration >= 0.7 ? de.calibration.wellCalibrated : de.calibration.needsCheck}
                </Badge>
                <span className="text-xs text-muted-foreground">{de.calibration.overallCalibration}: {Math.round(calibration.overallCalibration * 100)}%</span>
              </div>
              {(["high", "medium", "low"] as const).map((level) => {
                const data = calibration.levels[level];
                if (!data || data.count === 0) return null;
                return (
                  <div key={level} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>{de.calibration[level === "high" ? "highConfidence" : level === "medium" ? "mediumConfidence" : "lowConfidence"]} ({data.count})</span>
                      <span>{de.calibration.actual}: {Math.round(data.actualAccuracy * 100)}% / {de.calibration.expected}: {Math.round(data.threshold * 100)}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted relative">
                      <div className="h-2 rounded-full bg-blue-500 transition-all" style={{ width: Math.min(100, Math.round(data.actualAccuracy * 100)) + "%" }} />
                      <div className="absolute top-0 h-2 w-0.5 bg-gray-400" style={{ left: Math.round(data.threshold * 100) + "%" }} />
                    </div>
                  </div>
                );
              })}
              {calibration.recommendation && (
                <InfoPanel tone="warning" icon={BarChart3}>{calibration.recommendation}</InfoPanel>
              )}
              <Button variant="ghost" size="sm" onClick={fetchCalibration} disabled={calibrationLoading}>Aktualisieren</Button>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {de.autopilot.configPage.save}
        </Button>
        <Link href="/settings/control-center">
          <Button variant="outline">
            <Activity className="h-4 w-4 mr-2" />
            {de.controlCenter.openControlCenter}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>
      </div>

      {/* Kill Switch Dialog */}
      <Dialog open={killDialogOpen} onOpenChange={setKillDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{de.autopilot.activateKillSwitch}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={killReason}
            onChange={(e) => setKillReason(e.target.value)}
            placeholder={de.autopilot.killSwitchReason}
            rows={3}
          />
          <DialogFooter>
            <DialogClose><Button variant="outline">{de.common.cancel}</Button></DialogClose>
            <Button variant="destructive" onClick={() => handleKillSwitch(true)} disabled={!killReason.trim()}>
              <AlertOctagon className="h-4 w-4 mr-1" />
              {de.autopilot.activateKillSwitch}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
