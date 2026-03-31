"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Download } from "lucide-react";
import { de } from "@/lib/i18n/de";
import { toast } from "sonner";

export default function ExportsPage() {
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [separator, setSeparator] = useState(";");

  useEffect(() => {
    fetch("/api/exports")
      .then((r) => r.json())
      .then((data) => setBatches(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  async function handleExportAll() {
    setExporting(true);
    try {
      const res = await fetch("/api/exports/csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ separator }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      // Download the CSV
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `belegpilot-export.csv`;
      a.click();
      URL.revokeObjectURL(url);

      const count = res.headers.get("X-Export-Count") || "0";
      toast.success(`${count} ${de.exports.exportSuccess}`);

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
      <h1 className="text-2xl font-semibold tracking-tight">{de.exports.title}</h1>

      {/* Export action */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{de.exports.csvExport}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <select
            value={separator}
            onChange={(e) => setSeparator(e.target.value)}
            className="border rounded-md px-3 py-1.5 text-sm"
          >
            <option value=";">{de.exports.semicolon}</option>
            <option value=",">{de.exports.comma}</option>
          </select>
          <Button onClick={handleExportAll} disabled={exporting}>
            <Download className="h-4 w-4 mr-2" />
            {exporting ? de.common.loading : de.exports.exportAll}
          </Button>
        </CardContent>
      </Card>

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
