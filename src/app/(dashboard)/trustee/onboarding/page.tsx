"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { de } from "@/lib/i18n/de";
import { toast } from "sonner";

const STEPS = [
  de.onboarding.basics,
  de.onboarding.industry,
  de.onboarding.accounting,
  de.onboarding.aiSettings,
  de.onboarding.summary,
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "", legalName: "", legalForm: "", vatNumber: "", currency: "CHF",
    phone: "", email: "", website: "",
    industry: "", businessModel: "", employeeCount: "",
    fiscalYearStart: "1", chartOfAccounts: "KMU",
    vatLiable: true, vatMethod: "effective", vatInterval: "quarterly",
    aiConfidenceThreshold: 0.65, aiAutoApprove: false, aiContext: "",
  });

  function set(field: string, value: any) { setForm((f) => ({ ...f, [field]: value })); }

  async function handleCreate() {
    if (!form.name.trim()) { toast.error("Firmenname erforderlich"); return; }
    setCreating(true);
    try {
      const payload = {
        ...form,
        legalName: form.legalName || form.name,
        employeeCount: form.employeeCount ? parseInt(form.employeeCount) : null,
        fiscalYearStart: parseInt(form.fiscalYearStart),
      };
      const res = await fetch("/api/trustee/clients", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(de.onboarding.success);
      router.push("/trustee/clients");
    } catch (err: any) { toast.error(err.message); }
    finally { setCreating(false); }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{de.onboarding.title}</h1>

      {/* Stepper */}
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-1 flex-1">
            <div className={`h-2 flex-1 rounded-full ${i <= step ? "bg-blue-500" : "bg-gray-200"}`} />
          </div>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">{de.onboarding.step} {step + 1} {de.onboarding.of} {STEPS.length}: {STEPS[step]}</p>

      {/* Step content */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          {step === 0 && (<>
            <div><Label>{de.onboarding.companyName} *</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
            <div><Label>{de.onboarding.legalForm}</Label>
              <select className="w-full border rounded-md px-3 py-1.5 text-sm" value={form.legalForm} onChange={(e) => set("legalForm", e.target.value)}>
                <option value="">—</option>
                {Object.entries(de.onboarding.legalForms).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>UID</Label><Input value={form.vatNumber} onChange={(e) => set("vatNumber", e.target.value)} placeholder="CHE-xxx.xxx.xxx" /></div>
              <div><Label>Währung</Label>
                <select className="w-full border rounded-md px-3 py-1.5 text-sm" value={form.currency} onChange={(e) => set("currency", e.target.value)}>
                  <option value="CHF">CHF</option><option value="EUR">EUR</option>
                </select></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Telefon</Label><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></div>
              <div><Label>E-Mail</Label><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
            </div>
          </>)}

          {step === 1 && (<>
            <div><Label>{de.onboarding.industry}</Label>
              <select className="w-full border rounded-md px-3 py-1.5 text-sm" value={form.industry} onChange={(e) => set("industry", e.target.value)}>
                <option value="">—</option>
                {Object.entries(de.onboarding.industries).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
            <div><Label>{de.onboarding.businessModel}</Label>
              <Textarea value={form.businessModel} onChange={(e) => set("businessModel", e.target.value)} placeholder={de.onboarding.businessModelPlaceholder} rows={3} /></div>
            <div><Label>Mitarbeitende</Label><Input type="number" value={form.employeeCount} onChange={(e) => set("employeeCount", e.target.value)} /></div>
          </>)}

          {step === 2 && (<>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{de.onboarding.fiscalYear}</Label>
                <select className="w-full border rounded-md px-3 py-1.5 text-sm" value={form.fiscalYearStart} onChange={(e) => set("fiscalYearStart", e.target.value)}>
                  {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={String(i + 1)}>{new Date(2000, i).toLocaleString("de", { month: "long" })}</option>)}
                </select></div>
              <div><Label>{de.onboarding.chartOfAccounts}</Label>
                <select className="w-full border rounded-md px-3 py-1.5 text-sm" value={form.chartOfAccounts} onChange={(e) => set("chartOfAccounts", e.target.value)}>
                  <option value="KMU">KMU Kontenrahmen</option><option value="Käfer">Käfer</option><option value="custom">Individuell</option>
                </select></div>
            </div>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.vatLiable} onCheckedChange={(c) => set("vatLiable", !!c)} />{de.onboarding.vatLiable}</label>
            {form.vatLiable && (
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{de.onboarding.vatMethod}</Label>
                  <select className="w-full border rounded-md px-3 py-1.5 text-sm" value={form.vatMethod} onChange={(e) => set("vatMethod", e.target.value)}>
                    <option value="effective">{de.onboarding.vatEffective}</option><option value="flat_rate">{de.onboarding.vatFlatRate}</option>
                  </select></div>
                <div><Label>{de.onboarding.vatInterval}</Label>
                  <select className="w-full border rounded-md px-3 py-1.5 text-sm" value={form.vatInterval} onChange={(e) => set("vatInterval", e.target.value)}>
                    <option value="quarterly">Quartalsweise</option><option value="monthly">Monatlich</option><option value="yearly">Jährlich</option>
                  </select></div>
              </div>
            )}
          </>)}

          {step === 3 && (<>
            <div><Label>{de.onboarding.aiLevel}</Label>
              <div className="space-y-2 mt-1">
                {[
                  { val: 0.8, label: de.onboarding.aiConservative, auto: false },
                  { val: 0.65, label: de.onboarding.aiNormal, auto: false },
                  { val: 0.5, label: de.onboarding.aiAggressive, auto: true },
                ].map((opt) => (
                  <label key={opt.val} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" name="aiLevel" checked={form.aiConfidenceThreshold === opt.val} onChange={() => { set("aiConfidenceThreshold", opt.val); set("aiAutoApprove", opt.auto); }} className="accent-blue-600" />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
            <div><Label>{de.onboarding.aiContext}</Label>
              <Textarea value={form.aiContext} onChange={(e) => set("aiContext", e.target.value)} placeholder={de.onboarding.aiContextPlaceholder} rows={4} /></div>
          </>)}

          {step === 4 && (<>
            <div className="space-y-2 text-sm">
              <p><strong>{de.onboarding.companyName}:</strong> {form.name || "—"}</p>
              <p><strong>{de.onboarding.legalForm}:</strong> {de.onboarding.legalForms[form.legalForm] || "—"}</p>
              <p><strong>UID:</strong> {form.vatNumber || "—"}</p>
              <p><strong>{de.onboarding.industry}:</strong> {de.onboarding.industries[form.industry] || "—"}</p>
              <p><strong>Währung:</strong> {form.currency}</p>
              <p><strong>{de.onboarding.vatLiable}:</strong> {form.vatLiable ? "Ja" : "Nein"}</p>
              <p><strong>{de.onboarding.aiLevel}:</strong> {form.aiConfidenceThreshold >= 0.8 ? de.onboarding.aiConservative : form.aiConfidenceThreshold >= 0.65 ? de.onboarding.aiNormal : de.onboarding.aiAggressive}</p>
            </div>
          </>)}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>
          <ChevronLeft className="h-4 w-4 mr-1" />{de.onboarding.back}
        </Button>
        {step < 4 ? (
          <Button onClick={() => setStep((s) => s + 1)}>
            {de.onboarding.next}<ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleCreate} disabled={creating || !form.name.trim()}>
            {creating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
            {creating ? de.onboarding.creating : de.onboarding.create}
          </Button>
        )}
      </div>
    </div>
  );
}
