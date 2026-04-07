"use client";

import { useEffect, useState } from "react";
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
import { Download } from "lucide-react";
import { de } from "@/lib/i18n/de";
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

export default function ExportsPage() {
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Dialog state
  const [format, setFormat] = useState("csv-excel");
  const [filter, setFilter] = useState("all-ready");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedCols, setSelectedCols] = useState<Set<string>>(
    new Set(ALL_COLUMNS.map((c) => c.key))
  );

  useEffect(() => {
    fetch("/api/exports").then((r) => r.json())
      .then((data) => setBatches(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

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

      // Refresh history
      const historyRes = await fetch("/api/exports");
      if (historyRes.ok) setBatches(await historyRes.json());
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setExporting(false);
    }
  }

  function formatTimestamp(ts: string) {
    const d = new Date(ts);
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{de.exports.title}</h1>
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

      {/* Export history */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{de.exports.history}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-4 text-muted-foreground">{de.common.loading}</p>
          ) : batches.length === 0 ? (
            <p className="text-center py-4 text-muted-foreground">{de.exports.noExports}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{de.auditLog.timestamp}</TableHead>
                  <TableHead>{de.exports.batchId}</TableHead>
                  <TableHead>{de.exports.documentCount}</TableHead>
                  <TableHead>{de.documents.status}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((b: any) => (
                  <TableRow key={b.batchId}>
                    <TableCell className="text-xs">{formatTimestamp(b.createdAt)}</TableCell>
                    <TableCell className="text-xs font-mono">{b.batchId.slice(0, 8)}</TableCell>
                    <TableCell>{b.count}</TableCell>
                    <TableCell className="text-xs">{b.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
