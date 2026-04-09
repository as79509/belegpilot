"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogClose,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, FolderArchive, Loader2, RefreshCw, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { StatusBadge } from "@/components/ds/status-badge";
import { de } from "@/lib/i18n/de";
import { formatCurrency } from "@/lib/i18n/format";
import { toast } from "sonner";

const ALL_COLUMNS = [
  { key: "documentNumber", label: "Belegnummer" },
  { key: "supplier", label: "Lieferant" },
  { key: "invoiceNumber", label: "Rechnungsnr." },
  { key: "invoiceDate", label: "Rechnungsdatum" },
  { key: "dueDate", label: "Fälligkeitsdatum" },
  { key: "currency", label: "Währung" },
  { key: "netAmount", label: "Netto" },
  { key: "vatAmount", label: "MwSt" },
  { key: "grossAmount", label: "Brutto" },
  { key: "vatRates", label: "MwSt-Satz" },
  { key: "category", label: "Kategorie" },
  { key: "accountCode", label: "Kontonummer" },
  { key: "costCenter", label: "Kostenstelle" },
  { key: "iban", label: "IBAN" },
  { key: "paymentReference", label: "Zahlungsreferenz" },
];

interface BatchSummary {
  batchId: string;
  createdAt: string;
  exportTarget: string;
  count: number;
  status: string;
  failures: Array<{
    documentId: string;
    documentNumber: string | null;
    supplierName: string | null;
    errorMessage: string | null;
  }>;
  documentIds: string[];
}

interface NotExportedDoc {
  id: string;
  documentNumber: string | null;
  supplierName: string | null;
  grossAmount: number | string | null;
  reason: "noAccount" | "noMapping" | "validationError" | "unknown";
}

interface BexioStatus {
  configured: boolean;
  isEnabled: boolean;
  lastTestedAt: string | null;
  lastTestStatus: string | null;
}

export default function ExportsPage() {
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [notExported, setNotExported] = useState<NotExportedDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [retryingBatch, setRetryingBatch] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bexioStatus, setBexioStatus] = useState<BexioStatus | null>(null);

  // Dialog state
  const [format, setFormat] = useState("csv-excel");
  const [filter, setFilter] = useState("all-ready");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedCols, setSelectedCols] = useState<Set<string>>(
    new Set(ALL_COLUMNS.map((c) => c.key))
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [exportsRes, bexioRes] = await Promise.all([
        fetch("/api/exports"),
        fetch("/api/bexio/settings").catch(() => null),
      ]);
      if (exportsRes.ok) {
        const data = await exportsRes.json();
        // Backwards compatibility: API may have returned an array previously
        if (Array.isArray(data)) {
          setBatches(data);
          setNotExported([]);
        } else {
          setBatches(Array.isArray(data.batches) ? data.batches : []);
          setNotExported(Array.isArray(data.notExported) ? data.notExported : []);
        }
      }
      if (bexioRes?.ok) {
        const bexioData = await bexioRes.json();
        setBexioStatus(bexioData);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  function toggleCol(key: string) {
    setSelectedCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/exports/csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          filter,
          dateFrom: filter === "date-range" ? dateFrom : undefined,
          dateTo: filter === "date-range" ? dateTo : undefined,
          columns: Array.from(selectedCols),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const ext = format === "xlsx" ? "xlsx" : "csv";
      const a = document.createElement("a");
      a.href = url;
      a.download = `belegpilot-export.${ext}`;
      a.click();
      URL.revokeObjectURL(url);

      const count = res.headers.get("X-Export-Count") || "0";
      toast.success(`${count} ${de.exports.exportSuccess}`);
      setDialogOpen(false);
      loadAll();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setExporting(false);
    }
  }

  async function handleRetryBatch(batch: BatchSummary) {
    if (batch.failures.length === 0 && batch.documentIds.length === 0) return;
    const documentIds = batch.failures.length > 0
      ? batch.failures.map((f) => f.documentId)
      : batch.documentIds;
    setRetryingBatch(batch.batchId);
    try {
      const res = await fetch("/api/bexio/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentIds, force: true }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || de.exportsDeep.retryFailed);
      }
      const data = await res.json();
      const successCount = data.successCount ?? 0;
      toast.success(`${de.exportsDeep.retrySuccess}: ${successCount}/${documentIds.length}`);
      loadAll();
    } catch (err: any) {
      toast.error(err.message || de.exportsDeep.retryFailed);
    } finally {
      setRetryingBatch(null);
    }
  }

  function formatTimestamp(ts: string) {
    const d = new Date(ts);
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  function reasonLabel(reason: NotExportedDoc["reason"]): string {
    switch (reason) {
      case "noAccount": return de.exportsDeep.noAccount;
      case "noMapping": return de.exportsDeep.noMapping;
      case "validationError": return de.exportsDeep.validationError;
      default: return "—";
    }
  }

  function reasonLink(doc: NotExportedDoc): { href: string; label: string } {
    if (doc.reason === "noMapping") {
      return { href: "/settings/integrations", label: de.exportsDeep.openSettings };
    }
    return { href: `/documents/${doc.id}`, label: de.exportsDeep.openDocument };
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{de.exports.title}</h1>
        <div className="flex gap-2">
          <Button variant="outline" disabled={exporting} onClick={async () => {
            setExporting(true);
            try {
              const res = await fetch("/api/documents/download-zip", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ filter: "all-ready" }),
              });
              if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url; a.download = "belegpilot-belege.zip"; a.click();
              URL.revokeObjectURL(url);
            } catch (err: any) { toast.error(err.message); } finally { setExporting(false); }
          }}>
            {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FolderArchive className="h-4 w-4 mr-2" />}
            {de.exports.downloadZip}
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger>
              <Button><Download className="h-4 w-4 mr-2" />Exportieren</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{de.exports.csvExport}</DialogTitle>
              </DialogHeader>

              <div className="space-y-5">
                {/* Format */}
                <div>
                  <Label className="text-sm font-medium">Format</Label>
                  <div className="mt-2 space-y-2">
                    {[
                      { value: "csv-excel", label: "CSV für Excel (Semikolon, deutsche Zahlen)" },
                      { value: "csv-standard", label: "CSV Standard (Komma, international)" },
                      { value: "xlsx", label: "Excel (.xlsx)" },
                    ].map((opt) => (
                      <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="radio" name="format" value={opt.value} checked={format === opt.value} onChange={() => setFormat(opt.value)} className="accent-blue-600" />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Filter */}
                <div>
                  <Label className="text-sm font-medium">Was exportieren</Label>
                  <div className="mt-2 space-y-2">
                    {[
                      { value: "all-ready", label: "Alle bereiten Belege" },
                      { value: "not-exported", label: "Nur nicht-exportierte bereite Belege" },
                      { value: "date-range", label: "Nach Datumsbereich" },
                    ].map((opt) => (
                      <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="radio" name="filter" value={opt.value} checked={filter === opt.value} onChange={() => setFilter(opt.value)} className="accent-blue-600" />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                  {filter === "date-range" && (
                    <div className="mt-2 flex gap-2">
                      <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} placeholder="Von" />
                      <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} placeholder="Bis" />
                    </div>
                  )}
                </div>

                {/* Columns */}
                <div>
                  <Label className="text-sm font-medium">Spalten</Label>
                  <div className="mt-2 grid grid-cols-2 gap-1">
                    {ALL_COLUMNS.map((col) => (
                      <label key={col.key} className="flex items-center gap-2 text-xs cursor-pointer py-0.5">
                        <Checkbox checked={selectedCols.has(col.key)} onCheckedChange={() => toggleCol(col.key)} />
                        {col.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <DialogClose><Button variant="outline">{de.common.cancel}</Button></DialogClose>
                <Button onClick={handleExport} disabled={exporting}>
                  <Download className="h-4 w-4 mr-2" />
                  {exporting ? de.common.loading : "Exportieren"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Bexio status */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{de.exportsDeep.bexioStatus}</CardTitle>
        </CardHeader>
        <CardContent>
          {bexioStatus == null ? (
            <Skeleton className="h-4 w-48" />
          ) : !bexioStatus.configured ? (
            <p className="text-xs text-muted-foreground">{de.exportsDeep.notConfigured}</p>
          ) : (
            <div className="flex flex-wrap items-center gap-3 text-xs">
              {bexioStatus.lastTestStatus === "connected" ? (
                <span className="inline-flex items-center gap-1 text-green-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {de.exportsDeep.connected}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-red-700">
                  <XCircle className="h-3.5 w-3.5" /> {de.exportsDeep.disconnected}
                </span>
              )}
              {bexioStatus.lastTestedAt && (
                <span className="text-muted-foreground">
                  {de.exportsDeep.lastSync}: {formatTimestamp(bexioStatus.lastTestedAt)}
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Export history */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{de.exports.history}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2 py-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-4"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-16" /><Skeleton className="h-4 w-8" /><Skeleton className="h-4 w-12" /></div>
              ))}
            </div>
          ) : batches.length === 0 ? (
            <div className="text-center py-8">
              <Download className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">{de.exports.noExports}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{de.exportsDeep.batchId}</TableHead>
                  <TableHead>{de.auditLog.timestamp}</TableHead>
                  <TableHead>{de.exportsDeep.format}</TableHead>
                  <TableHead>{de.exportsDeep.count}</TableHead>
                  <TableHead>{de.documents.status}</TableHead>
                  <TableHead>{de.exportsDeep.errorDetails}</TableHead>
                  <TableHead className="text-right">{de.exportsDeep.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((b) => (
                  <TableRow key={b.batchId}>
                    <TableCell className="text-xs font-mono">{b.batchId.slice(0, 8)}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{formatTimestamp(b.createdAt)}</TableCell>
                    <TableCell className="text-xs">{b.exportTarget || "—"}</TableCell>
                    <TableCell className="text-xs">{b.count}</TableCell>
                    <TableCell>
                      <StatusBadge type="export" value={b.status} size="sm" />
                    </TableCell>
                    <TableCell className="text-xs max-w-[280px]">
                      {b.failures.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <ul className="space-y-0.5">
                          {b.failures.slice(0, 3).map((f) => (
                            <li key={f.documentId} className="truncate">
                              <Link
                                href={`/documents/${f.documentId}`}
                                className="text-blue-600 hover:underline font-mono mr-1"
                              >
                                {f.documentNumber || f.documentId.slice(0, 8)}
                              </Link>
                              <span className="text-red-700">{f.errorMessage}</span>
                            </li>
                          ))}
                          {b.failures.length > 3 && (
                            <li className="text-muted-foreground">+{b.failures.length - 3}</li>
                          )}
                        </ul>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {(b.status === "failed" || b.failures.length > 0) && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={retryingBatch === b.batchId}
                          onClick={() => handleRetryBatch(b)}
                        >
                          {retryingBatch === b.batchId ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3 w-3 mr-1" />
                          )}
                          {de.exportsDeep.retry}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Not exported documents */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            {de.exportsDeep.notExported}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2 py-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          ) : notExported.length === 0 ? (
            <p className="text-sm text-muted-foreground">{de.exportsDeep.noFailedDocs}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{de.documents.invoiceNumber}</TableHead>
                  <TableHead>{de.documents.supplier}</TableHead>
                  <TableHead className="text-right">{de.documents.amount}</TableHead>
                  <TableHead>{de.exportsDeep.notExportedReason}</TableHead>
                  <TableHead className="text-right">{de.exportsDeep.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notExported.map((d) => {
                  const link = reasonLink(d);
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="text-xs font-mono">
                        <Link href={`/documents/${d.id}`} className="text-blue-600 hover:underline">
                          {d.documentNumber || d.id.slice(0, 8)}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs max-w-[180px] truncate">
                        {d.supplierName || "—"}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap text-right">
                        {d.grossAmount != null ? formatCurrency(d.grossAmount, "CHF") : "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className="inline-block px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                          {reasonLabel(d.reason)}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-right">
                        <Link href={link.href} className="text-blue-600 hover:underline">
                          {link.label}
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
