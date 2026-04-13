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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ChevronLeft, ChevronRight, CheckCircle2, Circle, Wand2, Clock, AlertCircle,
  MessageSquare, Lightbulb, SkipForward, Zap, XCircle, ArrowRight, AlertTriangle,
  Rocket,
} from "lucide-react";
import { de } from "@/lib/i18n/de";
import { InfoPanel } from "@/components/ds";
import { WizardSkeleton } from "@/components/ds/page-skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useCompany } from "@/lib/contexts/company-context";

const WIZARD_STEPS = [
  { step: 1, key: "basics",     label: "Grunddaten" },
  { step: 2, key: "accounting", label: "Steuer & Buchhaltung" },
  { step: 3, key: "documents",  label: "Historische Belege" },
  { step: 4, key: "business",   label: "Geschäftsmodell" },
  { step: 5, key: "review",     label: "Intelligenz prüfen" },
  { step: 6, key: "readiness",  label: "Readiness & Unknowns" },
  { step: 7, key: "golive",     label: "Go-Live" },
];

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
  const { activeCompany } = useCompany();
  const role = activeCompany?.role || "viewer";
  const isTrustee = role === "admin" || role === "trustee";
  const isViewer = role === "viewer" || role === "readonly";

  // Viewer sees only Basics, Accounting, Docs, Go-Live
  const visibleSteps = isTrustee
    ? WIZARD_STEPS
    : WIZARD_STEPS.filter(s => [1, 2, 3, 7].includes(s.step));

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

  // Step 4: Chat state
  const [chatQuestions, setChatQuestions] = useState<any[]>([]);
  const [chatCurrentIdx, setChatCurrentIdx] = useState(0);
  const [chatAnswer, setChatAnswer] = useState("");
  const [chatSubmitting, setChatSubmitting] = useState(false);
  const [chatResult, setChatResult] = useState<any>(null);
  const [chatAnswered, setChatAnswered] = useState<any[]>([]);
  const [chatAnsweredCount, setChatAnsweredCount] = useState(0);

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

  async function fetchChatQuestions() {
    try {
      const res = await fetch("/api/onboarding/chat");
      if (res.ok) {
        const data = await res.json();
        setChatQuestions(data.questions);
        setChatAnsweredCount(data.answeredCount);
        setChatCurrentIdx(0);
        setChatResult(null);
        setChatAnswer("");
      }
    } catch { /* non-critical */ }
  }

  async function handleSubmitAnswer() {
    if (!chatAnswer.trim() || !chatQuestions[chatCurrentIdx]) return;
    setChatSubmitting(true);
    setChatResult(null);
    try {
      const res = await fetch("/api/onboarding/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: chatQuestions[chatCurrentIdx].id, answer: chatAnswer }),
      });
      if (res.ok) {
        const result = await res.json();
        setChatResult(result);
        setChatAnswered((prev) => [...prev, { q: chatQuestions[chatCurrentIdx], a: chatAnswer, result }]);
        setChatAnsweredCount((c) => c + 1);
        setChatAnswer("");
      } else {
        toast.error((await res.json()).error);
      }
    } catch (err: any) { toast.error(err.message); }
    finally { setChatSubmitting(false); }
  }

  function handleNextQuestion() {
    setChatResult(null);
    if (chatCurrentIdx + 1 < chatQuestions.length) {
      setChatCurrentIdx((i) => i + 1);
    } else {
      fetchChatQuestions();
    }
  }

  // Load chat questions when entering step 4
  useEffect(() => {
    if (state?.currentStep === 4) fetchChatQuestions();
  }, [state?.currentStep]);

  if (loading) return <WizardSkeleton />;

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
        {state.stepStatuses.filter(s => visibleSteps.some(v => v.step === s.step)).map((s) => (
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
              <div><Label className="text-xs">{de.detail.vatNumber}</Label><Input value={s1.vatNumber} onChange={(e) => setS1({ ...s1, vatNumber: e.target.value })} placeholder="CHE-xxx.xxx.xxx" /></div>
              <div><Label className="text-xs">UID</Label><Input value={s1.uid} onChange={(e) => setS1({ ...s1, uid: e.target.value })} /></div>
              {isTrustee && (
                <>
                  <div><Label className="text-xs">{de.onboardingWizard.step1.subIndustry}</Label><Input value={s1.subIndustry} onChange={(e) => setS1({ ...s1, subIndustry: e.target.value })} /></div>
                  <div><Label className="text-xs">{de.onboardingWizard.step1.employees}</Label><Input type="number" value={s1.employeeCount} onChange={(e) => setS1({ ...s1, employeeCount: e.target.value })} /></div>
                  <div><Label className="text-xs">Website</Label><Input value={s1.website} onChange={(e) => setS1({ ...s1, website: e.target.value })} /></div>
                  <div><Label className="text-xs">Telefon</Label><Input value={s1.phone} onChange={(e) => setS1({ ...s1, phone: e.target.value })} /></div>
                  <div><Label className="text-xs">E-Mail</Label><Input value={s1.email} onChange={(e) => setS1({ ...s1, email: e.target.value })} /></div>
                </>
              )}
            </div>
            {!s1.vatNumber && !s1.uid && (
              <InfoPanel tone="warning" icon={AlertCircle}>{de.onboardingWizard.step1.identifierRequired}</InfoPanel>
            )}
            {isTrustee && (
              <div>
                <Label className="text-xs">{de.onboardingWizard.step1.businessDescription}</Label>
                <Textarea value={s1.businessModel} onChange={(e) => setS1({ ...s1, businessModel: e.target.value })} rows={3} placeholder="Wie verdient das Unternehmen Geld?" />
              </div>
            )}
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

            {isTrustee && (
              <>
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
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Placeholder */}
      {cs === 3 && (
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

      {/* Step 7: Go-Live */}
      {cs === 7 && (
        <Step7GoLive sessionId={state.sessionId} companyId={state.companyId} onCompleted={fetchState} />
      )}

      {/* Step 6: Readiness & Unknowns */}
      {cs === 6 && state && (
        <Step6Readiness companyId={state.companyId} sessionId={state.sessionId} isViewer={isViewer} onComplete={(data) => handleCompleteStep(6, data)} />
      )}

      {/* Step 5: Intelligence Review */}
      {cs === 5 && (
        <Step5Intelligence sessionId={state?.sessionId || ""} onComplete={(data) => handleCompleteStep(5, data)} />
      )}

      {/* Step 4: Business Chat */}
      {cs === 4 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  {de.onboardingWizard.step4.title}
                </CardTitle>
                <Badge variant="secondary">
                  {de.onboardingWizard.step4.questionsAnswered
                    .replace("{answered}", String(chatAnsweredCount))
                    .replace("{total}", String(chatAnsweredCount + chatQuestions.length))}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{de.onboardingWizard.step4.description}</p>
            </CardHeader>
          </Card>

          {/* Current question */}
          {chatQuestions[chatCurrentIdx] && !chatResult && (
            <Card className="border-primary">
              <CardContent className="pt-4 space-y-3">
                <Badge variant="secondary" className="text-xs">
                  {de.onboardingWizard.step4.categories[chatQuestions[chatCurrentIdx].category as keyof typeof de.onboardingWizard.step4.categories] || chatQuestions[chatCurrentIdx].category}
                </Badge>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Lightbulb className="h-3 w-3" />{chatQuestions[chatCurrentIdx].reason}
                </p>
                <p className="font-medium text-base">{chatQuestions[chatCurrentIdx].question}</p>
                <Textarea
                  value={chatAnswer}
                  onChange={(e) => setChatAnswer(e.target.value)}
                  rows={4}
                  placeholder="Ihre Antwort..."
                />
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                    onClick={handleNextQuestion}
                  >
                    <SkipForward className="h-3 w-3" />{de.onboardingWizard.step4.skipQuestion}
                  </button>
                  <Button onClick={handleSubmitAnswer} disabled={!chatAnswer.trim() || chatSubmitting}>
                    {chatSubmitting ? de.onboardingWizard.step4.analyzing : de.onboardingWizard.step4.submitAnswer}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Extraction result */}
          {chatResult && (
            <Card className="border-green-200 bg-green-50/30">
              <CardContent className="pt-4 space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  {de.onboardingWizard.step4.extractedInsights}
                </h3>
                {chatResult.insights.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {chatResult.insights.map((i: any, idx: number) => (
                      <Badge key={idx} className={i.confidence === "high" ? "bg-green-100 text-green-800" : i.confidence === "medium" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}>
                        {de.onboardingWizard.step4.insightTypes[i.type as keyof typeof de.onboardingWizard.step4.insightTypes] || i.type}: {i.content}
                      </Badge>
                    ))}
                  </div>
                )}
                {chatResult.suggestedRules.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3 w-3 inline mr-1 text-green-600" />{chatResult.suggestedRules.length} Regel-Vorschl\u00e4ge erkannt
                  </div>
                )}
                {chatResult.suggestedKnowledge.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3 w-3 inline mr-1 text-green-600" />{chatResult.suggestedKnowledge.length} Wissenseintr\u00e4ge erkannt
                  </div>
                )}
                {chatResult.resolvedUnknowns.length > 0 && (
                  <InfoPanel tone="success" icon={CheckCircle2}>
                    {de.onboardingWizard.step4.unknownsResolved.replace("{count}", String(chatResult.resolvedUnknowns.length))}
                  </InfoPanel>
                )}
                <Button onClick={handleNextQuestion} variant="outline">
                  {chatQuestions.length > chatCurrentIdx + 1 ? de.onboardingWizard.step4.nextQuestion : de.onboardingWizard.step4.allAnswered}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* No more questions */}
          {chatQuestions.length === 0 && !chatResult && (
            <InfoPanel tone="success" icon={CheckCircle2}>
              {de.onboardingWizard.step4.noMoreQuestions}
            </InfoPanel>
          )}

          {/* Answered history */}
          {chatAnswered.length > 0 && (
            <Card>
              <CardContent className="pt-4">
                <h3 className="text-sm font-semibold mb-2">Bisherige Antworten</h3>
                <div className="space-y-2">
                  {chatAnswered.map((item, idx) => (
                    <div key={idx} className="text-xs border rounded p-2">
                      <p className="font-medium">{item.q.question}</p>
                      <p className="text-muted-foreground mt-1 line-clamp-2">{item.a}</p>
                      <div className="flex gap-1 mt-1">
                        {item.result.insights.map((i: any, j: number) => (
                          <Badge key={j} variant="secondary" className="text-[0.65rem]">{i.content}</Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
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

/* ---------- Step 6: Readiness & Unknowns ---------- */

interface ReadinessData {
  moduleReadiness: Record<string, string>;
  readinessScore: number;
  knownUnknowns: { open: number; blockers: number };
}

interface UnknownItem {
  id: string;
  area: string;
  description: string;
  criticality: string;
  blocksGoLive: boolean;
  reducesReadiness: boolean;
  suggestedAction: string | null;
  responsibleRole: string | null;
  status: string;
  resolution: string | null;
}

interface GoLiveCheckData {
  canGoLive: boolean;
  readinessScore: number;
  moduleReadiness: Record<string, string>;
  blockers: string[];
  warnings: string[];
  recommendedGoLiveConfig: {
    autopilotMode: string;
    reviewLevel: string;
    monitoringLevel: string;
  };
  estimatedStabilizationDays: number;
}

const LEVEL_COLORS: Record<string, string> = {
  not_started: "border-slate-200 text-slate-500",
  partial: "border-amber-200 text-amber-700",
  manual_ok: "border-blue-200 text-blue-700",
  suggestions_ready: "border-blue-300 text-blue-800",
  prefill_ready: "border-green-200 text-green-700",
  shadow_ready: "border-green-300 text-green-800",
  auto_ready: "border-green-400 text-green-900",
};

const LEVEL_PERCENT: Record<string, number> = {
  not_started: 0, partial: 20, manual_ok: 40, suggestions_ready: 60,
  prefill_ready: 70, shadow_ready: 85, auto_ready: 100,
};

function Step6Readiness({ companyId, sessionId, isViewer, onComplete }: { companyId: string; sessionId: string; isViewer?: boolean; onComplete: (data: any) => void }) {
  const [readiness, setReadiness] = useState<ReadinessData | null>(null);
  const [unknowns, setUnknowns] = useState<UnknownItem[]>([]);
  const [unknownsSummary, setUnknownsSummary] = useState({ total: 0, open: 0, resolved: 0, blockers: 0 });
  const [goLiveCheck, setGoLiveCheck] = useState<GoLiveCheckData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [readinessRes, unknownsRes, goLiveRes] = await Promise.all([
        fetch("/api/onboarding/wizard/readiness"),
        fetch("/api/onboarding/unknowns"),
        fetch("/api/onboarding/wizard/golive-check"),
      ]);
      if (readinessRes.ok) setReadiness(await readinessRes.json());
      if (unknownsRes.ok) {
        const data = await unknownsRes.json();
        setUnknowns(data.unknowns);
        setUnknownsSummary(data.summary);
      }
      if (goLiveRes.ok) setGoLiveCheck(await goLiveRes.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleResolveUnknown(id: string, action: "resolve" | "accept" | "defer") {
    try {
      const res = await fetch("/api/onboarding/unknowns", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      if (res.ok) {
        toast.success(action === "resolve" ? "Frage geklärt" : action === "accept" ? "Akzeptiert" : "Zurückgestellt");
        fetchAll();
      } else {
        const err = await res.json();
        toast.error(err.error);
      }
    } catch (e: any) { toast.error(e.message); }
  }

  if (loading) return <Skeleton className="h-64 w-full" />;

  const score = readiness?.readinessScore ?? 0;
  const pctScore = Math.round(score * 100);
  const moduleEntries = Object.entries(readiness?.moduleReadiness ?? {});
  const readyCount = moduleEntries.filter(([, l]) => !["not_started", "partial"].includes(l)).length;
  const partialCount = moduleEntries.filter(([, l]) => l === "partial").length;
  const notStartedCount = moduleEntries.filter(([, l]) => l === "not_started").length;

  // Group unknowns by area (only open ones)
  const openUnknowns = unknowns.filter((u) => u.status === "open");
  const groupedByArea: Record<string, UnknownItem[]> = {};
  for (const u of openUnknowns) {
    if (!groupedByArea[u.area]) groupedByArea[u.area] = [];
    groupedByArea[u.area].push(u);
  }

  const moduleLabels = de.onboardingWizard.readiness.modules as Record<string, string>;
  const levelLabels = de.onboardingWizard.readiness.levels as Record<string, string>;

  return (
    <div className="space-y-4">
      {/* Overall Readiness */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-6">
            <div className="relative flex items-center justify-center">
              <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="35" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
                <circle cx="40" cy="40" r="35" fill="none" stroke="currentColor" strokeWidth="6"
                  className={pctScore >= 70 ? "text-green-500" : pctScore >= 40 ? "text-amber-500" : "text-red-500"}
                  strokeDasharray={`${2 * Math.PI * 35}`}
                  strokeDashoffset={`${2 * Math.PI * 35 * (1 - score)}`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute text-lg font-bold">{pctScore}%</span>
            </div>
            <div className="flex-1 space-y-1">
              <h3 className="text-base font-semibold">{de.onboardingWizard.step6.overallReadiness}</h3>
              <Badge className={goLiveCheck?.canGoLive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                {goLiveCheck?.canGoLive ? de.onboardingWizard.step6.canGoLive : de.onboardingWizard.step6.cannotGoLive}
              </Badge>
              <p className="text-sm text-muted-foreground">
                {de.onboardingWizard.step6.modulesStatus
                  .replace("{ready}", String(readyCount))
                  .replace("{partial}", String(partialCount))
                  .replace("{notStarted}", String(notStartedCount))}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Viewer: Simplified readiness view */}
      {isViewer ? (
        <Card className="p-8 text-center">
          <p className="text-4xl font-bold">{pctScore}%</p>
          <p className="text-sm text-muted-foreground mt-1">{de.onboardingWizard.step6.overallReadiness}</p>
          <Badge className={cn("mt-3", goLiveCheck?.canGoLive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>
            {goLiveCheck?.canGoLive ? de.onboardingWizard.step6.canGoLive : de.onboardingWizard.step6.cannotGoLive}
          </Badge>
        </Card>
      ) : (
        <>
          {/* Module Readiness Grid */}
          <div className="grid grid-cols-2 gap-2">
            {moduleEntries.map(([mod, level]) => (
              <Card key={mod} className={cn("p-3 border", LEVEL_COLORS[level] || "")}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{moduleLabels[mod] || mod}</span>
                  <Badge variant="secondary" className="text-xs">{levelLabels[level] || level}</Badge>
                </div>
                <div className="mt-1.5 h-1 bg-muted rounded-full">
                  <div className="h-1 rounded-full bg-current" style={{ width: `${LEVEL_PERCENT[level] || 0}%` }} />
                </div>
              </Card>
            ))}
          </div>

          {/* Known Unknowns */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {de.onboardingWizard.step6.unknowns.title} ({unknownsSummary.open})
                </CardTitle>
                {unknownsSummary.blockers > 0 && (
                  <Badge className="bg-red-100 text-red-800">
                    {de.onboardingWizard.step6.unknowns.blockerCount.replace("{count}", String(unknownsSummary.blockers))}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {openUnknowns.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">{de.onboardingWizard.step6.unknowns.noUnknowns}</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(groupedByArea).map(([area, items]) => (
                    <div key={area}>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">{area}</h4>
                      <div className="space-y-1">
                        {items.map((u) => (
                          <div key={u.id} className={cn("flex items-center justify-between p-2 rounded text-sm",
                            u.blocksGoLive ? "bg-red-50 border-l-2 border-red-400" : "bg-muted/50"
                          )}>
                            <div className="flex-1 min-w-0">
                              <span>{u.description}</span>
                              {u.suggestedAction && <p className="text-xs text-muted-foreground">{u.suggestedAction}</p>}
                            </div>
                            <div className="flex gap-1 shrink-0 ml-2">
                              <Button size="sm" variant="ghost" onClick={() => handleResolveUnknown(u.id, "resolve")}>{de.onboardingWizard.step6.unknowns.resolve}</Button>
                              <Button size="sm" variant="ghost" onClick={() => handleResolveUnknown(u.id, "accept")}>{de.onboardingWizard.step6.unknowns.accept}</Button>
                              <Button size="sm" variant="ghost" onClick={() => handleResolveUnknown(u.id, "defer")}>{de.onboardingWizard.step6.unknowns.defer}</Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Blocker warnings */}
      {goLiveCheck && !goLiveCheck.canGoLive && (
        <InfoPanel tone="error" icon={AlertTriangle}>
          <strong>{de.onboardingWizard.step6.goLiveBlocked}</strong>
          <ul className="mt-1 text-sm space-y-0.5">
            {goLiveCheck.blockers.map((b, i) => <li key={i}>• {b}</li>)}
          </ul>
        </InfoPanel>
      )}

      {goLiveCheck?.canGoLive && (
        <InfoPanel tone="success" icon={CheckCircle2}>
          {de.onboardingWizard.step6.goLiveReady}
        </InfoPanel>
      )}

      {/* Proceed */}
      <div className="flex justify-end">
        <Button onClick={() => onComplete({ readinessScore: score, canGoLive: goLiveCheck?.canGoLive })}>
          {de.onboardingWizard.next} <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

/* ---------- Step 5: Intelligence Review ---------- */

const GOV_BADGE: Record<string, { label: string; className: string }> = {
  confirmed: { label: de.onboardingWizard.step5.governance.confirmed, className: "bg-green-100 text-green-800" },
  suggested: { label: de.onboardingWizard.step5.governance.suggested, className: "bg-blue-100 text-blue-800" },
  uncertain: { label: de.onboardingWizard.step5.governance.uncertain, className: "bg-amber-100 text-amber-800" },
  manual_confirm: { label: de.onboardingWizard.step5.governance.manual_confirm, className: "bg-red-100 text-red-800" },
  internal_only: { label: de.onboardingWizard.step5.governance.internal_only, className: "bg-slate-100 text-slate-700" },
  not_ready: { label: de.onboardingWizard.step5.governance.not_ready, className: "bg-slate-100 text-slate-700" },
};

interface BootstrapItem { id: string; type: string; title: string; description: string; governance: string; confidence: string; source: string; data: Record<string, any> }
interface BootstrapData { items: BootstrapItem[]; summary: { total: number; byType: Record<string, number>; byGovernance: Record<string, number> }; newKnownUnknowns: any[] }

function Step5Intelligence({ sessionId, onComplete }: { sessionId: string; onComplete: (data: any) => void }) {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [activeTab, setActiveTab] = useState<"rule" | "knowledge" | "expected_doc" | "supplier_default">("rule");
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [rejected, setRejected] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding/bootstrap");
      if (res.ok) setData(await res.json());
    } catch { /* */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleRunBootstrap() {
    setRunning(true);
    try {
      const res = await fetch("/api/onboarding/bootstrap", { method: "POST" });
      if (res.ok) { setData(await res.json()); toast.success("Intelligenz erzeugt"); }
      else { const err = await res.json(); toast.error(err.error); }
    } catch (e: any) { toast.error(e.message); }
    finally { setRunning(false); }
  }

  async function handleApply(ids: string[]) {
    setApplying(true);
    try {
      const res = await fetch("/api/onboarding/bootstrap/apply", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds: ids }),
      });
      if (res.ok) {
        const result = await res.json();
        const total = result.rulesCreated + result.knowledgeCreated + result.expectedDocsCreated + result.supplierDefaultsApplied;
        toast.success(`${total} Vorschläge angewendet`);
        for (const id of ids) accepted.add(id);
        setAccepted(new Set(accepted));
      } else { const err = await res.json(); toast.error(err.error); }
    } catch (e: any) { toast.error(e.message); }
    finally { setApplying(false); }
  }

  function acceptAllSafe() {
    if (!data) return;
    const safeIds = data.items.filter((i) => i.governance === "suggested" && i.confidence === "high" && !accepted.has(i.id) && !rejected.has(i.id)).map((i) => i.id);
    if (safeIds.length > 0) handleApply(safeIds);
  }

  const tabItems = data?.items.filter((i) => i.type === activeTab && !rejected.has(i.id)) || [];
  const tabs: Array<{ key: typeof activeTab; label: string }> = [
    { key: "rule", label: de.onboardingWizard.step5.tabs.rules },
    { key: "knowledge", label: de.onboardingWizard.step5.tabs.knowledge },
    { key: "expected_doc", label: de.onboardingWizard.step5.tabs.expectedDocs },
    { key: "supplier_default", label: de.onboardingWizard.step5.tabs.supplierDefaults },
  ];

  if (loading) return <Skeleton className="h-48 w-full" />;

  if (!data || data.items.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <Wand2 className="h-8 w-8 mx-auto text-muted-foreground/50" />
          <p className="text-sm font-medium">{de.onboardingWizard.step5.title}</p>
          <p className="text-sm text-muted-foreground">{de.onboardingWizard.step5.description}</p>
          <Button onClick={handleRunBootstrap} size="lg">
            <Zap className="h-4 w-4 mr-2" />
            {running ? de.onboardingWizard.step5.running : de.onboardingWizard.step5.runBootstrap}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const safeCount = data.items.filter((i) => i.governance === "suggested" && i.confidence === "high").length;
  const uncertainCount = data.items.filter((i) => i.governance === "uncertain" || i.governance === "manual_confirm").length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card>
        <CardContent className="pt-4 flex items-center justify-between">
          <p className="text-sm">
            {`${data.summary.total} Vorschläge, ${safeCount} davon sicher, ${uncertainCount} unsicher`}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={acceptAllSafe} disabled={applying || safeCount === 0}>
              Alle sicheren \u00fcbernehmen ({safeCount})
            </Button>
            <Button variant="outline" size="sm" onClick={handleRunBootstrap} disabled={running}>
              <Zap className="h-3.5 w-3.5 mr-1" />{running ? "..." : de.onboardingWizard.step5.runBootstrap}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {tabs.map((t) => (
          <button key={t.key} type="button"
            className={cn("px-4 py-2 text-sm font-medium border-b-2 transition-colors", activeTab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
            onClick={() => setActiveTab(t.key)}>
            {t.label} ({data.items.filter((i) => i.type === t.key).length})
          </button>
        ))}
      </div>

      {/* Tab content */}
      <Card>
        <CardContent className="pt-4">
          {tabItems.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Keine Vorschl\u00e4ge in dieser Kategorie</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Beschreibung</TableHead>
                  <TableHead>Konfidenz</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tabItems.map((item) => {
                  const gov = GOV_BADGE[item.governance] || GOV_BADGE.not_ready;
                  const isAccepted = accepted.has(item.id);
                  return (
                    <TableRow key={item.id} className={isAccepted ? "bg-green-50" : ""}>
                      <TableCell>
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={cn("text-xs",
                          item.confidence === "high" ? "bg-green-100 text-green-800" :
                          item.confidence === "medium" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"
                        )}>{item.confidence}</Badge>
                      </TableCell>
                      <TableCell><Badge variant="secondary" className={cn("text-xs", gov.className)}>{gov.label}</Badge></TableCell>
                      <TableCell>
                        {isAccepted ? (
                          <Badge className="bg-green-100 text-green-800 text-xs">{de.onboardingWizard.step5.governance.confirmed}</Badge>
                        ) : (
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => handleApply([item.id])} disabled={applying}>
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { rejected.add(item.id); setRejected(new Set(rejected)); }}>
                              <XCircle className="h-3.5 w-3.5 text-red-500" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Proceed */}
      <div className="flex justify-end">
        <Button onClick={() => onComplete({ bootstrapSummary: data.summary, acceptedCount: accepted.size, rejectedCount: rejected.size })}>
          Weiter zu Readiness & Go-Live <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

/* ---------- Step 7: Go-Live ---------- */

const phaseLabels: Record<string, string> = {
  go_live_started: "Go-Live gestartet",
  first_week: "Erste Woche",
  first_30_days: "Erste 30 Tage",
  stabilized: "Stabilisiert",
  normal: "Normaler Betrieb",
};

interface GoLiveStatusData {
  phase: string;
  startedAt: string;
  config: {
    autopilotMode: string;
    reviewLevel: string;
    monitoringLevel: string;
    activatedModules: string[];
    restrictedModules: string[];
    disabledModules: string[];
  };
  daysActive: number;
  nextPhaseAt: string | null;
  nextPhaseLabel: string | null;
  readinessScore: number;
  moduleReadiness: Record<string, string>;
  openTasksCount: number;
  openUnknownsCount: number;
  recommendations: string[];
}

function Step7GoLive({ sessionId, companyId, onCompleted }: { sessionId: string; companyId: string; onCompleted: () => void }) {
  const [goLiveStatus, setGoLiveStatus] = useState<GoLiveStatusData | null>(null);
  const [goLiveCheck, setGoLiveCheck] = useState<GoLiveCheckData | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // Load go-live status
        const statusRes = await fetch("/api/onboarding/golive");
        if (statusRes.ok) {
          const data = await statusRes.json();
          if (data) {
            setGoLiveStatus(data);
            setLoading(false);
            return;
          }
        }
        // Load readiness / go-live check
        const checkRes = await fetch("/api/onboarding/wizard/golive-check");
        if (checkRes.ok) {
          setGoLiveCheck(await checkRes.json());
        }
      } catch { /* non-critical */ }
      finally { setLoading(false); }
    }
    load();
  }, [companyId]);

  async function handleStartGoLive() {
    setStarting(true);
    try {
      const res = await fetch("/api/onboarding/golive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      if (res.ok) {
        const status = await res.json();
        setGoLiveStatus(status);
        toast.success(de.onboardingWizard.step7.startGoLive + "!");
        onCompleted();
      } else {
        const err = await res.json();
        toast.error(err.error);
      }
    } catch (err: any) { toast.error(err.message); }
    finally { setStarting(false); }
  }

  if (loading) return <Skeleton className="h-48 w-full" />;

  // AFTER Go-Live
  if (goLiveStatus) {
    return (
      <div className="space-y-4">
        {/* Phase-Badge zentriert */}
        <div className="text-center">
          <Badge className="text-base px-4 py-1.5 bg-green-100 text-green-800">
            {phaseLabels[goLiveStatus.phase] || goLiveStatus.phase}
          </Badge>
          <p className="text-sm text-muted-foreground mt-2">
            Tag {goLiveStatus.daysActive}
            {goLiveStatus.nextPhaseLabel && ` — ${de.onboardingWizard.step7.nextPhase}: ${goLiveStatus.nextPhaseLabel}`}
          </p>
        </div>

        {/* Status-Grid 2×3 */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: de.onboardingWizard.step7.autopilot, value: goLiveStatus.config.autopilotMode },
            { label: de.onboardingWizard.step7.review, value: goLiveStatus.config.reviewLevel },
            { label: "Monitoring", value: goLiveStatus.config.monitoringLevel },
            { label: de.onboardingWizard.step7.activeModules, value: goLiveStatus.config.activatedModules.length },
            { label: de.onboardingWizard.step7.openTasks, value: goLiveStatus.openTasksCount },
            { label: de.onboardingWizard.step7.openQuestions, value: goLiveStatus.openUnknownsCount },
          ].map(s => (
            <Card key={s.label} className="p-3 text-center">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="font-medium">{s.value}</p>
            </Card>
          ))}
        </div>

        {/* Eingeschränkte Module */}
        {goLiveStatus.config.restrictedModules.length > 0 && (
          <InfoPanel tone="info" icon={AlertCircle}>
            <strong>{de.onboardingWizard.step7.restrictedModules}:</strong> {goLiveStatus.config.restrictedModules.join(", ")}
          </InfoPanel>
        )}

        {/* Empfehlungen */}
        {goLiveStatus.recommendations.length > 0 && (
          <Card><CardContent className="pt-4">
            <h3 className="text-sm font-semibold mb-2">{de.onboardingWizard.step7.recommendations}</h3>
            {goLiveStatus.recommendations.map((r, i) => <p key={i} className="text-sm text-muted-foreground">• {r}</p>)}
          </CardContent></Card>
        )}

        {/* Abschluss-Banner */}
        <InfoPanel tone="success" icon={CheckCircle2}>
          <strong>{de.onboardingWizard.step7.completed}</strong>
          <p className="text-sm">{de.onboardingWizard.step7.completedDescription}</p>
          <Link href="/dashboard"><Button variant="outline" size="sm" className="mt-2">{de.onboardingWizard.step7.toDashboard}</Button></Link>
        </InfoPanel>
      </div>
    );
  }

  // BEFORE Go-Live
  return (
    <Card>
      <CardContent className="pt-6 space-y-5">
        <div className="text-center">
          <Rocket className="h-12 w-12 mx-auto mb-3 text-primary" />
          <h2 className="text-xl font-semibold">{de.onboardingWizard.step7.title}</h2>
          <p className="text-sm text-muted-foreground">{de.onboardingWizard.step7.description}</p>
        </div>

        {goLiveCheck && (
          <>
            {/* Empfohlene Konfiguration: 3 kompakte Karten */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <Card className="p-3"><p className="text-xs text-muted-foreground">Autopilot</p>
                <p className="font-medium">{goLiveCheck.recommendedGoLiveConfig.autopilotMode === "shadow" ? "Beobachtung" : "Vorausfüllung"}</p></Card>
              <Card className="p-3"><p className="text-xs text-muted-foreground">Review</p>
                <p className="font-medium">{goLiveCheck.recommendedGoLiveConfig.reviewLevel === "strict" ? "Verstärkt" : "Normal"}</p></Card>
              <Card className="p-3"><p className="text-xs text-muted-foreground">{de.onboardingWizard.step7.stabilization}</p>
                <p className="font-medium">~{goLiveCheck.estimatedStabilizationDays} {de.onboardingWizard.step7.days}</p></Card>
            </div>

            {/* Warnungen wenn vorhanden */}
            {goLiveCheck.warnings.length > 0 && (
              <InfoPanel tone="warning" icon={AlertTriangle}>
                {goLiveCheck.warnings.map((w, i) => <p key={i} className="text-sm">• {w}</p>)}
              </InfoPanel>
            )}

            {/* Start Button */}
            <Button size="lg" className="w-full" onClick={handleStartGoLive}
              disabled={!goLiveCheck.canGoLive || starting}>
              {starting ? de.onboardingWizard.step7.starting : goLiveCheck.canGoLive ? de.onboardingWizard.step7.startGoLive : de.onboardingWizard.step7.goLiveBlocked}
            </Button>
          </>
        )}

        {!goLiveCheck && (
          <InfoPanel tone="info" icon={AlertCircle}>
            <p className="text-sm">Readiness-Check wird geladen...</p>
          </InfoPanel>
        )}
      </CardContent>
    </Card>
  );
}
