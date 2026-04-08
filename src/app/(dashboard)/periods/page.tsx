"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarCheck, Lock, CheckCircle2, XCircle } from "lucide-react";
import { de } from "@/lib/i18n/de";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-100 text-blue-800", incomplete: "bg-amber-100 text-amber-800",
  review_ready: "bg-cyan-100 text-cyan-800", closing: "bg-purple-100 text-purple-800",
  closed: "bg-green-100 text-green-800", locked: "bg-gray-200 text-gray-800",
};

const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

export default function PeriodsPage() {
  const [periods, setPeriods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());

  const fetchPeriods = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/periods?year=${year}`);
      if (res.ok) setPeriods(await res.json());
    } catch {} finally { setLoading(false); }
  }, [year]);

  useEffect(() => { fetchPeriods(); }, [fetchPeriods]);

  async function lockPeriod(period: any) {
    if (!confirm(de.periods.lockConfirm)) return;
    if (!period.id) {
      const createRes = await fetch("/api/periods", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ year: period.year, month: period.month }) });
      if (!createRes.ok) return;
      const created = await createRes.json();
      period = created;
    }
    await fetch(`/api/periods/${period.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "locked" }) });
    toast.success(`${MONTHS[period.month - 1]} gesperrt`);
    fetchPeriods();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{de.periods.title}</h1>
        <select className="border rounded-md px-3 py-1.5 text-sm" value={year} onChange={(e) => setYear(parseInt(e.target.value))}>
          {[2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 md:grid-cols-4 gap-3">{Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {periods.map((p: any) => (
            <Card key={p.month} className={p.status === "locked" ? "opacity-60" : ""}>
              <CardContent className="pt-3 pb-2 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{MONTHS[p.month - 1]}</span>
                  <Badge variant="secondary" className={`text-xs ${STATUS_COLORS[p.status] || ""}`}>
                    {p.status === "locked" && <Lock className="h-3 w-3 mr-0.5" />}
                    {de.periods.status[p.status] || p.status}
                  </Badge>
                </div>

                <div className="text-xs space-y-0.5">
                  {[
                    { key: "documentsComplete", done: p.documentsReceived > 0 },
                    { key: "recurringGenerated", done: p.recurringGenerated },
                    { key: "depreciationDone", done: p.depreciationGenerated },
                    { key: "vatChecked", done: p.vatChecked },
                    { key: "exportDone", done: p.exportCompleted },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center gap-1">
                      {item.done ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <XCircle className="h-3 w-3 text-gray-300" />}
                      <span className={item.done ? "" : "text-muted-foreground"}>
                        {de.periods.checklist[item.key as keyof typeof de.periods.checklist]}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="text-xs text-muted-foreground">
                  {de.periods.documentsProgress}: {p.documentsReceived}/{p.documentsExpected || "?"}
                </div>

                {p.status !== "locked" && (
                  <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => lockPeriod(p)}>
                    <Lock className="h-3 w-3 mr-1" />{de.periods.lock}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
