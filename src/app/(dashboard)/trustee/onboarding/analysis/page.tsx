"use client";

import { useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { EntityHeader, SectionCard, EmptyState, InfoPanel, ConfidenceBadge } from "@/components/ds";
import { de } from "@/lib/i18n/de";
import { formatCurrency } from "@/lib/i18n/format";
import {
  Brain, Loader2, CheckCircle2, HelpCircle, AlertTriangle,
  Users, BookOpen, Receipt, Workflow,
} from "lucide-react";
import { toast } from "sonner";

interface Analysis {
  analyzedDocuments: number;
  suppliers: any[];
  accountPatterns: any[];
  vatDistribution: any[];
  ruleSuggestions: any[];
  uncertaintyReport: any[];
}

const t = de.onboardingAnalysis;

function confidenceClass(c: string) {
  if (c === "high") return "bg-green-100 text-green-800";
  if (c === "medium") return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}

export default function OnboardingAnalysisPage() {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applySuppliers, setApplySuppliers] = useState(true);
  const [applyRules, setApplyRules] = useState(true);

  async function runAnalysis() {
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding/analyze", { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error);
      setAnalysis(await res.json());
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleApply() {
    if (!analysis) return;
    setApplying(true);
    try {
      const payload: any = {};
      if (applySuppliers) {
        payload.suppliers = analysis.suppliers.filter(
          (s) => !s.existingSupplierId && (s.confidence === "high" || s.confidence === "medium")
        );
      }
      if (applyRules) {
        payload.rules = analysis.ruleSuggestions.filter(
          (r) => r.confidence === "high" || r.confidence === "medium"
        );
      }
      const res = await fetch("/api/onboarding/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const result = await res.json();
      toast.success(`${t.apply.success}: ${result.suppliersCreated} Lieferanten, ${result.rulesCreated} Regeln`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setApplying(false);
    }
  }

  const newSupplierCount = analysis?.suppliers.filter(
    (s) => !s.existingSupplierId && (s.confidence === "high" || s.confidence === "medium")
  ).length || 0;
  const eligibleRuleCount = analysis?.ruleSuggestions.filter(
    (r) => r.confidence === "high" || r.confidence === "medium"
  ).length || 0;

  const confirmed = analysis?.uncertaintyReport.filter((u) => u.category === "confirmed") || [];
  const unclear = analysis?.uncertaintyReport.filter((u) => u.category === "unclear") || [];
  const needsReview = analysis?.uncertaintyReport.filter((u) => u.category === "needsReview") || [];

  return (
    <div className="space-y-6 p-6">
      <EntityHeader
        title={t.title}
        subtitle={t.description}
        primaryAction={{
          label: t.analyzeClient,
          icon: Brain,
          onClick: runAnalysis,
        }}
      />

      {loading && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{t.analyzing}</span>
          </div>
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      )}

      {!loading && !analysis && (
        <EmptyState
          icon={Brain}
          title={t.emptyTitle}
          description={t.emptyDescription}
          action={{ label: t.startAnalysis, onClick: runAnalysis }}
        />
      )}

      {!loading && analysis && (
        <div className="space-y-6">
          <div className="text-sm text-muted-foreground">
            {t.analyzedDocs}: <strong>{analysis.analyzedDocuments}</strong>
          </div>

          {/* Section 1: Suppliers */}
          <SectionCard title={t.sections.suppliers} icon={Users}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.supplier.name}</TableHead>
                  <TableHead className="text-right">{t.supplier.documents}</TableHead>
                  <TableHead className="text-right">{t.supplier.amount}</TableHead>
                  <TableHead>{t.supplier.account}</TableHead>
                  <TableHead>{t.supplier.category}</TableHead>
                  <TableHead>{t.supplier.confidence}</TableHead>
                  <TableHead>{t.supplier.status}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analysis.suppliers.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-4">—</TableCell></TableRow>
                ) : analysis.suppliers.map((s, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-right">{s.documentCount}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatCurrency(s.totalAmount, "CHF")}</TableCell>
                    <TableCell className="font-mono text-sm">{s.dominantAccount || "—"}</TableCell>
                    <TableCell className="text-sm">{s.dominantCategory || "—"}</TableCell>
                    <TableCell><Badge variant="secondary" className={confidenceClass(s.confidence)}>{s.confidence}</Badge></TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={s.existingSupplierId ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"}>
                        {s.existingSupplierId ? t.supplier.inSystem : t.supplier.new}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SectionCard>

          {/* Section 2: Account Patterns */}
          <SectionCard title={t.sections.patterns} icon={BookOpen}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.pattern.account}</TableHead>
                  <TableHead className="text-right">{t.pattern.documents}</TableHead>
                  <TableHead className="text-right">{t.pattern.amount}</TableHead>
                  <TableHead>{t.pattern.topSuppliers}</TableHead>
                  <TableHead>{t.supplier.confidence}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analysis.accountPatterns.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">—</TableCell></TableRow>
                ) : analysis.accountPatterns.map((p, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono font-medium">{p.accountCode}</TableCell>
                    <TableCell className="text-right">{p.documentCount}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatCurrency(p.totalAmount, "CHF")}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.topSuppliers.join(", ")}</TableCell>
                    <TableCell><Badge variant="secondary" className={confidenceClass(p.confidence)}>{p.confidence}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SectionCard>

          {/* Section 3: VAT Distribution */}
          <SectionCard title={t.sections.vat} icon={Receipt}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.vat.rate}</TableHead>
                  <TableHead className="text-right">{t.vat.documents}</TableHead>
                  <TableHead className="text-right">{t.vat.vatAmount}</TableHead>
                  <TableHead className="text-right">{t.vat.netAmount}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analysis.vatDistribution.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">—</TableCell></TableRow>
                ) : analysis.vatDistribution.map((v, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{v.rate}</TableCell>
                    <TableCell className="text-right">{v.documentCount}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatCurrency(v.vatAmount, "CHF")}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatCurrency(v.netAmount, "CHF")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SectionCard>

          {/* Section 4: Uncertainty Report (PROMINENT) */}
          <SectionCard title={t.sections.uncertainty} icon={AlertTriangle}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Confirmed */}
              <div className="rounded-md border border-green-200 bg-green-50/50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="font-semibold text-sm text-green-800">{t.uncertainty.confirmed} ({confirmed.length})</span>
                </div>
                <div className="space-y-2">
                  {confirmed.length === 0 ? (
                    <p className="text-xs text-muted-foreground">—</p>
                  ) : confirmed.map((item, i) => (
                    <div key={i} className="text-xs">
                      <p className="font-medium text-green-800">{item.label}</p>
                      <p className="text-green-700/80">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Unclear */}
              <div className="rounded-md border border-amber-200 bg-amber-50/50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <HelpCircle className="h-4 w-4 text-amber-600" />
                  <span className="font-semibold text-sm text-amber-800">{t.uncertainty.unclear} ({unclear.length})</span>
                </div>
                <div className="space-y-2">
                  {unclear.length === 0 ? (
                    <p className="text-xs text-muted-foreground">—</p>
                  ) : unclear.map((item, i) => (
                    <div key={i} className="text-xs">
                      <p className="font-medium text-amber-800">{item.label}</p>
                      <p className="text-amber-700/80">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Needs Review */}
              <div className="rounded-md border border-red-200 bg-red-50/50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="font-semibold text-sm text-red-800">{t.uncertainty.needsReview} ({needsReview.length})</span>
                </div>
                <div className="space-y-2">
                  {needsReview.length === 0 ? (
                    <p className="text-xs text-muted-foreground">—</p>
                  ) : needsReview.map((item, i) => (
                    <div key={i} className="text-xs">
                      <p className="font-medium text-red-800">{item.label}</p>
                      <p className="text-red-700/80">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Section 5: Rule Suggestions */}
          <SectionCard title={t.sections.rules} icon={Workflow}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.rule.type}</TableHead>
                  <TableHead>{t.rule.description}</TableHead>
                  <TableHead>{t.rule.confidence}</TableHead>
                  <TableHead>{t.rule.basedOn}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analysis.ruleSuggestions.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">—</TableCell></TableRow>
                ) : analysis.ruleSuggestions.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">
                        {(t.rule.types as Record<string, string>)[r.type] || r.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{r.description}</TableCell>
                    <TableCell><Badge variant="secondary" className={confidenceClass(r.confidence)}>{r.confidence}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.basedOn}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SectionCard>

          {/* Apply Section */}
          <div className="rounded-md border p-4 space-y-4 bg-slate-50">
            <p className="font-semibold text-sm">{t.apply.title}</p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={applySuppliers} onCheckedChange={(c) => setApplySuppliers(!!c)} />
                {t.apply.createSuppliers} ({newSupplierCount}, {t.apply.onlyMediumHigh})
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={applyRules} onCheckedChange={(c) => setApplyRules(!!c)} />
                {t.apply.createRules} ({eligibleRuleCount}, {t.apply.onlyMediumHigh})
              </label>
            </div>
            <Button onClick={handleApply} disabled={applying || (!applySuppliers && !applyRules)}>
              {applying ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
              {applying ? t.apply.applying : t.apply.applyButton}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
