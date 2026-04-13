"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ds";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  ClipboardList, Plus, Download, Search, Trash2, Pencil, CheckCircle2,
  XCircle, AlertTriangle, Loader2,
} from "lucide-react";
import { de } from "@/lib/i18n/de";
import { formatCurrency } from "@/lib/i18n/format";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  received: "bg-green-100 text-green-800",
  missing: "bg-red-100 text-red-800",
  amount_mismatch: "bg-amber-100 text-amber-800",
  not_expected: "bg-gray-100 text-gray-500",
};

const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

export default function ExpectedDocumentsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkResults, setCheckResults] = useState<any>(null);
  const [checkLoading, setCheckLoading] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ name: "", counterparty: "", frequency: "monthly", expectedAmount: "", tolerancePercent: "20", debitAccount: "", linkedContractId: "" });
  const [importing, setImporting] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/expected-documents");
      if (res.ok) setItems(await res.json());
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  async function runCheck() {
    setCheckLoading(true);
    try {
      const res = await fetch(`/api/expected-documents/check?year=${year}&month=${month}`);
      if (res.ok) setCheckResults(await res.json());
    } catch {} finally { setCheckLoading(false); }
  }

  function openCreate() {
    setEditItem(null);
    setForm({ name: "", counterparty: "", frequency: "monthly", expectedAmount: "", tolerancePercent: "20", debitAccount: "", linkedContractId: "" });
    setDialogOpen(true);
  }

  function openEdit(item: any) {
    setEditItem(item);
    setForm({
      name: item.name, counterparty: item.counterparty, frequency: item.frequency,
      expectedAmount: item.expectedAmount ?? "", tolerancePercent: String(item.tolerancePercent ?? 20),
      debitAccount: item.debitAccount || "", linkedContractId: item.linkedContractId || "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    const body = {
      ...form,
      expectedAmount: form.expectedAmount ? Number(form.expectedAmount) : null,
      tolerancePercent: form.tolerancePercent ? Number(form.tolerancePercent) : 20,
      linkedContractId: form.linkedContractId || null,
    };
    try {
      const url = editItem ? `/api/expected-documents/${editItem.id}` : "/api/expected-documents";
      const method = editItem ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(de.settings.saved);
      setDialogOpen(false);
      fetchItems();
    } catch (err: any) { toast.error(err.message); }
  }

  async function handleDelete(id: string) {
    if (!confirm(de.common.confirm + "?")) return;
    try {
      await fetch(`/api/expected-documents/${id}`, { method: "DELETE" });
      toast.success(de.common.delete);
      fetchItems();
    } catch {}
  }

  async function handleImportFromContracts() {
    setImporting(true);
    try {
      const res = await fetch("/api/contracts");
      if (!res.ok) return;
      const contracts = await res.json();
      let imported = 0;
      for (const c of contracts) {
        if (c.status !== "active") continue;
        // Check if already exists
        const existing = items.find((i) => i.counterparty === c.counterparty && i.linkedContractId === c.id);
        if (existing) continue;
        const createRes = await fetch("/api/expected-documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: c.name,
            counterparty: c.counterparty,
            frequency: c.frequency,
            expectedAmount: c.monthlyAmount,
            linkedContractId: c.id,
          }),
        });
        if (createRes.ok) imported++;
      }
      toast.success(`${imported} ${de.expectedDocs.imported}`);
      fetchItems();
    } catch (err: any) { toast.error(err.message); }
    finally { setImporting(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{de.expectedDocs.title}</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleImportFromContracts} disabled={importing}>
            {importing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
            {de.expectedDocs.importFromContracts}
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />{de.expectedDocs.newExpected}
          </Button>
        </div>
      </div>

      {/* Completeness check */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{de.expectedDocs.checkTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <select className="border rounded-md px-3 py-1.5 text-sm bg-white" value={month} onChange={(e) => setMonth(parseInt(e.target.value))}>
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select className="border rounded-md px-3 py-1.5 text-sm bg-white" value={year} onChange={(e) => setYear(parseInt(e.target.value))}>
              {[2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <Button size="sm" onClick={runCheck} disabled={checkLoading}>
              {checkLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
              {de.expectedDocs.check}
            </Button>
          </div>

          {checkResults && (
            <>
              <div className="flex gap-3 text-sm">
                <span className="text-green-700">{checkResults.summary.received} {de.expectedDocs.receivedCount}</span>
                <span className="text-red-700">{checkResults.summary.missing} {de.expectedDocs.missingCount}</span>
                {checkResults.summary.mismatch > 0 && (
                  <span className="text-amber-700">{checkResults.summary.mismatch} {de.expectedDocs.status.amount_mismatch}</span>
                )}
                <span className="text-muted-foreground">
                  {checkResults.summary.received} von {checkResults.summary.total} {de.expectedDocs.receivedCount}
                </span>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">{de.expectedDocs.name}</TableHead>
                    <TableHead className="text-xs">{de.expectedDocs.counterparty}</TableHead>
                    <TableHead className="text-xs">{de.expectedDocs.expectedAmount}</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">{de.expectedDocs.actualAmount}</TableHead>
                    <TableHead className="text-xs">{de.expectedDocs.deviation}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checkResults.expected.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">{r.name}</TableCell>
                      <TableCell className="text-sm">{r.counterparty}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {r.expectedAmount ? formatCurrency(r.expectedAmount, "CHF") : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`text-xs ${STATUS_COLORS[r.status] || ""}`}>
                          {r.status === "received" && <CheckCircle2 className="h-3 w-3 mr-0.5" />}
                          {r.status === "missing" && <XCircle className="h-3 w-3 mr-0.5" />}
                          {r.status === "amount_mismatch" && <AlertTriangle className="h-3 w-3 mr-0.5" />}
                          {de.expectedDocs.status[r.status] || r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {r.actualAmount != null ? formatCurrency(r.actualAmount, "CHF") : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.deviation != null ? (
                          <span className={r.deviation > 0 ? "text-amber-600" : "text-amber-600"}>
                            {r.deviation > 0 ? "+" : ""}{formatCurrency(r.deviation, "CHF")}
                          </span>
                        ) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      {/* Management table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{de.expectedDocs.title}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : items.length === 0 ? (
            <EmptyState icon={ClipboardList} title={de.emptyStates.expectedDocs.title} description={de.emptyStates.expectedDocs.description} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">{de.expectedDocs.name}</TableHead>
                  <TableHead className="text-xs">{de.expectedDocs.counterparty}</TableHead>
                  <TableHead className="text-xs">Frequenz</TableHead>
                  <TableHead className="text-xs">{de.expectedDocs.expectedAmount}</TableHead>
                  <TableHead className="text-xs">Aktiv</TableHead>
                  <TableHead className="text-xs">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm">{item.name}</TableCell>
                    <TableCell className="text-sm">{item.counterparty}</TableCell>
                    <TableCell className="text-sm capitalize">{item.frequency}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {item.expectedAmount ? formatCurrency(item.expectedAmount, "CHF") : "—"}
                    </TableCell>
                    <TableCell>
                      {item.isActive
                        ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                        : <XCircle className="h-4 w-4 text-gray-300" />}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(item)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => handleDelete(item.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editItem ? de.common.edit : de.expectedDocs.newExpected}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">{de.expectedDocs.name}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label className="text-xs">{de.expectedDocs.counterparty}</Label>
              <Input value={form.counterparty} onChange={(e) => setForm({ ...form, counterparty: e.target.value })} /></div>
            <div><Label className="text-xs">Frequenz</Label>
              <select className="w-full border rounded-md px-3 py-1.5 text-sm bg-white" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
                <option value="monthly">Monatlich</option>
                <option value="quarterly">Quartalsweise</option>
                <option value="yearly">Jährlich</option>
              </select></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">{de.expectedDocs.expectedAmount}</Label>
                <Input type="number" step="0.01" value={form.expectedAmount} onChange={(e) => setForm({ ...form, expectedAmount: e.target.value })} /></div>
              <div><Label className="text-xs">{de.expectedDocs.tolerance}</Label>
                <Input type="number" value={form.tolerancePercent} onChange={(e) => setForm({ ...form, tolerancePercent: e.target.value })} /></div>
            </div>
            <div><Label className="text-xs">Soll-Konto</Label>
              <Input value={form.debitAccount} onChange={(e) => setForm({ ...form, debitAccount: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <DialogClose><Button variant="outline">{de.common.cancel}</Button></DialogClose>
            <Button onClick={handleSave} disabled={!form.name.trim() || !form.counterparty.trim()}>{de.common.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
