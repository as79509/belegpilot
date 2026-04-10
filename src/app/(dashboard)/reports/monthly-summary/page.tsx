"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText, TrendingUp, TrendingDown, Minus, ChevronLeft, ChevronRight,
  AlertTriangle, UserPlus, FileX, Clock, ArrowLeftRight, Loader2,
} from "lucide-react";
import { de } from "@/lib/i18n/de";
import { formatCurrency } from "@/lib/i18n/format";

const MONTH_NAMES = [
  "Januar", "Februar", "M\u00e4rz", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

interface Summary {
  overview: { totalDocuments: number; totalGrossAmount: number; totalVatAmount: number; avgDocumentAmount: number; currency: string };
  comparison: { documentCountChange: number; grossAmountChange: number; grossAmountChangePercent: number; newSuppliers: number; trend: "up" | "down" | "stable" };
  topSuppliers: Array<{ name: string; documentCount: number; totalAmount: number; percentOfTotal: number }>;
  topAccounts: Array<{ accountCode: string; accountName: string | null; totalAmount: number; documentCount: number }>;
  anomalies: Array<{ type: string; message: string; severity: string }>;
  paymentStatus: { paidCount: number; unpaidCount: number; partialCount: number; totalUnpaid: number; overdueCount: number };
}

export default function MonthlySummaryPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reports/monthly-summary?year=" + year + "&month=" + month);
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
      }
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(year - 1); }
    else setMonth(month - 1);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(year + 1); }
    else setMonth(month + 1);
  }

  const t = de.monthlySummary;
  const TrendIcon = summary?.comparison.trend === "up" ? TrendingUp : summary?.comparison.trend === "down" ? TrendingDown : Minus;
  const trendColor = summary?.comparison.trend === "up" ? "text-red-500" : summary?.comparison.trend === "down" ? "text-green-600" : "text-gray-500";

  const anomalyIcons: Record<string, any> = {
    amount_spike: TrendingUp,
    new_supplier: UserPlus,
    missing_docs: FileX,
    unusual_vat: AlertTriangle,
    overdue_payment: Clock,
    account_change: ArrowLeftRight,
  };
  const anomalyColors: Record<string, string> = {
    amount_spike: "text-red-500",
    new_supplier: "text-blue-500",
    missing_docs: "text-amber-500",
    unusual_vat: "text-amber-500",
    overdue_payment: "text-red-500",
    account_change: "text-amber-500",
  };

  return (
    <div className="space-y-6">
      {/* Header with month selector */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t.title} {MONTH_NAMES[month - 1]} {year}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-medium w-32 text-center">{MONTH_NAMES[month - 1]} {year}</span>
          <Button variant="outline" size="sm" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && !summary && (
        <Card><CardContent className="py-8 text-center text-muted-foreground">{t.noData}</CardContent></Card>
      )}

      {!loading && summary && (
        <>
          {/* Overview Cards */}
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">{t.documents}</div>
                <div className="text-2xl font-bold">{summary.overview.totalDocuments}</div>
                <div className="text-xs text-muted-foreground">
                  {summary.comparison.documentCountChange >= 0 ? "+" : ""}{summary.comparison.documentCountChange} {t.comparison}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">{t.totalAmount}</div>
                <div className="text-2xl font-bold">{formatCurrency(summary.overview.totalGrossAmount)}</div>
                <div className={"flex items-center gap-1 text-xs " + trendColor}>
                  <TrendIcon className="h-3 w-3" />
                  {summary.comparison.grossAmountChangePercent >= 0 ? "+" : ""}{summary.comparison.grossAmountChangePercent}%
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">{t.vatAmount}</div>
                <div className="text-2xl font-bold">{formatCurrency(summary.overview.totalVatAmount)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">{t.unpaid}</div>
                <div className="text-2xl font-bold">{summary.paymentStatus.unpaidCount}</div>
                <div className="text-xs text-muted-foreground">{formatCurrency(summary.paymentStatus.totalUnpaid)}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Top Suppliers */}
            <Card>
              <CardHeader><CardTitle className="text-base">{t.topSuppliers}</CardTitle></CardHeader>
              <CardContent>
                {summary.topSuppliers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t.noData}</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-muted-foreground text-xs">
                      <th className="pb-2">Lieferant</th><th className="pb-2 text-right">Belege</th><th className="pb-2 text-right">Betrag</th><th className="pb-2 text-right">Anteil</th>
                    </tr></thead>
                    <tbody>
                      {summary.topSuppliers.map((s, i) => (
                        <tr key={i} className="border-t">
                          <td className="py-1.5">{s.name}</td>
                          <td className="py-1.5 text-right">{s.documentCount}</td>
                          <td className="py-1.5 text-right">{formatCurrency(s.totalAmount)}</td>
                          <td className="py-1.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 rounded-full" style={{ width: s.percentOfTotal + "%" }} />
                              </div>
                              <span className="text-xs w-8 text-right">{s.percentOfTotal}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

            {/* Top Accounts */}
            <Card>
              <CardHeader><CardTitle className="text-base">{t.topAccounts}</CardTitle></CardHeader>
              <CardContent>
                {summary.topAccounts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t.noData}</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-muted-foreground text-xs">
                      <th className="pb-2">Konto</th><th className="pb-2">Bezeichnung</th><th className="pb-2 text-right">Belege</th><th className="pb-2 text-right">Betrag</th>
                    </tr></thead>
                    <tbody>
                      {summary.topAccounts.map((a, i) => (
                        <tr key={i} className="border-t">
                          <td className="py-1.5 font-mono text-xs">{a.accountCode}</td>
                          <td className="py-1.5">{a.accountName || "\u2014"}</td>
                          <td className="py-1.5 text-right">{a.documentCount}</td>
                          <td className="py-1.5 text-right">{formatCurrency(a.totalAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Anomalies */}
          <Card>
            <CardHeader><CardTitle className="text-base">{t.anomalies.title}</CardTitle></CardHeader>
            <CardContent>
              {summary.anomalies.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.anomalies.none}</p>
              ) : (
                <div className="space-y-2">
                  {summary.anomalies.map((a, i) => {
                    const Icon = anomalyIcons[a.type] || AlertTriangle;
                    const color = anomalyColors[a.type] || "text-gray-500";
                    return (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <Icon className={"h-4 w-4 mt-0.5 shrink-0 " + color} />
                        <span>{a.message}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Status */}
          <Card>
            <CardHeader><CardTitle className="text-base">{t.paymentStatus}</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-green-500" />{t.paid}: {summary.paymentStatus.paidCount}</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-amber-500" />{t.unpaid}: {summary.paymentStatus.unpaidCount}</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-red-500" />{t.overdue}: {summary.paymentStatus.overdueCount}</div>
              </div>
              {(summary.paymentStatus.paidCount + summary.paymentStatus.unpaidCount) > 0 && (
                <div className="mt-3 h-3 flex rounded-full overflow-hidden bg-gray-100">
                  {summary.paymentStatus.paidCount > 0 && (
                    <div className="bg-green-500" style={{ width: (summary.paymentStatus.paidCount / (summary.paymentStatus.paidCount + summary.paymentStatus.unpaidCount) * 100) + "%" }} />
                  )}
                  {summary.paymentStatus.unpaidCount > 0 && (
                    <div className="bg-amber-500" style={{ width: (summary.paymentStatus.unpaidCount / (summary.paymentStatus.paidCount + summary.paymentStatus.unpaidCount) * 100) + "%" }} />
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
