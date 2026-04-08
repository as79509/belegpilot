"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, CheckCircle2, AlertTriangle, Link2 } from "lucide-react";
import { de } from "@/lib/i18n/de";
import { formatRelativeTime } from "@/lib/i18n/format";
import { useCompany } from "@/lib/contexts/company-context";

interface CompanyOverview {
  id: string;
  name: string;
  stats: { needs_review: number; ready: number; failed: number; exported: number; total: number };
  progress: number;
  lastUpload: string | null;
  bexioConfigured: boolean;
}

export default function TrusteePage() {
  const { switchCompany } = useCompany();
  const [companies, setCompanies] = useState<CompanyOverview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/trustee/overview")
      .then((r) => r.json())
      .then((d) => setCompanies(d.companies || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalOpen = companies.reduce((s, c) => s + c.stats.needs_review, 0);
  const totalReady = companies.reduce((s, c) => s + c.stats.ready, 0);
  const totalFailed = companies.reduce((s, c) => s + c.stats.failed, 0);

  if (loading) return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-40" /><Skeleton className="h-40" />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{de.trustee.overview}</h1>
        <Badge variant="secondary">{companies.length} {de.trustee.allCompanies}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {companies.map((c) => (
          <Card key={c.id} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => switchCompany(c.id)} className="text-lg font-semibold hover:text-blue-600 transition-colors text-left">
                  {c.name}
                </button>
                <div className="flex items-center gap-1">
                  {c.bexioConfigured ? (
                    <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs"><Link2 className="h-3 w-3 mr-0.5" />Bexio</Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-gray-100 text-xs">Kein Bexio</Badge>
                  )}
                </div>
              </div>

              <div className="flex gap-4 text-sm">
                <span className="text-orange-600 font-medium">{c.stats.needs_review} offen</span>
                <span className="text-green-600">{c.stats.ready} bereit</span>
                {c.stats.failed > 0 && <span className="text-red-600">{c.stats.failed} fehlgeschlagen</span>}
                <span className="text-slate-500">{c.stats.exported} exportiert</span>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>{de.trustee.progress}</span>
                  <span>{c.progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${c.progress}%` }} />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{de.trustee.lastUpload}: {c.lastUpload ? formatRelativeTime(c.lastUpload) : de.trustee.never}</span>
                {c.stats.needs_review > 0 && (
                  <Button size="sm" variant="outline" onClick={() => { switchCompany(c.id); }}>
                    {de.trustee.startReview}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Summary */}
      <Card>
        <CardContent className="py-3 flex items-center gap-6 text-sm">
          <span className="font-medium">{de.trustee.allClients}:</span>
          <span className="text-orange-600">{totalOpen} {de.trustee.openDocuments}</span>
          <span className="text-green-600">{totalReady} {de.trustee.readyDocuments}</span>
          {totalFailed > 0 && <span className="text-red-600">{totalFailed} fehlgeschlagen</span>}
        </CardContent>
      </Card>
    </div>
  );
}
