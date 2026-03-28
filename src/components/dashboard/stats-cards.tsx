"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Upload,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileCheck,
} from "lucide-react";
import { de } from "@/lib/i18n/de";

interface Stats {
  uploaded: number;
  processing: number;
  needs_review: number;
  ready: number;
  failed: number;
  exported: number;
}

const cardConfig = [
  { key: "uploaded", label: de.dashboard.uploaded, icon: Upload, color: "text-blue-600", bg: "bg-blue-50" },
  { key: "processing", label: de.dashboard.processing, icon: Loader2, color: "text-amber-600", bg: "bg-amber-50" },
  { key: "needs_review", label: de.dashboard.needsReview, icon: AlertTriangle, color: "text-orange-600", bg: "bg-orange-50" },
  { key: "ready", label: de.dashboard.ready, icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
  { key: "failed", label: de.dashboard.failed, icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
  { key: "exported", label: de.dashboard.exported, icon: FileCheck, color: "text-slate-600", bg: "bg-slate-50" },
] as const;

export function StatsCards() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cardConfig.map((card) => {
        const Icon = card.icon;
        const count = stats?.[card.key as keyof Stats] ?? 0;
        return (
          <Card key={card.key}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.label}
              </CardTitle>
              <div className={`rounded-md p-2 ${card.bg}`}>
                <Icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{count}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
