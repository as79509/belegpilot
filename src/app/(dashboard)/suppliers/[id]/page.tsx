"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { DocumentStatusBadge } from "@/components/documents/document-status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, AlertTriangle, Save, Sparkles, Activity, BookOpen, Workflow, AlertCircle, History } from "lucide-react";
import { de } from "@/lib/i18n/de";
import { formatCurrency, formatDate } from "@/lib/i18n/format";
import { toast } from "sonner";
import { useRecentItems } from "@/lib/hooks/use-recent-items";
import { SectionCard } from "@/components/ds/section-card";
import { AuditPanel } from "@/components/ds/audit-panel";
import { InfoPanel } from "@/components/ds";
import { useCompany } from "@/lib/contexts/company-context";

export default function SupplierDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { addRecent } = useRecentItems();
  const { capabilities } = useCompany();
  const [supplier, setSupplier] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>({
    nameNormalized: "", vatNumber: "", iban: "", country: "",
    email: "", phone: "", website: "", contactPerson: "",
    street: "", zip: "", city: "",
    bankName: "", bic: "", paymentTermDays: "",
    defaultCategory: "", defaultAccountCode: "",
    defaultCostCenter: "", defaultVatCode: "", notes: "",
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [patternData, setPatternData] = useState<any>(null);
  const [intelligence, setIntelligence] = useState<any>(null);
  const [defaultsDialogOpen, setDefaultsDialogOpen] = useState(false);
  const [acceptAccount, setAcceptAccount] = useState(true);
  const [acceptCategory, setAcceptCategory] = useState(true);
  const canEditSupplier = capabilities?.canMutate?.suppliers ?? false;
  const canVerifySupplier = capabilities?.canMutate?.suppliersVerify ?? false;

  useEffect(() => {
    fetch(`/api/suppliers/${params.id}/suggest-defaults`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setPatternData(d); })
      .catch(() => {});

    fetch(`/api/suppliers/${params.id}/intelligence`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setIntelligence(d); })
      .catch(() => {});

    fetch(`/api/suppliers/${params.id}`)
      .then(async (r) => {
        if (!r.ok) {
          const error = await r.json().catch(() => null);
          throw new Error(error?.error || de.errors.serverError);
        }
        return r.json();
      })
      .then((data) => {
        setLoadError(null);
        setSupplier(data);
        setForm({
          nameNormalized: data.nameNormalized || "",
          vatNumber: data.vatNumber || "",
          iban: data.iban || "",
          country: data.country || "",
          email: data.email || "",
          phone: data.phone || "",
          website: data.website || "",
          contactPerson: data.contactPerson || "",
          street: data.street || "",
          zip: data.zip || "",
          city: data.city || "",
          bankName: data.bankName || "",
          bic: data.bic || "",
          paymentTermDays: data.paymentTermDays ?? "",
          defaultCategory: data.defaultCategory || "",
          defaultAccountCode: data.defaultAccountCode || "",
          defaultCostCenter: data.defaultCostCenter || "",
          defaultVatCode: data.defaultVatCode || "",
          notes: data.notes || "",
        });
      })
      .catch((err) => {
        console.error("[SupplierDetail] Fetch error:", err);
        setLoadError(err instanceof Error ? err.message : de.errors.serverError);
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  useEffect(() => {
    if (supplier?.id) {
      addRecent(
        "supplier",
        supplier.id,
        supplier.nameNormalized || "Lieferant",
        `/suppliers/${supplier.id}`
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplier?.id]);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSave() {
    if (!canEditSupplier) {
      toast.error(de.errors.forbidden);
      return;
    }
    const payload = { ...form };
    if (payload.paymentTermDays === "") payload.paymentTermDays = null;
    else payload.paymentTermDays = parseInt(payload.paymentTermDays);

    const res = await fetch(`/api/suppliers/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setSupplier(await res.json());
      toast.success(de.suppliers.saveSuccess);
    } else {
      const err = await res.json().catch(() => null);
      toast.error(err?.error || de.common.error);
    }
  }

  async function handleVerify() {
    if (!canVerifySupplier) {
      toast.error(de.errors.forbidden);
      return;
    }
    const res = await fetch(`/api/suppliers/${params.id}/verify`, { method: "POST" });
    if (res.ok) {
      setSupplier(await res.json());
      toast.success(de.suppliers.verifySuccess);
    } else {
      const err = await res.json().catch(() => null);
      toast.error(err?.error || de.common.error);
    }
  }

  async function handleAcceptDefaults() {
    if (!canEditSupplier) {
      toast.error(de.errors.forbidden);
      return;
    }
    const res = await fetch(`/api/suppliers/${params.id}/suggest-defaults`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acceptAccount, acceptCategory }),
    });
    if (res.ok) {
      const updated = await res.json();
      setSupplier(updated);
      setForm((f) => ({
        ...f,
        defaultAccountCode: updated.defaultAccountCode || "",
        defaultCategory: updated.defaultCategory || "",
      }));
      toast.success(de.supplierPatterns.defaultsUpdated);
      setDefaultsDialogOpen(false);
    } else {
      const err = await res.json().catch(() => null);
      toast.error(err?.error || de.common.error);
    }
  }

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-8 w-64" />
      <div className="space-y-4">
        <Card><CardContent className="pt-4 space-y-3">
          <Skeleton className="h-4 w-32" /><Skeleton className="h-9 w-full" />
          <Skeleton className="h-4 w-32" /><Skeleton className="h-9 w-full" />
        </CardContent></Card>
        <Card><CardContent className="pt-4 space-y-3">
          <Skeleton className="h-4 w-32" /><Skeleton className="h-9 w-full" />
          <Skeleton className="h-4 w-32" /><Skeleton className="h-9 w-full" />
        </CardContent></Card>
      </div>
    </div>
  );
  if (!supplier) return <p className="py-20 text-center text-muted-foreground">{loadError || de.errors.notFound}</p>;

  return (
    <div className="space-y-4">
      <Link href="/suppliers" className="text-sm text-muted-foreground hover:text-foreground">← {de.suppliers.title}</Link>

      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-xl font-semibold mr-1">{supplier.nameNormalized}</h1>
        {supplier.isVerified ? (
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            <CheckCircle2 className="h-3 w-3 mr-1" />{de.suppliers.verified}
          </Badge>
        ) : (
          <>
            <Badge variant="secondary" className="bg-amber-100 text-amber-800">
              <AlertTriangle className="h-3 w-3 mr-1" />{de.suppliers.unverified}
            </Badge>
            {canVerifySupplier ? (
              <Button variant="outline" size="sm" onClick={handleVerify}>{de.suppliers.verify}</Button>
            ) : null}
          </>
        )}
        <Badge variant="secondary" className="bg-slate-100 text-slate-700">
          {supplier.documentCount} {de.suppliers.documentCount}
        </Badge>
        {patternData?.pattern?.accountStability != null && (
          <Badge
            variant="secondary"
            className={
              patternData.pattern.accountStability >= 0.8
                ? "bg-green-100 text-green-800"
                : "bg-amber-100 text-amber-800"
            }
          >
            {de.supplierIntelligence.stabilityScore}: {Math.round(patternData.pattern.accountStability * 100)}%
          </Badge>
        )}
        {intelligence?.correctionCount != null && intelligence.correctionCount > 0 && (
          <Badge variant="secondary" className="bg-amber-100 text-amber-800">
            {de.supplierIntelligence.correctionHistory}: {intelligence.correctionCount}
          </Badge>
        )}
        {intelligence?.escalations && (
          <Badge
            variant="secondary"
            className={
              intelligence.escalations.length > 0
                ? "bg-red-100 text-red-800"
                : "bg-slate-100 text-slate-700"
            }
          >
            {de.supplierIntelligence.escalationHistory}: {intelligence.escalations.length}
          </Badge>
        )}
      </div>

      {!canEditSupplier && (
        <InfoPanel tone="info" title={de.suppliers.readOnlyTitle}>
          <p className="text-sm">{de.suppliers.readOnlyDescription}</p>
        </InfoPanel>
      )}

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">{de.suppliers.detailTabs.details}</TabsTrigger>
          <TabsTrigger value="analysis">{de.supplierIntelligence.analysis}</TabsTrigger>
          <TabsTrigger value="documents">{de.suppliers.documentCount} ({supplier.documentCount})</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4 space-y-4">
          <fieldset disabled={!canEditSupplier} className="space-y-4">
          {/* Stammdaten */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{de.suppliers.detailSections.masterData}</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label className="text-xs">{de.suppliers.name}</Label>
                <Input value={form.nameNormalized} onChange={(e) => set("nameNormalized", e.target.value)} /></div>
              <div><Label className="text-xs">{de.detail.vatNumber}</Label>
                <Input value={form.vatNumber} onChange={(e) => set("vatNumber", e.target.value)} /></div>
              <div><Label className="text-xs">{de.suppliers.country}</Label>
                <Input value={form.country} onChange={(e) => set("country", e.target.value)} placeholder="CH" /></div>
            </CardContent>
          </Card>

          {/* Kontakt */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{de.suppliers.detailSections.contact}</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label className="text-xs">{de.suppliers.fields.email}</Label>
                <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
              <div><Label className="text-xs">{de.suppliers.fields.phone}</Label>
                <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></div>
              <div><Label className="text-xs">{de.suppliers.fields.website}</Label>
                <Input value={form.website} onChange={(e) => set("website", e.target.value)} /></div>
              <div><Label className="text-xs">{de.suppliers.fields.contactPerson}</Label>
                <Input value={form.contactPerson} onChange={(e) => set("contactPerson", e.target.value)} /></div>
            </CardContent>
          </Card>

          {/* Adresse */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{de.suppliers.address}</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-3"><Label className="text-xs">{de.suppliers.fields.street}</Label>
                <Input value={form.street} onChange={(e) => set("street", e.target.value)} /></div>
              <div><Label className="text-xs">{de.suppliers.fields.zip}</Label>
                <Input value={form.zip} onChange={(e) => set("zip", e.target.value)} /></div>
              <div className="md:col-span-2"><Label className="text-xs">{de.suppliers.fields.city}</Label>
                <Input value={form.city} onChange={(e) => set("city", e.target.value)} /></div>
            </CardContent>
          </Card>

          {/* Bankverbindung */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{de.suppliers.detailSections.bankDetails}</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label className="text-xs">{de.suppliers.fields.iban}</Label>
                <Input value={form.iban} onChange={(e) => set("iban", e.target.value)} /></div>
              <div><Label className="text-xs">{de.suppliers.fields.bic}</Label>
                <Input value={form.bic} onChange={(e) => set("bic", e.target.value)} /></div>
              <div><Label className="text-xs">{de.suppliers.fields.bankName}</Label>
                <Input value={form.bankName} onChange={(e) => set("bankName", e.target.value)} /></div>
              <div><Label className="text-xs">Zahlungsfrist (Tage)</Label>
                <Input type="number" value={form.paymentTermDays} onChange={(e) => set("paymentTermDays", e.target.value)} /></div>
            </CardContent>
          </Card>

          {/* Standardwerte */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{de.suppliers.detailSections.documentDefaults}</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label className="text-xs">{de.suppliers.defaultCategory}</Label>
                <Input value={form.defaultCategory} onChange={(e) => set("defaultCategory", e.target.value)} /></div>
              <div><Label className="text-xs">{de.suppliers.defaultAccount}</Label>
                <Input value={form.defaultAccountCode} onChange={(e) => set("defaultAccountCode", e.target.value)} /></div>
              <div><Label className="text-xs">{de.suppliers.defaultCostCenter}</Label>
                <Input value={form.defaultCostCenter} onChange={(e) => set("defaultCostCenter", e.target.value)} /></div>
              <div><Label className="text-xs">{de.suppliers.defaultVatCode}</Label>
                <Input value={form.defaultVatCode} onChange={(e) => set("defaultVatCode", e.target.value)} /></div>
            </CardContent>
          </Card>

          {/* Buchungsmuster */}
          {patternData && (
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">{de.supplierPatterns.title}</CardTitle>
                {canEditSupplier && patternData.eligible && (
                  <Button variant="outline" size="sm" onClick={() => setDefaultsDialogOpen(true)}>
                    <Sparkles className="h-3.5 w-3.5 mr-1" />{de.supplierPatterns.suggestDefaults}
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {!patternData.pattern ? (
                  <p className="text-xs text-muted-foreground">{de.supplierPatterns.notEligible}</p>
                ) : (
                  <>
                    {/* Konto */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{de.supplierPatterns.dominantAccount}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono">{patternData.pattern.dominantAccount || "—"}</span>
                        {patternData.pattern.dominantAccount && (
                          <Badge className={patternData.pattern.accountStability >= 0.8 ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}>
                            {Math.round(patternData.pattern.accountStability * 100)}% von {patternData.pattern.totalApprovedDocs}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {/* Betrag */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{de.supplierPatterns.typicalAmount}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">
                          {patternData.pattern.typicalAmount != null
                            ? formatCurrency(patternData.pattern.typicalAmount, "CHF")
                            : "—"}
                          {patternData.pattern.amountStdDeviation != null && patternData.pattern.typicalAmount != null && (
                            <span className="text-xs text-muted-foreground"> ± {formatCurrency(patternData.pattern.amountStdDeviation, "CHF")}</span>
                          )}
                        </span>
                        {patternData.pattern.isAmountStable ? (
                          <Badge className="bg-green-100 text-green-800">{de.supplierPatterns.amountStable}</Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-800">{de.supplierPatterns.amountUnstable}</Badge>
                        )}
                      </div>
                    </div>
                    {/* MwSt */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{de.supplierPatterns.dominantVat}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">
                          {patternData.pattern.dominantVatRate != null ? `${patternData.pattern.dominantVatRate}%` : "—"}
                        </span>
                        {patternData.pattern.vatStability >= 0.8 ? (
                          <Badge className="bg-green-100 text-green-800">{de.supplierPatterns.vatConsistent} ({Math.round(patternData.pattern.vatStability * 100)}%)</Badge>
                        ) : patternData.pattern.dominantVatRate != null ? (
                          <Badge className="bg-amber-100 text-amber-800">{de.supplierPatterns.vatInconsistent}</Badge>
                        ) : null}
                      </div>
                    </div>
                    {!patternData.eligible && (
                      <p className="text-xs text-muted-foreground italic">{patternData.reason}</p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Defaults dialog */}
          <Dialog open={defaultsDialogOpen} onOpenChange={setDefaultsDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{de.supplierPatterns.suggestDefaults}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {patternData?.suggestions?.defaultAccountCode && (
                  <div className="flex items-start gap-2">
                    <Checkbox checked={acceptAccount} onCheckedChange={(c) => setAcceptAccount(!!c)} />
                    <div className="text-sm">
                      <div>{de.supplierPatterns.dominantAccount}: <strong>{patternData.suggestions.defaultAccountCode}</strong></div>
                      <p className="text-xs text-muted-foreground">{de.supplierPatterns.setAsDefault}</p>
                    </div>
                  </div>
                )}
                {patternData?.suggestions?.defaultCategory && (
                  <div className="flex items-start gap-2">
                    <Checkbox checked={acceptCategory} onCheckedChange={(c) => setAcceptCategory(!!c)} />
                    <div className="text-sm">
                      <div>{de.suppliers.fields.category}: <strong>{patternData.suggestions.defaultCategory}</strong></div>
                      <p className="text-xs text-muted-foreground">{de.supplierPatterns.setAsDefault}</p>
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <DialogClose><Button variant="outline">{de.common.cancel}</Button></DialogClose>
                <Button onClick={handleAcceptDefaults} disabled={!acceptAccount && !acceptCategory}>
                  {de.common.save}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Notizen */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{de.suppliers.detailSections.notes}</CardTitle></CardHeader>
            <CardContent>
              <Textarea rows={4} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder={de.suppliers.notesPlaceholder} />
            </CardContent>
          </Card>

          {canEditSupplier ? (
            <Button onClick={handleSave}><Save className="h-4 w-4 mr-2" />{de.suppliers.save}</Button>
          ) : null}
          </fieldset>
        </TabsContent>

        <TabsContent value="analysis" className="mt-4 space-y-4">
          {/* Stabilitäts-Score Card */}
          <SectionCard title={de.supplierIntelligence.stabilityScore} icon={Activity} iconColor="text-blue-600">
            {patternData?.pattern ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{de.supplierIntelligence.accountStability}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">{patternData.pattern.dominantAccount || "—"}</span>
                    <Badge
                      variant="secondary"
                      className={patternData.pattern.accountStability >= 0.8 ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}
                    >
                      {Math.round(patternData.pattern.accountStability * 100)}%
                      {" "}({Math.round(patternData.pattern.accountStability * patternData.pattern.totalApprovedDocs)} von {patternData.pattern.totalApprovedDocs})
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{de.supplierIntelligence.amountStability}</span>
                  <div className="flex items-center gap-2">
                    {patternData.pattern.typicalAmount != null && (
                      <span className="text-xs">
                        {formatCurrency(patternData.pattern.typicalAmount, "CHF")}
                        {patternData.pattern.amountStdDeviation != null && (
                          <span className="text-muted-foreground"> ± {formatCurrency(patternData.pattern.amountStdDeviation, "CHF")}</span>
                        )}
                      </span>
                    )}
                    <Badge variant="secondary" className={patternData.pattern.isAmountStable ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}>
                      {patternData.pattern.isAmountStable ? de.supplierPatterns.amountStable : de.supplierPatterns.amountUnstable}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{de.supplierIntelligence.vatConsistency}</span>
                  <div className="flex items-center gap-2">
                    {patternData.pattern.dominantVatRate != null && (
                      <span className="text-xs">{patternData.pattern.dominantVatRate}%</span>
                    )}
                    <Badge variant="secondary" className={patternData.pattern.vatStability >= 0.8 ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}>
                      {Math.round(patternData.pattern.vatStability * 100)}%
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="font-medium">{de.supplierIntelligence.overallScore}</span>
                  <Badge
                    variant="secondary"
                    className={
                      patternData.pattern.accountStability >= 0.8 && patternData.pattern.vatStability >= 0.8 && patternData.pattern.isAmountStable
                        ? "bg-green-100 text-green-800"
                        : patternData.pattern.accountStability >= 0.6
                          ? "bg-amber-100 text-amber-800"
                          : "bg-red-100 text-red-800"
                    }
                  >
                    {patternData.pattern.accountStability >= 0.8 && patternData.pattern.vatStability >= 0.8 && patternData.pattern.isAmountStable
                      ? de.onboardingAnalysis.confidence.high
                      : patternData.pattern.accountStability >= 0.6
                        ? de.onboardingAnalysis.confidence.medium
                        : de.onboardingAnalysis.confidence.low}
                  </Badge>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{de.supplierPatterns.notEligible}</p>
            )}
          </SectionCard>

          {/* Häufigste Kontierungen */}
          {intelligence?.topAccounts && intelligence.topAccounts.length > 0 && (
            <SectionCard title={de.supplierIntelligence.topAccounts} icon={Activity} iconColor="text-indigo-600">
              <div className="space-y-1.5">
                {intelligence.topAccounts.map((a: any) => (
                  <div key={a.account} className="flex items-center justify-between text-sm">
                    <span className="font-mono text-xs">{a.account}</span>
                    <span className="text-xs text-muted-foreground">{a.count}× ({a.percent}%)</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Regelbezug */}
          <SectionCard title={de.supplierIntelligence.relatedRules} icon={Workflow} iconColor="text-purple-600">
            {intelligence?.rules && intelligence.rules.length > 0 ? (
              <ul className="space-y-2">
                {intelligence.rules.map((r: any) => (
                  <li key={r.id} className="flex items-center justify-between text-sm">
                    <Link href="/rules" className="hover:underline">
                      {r.name}
                    </Link>
                    <div className="flex gap-1">
                      <Badge variant="secondary" className="text-xs">
                        {(de.rules.types as any)[r.ruleType] || r.ruleType}
                      </Badge>
                      {!r.isActive && <Badge variant="secondary" className="text-xs bg-gray-100">{de.rules.inactive}</Badge>}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">{de.common.noData}</p>
            )}
          </SectionCard>

          {/* Knowledge-Bezug */}
          <SectionCard title={de.supplierIntelligence.relatedKnowledge} icon={BookOpen} iconColor="text-emerald-600">
            {intelligence?.knowledge && intelligence.knowledge.length > 0 ? (
              <ul className="space-y-2">
                {intelligence.knowledge.map((k: any) => (
                  <li key={k.id} className="flex items-center justify-between text-sm">
                    <Link href="/settings/ai" className="hover:underline">
                      {k.title}
                    </Link>
                    {k.version > 1 && <Badge variant="outline" className="text-xs">v{k.version}</Badge>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">{de.common.noData}</p>
            )}
          </SectionCard>

          {/* Korrekturen */}
          <SectionCard title={de.supplierIntelligence.correctionHistory} icon={History} iconColor="text-amber-600">
            {intelligence?.corrections && intelligence.corrections.length > 0 ? (
              <ul className="space-y-1.5">
                {intelligence.corrections.map((c: any) => (
                  <li key={c.id} className="text-sm flex items-center justify-between">
                    <span className="text-xs">
                      <span className="font-mono">{c.field}</span>:{" "}
                      <span className="text-red-600">{c.originalValue || "—"}</span>
                      {" → "}
                      <span className="text-green-600">{c.correctedValue}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">{formatDate(c.createdAt)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">{de.common.noData}</p>
            )}
          </SectionCard>

          {/* Eskalationen */}
          <SectionCard title={de.supplierIntelligence.escalationHistory} icon={AlertCircle} iconColor="text-red-600">
            {intelligence?.escalations && intelligence.escalations.length > 0 ? (
              <ul className="space-y-2">
                {intelligence.escalations.map((e: any) => (
                  <li key={e.id} className="flex items-center justify-between text-sm">
                    <span>{e.title}</span>
                    <Badge variant="secondary" className="text-xs bg-red-100 text-red-800">{e.priority}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">{de.supplierIntelligence.noEscalations}</p>
            )}
          </SectionCard>

          {/* Lieferantenhistorie */}
          <SectionCard title={de.supplierIntelligence.timeline} icon={History} iconColor="text-slate-600">
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{de.supplierIntelligence.createdAt}</span>
                <span>{formatDate(supplier.createdAt)}</span>
              </div>
              {intelligence?.timeline?.verifiedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{de.supplierIntelligence.verifiedAt}</span>
                  <span>{formatDate(intelligence.timeline.verifiedAt)}</span>
                </div>
              )}
              {intelligence?.timeline?.defaultsSetAt && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{de.supplierIntelligence.defaultsSetAt}</span>
                  <span>{formatDate(intelligence.timeline.defaultsSetAt)}</span>
                </div>
              )}
              {intelligence?.timeline?.lastDocumentAt && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{de.supplierIntelligence.lastDocument}</span>
                  <span>{formatDate(intelligence.timeline.lastDocumentAt)}</span>
                </div>
              )}
            </div>
            <div className="mt-4 border-t pt-3">
              <AuditPanel entityType="supplier" entityId={supplier.id} maxEntries={5} />
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              {supplier.documents?.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Belegnr.</TableHead>
                      <TableHead>{de.documents.status}</TableHead>
                      <TableHead>{de.documents.invoiceNumber}</TableHead>
                      <TableHead>{de.documents.date}</TableHead>
                      <TableHead>{de.documents.amount}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {supplier.documents.map((doc: any) => (
                      <TableRow key={doc.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/documents/${doc.id}`)}>
                        <TableCell className="font-mono text-xs">{doc.documentNumber || de.common.noData}</TableCell>
                        <TableCell><DocumentStatusBadge status={doc.status} /></TableCell>
                        <TableCell>{doc.invoiceNumber || de.common.noData}</TableCell>
                        <TableCell>{formatDate(doc.invoiceDate)}</TableCell>
                        <TableCell>{formatCurrency(doc.grossAmount, doc.currency || "CHF")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">{de.suppliers.detailSections.documentsEmpty}</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
