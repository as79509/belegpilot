"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText, Repeat, Home, Shield, Car, AlertTriangle, Upload, Zap,
  CheckCircle2, XCircle, Lightbulb,
} from "lucide-react";
import { de } from "@/lib/i18n/de";
import { EntityHeader, InfoPanel } from "@/components/ds";
import { UploadZone } from "@/components/documents/upload-zone";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface UploadCategory {
  id: string; label: string; description: string; icon: string;
  priority: "high" | "medium" | "low"; currentCount: number;
  recommendedMin: number; recommendedMax: number; examples: string[];
  status: "empty" | "insufficient" | "sufficient" | "good";
}

interface UploadGuidanceData {
  categories: UploadCategory[];
  overallProgress: number;
  readyForBootstrapping: boolean;
  totalDocuments: number;
  totalCategories: number;
}

interface ClassifiedDoc {
  documentId: string; supplierName: string | null; amount: number | null;
  date: string | null; classification: string; classificationReason: string;
  confidence: "high" | "medium" | "low"; suggestedActions: string[];
}

interface BootstrapResult {
  documents: ClassifiedDoc[];
  summary: {
    total: number; byClass: Record<string, number>;
    uniqueSuppliers: number; recurringCandidates: number; missingTypes: string[];
  };
  recommendations: string[];
  newKnownUnknowns: Array<{ area: string; description: string; criticality: string; suggestedAction: string }>;
}

const ICON_MAP: Record<string, any> = { FileText, Repeat, Home, Shield, Car, AlertTriangle };

const CLASS_BADGE: Record<string, { label: string; className: string }> = {
  learning_base: { label: de.onboarding.step3.classifications.learning_base, className: "bg-blue-100 text-blue-800" },
  recurring: { label: de.onboarding.step3.classifications.recurring, className: "bg-green-100 text-green-800" },
  contractual: { label: de.onboarding.step3.classifications.contractual, className: "bg-purple-100 text-purple-800" },
  critical: { label: de.onboarding.step3.classifications.critical, className: "bg-red-100 text-red-800" },
  exception: { label: de.onboarding.step3.classifications.exception, className: "bg-amber-100 text-amber-800" },
  uncertain: { label: de.onboarding.step3.classifications.uncertain, className: "bg-slate-100 text-slate-700" },
};

const STATUS_BORDER: Record<string, string> = {
  good: "border-green-200 bg-green-50/50",
  sufficient: "border-blue-200 bg-blue-50/30",
  insufficient: "",
  empty: "border-slate-200 bg-slate-50/30",
};

export default function OnboardingBootstrapPage() {
  const [guidance, setGuidance] = useState<UploadGuidanceData | null>(null);
  const [bootstrap, setBootstrap] = useState<BootstrapResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const fetchGuidance = useCallback(async () => {
    try {
      const res = await fetch("/api/onboarding/guidance");
      if (res.ok) setGuidance(await res.json());
    } catch { /* */ }
  }, []);

  const fetchClassification = useCallback(async () => {
    try {
      const res = await fetch("/api/onboarding/classify");
      if (res.ok) setBootstrap(await res.json());
    } catch { /* */ }
  }, []);

  useEffect(() => {
    Promise.all([fetchGuidance(), fetchClassification()]).finally(() => setLoading(false));
  }, [fetchGuidance, fetchClassification]);

  function handleUploadComplete() {
    setShowUpload(false);
    fetchGuidance();
    fetchClassification();
  }

  async function handleStartAnalysis() {
    setAnalyzing(true);
    try {
      const res = await fetch("/api/onboarding/analyze", { method: "POST" });
      if (res.ok) {
        toast.success(de.onboardingAnalysis.analyzedDocs);
        fetchClassification();
      } else {
        const err = await res.json();
        toast.error(err.error);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAnalyzing(false);
    }
  }

  const pct = (rate: number) => `${Math.round(rate * 100)}%`;

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-72" />
      <div className="grid gap-4 md:grid-cols-3">{[1,2,3].map(i => <Card key={i}><CardContent className="pt-4"><Skeleton className="h-24 w-full" /></CardContent></Card>)}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <EntityHeader
        title={de.onboarding.step3.title}
        badge={guidance ? (
          guidance.readyForBootstrapping
            ? <Badge className="bg-green-100 text-green-800">{de.onboarding.step3.readyForBootstrap}</Badge>
            : <Badge className="bg-amber-100 text-amber-800">
                {guidance.totalDocuments} Belege &middot; {pct(guidance.overallProgress)}
              </Badge>
        ) : undefined}
        primaryAction={{
          label: showUpload ? "Schliessen" : de.documents.upload,
          onClick: () => setShowUpload(!showUpload),
          icon: Upload,
        }}
      />

      <p className="text-sm text-muted-foreground">{de.onboarding.step3.description}</p>

      {showUpload && <UploadZone onUploadComplete={handleUploadComplete} />}

      {/* Upload guidance categories */}
      {guidance && (
        <>
          <h3 className="text-sm font-semibold">{de.onboarding.step3.uploadGuidance}</h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {guidance.categories.map((cat) => {
              const IconComp = ICON_MAP[cat.icon] || FileText;
              const filled = Math.min(cat.currentCount / Math.max(cat.recommendedMin, 1), 1);
              return (
                <Card key={cat.id} className={cn(
                  "transition-shadow hover:shadow-sm cursor-pointer",
                  cat.priority === "high" && cat.status !== "good" && "border-blue-200",
                  STATUS_BORDER[cat.status]
                )} onClick={() => setShowUpload(true)}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <IconComp className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{cat.label}</span>
                      </div>
                      <Badge variant={cat.status === "good" ? "default" : "secondary"} className="text-xs">
                        {cat.currentCount}/{cat.recommendedMin}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{cat.examples.join(", ")}</p>
                    <div className="mt-2 h-1.5 bg-muted rounded-full">
                      <div className={cn("h-1.5 rounded-full transition-all",
                        cat.status === "good" ? "bg-green-500" : filled > 0 ? "bg-blue-500" : "bg-slate-300"
                      )} style={{ width: pct(filled) }} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Recommendations + missing types */}
      {bootstrap && bootstrap.recommendations.length > 0 && (
        <InfoPanel tone="info" icon={Lightbulb}>
          <strong>{de.onboarding.step3.missingTypesHint}</strong>
          {bootstrap.recommendations.map((r, i) => <p key={i} className="text-sm mt-1">{r}</p>)}
        </InfoPanel>
      )}

      {/* Classified documents table */}
      {bootstrap && bootstrap.documents.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">{de.onboarding.step3.classifiedAs} ({bootstrap.summary.total})</h3>
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span>{bootstrap.summary.uniqueSuppliers} Lieferanten</span>
                <span>{bootstrap.summary.recurringCandidates} wiederkehrend</span>
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lieferant</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead className="text-right">Betrag</TableHead>
                    <TableHead>Klassifikation</TableHead>
                    <TableHead>Konfidenz</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bootstrap.documents.slice(0, 50).map((doc) => {
                    const cls = CLASS_BADGE[doc.classification] || CLASS_BADGE.uncertain;
                    return (
                      <TableRow key={doc.documentId}>
                        <TableCell className="text-sm">{doc.supplierName || "\u2014"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{doc.date || "\u2014"}</TableCell>
                        <TableCell className="text-sm text-right font-mono">{doc.amount != null ? doc.amount.toFixed(2) : "\u2014"}</TableCell>
                        <TableCell><Badge variant="secondary" className={cn("text-xs", cls.className)}>{cls.label}</Badge></TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={cn("text-xs",
                            doc.confidence === "high" ? "bg-green-100 text-green-800" :
                            doc.confidence === "medium" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"
                          )}>{doc.confidence}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {bootstrap.documents.length > 50 && (
              <p className="text-xs text-muted-foreground mt-2">+ {bootstrap.documents.length - 50} weitere...</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Bootstrap readiness */}
      {guidance && guidance.readyForBootstrapping && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="font-medium text-green-800">{de.onboarding.step3.readyForBootstrap}</span>
            </div>
            <Button onClick={handleStartAnalysis} size="lg">
              <Zap className="h-4 w-4 mr-2" />
              {analyzing ? de.onboarding.step3.bootstrapRunning : de.onboarding.step3.startBootstrap}
            </Button>
          </CardContent>
        </Card>
      )}

      {guidance && !guidance.readyForBootstrapping && guidance.totalDocuments > 0 && (
        <InfoPanel tone="warning" icon={Upload}>
          {de.onboarding.step3.notReady
            .replace("{count}", String(Math.max(5 - guidance.totalDocuments, 0)))
            .replace("{categories}", "2")}
        </InfoPanel>
      )}
    </div>
  );
}
