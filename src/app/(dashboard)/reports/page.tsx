"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { BarChart3, FileText, CheckCircle2, XCircle, Eye, TrendingUp, AlertTriangle } from "lucide-react";
import { de } from "@/lib/i18n/de";
import { formatCurrency, formatNumber, formatConfidence } from "@/lib/i18n/format";
import { useCompany } from "@/lib/contexts/company-context";

const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

export default function ReportsPage() {
  const { isMultiCompany } = useCompany();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [quarter, setQuarter] = useState(Math.ceil((now.getMonth() + 1) / 3));
  const [vatYear, setVatYear] = useState(now.getFullYear());

  const [monthly, setMonthly] = useState<any>(null);
  const [vat, setVat] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [loadingMonthly, setLoadingMonthly] = useState(true);
  const [loadingVat, setLoadingVat] = useState(true);
  const [loadingClients, setLoadingClients] = useState(true);

  const fetchMonthly = useCallback(async () => {
    setLoadingMonthly(true);
    try {
      const res = await fetch(`/api/reports/monthly?year=${year}&month=${month}`);
      if (res.ok) setMonthly(await res.json());
    } catch {} finally { setLoadingMonthly(false); }
  }, [year, month]);

  const fetchVat = useCallback(async () => {
    setLoadingVat(true);
    try {
      const res = await fetch(`/api/reports/vat-summary?year=${vatYear}&quarter=${quarter}`);
      if (res.ok) setVat(await res.json());
    } catch {} finally { setLoadingVat(false); }
  }, [vatYear, quarter]);

  const fetchClients = useCallback(async () => {
    if (!isMultiCompany) { setLoadingClients(false); return; }
    setLoadingClients(true);
    try {
      const res = await fetch("/api/reports/client-comparison");
      if (res.ok) { const data = await res.json(); setClients(data.clients || []); }
    } catch {} finally { setLoadingClients(false); }
  }, [isMultiCompany]);

  useEffect(() => { fetchMonthly(); }, [fetchMonthly]);
  useEffect(() => { fetchVat(); }, [fetchVat]);
  useEffect(() => { fetchClients(); }, [fetchClients]);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-6 w-6" />
        <h1 className="text-2xl font-semibold tracking-tight">{de.reports.title}</h1>
      </div>

      {/* Section 1: Monthly Overview */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">{de.reports.monthlyOverview}</h2>
          <div className="flex gap-2">
            <select className="border rounded-md px-3 py-1.5 text-sm" value={month} onChange={(e) => setMonth(parseInt(e.target.value))}>
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select className="border rounded-md px-3 py-1.5 text-sm" value={year} onChange={(e) => setYear(parseInt(e.target.value))}>
              {[2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {loadingMonthly ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
        ) : !monthly || monthly.documentsTotal === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">{de.reports.noData}</CardContent></Card>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><FileText className="h-3.5 w-3.5" />{de.reports.documentsTotal}</div>
                  <p className="text-2xl font-bold">{monthly.documentsTotal}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><CheckCircle2 className="h-3.5 w-3.5 text-green-500" />{de.reports.autoApproved}</div>
                  <p className="text-2xl font-bold">{monthly.autoApprovedCount}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Eye className="h-3.5 w-3.5 text-blue-500" />{de.reports.manualReview}</div>
                  <p className="text-2xl font-bold">{monthly.manualReviewCount}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><XCircle className="h-3.5 w-3.5 text-red-500" />{de.reports.failed}</div>
                  <p className="text-2xl font-bold text-red-600">{monthly.documentsFailed}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><TrendingUp className="h-3.5 w-3.5" />{de.reports.avgConfidence}</div>
                  <p className="text-2xl font-bold">{formatConfidence(monthly.avgConfidence)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">{de.reports.totalAmount}</div>
                  <p className="text-2xl font-bold">{formatCurrency(monthly.totalGrossAmount)}</p>
                </CardContent>
              </Card>
            </div>

            {monthly.topSuppliers?.length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{de.reports.topSuppliers}</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {monthly.topSuppliers.map((s: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{i + 1}. {s.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">{s.count} Belege</span>
                          <span className="font-medium">{formatCurrency(s.amount)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </section>

      {/* Section 2: VAT Summary */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">{de.reports.vatSummary}</h2>
          <div className="flex gap-2">
            <select className="border rounded-md px-3 py-1.5 text-sm" value={quarter} onChange={(e) => setQuarter(parseInt(e.target.value))}>
              {[1, 2, 3, 4].map((q) => <option key={q} value={q}>{de.reports.quarter} {q}</option>)}
            </select>
            <select className="border rounded-md px-3 py-1.5 text-sm" value={vatYear} onChange={(e) => setVatYear(parseInt(e.target.value))}>
              {[2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {loadingVat ? (
          <Skeleton className="h-48" />
        ) : !vat || vat.total.documentCount === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">{de.reports.noData}</CardContent></Card>
        ) : (
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{de.reports.vatRate}</TableHead>
                    <TableHead className="text-right">{de.reports.netAmount}</TableHead>
                    <TableHead className="text-right">{de.reports.vatAmount}</TableHead>
                    <TableHead className="text-right">{de.reports.grossAmount}</TableHead>
                    <TableHead className="text-right">{de.reports.documentCount}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vat.rates.filter((r: any) => r.documentCount > 0).map((r: any) => (
                    <TableRow key={r.rate}>
                      <TableCell className="font-medium">{r.rateLabel}</TableCell>
                      <TableCell className="text-right">{formatCurrency(r.netAmount)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(r.vatAmount)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(r.grossAmount)}</TableCell>
                      <TableCell className="text-right">{r.documentCount}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold border-t-2">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{formatCurrency(vat.total.netAmount)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(vat.total.vatAmount)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(vat.total.grossAmount)}</TableCell>
                    <TableCell className="text-right">{vat.total.documentCount}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Section 3: Client Comparison (multi-company only) */}
      {isMultiCompany && (
        <section className="space-y-4">
          <h2 className="text-lg font-medium">{de.reports.clientComparison}</h2>

          {loadingClients ? (
            <Skeleton className="h-48" />
          ) : clients.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">{de.reports.noData}</CardContent></Card>
          ) : (
            <Card>
              <CardContent className="pt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Firma</TableHead>
                      <TableHead className="text-right">{de.reports.documentCount}</TableHead>
                      <TableHead className="text-right">{de.reports.totalAmount}</TableHead>
                      <TableHead className="text-right">{de.reports.avgConfidence}</TableHead>
                      <TableHead className="text-right">{de.reports.openTasks}</TableHead>
                      <TableHead>{de.reports.monthStatus}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.map((c: any) => {
                      const hasIssues = c.openTasks > 5 || c.avgConfidence < 0.6;
                      return (
                        <TableRow key={c.companyId} className={hasIssues ? "bg-amber-50" : ""}>
                          <TableCell className="font-medium">
                            {c.companyName}
                            {hasIssues && <AlertTriangle className="inline h-3.5 w-3.5 ml-1 text-amber-500" />}
                          </TableCell>
                          <TableCell className="text-right">{c.documentCount}</TableCell>
                          <TableCell className="text-right">{formatCurrency(c.totalAmount)}</TableCell>
                          <TableCell className="text-right">{formatConfidence(c.avgConfidence)}</TableCell>
                          <TableCell className="text-right">
                            <span className={c.openTasks > 5 ? "text-red-600 font-medium" : ""}>{c.openTasks}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {de.periods.status[c.periodStatus as keyof typeof de.periods.status] || c.periodStatus}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </section>
      )}
    </div>
  );
}
