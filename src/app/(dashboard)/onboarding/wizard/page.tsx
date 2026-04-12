"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronLeft, ChevronRight, CheckCircle2, Circle, Wand2, Clock, AlertCircle,
} from "lucide-react";
import { de } from "@/lib/i18n/de";
import { InfoPanel } from "@/components/ds";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface WizardState {
  sessionId: string;
  companyId: string;
  currentStep: number;
  completedSteps: number[];
  stepData: Record<string, any>;
  stepStatuses: Array<{ step: number; key: string; label: string; status: string }>;
  canProceed: boolean;
  firstUsefulState: boolean;
  readinessScore: number | null;
  moduleReadiness: Record<string, string> | null;
  knownUnknownsCount: { open: number; blockers: number };
  goLivePhase: string | null;
  progress: number;
  lastActiveAt: string;
  status: string;
}

const LEGAL_FORMS = ["Einzelfirma", "GmbH", "AG", "Kollektivgesellschaft", "Verein", "Stiftung", "Genossenschaft"];
const INDUSTRIES = [
  "Gastgewerbe & Hotellerie", "Handel & Detailhandel", "Baugewerbe", "IT & Technologie",
  "Gesundheitswesen", "Finanzdienstleistungen", "Immobilien", "Transport & Logistik",
  "Bildung", "Landwirtschaft", "Produktion & Industrie", "Beratung & Dienstleistung",
  "Kultur & Medien", "Tourismus", "Energie", "Andere",
];

export default function OnboardingWizardPage() {
  const [state, setState] = useState<WizardState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [s1, setS1] = useState({
    name: "", legalName: "", legalForm: "", industry: "", subIndustry: "",
    vatNumber: "", uid: "", employeeCount: "", website: "", phone: "",
    email: "", businessModel: "",
  });

  const [s2, setS2] = useState({
    vatLiable: true, vatMethod: "", vatInterval: "", vatFlatRate: "",
    fiscalYearStart: "1", costCentersEnabled: false, projectsEnabled: false, useBanana: false,
  });

  const [accountCount, setAccountCount] = useState(0);
  const [bankCount, setBankCount] = useState(0);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch("/api/onboarding/wizard");
      if (res.ok) {
        const data: WizardState = await res.json();
        setState(data);
        if (data.stepData["1"]) setS1((p) => ({ ...p, ...data.stepData["1"] }));
        if (data.stepData["2"]) setS2((p) => ({ ...p, ...data.stepData["2"] }));
      }
    } catch { /* non-critical */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchState(); }, [fetchState]);

  // Prefill from company on first load
  useEffect(() => {
    if (!state || state.completedSteps.includes(1)) return;
    fetch("/api/company")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        setS1((p) => ({
          ...p,
          name: data.name || p.name, legalName: data.legalName || p.legalName,
          legalForm: data.legalForm || p.legalForm, industry: data.industry || p.industry,
          subIndustry: data.subIndustry || p.subIndustry, vatNumber: data.vatNumber || p.vatNumber,
          uid: data.uid || p.uid, employeeCount: data.employeeCount ? String(data.employeeCount) : p.employeeCount,
          website: data.website || p.website, phone: data.phone || p.phone,
          email: data.email || p.email, businessModel: data.businessModel || p.businessModel,
        }));
        setS2((p) => ({
          ...p,
          vatLiable: data.vatLiable ?? p.vatLiable, vatMethod: data.vatMethod || p.vatMethod,
          vatInterval: data.vatInterval || p.vatInterval,
          fiscalYearStart: data.fiscalYearStart ? String(data.fiscalYearStart) : p.fiscalYearStart,
          costCentersEnabled: data.costCentersEnabled ?? p.costCentersEnabled,
          projectsEnabled: data.projectsEnabled ?? p.projectsEnabled,
        }));
        setAccountCount(data._count?.accounts || 0);
        setBankCount(data._count?.bankAccounts || 0);
      })
      .catch(() => {});
  }, [state?.sessionId]);

  async function handleCompleteStep(step: number, data: Record<string, any>) {
    setSaving(true);
    try {
      const res = await fetch("/api/onboarding/wizard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete_step", step, data }),
      });
      if (res.ok) {
        setState(await res.json());
        const stepKey = state?.stepStatuses.find((s) => s.step === step)?.key;
        toast.success((stepKey ? de.onboardingWizard.steps[stepKey as keyof typeof de.onboardingWizard.steps] : "Schritt") + " gespeichert");
      } else {
        toast.error((await res.json()).error);
      }
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  async function handleNavigate(step: number) {
    try {
      const res = await fetch("/api/onboarding/wizard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "navigate", step }),
      });
      if (res.ok) setState(await res.json());
    } catch { /* non-critical */ }
  }

  if (loading) return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <Skeleton className="h-8 w-64" /><Skeleton className="h-16 w-full" /><Skeleton className="h-64 w-full" />
    </div>
  );

  if (!state) return <p>Fehler beim Laden des Wizards</p>;

  const cs = state.currentStep;
  const pct = Math.round(state.progress * 100);
  const s1Valid = !!(s1.name && s1.legalName && s1.industry && (s1.vatNumber || s1.uid));

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wand2 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{de.onboardingWizard.title}</h1>
            <p className="text-sm text-muted-foreground">
              {de.onboardingWizard.subtitle.replace("{step}", String(cs)).replace("{total}", "7")}
              {" \u2014 "}{de.onboardingWizard.progress.replace("{percent}", String(pct))}
            </p>
          </div>
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          {de.onboardingWizard.lastSaved}: {new Date(state.lastActiveAt).toLocaleString("de-CH")}
        </div>
      </div>

      {/* First Useful State Banner */}
      {state.firstUsefulState && state.status === "in_progress" && (
        <InfoPanel tone="success" icon={CheckCircle2}>
          <strong>{de.onboardingWizard.firstUsefulState}</strong>
          <p className="text-sm">{de.onboardingWizard.firstUsefulStateDescription}</p>
        </InfoPanel>
      )}

      {/* Step Navigation */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {state.stepStatuses.map((s) => (
          <button
            key={s.step}
            type="button"
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs transition-colors whitespace-nowrap",
              s.status === "completed" ? "bg-green-100 text-green-800 hover:bg-green-200"
                : s.step === cs ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}
            onClick={() => handleNavigate(s.step)}
            disabled={s.status === "not_started" && s.step > Math.max(...state.completedSteps, 0) + 1}
          >
            {s.status === "completed" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{s.label}</span>
            <span className="sm:hidden">{s.step}</span>
          </button>
        ))}
      </div>

      {/* Step 1: Grunddaten */}
      {cs === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{de.onboardingWizard.step1.title}</CardTitle>
            <p className="text-sm text-muted-foreground">{de.onboardingWizard.step1.description}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label className="text-xs">{de.suppliers.name} *</Label><Input value={s1.name} onChange={(e) => setS1({ ...s1, name: e.target.value })} /></div>
              <div><Label className="text-xs">Rechtlicher Name *</Label><Input value={s1.legalName} onChange={(e) => setS1({ ...s1, legalName: e.target.value })} /></div>
              <div>
                <Label className="text-xs">{de.onboardingWizard.step1.legalForm}</Label>
                <select className="w-full border rounded-md px-3 py-1.5 text-sm" value={s1.legalForm} onChange={(e) => setS1({ ...s1, legalForm: e.target.value })}>
                  <option value="">Bitte w\u00e4hlen</option>
                  {LEGAL_FORMS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">{de.onboardingWizard.step1.industry} *</Label>
                <select className="w-full border rounded-md px-3 py-1.5 text-sm" value={s1.industry} onChange={(e) => setS1({ ...s1, industry: e.target.value })}>
                  <option value="">Bitte w\u00e4hlen</option>
                  {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div><Label className="text-xs">{de.onboardingWizard.step1.subIndustry}</Label><Input value={s1.subIndustry} onChange={(e) => setS1({ ...s1, subIndustry: e.target.value })} /></div>
              <div><Label className="text-xs">{de.detail.vatNumber}</Label><Input value={s1.vatNumber} onChange={(e) => setS1({ ...s1, vatNumber: e.target.value })} placeholder="CHE-xxx.xxx.xxx" /></div>
              <div><Label className="text-xs">UID</Label><Input value={s1.uid} onChange={(e) => setS1({ ...s1, uid: e.target.value })} /></div>
              <div><Label className="text-xs">{de.onboardingWizard.step1.employees}</Label><Input type="number" value={s1.employeeCount} onChange={(e) => setS1({ ...s1, employeeCount: e.target.value })} /></div>
              <div><Label className="text-xs">Website</Label><Input value={s1.website} onChange={(e) => setS1({ ...s1, website: e.target.value })} /></div>
              <div><Label className="text-xs">Telefon</Label><Input value={s1.phone} onChange={(e) => setS1({ ...s1, phone: e.target.value })} /></div>
              <div><Label className="text-xs">E-Mail</Label><Input value={s1.email} onChange={(e) => setS1({ ...s1, email: e.target.value })} /></div>
            </div>
            {!s1.vatNumber && !s1.uid && (
              <InfoPanel tone="warning" icon={AlertCircle}>{de.onboardingWizard.step1.identifierRequired}</InfoPanel>
            )}
            <div>
              <Label className="text-xs">{de.onboardingWizard.step1.businessDescription}</Label>
              <Textarea value={s1.businessModel} onChange={(e) => setS1({ ...s1, businessModel: e.target.value })} rows={3} placeholder="Wie verdient das Unternehmen Geld?" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Steuer & Buchhaltung */}
      {cs === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{de.onboardingWizard.step2.title}</CardTitle>
            <p className="text-sm text-muted-foreground">{de.onboardingWizard.step2.description}</p>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* MwSt */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">{de.onboardingWizard.step2.vatConfig}</h3>
              <div className="flex items-center gap-2">
                <Checkbox checked={s2.vatLiable} onCheckedChange={(c) => setS2({ ...s2, vatLiable: !!c })} />
                <Label className="text-sm">{de.onboardingWizard.step2.vatLiable}</Label>
              </div>
              {s2.vatLiable && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">{de.onboardingWizard.step2.vatMethod}</Label>
                    <select className="w-full border rounded-md px-3 py-1.5 text-sm" value={s2.vatMethod} onChange={(e) => setS2({ ...s2, vatMethod: e.target.value })}>
                      <option value="">Bitte w\u00e4hlen</option>
                      <option value="effektiv">Effektiv</option>
                      <option value="saldo">Saldosteuersatz</option>
                      <option value="pauschal">Pauschalsteuersatz</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">{de.onboardingWizard.step2.vatInterval}</Label>
                    <select className="w-full border rounded-md px-3 py-1.5 text-sm" value={s2.vatInterval} onChange={(e) => setS2({ ...s2, vatInterval: e.target.value })}>
                      <option value="">Bitte w\u00e4hlen</option>
                      <option value="quarterly">Quartal</option>
                      <option value="semi_annual">Halbjahr</option>
                      <option value="annual">Jahr</option>
                    </select>
                  </div>
                  {(s2.vatMethod === "saldo" || s2.vatMethod === "pauschal") && (
                    <div>
                      <Label className="text-xs">{de.onboardingWizard.step2.flatRate} (%)</Label>
                      <Input type="number" step="0.1" value={s2.vatFlatRate} onChange={(e) => setS2({ ...s2, vatFlatRate: e.target.value })} />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Kontenplan */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Kontenplan</h3>
              <div className="flex items-center gap-3">
                <Badge className={accountCount >= 10 ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}>
                  {de.onboardingWizard.step2.chartStatus.replace("{count}", String(accountCount))}
                </Badge>
                {accountCount < 10 && <span className="text-xs text-amber-700">{de.onboardingWizard.step2.chartInsufficient}</span>}
              </div>
              <Link href="/accounts" target="_blank"><Button variant="outline" size="sm">{de.onboardingWizard.step2.importChart}</Button></Link>
            </div>

            {/* Bank */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Bankverbindungen</h3>
              <Badge variant="secondary">{de.onboardingWizard.step2.bankStatus.replace("{count}", String(bankCount))}</Badge>
              <Link href="/bank" target="_blank"><Button variant="outline" size="sm">{de.onboardingWizard.step2.manageBank}</Button></Link>
            </div>

            {/* Options */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Optionen</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{de.onboardingWizard.step2.fiscalYear}</Label>
                  <select className="w-full border rounded-md px-3 py-1.5 text-sm" value={s2.fiscalYearStart} onChange={(e) => setS2({ ...s2, fiscalYearStart: e.target.value })}>
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={String(i + 1)}>
                        {new Date(2026, i, 1).toLocaleString("de-CH", { month: "long" })}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={s2.costCentersEnabled} onCheckedChange={(c) => setS2({ ...s2, costCentersEnabled: !!c })} />{de.onboardingWizard.step2.costCenters}</label>
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={s2.projectsEnabled} onCheckedChange={(c) => setS2({ ...s2, projectsEnabled: !!c })} />{de.onboardingWizard.step2.projects}</label>
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={s2.useBanana} onCheckedChange={(c) => setS2({ ...s2, useBanana: !!c })} />{de.onboardingWizard.step2.useBanana}</label>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Steps 3-7: Placeholder */}
      {cs >= 3 && cs <= 7 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-muted-foreground mb-4">{de.onboardingWizard.placeholder}</p>
            <Button variant="outline" onClick={() => handleCompleteStep(cs, {})} disabled={saving}>
              {de.onboardingWizard.skip}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" disabled={cs <= 1} onClick={() => handleNavigate(cs - 1)}>
          <ChevronLeft className="h-4 w-4 mr-1" />{de.onboardingWizard.back}
        </Button>
        <Badge variant="secondary" className="text-xs">{de.onboardingWizard.progress.replace("{percent}", String(pct))}</Badge>
        {cs === 1 ? (
          <Button onClick={() => handleCompleteStep(1, s1)} disabled={saving || !s1Valid}>
            {saving ? "Speichere..." : de.onboardingWizard.next}<ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : cs === 2 ? (
          <Button onClick={() => handleCompleteStep(2, s2)} disabled={saving}>
            {saving ? "Speichere..." : de.onboardingWizard.next}<ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : cs < 7 ? (
          <Button onClick={() => handleCompleteStep(cs, {})} disabled={saving}>
            {saving ? "Speichere..." : de.onboardingWizard.next}<ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button disabled={saving}>{de.onboardingWizard.complete}</Button>
        )}
      </div>
    </div>
  );
}
